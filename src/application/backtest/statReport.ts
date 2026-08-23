export interface BetRecord {
  market: string;
  marketType: string;

  classification: string;

  odd: number;
  stake: number;
  profit: number;

  ev?: number;
  probability?: number;

  /*
   * Ausente = tratado como resultado binário legado
   * (profit > 0 é vitória). Mercados com anulação (DNB)
   * sempre preenchem este campo.
   */
  outcome?: "WIN" | "LOSS" | "VOID";
}

interface Aggregated {
  bets: number;
  wins: number;
  voids: number;

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
    voids: 0,

    totalStake: 0,
    totalProfit: 0,

    totalOdds: 0,
    totalEV: 0,

    probabilities: []
  };
}

/*
 * Acumulação compartilhada entre os agrupamentos (por
 * mercado, por tipo, por classificação, por faixa de odd
 * e geral) — evita repetir a mesma lógica em 4 lugares e
 * esquecer o tratamento de VOID em algum deles.
 */
function accumulate(
  data: Aggregated,
  bet: BetRecord
): void {
  data.bets++;
  data.totalStake += bet.stake;
  data.totalProfit += bet.profit;

  data.totalOdds += bet.odd;
  data.totalEV += bet.ev ?? 0;

  if (bet.outcome === "VOID") {
    data.voids++;
  } else if (bet.profit > 0) {
    data.wins++;
  }

  /*
   * A probabilidade de um mercado com anulação é
   * condicional (dado que não anula) — misturá-la com o
   * winRate sem excluir os voids do denominador
   * distorceria calibrationError. Por isso voids não
   * entram em `probabilities`.
   */
  if (
    bet.probability !== undefined &&
    bet.outcome !== "VOID"
  ) {
    data.probabilities.push(
      bet.probability
    );
  }
}

/* ===========================
   CORE STATS
=========================== */

function computeStats(data: Aggregated) {

  const roi =
    data.totalStake > 0
      ? data.totalProfit / data.totalStake
      : 0;

  const decidedBets =
    data.bets - data.voids;

  const winRate =
    decidedBets > 0
      ? data.wins / decidedBets
      : 0;

  const voidRate =
    data.bets > 0
      ? data.voids / data.bets
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
    voids: data.voids,

    roi,
    winRate,
    voidRate,

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

      accumulate(
        group[key],
        bet
      );
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

        accumulate(
          byOddsRange[bucket.label],
          bet
        );
      }
    }
  }

  const format = (
    source: Record<string, Aggregated>
  ) => {
    const out: Record<string, ReturnType<typeof computeStats>> = {};

    for (const key in source) {
      out[key] =
        computeStats(source[key]);
    }

    return out;
  };

  const overall = createEmpty();

  for (const bet of betHistory) {
    accumulate(overall, bet);
  }

  return {
    overall: computeStats(overall),

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
