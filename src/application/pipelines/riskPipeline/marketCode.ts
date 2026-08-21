import type { RiskMarketType } from "./types";

/* ==========================================
   MERCADOS
========================================== */

export function normalizeMarketName(
  market: unknown
): string {
  return String(
    market ?? ""
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\./g, "_");
}

export function getMarketType(
  market: string
): RiskMarketType {
  switch (market) {
    case "HOME":
    case "HOME_WIN":
    case "DRAW":
    case "AWAY":
    case "AWAY_WIN":
      return "RESULT";

    case "DOUBLE_CHANCE_1X":
    case "DOUBLE_CHANCE_X2":
    case "1X":
    case "X2":
      return "DOUBLE_CHANCE";

    case "OVER_1_5":
    case "OVER15":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
      return "OVER_2_5";

    case "BTTS_YES":
      return "BTTS_YES";

    case "BTTS_NO":
      return "BTTS_NO";

    default:
      return "OTHER";
  }
}
