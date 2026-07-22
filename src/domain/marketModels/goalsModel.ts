import { poissonTable } from "../math/poisson";
import { applyDixonColesMatrix } from "../math/dixonColesMatrix";
import { calculateDynamicRhoAdvanced } from "../model/rhoCalculator";
import { autoLearningEngine } from "../learning/autoLearningEngine";

/* ==========================================
   PARÂMETROS ESTRUTURAIS
========================================== */

/*
 * Limites compatíveis com as proteções atuais
 * do lambdaBuilder.
 */
const MIN_LAMBDA = 0.20;
const MAX_LAMBDA = 3.20;

/*
 * Envelope operacional do parâmetro rho.
 *
 * Os limites matemáticos específicos da partida
 * serão calculados posteriormente com base nos
 * lambdas.
 *
 * Esses valores devem ser calibrados futuramente
 * por máxima verossimilhança e validação
 * fora da amostra.
 */
const MIN_OPERATIONAL_RHO = -0.15;
const MAX_OPERATIONAL_RHO = 0.10;

/*
 * Proteção para evitar fatores Dixon-Coles
 * exatamente iguais a zero.
 */
const RHO_EPSILON = 1e-8;

/*
 * Limites da dimensão da matriz.
 */
const MIN_MAX_GOALS = 10;
const MAX_MAX_GOALS = 20;

/* ==========================================
   TIPOS
========================================== */

export interface GoalsModelStats {
  /*
   * Mantidos para compatibilidade da assinatura.
   *
   * Neste estágio eles não alteram diretamente
   * a matriz, evitando dupla contagem com os lambdas.
   */
  matches?: number;
  pressure?: number;
  shots?: number;
  cards?: number;

  [key: string]: unknown;
}

export interface GoalsModelResult {
  matrix: number[][];

  over15: number;
  over25: number;

  under15: number;
  under25: number;

  meta: {
    lambdaHome: number;
    lambdaAway: number;
    totalLambda: number;

    maxGoals: number;

    baseRho: number;
    learningRhoShift: number;
    rho: number;

    independentMatrixMass: number;
    adjustedMatrixMass: number;
  };
}

/* ==========================================
   UTILITÁRIOS NUMÉRICOS
========================================== */

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function safeNumber(
  value: unknown,
  fallback: number
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function sanitizeProbability(
  value: unknown
): number {
  return clamp(
    safeNumber(value, 0),
    0,
    1
  );
}

/* ==========================================
   DIMENSÃO DINÂMICA DA MATRIZ
========================================== */

function calculateMaxGoals(
  lambdaHome: number,
  lambdaAway: number
): number {
  const maximumLambda =
    Math.max(
      lambdaHome,
      lambdaAway
    );

  /*
   * Aproximação conservadora da cauda:
   *
   * média + 6 desvios-padrão
   *
   * Para Poisson:
   * desvio-padrão = sqrt(lambda)
   */
  const estimatedLimit =
    Math.ceil(
      maximumLambda +
      6 * Math.sqrt(maximumLambda)
    );

  return Math.round(
    clamp(
      estimatedLimit,
      MIN_MAX_GOALS,
      MAX_MAX_GOALS
    )
  );
}

/* ==========================================
   MATRIZ POISSON INDEPENDENTE
========================================== */

function buildIndependentMatrix(
  homeDistribution: number[],
  awayDistribution: number[],
  maxGoals: number
): number[][] {
  const matrix: number[][] = [];

  for (
    let homeGoals = 0;
    homeGoals <= maxGoals;
    homeGoals++
  ) {
    const row: number[] = [];

    for (
      let awayGoals = 0;
      awayGoals <= maxGoals;
      awayGoals++
    ) {
      const homeProbability =
        sanitizeProbability(
          homeDistribution[homeGoals]
        );

      const awayProbability =
        sanitizeProbability(
          awayDistribution[awayGoals]
        );

      const jointProbability =
        homeProbability *
        awayProbability;

      row.push(
        Number.isFinite(jointProbability)
          ? Math.max(0, jointProbability)
          : 0
      );
    }

    matrix.push(row);
  }

  return matrix;
}

/* ==========================================
   OPERAÇÕES DE MATRIZ
========================================== */

function calculateMatrixMass(
  matrix: number[][]
): number {
  return matrix.reduce(
    (total, row) => {
      return total + row.reduce(
        (rowTotal, value) => {
          const safeValue =
            safeNumber(value, 0);

          return (
            rowTotal +
            Math.max(0, safeValue)
          );
        },
        0
      );
    },
    0
  );
}

function sanitizeMatrix(
  matrix: number[][]
): number[][] {
  return matrix.map(row =>
    row.map(value => {
      const parsed =
        safeNumber(value, 0);

      return parsed > 0
        ? parsed
        : 0;
    })
  );
}

function normalizeMatrix(
  matrix: number[][],
  fallbackMatrix: number[][]
): number[][] {
  const sanitized =
    sanitizeMatrix(matrix);

  const total =
    calculateMatrixMass(sanitized);

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    const safeFallback =
      sanitizeMatrix(fallbackMatrix);

    const fallbackTotal =
      calculateMatrixMass(safeFallback);

    if (
      !Number.isFinite(fallbackTotal) ||
      fallbackTotal <= 0
    ) {
      /*
       * Última proteção: distribuição totalmente
       * concentrada em 0–0.
       *
       * Este cenário indica erro estrutural anterior,
       * mas impede NaN e Infinity no restante
       * do sistema.
       */
      return fallbackMatrix.map(
        (row, rowIndex) =>
          row.map(
            (_, columnIndex) =>
              rowIndex === 0 &&
              columnIndex === 0
                ? 1
                : 0
          )
      );
    }

    return safeFallback.map(row =>
      row.map(value =>
        value / fallbackTotal
      )
    );
  }

  return sanitized.map(row =>
    row.map(value =>
      value / total
    )
  );
}

/* ==========================================
   LIMITES MATEMÁTICOS DO RHO
========================================== */

function constrainRho(
  rawRho: number,
  lambdaHome: number,
  lambdaAway: number
): number {
  /*
   * Para impedir fatores negativos na correção
   * Dixon-Coles dos placares:
   *
   * 0–0
   * 0–1
   * 1–0
   * 1–1
   *
   * os limites dependem dos lambdas.
   */

  const mathematicalMinimum =
    Math.max(
      -1 / lambdaHome,
      -1 / lambdaAway
    ) + RHO_EPSILON;

  const mathematicalMaximum =
    Math.min(
      1,
      1 / (lambdaHome * lambdaAway)
    ) - RHO_EPSILON;

  const lowerBound =
    Math.max(
      MIN_OPERATIONAL_RHO,
      mathematicalMinimum
    );

  const upperBound =
    Math.min(
      MAX_OPERATIONAL_RHO,
      mathematicalMaximum
    );

  /*
   * Caso os limites estejam inconsistentes,
   * rho neutro preserva a matriz independente.
   */
  if (
    !Number.isFinite(lowerBound) ||
    !Number.isFinite(upperBound) ||
    lowerBound > upperBound
  ) {
    return 0;
  }

  return clamp(
    safeNumber(rawRho, 0),
    lowerBound,
    upperBound
  );
}

/* ==========================================
   CÁLCULO DO RHO
========================================== */

function calculateRho(
  lambdaHome: number,
  lambdaAway: number
) {
  /*
   * Até a auditoria do rhoCalculator, não
   * reinserimos finalizações, pressão ou cartões.
   *
   * Esses sinais já podem ter influenciado
   * os lambdas e seriam potencialmente contados
   * novamente.
   */
  const rawBaseRho =
    calculateDynamicRhoAdvanced({
      lambdaHome,
      lambdaAway
    });

  const baseRho =
    safeNumber(rawBaseRho, 0);

  const learning =
    autoLearningEngine();

  const learningRhoShift =
    learning?.ready
      ? safeNumber(
          learning.rhoShift,
          0
        )
      : 0;

  const combinedRho =
    baseRho +
    learningRhoShift;

  const rho =
    constrainRho(
      combinedRho,
      lambdaHome,
      lambdaAway
    );

  return {
    baseRho,
    learningRhoShift,
    rho
  };
}

/* ==========================================
   EXTRAÇÃO DOS MERCADOS DE GOLS
========================================== */

function calculateGoalMarkets(
  matrix: number[][]
) {
  let over15 = 0;
  let over25 = 0;

  for (
    let homeGoals = 0;
    homeGoals < matrix.length;
    homeGoals++
  ) {
    const row =
      matrix[homeGoals] ?? [];

    for (
      let awayGoals = 0;
      awayGoals < row.length;
      awayGoals++
    ) {
      const probability =
        sanitizeProbability(
          row[awayGoals]
        );

      const totalGoals =
        homeGoals + awayGoals;

      if (totalGoals >= 2) {
        over15 += probability;
      }

      if (totalGoals >= 3) {
        over25 += probability;
      }
    }
  }

  const safeOver15 =
    sanitizeProbability(over15);

  const safeOver25 =
    sanitizeProbability(over25);

  return {
    over15: safeOver15,
    over25: safeOver25,

    under15:
      sanitizeProbability(
        1 - safeOver15
      ),

    under25:
      sanitizeProbability(
        1 - safeOver25
      )
  };
}

/* ==========================================
   GOALS MODEL 7.0
========================================== */

export function goalsModel(
  lambdaHome: number,
  lambdaAway: number,
  _homeStats?: GoalsModelStats,
  _awayStats?: GoalsModelStats
): GoalsModelResult {
  /*
   * Lambdas inválidos voltam para bases neutras.
   *
   * Normalmente essa proteção não deverá ser
   * acionada, pois o lambdaBuilder já valida
   * esses valores.
   */
  const lambdaH = clamp(
    safeNumber(lambdaHome, 1.32),
    MIN_LAMBDA,
    MAX_LAMBDA
  );

  const lambdaA = clamp(
    safeNumber(lambdaAway, 1.23),
    MIN_LAMBDA,
    MAX_LAMBDA
  );

  const maxGoals =
    calculateMaxGoals(
      lambdaH,
      lambdaA
    );

  /* ==========================================
     DISTRIBUIÇÕES POISSON
  ========================================== */

  const homeDistribution =
    poissonTable(
      lambdaH,
      maxGoals
    );

  const awayDistribution =
    poissonTable(
      lambdaA,
      maxGoals
    );

  const independentMatrix =
    buildIndependentMatrix(
      homeDistribution,
      awayDistribution,
      maxGoals
    );

  const independentMatrixMass =
    calculateMatrixMass(
      independentMatrix
    );

  /* ==========================================
     DIXON-COLES
  ========================================== */

  const {
    baseRho,
    learningRhoShift,
    rho
  } = calculateRho(
    lambdaH,
    lambdaA
  );

  const dixonColesMatrix =
    applyDixonColesMatrix(
      independentMatrix,
      lambdaH,
      lambdaA,
      rho
    );

  const sanitizedAdjustedMatrix =
    sanitizeMatrix(
      dixonColesMatrix
    );

  const adjustedMatrixMass =
    calculateMatrixMass(
      sanitizedAdjustedMatrix
    );

  const matrix =
    normalizeMatrix(
      sanitizedAdjustedMatrix,
      independentMatrix
    );

  /* ==========================================
     MERCADOS
  ========================================== */

  const {
    over15,
    over25,
    under15,
    under25
  } = calculateGoalMarkets(matrix);

  /* ==========================================
     RESULTADO
  ========================================== */

  return {
    matrix,

    over15,
    over25,

    under15,
    under25,

    meta: {
      lambdaHome: lambdaH,
      lambdaAway: lambdaA,
      totalLambda:
        lambdaH + lambdaA,

      maxGoals,

      baseRho,
      learningRhoShift,
      rho,

      independentMatrixMass,
      adjustedMatrixMass
    }
  };
}