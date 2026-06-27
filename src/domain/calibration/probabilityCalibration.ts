export function calibrateProbability(p: number): number {
  if (!Number.isFinite(Number(p))) return 0.5;

  const raw = Math.max(0.01, Math.min(0.99, Number(p)));

  let calibrated = raw;

  /*
    Calibração leve:
    - Evita overconfidence absurda.
    - Não destrói probabilidades boas.
    - Mantém EV real vivo para ser julgado depois pelo value/risk/decision.
  */

  if (raw >= 0.95) {
    calibrated = 0.92 + (raw - 0.95) * 0.35;
  } 
  else if (raw >= 0.90) {
    calibrated = 0.88 + (raw - 0.90) * 0.65;
  } 
  else if (raw >= 0.85) {
    calibrated = 0.84 + (raw - 0.85) * 0.80;
  } 
  else if (raw >= 0.80) {
    calibrated = 0.79 + (raw - 0.80) * 0.90;
  } 
  else if (raw >= 0.70) {
    calibrated = 0.695 + (raw - 0.70) * 0.95;
  }

  else if (raw <= 0.05) {
    calibrated = 0.06 + raw * 0.50;
  } 
  else if (raw <= 0.15) {
    calibrated = 0.13 + (raw - 0.15) * 0.80;
  }

  return Math.max(0.03, Math.min(0.95, calibrated));
}