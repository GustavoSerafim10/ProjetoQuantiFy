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

  let evFactor = 1;

  if (m.ev > 0.15) evFactor = 1.40;
  else if (m.ev > 0.10) evFactor = 1.20;
  else if (m.ev > 0.07) evFactor = 1.10;
  else evFactor = 0.90;

  let probFactor = 1;

  if (m.probability > 0.75)
    probFactor = 1.25;
  else if (m.probability > 0.68)
    probFactor = 1.10;
  else
    probFactor = 0.95;

  let riskFactor = 1;

  if (m.risk > 0.70)
    riskFactor = 0.60;
  else if (m.risk > 0.50)
    riskFactor = 0.75;
  else if (m.risk > 0.40)
    riskFactor = 0.90;

  let confidenceFactor = 1;

  if (m.confidence > 0.75)
    confidenceFactor = 1.20;
  else if (m.confidence < 0.55)
    confidenceFactor = 0.80;

  let stake =
    baseKelly *
    evFactor *
    probFactor *
    riskFactor *
    confidenceFactor;

  /* ===========================
     LIMITES DE SEGURANÇA
  ============================ */
  stake = Math.max(0.005, stake);
  stake = Math.min(0.05, stake);

  return Number(
    stake.toFixed(4)
  );
}