import type { MarketCategory } from "../types/MarketCategory";

export function classifyMarket(name: string): MarketCategory {

  if (
    name.includes("HOME WIN") ||
    name.includes("AWAY WIN") ||
    name === "DRAW"
  ) return "MATCH_RESULT";

  if (
    name.includes("OVER") ||
    name.includes("UNDER")
  ) return "TOTAL_GOALS";

  if (name.includes("BTTS"))
    return "BOTH_TEAMS";

  if (name.includes("+0.25") || name.includes("-0.25"))
    return "ASIAN";

  if (name.includes("HOME OVER") || name.includes("AWAY OVER"))
    return "TEAM_TOTAL";

  if (name.includes("DOUBLE CHANCE"))
    return "DOUBLE_CHANCE";

  if (name.includes("DNB"))
    return "DNB";

  return "MATCH_RESULT";
}