export interface BetRecord {
  market: string;
  marketType: string;

  classification: string;

  odd: number;
  stake: number;
  profit: number;

  ev?: number;
  probability?: number;
}

interface Aggregated {
  bets: number;
  wins: number;

  totalStake: number;
  totalProfit: number;

  totalOdds: number;
  totalEV: number;

  probabilities: number[];
}

function createEmpty(): Aggregated {
  return {
    bets: 0,
    wins: 0,

    totalStake: 0,
    totalProfit: 0,

    totalOdds: 0,
    totalEV: 0,

    probabilities: []
  };
}

/* ===========================
   CORE STATS
=========================== */

function computeStats(data: Aggregated) {

  const roi =
    data.totalStake > 0
      ? data.totalProfit / data.totalStake
      : 0;

  const winRate =
    data.bets > 0
      ? data.wins / data.bets
      : 0;

  const avgOdd =
    data.bets > 0
      ? data.totalOdds / data.bets
      : 0;

  const avgEV =
    data.bets > 0
      ? data.totalEV / data.bets
      : 0;

  const grossWin =
    Math.max(data.totalProfit, 0);

  const grossLoss =
    Math.abs(Math.min(data.totalProfit, 0));

  const profitFactor =
    grossLoss > 0
      ? grossWin / grossLoss
      : grossWin;

  const avgProb =
    data.probabilities.length > 0
      ? data.probabilities.reduce(
          (a, b) => a + b,
          0
        ) /
        data.probabilities.length
      : 0;

  const calibrationError =
    Math.abs(avgProb - winRate);

  return {
    bets: data.bets,

    roi,
    winRate,

    avgOdd,
    avgEV,

    profitFactor,

    avgProb,
    calibrationError
  };
}

/* ===========================
   REPORT
=========================== */

export function generateStatReport(
  betHistory: BetRecord[]
) {

  const byMarket: Record<string, Aggregated> = {};
  const byMarketType: Record<string, Aggregated> = {};
  const byClassification: Record<string, Aggregated> = {};
  const byOddsRange: Record<string, Aggregated> = {};

  const oddsBuckets = [
    {
      label: "1.40-1.80",
      min: 1.4,
      max: 1.8
    },
    {
      label: "1.80-2.50",
      min: 1.8,
      max: 2.5
    },
    {
      label: "2.50+",
      min: 2.5,
      max: Infinity
    }
  ];

  for (const bet of betHistory) {

    const groups = [
      [byMarket, bet.market],
      [byMarketType, bet.marketType],
      [byClassification, bet.classification]
    ] as const;

    for (const [group, key] of groups) {

      if (!group[key]) {
        group[key] = createEmpty();
      }

      const data = group[key];

      data.bets++;
      data.totalStake += bet.stake;
      data.totalProfit += bet.profit;

      data.totalOdds += bet.odd;
      data.totalEV += bet.ev ?? 0;

      if (bet.profit > 0) {
        data.wins++;
      }

      if (
        bet.probability !== undefined
      ) {
        data.probabilities.push(
          bet.probability
        );
      }
    }

    /* ===========================
       ODDS BUCKET
    ============================ */

    for (const bucket of oddsBuckets) {

      if (
        bet.odd >= bucket.min &&
        bet.odd < bucket.max
      ) {

        if (!byOddsRange[bucket.label]) {
          byOddsRange[bucket.label] =
            createEmpty();
        }

        const data =
          byOddsRange[bucket.label];

        data.bets++;
        data.totalStake += bet.stake;
        data.totalProfit += bet.profit;

        data.totalOdds += bet.odd;
        data.totalEV += bet.ev ?? 0;

        if (bet.profit > 0) {
          data.wins++;
        }

        if (
          bet.probability !== undefined
        ) {
          data.probabilities.push(
            bet.probability
          );
        }
      }
    }
  }

  const format = (
    source: Record<string, Aggregated>
  ) => {
    const out: Record<string, any> = {};

    for (const key in source) {
      out[key] =
        computeStats(source[key]);
    }

    return out;
  };

  return {
    overall: computeStats(
      betHistory.reduce(
        (acc, bet) => {
          acc.bets++;
          acc.totalStake += bet.stake;
          acc.totalProfit += bet.profit;
          acc.totalOdds += bet.odd;
          acc.totalEV += bet.ev ?? 0;

          if (bet.profit > 0) {
            acc.wins++;
          }

          if (
            bet.probability !== undefined
          ) {
            acc.probabilities.push(
              bet.probability
            );
          }

          return acc;
        },
        createEmpty()
      )
    ),

    byClassification:
      format(byClassification),

    byMarketType:
      format(byMarketType),

    byMarket:
      format(byMarket),

    byOddsRange:
      format(byOddsRange)
  };
}