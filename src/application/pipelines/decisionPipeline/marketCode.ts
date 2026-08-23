import type { CanonicalDecisionMarket } from "./types";

/* ==========================================
   MERCADOS
========================================== */

export function parseDecisionMarket(
  value: unknown
): CanonicalDecisionMarket | null {
  const market =
    String(
      value ??
      ""
    )
      .trim()
      .toUpperCase();

  switch (market) {
    case "HOME":
    case "HOME_WIN":
      return "HOME";

    case "DRAW":
      return "DRAW";

    case "AWAY":
    case "AWAY_WIN":
      return "AWAY";

    case "OVER_1_5":
    case "OVER15":
    case "OVER 1.5":
      return "OVER_1_5";

    case "OVER_2_5":
    case "OVER25":
    case "OVER 2.5":
      return "OVER_2_5";

    case "UNDER_1_5":
    case "UNDER15":
    case "UNDER 1.5":
      return "UNDER_1_5";

    case "UNDER_2_5":
    case "UNDER25":
    case "UNDER 2.5":
      return "UNDER_2_5";

    case "BTTS_YES":
    case "BTTS YES":
      return "BTTS_YES";

    case "BTTS_NO":
    case "BTTS NO":
      return "BTTS_NO";

    case "DOUBLE_CHANCE_1X":
    case "1X":
      return "DOUBLE_CHANCE_1X";

    case "DOUBLE_CHANCE_X2":
    case "X2":
      return "DOUBLE_CHANCE_X2";

    case "DNB_HOME":
    case "DNB1":
      return "DNB_HOME";

    case "DNB_AWAY":
    case "DNB2":
      return "DNB_AWAY";

    default:
      return null;
  }
}
