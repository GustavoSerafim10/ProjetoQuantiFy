import type {
  CanonicalDecisionMarket,
  DecisionContextMetrics,
  OperationalPolicyResult,
  DecisionClassification
} from "./types";

import { normalizeWarnings, clamp, roundNumber } from "./helpers";

import { restrictClassification } from "./classificationLimiter";

/* ==========================================
   POLÍTICA OPERACIONAL DINÂMICA — V2
========================================== */

export function evaluateOperationalPolicy({
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

  evFloorOverride,

  context
}: {
  marketName:
    CanonicalDecisionMarket | null;

  probability:
    number | null;

  odd:
    number | null;

  ev:
    number | null;

  probabilityEdge:
    number | null;

  risk:
    number | null;

  confidence:
    number | null;

  sampleReliability:
    number | null;

  leagueTrust:
    number | null;

  globalConfidence:
    number | null;

  goalExpectationScore:
    number | null;

  contextualGoalExpectationScore:
    number | null;

  evFloorOverride?:
    number;

  context:
    DecisionContextMetrics;
}): OperationalPolicyResult {
  const blockers:
    string[] = [];

  const warnings:
    string[] = [];

  const requiredEv =
    getDynamicMinimumEv(
      marketName,
      odd
    ) +
    (evFloorOverride ?? 0);

  let maximumClassification:
    DecisionClassification | null =
      null;

const isDoubleChance =
  marketName ===
    "DOUBLE_CHANCE_1X" ||
  marketName ===
    "DOUBLE_CHANCE_X2";

const isDnb =
  marketName ===
    "DNB_HOME" ||
  marketName ===
    "DNB_AWAY";

const isGoalMarket =
  marketName === "OVER_1_5" ||
  marketName === "OVER_2_5" ||
  marketName === "BTTS_YES" ||
  marketName === "BTTS_NO";


  const dominanceScore =
    getMarketDominanceScore(
      marketName,
      context
    );

  const drawDependency =
    calculateDrawDependency({
      marketName,
      marketProbability:
        probability,

      drawProbability:
        context.drawProbability
    });

  /*
   * EV dinâmico.
   *
   * Não transforma automaticamente o mercado
   * em inválido; limita no máximo a WATCHLIST.
   */
  if (
    ev !== null &&
    ev < requiredEv
  ) {
    warnings.push(
      "EV_BELOW_DYNAMIC_MINIMUM"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Confrontos extremamente equilibrados são
   * perigosos para mercados de resultado.
   *
   * Mercados de gols e BTTS não recebem este
   * bloqueio automaticamente.
   */
 const isDirectionalResultMarket =
  marketName === "HOME" ||
  marketName === "AWAY";

if (
  isDirectionalResultMarket &&
  context.matchBalanceIndex !== null &&
  context.matchBalanceIndex >= 0.82
) {
  warnings.push(
    "EXTREMELY_BALANCED_DIRECTIONAL_MARKET"
  );

  maximumClassification =
    restrictClassification(
      maximumClassification,
      "WATCHLIST"
    );
}

  /*
   * Vitória seca sem dominância mínima.
   */
  if (
    (
      marketName === "HOME" ||
      marketName === "AWAY"
    ) &&
    dominanceScore !== null &&
    dominanceScore < 0.54
  ) {
    warnings.push(
      "INSUFFICIENT_SIDE_DOMINANCE"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Detecta dupla chance sustentada em excesso
   * pelo empate e sem força clara do lado principal.
   */
if (
  isDoubleChance &&
  probability !== null &&
  dominanceScore !== null &&
  drawDependency !== null &&
  context.matchBalanceIndex !== null &&
  dominanceScore < 0.50 &&
  drawDependency > 0.50 &&
  context.matchBalanceIndex > 0.78
) {
  warnings.push(
    "FRAGILE_DOUBLE_CHANCE"
  );

  maximumClassification =
    restrictClassification(
      maximumClassification,
      "WATCHLIST"
    );
}

  /*
   * Empate Anula: quanto maior drawProbability, maior a
   * fração da aposta que evapora em anulação (não em
   * ganho, ao contrário da Dupla Chance). O EV já é
   * descontado por isso no valuePipeline — aqui limitamos
   * agressividade quando esse desconto é grande demais
   * para confiar na classificação alta.
   */
if (
  isDnb &&
  context.drawProbability !== null &&
  context.drawProbability > 0.32
) {
  warnings.push(
    "HIGH_VOID_RISK_DNB"
  );

  maximumClassification =
    restrictClassification(
      maximumClassification,
      "WATCHLIST"
    );
}

  /*
   * Amostra muito pequena:
   * no máximo WATCHLIST.
   *
   * Não aplicamos penalidade por liga ainda,
   * pois isso exige evidência acumulada.
   */
  if (
    sampleReliability !== null &&
    sampleReliability < 0.50
  ) {
    warnings.push(
      "LOW_SAMPLE_RELIABILITY"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Liga com baixa confiança histórica:
   * limita a entrada a WATCHLIST.
   *
   * Isso não altera probabilidade, EV, risco
   * ou confidence; apenas limita a decisão.
   */
  if (
    leagueTrust !== null &&
    leagueTrust < 0.50
  ) {
    warnings.push(
      "LOW_LEAGUE_TRUST"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Confiança global muito baixa indica que o
   * conjunto do modelo está pouco consistente.
   */
  if (
    globalConfidence !== null &&
    globalConfidence < 0.45
  ) {
    warnings.push(
      "LOW_GLOBAL_MODEL_CONFIDENCE"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * FASE 4 do Decision Intelligence Layer — TENTATIVA REVERTIDA
   * (2026-09-04): a ideia original era substituir estes três
   * gates binários por um desconto contínuo de effectiveProbability
   * (calculateUncertaintyAdjustment em uncertaintyAdjustment.ts),
   * reclassificando o mercado contra os mesmos thresholds de
   * marketPolicies.ts. Implementado e testado via runBacktest
   * (2500 e 5000 partidas, determinístico) comparando contra a
   * política atual (só com estes três gates):
   *
   * ROI agregado piorou nas duas amostras (2500: -0,08% → -2,29%;
   * 5000: -0,97% → -2,10%), com o mercado de maior volume (HOME)
   * caindo de ROI positivo para negativo/nulo nas duas. Alguns
   * mercados pequenos melhoraram (BTTS_YES, DOUBLE_CHANCE_X2), mas
   * não o suficiente para compensar.
   *
   * Não sabemos se a causa é o conceito ser ruim ou se
   * sampleReliability/leagueTrust no gerador sintético não carregam
   * sinal real de qualidade (mesma limitação já documentada para
   * DRAW/OVER_1_5 no viés de bookmaker do matchGenerator.ts) — mas
   * como a regra deste projeto é não manter mudança sem validação
   * positiva, os gates binários originais foram mantidos.
   * effectiveProbability/uncertaintyClassification continuam
   * calculados e visíveis (evaluateMarket.ts, `explain`) como
   * diagnóstico auditável, só não influenciam mais `classification`.
   * Revisitar com dados reais de sample reliability/league trust,
   * não com o gerador sintético.
   */

  /*
   * Divergência relevante entre a expectativa
   * oficial e a contextual limita agressividade.
   */
if (
  isGoalMarket &&
  goalExpectationScore !== null &&
  contextualGoalExpectationScore !== null &&
  Math.abs(
    goalExpectationScore -
    contextualGoalExpectationScore
  ) >= 0.25
) {
  warnings.push(
    "GOAL_EXPECTATION_CONTEXT_DIVERGENCE"
  );

  maximumClassification =
    restrictClassification(
      maximumClassification,
      "WATCHLIST"
    );
}

  /*
   * Ausência de confiança explícita não deve
   * permitir BET/ELITE automaticamente.
   */
  if (confidence === null) {
    warnings.push(
      "OPERATIONAL_CONFIDENCE_UNAVAILABLE"
    );

    maximumClassification =
      restrictClassification(
        maximumClassification,
        "WATCHLIST"
      );
  }

  /*
   * Edge ausente continua sendo warning.
   * Edge não positivo já é tratado pelos guards.
   */
  if (
    probabilityEdge === null
  ) {
    warnings.push(
      "OPERATIONAL_EDGE_UNAVAILABLE"
    );
  }

  /*
   * Proteção adicional. Normalmente o guard
   * já captura esses casos.
   */
  if (
    probability === null ||
    odd === null ||
    ev === null ||
    risk === null ||
    marketName === null
  ) {
    blockers.push(
      "OPERATIONAL_POLICY_MISSING_METRICS"
    );
  }

  return {
    blocked:
      blockers.length > 0,

    maximumClassification,

    blockers:
      normalizeWarnings(
        blockers
      ),

    warnings:
      normalizeWarnings(
        warnings
      ),

    metrics: {
      requiredEv,

      matchBalanceIndex:
        context.matchBalanceIndex,

      dominanceScore,

      drawDependency,

      sampleReliability,

      leagueTrust,

      globalConfidence,

      goalExpectationScore,

      contextualGoalExpectationScore
    }
  };
}

export function getDynamicMinimumEv(
  market:
    CanonicalDecisionMarket | null,

  odd:
    number | null
): number {
  if (
    market === null ||
    odd === null
  ) {
    return 0;
  }

  const isDoubleChance =
    market ===
      "DOUBLE_CHANCE_1X" ||
    market ===
      "DOUBLE_CHANCE_X2";

  const isDnb =
    market ===
      "DNB_HOME" ||
    market ===
      "DNB_AWAY";

  const isResultMarket =
    market === "HOME" ||
    market === "DRAW" ||
    market === "AWAY";

  if (isDoubleChance) {
    if (odd < 1.40) return 0.08;
    if (odd < 1.70) return 0.07;
    if (odd < 2.20) return 0.09;

    return 0.12;
  }

  /*
   * Empate Anula: piso um pouco mais alto que Dupla
   * Chance na mesma faixa de odd, porque o EV já vem
   * descontado pela anulação (valuePipeline) — exigir um
   * pouco mais aqui compensa a incerteza extra de um
   * mercado novo, ainda não calibrado por backtest.
   */
  if (isDnb) {
    if (odd < 1.40) return 0.09;
    if (odd < 1.70) return 0.08;
    if (odd < 2.20) return 0.10;

    return 0.13;
  }

  if (isResultMarket) {
    if (odd < 1.70) return 0.08;
    if (odd < 2.20) return 0.09;
    if (odd < 3.00) return 0.11;

    return 0.14;
  }

  /*
   * Over e BTTS.
   */
  if (odd < 1.60) return 0.07;
  if (odd < 2.20) return 0.08;

  return 0.10;
}

export function getMarketDominanceScore(
  market:
    CanonicalDecisionMarket | null,

  context:
    DecisionContextMetrics
): number | null {
  switch (market) {
    case "HOME":
    case "DOUBLE_CHANCE_1X":
    case "DNB_HOME":
      return context
        .homeDominanceScore;

    case "AWAY":
    case "DOUBLE_CHANCE_X2":
    case "DNB_AWAY":
      return context
        .awayDominanceScore;

    default:
      return null;
  }
}

export function calculateDrawDependency({
  marketName,
  marketProbability,
  drawProbability
}: {
  marketName:
    CanonicalDecisionMarket | null;

  marketProbability:
    number | null;

  drawProbability:
    number | null;
}): number | null {
  const isDoubleChance =
    marketName ===
      "DOUBLE_CHANCE_1X" ||
    marketName ===
      "DOUBLE_CHANCE_X2";

  if (
    !isDoubleChance ||
    marketProbability === null ||
    marketProbability <= 0 ||
    drawProbability === null
  ) {
    return null;
  }

  return roundNumber(
    clamp(
      drawProbability /
      marketProbability,
      0,
      1
    )
  );
}
