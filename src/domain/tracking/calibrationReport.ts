import type { Bet } from "./trackingEngine";

/*
 * Um apostador sênior não confia em ROI isolado — ele confere se
 * a probabilidade que o modelo disse bateu com o que realmente
 * aconteceu. Isso é o que este módulo mede: calibração real,
 * mercado por mercado, sobre apostas já liquidadas. Só lê
 * trackingEngine.getHistory(); não alimenta nada de volta no
 * pipeline de decisão.
 */

export interface CalibrationBucket {
  bets: number;

  wins: number;
  losses: number;

  winRate: number;

  avgProbability: number;

  /*
   * Erro quadrático médio entre probabilidade prevista e
   * resultado real (0 ou 1). Quanto menor, melhor calibrado —
   * 0 é perfeito, 0.25 é o valor de "não sei nada" (sempre
   * prever 50%).
   */
  brierScore: number;

  /*
   * |avgProbability - winRate| — mesma métrica simples já usada
   * em statReport.ts (backtest sintético), aqui sobre dados reais.
   */
  calibrationError: number;

  roi: number;
  totalStake: number;
  totalProfit: number;
}

export interface RecentVsAllTime {
  recent: CalibrationBucket;
  allTime: CalibrationBucket;
  windowSize: number;
}

export interface CalibrationReport {
  overall: CalibrationBucket;

  byMarket: Record<string, CalibrationBucket>;
  byClassification: Record<string, CalibrationBucket>;

  recentVsAllTime: RecentVsAllTime | null;

  /*
   * Amostra pequena não é ausência de sinal, é ausência de
   * conclusão — sinalizado explicitamente em vez de deixar o
   * usuário superinterpretar 8 apostas como validação do modelo.
   */
  sampleWarning: string | null;
}

const MIN_SAMPLE_FOR_CONFIDENCE = 30;
const DEFAULT_RECENT_WINDOW = 20;

export function buildCalibrationReport(
  bets: Bet[],
  options: { recentWindow?: number } = {}
): CalibrationReport {
  const recentWindow =
    options.recentWindow ?? DEFAULT_RECENT_WINDOW;

  const settled =
    Array.isArray(bets)
      ? bets.filter(
          bet =>
            bet?.result === "win" ||
            bet?.result === "loss"
        )
      : [];

  const overall = buildBucket(settled);

  const byMarket =
    groupBy(settled, bet => bet.market);

  const byClassification =
    groupBy(settled, bet => bet.type);

  const sortedByDate =
    [...settled].sort(
      (a, b) => a.createdAt - b.createdAt
    );

  const recentVsAllTime =
    sortedByDate.length >= recentWindow
      ? {
          recent:
            buildBucket(
              sortedByDate.slice(-recentWindow)
            ),

          allTime:
            overall,

          windowSize:
            recentWindow
        }
      : null;

  const sampleWarning =
    settled.length === 0
      ? "Nenhuma aposta liquidada ainda — sem dados para calibração."
      : settled.length < MIN_SAMPLE_FOR_CONFIDENCE
        ? `Amostra pequena (${settled.length} apostas liquidadas, mínimo recomendado ${MIN_SAMPLE_FOR_CONFIDENCE}) — trate estes números como indicativo, não como validação do modelo.`
        : null;

  return {
    overall,

    byMarket,
    byClassification,

    recentVsAllTime,

    sampleWarning
  };
}

function groupBy(
  settled: Bet[],
  keyFn: (bet: Bet) => string | undefined
): Record<string, CalibrationBucket> {
  const groups = new Map<string, Bet[]>();

  for (const bet of settled) {
    const key = keyFn(bet) ?? "UNKNOWN";

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(bet);
  }

  const result: Record<string, CalibrationBucket> = {};

  for (const [key, groupBets] of groups) {
    result[key] = buildBucket(groupBets);
  }

  return result;
}

function buildBucket(settled: Bet[]): CalibrationBucket {
  const bets = settled.length;

  const wins =
    settled.filter(bet => bet.result === "win").length;

  const losses =
    settled.filter(bet => bet.result === "loss").length;

  const winRate =
    bets > 0 ? wins / bets : 0;

  const validProbabilities =
    settled
      .map(bet => bet.probability)
      .filter(
        (p): p is number =>
          typeof p === "number" && Number.isFinite(p)
      );

  const avgProbability =
    validProbabilities.length > 0
      ? validProbabilities.reduce((a, b) => a + b, 0) /
        validProbabilities.length
      : 0;

  const brierScore =
    computeBrierScore(settled);

  const calibrationError =
    Math.abs(avgProbability - winRate);

  const totalStake =
    settled.reduce(
      (acc, bet) => acc + (bet.stake || 0),
      0
    );

  const totalProfit =
    settled.reduce(
      (acc, bet) => acc + (bet.profit || 0),
      0
    );

  const roi =
    totalStake > 0 ? totalProfit / totalStake : 0;

  return {
    bets,
    wins,
    losses,

    winRate:
      roundNumber(winRate),

    avgProbability:
      roundNumber(avgProbability),

    brierScore:
      roundNumber(brierScore),

    calibrationError:
      roundNumber(calibrationError),

    roi:
      roundNumber(roi),

    totalStake:
      roundNumber(totalStake),

    totalProfit:
      roundNumber(totalProfit)
  };
}

function computeBrierScore(settled: Bet[]): number {
  const scored =
    settled.filter(
      bet =>
        typeof bet.probability === "number" &&
        Number.isFinite(bet.probability) &&
        (bet.result === "win" || bet.result === "loss")
    );

  if (scored.length === 0) {
    return 0;
  }

  const sumSquaredError =
    scored.reduce((acc, bet) => {
      const outcome =
        bet.result === "win" ? 1 : 0;

      const error =
        bet.probability - outcome;

      return acc + error * error;
    }, 0);

  return sumSquaredError / scored.length;
}

function roundNumber(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
