import type { MarketCategory } from "../types/MarketCategory";

export function classifyMarket(name: string): MarketCategory {

  if (
    name === "HOME" ||
    name === "AWAY" ||
    name === "DRAW"
  ) return "MATCH_RESULT";

  if (name.includes("DOUBLE_CHANCE"))
    return "DOUBLE_CHANCE";

  /*
   * Achado real em 2026-09-09: este check precisa vir ANTES do
   * OVER/UNDER genérico logo abaixo — "HOME_OVER"/"AWAY_OVER" contêm
   * a substring "OVER", então o branch de baixo sempre capturava
   * primeiro e este aqui nunca era alcançado (código morto).
   * Nenhum MarketCode atual usa esses nomes (ver
   * shared/types/marketCode.ts), então era inofensivo até agora —
   * mas passaria a classificar errado no dia em que um mercado de
   * total por time for adicionado.
   */
  if (name.includes("HOME_OVER") || name.includes("AWAY_OVER"))
    return "TEAM_TOTAL";

  if (
    name.includes("OVER") ||
    name.includes("UNDER")
  ) return "TOTAL_GOALS";

  if (name.includes("BTTS"))
    return "BOTH_TEAMS";

  if (name.includes("+0.25") || name.includes("-0.25"))
    return "ASIAN";

  if (name.includes("DNB"))
    return "DNB";

  return "MATCH_RESULT";
}