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

  // transforma multiplicador em ajuste percentual pequeno
  const homeAdj = (homeAdv - 1) * 0.25;
  const formAdj = (form - 1) * 0.20;
  const intensityAdj = (intensity - 1) * 0.15;

  adjusted += homeAdj;
  adjusted += formAdj;
  adjusted += intensityAdj;

  /* ===========================
     🔒 LIMITES DE SEGURANÇA
  ============================ */

  // limite de variação total (não deixar contexto dominar)
  const maxShift = 0.12;

  const delta = adjusted - baseProb;

  if (delta > maxShift) adjusted = baseProb + maxShift;
  if (delta < -maxShift) adjusted = baseProb - maxShift;

  /* ===========================
     🎯 CLAMP FINAL
  ============================ */

  adjusted = Math.max(0.05, Math.min(adjusted, 0.95));

  return Number(adjusted.toFixed(4));
}