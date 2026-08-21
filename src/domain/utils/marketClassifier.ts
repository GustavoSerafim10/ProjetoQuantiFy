import type { MarketCategory } from "../types/MarketCategory";

export function classifyMarket(name: string): MarketCategory {

  if (
    name === "HOME" ||
    name === "AWAY" ||
    name === "DRAW"
  ) return "MATCH_RESULT";

  if (name.includes("DOUBLE_CHANCE"))
    return "DOUBLE_CHANCE";

  if (
    name.includes("OVER") ||
    name.includes("UNDER")
  ) return "TOTAL_GOALS";

  if (name.includes("BTTS"))
    return "BOTH_TEAMS";

  if (name.includes("+0.25") || name.includes("-0.25"))
    return "ASIAN";

  if (name.includes("HOME_OVER") || name.includes("AWAY_OVER"))
    return "TEAM_TOTAL";

  if (name.includes("DNB"))
    return "DNB";

  return "MATCH_RESULT";
}