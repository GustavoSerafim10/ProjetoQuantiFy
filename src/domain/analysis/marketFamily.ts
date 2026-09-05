/* ==========================================
   MARKET FAMILY CONSENSUS — DECISION INTELLIGENCE
========================================== */

/*
 * Responsabilidade:
 *
 * - agrupar mercados em famílias (GOALS, BTTS, RESULT,
 *   DOUBLE_CHANCE, DNB) e, dentro de GOALS/BTTS, numa direção
 *   (LOW/HIGH escore);
 * - reconhecer quando outros candidatos do MESMO jogo, de família
 *   diferente mas mesma direção, também têm EV positivo — ex.:
 *   BTTS_NO forte + UNDER_2_5 forte reforçam a MESMA hipótese
 *   (jogo de poucos gols), não duas hipóteses independentes.
 *
 * Este arquivo não:
 *
 * - soma os EVs/probabilidades como se fossem sinais
 *   independentes — isso seria contar a mesma evidência duas
 *   vezes, exatamente o double counting que a seção 9 do roteiro
 *   pede para evitar;
 * - decide classificação, risco ou confidence — é telemetria
 *   narrativa pura (ver explain.ts). Depois de duas fases (4 e 6)
 *   em que alimentar um sinal "de consenso" na decisão real
 *   piorou o ROI no backtest, familyConsensus fica de fora de
 *   qualquer cálculo numérico até existir evidência real de que
 *   ajuda.
 */

export type MarketFamily =
  | "GOALS"
  | "BTTS"
  | "RESULT"
  | "DOUBLE_CHANCE"
  | "DNB";

export type MarketDirection =
  | "LOW_SCORING"
  | "HIGH_SCORING"
  | null;

const MARKET_FAMILY_MAP: Record<string, MarketFamily> = {
  HOME: "RESULT",
  DRAW: "RESULT",
  AWAY: "RESULT",

  OVER_1_5: "GOALS",
  OVER_2_5: "GOALS",
  UNDER_1_5: "GOALS",
  UNDER_2_5: "GOALS",

  BTTS_YES: "BTTS",
  BTTS_NO: "BTTS",

  DOUBLE_CHANCE_1X: "DOUBLE_CHANCE",
  DOUBLE_CHANCE_X2: "DOUBLE_CHANCE",

  DNB_HOME: "DNB",
  DNB_AWAY: "DNB"
};

/*
 * Só GOALS/BTTS têm uma direção clara de "poucos gols" vs.
 * "muitos gols" que faz sentido comparar entre famílias
 * diferentes. RESULT/DOUBLE_CHANCE/DNB são sobre QUEM vence, não
 * QUANTOS gols — não têm direção nesse eixo.
 */
const MARKET_DIRECTION_MAP: Record<string, MarketDirection> = {
  OVER_1_5: "HIGH_SCORING",
  OVER_2_5: "HIGH_SCORING",
  UNDER_1_5: "LOW_SCORING",
  UNDER_2_5: "LOW_SCORING",

  BTTS_YES: "HIGH_SCORING",
  BTTS_NO: "LOW_SCORING"
};

export function getMarketFamily(
  market: unknown
): MarketFamily | null {
  const normalized = normalizeMarketCode(market);

  return normalized
    ? MARKET_FAMILY_MAP[normalized] ?? null
    : null;
}

export function getMarketDirection(
  market: unknown
): MarketDirection {
  const normalized = normalizeMarketCode(market);

  return normalized
    ? MARKET_DIRECTION_MAP[normalized] ?? null
    : null;
}

export interface FamilyConsensusCandidate {
  market: string;
  ev: number | null;
}

export interface FamilyConsensusResult {
  direction: MarketDirection;

  /*
   * Outros candidatos (famílias diferentes, mesma direção) com
   * EV positivo — a evidência que reforça a MESMA hipótese.
   */
  confirmingMarkets: string[];
}

/*
 * Retorna null quando o mercado avaliado não tem direção
 * (RESULT/DOUBLE_CHANCE/DNB) ou quando nenhum outro candidato de
 * família diferente confirma a mesma direção.
 */
export function calculateFamilyConsensus({
  market,
  otherCandidates
}: {
  market: string;
  otherCandidates: FamilyConsensusCandidate[];
}): FamilyConsensusResult | null {
  const direction = getMarketDirection(market);

  if (!direction) {
    return null;
  }

  const family = getMarketFamily(market);

  const confirmingMarkets = otherCandidates
    .filter(candidate => {
      if (candidate.ev === null || candidate.ev <= 0) {
        return false;
      }

      const candidateFamily = getMarketFamily(candidate.market);

      /*
       * Mesma família (ex.: OVER_1_5 e OVER_2_5) não conta como
       * confirmação independente — são quase a mesma aposta.
       * Só famílias DIFERENTES apontando para a mesma direção
       * representam evidência genuinamente adicional.
       */
      if (!candidateFamily || candidateFamily === family) {
        return false;
      }

      return (
        getMarketDirection(candidate.market) === direction
      );
    })
    .map(candidate => candidate.market);

  if (confirmingMarkets.length === 0) {
    return null;
  }

  return {
    direction,
    confirmingMarkets
  };
}

function normalizeMarketCode(value: unknown): string | null {
  const market = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "_")
    .replace(/\s+/g, "_");

  return market in MARKET_FAMILY_MAP ? market : null;
}
