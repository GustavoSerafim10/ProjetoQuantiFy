/* ==========================================
   PARÂMETROS ESTRUTURAIS
========================================== */

/*
 * Elasticidades inferiores a 1 comprimem
 * diferenças extremas entre as equipes.
 *
 * Devem ser calibradas futuramente com:
 *
 * - backtest;
 * - Log Loss;
 * - Brier Score;
 * - calibração por faixa de probabilidade.
 */
export const ATTACK_ELASTICITY =
  0.82;

export const DEFENSE_ELASTICITY =
  0.78;

/*
 * Quantidade equivalente de partidas usadas
 * como prior no shrinkage.
 */
export const SHRINK_FACTOR =
  10;

/*
 * Limites individuais de segurança.
 */
export const MIN_LAMBDA =
  0.20;

export const MAX_LAMBDA =
  3.20;

/*
 * Limite máximo do total.
 *
 * Apenas reduz jogos excessivamente inflados.
 * Não eleva jogos de baixa expectativa.
 */
export const MAX_TOTAL_LAMBDA =
  5.0;

/*
 * Composição ofensiva.
 *
 * O xG proxy possui peso menor por não conhecer:
 *
 * - posição da finalização;
 * - ângulo;
 * - qualidade da chance;
 * - tipo de assistência;
 * - pressão defensiva.
 */
export const GOALS_WEIGHT =
  0.58;

export const XG_PROXY_WEIGHT =
  0.22;

export const SHOT_QUALITY_WEIGHT =
  0.20;

export const DOMINANCE_ELASTICITY =
  0.18;

export const RECENT_FORM_MAX_ADJUSTMENT =
  0.12;

export const VARIANCE_MAX_ADJUSTMENT =
  0.08;

export const SHOT_QUALITY_MAX_ADJUSTMENT =
  0.14;

export const MIN_ADAPTIVE_SHRINK =
  4;

export const MAX_ADAPTIVE_SHRINK =
  18;

/*
 * Referência mínima para considerar uma amostra
 * razoavelmente confiável.
 */
export const MIN_RELIABLE_MATCHES =
  8;
