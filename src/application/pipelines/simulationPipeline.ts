import {
  runMonteCarlo,
  type MonteCarloAdapterOutput
} from "../engines/monteCarloAdapter";

/* ==========================================
   SIMULATION PIPELINE — QUANTIFY V7.1 ELITE
========================================== */

/*
 * Responsabilidade:
 *
 * - receber o resultado oficial do modelPipeline;
 * - executar Monte Carlo independente via adapter;
 * - preservar integralmente a autoridade analítica;
 * - comparar os dois modelos sem calcular média;
 * - medir erro amostral, IC95 e divergência;
 * - transportar convergência, qualidade e diagnósticos;
 * - disponibilizar auditoria aos pipelines posteriores.
 *
 * Este arquivo NÃO:
 *
 * - reconstrói lambdas;
 * - executa Poisson diretamente;
 * - aplica Dixon-Coles;
 * - calibra probabilidades;
 * - substitui probabilidades analíticas;
 * - altera confidence;
 * - calcula EV ou odds justas;
 * - escolhe mercado;
 * - toma decisão de aposta.
 */

/* ==========================================
   CONTRATOS
========================================== */

export type SimulationMarket =
  | "OVER_1_5"
  | "OVER_2_5"
  | "UNDER_1_5"
  | "UNDER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "HOME_WIN"
  | "DRAW"
  | "AWAY_WIN"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2"
  | "DNB_HOME"
  | "DNB_AWAY";

export type AnalyticalProbabilitySource =
  | "markets"
  | "result"
  | "goals"
  | "btts"
  | "doubleChance"
  | "legacy"
  | "complement"
  | "sum"
  | "ratio"
  | "missing";

export interface ProbabilityInterval95 {
  lower: number;
  upper: number;
  margin: number;
}

export interface ResolvedAnalyticalProbability {
  value: number | null;
  source: AnalyticalProbabilitySource;
  path: string | null;
  conflictDetected: boolean;
  alternatives: Array<{
    path: string;
    value: number;
  }>;
}

export interface ProbabilityComparison {
  model: number | null;
  modelSource: AnalyticalProbabilitySource;
  modelPath: string | null;

  monteCarlo: number;

  diff: number | null;
  samplingError: number | null;
  adjustedDiff: number | null;

  confidenceInterval95: ProbabilityInterval95 | null;
  withinMonteCarloCI95: boolean | null;

  conflictDetected: boolean;
}

export type SimulationModelComparison = Record<
  SimulationMarket,
  ProbabilityComparison
>;

export interface SimulationDivergence {
  average: number | null;
  maximum: number | null;
  minimum: number | null;

  averageAdjusted: number | null;
  maximumAdjusted: number | null;
  minimumAdjusted: number | null;

  comparedMarkets: number;

  marketsInsideCI95: number;
  marketsOutsideCI95: number;
  marketsWithoutCI95: number;

  highestDivergenceMarket: SimulationMarket | null;
  highestRawDivergenceMarket: SimulationMarket | null;
  highestAdjustedDivergenceMarket: SimulationMarket | null;
}

export interface SimulationPipelineResult {
  monteCarlo: {
    valid: boolean;
    converged: boolean;

    iterations: number;

    lambdaHome: number;
    lambdaAway: number;
    totalLambda: number;

    probabilities: MonteCarloAdapterOutput["probabilities"];

    /* Compatibilidade com consumidores atuais. */
    homeWinProb: number;
    drawProb: number;
    awayWinProb: number;

    over15Prob: number;
    over25Prob: number;
    under25Prob: number;

    bttsProb: number;
    bttsNoProb: number;

    doubleChance1X: number;
    doubleChanceX2: number;

    samplingError: MonteCarloAdapterOutput["samplingError"];
    maxSamplingError: number;
    maxStandardError: number;

    confidenceInterval95:
      MonteCarloAdapterOutput["confidenceInterval95"];

    convergence:
      MonteCarloAdapterOutput["convergence"];

    simulationQuality:
      MonteCarloAdapterOutput["simulationQuality"];

    warnings: string[];

    diagnostics:
      MonteCarloAdapterOutput["diagnostics"];

    modelComparison: SimulationModelComparison;
    divergence: SimulationDivergence;

    error?: string;

    debug: {
      version: "V7.1_ELITE";
      source: "simulationPipeline";
      simulationSource: "pipeline_lambdas";
      model: "INDEPENDENT_POISSON";
      usesDixonColes: false;

      analyticalModelAuthority: true;
      probabilitiesOverwritten: false;
      probabilitiesAveraged: false;
      confidenceAltered: false;

      lambdaHome: number;
      lambdaAway: number;
      totalLambda: number;

      iterations: number;
      converged: boolean;

      simulationQuality:
        MonteCarloAdapterOutput["simulationQuality"];

      analyticalSources: Record<
        SimulationMarket,
        {
          source: AnalyticalProbabilitySource;
          path: string | null;
          conflictDetected: boolean;
        }
      >;

      modelComparison: SimulationModelComparison;
      divergence: SimulationDivergence;

      warnings: string[];
      invalidReason?: string;
    };
  };
}

interface AnalyticalProbabilityMap {
  homeWin: ResolvedAnalyticalProbability;
  draw: ResolvedAnalyticalProbability;
  awayWin: ResolvedAnalyticalProbability;

  over15: ResolvedAnalyticalProbability;
  over25: ResolvedAnalyticalProbability;
  under15: ResolvedAnalyticalProbability;
  under25: ResolvedAnalyticalProbability;

  bttsYes: ResolvedAnalyticalProbability;
  bttsNo: ResolvedAnalyticalProbability;

  doubleChance1X: ResolvedAnalyticalProbability;
  doubleChanceX2: ResolvedAnalyticalProbability;

  dnbHome: ResolvedAnalyticalProbability;
  dnbAway: ResolvedAnalyticalProbability;
}

interface ProbabilityCandidate {
  value: unknown;
  source: AnalyticalProbabilitySource;
  path: string;
}

/* ==========================================
   CONFIGURAÇÃO
========================================== */

const VERSION = "V7.1_ELITE" as const;
const DEFAULT_SIMULATIONS = 50_000;
const COMPARISON_CONFLICT_TOLERANCE = 0.005;

/* ==========================================
   PIPELINE
========================================== */

export function simulationPipeline<TModel>(
  model: TModel,
  simulations: number = DEFAULT_SIMULATIONS,
  random?: () => number
): TModel & SimulationPipelineResult {
  const modelRecord = asRecord(model);

  const simulation = runMonteCarlo({
    lambdaHome: getNestedValue(
      modelRecord,
      ["lambdaHome"]
    ) as number,

    lambdaAway: getNestedValue(
      modelRecord,
      ["lambdaAway"]
    ) as number,

    simulations,

    ...(random ? { random } : {})
  });

  const analyticalProbabilities =
    extractAnalyticalProbabilities(modelRecord);

  if (!simulation.valid) {
    return buildInvalidResult(
      model,
      modelRecord,
      simulation,
      analyticalProbabilities
    );
  }

  const modelComparison =
    buildModelComparison(
      analyticalProbabilities,
      simulation
    );

  const divergence =
    calculateDivergence(modelComparison);

  const analyticalSources =
    buildAnalyticalSources(modelComparison);

  const warnings = normalizeStrings([
    ...simulation.warnings,
    ...collectAnalyticalWarnings(
      analyticalProbabilities
    )
  ]);

  /*
   * O spread mantém todos os campos oficiais do modelo.
   * Nenhuma probabilidade nem a confidence são alteradas.
   */
  return {
    ...model,

    monteCarlo: {
      valid: true,
      converged:
        simulation.convergence.converged,

      iterations:
        simulation.iterations,

      lambdaHome:
        simulation.debug.lambdaHome,

      lambdaAway:
        simulation.debug.lambdaAway,

      totalLambda:
        simulation.debug.totalLambda,

      probabilities: {
        ...simulation.probabilities
      },

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

      under25Prob:
        simulation.under25Prob,

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

      maxStandardError:
        simulation.maxStandardError,

      confidenceInterval95:
        simulation.confidenceInterval95,

      convergence:
        simulation.convergence,

      simulationQuality:
        simulation.simulationQuality,

      warnings,

      diagnostics:
        simulation.diagnostics,

      modelComparison,
      divergence,

      debug: {
        version: VERSION,

        source:
          "simulationPipeline",

        simulationSource:
          "pipeline_lambdas",

        model:
          "INDEPENDENT_POISSON",

        usesDixonColes:
          false,

        analyticalModelAuthority:
          true,

        probabilitiesOverwritten:
          false,

        probabilitiesAveraged:
          false,

        confidenceAltered:
          false,

        lambdaHome:
          simulation.debug.lambdaHome,

        lambdaAway:
          simulation.debug.lambdaAway,

        totalLambda:
          simulation.debug.totalLambda,

        iterations:
          simulation.iterations,

        converged:
          simulation.convergence.converged,

        simulationQuality:
          simulation.simulationQuality,

        analyticalSources,
        modelComparison,
        divergence,
        warnings
      }
    },

    debug: mergeDebug(modelRecord, {
      version: VERSION,
      valid: true,
      converged:
        simulation.convergence.converged,

      source:
        "simulationPipeline",

      simulationSource:
        "pipeline_lambdas",

      model:
        "INDEPENDENT_POISSON",

      usesDixonColes:
        false,

      analyticalModelAuthority:
        true,

      probabilitiesOverwritten:
        false,

      probabilitiesAveraged:
        false,

      confidenceAltered:
        false,

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

      maxStandardError:
        roundNumber(
          simulation.maxStandardError
        ),

      simulationQuality:
        simulation.simulationQuality,

      convergence:
        simulation.convergence,

      analyticalSources,
      divergence,
      modelComparison,
      warnings,

      diagnostics:
        simulation.diagnostics
    })
  } as TModel & SimulationPipelineResult;
}

/* ==========================================
   RESULTADO INVÁLIDO
========================================== */

function buildInvalidResult<TModel>(
  model: TModel,
  modelRecord: Record<string, unknown>,
  simulation: MonteCarloAdapterOutput,
  analyticalProbabilities: AnalyticalProbabilityMap
): TModel & SimulationPipelineResult {
  const modelComparison =
    buildModelComparison(
      analyticalProbabilities,
      simulation
    );

  const divergence =
    createEmptyDivergence();

  const invalidReason =
    simulation.debug.invalidReason ??
    simulation.warnings[0] ??
    "MONTE_CARLO_SIMULATION_INVALID";

  const warnings = normalizeStrings([
    ...simulation.warnings,
    invalidReason,
    ...collectAnalyticalWarnings(
      analyticalProbabilities
    )
  ]);

  const analyticalSources =
    buildAnalyticalSources(modelComparison);

  return {
    ...model,

    monteCarlo: {
      valid: false,
      converged: false,

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
      under25Prob: 0,

      bttsProb: 0,
      bttsNoProb: 0,

      doubleChance1X: 0,
      doubleChanceX2: 0,

      samplingError:
        simulation.samplingError,

      maxSamplingError:
        simulation.maxSamplingError,

      maxStandardError:
        simulation.maxStandardError,

      confidenceInterval95:
        simulation.confidenceInterval95,

      convergence:
        simulation.convergence,

      simulationQuality:
        simulation.simulationQuality,

      warnings,

      diagnostics:
        simulation.diagnostics,

      modelComparison,
      divergence,

      error:
        invalidReason,

      debug: {
        version: VERSION,

        source:
          "simulationPipeline",

        simulationSource:
          "pipeline_lambdas",

        model:
          "INDEPENDENT_POISSON",

        usesDixonColes:
          false,

        analyticalModelAuthority:
          true,

        probabilitiesOverwritten:
          false,

        probabilitiesAveraged:
          false,

        confidenceAltered:
          false,

        lambdaHome:
          simulation.debug.lambdaHome,

        lambdaAway:
          simulation.debug.lambdaAway,

        totalLambda:
          simulation.debug.totalLambda,

        iterations: 0,
        converged: false,

        simulationQuality:
          simulation.simulationQuality,

        analyticalSources,
        modelComparison,
        divergence,
        warnings,

        invalidReason
      }
    },

    debug: mergeDebug(modelRecord, {
      version: VERSION,
      valid: false,
      converged: false,

      source:
        "simulationPipeline",

      simulationSource:
        "pipeline_lambdas",

      analyticalModelAuthority:
        true,

      probabilitiesOverwritten:
        false,

      probabilitiesAveraged:
        false,

      confidenceAltered:
        false,

      lambdaHome:
        simulation.debug.lambdaHome,

      lambdaAway:
        simulation.debug.lambdaAway,

      totalLambda:
        simulation.debug.totalLambda,

      iterations: 0,
      simulationQuality:
        simulation.simulationQuality,

      analyticalSources,
      modelComparison,
      divergence,
      warnings,
      invalidReason,

      diagnostics:
        simulation.diagnostics
    })
  } as TModel & SimulationPipelineResult;
}

/* ==========================================
   EXTRAÇÃO DO MODELO ANALÍTICO
========================================== */

function extractAnalyticalProbabilities(
  model: Record<string, unknown>
): AnalyticalProbabilityMap {
  const homeWin = resolveProbability([
    candidate(
      model,
      ["markets", "home"],
      "markets"
    ),
    candidate(
      model,
      ["result", "home"],
      "result"
    ),
    candidate(
      model,
      ["result", "homeWin"],
      "legacy"
    )
  ]);

  const draw = resolveProbability([
    candidate(
      model,
      ["markets", "draw"],
      "markets"
    ),
    candidate(
      model,
      ["result", "draw"],
      "result"
    )
  ]);

  const awayWin = resolveProbability([
    candidate(
      model,
      ["markets", "away"],
      "markets"
    ),
    candidate(
      model,
      ["result", "away"],
      "result"
    ),
    candidate(
      model,
      ["result", "awayWin"],
      "legacy"
    )
  ]);

  const over15 = resolveProbability([
    candidate(
      model,
      ["markets", "over15"],
      "markets"
    ),
    candidate(
      model,
      ["goals", "over15"],
      "goals"
    )
  ]);

  const over25 = resolveProbability([
    candidate(
      model,
      ["markets", "over25"],
      "markets"
    ),
    candidate(
      model,
      ["goals", "over25"],
      "goals"
    )
  ]);

  const explicitUnder15 = resolveProbability([
    candidate(
      model,
      ["markets", "under15"],
      "markets"
    ),
    candidate(
      model,
      ["goals", "under15"],
      "goals"
    )
  ]);

  const under15 =
    explicitUnder15.value !== null
      ? explicitUnder15
      : deriveComplement(
          over15,
          "goals.over15"
        );

  const explicitUnder25 = resolveProbability([
    candidate(
      model,
      ["markets", "under25"],
      "markets"
    ),
    candidate(
      model,
      ["goals", "under25"],
      "goals"
    )
  ]);

  const under25 =
    explicitUnder25.value !== null
      ? explicitUnder25
      : deriveComplement(
          over25,
          "goals.over25"
        );

  const bttsYes = resolveProbability([
    candidate(
      model,
      ["markets", "bttsYes"],
      "markets"
    ),
    candidate(
      model,
      ["btts", "yes"],
      "btts"
    ),
    candidate(
      model,
      ["dixonColes", "bttsYesProb"],
      "legacy"
    )
  ]);

  const explicitBttsNo = resolveProbability([
    candidate(
      model,
      ["markets", "bttsNo"],
      "markets"
    ),
    candidate(
      model,
      ["btts", "no"],
      "btts"
    ),
    candidate(
      model,
      ["dixonColes", "bttsNoProb"],
      "legacy"
    )
  ]);

  const bttsNo =
    explicitBttsNo.value !== null
      ? explicitBttsNo
      : deriveComplement(
          bttsYes,
          "btts.yes"
        );

  const explicitDoubleChance1X =
    resolveProbability([
      candidate(
        model,
        ["markets", "doubleChance1X"],
        "markets"
      ),
      candidate(
        model,
        ["doubleChance", "oneX"],
        "doubleChance"
      ),
      candidate(
        model,
        ["doubleChance", "homeOrDraw"],
        "legacy"
      ),
      candidate(
        model,
        ["result", "doubleChance1X"],
        "legacy"
      ),
      candidate(
        model,
        ["result", "homeOrDraw"],
        "legacy"
      )
    ]);

  const doubleChance1X =
    explicitDoubleChance1X.value !== null
      ? explicitDoubleChance1X
      : deriveSum(
          homeWin,
          draw,
          "result.home + result.draw"
        );

  const explicitDoubleChanceX2 =
    resolveProbability([
      candidate(
        model,
        ["markets", "doubleChanceX2"],
        "markets"
      ),
      candidate(
        model,
        ["doubleChance", "xTwo"],
        "doubleChance"
      ),
      candidate(
        model,
        ["doubleChance", "awayOrDraw"],
        "legacy"
      ),
      candidate(
        model,
        ["result", "doubleChanceX2"],
        "legacy"
      ),
      candidate(
        model,
        ["result", "awayOrDraw"],
        "legacy"
      )
    ]);

  const doubleChanceX2 =
    explicitDoubleChanceX2.value !== null
      ? explicitDoubleChanceX2
      : deriveSum(
          draw,
          awayWin,
          "result.draw + result.away"
        );

  const explicitDnbHome = resolveProbability([
    candidate(
      model,
      ["markets", "dnbHome"],
      "markets"
    )
  ]);

  const dnbHome =
    explicitDnbHome.value !== null
      ? explicitDnbHome
      : deriveRatio(
          homeWin,
          awayWin,
          "result.home / (result.home + result.away)"
        );

  const explicitDnbAway = resolveProbability([
    candidate(
      model,
      ["markets", "dnbAway"],
      "markets"
    )
  ]);

  const dnbAway =
    explicitDnbAway.value !== null
      ? explicitDnbAway
      : deriveRatio(
          awayWin,
          homeWin,
          "result.away / (result.home + result.away)"
        );

  return {
    homeWin,
    draw,
    awayWin,
    over15,
    over25,
    under15,
    under25,
    bttsYes,
    bttsNo,
    doubleChance1X,
    doubleChanceX2,
    dnbHome,
    dnbAway
  };
}

function candidate(
  model: Record<string, unknown>,
  path: string[],
  source: AnalyticalProbabilitySource
): ProbabilityCandidate {
  return {
    value:
      getNestedValue(
        model,
        path
      ),

    source,
    path:
      path.join(".")
  };
}

function resolveProbability(
  candidates: ProbabilityCandidate[]
): ResolvedAnalyticalProbability {
  const validCandidates = candidates
    .map(candidateValue => ({
      ...candidateValue,
      parsed:
        parseProbability(
          candidateValue.value
        )
    }))
    .filter(
      (
        candidateValue
      ): candidateValue is ProbabilityCandidate & {
        parsed: number;
      } => candidateValue.parsed !== null
    );

  if (validCandidates.length === 0) {
    return createMissingProbability();
  }

  const selected = validCandidates[0];

  const alternatives =
    validCandidates
      .slice(1)
      .map(value => ({
        path: value.path,
        value: value.parsed
      }));

  const conflictDetected =
    validCandidates.some(
      value =>
        Math.abs(
          value.parsed -
          selected.parsed
        ) >
        COMPARISON_CONFLICT_TOLERANCE
    );

  return {
    value:
      selected.parsed,

    source:
      selected.source,

    path:
      selected.path,

    conflictDetected,
    alternatives
  };
}

function deriveComplement(
  sourceProbability:
    ResolvedAnalyticalProbability,
  sourcePath: string
): ResolvedAnalyticalProbability {
  if (sourceProbability.value === null) {
    return createMissingProbability();
  }

  return {
    value:
      clampProbability(
        1 - sourceProbability.value
      ),

    source:
      "complement",

    path:
      `1 - ${sourcePath}`,

    conflictDetected:
      sourceProbability.conflictDetected,

    alternatives: []
  };
}

function deriveSum(
  first: ResolvedAnalyticalProbability,
  second: ResolvedAnalyticalProbability,
  path: string
): ResolvedAnalyticalProbability {
  if (
    first.value === null ||
    second.value === null
  ) {
    return createMissingProbability();
  }

  const sum =
    first.value + second.value;

  if (sum < 0 || sum > 1) {
    return createMissingProbability();
  }

  return {
    value: sum,
    source: "sum",
    path,

    conflictDetected:
      first.conflictDetected ||
      second.conflictDetected,

    alternatives: []
  };
}

/*
 * Probabilidade condicional a/(a+b) — usada pelo DNB
 * (Empate Anula): probabilidade de vitória do lado
 * escolhido dado que a partida não termina empatada.
 */
function deriveRatio(
  numerator: ResolvedAnalyticalProbability,
  denominatorOther: ResolvedAnalyticalProbability,
  path: string
): ResolvedAnalyticalProbability {
  if (
    numerator.value === null ||
    denominatorOther.value === null
  ) {
    return createMissingProbability();
  }

  const denominator =
    numerator.value +
    denominatorOther.value;

  if (denominator <= 0) {
    return createMissingProbability();
  }

  return {
    value:
      clampProbability(
        numerator.value /
        denominator
      ),

    source: "ratio",
    path,

    conflictDetected:
      numerator.conflictDetected ||
      denominatorOther.conflictDetected,

    alternatives: []
  };
}

function createMissingProbability():
  ResolvedAnalyticalProbability {
  return {
    value: null,
    source: "missing",
    path: null,
    conflictDetected: false,
    alternatives: []
  };
}

/* ==========================================
   COMPARAÇÃO
========================================== */

function buildModelComparison(
  analytical: AnalyticalProbabilityMap,
  simulation: MonteCarloAdapterOutput
): SimulationModelComparison {
  const probabilities =
    simulation.probabilities;

  return {
    OVER_1_5: compareProbability(
      analytical.over15,
      probabilities.over15,
      simulation.samplingError.over15,
      simulation.confidenceInterval95.over15
    ),

    OVER_2_5: compareProbability(
      analytical.over25,
      probabilities.over25,
      simulation.samplingError.over25,
      simulation.confidenceInterval95.over25
    ),

    /*
     * O monteCarloAdapter ainda não simula under15/dnbHome/
     * dnbAway diretamente (só under25/doubleChance1X/X2
     * hoje) — comparação Monte Carlo fica indisponível para
     * esses 3 mercados (degrada para monteCarlo:0,
     * samplingError:null dentro de compareProbability, sem
     * quebrar nada; este pipeline é só diagnóstico, não
     * autoritativo).
     */
    UNDER_1_5: compareProbability(
      analytical.under15,
      undefined,
      undefined,
      undefined
    ),

    UNDER_2_5: compareProbability(
      analytical.under25,
      probabilities.under25,
      simulation.samplingError.under25,
      simulation.confidenceInterval95.under25
    ),

    BTTS_YES: compareProbability(
      analytical.bttsYes,
      probabilities.bttsYes,
      simulation.samplingError.bttsYes,
      simulation.confidenceInterval95.bttsYes
    ),

    BTTS_NO: compareProbability(
      analytical.bttsNo,
      probabilities.bttsNo,
      simulation.samplingError.bttsNo,
      simulation.confidenceInterval95.bttsNo
    ),

    HOME_WIN: compareProbability(
      analytical.homeWin,
      probabilities.homeWin,
      simulation.samplingError.homeWin,
      simulation.confidenceInterval95.homeWin
    ),

    DRAW: compareProbability(
      analytical.draw,
      probabilities.draw,
      simulation.samplingError.draw,
      simulation.confidenceInterval95.draw
    ),

    AWAY_WIN: compareProbability(
      analytical.awayWin,
      probabilities.awayWin,
      simulation.samplingError.awayWin,
      simulation.confidenceInterval95.awayWin
    ),

    DOUBLE_CHANCE_1X: compareProbability(
      analytical.doubleChance1X,
      probabilities.doubleChance1X,
      simulation.samplingError.doubleChance1X,
      simulation.confidenceInterval95.doubleChance1X
    ),

    DOUBLE_CHANCE_X2: compareProbability(
      analytical.doubleChanceX2,
      probabilities.doubleChanceX2,
      simulation.samplingError.doubleChanceX2,
      simulation.confidenceInterval95.doubleChanceX2
    ),

    DNB_HOME: compareProbability(
      analytical.dnbHome,
      undefined,
      undefined,
      undefined
    ),

    DNB_AWAY: compareProbability(
      analytical.dnbAway,
      undefined,
      undefined,
      undefined
    )
  };
}

function compareProbability(
  analytical:
    ResolvedAnalyticalProbability,
  monteCarloProbability: unknown,
  samplingError: unknown,
  confidenceInterval95: unknown
): ProbabilityComparison {
  const safeMonteCarlo =
    parseProbability(
      monteCarloProbability
    ) ?? 0;

  const safeSamplingError =
    parseNonNegativeNumber(
      samplingError
    );

  const safeInterval =
    parseConfidenceInterval95(
      confidenceInterval95
    );

  if (analytical.value === null) {
    return {
      model: null,
      modelSource:
        analytical.source,
      modelPath:
        analytical.path,

      monteCarlo:
        safeMonteCarlo,

      diff: null,

      samplingError:
        safeSamplingError === null
          ? null
          : roundNumber(
              safeSamplingError
            ),

      adjustedDiff: null,

      confidenceInterval95:
        safeInterval,

      withinMonteCarloCI95:
        null,

      conflictDetected:
        analytical.conflictDetected
    };
  }

  const rawDifference =
    Math.abs(
      analytical.value -
      safeMonteCarlo
    );

  const samplingMargin =
    safeInterval?.margin ??
    (
      safeSamplingError === null
        ? 0
        : 1.96 * safeSamplingError
    );

  const adjustedDifference =
    Math.max(
      0,
      rawDifference -
      samplingMargin
    );

  const withinMonteCarloCI95 =
    safeInterval === null
      ? null
      : analytical.value >=
          safeInterval.lower &&
        analytical.value <=
          safeInterval.upper;

  return {
    model:
      analytical.value,

    modelSource:
      analytical.source,

    modelPath:
      analytical.path,

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
      ),

    confidenceInterval95:
      safeInterval,

    withinMonteCarloCI95,

    conflictDetected:
      analytical.conflictDetected
  };
}

/* ==========================================
   DIVERGÊNCIA
========================================== */

function calculateDivergence(
  comparison: SimulationModelComparison
): SimulationDivergence {
  const entries =
    Object.entries(comparison) as Array<[
      SimulationMarket,
      ProbabilityComparison
    ]>;

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

  const adjustedEntries =
    validEntries.filter(
      ([, value]) =>
        value.adjustedDiff !== null
    );

  const adjustedDifferences =
    adjustedEntries.map(
      ([, value]) =>
        value.adjustedDiff as number
    );

  const highestRawDivergenceMarket =
    findHighestMarket(
      validEntries,
      "diff"
    );

  const highestAdjustedDivergenceMarket =
    findHighestMarket(
      adjustedEntries,
      "adjustedDiff"
    );

  const marketsInsideCI95 =
    validEntries.filter(
      ([, value]) =>
        value.withinMonteCarloCI95 ===
        true
    ).length;

  const marketsOutsideCI95 =
    validEntries.filter(
      ([, value]) =>
        value.withinMonteCarloCI95 ===
        false
    ).length;

  const marketsWithoutCI95 =
    validEntries.filter(
      ([, value]) =>
        value.withinMonteCarloCI95 ===
        null
    ).length;

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

    minimumAdjusted:
      adjustedDifferences.length > 0
        ? roundNumber(
            Math.min(
              ...adjustedDifferences
            )
          )
        : null,

    comparedMarkets:
      validEntries.length,

    marketsInsideCI95,
    marketsOutsideCI95,
    marketsWithoutCI95,

    highestDivergenceMarket:
      highestRawDivergenceMarket,

    highestRawDivergenceMarket,
    highestAdjustedDivergenceMarket
  };
}

function findHighestMarket(
  entries: Array<[
    SimulationMarket,
    ProbabilityComparison
  ]>,
  key: "diff" | "adjustedDiff"
): SimulationMarket | null {
  let selectedMarket:
    SimulationMarket | null = null;

  let highestValue =
    Number.NEGATIVE_INFINITY;

  for (const [market, value] of entries) {
    const currentValue =
      value[key];

    if (
      currentValue !== null &&
      currentValue > highestValue
    ) {
      highestValue =
        currentValue;

      selectedMarket =
        market;
    }
  }

  return selectedMarket;
}

/* ==========================================
   DIAGNÓSTICOS ANALÍTICOS
========================================== */

function buildAnalyticalSources(
  comparison: SimulationModelComparison
): Record<
  SimulationMarket,
  {
    source: AnalyticalProbabilitySource;
    path: string | null;
    conflictDetected: boolean;
  }
> {
  return mapRecordValues(
    comparison,
    value => ({
      source:
        value.modelSource,

      path:
        value.modelPath,

      conflictDetected:
        value.conflictDetected
    })
  );
}

function collectAnalyticalWarnings(
  probabilities: AnalyticalProbabilityMap
): string[] {
  const warnings: string[] = [];

  const entries =
    Object.entries(probabilities) as Array<[
      keyof AnalyticalProbabilityMap,
      ResolvedAnalyticalProbability
    ]>;

  for (const [market, probability] of entries) {
    if (probability.value === null) {
      warnings.push(
        `ANALYTICAL_PROBABILITY_MISSING_${String(
          market
        ).toUpperCase()}`
      );
    }

    if (probability.conflictDetected) {
      warnings.push(
        `ANALYTICAL_PROBABILITY_CONFLICT_${String(
          market
        ).toUpperCase()}`
      );
    }
  }

  return normalizeStrings(warnings);
}

/* ==========================================
   FALLBACKS
========================================== */

function createEmptyDivergence():
  SimulationDivergence {
  return {
    average: null,
    maximum: null,
    minimum: null,

    averageAdjusted: null,
    maximumAdjusted: null,
    minimumAdjusted: null,

    comparedMarkets: 0,

    marketsInsideCI95: 0,
    marketsOutsideCI95: 0,
    marketsWithoutCI95: 0,

    highestDivergenceMarket: null,
    highestRawDivergenceMarket: null,
    highestAdjustedDivergenceMarket: null
  };
}

/* ==========================================
   PARSERS NUMÉRICOS E HELPERS
========================================== */

function parseFiniteNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed = Number(
    typeof value === "string"
      ? value
          .replace(",", ".")
          .trim()
      : value
  );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseProbability(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(value);

  if (
    parsed === null ||
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
    parseFiniteNumber(value);

  if (
    parsed === null ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function parseConfidenceInterval95(
  value: unknown
): ProbabilityInterval95 | null {
  if (!isRecord(value)) {
    return null;
  }

  const lower =
    parseProbability(value.lower);

  const upper =
    parseProbability(value.upper);

  const margin =
    parseNonNegativeNumber(
      value.margin
    );

  if (
    lower === null ||
    upper === null ||
    margin === null ||
    lower > upper
  ) {
    return null;
  }

  return {
    lower:
      roundNumber(lower),

    upper:
      roundNumber(upper),

    margin:
      roundNumber(margin)
  };
}

function clampProbability(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      value,
      1
    )
  );
}

function average(
  values: number[]
): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce(
    (sum, value) =>
      sum + value,
    0
  ) / values.length;
}

function roundNumber(
  value: number,
  decimals = 6
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return Math.round(
    value * factor
  ) / factor;
}

function normalizeStrings(
  values: string[]
): string[] {
  return [
    ...new Set(
      values
        .map(value =>
          String(value ?? "").trim()
        )
        .filter(Boolean)
    )
  ];
}

function asRecord(
  value: unknown
): Record<string, unknown> {
  return isRecord(value)
    ? value
    : {};
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getNestedValue(
  source: Record<string, unknown>,
  path: string[]
): unknown {
  let current: unknown = source;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function mergeDebug(
  model: Record<string, unknown>,
  simulationDebug:
    Record<string, unknown>
): Record<string, unknown> {
  const currentDebug =
    isRecord(model.debug)
      ? model.debug
      : {};

  return {
    ...currentDebug,

    simulationPipeline:
      simulationDebug
  };
}

function mapRecordValues<
  TKey extends string,
  TValue,
  TResult
>(
  input: Record<TKey, TValue>,
  mapper: (
    value: TValue,
    key: TKey
  ) => TResult
): Record<TKey, TResult> {
  const output = {} as Record<
    TKey,
    TResult
  >;

  for (
    const key of Object.keys(
      input
    ) as TKey[]
  ) {
    output[key] = mapper(
      input[key],
      key
    );
  }

  return output;
}
