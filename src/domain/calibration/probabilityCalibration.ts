export function calibrateProbability(p: number): number {
  if (isNaN(p)) return 0.5;

  // Segurança contra valores fora do intervalo
  const raw = Math.max(0.01, Math.min(0.99, p));

  let calibrated = raw;

  /**
   * Calibração defensiva:
   * - Probabilidades muito altas são comprimidas com mais força.
   * - Isso evita EV inflado em mercados "óbvios" como Over 1.5.
   * - Não zera valor real, apenas reduz overconfidence.
   */
  if (raw >= 0.90) {
    calibrated = 0.84 + (raw - 0.90) * 0.35;
  } 
  else if (raw >= 0.85) {
    calibrated = 0.80 + (raw - 0.85) * 0.80;
  } 
  else if (raw >= 0.80) {
    calibrated = 0.76 + (raw - 0.80) * 0.80;
  } 
  else if (raw >= 0.70) {
    calibrated = 0.68 + (raw - 0.70) * 0.80;
  }

  /**
   * Probabilidades muito baixas também são suavizadas,
   * evitando extremos irreais.
   */
  else if (raw <= 0.10) {
    calibrated = 0.12 + raw * 0.50;
  } 
  else if (raw <= 0.20) {
    calibrated = 0.18 + (raw - 0.20) * 0.70;
  }

  return Math.max(0.05, Math.min(0.92, calibrated));
}