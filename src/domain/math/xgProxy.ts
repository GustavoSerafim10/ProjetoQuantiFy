/* ==========================================
   XG PROXY — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - produzir uma estimativa ofensiva auxiliar;
 * - utilizar volume e precisão das finalizações;
 * - informar quando os dados são insuficientes;
 * - nunca substituir um modelo profissional de xG.
 *
 * Este módulo não:
 *
 * - calcula o lambda oficial;
 * - aplica força de liga;
 * - aplica vantagem de mando;
 * - aplica shrinkage;
 * - inventa xG quando não existem dados.
 */

/* ==========================================
   CONTRATOS
========================================== */

export interface XGProxyResult {
  valid: boolean;

  xg: number | null;

  diagnostics: {
    shots: number | null;

    shotsOnTarget: number | null;

    shotsOffTarget: number | null;

    accuracyComponent: number;

    volumeComponent: number;

    rawXG: number;

    saturatedXG: number;

    shotAccuracy: number | null;

    reason: string | null;
  };
}

/* ==========================================
   POLÍTICA
========================================== */

/*
 * Peso aproximado de uma finalização no alvo.
 *
 * Não representa xG real por chute; é apenas um
 * proxy estrutural para complementar gols marcados.
 */
const SHOT_ON_TARGET_WEIGHT =
  0.24;

/*
 * Peso aplicado às demais finalizações.
 *
 * Como não foram no alvo, recebem peso menor.
 */
const OFF_TARGET_SHOT_WEIGHT =
  0.035;

/*
 * Quantidade mínima de chutes para considerar que
 * há cobertura ofensiva minimamente utilizável.
 */
const MINIMUM_SHOTS =
  1;

/*
 * Limites defensivos.
 */
const MAX_SHOTS =
  40;

const MAX_SHOTS_ON_TARGET =
  20;

const SATURATION_START =
  2.80;

const SATURATION_FACTOR =
  0.35;

const MAX_PROXY_XG =
  3.60;

/* ==========================================
   FUNÇÃO DETALHADA
========================================== */

export function calculateXGProxyDetailed(
  shotsOnTargetInput: unknown,
  shotsInput: unknown
): XGProxyResult {
  const parsedShots =
    parseNonNegativeNumber(
      shotsInput
    );

  const parsedShotsOnTarget =
    parseNonNegativeNumber(
      shotsOnTargetInput
    );

  /*
   * Sem dados válidos, não inventamos um proxy.
   */
  if (
    parsedShots === null ||
    parsedShotsOnTarget === null
  ) {
    return createInvalidResult(
      parsedShots,
      parsedShotsOnTarget,
      "MISSING_OR_INVALID_SHOT_DATA"
    );
  }

  /*
   * Zero chutes pode representar uma partida real,
   * mas não fornece sinal ofensivo suficiente para
   * participar da composição estrutural do ataque.
   */
  if (
    parsedShots <
    MINIMUM_SHOTS
  ) {
    return createInvalidResult(
      parsedShots,
      parsedShotsOnTarget,
      "INSUFFICIENT_SHOT_VOLUME"
    );
  }

  const safeShots =
    clamp(
      parsedShots,
      0,
      MAX_SHOTS
    );

  /*
   * Finalizações no alvo nunca podem superar o
   * total de finalizações.
   */
  const safeShotsOnTarget =
    clamp(
      Math.min(
        parsedShotsOnTarget,
        safeShots
      ),
      0,
      MAX_SHOTS_ON_TARGET
    );

  const shotsOffTarget =
    Math.max(
      safeShots -
      safeShotsOnTarget,
      0
    );

  /*
   * Componente principal:
   * finalizações no alvo.
   */
  const accuracyComponent =
    safeShotsOnTarget *
    SHOT_ON_TARGET_WEIGHT;

  /*
   * Volume complementar:
   * considera somente finalizações que não foram
   * contabilizadas como chutes no alvo.
   */
  const volumeComponent =
    shotsOffTarget *
    OFF_TARGET_SHOT_WEIGHT;

  const rawXG =
    accuracyComponent +
    volumeComponent;

  /*
   * Saturação gradual.
   *
   * Em volumes ofensivos muito altos, cada unidade
   * adicional carrega menos informação marginal.
   */
  const saturatedXG =
    rawXG >
    SATURATION_START
      ? SATURATION_START +
        (
          rawXG -
          SATURATION_START
        ) *
        SATURATION_FACTOR
      : rawXG;

  const xg =
    clamp(
      saturatedXG,
      0,
      MAX_PROXY_XG
    );

  const shotAccuracy =
    safeShots > 0
      ? safeShotsOnTarget /
        safeShots
      : null;

  return {
    valid:
      true,

    xg:
      roundNumber(
        xg
      ),

    diagnostics: {
      shots:
        safeShots,

      shotsOnTarget:
        safeShotsOnTarget,

      shotsOffTarget:
        shotsOffTarget,

      accuracyComponent:
        roundNumber(
          accuracyComponent
        ),

      volumeComponent:
        roundNumber(
          volumeComponent
        ),

      rawXG:
        roundNumber(
          rawXG
        ),

      saturatedXG:
        roundNumber(
          saturatedXG
        ),

      shotAccuracy:
        shotAccuracy === null
          ? null
          : roundNumber(
              shotAccuracy
            ),

      reason:
        null
    }
  };
}

/* ==========================================
   FUNÇÃO DE COMPATIBILIDADE
========================================== */

/*
 * Mantém compatibilidade com chamadas antigas.
 *
 * Atenção:
 * quando os dados forem inválidos, retorna 0.
 * O lambdaBuilder deverá consultar a versão
 * detalhada para decidir se utiliza ou não o xG.
 */
export function calculateXGProxy(
  shotsOnTargetInput: unknown,
  shotsInput: unknown
): number {
  const result =
    calculateXGProxyDetailed(
      shotsOnTargetInput,
      shotsInput
    );

  return result.xg ?? 0;
}

/* ==========================================
   RESULTADO INVÁLIDO
========================================== */

function createInvalidResult(
  shots: number | null,
  shotsOnTarget: number | null,
  reason: string
): XGProxyResult {
  return {
    valid:
      false,

    xg:
      null,

    diagnostics: {
      shots,

      shotsOnTarget,

      shotsOffTarget:
        null,

      accuracyComponent:
        0,

      volumeComponent:
        0,

      rawXG:
        0,

      saturatedXG:
        0,

      shotAccuracy:
        null,

      reason
    }
  };
}

/* ==========================================
   PARSERS
========================================== */

function parseNonNegativeNumber(
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
    Number(value);

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

/* ==========================================
   HELPERS
========================================== */

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (
    !Number.isFinite(
      value
    )
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
    !Number.isFinite(
      value
    )
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