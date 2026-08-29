/*
 * `shotsPressure`, `shotVolume` e `cardsIntensity` existiam como
 * parâmetros aqui, mas o único chamador (calculateRho, em
 * goalsModel/rho.ts) nunca os passa — de propósito, para não contar
 * duas vezes o efeito de chutes/escanteios, que já entra no lambda
 * via contextEngine.ts antes de chegar aqui. Na prática isso deixava
 * metade das seções desta função sempre computando contra os mesmos
 * valores-padrão fixos (shotVolume=20, cardsIntensity=1), nunca
 * disparando — código morto que parecia reagir a dado real de jogo
 * sem nunca reagir. Removido 2026-08-29; só o que realmente influencia
 * `rho` hoje (ritmo via totalLambda, equilíbrio via diff) ficou.
 */
export function calculateDynamicRhoAdvanced(params: {
  lambdaHome: number;
  lambdaAway: number;
}) {

  const {
    lambdaHome,
    lambdaAway
  } = params;

  const totalLambda = lambdaHome + lambdaAway;
  const diff = Math.abs(lambdaHome - lambdaAway);

  let rho = -0.08;

  /* ===========================
     🔥 1. RITMO DO JOGO (λ)
  ============================ */

  if (totalLambda > 3.2) {
    rho = -0.04; // jogo aberto
  }
  else if (totalLambda < 2.2) {
    rho = -0.12; // jogo travado
  }

  /* ===========================
     🔥 2. EQUILÍBRIO
  ============================ */

  if (diff > 1.5) {
    rho -= 0.02; // jogo controlado
  }

  if (diff < 0.5) {
    rho += 0.01; // jogo aberto
  }

  /* ===========================
     🔒 LIMITES
  ============================ */

  rho = Math.max(-0.15, Math.min(-0.02, rho));

  return rho;
}
