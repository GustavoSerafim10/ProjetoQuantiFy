export function kellyCriterion(
  probability: number,
  odd: number
): number {
  if (probability <= 0 || odd <= 1) {
    throw new Error(
      "Invalid probability or odd"
    );
  }

  const b = odd - 1;
  const p = probability;
  const q = 1 - p;

  const kelly =
    ((b * p) - q) / b;

  return Math.max(kelly, 0);
}

export function halfKelly(
  probability: number,
  odd: number
): number {
  return (
    kellyCriterion(
      probability,
      odd
    ) / 2
  );
}

/* ===============================
   STAKE PRO ENGINE
=============================== */
export function calculateStakePro(
  m: any
): number {

  const baseKelly =
    Math.max(m.kelly ?? 0, 0);

  if (baseKelly <= 0) return 0;

  let evFactor = 1;

  if (m.ev > 0.20) evFactor = 1.20;
  else if (m.ev > 0.12) evFactor = 1.10;
  else if (m.ev > 0.08) evFactor = 1.00;
  else evFactor = 0.70;

  let probFactor = 1;

  if (m.probability > 0.78)
    probFactor = 1.05;
  else if (m.probability > 0.68)
    probFactor = 1.00;
  else
    probFactor = 0.85;

  let riskFactor = 1;

  if (m.risk > 0.70)
    riskFactor = 0.50;
  else if (m.risk > 0.55)
    riskFactor = 0.70;
  else if (m.risk > 0.45)
    riskFactor = 0.85;

  let confidenceFactor = 1;

  if (m.confidence > 0.75)
    confidenceFactor = 1.05;
  else if (m.confidence < 0.58)
    confidenceFactor = 0.75;

  let stake =
    baseKelly *
    evFactor *
    probFactor *
    riskFactor *
    confidenceFactor;

  stake = Math.max(0, stake);
  stake = Math.min(0.03, stake);

  return Number(stake.toFixed(4));
}