import type {
  CanonicalDecisionMarket,
  DecisionClassification,
  DecisionMarketPolicy
} from "./types";

import { roundNumber } from "./helpers";

import type { ExtremeValueClassification } from "../../../domain/analysis/extremeValueDetector";
import type { FamilyConsensusResult } from "../../../domain/analysis/marketFamily";
import type { DecisionState } from "./decisionState";

/* ==========================================
   EXPLAIN — DECISION TELEMETRY (FASE 1)
========================================== */

/*
 * Responsabilidade:
 *
 * - consolidar, num único objeto legível, os motivos que já
 *   existem espalhados em guards.blockers/warnings,
 *   operationalPolicy.blockers/warnings/reasons e
 *   thresholdDiagnostics;
 * - traduzir métricas já calculadas (probability, ev, risk,
 *   confidence, probabilityEdge, sampleReliability,
 *   leagueTrust, globalConfidence) em frases curtas.
 *
 * Este arquivo não:
 *
 * - recalcula nenhuma métrica;
 * - decide classificação;
 * - altera stake, warnings ou qualquer campo já existente;
 * - introduz decisionScore, modelAgreement ou robustness —
 *   isso é fase 2+ do Decision Intelligence Layer.
 *
 * É telemetria pura: mesma decisão, mesmos números,
 * só organizados para leitura humana.
 */

export interface DecisionExplanation {
  market: CanonicalDecisionMarket | null;

  decision: DecisionClassification;
  baseDecision: DecisionClassification;
  downgraded: boolean;

  /*
   * 0-100 (fase 7) — combina rankingScore com modelAgreement/
   * robustness/redundância de correlação. Telemetria pura, não
   * decide classificação. null quando rankingScore não estava
   * disponível.
   */
  decisionScore: number | null;

  /*
   * §7 do roteiro — nunca reduz exigência, só sinaliza revisão.
   */
  extremeValueClassification: ExtremeValueClassification | null;

  /*
   * §9 do roteiro — outros mercados de família diferente
   * confirmando a mesma direção (poucos/muitos gols). Narrativo;
   * não soma EVs.
   */
  familyConsensus: FamilyConsensusResult | null;

  /*
   * §15 do roteiro — camada derivada, mais granular que
   * `decision` (ver decisionState.ts). Nunca substitui `decision`.
   */
  decisionState: DecisionState;

  /*
   * Evidências que sustentam a entrada — só aparecem quando
   * o dado existe e está numa direção favorável.
   */
  positives: string[];

  /*
   * Evidências que limitam ou explicam a ausência de uma
   * classificação melhor. Inclui os motivos operacionais e
   * de guards já calculados, sem duplicar a lógica.
   */
  negatives: string[];

  /*
   * §12 do roteiro — os mesmos sinais de `positives`/`negatives`,
   * como códigos UPPER_SNAKE_CASE em vez de frases, para uso
   * programático/auditoria (em vez de parsear texto).
   */
  decisionDrivers: string[];
  decisionWarnings: string[];

  summary: string;
}

export function buildDecisionExplanation({
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

  effectiveProbability,
  uncertaintyPenalty,

  robustnessScore,

  decisionScore,

  extremeValueClassification,
  familyConsensus,

  decisionState,

  guardBlockers,
  guardWarnings,

  operationalBlockers,
  operationalWarnings,

  baseClassification,
  classification
}: {
  marketName: CanonicalDecisionMarket | null;
  policy: DecisionMarketPolicy | null;

  probability: number | null;
  ev: number | null;
  probabilityEdge: number | null;
  risk: number | null;
  confidence: number | null;

  sampleReliability: number | null;
  leagueTrust: number | null;
  globalConfidence: number | null;
  modelAgreementScore: number | null;

  effectiveProbability: number | null;
  uncertaintyPenalty: number | null;

  robustnessScore: number | null;

  decisionScore: number | null;

  extremeValueClassification: ExtremeValueClassification | null;
  familyConsensus: FamilyConsensusResult | null;

  decisionState: DecisionState;

  guardBlockers: string[];
  guardWarnings: string[];

  operationalBlockers: string[];
  operationalWarnings: string[];

  baseClassification: DecisionClassification;
  classification: DecisionClassification;
}): DecisionExplanation {
  const positives: string[] = [];
  const negatives: string[] = [];

  const decisionDrivers: string[] = [];
  const decisionWarnings: string[] = [];

  const isActionable =
    classification === "SCALPER" ||
    classification === "ELITE" ||
    classification === "BET";

  /*
   * Evidências positivas: só fazem sentido descrever quando
   * a métrica existe e está numa direção favorável. Não
   * inventamos "positivo" quando o número é ruim.
   */
  if (ev !== null && ev > 0) {
    positives.push(
      `EV +${formatPercent(ev)}`
    );
    decisionDrivers.push("POSITIVE_EV");
  }

  if (probabilityEdge !== null && probabilityEdge > 0) {
    positives.push(
      `edge +${formatPercent(probabilityEdge)}`
    );
    decisionDrivers.push("POSITIVE_EDGE");
  }

  if (probability !== null && policy) {
    positives.push(
      `probabilidade ${formatPercent(probability)}`
    );
    decisionDrivers.push("MODEL_PROBABILITY_AVAILABLE");
  }

  if (confidence !== null) {
    positives.push(
      `confiança ${formatPercent(confidence)}`
    );
    decisionDrivers.push("CONFIDENCE_AVAILABLE");
  }

  if (risk !== null) {
    positives.push(
      `risco ${formatPercent(risk)}`
    );
    decisionDrivers.push("RISK_AVAILABLE");
  }

  if (sampleReliability !== null) {
    positives.push(
      `confiabilidade da amostra ${formatPercent(sampleReliability)}`
    );
    decisionDrivers.push("SAMPLE_RELIABILITY_AVAILABLE");
  }

  if (leagueTrust !== null) {
    positives.push(
      `confiança na liga ${formatPercent(leagueTrust)}`
    );
    decisionDrivers.push("LEAGUE_TRUST_AVAILABLE");
  }

  if (globalConfidence !== null) {
    positives.push(
      `confiança global do modelo ${formatPercent(globalConfidence)}`
    );
    decisionDrivers.push("GLOBAL_CONFIDENCE_AVAILABLE");
  }

  /*
   * modelAgreementScore >= 0.5 corresponde a diff <= 0.08 entre
   * Monte Carlo e Poisson — dentro da faixa que confidenceEngine
   * já trata como "concordância moderada" ou melhor. Abaixo disso
   * é mais informativo tratar como limitação do que como reforço.
   */
  if (modelAgreementScore !== null) {
    if (modelAgreementScore >= 0.5) {
      positives.push(
        `concordância de modelo (Monte Carlo x Poisson) ${formatPercent(modelAgreementScore)}`
      );
      decisionDrivers.push("HIGH_MODEL_AGREEMENT");
    } else {
      negatives.push(
        `baixa concordância de modelo (Monte Carlo x Poisson): ${formatPercent(modelAgreementScore)}`
      );
      decisionWarnings.push("LOW_MODEL_AGREEMENT");
    }
  }

  /*
   * effectiveProbability só é reportada quando o desconto de
   * incerteza é relevante (>0,5pp) — abaixo disso é ruído de
   * arredondamento, não sinal.
   */
  if (
    effectiveProbability !== null &&
    uncertaintyPenalty !== null &&
    uncertaintyPenalty > 0.005
  ) {
    negatives.push(
      `incerteza descontou ${formatPercent(uncertaintyPenalty)} da probabilidade (efetiva ${formatPercent(effectiveProbability)})`
    );
    decisionWarnings.push("UNCERTAINTY_DISCOUNT_APPLIED");
  }

  /*
   * robustnessScore = fração de cenários (λ perturbado em ±5/10%)
   * em que o EV continua positivo. 1.0 = sobrevive a todas as
   * perturbações testadas; 0 = só existe no ponto exato estimado.
   */
  if (robustnessScore !== null) {
    if (robustnessScore >= 0.75) {
      positives.push(
        `robustez ${formatPercent(robustnessScore)} (EV resiste a variações de λ)`
      );
      decisionDrivers.push("ROBUST_TO_LAMBDA_PERTURBATION");
    } else {
      negatives.push(
        `robustez baixa (${formatPercent(robustnessScore)}) — EV frágil a pequenas variações de λ`
      );
      decisionWarnings.push("FRAGILE_TO_LAMBDA_PERTURBATION");
    }
  }

  /*
   * §7: EV muito alto nunca vira "positivo" — na melhor das
   * hipóteses é neutro (NORMAL_VALUE, não listado), na pior é um
   * motivo para desconfiar do próprio input/modelo.
   */
  if (
    extremeValueClassification === "EXTREME_VALUE" ||
    extremeValueClassification === "SUSPICIOUS_VALUE"
  ) {
    negatives.push(
      extremeValueClassification === "SUSPICIOUS_VALUE"
        ? "EV suspeito — possível erro de input/modelo, não vantagem real"
        : "EV extremo — exige mais evidência antes de confiar"
    );
    decisionWarnings.push(
      extremeValueClassification === "SUSPICIOUS_VALUE"
        ? "SUSPICIOUS_VALUE_FLAG"
        : "EXTREME_VALUE_FLAG"
    );
  }

  /*
   * §9: consenso de família é só narrativo — nunca soma EV.
   */
  if (
    familyConsensus &&
    familyConsensus.confirmingMarkets.length > 0
  ) {
    positives.push(
      `consenso com ${familyConsensus.confirmingMarkets.join(", ")} (mesma direção de gols)`
    );
    decisionDrivers.push("MARKET_FAMILY_CONSENSUS");
  }

  /*
   * Evidências negativas: reaproveita exatamente os motivos
   * já calculados por guards.ts e operationalPolicy.ts — não
   * duplica regra nenhuma, só torna legível o que já bloqueou
   * ou limitou a entrada.
   */
  negatives.push(
    ...guardBlockers,
    ...guardWarnings,
    ...operationalBlockers,
    ...operationalWarnings
  );

  decisionWarnings.push(
    ...guardBlockers,
    ...guardWarnings,
    ...operationalBlockers,
    ...operationalWarnings
  );

  const downgraded =
    baseClassification !== classification;

  if (downgraded) {
    negatives.push(
      `classificação base era ${baseClassification}, reduzida para ${classification}`
    );
    decisionWarnings.push("CLASSIFICATION_DOWNGRADED");
  }

  const scoreSuffix =
    decisionScore !== null
      ? ` (Score ${decisionScore}/100)`
      : "";

  const baseSummary =
    decisionState === "REJECT"
      ? "REJECT — risco ou qualidade de dado inviável"
      : decisionState === "INVESTIGATE"
        ? `INVESTIGATE — ${isActionable ? `${classification} aprovada, mas` : "NO BET,"} com discrepância que merece revisão humana`
        : isActionable
          ? `${classification} APROVADA`
          : classification === "WATCHLIST"
            ? "WATCHLIST — evidência insuficiente para aposta"
            : "NO BET";

  const summary = baseSummary + scoreSuffix;

  return {
    market: marketName,

    decision: classification,
    baseDecision: baseClassification,
    downgraded,

    decisionScore,

    decisionState,

    extremeValueClassification:
      extremeValueClassification ??
      null,

    familyConsensus:
      familyConsensus ??
      null,

    positives: dedupe(positives),
    negatives: dedupe(negatives),

    decisionDrivers: dedupe(decisionDrivers),
    decisionWarnings: dedupe(decisionWarnings),

    summary
  };
}

function formatPercent(value: number): string {
  return `${roundNumber(value * 100, 1)}%`;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
