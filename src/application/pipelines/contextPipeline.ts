import {
  normalizeStats
} from "../../domain/utils/dataNormalizer";

/* ==========================================
   CONTEXT PIPELINE — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - normalizar as estatísticas recebidas;
 * - construir sinais contextuais da partida;
 * - identificar ritmo e estrutura geral;
 * - produzir alertas contextuais;
 * - não calcular probabilidades;
 * - não produzir decisões;
 * - não substituir os lambdas oficiais.
 */

/* ==========================================
   CONSTANTES
========================================== */

/*
 * Centro da curva de expectativa.
 *
 * Um total contextual próximo de 2.50 gols
 * produz score próximo de 0.50.
 */
const GOAL_EXPECTATION_CENTER =
  2.50;

/*
 * Controla a inclinação da curva.
 *
 * Quanto maior, mais rapidamente o score se
 * aproxima dos extremos.
 */
const GOAL_EXPECTATION_SLOPE =
  1.35;

/*
 * Proteção para que o score não chegue
 * exatamente a 0 ou 1.
 */
const MIN_GOAL_SCORE =
  0.02;

const MAX_GOAL_SCORE =
  0.98;

/* ==========================================
   HELPERS
========================================== */
function firstValidNumber(
  values: unknown[],
  fallback: number
): number {
  for (const value of values) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      typeof value === "boolean"
    ) {
      continue;
    }

    const parsed =
      Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function clamp(
  value: number,
  minimum = 0,
  maximum = 1
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
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

/* ==========================================
   SCORE CONTEXTUAL DE GOLS
========================================== */

/*
 * Transforma uma expectativa contextual total
 * em score entre aproximadamente 0.02 e 0.98.
 *
 * Utilizamos uma curva logística para evitar:
 *
 * - saturação linear em 1;
 * - perda de diferenciação entre jogos ofensivos;
 * - saltos bruscos causados por clamp.
 *
 * Referências aproximadas:
 *
 * 1.50 gols → 0.21
 * 2.00 gols → 0.34
 * 2.50 gols → 0.50
 * 3.00 gols → 0.66
 * 3.50 gols → 0.79
 * 4.00 gols → 0.88
 * 4.50 gols → 0.94
 */
function calculateContextGoalScore(
  expectedGoalEnvironment: number
): number {
  if (
    !Number.isFinite(
      expectedGoalEnvironment
    )
  ) {
    return 0.50;
  }

  const logisticScore =
    1 /
    (
      1 +
      Math.exp(
        -GOAL_EXPECTATION_SLOPE *
        (
          expectedGoalEnvironment -
          GOAL_EXPECTATION_CENTER
        )
      )
    );

  return clamp(
    logisticScore,
    MIN_GOAL_SCORE,
    MAX_GOAL_SCORE
  );
}

/* ==========================================
   PIPELINE
========================================== */

export function contextPipeline(
  input: any
) {
  const homeStats =
    normalizeStats(
      input?.homeStats ?? {}
    );

  const awayStats =
    normalizeStats(
      input?.awayStats ?? {}
    );

  /*
   * Contrato esperado do dataNormalizer:
   *
   * goalsPerGame
   * avgGoals
   * goalsConcededPerGame
   * avgGoalsAgainst
   *
   * firstValidNumber evita que valores inválidos
   * sejam transformados silenciosamente em zero.
   */

  const homeGoals =
    clamp(
      firstValidNumber(
        [
          homeStats.goalsPerGame,
          homeStats.avgGoals
        ],
        1.20
      ),
      0,
      6
    );

  const awayGoals =
    clamp(
      firstValidNumber(
        [
          awayStats.goalsPerGame,
          awayStats.avgGoals
        ],
        1.10
      ),
      0,
      6
    );

  const homeConcede =
    clamp(
      firstValidNumber(
        [
          homeStats.goalsConcededPerGame,
          homeStats.avgGoalsAgainst
        ],
        1.20
      ),
      0,
      6
    );

  const awayConcede =
    clamp(
      firstValidNumber(
        [
          awayStats.goalsConcededPerGame,
          awayStats.avgGoalsAgainst
        ],
        1.20
      ),
      0,
      6
    );

  /* ==========================================
     CONTEXTO DE GOLS
  ========================================== */

  const totalAttack =
    homeGoals +
    awayGoals;

  const totalConcede =
    homeConcede +
    awayConcede;

  /*
   * Este valor permanece na unidade aproximada
   * "gols esperados no ambiente da partida".
   *
   * Não é lambda e não é probabilidade.
   */
  const expectedGoalEnvironment =
    totalAttack *
      0.60 +
    totalConcede *
      0.40;

  /*
   * Curva logística:
   *
   * evita que qualquer expectativa acima de 4
   * seja simplesmente convertida em score 1.
   */
  const goalExpectationScore =
    roundNumber(
      calculateContextGoalScore(
        expectedGoalEnvironment
      )
    );

  const paceLevel =
    goalExpectationScore >= 0.68
      ? "high"
      : goalExpectationScore >= 0.50
        ? "medium"
        : "low";

  /* ==========================================
     ESTRUTURA DA PARTIDA
  ========================================== */

  /*
   * Proxy contextual de diferença estrutural.
   *
   * Ainda não representa diferença oficial
   * entre lambdaHome e lambdaAway.
   */
  const contextualHomeExpectation =
    (
      homeGoals +
      awayConcede
    ) / 2;

  const contextualAwayExpectation =
    (
      awayGoals +
      homeConcede
    ) / 2;

  const contextualExpectationDiff =
    Math.abs(
      contextualHomeExpectation -
      contextualAwayExpectation
    );

  const gameType =
    contextualExpectationDiff >= 1.20
      ? "dominant"
      : goalExpectationScore >= 0.62
        ? "open"
        : "balanced";

  const minAttack =
    Math.min(
      homeGoals,
      awayGoals
    );

  /*
   * Alerta contextual.
   *
   * Não bloqueia BTTS diretamente.
   */
  const isBadBTTSGame =
    totalAttack < 2.0 ||
    minAttack < 0.75;

  const marketContext = {
    isBadBTTSGame,

    paceLevel,
    gameType,

    /*
     * Mantido por compatibilidade temporária.
     *
     * A auditoria do modelPipeline definirá qual
     * score será a fonte oficial do sistema.
     */
    goalExpectationScore,

    contextualExpectationDiff:
      roundNumber(
        contextualExpectationDiff
      ),

    /*
     * Alias temporário para não quebrar módulos
     * que ainda acessam marketContext.lambdaDiff.
     *
     * Este valor não é diferença real de lambdas.
     */
    lambdaDiff:
      roundNumber(
        contextualExpectationDiff
      ),

    attackProfile: {
      homeGoals:
        roundNumber(
          homeGoals
        ),

      awayGoals:
        roundNumber(
          awayGoals
        ),

      totalAttack:
        roundNumber(
          totalAttack
        ),

      minAttack:
        roundNumber(
          minAttack
        )
    },

    defensiveProfile: {
      homeConcede:
        roundNumber(
          homeConcede
        ),

      awayConcede:
        roundNumber(
          awayConcede
        ),

      totalConcede:
        roundNumber(
          totalConcede
        )
    },

    weights: {}
  };

  return {
    ...input,

    homeStats,
    awayStats,

    /*
     * Mantido diretamente por compatibilidade
     * com os pipelines consumidores.
     */
    goalExpectationScore,

    marketContext,

    debug: {
      ...(input?.debug ?? {}),

      contextPipeline: {
        homeGoals:
          roundNumber(
            homeGoals
          ),

        awayGoals:
          roundNumber(
            awayGoals
          ),

        homeConcede:
          roundNumber(
            homeConcede
          ),

        awayConcede:
          roundNumber(
            awayConcede
          ),

        totalAttack:
          roundNumber(
            totalAttack
          ),

        totalConcede:
          roundNumber(
            totalConcede
          ),

        expectedGoalEnvironment:
          roundNumber(
            expectedGoalEnvironment
          ),

        goalExpectationScore,

        paceLevel,

        contextualHomeExpectation:
          roundNumber(
            contextualHomeExpectation
          ),

        contextualAwayExpectation:
          roundNumber(
            contextualAwayExpectation
          ),

        contextualExpectationDiff:
          roundNumber(
            contextualExpectationDiff
          ),

        gameType,

        minAttack:
          roundNumber(
            minAttack
          ),

        isBadBTTSGame,

        scorePolicy: {
          center:
            GOAL_EXPECTATION_CENTER,

          slope:
            GOAL_EXPECTATION_SLOPE,

          minimum:
            MIN_GOAL_SCORE,

          maximum:
            MAX_GOAL_SCORE
        }
      }
    }
  };
}