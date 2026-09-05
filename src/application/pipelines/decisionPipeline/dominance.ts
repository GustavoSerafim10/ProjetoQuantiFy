import type { EvaluatedDecisionMarket } from "./types";

/* ==========================================
   MARKET DOMINANCE EVALUATOR
========================================== */

/*
 * Responsabilidade:
 *
 * - entre os mercados ACIONÁVEIS (SCALPER/ELITE/BET) de UM MESMO
 *   jogo, identificar quando dois ou mais expressam
 *   essencialmente a mesma tese (ex.: Under 2.5 + BTTS Não + DNB
 *   Casa quando o jogo é truncado) e manter só a expressão mais
 *   bem ranqueada;
 * - reaproveita o correlationPenaltyDiagnostic/mostRedundantWith
 *   que correlationEngine.ts (fase 6) já calcula por mercado — não
 *   recalcula o coeficiente phi de novo aqui.
 *
 * Este arquivo não:
 *
 * - afeta `best` (já é uma escolha única por definição: o próprio
 *   mercado de maior ranking não pode ser "dominado" por nada
 *   ranqueado abaixo dele);
 * - afeta o backtest (runBacktest.ts só lê `decision.best`, nunca
 *   `operationalBets` — validado antes de implementar isto, ver
 *   nota abaixo);
 * - recalcula probabilidade, EV, risco, confidence ou ranking.
 *
 * Por que isto é seguro mesmo sem poder validar contra o backtest
 * sintético (que só aposta em `best`): dominância só pode REMOVER
 * mercados de `operationalBets`/`secondary`, nunca adicionar ou
 * mudar `best` — o pior caso é continuar exatamente como antes
 * (nenhuma dominância detectada). Validado por teste unitário
 * direto, não por ROI agregado.
 */

export interface DominanceEvaluation {
  kept: EvaluatedDecisionMarket[];
  dominated: EvaluatedDecisionMarket[];
}

/*
 * Mesmo piso usado em correlationEngine.ts para considerar uma
 * redundância real (não ruído estatístico).
 */
const MINIMUM_PHI_FOR_DOMINANCE = 0.30;

export function evaluateMarketDominance(
  actionableMarkets: EvaluatedDecisionMarket[]
): DominanceEvaluation {
  const kept: EvaluatedDecisionMarket[] = [];
  const dominated: EvaluatedDecisionMarket[] = [];

  /*
   * actionableMarkets já vem ordenado do melhor para o pior
   * (compareDecisionMarkets, em ranking.ts). Percorrendo nessa
   * ordem e mantendo o primeiro de cada grupo redundante, o
   * sobrevivente é sempre o mais bem ranqueado do grupo —
   * inclusive `best` (índice 0), que nunca é dominado por
   * definição.
   */
  for (const market of actionableMarkets) {
    const redundantWith =
      findKeptRedundantPartner(market, kept);

    if (redundantWith) {
      dominated.push({
        ...market,

        dominatedBy:
          redundantWith.market ??
          null
      });

      continue;
    }

    kept.push(market);
  }

  return { kept, dominated };
}

function findKeptRedundantPartner(
  candidate: EvaluatedDecisionMarket,
  kept: EvaluatedDecisionMarket[]
): EvaluatedDecisionMarket | null {
  const candidatePenalty =
    parseFiniteNumber(
      candidate?.correlationPenaltyDiagnostic
    );

  const mostRedundantWith =
    getMostRedundantWith(candidate);

  if (
    candidatePenalty === null ||
    candidatePenalty <= 0 ||
    !mostRedundantWith
  ) {
    return null;
  }

  const phi =
    getMaxPositivePhi(candidate);

  if (phi === null || phi < MINIMUM_PHI_FOR_DOMINANCE) {
    return null;
  }

  return (
    kept.find(
      keptMarket =>
        normalizeMarketCode(keptMarket?.market) ===
        mostRedundantWith
    ) ?? null
  );
}

function getMostRedundantWith(
  market: EvaluatedDecisionMarket
): string | null {
  const debug =
    market?.debug as
      Record<string, unknown> |
      undefined;

  const correlationEngineDebug =
    debug?.correlationEngine as
      Record<string, unknown> |
      undefined;

  const value =
    correlationEngineDebug?.mostRedundantWith;

  return typeof value === "string" && value.length > 0
    ? value
    : null;
}

function getMaxPositivePhi(
  market: EvaluatedDecisionMarket
): number | null {
  const debug =
    market?.debug as
      Record<string, unknown> |
      undefined;

  const correlationEngineDebug =
    debug?.correlationEngine as
      Record<string, unknown> |
      undefined;

  return parseFiniteNumber(
    correlationEngineDebug?.maxPositivePhi
  );
}

function normalizeMarketCode(value: unknown): string | null {
  const market = String(value ?? "").trim().toUpperCase();

  return market.length > 0 ? market : null;
}

function parseFiniteNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
