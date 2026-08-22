export function kellyCriterion(
  probability: number,
  odd: number
): number {
  const p = Number(probability);
  const o = Number(odd);

  if (
    !Number.isFinite(p) ||
    !Number.isFinite(o) ||
    p <= 0 ||
    p >= 1 ||
    o <= 1
  ) {
    return 0;
  }

  const b = o - 1;
  const q = 1 - p;

  const kelly = ((b * p) - q) / b;

  return Number(Math.max(kelly, 0).toFixed(4));
}

export function halfKelly(
  probability: number,
  odd: number
): number {
  return Number((kellyCriterion(probability, odd) * 0.5).toFixed(4));
}

export function quarterKelly(
  probability: number,
  odd: number
): number {
  return Number((kellyCriterion(probability, odd) * 0.25).toFixed(4));
}

/* ===============================
   STAKE PRO ENGINE
=============================== */

interface StakeCandidate {
  kelly?: number;
  ev?: number;
  probability?: number;
  risk?: number;
  riskScore?: number;
  confidence?: number;
}

export function calculateStakePro(
  m: StakeCandidate,
  options: { stakeCap?: number } = {}
): number {
  const baseKelly = Math.max(Number(m.kelly ?? 0), 0);

  if (!Number.isFinite(baseKelly) || baseKelly <= 0) return 0;

  const ev = Number(m.ev ?? 0);
  const probability = Number(m.probability ?? 0);
  const risk = Number(m.risk ?? m.riskScore ?? 0.6);
  const confidence = Number(m.confidence ?? 0.6);

  let evFactor = 1;

  if (ev > 0.20) evFactor = 1.15;
  else if (ev > 0.12) evFactor = 1.08;
  else if (ev > 0.08) evFactor = 1.00;
  else if (ev > 0.04) evFactor = 0.75;
  else evFactor = 0.50;

  let probFactor = 1;

  if (probability > 0.78) probFactor = 1.05;
  else if (probability > 0.65) probFactor = 1.00;
  else if (probability > 0.55) probFactor = 0.85;
  else probFactor = 0.70;

  let riskFactor = 1;

  if (risk > 0.72) riskFactor = 0.35;
  else if (risk > 0.62) riskFactor = 0.55;
  else if (risk > 0.52) riskFactor = 0.75;
  else if (risk > 0.42) riskFactor = 0.90;
  else riskFactor = 1.00;

  let confidenceFactor = 1;

  if (confidence > 0.78) confidenceFactor = 1.05;
  else if (confidence > 0.65) confidenceFactor = 1.00;
  else if (confidence > 0.55) confidenceFactor = 0.85;
  else confidenceFactor = 0.65;

  let stake =
    baseKelly *
    evFactor *
    probFactor *
    riskFactor *
    confidenceFactor;

  /*
    Controle de sobrevivência:
    - Não queremos overbet.
    - O sistema precisa sobreviver milhares de entradas.
  */
  const stakeCap =
    Number.isFinite(options.stakeCap) && options.stakeCap! > 0
      ? options.stakeCap!
      : 0.025;

  stake = Math.max(0, stake);
  stake = Math.min(stakeCap, stake);

  return Number(stake.toFixed(4));
}