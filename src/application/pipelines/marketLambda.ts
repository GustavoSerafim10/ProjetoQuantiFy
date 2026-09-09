import {
  fitMarketImpliedLambda
} from "../../domain/model/marketImpliedLambda";

import {
  devigConsensus
} from "../../domain/odds/devig";

import {
  hasUsableMultiBookOdds,
  type MultiBookOddsPayload
} from "../../domain/odds/multiBookOdds";

/* ==========================================
   LAMBDA A PARTIR DE ODDS DE MERCADO — EXTRAÍDO
========================================== */

/*
 * Extraído de marketModelPipeline.ts em 2026-09-09 para ser
 * reaproveitado por fusedModelPipeline.ts (fusão stats+odds) sem
 * duplicar a cadeia de-vig → fitMarketImpliedLambda.
 */

export interface MarketLambdaResult {
  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;

  fitError: number;
  bookmakerCount: number;

  devig: {
    oneXTwo: number[] | null;
    overUnder15: number[] | null;
    overUnder25: number[] | null;
    btts: number[] | null;
  };

  fit: ReturnType<typeof fitMarketImpliedLambda>;
}

export function computeMarketLambda(
  marketOdds: MultiBookOddsPayload | undefined
): MarketLambdaResult | null {
  if (!hasUsableMultiBookOdds(marketOdds)) {
    return null;
  }

  const oneXToConsensus =
    marketOdds!.home && marketOdds!.draw && marketOdds!.away
      ? devigConsensus([
          marketOdds!.home,
          marketOdds!.draw,
          marketOdds!.away
        ])
      : null;

  const overUnder15Consensus =
    marketOdds!.over15 && marketOdds!.under15
      ? devigConsensus([
          marketOdds!.over15,
          marketOdds!.under15
        ])
      : null;

  const overUnder25Consensus =
    marketOdds!.over25 && marketOdds!.under25
      ? devigConsensus([
          marketOdds!.over25,
          marketOdds!.under25
        ])
      : null;

  const bttsConsensus =
    marketOdds!.bttsYes && marketOdds!.bttsNo
      ? devigConsensus([
          marketOdds!.bttsYes,
          marketOdds!.bttsNo
        ])
      : null;

  const oneXTwo = oneXToConsensus?.probabilities ?? null;
  const overUnder15 = overUnder15Consensus?.probabilities ?? null;
  const overUnder25 = overUnder25Consensus?.probabilities ?? null;
  const btts = bttsConsensus?.probabilities ?? null;

  const bookmakerCount = Math.max(
    1,
    oneXToConsensus?.bookmakerCount ?? 0,
    overUnder15Consensus?.bookmakerCount ?? 0,
    overUnder25Consensus?.bookmakerCount ?? 0,
    bttsConsensus?.bookmakerCount ?? 0
  );

  const fit = fitMarketImpliedLambda({
    home: oneXTwo?.[0],
    draw: oneXTwo?.[1],
    away: oneXTwo?.[2],

    over15: overUnder15?.[0],
    under15: overUnder15?.[1],

    over25: overUnder25?.[0],
    under25: overUnder25?.[1],

    bttsYes: btts?.[0],
    bttsNo: btts?.[1]
  });

  /*
   * Achado real em 2026-09-09: sem nenhum alvo real (1X2/O-U/BTTS),
   * fitMarketImpliedLambda devolve o fallback neutro (1.32/1.23,
   * fitError: 0) — isso NÃO é um mercado ajustado, é ausência de
   * dado disfarçada de "ajuste perfeito". hasUsableMultiBookOdds já
   * filtra a maioria dos casos (ver multiBookOdds.ts), mas este
   * check aqui é a garantia real: nenhum caller deveria confiar num
   * lambda de mercado que não veio de nenhum alvo de fato.
   */
  if (fit.diagnostics.targetCount === 0) {
    return null;
  }

  const lambdaHome = fit.lambdaHome;
  const lambdaAway = fit.lambdaAway;

  return {
    lambdaHome,
    lambdaAway,
    totalLambda: lambdaHome + lambdaAway,

    fitError: fit.fitError,
    bookmakerCount,

    devig: {
      oneXTwo,
      overUnder15,
      overUnder25,
      btts
    },

    fit
  };
}
