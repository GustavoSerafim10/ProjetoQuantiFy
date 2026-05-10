export function applyContextAdjustments(
  baseProb: number,
  context: {
    homeAdvantage?: number;
    form?: number;
    intensity?: number;
  }
) {

  let adjusted = Number(baseProb ?? 0.5);

  const homeAdv = Number(context?.homeAdvantage ?? 1);
  const form = Number(context?.form ?? 1);
  const intensity = Number(context?.intensity ?? 1);

  /* ===========================
     🔧 AJUSTES SUAVES
  ============================ */

  // ajustes individuais
  const homeAdj = (homeAdv - 1) * 0.25;
  const formAdj = (form - 1) * 0.20;
  const intensityAdj = (intensity - 1) * 0.15;

  /* ===========================
     🧠 DECAY CONTEXTUAL
  ============================ */

  // reduz exagero quando múltiplos fatores
  // positivos aparecem juntos

  const totalRaw =
    homeAdj +
    formAdj +
    intensityAdj;

  // decay institucional
  const decayFactor =
    Math.abs(totalRaw) > 0.08
      ? 0.85
      : 1;

  adjusted += totalRaw * decayFactor;

  /* ===========================
     🔒 LIMITES DE SEGURANÇA
  ============================ */

  // contexto nunca domina o modelo
  const maxShift = 0.12;

  const delta = adjusted - baseProb;

  if (delta > maxShift)
    adjusted = baseProb + maxShift;

  if (delta < -maxShift)
    adjusted = baseProb - maxShift;

  /* ===========================
     🎯 CLAMP FINAL
  ============================ */

  adjusted = Math.max(
    0.05,
    Math.min(adjusted, 0.95)
  );

  return Number(adjusted.toFixed(4));
}