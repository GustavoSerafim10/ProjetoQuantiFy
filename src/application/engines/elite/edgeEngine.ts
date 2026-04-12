// ===============================
// 🔥 EDGE REAL (VS ODDS)
// ===============================
export function calculateEdge(prob: number, odd: number) {

  if (!odd || odd <= 1) return 0;

  let ev = (prob * odd) - 1;

  /* =========================================
     🔥 AJUSTES PROFISSIONAIS (SEM QUEBRAR BASE)
  ========================================= */

  // 🔻 penaliza odds muito baixas (valor inflado artificialmente)
  if (odd < 1.40) {
    ev *= 0.90;
  }

  // 🔻 penaliza odds muito altas (variância / incerteza)
  if (odd > 3.50) {
    ev *= 0.92;
  }

  // 🔻 probabilidade muito alta costuma esconder pouco valor real
  if (prob > 0.80) {
    ev *= 0.95;
  }

  // 🔻 probabilidade muito baixa (ruído)
  if (prob < 0.40) {
    ev *= 0.90;
  }

  return Number(ev.toFixed(4));
}

// ===============================
// 💰 KELLY CRITERION
// ===============================
export function calculateKelly(prob: number, odd: number) {

  if (!odd || odd <= 1) return 0;

  const edge = calculateEdge(prob, odd);

  let kelly = edge / (odd - 1);

  /* =========================================
     🔥 PROTEÇÕES AVANÇADAS
  ========================================= */

  // 🔻 odds muito altas → reduz stake
  if (odd > 3.0) {
    kelly *= 0.85;
  }

  // 🔻 odds muito baixas → reduz stake (valor menor real)
  if (odd < 1.40) {
    kelly *= 0.80;
  }

  // 🔒 limites (controle de banca)
  kelly = Math.max(0, Math.min(kelly, 0.25));

  return Number(kelly.toFixed(4));
}

// ===============================
// 🧠 SCORE INTERNO (REFINADO)
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

  /* =========================================
     🔥 NORMALIZAÇÃO
  ========================================= */

  const ev = Math.max(-1, Math.min(expectedValue, 1));
  const prob = Math.max(0, Math.min(probability, 1));
  const safeRisk = Math.max(0, Math.min(risk, 1));

  /* =========================================
     🔥 SCORE FINAL
  ========================================= */

  const score =
    (ev * 0.6) +
    (prob * 0.3) +
    ((1 - safeRisk) * 0.1);

  return Number(score.toFixed(4));
}