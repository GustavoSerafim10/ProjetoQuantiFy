/* ==========================================
   ROBUSTNESS SCORE — DECISION INTELLIGENCE FASE 5
========================================== */

/*
 * Responsabilidade:
 *
 * - perturbar lambdaHome/lambdaAway em pequenas variações
 *   plausíveis (±5%, ±10%), uma de cada vez;
 * - recalcular a probabilidade do mercado escolhido via
 *   goalsModel (o mesmo motor Poisson + Dixon-Coles já usado
 *   ao vivo — nenhuma fórmula nova);
 * - recalcular EV com a MESMA odd;
 * - medir a fração de cenários em que o EV continua positivo.
 *
 * Este arquivo não:
 *
 * - reconstrói lambdas a partir de estatísticas de time;
 * - decide classificação;
 * - é consumido pelo decisionPipeline ainda — assim como
 *   uncertaintyAdjustment.ts na fase 3, isto é telemetria
 *   primeiro. Usar robustnessScore para restringir
 *   classificação exige a mesma validação empírica via
 *   runBacktest que já reprovou a fase 4 (ver
 *   operationalPolicy.ts) antes de entrar em produção.
 *
 * Por que perturbar um lambda de cada vez, e não os dois juntos:
 * isola de qual dos dois lados vem a fragilidade (útil para
 * decisionDrivers/explain futuramente), e evita explosão
 * combinatória (2 lambdas × 4 variações = 8 cenários, em vez de
 * uma grade 4×4 = 16 cuja metade mistura os dois efeitos).
 */

import { goalsModel } from "../marketModels/goalsModel";

export interface RobustnessScenario {
  perturbedLambda: "HOME" | "AWAY";
  deltaPercent: number;

  lambdaHome: number;
  lambdaAway: number;

  probability: number;
  ev: number;

  positive: boolean;
}

export interface RobustnessResult {
  valid: boolean;

  robustnessScore: number | null;

  baselineProbability: number | null;
  baselineEv: number | null;

  scenarios: RobustnessScenario[];

  weakestScenario: RobustnessScenario | null;

  warnings: string[];
}

export type RobustnessMarket =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "UNDER_1_5"
  | "UNDER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2"
  | "DNB_HOME"
  | "DNB_AWAY";

const PERTURBATION_PERCENTAGES = [-0.10, -0.05, 0.05, 0.10] as const;

export function calculateRobustness({
  market,
  lambdaHome,
  lambdaAway,
  odd
}: {
  market: string;
  lambdaHome: number;
  lambdaAway: number;
  odd: number;
}): RobustnessResult {
  const warnings: string[] = [];

  const canonicalMarket = normalizeMarket(market);

  if (!canonicalMarket) {
    return createInvalidResult(["UNSUPPORTED_ROBUSTNESS_MARKET"]);
  }

  if (
    !Number.isFinite(lambdaHome) ||
    !Number.isFinite(lambdaAway) ||
    lambdaHome <= 0 ||
    lambdaAway <= 0
  ) {
    return createInvalidResult(["INVALID_ROBUSTNESS_LAMBDAS"]);
  }

  if (!Number.isFinite(odd) || odd <= 1) {
    return createInvalidResult(["INVALID_ROBUSTNESS_ODD"]);
  }

  const baseline = goalsModel(lambdaHome, lambdaAway);

  if (!baseline.valid) {
    warnings.push("ROBUSTNESS_BASELINE_MODEL_INVALID");
  }

  const baselineProbability = extractProbability(
    baseline,
    canonicalMarket
  );

  if (baselineProbability === null) {
    return createInvalidResult([
      ...warnings,
      "ROBUSTNESS_BASELINE_PROBABILITY_UNAVAILABLE"
    ]);
  }

  const baselineEv = computeEv(baselineProbability, odd);

  const scenarios: RobustnessScenario[] = [];

  for (const side of ["HOME", "AWAY"] as const) {
    for (const deltaPercent of PERTURBATION_PERCENTAGES) {
      const perturbedLambdaHome =
        side === "HOME"
          ? lambdaHome * (1 + deltaPercent)
          : lambdaHome;

      const perturbedLambdaAway =
        side === "AWAY"
          ? lambdaAway * (1 + deltaPercent)
          : lambdaAway;

      const scenarioModel = goalsModel(
        perturbedLambdaHome,
        perturbedLambdaAway
      );

      const probability = extractProbability(
        scenarioModel,
        canonicalMarket
      );

      if (probability === null) {
        continue;
      }

      const ev = computeEv(probability, odd);

      scenarios.push({
        perturbedLambda: side,
        deltaPercent,

        lambdaHome: roundNumber(perturbedLambdaHome),
        lambdaAway: roundNumber(perturbedLambdaAway),

        probability: roundNumber(probability),
        ev: roundNumber(ev),

        positive: ev > 0
      });
    }
  }

  if (scenarios.length === 0) {
    return createInvalidResult([
      ...warnings,
      "ROBUSTNESS_NO_VALID_SCENARIOS"
    ]);
  }

  const positiveCount = scenarios.filter(
    scenario => scenario.positive
  ).length;

  const robustnessScore = roundNumber(
    positiveCount / scenarios.length
  );

  const weakestScenario = scenarios.reduce(
    (weakest, scenario) =>
      scenario.ev < weakest.ev ? scenario : weakest,
    scenarios[0]
  );

  if (scenarios.length < PERTURBATION_PERCENTAGES.length * 2) {
    warnings.push("ROBUSTNESS_PARTIAL_SCENARIOS");
  }

  return {
    valid: true,

    robustnessScore,

    baselineProbability: roundNumber(baselineProbability),
    baselineEv: roundNumber(baselineEv),

    scenarios,

    weakestScenario,

    warnings: [...new Set(warnings)]
  };
}

function extractProbability(
  model: ReturnType<typeof goalsModel>,
  market: RobustnessMarket
): number | null {
  switch (market) {
    case "HOME":
      return model.homeWin;

    case "DRAW":
      return model.draw;

    case "AWAY":
      return model.awayWin;

    case "OVER_1_5":
      return model.over15;

    case "OVER_2_5":
      return model.over25;

    case "UNDER_1_5":
      return model.under15;

    case "UNDER_2_5":
      return model.under25;

    case "BTTS_YES":
      return model.bttsYes;

    case "BTTS_NO":
      return model.bttsNo;

    case "DOUBLE_CHANCE_1X":
      return model.doubleChance1X;

    case "DOUBLE_CHANCE_X2":
      return model.doubleChanceX2;

    /*
     * DNB (Empate Anula): probabilidade do lado escolhido vencer
     * dado que a partida não termina empatada — mesma fórmula
     * condicional já usada em simulationPipeline.ts (deriveRatio).
     */
    case "DNB_HOME": {
      const denominator = model.homeWin + model.awayWin;
      return denominator > 0 ? model.homeWin / denominator : null;
    }

    case "DNB_AWAY": {
      const denominator = model.homeWin + model.awayWin;
      return denominator > 0 ? model.awayWin / denominator : null;
    }

    default:
      return null;
  }
}

function computeEv(probability: number, odd: number): number {
  return probability * odd - 1;
}

function normalizeMarket(value: unknown): RobustnessMarket | null {
  const market = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "_")
    .replace(/\s+/g, "_");

  switch (market) {
    case "HOME":
    case "HOME_WIN":
      return "HOME";

    case "DRAW":
      return "DRAW";

    case "AWAY":
    case "AWAY_WIN":
      return "AWAY";

    case "OVER_1_5":
    case "OVER15":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
      return "OVER_2_5";

    case "UNDER_1_5":
    case "UNDER15":
      return "UNDER_1_5";

    case "UNDER_2_5":
    case "UNDER25":
      return "UNDER_2_5";

    case "BTTS_YES":
      return "BTTS_YES";

    case "BTTS_NO":
      return "BTTS_NO";

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return "DOUBLE_CHANCE_1X";

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return "DOUBLE_CHANCE_X2";

    case "DNB_HOME":
    case "DNB1":
      return "DNB_HOME";

    case "DNB_AWAY":
    case "DNB2":
      return "DNB_AWAY";

    default:
      return null;
  }
}

function createInvalidResult(warnings: string[]): RobustnessResult {
  return {
    valid: false,

    robustnessScore: null,

    baselineProbability: null,
    baselineEv: null,

    scenarios: [],

    weakestScenario: null,

    warnings: [...new Set(warnings.filter(Boolean))]
  };
}

function roundNumber(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
