import {
  useMemo,
  useState
} from "react";

/* ==========================================
   GAME ANALYSIS PANEL — QUANTIFY V7
========================================== */

type DecisionClassification =
  | "SCALPER"
  | "ELITE"
  | "BET"
  | "WATCHLIST"
  | "NO BET";

interface AnalysisMarket {
  market?: string;

  probability?: number;
  impliedProbability?: number;

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

  kelly?: number;
  stake?: number;

  classification?:
    DecisionClassification;

  decisionValid?: boolean;
  rankingValid?: boolean;

  category?: string;

  warnings?: string[];

  [key: string]: unknown;
}

interface Props {
  markets?: AnalysisMarket[];
}

/* ==========================================
   HELPERS
========================================== */

function toFiniteNumber(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function firstFiniteNumber(
  values: unknown[]
): number | null {
  for (const value of values) {
    const parsed =
      toFiniteNumber(
        value
      );

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
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

  return `${(
    parsed * 100
  ).toFixed(decimals)}%`;
}

function formatDecimal(
  value: unknown,
  decimals = 3
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

function getEv(
  market: AnalysisMarket
): number | null {
  return toFiniteNumber(
    market.ev
  );
}

function getProbabilityEdge(
  market: AnalysisMarket
): number | null {
  return firstFiniteNumber([
    market.probabilityEdge,
    market.edge
  ]);
}

function getRisk(
  market: AnalysisMarket
): number | null {
  return firstFiniteNumber([
    market.riskScore,
    market.risk
  ]);
}

function getRankingScore(
  market: AnalysisMarket
): number | null {
  return firstFiniteNumber([
    market.rankingScore,
    market.score
  ]);
}

function getStatus(
  market: AnalysisMarket
): DecisionClassification {
  if (
    market.classification
  ) {
    return market.classification;
  }

  const ev =
    getEv(
      market
    );

  if (ev === null || ev <= 0) {
    return "NO BET";
  }

  if (ev >= 0.12) {
    return "ELITE";
  }

  if (ev >= 0.07) {
    return "BET";
  }

  return "WATCHLIST";
}

function statusColor(
  status: DecisionClassification
): string {
  switch (status) {
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

function rowHighlight(
  status: DecisionClassification
): string {
  switch (status) {
    case "SCALPER":
      return "bg-cyan-900/20";

    case "ELITE":
      return "bg-green-900/20";

    case "BET":
      return "bg-emerald-900/20";

    case "WATCHLIST":
      return "bg-yellow-900/20";

    default:
      return "";
  }
}

function getMarketKey(
  market: AnalysisMarket,
  index: number
): string {
  return String(
    market.market ??
    `market-${index}`
  );
}

/* ==========================================
   COMPONENTE
========================================== */

export default function GameAnalysisPanel({
  markets = []
}: Props) {
  /*
   * Escalas agora trabalham entre 0 e 1.
   */
  const [
    minimumEdge,
    setMinimumEdge
  ] = useState(0);

  const [
    maximumRisk,
    setMaximumRisk
  ] = useState(1);

  const [
    onlyActionable,
    setOnlyActionable
  ] = useState(false);

  const [
    classification,
    setClassification
  ] = useState<
    "ALL" |
    DecisionClassification
  >("ALL");

  const safeMarkets =
    Array.isArray(markets)
      ? markets
      : [];

  const rankedMarkets =
    useMemo(
      () =>
        [...safeMarkets].sort(
          (
            first,
            second
          ) => {
            const firstRank =
              toFiniteNumber(
                first.rank
              );

            const secondRank =
              toFiniteNumber(
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

            return (
              secondScore -
              firstScore
            );
          }
        ),
      [
        safeMarkets
      ]
    );

  const filteredMarkets =
    useMemo(
      () =>
        rankedMarkets.filter(
          market => {
            const edge =
              getProbabilityEdge(
                market
              );

            const risk =
              getRisk(
                market
              );

            const status =
              getStatus(
                market
              );

            const passesEdge =
              edge !== null &&
              edge >=
                minimumEdge;

            const passesRisk =
              risk !== null &&
              risk <=
                maximumRisk;

            const passesActionable =
              !onlyActionable ||
              status ===
                "SCALPER" ||
              status ===
                "ELITE" ||
              status ===
                "BET";

            const passesClassification =
              classification ===
                "ALL" ||
              status ===
                classification;

            return (
              passesEdge &&
              passesRisk &&
              passesActionable &&
              passesClassification
            );
          }
        ),
      [
        rankedMarkets,
        minimumEdge,
        maximumRisk,
        onlyActionable,
        classification
      ]
    );

  return (
    <div className="bg-black text-white p-6 md:p-12">

      <h2 className="text-3xl mb-8 font-bold">
        🏆 Ranking Quantitativo
      </h2>

      {/* FILTROS */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">

        <div>
          <label className="text-sm text-gray-400">
            Edge mínimo:{" "}
            {formatPercent(
              minimumEdge,
              1
            )}
          </label>

          <input
            type="range"
            min="0"
            max="0.20"
            step="0.005"
            value={
              minimumEdge
            }
            onChange={
              event =>
                setMinimumEdge(
                  Number(
                    event.target.value
                  )
                )
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">
            Risco máximo:{" "}
            {formatPercent(
              maximumRisk,
              0
            )}
          </label>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={
              maximumRisk
            }
            onChange={
              event =>
                setMaximumRisk(
                  Number(
                    event.target.value
                  )
                )
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">
            Classificação
          </label>

          <select
            value={
              classification
            }
            onChange={
              event =>
                setClassification(
                  event.target
                    .value as
                    | "ALL"
                    | DecisionClassification
                )
            }
            className="w-full bg-gray-900 p-2 rounded mt-1"
          >
            <option value="ALL">
              Todas
            </option>

            <option value="SCALPER">
              SCALPER
            </option>

            <option value="ELITE">
              ELITE
            </option>

            <option value="BET">
              BET
            </option>

            <option value="WATCHLIST">
              WATCHLIST
            </option>

            <option value="NO BET">
              NO BET
            </option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={
              onlyActionable
            }
            onChange={() =>
              setOnlyActionable(
                current =>
                  !current
              )
            }
          />

          <span>
            Apenas entradas acionáveis
          </span>
        </div>

      </div>

      {/* RESULTADO */}

      {filteredMarkets.length ===
      0 ? (
        <div className="text-gray-500 text-lg">
          Nenhum mercado dentro dos critérios atuais.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">

            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase text-sm">
                <th className="p-3">
                  Rank
                </th>

                <th className="p-3">
                  Mercado
                </th>

                <th className="p-3">
                  Prob.
                </th>

                <th className="p-3">
                  Odd
                </th>

                <th className="p-3">
                  EV
                </th>

                <th className="p-3">
                  Edge
                </th>

                <th className="p-3">
                  Risco
                </th>

                <th className="p-3">
                  Ranking
                </th>

                <th className="p-3">
                  Kelly
                </th>

                <th className="p-3">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredMarkets.map(
                (
                  market,
                  index
                ) => {
                  const status =
                    getStatus(
                      market
                    );

                  const rank =
                    toFiniteNumber(
                      market.rank
                    ) ??
                    index + 1;

                  const ev =
                    getEv(
                      market
                    );

                  const edge =
                    getProbabilityEdge(
                      market
                    );

                  const risk =
                    getRisk(
                      market
                    );

                  const rankingScore =
                    getRankingScore(
                      market
                    );

                  return (
                    <tr
                      key={
                        getMarketKey(
                          market,
                          index
                        )
                      }
                      className={
                        `border-b border-gray-800 transition ${
                          rowHighlight(
                            status
                          )
                        }`
                      }
                    >
                      <td className="p-3 font-bold">
                        {rank === 1
                          ? "🥇"
                          : rank === 2
                            ? "🥈"
                            : rank === 3
                              ? "🥉"
                              : rank}
                      </td>

                      <td className="p-3 font-semibold">
                        {market.market ??
                          "—"}
                      </td>

                      <td className="p-3">
                        {formatPercent(
                          market.probability,
                          1
                        )}
                      </td>

                      <td className="p-3">
                        {formatDecimal(
                          market.odd,
                          2
                        )}
                      </td>

                      <td
                        className={
                          `p-3 font-semibold ${
                            ev !== null &&
                            ev > 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`
                        }
                      >
                        {formatPercent(
                          ev,
                          2
                        )}
                      </td>

                      <td className="p-3">
                        {formatPercent(
                          edge,
                          2
                        )}
                      </td>

                      <td className="p-3">
                        {formatPercent(
                          risk,
                          1
                        )}
                      </td>

                      <td className="p-3">
                        {formatDecimal(
                          rankingScore,
                          4
                        )}
                      </td>

                      <td className="p-3">
                        {formatPercent(
                          market.kelly,
                          1
                        )}
                      </td>

                      <td
                        className={
                          `p-3 font-bold ${
                            statusColor(
                              status
                            )
                          }`
                        }
                      >
                        {status}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>

          </table>
        </div>
      )}

    </div>
  );
}