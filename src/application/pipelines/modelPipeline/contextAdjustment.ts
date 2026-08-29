import {
  clamp,
  safeNumber
} from "./numericHelpers";

import {
  isObjectRecord
} from "./objectHelpers";

/* ==========================================
   AJUSTE CONTEXTUAL
========================================== */

export function applyBoundedContextAdjustment(
  baseLambdaHome: number,
  baseLambdaAway: number,
  contextAdjusted: unknown
) {
  /*
   * Alinhado com o clamp interno que o proprio contextEngine.ts ja
   * aplica (maxHomeShift/maxAwayShift = 18%). Ate 2026-08-29 esta
   * faixa era +-8%, mais apertada que o +-18% do contextEngine, sem
   * nenhum comentario explicando por que -- o resultado, medido com
   * amostra realista de jogos, era 81% das analises batendo neste
   * clamp (72% no teto), o que na pratica anulava a variacao que o
   * contextEngine calcula e o transformava num ajuste quase fixo de
   * +8%. Alargado para bater com o +-18% do contextEngine, para que
   * este clamp volte a ser uma trava de seguranca, nao a restricao
   * que sempre decide o resultado.
   */
  const MIN_CONTEXT_FACTOR =
    0.82;

  const MAX_CONTEXT_FACTOR =
    1.18;

  const adjusted =
    isObjectRecord(
      contextAdjusted
    )
      ? contextAdjusted
      : {};

  const proposedHome =
    safeNumber(
      adjusted.lambdaHome,
      baseLambdaHome
    );

  const proposedAway =
    safeNumber(
      adjusted.lambdaAway,
      baseLambdaAway
    );

  const lambdaHome =
    clamp(
      proposedHome,
      baseLambdaHome *
        MIN_CONTEXT_FACTOR,
      baseLambdaHome *
        MAX_CONTEXT_FACTOR
    );

  const lambdaAway =
    clamp(
      proposedAway,
      baseLambdaAway *
        MIN_CONTEXT_FACTOR,
      baseLambdaAway *
        MAX_CONTEXT_FACTOR
    );

  return {
    lambdaHome,
    lambdaAway,

    minContextFactor:
      MIN_CONTEXT_FACTOR,

    maxContextFactor:
      MAX_CONTEXT_FACTOR
  };
}
