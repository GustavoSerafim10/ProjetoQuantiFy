export function calculateDynamicRhoAdvanced(params: {
  lambdaHome: number;
  lambdaAway: number;

  shotsPressure?: number;
  shotVolume?: number;

  cardsIntensity?: number;
}) {

  const {
    lambdaHome,
    lambdaAway,
    shotsPressure = 1,
    shotVolume = 20,
    cardsIntensity = 1
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
     🔥 2. PRESSÃO (SHOTS)
  ============================ */

  if (shotVolume >= 24 && shotsPressure >= 1.15) {
    rho += 0.02; // mais aberto
  }

  if (shotVolume <= 18) {
    rho -= 0.02; // mais travado
  }

  /* ===========================
     🔥 3. EQUILÍBRIO
  ============================ */

  if (diff > 1.5) {
    rho -= 0.02; // jogo controlado
  }

  if (diff < 0.5) {
    rho += 0.01; // jogo aberto
  }

  /* ===========================
     🔥 4. INTENSIDADE (CARDS)
  ============================ */

  if (cardsIntensity > 1.2) {
    rho -= 0.02; // jogo truncado
  }

  if (cardsIntensity < 0.8) {
    rho += 0.01; // jogo fluido
  }

  /* ===========================
     🔒 LIMITES
  ============================ */

  rho = Math.max(-0.15, Math.min(-0.02, rho));

  return rho;
}