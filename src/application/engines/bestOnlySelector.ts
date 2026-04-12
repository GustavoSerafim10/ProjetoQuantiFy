import type { MarketDecision } from "./gameAnalyzer";

export function selectBestMarket(
  markets: MarketDecision[]
): MarketDecision | null {

  // 1️⃣ Filtrar apenas mercados operáveis
  const operable = markets.filter(
    m => m.decision === "BET" || m.decision === "STRONG BET"
  );

  if (operable.length === 0)
    return null;

  // 2️⃣ Separar por zona
  const green = operable.filter(m => m.zone === "GREEN");
  const yellow = operable.filter(m => m.zone === "YELLOW");

  const candidates =
    green.length > 0 ? green : yellow;

  if (candidates.length === 0)
    return null;

  // 3️⃣ Ordenação institucional
  candidates.sort((a, b) => {

    // Maior EV
    if (b.expectedValue !== a.expectedValue)
      return b.expectedValue - a.expectedValue;

    // Maior Kelly
    if (b.kelly !== a.kelly)
      return b.kelly - a.kelly;

    // Menor RiskScore
    return a.riskScore - b.riskScore;
  });

  return candidates[0];
}