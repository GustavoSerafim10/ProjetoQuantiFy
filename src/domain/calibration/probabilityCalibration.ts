export function calibrateProbability(p: number): number {
  if (isNaN(p)) return 0.5;

  let calibrated = p;

  // Compressão leve apenas em extremos reais
  if (p > 0.90) {
    calibrated = p * 0.94;
  }
  else if (p > 0.80) {
    calibrated = p * 0.97;
  }
  else if (p < 0.10) {
    calibrated = p * 1.06;
  }

  return Math.max(0.05, Math.min(0.95, calibrated));
}