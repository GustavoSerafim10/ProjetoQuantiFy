import {
  runMonteCarlo,
  type MonteCarloAdapterOutput
} from "../engines/monteCarloAdapter";

/* ==========================================
   SIMULATION PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber o resultado oficial do modelPipeline;
 * - executar o Monte Carlo por meio do adapter;
 * - comparar Monte Carlo e modelo analítico;
 * - medir divergência entre os modelos;
 * - disponibilizar diagnóstico para os próximos
 *   pipelines.
 *
 * Este arquivo não:
 *
 * - reconstrói lambdas;
 * - executa Poisson diretamente;
 * - calibra probabilidades;
 * - faz média entre modelos;
 * - escolhe mercado;
 * - calcula EV;
 * - toma decisão de aposta.
 */

/* ==========================================
   CONTRATOS
========================================== */

export type SimulationMarket =
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "HOME_WIN"
  | "DRAW"
  | "AWAY_WIN"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2";

export interface ProbabilityComparison {
  model: number | null;
  monteCarlo: number;
  diff: number | null;
  samplingError: number | null;
  adjustedDiff: number | null;
}

export type SimulationModelComparison = Record<
  SimulationMarket,
  ProbabilityComparison
>;

export interface SimulationDivergence {
  average: number | null;
  maximum: number | null;
  minimum: number | null;

  /*
   * Divergência descontando o erro natural
   * de amostragem do Monte Carlo.
   */
  averageAdjusted: number | null;
  maximumAdjusted: number | null;

  comparedMarkets: number;

  highestDivergenceMarket:
    | SimulationMarket
    | null;
}

export interface SimulationPipelineResult {
  monteCarlo: {
    valid: boolean;

    iterations: number;

    lambdaHome: number;
    lambdaAway: number;
    totalLambda: number;

    probabilities: {
      homeWin: number;
      draw: number;
      awayWin: number;

      over15: number;
      over25: number;

      bttsYes: number;
      bttsNo: number;

      doubleChance1X: number;
      doubleChanceX2: number;
    };

    /*
     * Campos mantidos para compatibilidade
     * com os consumidores atuais.
     */
    homeWinProb: number;
    drawProb: number;
    awayWinProb: number;

    over15Prob: number;
    over25Prob: number;

    bttsProb: number;
    bttsNoProb: number;

    doubleChance1X: number;
    doubleChanceX2: number;

    samplingError:
      MonteCarloAdapterOutput["samplingError"];

    maxSamplingError: number;

    modelComparison:
      SimulationModelComparison;

    divergence:
      SimulationDivergence;

    error?: string;

    debug: {
      source: "simulationPipeline";
      simulationSource: "pipeline_lambdas";
      model: "INDEPENDENT_POISSON";
      usesDixonColes: false;

      lambdaHome: number;
      lambdaAway: number;
      totalLambda: number;

      iterations: number;

      modelComparison:
        SimulationModelComparison;

      divergence:
        SimulationDivergence;

      invalidReason?: string;
    };
  };
}

/* ==========================================
   CONFIGURAÇÃO
========================================== */

const DEFAULT_SIMULATIONS = 50_000;

/* ==========================================
   PIPELINE
========================================== */

export function simulationPipeline(
  model: any,
  simulations: number = DEFAULT_SIMULATIONS
): any & SimulationPipelineResult {
  const simulation = runMonteCarlo({
    lambdaHome: model?.lambdaHome,
    lambdaAway: model?.lambdaAway,
    simulations
  });

  /*
   * Caso os lambdas oficiais não sejam válidos,
   * o pipeline não inventa valores alternativos.
   */
  if (!simulation.valid) {
    const invalidComparison =
      createEmptyModelComparison();

    const invalidDivergence =
      createEmptyDivergence();

    const invalidReason =
      simulation.debug.invalidReason ??
      "MONTE_CARLO_SIMULATION_INVALID";

    return {
      ...model,

      monteCarlo: {
        valid: false,

        iterations: 0,

        lambdaHome:
          simulation.debug.lambdaHome,

        lambdaAway:
          simulation.debug.lambdaAway,

        totalLambda:
          simulation.debug.totalLambda,

        probabilities: {
          ...simulation.probabilities
        },

        homeWinProb: 0,
        drawProb: 0,
        awayWinProb: 0,

        over15Prob: 0,
        over25Prob: 0,

        bttsProb: 0,
        bttsNoProb: 0,

        doubleChance1X: 0,
        doubleChanceX2: 0,

        samplingError:
          simulation.samplingError,

        maxSamplingError:
          simulation.maxSamplingError,

        modelComparison:
          invalidComparison,

        divergence:
          invalidDivergence,

        error:
          invalidReason,

        debug: {
          source:
            "simulationPipeline",

          simulationSource:
            "pipeline_lambdas",

          model:
            "INDEPENDENT_POISSON",

          usesDixonColes:
            false,

          lambdaHome:
            simulation.debug.lambdaHome,

          lambdaAway:
            simulation.debug.lambdaAway,

          totalLambda:
            simulation.debug.totalLambda,

          iterations: 0,

          modelComparison:
            invalidComparison,

          divergence:
            invalidDivergence,

          invalidReason
        }
      },

      debug: {
        ...(model?.debug ?? {}),

        simulationPipeline: {
          valid: false,

          source:
            "simulationPipeline",

          simulationSource:
            "pipeline_lambdas",

          lambdaHome:
            simulation.debug.lambdaHome,

          lambdaAway:
            simulation.debug.lambdaAway,

          totalLambda:
            simulation.debug.totalLambda,

          iterations: 0,

          invalidReason
        }
      }
    };
  }

  const probabilities =
    simulation.probabilities;

  const analyticalProbabilities =
    extractAnalyticalProbabilities(model);

  const modelComparison:
    SimulationModelComparison = {
      OVER_1_5: compareProbability(
        analyticalProbabilities.over15,
        probabilities.over15,
        simulation.samplingError.over15
      ),

      OVER_2_5: compareProbability(
        analyticalProbabilities.over25,
        probabilities.over25,
        simulation.samplingError.over25
      ),

      BTTS_YES: compareProbability(
        analyticalProbabilities.bttsYes,
        probabilities.bttsYes,
        simulation.samplingError.bttsYes
      ),

      /*
       * BTTS_NO é complementar ao BTTS_YES.
       *
       * O erro-padrão é numericamente igual,
       * pois p(1-p) é o mesmo para p e 1-p.
       */
      BTTS_NO: compareProbability(
        analyticalProbabilities.bttsNo,
        probabilities.bttsNo,
        simulation.samplingError.bttsYes
      ),

      HOME_WIN: compareProbability(
        analyticalProbabilities.homeWin,
        probabilities.homeWin,
        simulation.samplingError.homeWin
      ),

      DRAW: compareProbability(
        analyticalProbabilities.draw,
        probabilities.draw,
        simulation.samplingError.draw
      ),

      AWAY_WIN: compareProbability(
        analyticalProbabilities.awayWin,
        probabilities.awayWin,
        simulation.samplingError.awayWin
      ),

      DOUBLE_CHANCE_1X: compareProbability(
        analyticalProbabilities.doubleChance1X,
        probabilities.doubleChance1X,
        calculateCombinedSamplingError(
          simulation.samplingError.homeWin,
          simulation.samplingError.draw
        )
      ),

      DOUBLE_CHANCE_X2: compareProbability(
        analyticalProbabilities.doubleChanceX2,
        probabilities.doubleChanceX2,
        calculateCombinedSamplingError(
          simulation.samplingError.draw,
          simulation.samplingError.awayWin
        )
      )
    };

  const divergence =
    calculateDivergence(modelComparison);

  return {
    ...model,

    monteCarlo: {
      valid: true,

      iterations:
        simulation.iterations,

      lambdaHome:
        simulation.debug.lambdaHome,

      lambdaAway:
        simulation.debug.lambdaAway,

      totalLambda:
        simulation.debug.totalLambda,

      probabilities: {
        ...probabilities
      },

      /*
       * Compatibilidade com os consumidores
       * que utilizam os nomes antigos.
       */
      homeWinProb:
        simulation.homeWinProb,

      drawProb:
        simulation.drawProb,

      awayWinProb:
        simulation.awayWinProb,

      over15Prob:
        simulation.over15Prob,

      over25Prob:
        simulation.over25Prob,

      bttsProb:
        simulation.bttsProb,

      bttsNoProb:
        simulation.bttsNoProb,

      doubleChance1X:
        simulation.doubleChance1XProb,

      doubleChanceX2:
        simulation.doubleChanceX2Prob,

      samplingError:
        simulation.samplingError,

      maxSamplingError:
        simulation.maxSamplingError,

      modelComparison,
      divergence,

      debug: {
        source:
          "simulationPipeline",

        simulationSource:
          simulation.debug.source,

        model:
          simulation.debug.model,

        usesDixonColes:
          simulation.debug.usesDixonColes,

        lambdaHome:
          simulation.debug.lambdaHome,

        lambdaAway:
          simulation.debug.lambdaAway,

        totalLambda:
          simulation.debug.totalLambda,

        iterations:
          simulation.iterations,

        modelComparison,
        divergence
      }
    },

    debug: {
      ...(model?.debug ?? {}),

      simulationPipeline: {
        valid: true,

        source:
          "simulationPipeline",

        simulationSource:
          simulation.debug.source,

        model:
          simulation.debug.model,

        usesDixonColes:
          simulation.debug.usesDixonColes,

        iterations:
          simulation.iterations,

        lambdaHome:
          simulation.debug.lambdaHome,

        lambdaAway:
          simulation.debug.lambdaAway,

        totalLambda:
          simulation.debug.totalLambda,

        maxSamplingError:
          roundNumber(
            simulation.maxSamplingError
          ),

        divergence,

        modelComparison
      }
    }
  };
}

/* ==========================================
   EXTRAÇÃO DO MODELO ANALÍTICO
========================================== */

function extractAnalyticalProbabilities(
  model: any
) {
  const homeWin =
    parseProbability(
      model?.result?.homeWin
    );

  const draw =
    parseProbability(
      model?.result?.draw
    );

  const awayWin =
    parseProbability(
      model?.result?.awayWin
    );

  const over15 =
    parseProbability(
      model?.goals?.over15
    );

  const over25 =
    parseProbability(
      model?.goals?.over25
    );

  const bttsYes =
    parseProbability(
      model?.btts?.yes
    );

  const explicitBttsNo =
    parseProbability(
      model?.btts?.no
    );

  const doubleChance1X =
    firstValidProbability([
      model?.doubleChance?.homeOrDraw,
      model?.doubleChance?.oneX,
      model?.result?.doubleChance1X,
      model?.result?.homeOrDraw
    ]);

  const doubleChanceX2 =
    firstValidProbability([
      model?.doubleChance?.awayOrDraw,
      model?.doubleChance?.xTwo,
      model?.result?.doubleChanceX2,
      model?.result?.awayOrDraw
    ]);

  return {
    homeWin,
    draw,
    awayWin,

    over15,
    over25,

    bttsYes,

    bttsNo:
      explicitBttsNo ??
      complementProbability(bttsYes),

    doubleChance1X:
      doubleChance1X ??
      sumProbabilities(
        homeWin,
        draw
      ),

    doubleChanceX2:
      doubleChanceX2 ??
      sumProbabilities(
        draw,
        awayWin
      )
  };
}

/* ==========================================
   COMPARAÇÃO
========================================== */

function compareProbability(
  modelProbability: number | null,
  monteCarloProbability: number,
  samplingError: number | null
): ProbabilityComparison {
  const safeMonteCarlo =
    parseProbability(
      monteCarloProbability
    ) ?? 0;

  const safeSamplingError =
    parseNonNegativeNumber(
      samplingError
    );

  if (modelProbability === null) {
    return {
      model: null,

      monteCarlo:
        safeMonteCarlo,

      diff: null,

      samplingError:
        safeSamplingError,

      adjustedDiff: null
    };
  }

  const rawDifference =
    Math.abs(
      modelProbability -
      safeMonteCarlo
    );

  /*
   * O adjustedDiff desconta uma margem equivalente
   * a 1,96 erros-padrão do Monte Carlo.
   *
   * Isso evita tratar ruído normal da simulação
   * como divergência estrutural.
   *
   * Não altera nenhuma probabilidade.
   */
  const samplingMargin =
    safeSamplingError === null
      ? 0
      : 1.96 * safeSamplingError;

  const adjustedDifference =
    Math.max(
      0,
      rawDifference -
      samplingMargin
    );

  return {
    model:
      modelProbability,

    monteCarlo:
      safeMonteCarlo,

    diff:
      roundNumber(
        rawDifference
      ),

    samplingError:
      safeSamplingError === null
        ? null
        : roundNumber(
            safeSamplingError
          ),

    adjustedDiff:
      roundNumber(
        adjustedDifference
      )
  };
}

/* ==========================================
   DIVERGÊNCIA
========================================== */

function calculateDivergence(
  comparison: SimulationModelComparison
): SimulationDivergence {
  const entries =
    Object.entries(comparison) as Array<
      [
        SimulationMarket,
        ProbabilityComparison
      ]
    >;

  const validEntries =
    entries.filter(
      ([, value]) =>
        value.diff !== null
    );

  if (validEntries.length === 0) {
    return createEmptyDivergence();
  }

  const rawDifferences =
    validEntries.map(
      ([, value]) =>
        value.diff as number
    );

  const adjustedDifferences =
    validEntries
      .map(
        ([, value]) =>
          value.adjustedDiff
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  let highestDivergenceMarket:
    | SimulationMarket
    | null = null;

  let highestDifference =
    Number.NEGATIVE_INFINITY;

  for (
    const [market, comparisonValue]
    of validEntries
  ) {
    const currentDifference =
      comparisonValue.diff ?? 0;

    if (
      currentDifference >
      highestDifference
    ) {
      highestDifference =
        currentDifference;

      highestDivergenceMarket =
        market;
    }
  }

  return {
    average:
      roundNumber(
        average(rawDifferences)
      ),

    maximum:
      roundNumber(
        Math.max(
          ...rawDifferences
        )
      ),

    minimum:
      roundNumber(
        Math.min(
          ...rawDifferences
        )
      ),

    averageAdjusted:
      adjustedDifferences.length > 0
        ? roundNumber(
            average(
              adjustedDifferences
            )
          )
        : null,

    maximumAdjusted:
      adjustedDifferences.length > 0
        ? roundNumber(
            Math.max(
              ...adjustedDifferences
            )
          )
        : null,

    comparedMarkets:
      validEntries.length,

    highestDivergenceMarket
  };
}

/* ==========================================
   ERRO DAS DUPLAS CHANCES
========================================== */

/*
 * Aproximação conservadora para diagnóstico.
 *
 * Como 1X e X2 são construídos pela soma de
 * categorias do mesmo experimento multinomial,
 * existe covariância entre os componentes.
 *
 * Este helper utiliza soma quadrática apenas
 * como aproximação operacional. Ele não altera
 * as probabilidades e não participa da decisão.
 */
function calculateCombinedSamplingError(
  firstError: number,
  secondError: number
): number {
  const safeFirst =
    parseNonNegativeNumber(
      firstError
    ) ?? 0;

  const safeSecond =
    parseNonNegativeNumber(
      secondError
    ) ?? 0;

  return Math.sqrt(
    safeFirst ** 2 +
    safeSecond ** 2
  );
}

/* ==========================================
   FALLBACKS E HELPERS
========================================== */

function createEmptyModelComparison():
  SimulationModelComparison {
  const empty = (
    monteCarlo = 0
  ): ProbabilityComparison => ({
    model: null,
    monteCarlo,
    diff: null,
    samplingError: null,
    adjustedDiff: null
  });

  return {
    OVER_1_5: empty(),
    OVER_2_5: empty(),

    BTTS_YES: empty(),
    BTTS_NO: empty(),

    HOME_WIN: empty(),
    DRAW: empty(),
    AWAY_WIN: empty(),

    DOUBLE_CHANCE_1X: empty(),
    DOUBLE_CHANCE_X2: empty()
  };
}

function createEmptyDivergence():
  SimulationDivergence {
  return {
    average: null,
    maximum: null,
    minimum: null,

    averageAdjusted: null,
    maximumAdjusted: null,

    comparedMarkets: 0,

    highestDivergenceMarket:
      null
  };
}

function parseProbability(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

function parseNonNegativeNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function firstValidProbability(
  values: unknown[]
): number | null {
  for (const value of values) {
    const parsed =
      parseProbability(value);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function complementProbability(
  probability: number | null
): number | null {
  if (probability === null) {
    return null;
  }

  return 1 - probability;
}

function sumProbabilities(
  first: number | null,
  second: number | null
): number | null {
  if (
    first === null ||
    second === null
  ) {
    return null;
  }

  const total =
    first + second;

  return total >= 0 && total <= 1
    ? total
    : null;
}

function average(
  values: number[]
): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length
  );
}

function roundNumber(
  value: number,
  decimals = 4
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) / factor
  );
}