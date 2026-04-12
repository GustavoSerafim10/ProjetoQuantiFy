export function applyContextAdjustments(
  baseProb: number,
  context: {
    homeAdvantage?: number;
    form?: number;
    intensity?: number;
  }
) {

  let adjusted = baseProb;

  if (context.homeAdvantage) {
    adjusted *= context.homeAdvantage;
  }

  if (context.form) {
    adjusted *= context.form;
  }

  if (context.intensity) {
    adjusted *= context.intensity;
  }

  // clamp
  if (adjusted > 0.95) adjusted = 0.95;
  if (adjusted < 0.05) adjusted = 0.05;

  return adjusted;
}