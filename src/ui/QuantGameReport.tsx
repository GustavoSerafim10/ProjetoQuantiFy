/* ==========================================
   QUANT GAME REPORT — QUANTIFY V7
========================================== */

type DecisionClassification =
  | "SCALPER"
  | "ELITE"
  | "BET"
  | "WATCHLIST"
  | "NO BET";

interface QuantReportMarket {
  market?: string;

  probability?: number;

  odd?: number;
  fairOdd?: number;

  ev?: number;
  probabilityEdge?: number;
  edge?: number;

  risk?: number;
  riskScore?: number;

  confidence?: number;

  rankingScore?: number;
  score?: number;
  rank?: number;

  classification?:
    DecisionClassification;

  decisionValid?: boolean;
  rankingValid?: boolean;

  warnings?: string[];

  [key: string]: unknown;
}

interface QuantGameReportProps {
  markets?:
    QuantReportMarket[];

  best?:
    QuantReportMarket | null;

  noBet?: boolean;

  reason?: string;
}

/* ==========================================
   COMPONENTE
========================================== */

export default function QuantGameReport({
  markets = [],
  best: providedBest = null,
  noBet = false,
  reason
}: QuantGameReportProps) {
  const safeMarkets =
    Array.isArray(markets)
      ? markets
      : [];

  if (
    safeMarkets.length === 0 &&
    !providedBest
  ) {
    return null;
  }

  const sortedMarkets =
    [...safeMarkets].sort(
      compareMarkets
    );

  /*
   * Preferimos o best produzido pelo
   * decisionPipeline.
   *
   * Caso ele não seja fornecido, utilizamos apenas
   * candidatos realmente acionáveis.
   */
  const best =
    providedBest ??
    sortedMarkets.find(
      market =>
        isActionableMarket(
          market
        )
    ) ??
    null;

  const topMarkets =
    sortedMarkets.slice(
      0,
      3
    );

  const bestRisk =
    getRisk(
      best
    );

  const bestEdge =
    getProbabilityEdge(
      best
    );

  return (
    <div className="bg-black text-white p-6 rounded-2xl border border-zinc-800 space-y-5">

      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold">
            📊 Quant Report
          </h2>

          <p className="text-xs text-zinc-500 mt-1">
            Resumo quantitativo da análise
          </p>
        </div>

        {best?.classification && (
          <span
            className={
              `text-xs font-bold ${
                getClassificationColor(
                  best.classification
                )
              }`
            }
          >
            {best.classification}
          </span>
        )}
      </div>

      {/* MELHOR ENTRADA */}

      {best && !noBet ? (
        <div className="bg-green-900/20 border border-green-700/30 p-4 rounded-xl">
          <p className="text-xs text-zinc-400">
            🔥 Melhor oportunidade operacional
          </p>

          <div className="flex justify-between items-center gap-3 mt-2">
            <p className="font-bold text-lg">
              {best.market ??
                "Mercado"}
            </p>

            {best.rank !==
              undefined && (
              <span className="text-xs text-zinc-500">
                Ranking #
                {best.rank}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4 text-xs">
            <Metric
              label="Probabilidade"
              value={
                formatPercent(
                  best.probability,
                  1
                )
              }
            />

            <Metric
              label="Odd"
              value={
                formatDecimal(
                  best.odd,
                  2
                )
              }
            />

            <Metric
              label="EV"
              value={
                formatPercent(
                  best.ev,
                  2
                )
              }
            />

            <Metric
              label="Edge"
              value={
                formatPercent(
                  bestEdge,
                  2
                )
              }
            />

            <Metric
              label="Risco"
              value={
                formatPercent(
                  bestRisk,
                  1
                )
              }
            />

            <Metric
              label="Ranking"
              value={
                formatDecimal(
                  getRankingScore(
                    best
                  ),
                  4
                )
              }
            />
          </div>
        </div>
      ) : (
        <div className="bg-red-900/10 border border-red-700/20 p-4 rounded-xl">
          <p className="text-sm text-red-400 font-semibold">
            ⚠️ NO BET
          </p>

          <p className="text-xs text-zinc-500 mt-1">
            {reason ??
              "Nenhum mercado passou pelos critérios operacionais."}
          </p>
        </div>
      )}

      {/* TOP 3 */}

      <div>
        <p className="text-xs text-zinc-400 mb-2">
          📈 Top mercados do ranking
        </p>

        <div className="space-y-2">
          {topMarkets.map(
            (
              market,
              index
            ) => {
              const classification =
                normalizeClassification(
                  market.classification
                );

              return (
                <div
                  key={
                    String(
                      market.market ??
                      index
                    )
                  }
                  className="flex justify-between items-center gap-4 border-b border-zinc-800 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-6">
                      #
                      {market.rank ??
                        index + 1}
                    </span>

                    <div>
                      <p className="text-sm font-medium">
                        {market.market ??
                          "Mercado"}
                      </p>

                      <p
                        className={
                          `text-[10px] ${
                            getClassificationColor(
                              classification
                            )
                          }`
                        }
                      >
                        {classification}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm">
                      {formatPercent(
                        market.probability,
                        1
                      )}
                    </p>

                    <p className="text-[10px] text-zinc-500">
                      EV{" "}
                      {formatPercent(
                        market.ev,
                        2
                      )}
                    </p>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* ALERTAS */}

      {bestRisk !== null &&
        bestRisk > 0.60 && (
          <div className="text-red-400 text-xs border border-red-700/20 bg-red-900/10 p-3 rounded-lg">
            ⚠️ Risco elevado detectado na melhor entrada
          </div>
        )}

      {bestEdge !== null &&
        bestEdge <= 0.02 && (
          <div className="text-yellow-400 text-xs border border-yellow-700/20 bg-yellow-900/10 p-3 rounded-lg">
            ⚠️ Margem probabilística reduzida
          </div>
        )}

      {best?.warnings &&
        best.warnings.length >
          0 && (
          <div className="border border-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-400 mb-2">
              Diagnósticos
            </p>

            <div className="flex flex-wrap gap-2">
              {best.warnings
                .slice(
                  0,
                  5
                )
                .map(
                  (
                    warning,
                    index
                  ) => (
                    <span
                      key={
                        `${warning}-${index}`
                      }
                      className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-1 rounded"
                    >
                      {warning}
                    </span>
                  )
                )}
            </div>
          </div>
        )}

    </div>
  );
}

/* ==========================================
   COMPONENTES AUXILIARES
========================================== */

function Metric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-black/30 border border-zinc-800 rounded-lg p-2">
      <p className="text-[10px] text-zinc-500">
        {label}
      </p>

      <p className="text-sm mt-1">
        {value}
      </p>
    </div>
  );
}

/* ==========================================
   ORDENAÇÃO
========================================== */

function compareMarkets(
  first:
    QuantReportMarket,

  second:
    QuantReportMarket
): number {
  const firstRank =
    parsePositiveInteger(
      first.rank
    );

  const secondRank =
    parsePositiveInteger(
      second.rank
    );

  if (
    firstRank !== null &&
    secondRank !== null &&
    firstRank !== secondRank
  ) {
    return (
      firstRank -
      secondRank
    );
  }

  const firstScore =
    getRankingScore(
      first
    ) ??
    Number.NEGATIVE_INFINITY;

  const secondScore =
    getRankingScore(
      second
    ) ??
    Number.NEGATIVE_INFINITY;

  if (
    firstScore !==
    secondScore
  ) {
    return (
      secondScore -
      firstScore
    );
  }

  const firstEv =
    toFiniteNumber(
      first.ev
    ) ??
    Number.NEGATIVE_INFINITY;

  const secondEv =
    toFiniteNumber(
      second.ev
    ) ??
    Number.NEGATIVE_INFINITY;

  return (
    secondEv -
    firstEv
  );
}

/* ==========================================
   MÉTRICAS
========================================== */

function getRankingScore(
  market?:
    QuantReportMarket | null
): number | null {
  return firstFiniteNumber([
    market?.rankingScore,
    market?.score
  ]);
}

function getRisk(
  market?:
    QuantReportMarket | null
): number | null {
  return firstFiniteNumber([
    market?.riskScore,
    market?.risk
  ]);
}

function getProbabilityEdge(
  market?:
    QuantReportMarket | null
): number | null {
  return firstFiniteNumber([
    market?.probabilityEdge,
    market?.edge
  ]);
}

/* ==========================================
   CLASSIFICAÇÃO
========================================== */

function isActionableMarket(
  market:
    QuantReportMarket
): boolean {
  if (
    market.decisionValid ===
    false
  ) {
    return false;
  }

  const classification =
    normalizeClassification(
      market.classification
    );

  return (
    classification ===
      "SCALPER" ||
    classification ===
      "ELITE" ||
    classification ===
      "BET"
  );
}

function normalizeClassification(
  value: unknown
): DecisionClassification {
  switch (
    String(
      value ??
      ""
    )
  ) {
    case "SCALPER":
      return "SCALPER";

    case "ELITE":
      return "ELITE";

    case "BET":
      return "BET";

    case "WATCHLIST":
      return "WATCHLIST";

    case "NO BET":
    default:
      return "NO BET";
  }
}

function getClassificationColor(
  classification:
    DecisionClassification
): string {
  switch (
    classification
  ) {
    case "SCALPER":
      return "text-cyan-400";

    case "ELITE":
      return "text-green-400";

    case "BET":
      return "text-emerald-400";

    case "WATCHLIST":
      return "text-yellow-400";

    case "NO BET":
    default:
      return "text-red-400";
  }
}

/* ==========================================
   HELPERS NUMÉRICOS
========================================== */

function toFiniteNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function firstFiniteNumber(
  values: unknown[]
): number | null {
  for (
    const value of values
  ) {
    const parsed =
      toFiniteNumber(
        value
      );

    if (
      parsed !== null
    ) {
      return parsed;
    }
  }

  return null;
}

function parsePositiveInteger(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function formatPercent(
  value: unknown,
  decimals = 1
): string {
  const parsed =
    toFiniteNumber(
      value
    );

  if (parsed === null) {
    return "—";
  }

  return (
    parsed * 100
  ).toFixed(
    decimals
  ) + "%";
}

function formatDecimal(
  value: unknown,
  decimals = 2
): string {
  const parsed =
    toFiniteNumber(
      value
    );

  if (parsed === null) {
    return "—";
  }

  return parsed.toFixed(
    decimals
  );
}