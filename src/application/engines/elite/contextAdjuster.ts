export function applyContextAdjustments(
  baseProb: number,
  context: {
    homeAdvantage?: number;
    form?: number;
    intensity?: number;
  } = {}
) {
  const safeBase = Number.isFinite(Number(baseProb))
    ? Number(baseProb)
    : 0.5;

  let adjusted = safeBase;

  const homeAdv = Number.isFinite(Number(context.homeAdvantage))
    ? Number(context.homeAdvantage)
    : 1;

  const form = Number.isFinite(Number(context.form))
    ? Number(context.form)
    : 1;

  const intensity = Number.isFinite(Number(context.intensity))
    ? Number(context.intensity)
    : 1;

  const homeAdj = (homeAdv - 1) * 0.25;
  const formAdj = (form - 1) * 0.20;
  const intensityAdj = (intensity - 1) * 0.15;

  const totalRaw = homeAdj + formAdj + intensityAdj;

  const decayFactor = Math.abs(totalRaw) > 0.08 ? 0.85 : 1;

  const totalAdjusted = totalRaw * decayFactor;

  adjusted += totalAdjusted;

  const maxShift = 0.12;

  const delta = adjusted - safeBase;

  if (delta > maxShift) adjusted = safeBase + maxShift;
  if (delta < -maxShift) adjusted = safeBase - maxShift;

  adjusted = Math.max(0.05, Math.min(adjusted, 0.95));

  return Number(adjusted.toFixed(4));
}