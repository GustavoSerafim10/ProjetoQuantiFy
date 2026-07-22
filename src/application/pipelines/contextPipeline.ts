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
 * - calcular somente expectativa contextual;
 * - não calcular probabilidades;
 * - não produzir decisões;
 * - não substituir os lambdas oficiais;
 * - não substituir o goalExpectationScore oficial.
 *
 * Autoridades:
 *
 * goalExpectationScore
 * → produzido pelo modelPipeline a partir
 *   das lambdas oficiais.
 *
 * contextualGoalExpectationScore
 * → produzido neste arquivo a partir do
 *   ambiente estatístico da partida.
 */

/* ==========================================
   CONTRATOS
========================================== */

interface ContextPipelineInput {
  homeStats?: unknown;
  awayStats?: unknown;

  /*
   * Pode existir caso este pipeline seja chamado
   * depois do modelPipeline em algum fluxo futuro.
   *
   * Este arquivo nunca sobrescreve esse valor.
   */
  goalExpectationScore?: unknown;

  /*
   * Score produzido exclusivamente pelo
   * contextPipeline.
   */
  contextualGoalExpectationScore?: unknown;

  /*
   * Contexto utilizado pelos pipelines
   * posteriores.
   */
  marketContext?: unknown;

  /*
   * Mantido por compatibilidade com
   * eliteAnalyzer e demais módulos que
   * ainda consultam context.markets.
   */
  markets?: unknown;

  debug?: unknown;

  [key: string]: unknown;
}

interface ObjectRecord {
  [key: string]: unknown;
}

/* ==========================================
   CONSTANTES
========================================== */

/*
 * Centro da curva contextual.
 *
 * Um ambiente próximo de 2.50 gols produz
 * score contextual próximo de 0.50.
 */
const GOAL_EXPECTATION_CENTER =
  2.50;

/*
 * Controla a inclinação da curva logística.
 */
const GOAL_EXPECTATION_SLOPE =
  1.35;

/*
 * O score contextual não chega exatamente
 * aos extremos 0 e 1.
 */
const MIN_CONTEXTUAL_GOAL_SCORE =
  0.02;

const MAX_CONTEXTUAL_GOAL_SCORE =
  0.98;

/* ==========================================
   HELPERS DE OBJETO
========================================== */

function isObjectRecord(
  value: unknown
): value is ObjectRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/* ==========================================
   HELPERS NUMÉRICOS
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

  const parsed =
    Number(
      String(value)
        .replace(",", ".")
        .trim()
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function firstValidNumber(
  values: unknown[],
  fallback: number
): number {
  for (
    const value of values
  ) {
    const parsed =
      parseFiniteNumber(value);

    if (
      parsed !== null
    ) {
      return parsed;
    }
  }

  return fallback;
}

function optionalScore(
  value: unknown
): number | null {
  const parsed =
    parseFiniteNumber(value);

  if (
    parsed === null
  ) {
    return null;
  }

  return clamp(
    parsed,
    0,
    1
  );
}

function clamp(
  value: number,
  minimum = 0,
  maximum = 1
): number {
  if (
    !Number.isFinite(value)
  ) {
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
  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}

/* ==========================================
   SCORE CONTEXTUAL DE GOLS
========================================== */

/*
 * Transforma o ambiente contextual de gols
 * em um score entre aproximadamente 0.02 e 0.98.
 *
 * Este score:
 *
 * - não é probabilidade;
 * - não é lambda;
 * - não substitui o score oficial do modelo;
 * - não deve alterar diretamente mercados.
 */
function calculateContextualGoalExpectationScore(
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
    MIN_CONTEXTUAL_GOAL_SCORE,
    MAX_CONTEXTUAL_GOAL_SCORE
  );
}

/* ==========================================
   PIPELINE
========================================== */

export function contextPipeline(
  input: ContextPipelineInput
) {
  const safeInput =
    isObjectRecord(input)
      ? input
      : {};

  const homeStats =
    normalizeStats(
      isObjectRecord(
        safeInput.homeStats
      )
        ? safeInput.homeStats
        : {}
    );

  const awayStats =
    normalizeStats(
      isObjectRecord(
        safeInput.awayStats
      )
        ? safeInput.awayStats
        : {}
    );

  /*
   * Score oficial já existente.
   *
   * Normalmente será null neste estágio, pois o
   * modelPipeline costuma ser executado depois.
   *
   * Mesmo assim, nunca será sobrescrito aqui.
   */
  const officialGoalExpectationScore =
    optionalScore(
      safeInput.goalExpectationScore
    );

  /* ========================================
     TAXAS CONTEXTUAIS
  ======================================== */

const homeGoals =
  clamp(
    firstValidNumber(
      [
        homeStats.goalsPerGame,
        homeStats.goalsForPerGame,
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
        awayStats.goalsForPerGame,
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
        homeStats.goalsAgainstPerGame,
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
        awayStats.goalsAgainstPerGame,
        awayStats.avgGoalsAgainst
      ],
      1.20
    ),
    0,
    6
  );

  /* ========================================
     CONTEXTO DE GOLS
  ======================================== */

  const totalAttack =
    homeGoals +
    awayGoals;

  const totalConcede =
    homeConcede +
    awayConcede;

  /*
   * Unidade aproximada:
   *
   * ambiente estatístico esperado de gols.
   *
   * Não deve ser confundido com totalLambda.
   */
  const expectedGoalEnvironment =
    totalAttack *
      0.60 +
    totalConcede *
      0.40;

  const contextualGoalExpectationScore =
    roundNumber(
      calculateContextualGoalExpectationScore(
        expectedGoalEnvironment
      )
    );

  const paceLevel =
    contextualGoalExpectationScore >= 0.68
      ? "high"
      : contextualGoalExpectationScore >= 0.50
        ? "medium"
        : "low";

  /* ========================================
     ESTRUTURA CONTEXTUAL DA PARTIDA
  ======================================== */

  /*
   * Não representa lambda oficial.
   */
  const contextualHomeExpectation =
    (
      homeGoals +
      awayConcede
    ) /
    2;

  const contextualAwayExpectation =
    (
      awayGoals +
      homeConcede
    ) /
    2;

  const contextualExpectationDiff =
    Math.abs(
      contextualHomeExpectation -
      contextualAwayExpectation
    );

  const gameType =
    contextualExpectationDiff >= 1.20
      ? "dominant"
      : contextualGoalExpectationScore >= 0.62
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

  /* ========================================
     DIVERGÊNCIA ENTRE SCORES
  ======================================== */

  /*
   * Só pode ser calculada caso um score oficial
   * já exista na entrada.
   *
   * No fluxo context → model, normalmente ficará
   * null até o modelPipeline produzir o oficial.
   */
  const goalExpectationDivergence =
    officialGoalExpectationScore !== null
      ? roundNumber(
          Math.abs(
            officialGoalExpectationScore -
            contextualGoalExpectationScore
          )
        )
      : null;

  const previousMarketContext =
    isObjectRecord(
      safeInput.marketContext
    )
      ? safeInput.marketContext
      : {};

  const marketContext = {
    ...previousMarketContext,

    isBadBTTSGame,

    paceLevel,
    gameType,

    /*
     * Nome oficial do valor produzido neste
     * contextPipeline.
     */
    contextualGoalExpectationScore,

    /*
     * O score estrutural só é incluído quando já
     * existir. Este arquivo não o cria.
     */
    officialGoalExpectationScore,

    goalExpectationDivergence,

    /*
     * Alias legado temporário.
     *
     * Alguns módulos antigos ainda podem acessar:
     *
     * marketContext.goalExpectationScore
     *
     * Dentro de marketContext, esse alias continua
     * representando o score contextual.
     *
     * Remover após migrar todos os consumidores para:
     *
     * marketContext.contextualGoalExpectationScore
     */
    goalExpectationScore:
      contextualGoalExpectationScore,

    contextualExpectationDiff:
      roundNumber(
        contextualExpectationDiff
      ),

    /*
     * Alias legado.
     *
     * Não representa diferença real entre
     * lambdaHome e lambdaAway.
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

    weights: {
      attack:
        0.60,

      defense:
        0.40
    }
  };

  const previousDebug =
    isObjectRecord(
      safeInput.debug
    )
      ? safeInput.debug
      : {};

  /* ========================================
     RESULTADO
  ======================================== */

  return {
    ...safeInput,

    homeStats,
    awayStats,

    /*
     * Não publicamos:
     *
     * goalExpectationScore:
     * contextualGoalExpectationScore
     *
     * Isso impediria a separação entre autoridade
     * estrutural e contexto.
     */
    contextualGoalExpectationScore,

    /*
     * Como safeInput foi espalhado acima, um
     * goalExpectationScore oficial preexistente
     * permanece intacto automaticamente.
     */

    marketContext,

    debug: {
      ...previousDebug,

      contextPipeline: {
        scoreAuthority: {
          officialField:
            "goalExpectationScore",

          contextualField:
            "contextualGoalExpectationScore",

          officialAvailable:
            officialGoalExpectationScore !== null,

          officialGoalExpectationScore,

          contextualGoalExpectationScore,

          divergence:
            goalExpectationDivergence
        },

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

        /*
         * Nome correto do score criado aqui.
         */
        contextualGoalExpectationScore,

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
            MIN_CONTEXTUAL_GOAL_SCORE,

          maximum:
            MAX_CONTEXTUAL_GOAL_SCORE,

          source:
            "NORMALIZED_TEAM_STATISTICS",

          authority:
            "CONTEXTUAL_ONLY"
        }
      }
    }
  };
}