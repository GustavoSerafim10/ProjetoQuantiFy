export function calculateRiskV2({
  probability,
  ev,
  kelly,
  market,
  lambdaHome,
  lambdaAway
}: any) {

  let risk = 0;

  const totalLambda = lambdaHome + lambdaAway;
  const lambdaDiff = Math.abs(lambdaHome - lambdaAway);

  const m = String(market).toUpperCase();

  /* =========================
     ⚖️ 1. EQUILÍBRIO DO JOGO
  ========================= */

  // quanto mais equilibrado, mais imprevisível
  const balanceRisk = Math.max(0, 1 - lambdaDiff);
  risk += balanceRisk * 0.18;

  /* =========================
     🔥 2. INTENSIDADE DO JOGO
  ========================= */

  const isLowGoalGame = totalLambda < 2.2;
  const isHighGoalGame = totalLambda > 3.3;

  /* =========================
     🎯 3. MERCADOS DE GOLS
  ========================= */

  if (m === "OVER_1_5") {
    if (isLowGoalGame) risk += 0.15;
    if (probability < 0.72) risk += 0.10;
    if (ev < 0.05) risk += 0.08;
    if (kelly < 0.05) risk += 0.05;
  }

  if (m === "OVER_2_5") {
    risk += 0.10; // já é naturalmente mais arriscado

    if (isLowGoalGame) risk += 0.20;
    if (probability < 0.65) risk += 0.12;
    if (ev < 0.10) risk += 0.10;
    if (kelly < 0.06) risk += 0.08;
  }

  /* =========================
     🤝 4. BTTS
  ========================= */

  if (m === "BTTS_YES") {
    risk += 0.12;

    if (lambdaDiff > 1.1) risk += 0.15; // jogo desequilibrado
    if (isLowGoalGame) risk += 0.18;
    if (probability < 0.62) risk += 0.10;
    if (ev < 0.07) risk += 0.08;
  }

  if (m === "BTTS_NO") {
    risk += 0.10;

    if (isHighGoalGame) risk += 0.18;
    if (probability < 0.60) risk += 0.10;
    if (ev < 0.07) risk += 0.08;
  }

  /* =========================
     🏆 5. RESULTADO (1X2)
  ========================= */

  if (
    m === "HOME_WIN" ||
    m === "AWAY_WIN"
  ) {
    risk += 0.18;

    if (lambdaDiff < 0.40) risk += 0.15; // jogo equilibrado
    if (probability < 0.45) risk += 0.10;
    if (ev < 0.10) risk += 0.10;
  }

  if (m === "DRAW") {
    risk += 0.22; // empate é o mais difícil

    if (lambdaDiff > 0.6) risk += 0.10;
    if (probability < 0.28) risk += 0.10;
  }

  /* =========================
     🛡️ 6. DOUBLE CHANCE
  ========================= */

  if (
    m === "DOUBLE_CHANCE_1X" ||
    m === "DOUBLE_CHANCE_X2"
  ) {
    risk -= 0.08; // mercado mais seguro

    if (lambdaDiff < 0.25) risk += 0.10;
    if (probability < 0.65) risk += 0.08;
    if (ev < 0.06) risk += 0.08;
  }

  /* =========================
     📉 7. AJUSTES GLOBAIS
  ========================= */

  if (probability > 0.78) risk -= 0.08;
  if (ev > 0.15) risk -= 0.10;
  if (kelly > 0.12) risk -= 0.08;

  /* =========================
     🔒 NORMALIZAÇÃO
  ========================= */

  risk = Math.max(0, Math.min(1, risk));

  return Number(risk.toFixed(4));
}