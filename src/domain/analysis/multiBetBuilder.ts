import { goalMatrix, type ScoreProbability } from "../math/goalMatrix";

/* ==========================================
   COMBO — PROBABILIDADE CONJUNTA
========================================== */

/*
 * Auditoria 2026-08-25: a versão anterior calculava
 * combinedProb = probA * probB, assumindo independência entre as
 * duas pernas. Isso é uma aproximação ruim para mercados do mesmo
 * jogo — BTTS Sim e Over 2.5, por exemplo, ocorrem juntos com muito
 * mais frequência do que o produto das probabilidades marginais
 * sugere, porque compartilham a mesma causa (muitos gols na
 * partida). Nenhum outro pipeline deste projeto calcula
 * probabilidade conjunta (correlationEngine.ts é só diagnóstico).
 *
 * Como o modelo já constrói uma matriz de placares completa
 * (goalMatrix.ts, Poisson + Dixon-Coles), a probabilidade conjunta
 * real de duas pernas do mesmo jogo pode ser obtida somando as
 * células da matriz em que as duas condições são satisfeitas ao
 * mesmo tempo — sem precisar assumir independência. Isso também
 * resolve a exclusão mútua (Over x Under, BTTS Sim x Não) de forma
 * exata: pares mutuamente exclusivos somam probabilidade conjunta
 * zero automaticamente, sem depender de checagem por string.
 *
 * Quando os lambdas do jogo não estão disponíveis, ou quando uma
 * das pernas é um mercado sem condição binária simples de vitória
 * neste modelo (Empate Anula, que anula a aposta no empate em vez
 * de perder ou ganhar), cai de volta para o produto das
 * probabilidades — a mesma aproximação de antes, agora sinalizada
 * explicitamente em `correlationModel`.
 */

interface ComboMarketCandidate {
  market?: string;
  probability?: number;
  odd?: number;
}

export interface ComboMatchContext {
  lambdaHome?: number | null;
  lambdaAway?: number | null;
}

export interface ComboResult {
  legs: [string, string];
  prob: number;
  odd: number;
  ev: number;

  /*
   * JOINT_MATRIX: probabilidade conjunta calculada a partir da
   * matriz real de placares do jogo.
   *
   * INDEPENDENT_APPROXIMATION: fallback por produto simples —
   * lambdas indisponíveis ou mercado fora do conjunto suportado
   * pela matriz (ex.: DNB). Tratar como estimativa grosseira.
   */
  correlationModel:
    | "JOINT_MATRIX"
    | "INDEPENDENT_APPROXIMATION";
}

type ComboConditionMarket =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER_1_5"
  | "OVER_2_5"
  | "UNDER_1_5"
  | "UNDER_2_5"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2";

export function buildCombo(
  markets: ComboMarketCandidate[],
  matchContext?: ComboMatchContext
): ComboResult | null {

  if (markets.length < 2) return null;

  const matrix = buildMatrixIfAvailable(matchContext);

  const combos: ComboResult[] = [];

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {

      const a = markets[i];
      const b = markets[j];

      const aMarket = a.market ?? "";
      const bMarket = b.market ?? "";

      const normalizedA = normalizeComboMarket(aMarket);
      const normalizedB = normalizeComboMarket(bMarket);

      let combinedProb: number;
      let correlationModel: ComboResult["correlationModel"];

      if (matrix && normalizedA && normalizedB) {
        combinedProb = jointWinProbability(matrix, normalizedA, normalizedB);
        correlationModel = "JOINT_MATRIX";

        // Pares mutuamente exclusivos somam probabilidade zero.
        if (combinedProb <= 0) continue;
      } else {
        /*
         * Fallback: evita combinar pernas obviamente mutuamente
         * exclusivas mesmo sem matriz disponível. Checa os dois
         * sentidos do par — a checagem original só olhava uma
         * ordem (a antes de b) e podia deixar passar o par
         * dependendo da ordem de entrada dos mercados.
         */
        const isOverUnderClash =
          (aMarket.includes("OVER") && bMarket.includes("UNDER")) ||
          (aMarket.includes("UNDER") && bMarket.includes("OVER"));

        const isBttsClash =
          (aMarket === "BTTS_YES" && bMarket === "BTTS_NO") ||
          (aMarket === "BTTS_NO" && bMarket === "BTTS_YES");

        if (isOverUnderClash || isBttsClash) continue;

        combinedProb = (a.probability ?? 0) * (b.probability ?? 0);
        correlationModel = "INDEPENDENT_APPROXIMATION";
      }

      const combinedOdd = (a.odd ?? 0) * (b.odd ?? 0);
      const combinedEV = (combinedProb * combinedOdd) - 1;

      combos.push({
        legs: [aMarket, bMarket],
        prob: combinedProb,
        odd: combinedOdd,
        ev: combinedEV,
        correlationModel
      });
    }
  }

  return combos.sort((a, b) => b.ev - a.ev)[0] || null;
}

/* ==========================================
   MATRIZ DE PLACARES
========================================== */

function buildMatrixIfAvailable(
  matchContext?: ComboMatchContext
): ScoreProbability[] | null {
  const lambdaHome = matchContext?.lambdaHome;
  const lambdaAway = matchContext?.lambdaAway;

  if (
    !isPositiveFiniteNumber(lambdaHome) ||
    !isPositiveFiniteNumber(lambdaAway)
  ) {
    return null;
  }

  return goalMatrix(lambdaHome, lambdaAway);
}

function jointWinProbability(
  matrix: ScoreProbability[],
  marketA: ComboConditionMarket,
  marketB: ComboConditionMarket
): number {
  let probability = 0;

  for (const cell of matrix) {
    if (
      marketWinsAtScore(marketA, cell.homeGoals, cell.awayGoals) &&
      marketWinsAtScore(marketB, cell.homeGoals, cell.awayGoals)
    ) {
      probability += cell.probability;
    }
  }

  return probability;
}

function marketWinsAtScore(
  market: ComboConditionMarket,
  homeGoals: number,
  awayGoals: number
): boolean {
  switch (market) {
    case "HOME":
      return homeGoals > awayGoals;

    case "DRAW":
      return homeGoals === awayGoals;

    case "AWAY":
      return homeGoals < awayGoals;

    case "OVER_1_5":
      return homeGoals + awayGoals >= 2;

    case "OVER_2_5":
      return homeGoals + awayGoals >= 3;

    case "UNDER_1_5":
      return homeGoals + awayGoals <= 1;

    case "UNDER_2_5":
      return homeGoals + awayGoals <= 2;

    case "BTTS_YES":
      return homeGoals > 0 && awayGoals > 0;

    case "BTTS_NO":
      return !(homeGoals > 0 && awayGoals > 0);

    case "DOUBLE_CHANCE_1X":
      return homeGoals >= awayGoals;

    case "DOUBLE_CHANCE_X2":
      return homeGoals <= awayGoals;
  }
}

function normalizeComboMarket(
  value: string
): ComboConditionMarket | null {
  const market = value.trim().toUpperCase();

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

    /*
     * DNB_HOME/DNB_AWAY ficam de fora de propósito: anulam a
     * aposta no empate em vez de perder, então não têm uma
     * condição binária de vitória compatível com a soma direta
     * de células da matriz usada aqui. Cai para o fallback de
     * independência.
     */
    default:
      return null;
  }
}

function isPositiveFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}
