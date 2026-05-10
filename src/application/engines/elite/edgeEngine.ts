// ===============================
// 🔥 EDGE REAL (VS ODDS)
// ===============================
export function calculateEdge(prob: number, odd: number) {
  const safeProb = Number(prob ?? 0);
  const safeOdd = Number(odd ?? 0);

  if (!Number.isFinite(safeProb) || !Number.isFinite(safeOdd)) return 0;
  if (safeOdd <= 1) return 0;

  const ev = (safeProb * safeOdd) - 1;

  return Number(ev.toFixed(4));
}

// ===============================
// 💰 KELLY CRITERION
// ===============================
export function calculateKelly(prob: number, odd: number) {
  const safeProb = Number(prob ?? 0);
  const safeOdd = Number(odd ?? 0);

  if (!Number.isFinite(safeProb) || !Number.isFinite(safeOdd)) return 0;
  if (safeOdd <= 1) return 0;

  const edge = calculateEdge(safeProb, safeOdd);

  let kelly = edge / (safeOdd - 1);

  /* =========================================
     🔥 PROTEÇÕES AVANÇADAS
  ========================================= */

  // odds altas → reduzir exposição
  if (safeOdd > 3.0) {
    kelly *= 0.85;
  }

  // longshots mais agressivos
  if (safeOdd > 5.0) {
    kelly *= 0.75;
  }

  // risco natural de odds muito baixas:
  // não matar, só reduzir um pouco a agressividade
  if (safeOdd < 1.35) {
    kelly *= 0.90;
  }

  // controle final
  kelly = Math.max(0, Math.min(kelly, 0.25));

  return Number(kelly.toFixed(4));
}
// ===============================
// 🧠 SCORE INTERNO (EDGE-FIRST)
// ===============================
export function calculateEdgeScore({
  probability,
  expectedValue,
  risk
}: {
  probability: number;
  expectedValue: number;
  risk: number;
}) {

  const ev = Math.max(
    -1,
    Math.min(Number(expectedValue ?? 0), 1)
  );

  const prob = Math.max(
    0,
    Math.min(Number(probability ?? 0), 1)
  );

  const safeRisk = Math.max(
    0,
    Math.min(Number(risk ?? 1), 1)
  );

  /* =========================================
     🧠 EV QUALITY CONTROL
  ========================================= */

  let adjustedEV = ev;

  // EV muito alto com baixa probabilidade
  // normalmente é edge artificial
  if (prob < 0.60 && ev > 0.12) {
    adjustedEV *= 0.85;
  }

  // probabilidade muito forte
  // merece sustentação estrutural
  if (prob >= 0.72 && ev > 0) {
    adjustedEV *= 1.05;
  }

  /* =========================================
     🔥 SCORE PROFISSIONAL
  ========================================= */

  const score =
    (adjustedEV * 0.55) +
    (prob * 0.30) +
    ((1 - safeRisk) * 0.15);

  return Number(score.toFixed(4));
}