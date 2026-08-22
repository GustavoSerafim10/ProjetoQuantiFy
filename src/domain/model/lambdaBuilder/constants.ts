/* ==========================================
   PARÂMETROS ESTRUTURAIS
========================================== */

/*
 * Elasticidades inferiores a 1 comprimem
 * diferenças extremas entre as equipes.
 *
 * Devem ser calibradas futuramente com backtest,
 * Log Loss, Brier Score, calibração por faixa de
 * probabilidade — MAS NÃO com o backtest sintético
 * deste repo (2026-08-22, investigado a pedido do
 * usuário após um caso real onde o modelo deu só 33%
 * pro mandante contra ~48% implícito na odd).
 *
 * Motivo: generateHistoricalMatches() (matchGenerator.ts)
 * usa este MESMO buildLambda() — com estas mesmas
 * constantes — pra gerar o "resultado verdadeiro" de cada
 * partida sintética, e modelPipeline() chama o mesmo
 * buildLambda() de novo, com os mesmos stats, pra prever.
 * Ou seja, qualquer valor testado aqui "acerta perfeito"
 * contra esse backtest, porque o gabarito é definido pela
 * própria fórmula sendo testada — não há sinal real,
 * só circularidade. O ROI medido no backtest sintético
 * mede apenas o viés proposital inserido na geração das
 * ODDS (distortLambda, favorite bias, over popularity
 * bias) — válido pra calibrar thresholds de decisão em
 * marketPolicies.ts, mas não a fórmula de probabilidade
 * em si.
 *
 * Calibrar isso de verdade exige partidas REAIS já
 * encerradas: os stats de entrada de cada time como
 * estavam ANTES do jogo + o placar real que saiu depois,
 * em volume suficiente (dezenas de partidas, não ~10) pra
 * ter poder estatístico sobre 3 parâmetros interagindo.
 * Sem isso, os valores abaixo continuam sendo o melhor
 * palpite disponível, não algo validado.
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
