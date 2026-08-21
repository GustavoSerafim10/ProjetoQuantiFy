import {
  type RiskScoreResult
} from "../../../domain/risk/riskScore";

/* ==========================================
   CONTRATOS
========================================== */

export type RiskMarketType =
  | "RESULT"
  | "DOUBLE_CHANCE"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "OTHER";

export type RiskComponentCategory =
  | "CONTEXT"
  | "UNCERTAINTY"
  | "SIMULATION_QUALITY"
  | "MARKET_DISAGREEMENT"
  | "CORRELATION";

export interface RiskComponent {
  source: string;

  category:
    RiskComponentCategory;

  adjustment: number;

  warning?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface RiskPipelineMarketDebug {
  valid: boolean;

  marketName: string;

  marketType:
    RiskMarketType;

  probability:
    number | null;

  odd:
    number | null;

  impliedProbability:
    number | null;

  probabilityEdge:
    number | null;

  absoluteMarketDisagreement:
    number | null;

  baseRisk: number;

  contextualAdjustment: number;
  uncertaintyAdjustment: number;
  simulationQualityAdjustment: number;
  marketDisagreementAdjustment: number;
  correlationAdjustment: number;

  totalAdjustment: number;
  unclampedRisk: number;
  finalRisk: number;

  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;
  lambdaDifference: number;
  minimumLambda: number;

  goalExpectationScore:
    number | null;

  samplingError:
    number | null;

  samplingErrorSource:
    string;

  modelSimulationDivergence:
    number | null;

  divergenceSource:
    string;

  dataQualitySource:
    string;

  monteCarloValid:
    boolean | null;

  monteCarloConverged:
    boolean | null;

  simulationQuality:
    string | null;

  baseRiskDetails:
    RiskScoreResult;

  components:
    RiskComponent[];

  warnings:
    string[];

  error?: string;
}

export interface RiskPipelineDebug {
  valid: boolean;

  version: "V7.2_ELITE";

  inputMarkets: number;
  outputMarkets: number;
  validMarkets: number;
  invalidMarkets: number;

  lambdaHome:
    number | null;

  lambdaAway:
    number | null;

  totalLambda:
    number | null;

  lambdaDifference:
    number | null;

  leagueAvgGoals:
    number | null;

  recentGoalStd:
    number | null;

  seasonGoalAvg:
    number | null;

  dataQualityScore:
    number | null;

  dataQualitySource:
    string;

  samplingError:
    number | null;

  samplingErrorSource:
    string;

  modelSimulationDivergence:
    number | null;

  divergenceSource:
    string;

  monteCarloValid:
    boolean | null;

  monteCarloConverged:
    boolean | null;

  simulationQuality:
    string | null;

  error?: string;

  note:
    "Risk is consolidated once from statistical base risk, market fragility, uncertainty, market disagreement and correlation.";
}

export interface ResolvedNumber {
  value: number | null;
  source: string;
}

export interface MonteCarloMetadata {
  valid: boolean | null;
  converged: boolean | null;
  simulationQuality: string | null;
  warnings: string[];
}
