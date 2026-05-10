import type { MarketDecision } from "./gameAnalyzer";

function getMarketContextScore(
  market: string
): number {

  switch (market) {

    // Mercados mais estáveis
    case "OVER_1_5":
      return 10;

    case "DOUBLE_CHANCE_HOME":
    case "DOUBLE_CHANCE_AWAY":
      return 9;

    // Moderados
    case "HOME_WIN":
    case "AWAY_WIN":
      return 7;

    case "OVER_2_5":
      return 6;

    // Mais frágeis
    case "BTTS_YES":
      return 4;

    case "DRAW":
      return 3;

    default:
      return 5;
  }
}

export function selectBestMarket(
  markets: MarketDecision[]
): MarketDecision | null {

  // 1️⃣ Mercados operáveis
  const operable = markets.filter(
    m =>
      m.decision === "BET" ||
      m.decision === "STRONG BET"
  );

  if (operable.length === 0)
    return null;

  // 2️⃣ Prioridade de zona
  const green = operable.filter(
    m => m.zone === "GREEN"
  );

  const yellow = operable.filter(
    m => m.zone === "YELLOW"
  );

  const candidates =
    green.length > 0
      ? green
      : yellow;

  if (candidates.length === 0)
    return null;

  // 3️⃣ Ordenação profissional
  candidates.sort((a, b) => {

    const aContext =
      getMarketContextScore(a.market);

    const bContext =
      getMarketContextScore(b.market);

    // 🔥 1. Prioridade estrutural
    if (bContext !== aContext)
      return bContext - aContext;

    // 🔥 2. Menor risco
    if (a.riskScore !== b.riskScore)
      return a.riskScore - b.riskScore;

    // 🔥 3. Melhor probabilidade
    if (b.probability !== a.probability)
      return b.probability - a.probability;

    // 🔥 4. EV
    if (b.expectedValue !== a.expectedValue)
      return b.expectedValue - a.expectedValue;

    // 🔥 5. Kelly
    return b.kelly - a.kelly;
  });

  return candidates[0];
}