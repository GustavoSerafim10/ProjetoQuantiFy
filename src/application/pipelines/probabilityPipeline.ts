import {
  calibrateProbability
} from "../../domain/calibration/probabilityCalibration";

/* ==========================================
   PROBABILITY PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - receber probabilidades analíticas do modelo;
 * - validar suas relações matemáticas;
 * - aplicar a calibração oficial uma única vez;
 * - preservar coerência entre mercados;
 * - produzir o mapa canônico de probabilidades.
 *
 * Este arquivo não:
 *
 * - reconstrói lambdas;
 * - aplica baseline arbitrário;
 * - realiza shrinkage amostral;
 * - utiliza odds;
 * - calcula EV;
 * - escolhe mercado;
 * - toma decisão.
 */

/* ==========================================
   CONTRATOS
========================================== */

export type ProbabilityMarket =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2";

export type ProbabilityMap = Record<
  ProbabilityMarket,
  number
>;

interface ResultProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
}

interface GoalsProbabilities {
  over15: number;
  over25: number;
}

interface BttsProbabilities {
  yes: number;
  no: number;
}

interface ProbabilityPipelineDebug {
  valid: boolean;

  source: "analytical_model";

  calibrationApplied: boolean;

  raw: ProbabilityMap;

  calibratedIndependent: {
    HOME: number;
    DRAW: number;
    AWAY: number;

    OVER_1_5: number;
    OVER_2_5: number;

    BTTS_YES: number;
  };

  final: ProbabilityMap;

  coherence: {
    resultNormalized: boolean;
    bttsDerivedFromYes: boolean;
    doubleChanceDerivedFromResult: boolean;
    overHierarchyAdjusted: boolean;
  };

  warnings: string[];
}

/* ==========================================
   RESULTADO SEGURO INVÁLIDO
========================================== */

/*
 * Em caso de falha estrutural, retornamos zero
 * em todos os mercados.
 *
 * Isso evita criar uma oportunidade artificial.
 * Os próximos pipelines devem interpretar
 * probabilityValid = false como NO BET.
 */
const INVALID_PROBABILITIES: ProbabilityMap = {
  HOME: 0,
  DRAW: 0,
  AWAY: 0,

  OVER_1_5: 0,
  OVER_2_5: 0,

  BTTS_YES: 0,
  BTTS_NO: 0,

  DOUBLE_CHANCE_1X: 0,
  DOUBLE_CHANCE_X2: 0
};

/* ==========================================
   PIPELINE
========================================== */

export function probabilityPipeline(
  data: any
) {
  const warnings: string[] = [];

  const rawResult =
    extractResultProbabilities(
      data?.result
    );

  const rawGoals =
    extractGoalsProbabilities(
      data?.goals
    );

  const rawBtts =
    extractBttsProbabilities(
      data?.btts
    );

  if (!rawResult) {
    warnings.push(
      "INVALID_ANALYTICAL_RESULT_PROBABILITIES"
    );
  }

  if (!rawGoals) {
    warnings.push(
      "INVALID_ANALYTICAL_GOALS_PROBABILITIES"
    );
  }

  if (!rawBtts) {
    warnings.push(
      "INVALID_ANALYTICAL_BTTS_PROBABILITIES"
    );
  }

  /*
   * Não fabricamos probabilidades quando algum
   * bloco fundamental do modelo está inválido.
   */
  if (
    !rawResult ||
    !rawGoals ||
    !rawBtts
  ) {
    return createInvalidPipelineResult(
      data,
      warnings
    );
  }

  /* ==========================================
     1X2 — NORMALIZAÇÃO BRUTA
  ========================================== */

  const normalizedRawResult =
    normalizeResultProbabilities(
      rawResult
    );

  /* ==========================================
     CALIBRAÇÃO DOS MERCADOS INDEPENDENTES
  ========================================== */

  const calibratedHome =
    calibrate(
      normalizedRawResult.homeWin
    );

  const calibratedDraw =
    calibrate(
      normalizedRawResult.draw
    );

  const calibratedAway =
    calibrate(
      normalizedRawResult.awayWin
    );

  /*
   * A calibração individual pode alterar a soma.
   * Portanto, normalizamos novamente.
   */
  const calibratedResult =
    normalizeResultProbabilities({
      homeWin:
        calibratedHome,

      draw:
        calibratedDraw,

      awayWin:
        calibratedAway
    });

  const calibratedOver15 =
    calibrate(
      rawGoals.over15
    );

  const calibratedOver25 =
    calibrate(
      rawGoals.over25
    );

  const coherentGoals =
    enforceOverHierarchy(
      calibratedOver15,
      calibratedOver25
    );

  /*
   * BTTS Sim é calibrado.
   * BTTS Não é derivado como complemento.
   */
  const calibratedBttsYes =
    calibrate(
      rawBtts.yes
    );

  const calibratedBtts: BttsProbabilities = {
    yes:
      calibratedBttsYes,

    no:
      1 - calibratedBttsYes
  };

  /*
   * Duplas chances são derivadas das
   * probabilidades finais de 1X2.
   *
   * Não recebem uma segunda calibração.
   */
  const doubleChance1X =
    calibratedResult.homeWin +
    calibratedResult.draw;

  const doubleChanceX2 =
    calibratedResult.draw +
    calibratedResult.awayWin;

  /* ==========================================
     MAPAS DE PROBABILIDADE
  ========================================== */

  const rawProbabilities:
    ProbabilityMap = {
      HOME:
        normalizedRawResult.homeWin,

      DRAW:
        normalizedRawResult.draw,

      AWAY:
        normalizedRawResult.awayWin,

      OVER_1_5:
        rawGoals.over15,

      OVER_2_5:
        rawGoals.over25,

      BTTS_YES:
        rawBtts.yes,

      BTTS_NO:
        rawBtts.no,

      DOUBLE_CHANCE_1X:
        normalizedRawResult.homeWin +
        normalizedRawResult.draw,

      DOUBLE_CHANCE_X2:
        normalizedRawResult.draw +
        normalizedRawResult.awayWin
    };

  const probs:
    ProbabilityMap = {
      HOME:
        calibratedResult.homeWin,

      DRAW:
        calibratedResult.draw,

      AWAY:
        calibratedResult.awayWin,

      OVER_1_5:
        coherentGoals.over15,

      OVER_2_5:
        coherentGoals.over25,

      BTTS_YES:
        calibratedBtts.yes,

      BTTS_NO:
        calibratedBtts.no,

      DOUBLE_CHANCE_1X:
        doubleChance1X,

      DOUBLE_CHANCE_X2:
        doubleChanceX2
    };

  const debug:
    ProbabilityPipelineDebug = {
      valid: true,

      source:
        "analytical_model",

      calibrationApplied:
        true,

      raw:
        roundProbabilityMap(
          rawProbabilities
        ),

      calibratedIndependent: {
        HOME:
          roundProbability(
            calibratedHome
          ),

        DRAW:
          roundProbability(
            calibratedDraw
          ),

        AWAY:
          roundProbability(
            calibratedAway
          ),

        OVER_1_5:
          roundProbability(
            calibratedOver15
          ),

        OVER_2_5:
          roundProbability(
            calibratedOver25
          ),

        BTTS_YES:
          roundProbability(
            calibratedBttsYes
          )
      },

      final:
        roundProbabilityMap(
          probs
        ),

      coherence: {
        resultNormalized:
          true,

        bttsDerivedFromYes:
          true,

        doubleChanceDerivedFromResult:
          true,

        overHierarchyAdjusted:
          coherentGoals.adjusted
      },

      warnings
    };

  return {
    ...data,

    probabilityValid:
      true,

    probs:
      roundProbabilityMap(
        probs
      ),

    debug: {
      ...(data?.debug ?? {}),

      probabilityPipeline:
        debug
    }
  };
}

/* ==========================================
   EXTRAÇÃO — RESULTADO 1X2
========================================== */

function extractResultProbabilities(
  result: any
): ResultProbabilities | null {
  /*
   * Compatibilidade com os contratos atuais:
   *
   * Contrato canônico:
   * homeWin, draw, awayWin
   *
   * Contrato do goalsModel:
   * home, draw, away
   *
   * Contratos legados:
   * homeProbability, drawProbability,
   * awayProbability
   */
  const homeWin =
    firstValidProbability([
      result?.homeWin,
      result?.home,
      result?.homeProbability
    ]);

  const draw =
    firstValidProbability([
      result?.draw,
      result?.drawProbability
    ]);

  const awayWin =
    firstValidProbability([
      result?.awayWin,
      result?.away,
      result?.awayProbability
    ]);

  if (
    homeWin === null ||
    draw === null ||
    awayWin === null
  ) {
    return null;
  }

  const total =
    homeWin +
    draw +
    awayWin;

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return null;
  }

  return {
    homeWin,
    draw,
    awayWin
  };
}

/* ==========================================
   EXTRAÇÃO — GOLS
========================================== */

function extractGoalsProbabilities(
  goals: any
): GoalsProbabilities | null {
  const over15 =
    firstValidProbability([
      goals?.over15,
      goals?.over1_5,
      goals?.overOneFive
    ]);

  const over25 =
    firstValidProbability([
      goals?.over25,
      goals?.over2_5,
      goals?.overTwoFive
    ]);

  if (
    over15 === null ||
    over25 === null
  ) {
    return null;
  }

  return {
    over15,
    over25
  };
}

/* ==========================================
   EXTRAÇÃO — BTTS
========================================== */

function extractBttsProbabilities(
  btts: any
): BttsProbabilities | null {
  const explicitYes =
    firstValidProbability([
      btts?.yes,
      btts?.bttsYes,
      btts?.bothTeamsScore
    ]);

  const explicitNo =
    firstValidProbability([
      btts?.no,
      btts?.bttsNo
    ]);

  /*
   * BTTS Sim é a probabilidade principal.
   * BTTS Não é reconstruído como complemento.
   */
  if (explicitYes !== null) {
    return {
      yes:
        explicitYes,

      no:
        1 - explicitYes
    };
  }

  /*
   * Caso apenas BTTS Não esteja disponível,
   * reconstruímos BTTS Sim.
   */
  if (explicitNo !== null) {
    return {
      yes:
        1 - explicitNo,

      no:
        explicitNo
    };
  }

  return null;
}

/* ==========================================
   NORMALIZAÇÃO 1X2
========================================== */

/*
 * Esta normalização não aplica baseline,
 * shrinkage ou alteração externa.
 *
 * Ela apenas garante:
 *
 * Home + Draw + Away = 1
 */
function normalizeResultProbabilities(
  result: ResultProbabilities
): ResultProbabilities {
  const total =
    result.homeWin +
    result.draw +
    result.awayWin;

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return {
      homeWin: 0,
      draw: 0,
      awayWin: 0
    };
  }

  return {
    homeWin:
      result.homeWin /
      total,

    draw:
      result.draw /
      total,

    awayWin:
      result.awayWin /
      total
  };
}

/* ==========================================
   CALIBRAÇÃO
========================================== */

function calibrate(
  probability: number
): number {
  const calibrated =
    calibrateProbability(
      probability
    );

  const parsed =
    parseProbability(
      calibrated
    );

  /*
   * Caso a função de calibração falhe,
   * preservamos a probabilidade analítica.
   *
   * Não utilizamos baseline externo.
   */
  return parsed ??
    probability;
}

/* ==========================================
   COERÊNCIA DOS OVERS
========================================== */

function enforceOverHierarchy(
  over15: number,
  over25: number
): {
  over15: number;
  over25: number;
  adjusted: boolean;
} {
  if (over15 >= over25) {
    return {
      over15,
      over25,
      adjusted: false
    };
  }

  /*
   * Projeção isotônica simples.
   *
   * Quando a calibração produz uma inversão,
   * usamos a média dos dois valores.
   *
   * Essa é a menor correção quadrática conjunta
   * que satisfaz Over 1.5 >= Over 2.5.
   */
  const projected =
    (over15 + over25) / 2;

  return {
    over15:
      projected,

    over25:
      projected,

    adjusted:
      true
  };
}

/* ==========================================
   RESULTADO INVÁLIDO
========================================== */

function createInvalidPipelineResult(
  data: any,
  warnings: string[]
) {
  const debug:
    ProbabilityPipelineDebug = {
      valid: false,

      source:
        "analytical_model",

      calibrationApplied:
        false,

      raw: {
        ...INVALID_PROBABILITIES
      },

      calibratedIndependent: {
        HOME: 0,
        DRAW: 0,
        AWAY: 0,

        OVER_1_5: 0,
        OVER_2_5: 0,

        BTTS_YES: 0
      },

      final: {
        ...INVALID_PROBABILITIES
      },

      coherence: {
        resultNormalized:
          false,

        bttsDerivedFromYes:
          false,

        doubleChanceDerivedFromResult:
          false,

        overHierarchyAdjusted:
          false
      },

      warnings
    };

  return {
    ...data,

    probabilityValid:
      false,

    probs: {
      ...INVALID_PROBABILITIES
    },

    debug: {
      ...(data?.debug ?? {}),

      probabilityPipeline:
        debug
    }
  };
}

/* ==========================================
   HELPERS
========================================== */

function firstValidProbability(
  values: unknown[]
): number | null {
  for (const value of values) {
    const probability =
      parseProbability(
        value
      );

    if (probability !== null) {
      return probability;
    }
  }

  return null;
}

function parseProbability(
  value: unknown
): number | null {
  /*
   * Number(null) e Number("") retornam 0.
   * Esses valores não representam uma
   * probabilidade realmente fornecida.
   */
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > 1
  ) {
    return null;
  }

  return parsed;
}

function roundProbability(
  probability: number,
  decimals = 6
): number {
  if (!Number.isFinite(probability)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      probability * factor
    ) / factor
  );
}

function roundProbabilityMap(
  probabilities: ProbabilityMap
): ProbabilityMap {
  return {
    HOME:
      roundProbability(
        probabilities.HOME
      ),

    DRAW:
      roundProbability(
        probabilities.DRAW
      ),

    AWAY:
      roundProbability(
        probabilities.AWAY
      ),

    OVER_1_5:
      roundProbability(
        probabilities.OVER_1_5
      ),

    OVER_2_5:
      roundProbability(
        probabilities.OVER_2_5
      ),

    BTTS_YES:
      roundProbability(
        probabilities.BTTS_YES
      ),

    BTTS_NO:
      roundProbability(
        probabilities.BTTS_NO
      ),

    DOUBLE_CHANCE_1X:
      roundProbability(
        probabilities.DOUBLE_CHANCE_1X
      ),

    DOUBLE_CHANCE_X2:
      roundProbability(
        probabilities.DOUBLE_CHANCE_X2
      )
  };
}