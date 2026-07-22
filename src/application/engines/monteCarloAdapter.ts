import {
  monteCarloPoisson,
  type MonteCarloMatchResult,
  type MonteCarloOptions
} from "../../domain/simulation/monteCarloPoisson";

/* ==========================================
   MONTE CARLO ADAPTER — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber os lambdas oficiais do pipeline;
 * - validar a entrada;
 * - executar o Monte Carlo;
 * - adaptar o resultado para a aplicação;
 * - preservar compatibilidade com consumidores antigos.
 *
 * Este arquivo não:
 *
 * - reconstrói lambdas;
 * - recalcula forma ou pressão;
 * - normaliza expectativa de gols;
 * - calibra probabilidades;
 * - escolhe mercado;
 * - calcula EV;
 * - toma decisão.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface RunMonteCarloInput {
  lambdaHome: number;
  lambdaAway: number;

  simulations?: number;

  /*
   * Gerador opcional para testes reproduzíveis.
   */
  random?: () => number;
}

export interface MonteCarloAdapterProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;

  over15: number;
  over25: number;

  bttsYes: number;
  bttsNo: number;

  doubleChance1X: number;
  doubleChanceX2: number;
}

export interface MonteCarloAdapterOutput {
  valid: boolean;

  probabilities: MonteCarloAdapterProbabilities;

  /*
   * Campos legados temporários.
   *
   * Mantidos para não quebrar consumidores
   * que ainda usam os nomes anteriores.
   */
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;

  over15Prob: number;
  over25Prob: number;

  bttsProb: number;
  bttsNoProb: number;

  doubleChance1XProb: number;
  doubleChanceX2Prob: number;

  iterations: number;

  samplingError:
    MonteCarloMatchResult["samplingError"];

  maxSamplingError: number;

  debug: {
    source: "pipeline_lambdas";

    model:
      "INDEPENDENT_POISSON";

    usesDixonColes:
      false;

    lambdaHome: number;
    lambdaAway: number;
    totalLambda: number;

    simulations: number;

    invalidReason?: string;
  };
}

/* ==========================================
   CONSTANTES
========================================== */

const DEFAULT_SIMULATIONS = 50_000;

const INVALID_PROBABILITIES:
  MonteCarloAdapterProbabilities = {
    homeWin: 0,
    draw: 0,
    awayWin: 0,

    over15: 0,
    over25: 0,

    bttsYes: 0,
    bttsNo: 0,

    doubleChance1X: 0,
    doubleChanceX2: 0
  };

const EMPTY_SAMPLING_ERROR:
  MonteCarloMatchResult["samplingError"] = {
    homeWin: 0,
    draw: 0,
    awayWin: 0,

    over15: 0,
    over25: 0,

    bttsYes: 0
  };

/* ==========================================
   UTILITÁRIOS
========================================== */

function safeNumber(
  value: unknown,
  fallback: number
): number {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function isValidLambda(
  value: unknown
): boolean {
  const parsed =
    Number(value);

  return (
    Number.isFinite(parsed) &&
    parsed > 0
  );
}

function sanitizeSimulations(
  value: unknown
): number {
  const parsed =
    Math.floor(
      safeNumber(
        value,
        DEFAULT_SIMULATIONS
      )
    );

  return parsed > 0
    ? parsed
    : DEFAULT_SIMULATIONS;
}

/* ==========================================
   RESULTADO INVÁLIDO
========================================== */

function createInvalidResult(
  input: Partial<RunMonteCarloInput>,
  reason: string
): MonteCarloAdapterOutput {
  const lambdaHome =
    safeNumber(
      input.lambdaHome,
      0
    );

  const lambdaAway =
    safeNumber(
      input.lambdaAway,
      0
    );

  const simulations =
    sanitizeSimulations(
      input.simulations
    );

  const totalLambda =
    Number.isFinite(
      lambdaHome + lambdaAway
    )
      ? lambdaHome + lambdaAway
      : 0;

  return {
    valid: false,

    probabilities: {
      ...INVALID_PROBABILITIES
    },

    homeWinProb: 0,
    drawProb: 0,
    awayWinProb: 0,

    over15Prob: 0,
    over25Prob: 0,

    bttsProb: 0,
    bttsNoProb: 0,

    doubleChance1XProb: 0,
    doubleChanceX2Prob: 0,

    iterations: 0,

    samplingError: {
      ...EMPTY_SAMPLING_ERROR
    },

    maxSamplingError: 0,

    debug: {
      source:
        "pipeline_lambdas",

      model:
        "INDEPENDENT_POISSON",

      usesDixonColes:
        false,

      lambdaHome,
      lambdaAway,
      totalLambda,

      simulations,

      invalidReason:
        reason
    }
  };
}

/* ==========================================
   ADAPTAÇÃO DO RESULTADO
========================================== */

function adaptResult(
  result: MonteCarloMatchResult
): MonteCarloAdapterOutput {
  const probabilities:
    MonteCarloAdapterProbabilities = {
      homeWin:
        result.homeWin,

      draw:
        result.draw,

      awayWin:
        result.awayWin,

      over15:
        result.over15,

      over25:
        result.over25,

      bttsYes:
        result.bttsYes,

      bttsNo:
        result.bttsNo,

      doubleChance1X:
        result.doubleChance1X,

      doubleChanceX2:
        result.doubleChanceX2
    };

  return {
    valid: true,

    probabilities,

    /*
     * Compatibilidade com o formato anterior.
     */
    homeWinProb:
      probabilities.homeWin,

    drawProb:
      probabilities.draw,

    awayWinProb:
      probabilities.awayWin,

    over15Prob:
      probabilities.over15,

    over25Prob:
      probabilities.over25,

    bttsProb:
      probabilities.bttsYes,

    bttsNoProb:
      probabilities.bttsNo,

    doubleChance1XProb:
      probabilities.doubleChance1X,

    doubleChanceX2Prob:
      probabilities.doubleChanceX2,

    iterations:
      result.iterations,

    samplingError:
      result.samplingError,

    maxSamplingError:
      result.maxSamplingError,

    debug: {
      source:
        "pipeline_lambdas",

      model:
        "INDEPENDENT_POISSON",

      usesDixonColes:
        false,

      lambdaHome:
        result.lambdaHome,

      lambdaAway:
        result.lambdaAway,

      totalLambda:
        result.totalLambda,

      simulations:
        result.iterations
    }
  };
}

/* ==========================================
   EXECUÇÃO
========================================== */

export function runMonteCarlo(
  input: RunMonteCarloInput
): MonteCarloAdapterOutput {
  if (
    !input ||
    typeof input !== "object"
  ) {
    return createInvalidResult(
      {},
      "MONTE_CARLO_INPUT_MISSING"
    );
  }

  if (
    !isValidLambda(
      input.lambdaHome
    )
  ) {
    return createInvalidResult(
      input,
      "INVALID_PIPELINE_HOME_LAMBDA"
    );
  }

  if (
    !isValidLambda(
      input.lambdaAway
    )
  ) {
    return createInvalidResult(
      input,
      "INVALID_PIPELINE_AWAY_LAMBDA"
    );
  }

  const simulations =
    sanitizeSimulations(
      input.simulations
    );

  const options:
    MonteCarloOptions = {};

  if (
    typeof input.random ===
    "function"
  ) {
    options.random =
      input.random;
  }

  const result =
    monteCarloPoisson(
      Number(
        input.lambdaHome
      ),

      Number(
        input.lambdaAway
      ),

      simulations,

      options
    );

  return adaptResult(
    result
  );
}