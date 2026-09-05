import type {
  DecisionContextMetrics,
  EvaluatedDecisionMarket,
  DecisionClassification,
  DecisionMarketDebug
} from "./types";

import {
  firstFiniteNumber,
  firstProbability,
  parseProbability,
  parseOdd,
  parseFiniteNumber,
  parseNonNegativeNumber,
  normalizeWarnings,
  roundNumber
} from "./helpers";

import { resolveMarketPolicy } from "./marketPolicies";

import { evaluateDecisionGuards } from "./guards";

import { evaluateOperationalPolicy } from "./operationalPolicy";

import { classifyMarket, buildThresholdDiagnostics } from "./classification";

import { capClassification } from "./classificationLimiter";

import { calculateDecisionStake, calculateKellyFraction } from "./stake";

import { getClassificationPriority } from "./ranking";

import { parseDecisionMarket } from "./marketCode";

import { buildDecisionExplanation } from "./explain";

import { calculateUncertaintyAdjustment } from "../../../domain/analysis/uncertaintyAdjustment";

import { calculateRobustness } from "../../../domain/analysis/robustness";

import { calculateDecisionScore } from "../../../domain/analysis/decisionScore";

import { detectExtremeValue } from "../../../domain/analysis/extremeValueDetector";

import { calculateFamilyConsensus } from "../../../domain/analysis/marketFamily";

import { deriveDecisionState } from "./decisionState";

import type { PipelineRecord } from "../pipelineRecord";

/* ==========================================
   AVALIAÇÃO DO MERCADO
========================================== */

export function evaluateMarket(
  market: PipelineRecord,
  originalIndex: number,
  data: PipelineRecord,
  decisionContext:
    DecisionContextMetrics
): EvaluatedDecisionMarket {

  const marketName =
    parseDecisionMarket(
      market?.market
    );

  const probability =
    parseProbability(
      market?.probability
    );

  const odd =
    parseOdd(
      market?.odd ??
      market?.odds
    );

  const ev =
    parseFiniteNumber(
      market?.ev ??
      market?.expectedValue
    );

  const probabilityEdge =
    firstFiniteNumber([
      market?.probabilityEdge,
      market?.edge
    ]);

  const risk =
    firstProbability([
      market?.riskScore,
      market?.risk
    ]);

  const confidence =
    parseProbability(
      market?.confidence
    );

  const rankingScore =
    parseProbability(
      market?.rankingScore
    );

  const trapScore =
    parseProbability(
      market?.trapScore
    );

  const sampleReliability =
    firstProbability([
      market?.debug?.confidencePipeline?.sampleReliability,
      market?.effectiveSampleReliability,
      market?.sampleReliability,
      decisionContext.sampleReliability
    ]);

  const leagueTrust =
    firstProbability([
      market?.debug?.confidencePipeline?.leagueTrust,
      market?.leagueTrust,
      market?.dataReliability,
      decisionContext.leagueTrust
    ]);

  const globalConfidence =
    firstProbability([
      market?.debug?.confidencePipeline?.globalConfidence,
      market?.globalConfidence,
      decisionContext.globalConfidence
    ]);

  /*
   * FASE 2 do Decision Intelligence Layer: mesmo sinal que já
   * influencia `confidence` (divergência Monte Carlo vs. Poisson
   * em confidenceEngine.ts), só que exposto de forma explícita e
   * legível. Não participa de nenhum cálculo aqui — só entra em
   * `explain` como telemetria.
   */
  const modelAgreementScore =
    firstProbability([
      market?.debug?.confidencePipeline?.engine?.modelAgreementScore,
      market?.modelAgreementScore
    ]);

  /*
   * FASE 3/4 do Decision Intelligence Layer: rawProbability
   * continua sendo `probability` (usada em guards, stake, e como
   * a probabilidade "oficial" reportada). effectiveProbability
   * passa a ser usada abaixo (fase 4) apenas para reclassificar o
   * mercado contra os MESMOS thresholds de marketPolicies.ts,
   * nunca para alterar probability/ev/risk/confidence/stake
   * diretamente.
   */
  const uncertainty =
    probability !== null
      ? calculateUncertaintyAdjustment({
          probability,
          sampleReliability,
          leagueTrust,
          globalConfidence,
          modelAgreementScore
        })
      : null;

  /*
   * FASE 5 do Decision Intelligence Layer: perturba lambdaHome e
   * lambdaAway (±5%/±10%, um de cada vez) e recalcula EV com a
   * mesma odd via o mesmo motor Poisson/Dixon-Coles (goalsModel).
   * robustnessScore = fração dos 8 cenários em que o EV continua
   * positivo. Telemetria pura (fica em `explain`/debug) — não
   * restringe classificação nesta fase; wiring em decisão real
   * exige a mesma validação por backtest que reprovou a fase 4.
   *
   * OPT-IN via data.computeRobustness: são 9 chamadas extras a
   * goalsModel POR MERCADO (1 baseline + 8 cenários). Para uma
   * análise ao vivo de uma partida (~13 mercados, ~117 chamadas)
   * isso é instantâneo; para o backtest sintético (milhares de
   * partidas × 13 mercados) isso multiplicou o tempo de execução
   * em quase 10x e estourou o timeout de vários testes — medido
   * empiricamente (2026-09-04), não suposição. runBacktest.ts não
   * ativa a flag, então o backtest continua rápido; App.tsx ativa
   * para a análise única ao vivo, onde o custo é irrelevante.
   */
  const robustness =
    data?.computeRobustness === true &&
    marketName &&
    odd !== null &&
    decisionContext.lambdaHome !== null &&
    decisionContext.lambdaAway !== null
      ? calculateRobustness({
          market: marketName,
          lambdaHome: decisionContext.lambdaHome,
          lambdaAway: decisionContext.lambdaAway,
          odd
        })
      : null;

  /*
   * FASE 7 do Decision Intelligence Layer: combina rankingScore
   * (que já é EV/edge+risco+confidence+probabilidade —
   * rankingPipeline.ts) com os sinais realmente novos das fases
   * 2/5/6 (modelAgreement, robustness, redundância de correlação)
   * num único 0–100 para a narrativa "Decision Score" (seção 21
   * do roteiro). Telemetria pura — depois de duas fases (4 e 6)
   * em que usar um sinal "mais esperto" para restringir
   * classificação piorou o ROI no backtest, este score não decide
   * nada; só explica.
   */
  const correlationPenaltyDiagnostic =
    firstProbability([
      market?.correlationPenaltyDiagnostic
    ]);

  const decisionScore =
    calculateDecisionScore({
      rankingScore,
      modelAgreementScore,
      robustnessScore:
        robustness?.robustnessScore ??
        null,
      sampleReliability,
      leagueTrust,
      correlationPenaltyDiagnostic
    });

  /*
   * §7 do roteiro: EV muito alto não é automaticamente bom.
   * Telemetria pura (ver explain.ts) — nunca reduz a exigência de
   * evidência, só sinaliza para revisão humana quando alto demais.
   */
  const extremeValue =
    detectExtremeValue({
      ev,
      probability
    });

  /*
   * §9 do roteiro: consenso de família de mercado. Usa
   * data.markets (todos os mercados já avaliados deste MESMO
   * jogo, com probability/ev já calculados pelos pipelines
   * anteriores) para reconhecer quando outro mercado de família
   * DIFERENTE aponta na mesma direção (poucos/muitos gols) — sem
   * somar os dois EVs como se fossem independentes (ver
   * marketFamily.ts). Puramente narrativo.
   */
  const otherMarketsInGame =
    Array.isArray(data?.markets)
      ? (data.markets as PipelineRecord[])
      : [];

  const familyConsensus =
    marketName
      ? calculateFamilyConsensus({
          market: marketName,

          otherCandidates:
            otherMarketsInGame
              .filter(
                candidate =>
                  String(
                    candidate?.market ??
                    ""
                  ).trim().toUpperCase() !==
                    marketName
              )
              .map(candidate => ({
                market:
                  String(
                    candidate?.market ??
                    ""
                  ),

                ev:
                  parseFiniteNumber(
                    candidate?.ev
                  )
              }))
        })
      : null;

  const goalExpectationScore =
    firstProbability([
      market?.goalExpectationScore,
      decisionContext.goalExpectationScore
    ]);

  const contextualGoalExpectationScore =
    firstProbability([
      market?.contextualGoalExpectationScore,
      decisionContext.contextualGoalExpectationScore
    ]);

  const structureValid =
    market?.structureValid !==
    false;

  const rankingValid =
    market?.rankingValid !==
    false;

  const warnings =
    normalizeWarnings(
      market?.warnings
    );

  const policy =
    marketName
      ? resolveMarketPolicy(
          marketName,
          data?.marketPolicyOverrides
        )
      : null;

const guards =
  evaluateDecisionGuards({
    marketName,
    policy,

    probability,
    odd,
    ev,
    probabilityEdge,
    risk,
    confidence,
    rankingScore,
    trapScore,

    structureValid,
    rankingValid,

    data
  });

const operationalPolicy =
  evaluateOperationalPolicy({
    marketName,

    probability,
    odd,
    ev,
    probabilityEdge,
    risk,
    confidence,

    sampleReliability,
    leagueTrust,
    globalConfidence,
    goalExpectationScore,
    contextualGoalExpectationScore,

    evFloorOverride:
      Number.isFinite(data?.evFloor)
        ? Number(data.evFloor)
        : 0,

    context:
      decisionContext
  });

const baseClassification:
  DecisionClassification =
  guards.valid &&
  marketName &&
  policy &&
  probability !== null &&
  odd !== null &&
  ev !== null &&
  risk !== null &&
  confidence !== null
    ? classifyMarket({
        policy,

        probability,
        ev,
        risk,

        confidence:
          confidence as number,

        odd,
        probabilityEdge,
        rankingScore
      })
    : "NO BET";

/*
 * FASE 4 — EDGE DINÂMICO: reclassifica o mesmo mercado contra os
 * MESMOS thresholds de `policy`, trocando só probability por
 * effectiveProbability (probabilidade já descontada pela
 * incerteza — ver uncertaintyAdjustment.ts). Nenhum threshold
 * novo é inventado; a "exigência de edge" sobe implicitamente
 * porque fica mais difícil bater o mesmo corte de
 * minimumProbability com uma probabilidade menor.
 *
 * Sem uncertainty válida (dados insuficientes para calculá-la),
 * não há penalidade adicional — mesmo comportamento de antes.
 */
const uncertaintyClassification:
  DecisionClassification =
  guards.valid &&
  marketName &&
  policy &&
  uncertainty?.valid &&
  odd !== null &&
  ev !== null &&
  risk !== null &&
  confidence !== null
    ? classifyMarket({
        policy,

        probability:
          uncertainty.effectiveProbability,

        ev,
        risk,

        confidence:
          confidence as number,

        odd,
        probabilityEdge,
        rankingScore
      })
    : baseClassification;

/*
 * uncertaintyCappedClassification é mantida como DIAGNÓSTICO —
 * mostra qual seria a classificação se effectiveProbability
 * também restringisse a decisão. Testado empiricamente via
 * runBacktest (ver comentário em operationalPolicy.ts): piorou o
 * ROI agregado nas duas amostras testadas, então NÃO é aplicada
 * a `classification` real. Fica visível em `explain`/debug para
 * quem quiser acompanhar o quanto ela divergiria, sem apostar
 * dinheiro nessa divergência ainda.
 */
const uncertaintyCappedClassification =
  capClassification(
    baseClassification,
    uncertaintyClassification
  );

const thresholdDiagnostics =
  buildThresholdDiagnostics({
    marketName,
    policy,
    probability,
    odd,
    ev,
    risk,
    confidence,
    probabilityEdge,
    rankingScore,
    baseClassification
  });

const classification:
  DecisionClassification =
  operationalPolicy.blocked
    ? "NO BET"
    : capClassification(
        baseClassification,
        operationalPolicy
          .maximumClassification
      );

const uncertaintyDowngraded =
  getClassificationPriority(
    baseClassification
  ) >
  getClassificationPriority(
    uncertaintyCappedClassification
  );

/*
 * §15 do roteiro: camada derivada ELITE/BET/SCALPER/WATCHLIST/
 * REJECT/INVESTIGATE/NO_BET por cima de `classification` — ver
 * decisionState.ts para por que isso NÃO é um novo valor real de
 * DecisionClassification.
 */
const decisionState =
  deriveDecisionState({
    classification,
    guardBlockers:
      guards.blockers,
    extremeValueClassification:
      extremeValue.classification,
    modelAgreementScore
  });

const explain =
  buildDecisionExplanation({
    marketName,
    policy,

    probability,
    ev,
    probabilityEdge,
    risk,
    confidence,

    sampleReliability,
    leagueTrust,
    globalConfidence,
    modelAgreementScore,

    effectiveProbability:
      uncertainty?.effectiveProbability ??
      null,

    uncertaintyPenalty:
      uncertainty?.uncertaintyPenalty ??
      null,

    robustnessScore:
      robustness?.robustnessScore ??
      null,

    decisionScore:
      decisionScore.score,

    extremeValueClassification:
      extremeValue.classification,

    familyConsensus,

    decisionState,

    guardBlockers:
      guards.blockers,
    guardWarnings:
      guards.warnings,

    operationalBlockers:
      operationalPolicy.blockers,
    operationalWarnings:
      operationalPolicy.warnings,

    baseClassification,
    classification
  });

  const kelly =
    parseNonNegativeNumber(
      market?.kelly
    ) ??
    calculateKellyFraction(
      probability,
      odd
    );

  const stake =
    guards.valid &&
    (
      classification ===
        "SCALPER" ||
      classification ===
        "ELITE" ||
      classification ===
        "BET"
    )
      ? calculateDecisionStake({
          kelly,
          ev,
          risk,
          confidence:
            confidence as number,

          classification
        })
      : 0;

const finalWarnings =
  normalizeWarnings([
    ...warnings,

    ...guards.warnings,
    ...guards.blockers,

    ...(
      thresholdDiagnostics.borderToleranceApplied
        ? [
            "WATCHLIST_BORDER_TOLERANCE_APPLIED"
          ]
        : []
    ),

    ...operationalPolicy
      .warnings,

    ...operationalPolicy
      .blockers,

    ...(
      uncertaintyDowngraded
        ? [
            "UNCERTAINTY_DIAGNOSTIC_WOULD_DOWNGRADE"
          ]
        : []
    )
  ]);

const debug:
  DecisionMarketDebug = {
    valid:
      guards.valid &&
      !operationalPolicy.blocked,

    market:
      marketName,

    policy,

    guards: {
      blockers:
        guards.blockers,

      warnings:
        guards.warnings
    },

    metrics: {
      probability,
      odd,
      ev,
      probabilityEdge,
      risk,
      confidence,
      rankingScore,
      trapScore,

      sampleReliability,
      leagueTrust,

      globalConfidence,

      goalExpectationScore,
      contextualGoalExpectationScore
    },

    operationalPolicy: {
      blocked:
        operationalPolicy.blocked,

      maximumClassification:
        operationalPolicy
          .maximumClassification,

      blockers:
        operationalPolicy.blockers,

      warnings:
        operationalPolicy.warnings,

      dynamicMinimumEv:
        operationalPolicy
          .metrics
          .requiredEv,

      matchBalanceIndex:
        operationalPolicy
          .metrics
          .matchBalanceIndex,

      dominanceScore:
        operationalPolicy
          .metrics
          .dominanceScore,

      drawDependency:
        operationalPolicy
          .metrics
          .drawDependency,

      sampleReliability:
        operationalPolicy
          .metrics
          .sampleReliability,

      leagueTrust:
        operationalPolicy
          .metrics
          .leagueTrust,

      globalConfidence:
        operationalPolicy
          .metrics
          .globalConfidence,

      goalExpectationScore:
        operationalPolicy
          .metrics
          .goalExpectationScore,

      contextualGoalExpectationScore:
        operationalPolicy
          .metrics
          .contextualGoalExpectationScore
    },

    baseClassification,

    thresholdDiagnostics,

    classification,

    uncertaintyClassification,

    uncertaintyDowngraded,

    operationalDowngraded:
      getClassificationPriority(
        baseClassification
      ) >
      getClassificationPriority(
        classification
      ),

    operationalReasons:
      normalizeWarnings([
        ...operationalPolicy.warnings,
        ...operationalPolicy.blockers
      ]),

    stake,

    explain,

    uncertainty
  };

  return {
    ...market,

    /*
     * Telemetria de decisão (Fase 1 do Decision Intelligence
     * Layer) — consolida guards/operationalPolicy num objeto
     * legível. Não participa de nenhum cálculo; puramente
     * informativo/auditável.
     */
    explain,

    /*
     * Fase 3: effectiveProbability/uncertaintyPenalty ficam
     * disponíveis para auditoria, mas `probability` (usada por
     * guards/classificação/stake acima) continua sendo
     * exclusivamente rawProbability.
     */
    uncertainty,

    /*
     * Fase 4 (diagnóstico, não aplicada — ver operationalPolicy.ts):
     * classificação que effectiveProbability produziria contra os
     * mesmos thresholds de `policy`. Não influencia `classification`.
     */
    uncertaintyClassification,
    uncertaintyDowngraded,

    /*
     * Fase 5: robustez sob perturbação de λ (telemetria — ver
     * robustness.ts). Não influencia `classification`.
     */
    robustness,

    /*
     * Fase 7: combina rankingScore + modelAgreement + robustness +
     * redundância de correlação num único 0–100 (telemetria — ver
     * decisionScore.ts). Não influencia `classification`.
     */
    decisionScore:
      decisionScore.score,

    /*
     * §7/§9: telemetria pura (ver explain). Nunca influenciam
     * classification/risk/confidence.
     */
    extremeValueClassification:
      extremeValue.classification,

    familyConsensus,

    /*
     * §15: camada derivada ELITE/BET/SCALPER/WATCHLIST/REJECT/
     * INVESTIGATE/NO_BET (ver decisionState.ts). Nunca substitui
     * `classification`.
     */
    decisionState,

    /*
     * Mantemos os valores produzidos pelos
     * pipelines anteriores.
     */
    probability:
      probability ??
      market?.probability,

    odd:
      odd ??
      market?.odd,

    ev:
      ev ??
      market?.ev,

    probabilityEdge:
      probabilityEdge ??
      market?.probabilityEdge,

    risk:
      risk ??
      market?.risk,

    riskScore:
      risk ??
      market?.riskScore,

    confidence:
      confidence ??
      market?.confidence,

    rankingScore:
      rankingScore ??
      market?.rankingScore,

    kelly:
      roundNumber(
        kelly
      ),

    stake,

    /*
     * Classificação antes das limitações
     * da política operacional.
     */
    baseClassification,

    /*
     * Classificação final.
     */
    classification,

    /*
     * Indica se a política operacional reduziu
     * a classificação original.
     */
    operationalDowngraded:
      getClassificationPriority(
        baseClassification
      ) >
      getClassificationPriority(
        classification
      ),

    /*
     * Limite imposto pela política operacional.
     */
    operationalLimit:
      operationalPolicy
        .maximumClassification,

    /*
     * Motivos que explicam o limite ou bloqueio.
     */
    operationalReasons:
      normalizeWarnings([
        ...operationalPolicy.warnings,
        ...operationalPolicy.blockers
      ]),

    decisionValid:
      guards.valid &&
      !operationalPolicy.blocked,

    decisionOriginalIndex:
      originalIndex,

    decisionBlockers:
      normalizeWarnings([
        ...guards.blockers,
        ...operationalPolicy.blockers
      ]),

    /*
     * NOTA DE AUDITORIA (2026-09-05): não confundir com
     * `explain.decisionWarnings` (§12, códigos derivados de
     * modelAgreement/robustness/extremeValue/família/downgrade).
     * Este campo aqui é anterior às fases do Decision Intelligence
     * Layer e cobre só guards+operationalPolicy — mantido como
     * estava para não quebrar quem já lê `market.decisionWarnings`
     * diretamente (nenhum consumidor confunde os dois hoje,
     * verificado por grep no restante do código).
     */
    decisionWarnings:
      normalizeWarnings([
        ...guards.warnings,
        ...operationalPolicy.warnings
      ]),

    warnings:
      finalWarnings,

    discardedStage:
      !guards.valid
        ? "DECISION_GUARDS"
        : operationalPolicy.blocked
          ? "OPERATIONAL_POLICY"
          : null,

    discardedReason:
      !guards.valid
        ? guards.blockers.join(
            ", "
          )
        : operationalPolicy.blocked
          ? operationalPolicy
              .blockers
              .join(", ")
          : null,

    debug: {
      ...(market?.debug ?? {}),

      decisionPipeline:
        debug
    }
  };
}
