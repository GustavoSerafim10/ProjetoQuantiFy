import {
  useMemo,
  useState
} from "react";

import {
  motion
} from "framer-motion";

import {
  registerBet,
  settleBet,
  getHistory
} from "../domain/tracking/trackingEngine";

/* ==========================================
   DASHBOARD — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - exibir a decisão final;
 * - exibir ranking de mercados;
 * - apresentar métricas calculadas;
 * - permitir confirmação manual da entrada;
 * - exibir e atualizar o histórico.
 *
 * O Dashboard não recalcula:
 *
 * - probabilidade;
 * - EV;
 * - risco;
 * - ranking;
 * - classificação.
 */

/* ==========================================
   TIPOS
========================================== */

type BetClassification =
  | "SCALPER"
  | "ELITE"
  | "BET"
  | "WATCHLIST"
  | "NO BET";

interface DashboardMarket {
  market?: string;

  odd?: number;
  probability?: number;

  ev?: number;
  probabilityEdge?: number;

  risk?: number;
  riskScore?: number;

  confidence?: number;

  rankingScore?: number;
  score?: number;
  rank?: number;

  kelly?: number;
  stake?: number;

  structureValid?: boolean;

  classification?:
    BetClassification;

  warnings?: string[];

  [key: string]: unknown;
}

interface TrackingBet {
  id: string;

  match?: string;
  market?: string;
  type?: string;

  odd?: number;
  probability?: number;
  ev?: number;

  result?:
    | "win"
    | "loss";

  [key: string]: unknown;
}

interface DashboardData {
  match?: string;

  best?:
    DashboardMarket | null;

  finalBest?:
    DashboardMarket | null;

  markets?:
    DashboardMarket[];

  noBet?: boolean;
  reason?: string;

  [key: string]: unknown;
}

/* ==========================================
   UI HELPERS
========================================== */

const Card = ({
  children
}: {
  children:
    React.ReactNode;
}) => (
  <motion.div
    initial={{
      opacity: 0,
      y: 10
    }}
    animate={{
      opacity: 1,
      y: 0
    }}
    className="backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 bg-white/5 shadow-lg"
  >
    {children}
  </motion.div>
);

const StrengthBar = ({
  value
}: {
  value?: number | null;
}) => {
  const normalized =
    clampProbability(
      value
    );

  return (
    <div className="w-full h-2 bg-zinc-800 rounded overflow-hidden mt-2">
      <div
        className="h-full bg-gradient-to-r from-green-400 to-emerald-500"
        style={{
          width:
            `${normalized * 100}%`
        }}
      />
    </div>
  );
};


const MARKET_LABELS: Record<string, string> = {
  HOME: "🏠 Casa",
  DRAW: "🤝 Empate",
  AWAY: "✈️ Fora",

  DOUBLE_CHANCE_1X: "🏠🤝 Casa ou Empate (1X)",
  DOUBLE_CHANCE_X2: "🤝✈️ Empate ou Fora (X2)",

  OVER_1_5: "⚽ Mais de 1.5 Gols",
  OVER_2_5: "⚽ Mais de 2.5 Gols",

  BTTS_YES: "🎯 Ambas Marcam – Sim",
  BTTS_NO: "🚫 Ambas Marcam – Não"
};

function getMarketLabel(
  market?: string
): string {
  if (!market) {
    return "Mercado";
  }

  return MARKET_LABELS[market] ?? market;
}

/* ==========================================
   VALUE HELPERS
========================================== */

function getValueTag(
  market?: DashboardMarket | null
): string {
  const ev =
    toFiniteNumber(
      market?.ev
    );

  if (ev === null) {
    return "⚪ SEM DADOS";
  }

  if (ev >= 0.12) {
    return "💎 VALUE BET";
  }

  if (ev >= 0.05) {
    return "🔥 BOA";
  }

  if (ev >= 0.02) {
    return "⚠️ MARGINAL";
  }

  if (ev > 0) {
    return "🟠 VALUE BAIXO";
  }

  return "❌ SEM VALUE";
}

function getValueColor(
  market?: DashboardMarket | null
): string {
  const ev =
    toFiniteNumber(
      market?.ev
    );

  if (ev === null) {
    return "text-zinc-400";
  }

  if (ev >= 0.12) {
    return "text-green-400";
  }

  if (ev >= 0.05) {
    return "text-emerald-400";
  }

  if (ev >= 0.02) {
    return "text-yellow-400";
  }

  if (ev > 0) {
    return "text-orange-400";
  }

  return "text-red-400";
}

const Glow = ({
  value
}: {
  value?: number | null;
}) => {
  const safeValue =
    toFiniteNumber(
      value
    );

  if (safeValue === null) {
    return (
      <span className="text-zinc-500">
        —
      </span>
    );
  }

  if (safeValue >= 0.15) {
    return (
      <span className="text-green-400 font-bold">
        {formatDecimal(
          safeValue,
          2
        )}
      </span>
    );
  }

  if (safeValue >= 0.08) {
    return (
      <span className="text-yellow-400">
        {formatDecimal(
          safeValue,
          2
        )}
      </span>
    );
  }

  if (safeValue > 0) {
    return (
      <span className="text-orange-400">
        {formatDecimal(
          safeValue,
          2
        )}
      </span>
    );
  }

  return (
    <span className="text-red-400">
      {formatDecimal(
        safeValue,
        2
      )}
    </span>
  );
};

function getRankingScore(
  market?: DashboardMarket | null
): number | null {
  return firstFiniteNumber([
    market?.rankingScore,
    market?.score
  ]);
}

function getRisk(
  market?: DashboardMarket | null
): number | null {
  return firstFiniteNumber([
    market?.riskScore,
    market?.risk
  ]);
}

function getHeat(
  market?: DashboardMarket | null
): string {
  if (
    market?.structureValid ===
    false
  ) {
    return (
      "border-red-500/30 " +
      "bg-red-500/5"
    );
  }

  const rankingScore =
    getRankingScore(
      market
    );

  if (
    rankingScore !== null &&
    rankingScore > 0.60
  ) {
    return (
      "border-green-500/40 " +
      "bg-green-500/10"
    );
  }

  if (
    rankingScore !== null &&
    rankingScore > 0.45
  ) {
    return (
      "border-yellow-500/30 " +
      "bg-yellow-500/10"
    );
  }

  return "border-zinc-700";
}

function getClassificationColor(
  classification?: BetClassification
): string {
  switch (classification) {
    case "SCALPER":
      return "text-cyan-400";

    case "ELITE":
      return "text-green-400";

    case "BET":
      return "text-blue-400";

    case "WATCHLIST":
      return "text-yellow-400";

    case "NO BET":
      return "text-red-400";

    default:
      return "text-zinc-400";
  }
}

/* ==========================================
   ESTATÍSTICAS
========================================== */

function calculateStats(
  history: TrackingBet[]
) {
  let wins = 0;
  let losses = 0;

  for (const bet of history) {
    if (bet.result === "win") {
      wins++;
    }

    if (bet.result === "loss") {
      losses++;
    }
  }

  const totalBets =
    wins +
    losses;

  const winrate =
    totalBets > 0
      ? (
          wins /
          totalBets
        ) * 100
      : 0;

  /*
   * ROI simplificado.
   *
   * Mantido conforme a lógica anterior.
   */
  const roi =
    totalBets > 0
      ? (
          (
            wins -
            losses
          ) /
          totalBets
        ) * 100
      : 0;

  return {
    wins,
    losses,
    totalBets,
    winrate,
    roi
  };
}

/* ==========================================
   DASHBOARD
========================================== */

export default function Dashboard({
  data
}: {
  data?: DashboardData | null;
}) {
  /*
   * Utilizado para atualizar o histórico após
   * registrar ou liquidar uma entrada.
   */
  const [
    historyVersion,
    setHistoryVersion
  ] = useState(0);

  const fullHistory =
    useMemo(
      () => {
        const storedHistory =
          getHistory();

        return Array.isArray(
          storedHistory
        )
          ? (
              storedHistory as
                TrackingBet[]
            )
          : [];
      },
      [
        historyVersion
      ]
    );

  const history =
    useMemo(
      () =>
        [
          ...fullHistory
        ].reverse(),
      [
        fullHistory
      ]
    );

  const stats =
    useMemo(
      () =>
        calculateStats(
          fullHistory
        ),
      [
        fullHistory
      ]
    );


const dashboardData: DashboardData =
  data ?? {};

const best =
  dashboardData.best ??
  dashboardData.finalBest ??
  null;

const markets: DashboardMarket[] =
  Array.isArray(
    dashboardData.markets
  )
    ? dashboardData.markets
    : [];

  /* ==========================================
     AÇÕES
  ========================================== */

  function register() {
    if (!best) {
      return;
    }

    const market =
      String(
        best.market ??
        ""
      ).trim();

    const odd =
      toFiniteNumber(
        best.odd
      );

    const probability =
      toFiniteNumber(
        best.probability
      );

    const ev =
      toFiniteNumber(
        best.ev
      );

    if (
      !market ||
      odd === null ||
      odd <= 1 ||
      probability === null ||
      ev === null
    ) {
      console.warn(
        "Não foi possível registrar a entrada: mercado incompleto.",
        best
      );

      return;
    }

    const classification =
      normalizeTrackingType(
        best.classification
      );

    const kelly =
      nonNegativeNumber(
        best.kelly
      );

    const suggestedStake =
      nonNegativeNumber(
        best.stake
      );

    registerBet({
      id:
        Date.now()
          .toString(),

   match:
  String(
    dashboardData.match ??
    "Jogo"
  ),

      market,

      odd,
      probability,
      ev,

      kelly,

      /*
       * O decisionPipeline retorna stake em fração
       * da banca. Não transformamos ausência em 100.
       */
      stake:
        suggestedStake,

      createdAt:
        Date.now(),

      type:
        classification
    });

    setHistoryVersion(
      version =>
        version + 1
    );
  }

  function settle(
    id: string,
    result:
      | "win"
      | "loss"
  ) {
    settleBet(
      id,
      result
    );

    setHistoryVersion(
      version =>
        version + 1
    );
  }

  /* ==========================================
     UI
  ========================================== */

  return (
    <div className="p-6 min-h-screen bg-black text-white space-y-6">

      {/* HEADER */}

      <h1 className="text-2xl font-bold tracking-wide">
        {dashboardData.match ||
          "Aguardando análise..."}
      </h1>

      {/* DECISÃO PRINCIPAL */}

      <Card>
        <h2 className="text-xs text-zinc-400">
          🎯 DECISÃO QUANTITATIVA
        </h2>

        {best ? (
          <>
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="text-2xl font-bold mt-2 text-green-400">
                  {getMarketLabel(best.market)}
                </div>

                <div
                  className={
                    `text-xs mt-1 font-semibold ${
                      getClassificationColor(
                        best.classification
                      )
                    }`
                  }
                >
                  {best.classification ??
                    "BET"}
                </div>
              </div>

              {best.rank !==
                undefined && (
                <div className="text-xs text-zinc-500">
                  Ranking #
                  {best.rank}
                </div>
              )}
            </div>

            <div
              className={
                `text-sm mt-2 font-bold ${
                  getValueColor(
                    best
                  )
                }`
              }
            >
              {getValueTag(
                best
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs mt-4 text-zinc-400">
              <Metric
                label="EV"
                value={
                  formatDecimal(
                    best.ev,
                    4
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
                label="Prob."
                value={
                  formatPercent(
                    best.probability,
                    1
                  )
                }
              />

              <Metric
                label="Risco"
                value={
                  formatPercent(
                    getRisk(
                      best
                    ),
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

            <StrengthBar
              value={
                best.probability
              }
            />
          </>
        ) : (
          <div className="text-red-400 mt-2">
            ⚠️ Nenhuma oportunidade passou pela política de decisão
            {dashboardData.reason
              ? ` — ${dashboardData.reason}`
              : ""}
          </div>
        )}
      </Card>

      {/* ESTATÍSTICAS */}

      <div className="grid md:grid-cols-5 gap-4">

        <Card>
          <h2 className="text-xs text-zinc-400">
            💰 ROI
          </h2>

          <div className="text-2xl font-bold text-green-400 mt-2">
            {formatDecimal(
              stats.roi,
              1
            )}
            %
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            🎯 WINRATE
          </h2>

          <div className="text-2xl font-bold mt-2">
            {formatDecimal(
              stats.winrate,
              0
            )}
            %
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            📈 BETS
          </h2>

          <div className="text-2xl font-bold mt-2">
            {stats.totalBets}
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            ✅ WIN
          </h2>

          <div className="text-2xl font-bold text-green-400 mt-2">
            {stats.wins}
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            ❌ LOSS
          </h2>

          <div className="text-2xl font-bold text-red-400 mt-2">
            {stats.losses}
          </div>
        </Card>

      </div>

      {/* RANKING */}

      <Card>
        <h2 className="font-bold mb-3">
          🔥 Ranking de Valor
        </h2>

        {markets.length >
        0 ? (
          <div className="space-y-2">
            {markets
              .slice(
                0,
                5
              )
              .map(
                (
                  market,
                  index
                ) => (
                  <div
                    key={
                      String(
                        market.market ??
                        index
                      )
                    }
                    className={
                      `p-3 rounded-xl border ${
                        getHeat(
                          market
                        )
                      }`
                    }
                  >
                    <div className="flex justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">
                          #
                          {market.rank ??
                            index + 1}
                        </span>

                        <span>
                          {getMarketLabel(market.market)}
                        </span>
                      </div>

                      <span
                        className={
                          getValueColor(
                            market
                          )
                        }
                      >
                        {getValueTag(
                          market
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs mt-2">
                      <span>
                        EV:{" "}
                        <Glow
                          value={
                            market.ev
                          }
                        />
                      </span>

                      <span>
                        Ranking:{" "}
                        {formatDecimal(
                          getRankingScore(
                            market
                          ),
                          4
                        )}
                      </span>

                      <span>
                        Prob.:{" "}
                        {formatPercent(
                          market.probability,
                          1
                        )}
                      </span>

                      <span>
                        Risco:{" "}
                        {formatPercent(
                          getRisk(
                            market
                          ),
                          1
                        )}
                      </span>

                      <span
                        className={
                          getClassificationColor(
                            market.classification
                          )
                        }
                      >
                        {market.classification ??
                          "NO BET"}
                      </span>
                    </div>

                    <StrengthBar
                      value={
                        market.probability
                      }
                    />
                  </div>
                )
              )}
          </div>
        ) : (
          <div className="text-sm text-zinc-500">
            Nenhum mercado disponível para exibição.
          </div>
        )}
      </Card>

      {/* PERFORMANCE */}

      <Card>
        <h2 className="mb-3">
          📈 Performance
        </h2>

        <div className="flex gap-2 text-sm">
          {history
            .slice(
              0,
              10
            )
            .map(
              (
                bet,
                index
              ) => (
                <span
                  key={
                    bet.id ??
                    index
                  }
                  className={
                    bet.result ===
                    "win"
                      ? "text-green-400"
                      : bet.result ===
                        "loss"
                        ? "text-red-400"
                        : "text-zinc-500"
                  }
                >
                  {bet.result ===
                  "win"
                    ? "W"
                    : bet.result ===
                      "loss"
                      ? "L"
                      : "-"}
                </span>
              )
            )}
        </div>

        <div className="text-xs text-zinc-400 mt-2">
          Últimas 10 entradas
        </div>
      </Card>

      {/* HISTÓRICO */}

      <Card>
        <h2 className="mb-3">
          📜 Execuções
        </h2>

        <div className="max-h-[320px] overflow-y-auto overflow-x-hidden pr-2">
          {history.length >
          0 ? (
            history.map(
              (
                bet,
                index
              ) => (
                <div
                  key={
                    bet.id ??
                    index
                  }
                  className="border-b border-zinc-800 py-2 flex justify-between items-center gap-3"
                >
                  <div className="flex flex-col text-xs">
                    <span className="font-semibold text-white">
                      {bet.match ||
                        "Jogo"}
                    </span>

                    <span className="text-zinc-400">
                      {getMarketLabel(bet.market)}
                    </span>

                    <span className="text-[10px] text-blue-400">
                      {bet.type ||
                        "BET"}
                    </span>

                    <span className="text-zinc-500 text-[10px]">
                      Odd{" "}
                      {formatDecimal(
                        bet.odd,
                        2
                      )}
                      {" | "}
                      Prob.{" "}
                      {formatPercent(
                        bet.probability,
                        1
                      )}
                      {" | "}
                      EV{" "}
                      {formatDecimal(
                        bet.ev,
                        4
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {bet.result ? (
                      <span
                        className={
                          bet.result ===
                          "win"
                            ? "text-green-400 text-xs"
                            : "text-red-400 text-xs"
                        }
                      >
                        {bet.result.toUpperCase()}
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            settle(
                              bet.id,
                              "win"
                            )
                          }
                          className="text-green-400 text-[10px]"
                        >
                          WIN
                        </button>

                        <button
                          onClick={() =>
                            settle(
                              bet.id,
                              "loss"
                            )
                          }
                          className="text-red-400 text-[10px]"
                        >
                          LOSS
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            )
          ) : (
            <div className="text-xs text-zinc-500">
              Nenhuma execução registrada.
            </div>
          )}
        </div>
      </Card>

      {/* CONTROLES */}

      <div className="flex gap-2">
        <button
          onClick={
            register
          }
          disabled={
            !best
          }
          className={
            best
              ? "bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded"
              : "bg-zinc-800 text-zinc-500 px-4 py-2 rounded cursor-not-allowed"
          }
        >
          Registrar entrada
        </button>
      </div>

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
    <div className="rounded-lg border border-zinc-800 p-2">
      <div className="text-[10px] text-zinc-500">
        {label}
      </div>

      <div className="text-sm text-zinc-200 mt-1">
        {value}
      </div>
    </div>
  );
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

function nonNegativeNumber(
  value: unknown
): number {
  const parsed =
    toFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed < 0
  ) {
    return 0;
  }

  return parsed;
}

function clampProbability(
  value: unknown
): number {
  const parsed =
    toFiniteNumber(
      value
    );

  if (parsed === null) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      parsed,
      1
    )
  );
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

function formatPercent(
  value: unknown,
  decimals = 0
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

function normalizeTrackingType(
  value: unknown
):
  | "SCALPER"
  | "ELITE"
  | "BET" {
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
    default:
      return "BET";
  }
}