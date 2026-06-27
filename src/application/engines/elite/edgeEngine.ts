export function calculateEdge(prob: number, odd: number) {
  const safeProb = Number(prob ?? 0);
  const safeOdd = Number(odd ?? 0);

  if (!Number.isFinite(safeProb) || !Number.isFinite(safeOdd)) return 0;
  if (safeProb <= 0 || safeProb >= 1 || safeOdd <= 1) return 0;

  const impliedProb = 1 / safeOdd;
  const edge = safeProb - impliedProb;

  return Number(edge.toFixed(4));
}

export function calculateExpectedValue(prob: number, odd: number) {
  const safeProb = Number(prob ?? 0);
  const safeOdd = Number(odd ?? 0);

  if (!Number.isFinite(safeProb) || !Number.isFinite(safeOdd)) return -1;
  if (safeProb <= 0 || safeProb >= 1 || safeOdd <= 1) return -1;

  return Number(((safeProb * safeOdd) - 1).toFixed(4));
}

export function calculateKelly(prob: number, odd: number) {
  const safeProb = Number(prob ?? 0);
  const safeOdd = Number(odd ?? 0);

  if (!Number.isFinite(safeProb) || !Number.isFinite(safeOdd)) return 0;
  if (safeProb <= 0 || safeProb >= 1 || safeOdd <= 1) return 0;

  const b = safeOdd - 1;
  const q = 1 - safeProb;

  let kelly = ((b * safeProb) - q) / b;

  if (!Number.isFinite(kelly) || kelly <= 0) return 0;

  if (safeOdd > 3.0) kelly *= 0.75;
  if (safeOdd > 5.0) kelly *= 0.60;
  if (safeOdd < 1.35) kelly *= 0.75;

  kelly *= 0.50;

  kelly = Math.max(0, Math.min(kelly, 0.08));

  return Number(kelly.toFixed(4));
}

export function calculateEdgeScore({
  probability,
  expectedValue,
  risk
}: {
  probability: number;
  expectedValue: number;
  risk: number;
}) {
  const ev = Math.max(-1, Math.min(Number(expectedValue ?? 0), 1));
  const prob = Math.max(0, Math.min(Number(probability ?? 0), 1));
  const safeRisk = Math.max(0, Math.min(Number(risk ?? 1), 1));

  let adjustedEV = ev;

  if (prob < 0.55 && ev > 0.10) {
    adjustedEV *= 0.75;
  } else if (prob < 0.60 && ev > 0.12) {
    adjustedEV *= 0.85;
  }

  if (prob >= 0.72 && ev > 0 && safeRisk <= 0.55) {
    adjustedEV *= 1.05;
  }

  const score =
    (adjustedEV * 0.50) +
    (prob * 0.30) +
    ((1 - safeRisk) * 0.20);

  return Number(score.toFixed(4));
}