import type { MarketCode } from "../../../shared/types/marketCode";
import type { PipelineRecord } from "../pipelineRecord";

/* ==========================================
   CONTRATOS
========================================== */

export type DecisionClassification =
  | "SCALPER"
  | "ELITE"
  | "BET"
  | "WATCHLIST"
  | "NO BET";

export type CanonicalDecisionMarket = MarketCode;

export interface DecisionMarketPolicy {
  minimumOdd: number;

  watchlist: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };

  bet: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };

  elite: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };

  scalper?: {
    minimumProbability: number;
    minimumEv: number;
    maximumRisk: number;
    minimumConfidence: number;
  };
}

export interface DecisionGuardResult {
  valid: boolean;
  blockers: string[];
  warnings: string[];
}

/* ==========================================
   CONTEXTO OPERACIONAL DA DECISÃO
========================================== */

export interface DecisionContextMetrics {
  homeProbability: number | null;
  drawProbability: number | null;
  awayProbability: number | null;

  lambdaHome: number | null;
  lambdaAway: number | null;
  totalLambda: number | null;

  matchBalanceIndex: number | null;

  homeDominanceScore: number | null;
  awayDominanceScore: number | null;

  minimumSampleSize: number | null;

  sampleReliability: number | null;
  leagueTrust: number | null;

  globalConfidence: number | null;

  goalExpectationScore: number | null;
  contextualGoalExpectationScore: number | null;

  league: string;
}

export interface OperationalPolicyResult {
  blocked: boolean;

  maximumClassification:
    DecisionClassification | null;

  blockers: string[];
  warnings: string[];

  metrics: {
    requiredEv: number;

    matchBalanceIndex:
      number | null;

    dominanceScore:
      number | null;

    drawDependency:
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
  };
}

export interface DecisionMarketDebug {
  valid: boolean;

  market:
    CanonicalDecisionMarket | null;

  policy:
    DecisionMarketPolicy | null;

  guards: {
    blockers: string[];
    warnings: string[];
  };

  metrics: {
    probability: number | null;
    odd: number | null;
    ev: number | null;
    probabilityEdge: number | null;
    risk: number | null;
    confidence: number | null;
    rankingScore: number | null;
    trapScore: number | null;

    sampleReliability: number | null;
    leagueTrust: number | null;

    globalConfidence: number | null;

    goalExpectationScore: number | null;
    contextualGoalExpectationScore: number | null;
  };

  operationalPolicy: {
    blocked: boolean;

    maximumClassification:
      DecisionClassification | null;

    blockers: string[];
    warnings: string[];

    dynamicMinimumEv: number;

    matchBalanceIndex:
      number | null;

    dominanceScore:
      number | null;

    drawDependency:
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
  };

  /*
   * Classificação produzida somente pelos
   * thresholds do mercado, antes das limitações
   * da política operacional.
   */
  baseClassification:
    DecisionClassification;

  thresholdDiagnostics: {
    watchlistProbabilityRequired: number | null;
    watchlistProbabilityActual: number | null;
    watchlistProbabilityShortfall: number | null;
    borderToleranceApplied: boolean;
  };

  /*
   * Classificação final após a aplicação de:
   *
   * - maximumClassification;
   * - blockers operacionais;
   * - limitações contextuais.
   */
  classification:
    DecisionClassification;

  /*
   * Indica de forma direta se a política operacional
   * limitou uma classificação superior.
   *
   * Exemplo:
   *
   * baseClassification = "BET"
   * classification = "WATCHLIST"
   * operationalDowngraded = true
   */
  operationalDowngraded:
    boolean;

  /*
   * Motivos operacionais que efetivamente explicam
   * uma eventual limitação.
   */
  operationalReasons:
    string[];

  stake:
    number;
}

export interface DecisionPipelineDebug {
  valid: boolean;

  version: "V7.2_ELITE";

  inputMarkets: number;
  eligibleMarkets: number;
  actionableMarkets: number;

  eliteMarkets: number;
  scalperMarkets: number;
  betMarkets: number;
  watchlistMarkets: number;
  noBetMarkets: number;

  discardedMarkets: number;

  bestMarket: string | null;

  bestClassification:
    DecisionClassification | null;

  upstream: {
    probabilityValid: boolean;
    valueValid: boolean;
    riskValid: boolean;
    confidenceValid: boolean;
    rankingValid: boolean;
    correlationValid: boolean;
  };

  reason: string;
}


export interface EvaluatedDecisionMarket extends PipelineRecord {
  /*
   * Estende PipelineRecord para manter compatibilidade com os
   * campos produzidos pelos pipelines anteriores, sem deixar os
   * callbacks de map/filter/find com parâmetro implicitamente any.
   */

  market?: string;

  probability?: number;
  odd?: number;
  ev?: number;
  probabilityEdge?: number;

  risk?: number;
  riskScore?: number;

  confidence?: number;

  rankingScore?: number;
  score?: number;
  rank?: number;

   kelly: number;
  stake: number;

  classification:
    DecisionClassification;

  baseClassification:
    DecisionClassification;

  operationalDowngraded:
    boolean;

  operationalLimit:
    DecisionClassification | null;

  operationalReasons:
    string[];

  decisionValid:
    boolean;

  decisionOriginalIndex:
    number;

  decisionBlockers:
    string[];

  decisionWarnings:
    string[];

  warnings:
    string[];

  discardedStage:
    string | null;

  discardedReason:
    string | null;
}
