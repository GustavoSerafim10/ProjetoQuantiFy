export function calculateRisk({
  probability,
  ev,
  kelly,
  market
}: any) {

  let risk = 1 - probability;

  // 🔥 EV reduz risco
  if (ev > 0.08) risk -= 0.10;

  // 🔥 Kelly alto = confiança real
  if (kelly > 0.05) risk -= 0.10;

  // 🔥 mercados instáveis
  if (market.includes("CORNERS")) risk += 0.10;
  if (market.includes("CARDS")) risk += 0.12;

  // 🔥 extremos são perigosos
  if (probability > 0.80) risk += 0.05;

  // 🔥 clamp
  if (risk < 0) risk = 0;
  if (risk > 1) risk = 1;

  return risk;
}