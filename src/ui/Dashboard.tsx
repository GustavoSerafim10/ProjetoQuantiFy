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
  getHistory,
  getStats
} from "../domain/tracking/trackingEngine";

import type { AnalysisSnapshot } from "../domain/tracking/trackingEngine";

import { buildCalibrationReport } from "../domain/tracking/calibrationReport";
import CalibrationPanel from "./CalibrationPanel";

import type { MarketCode } from "../shared/types/marketCode";

import {
  MIN_TEMPO_FACTOR,
  MAX_TEMPO_FACTOR,
  MIN_PRESSURE_FACTOR,
  MAX_PRESSURE_FACTOR
} from "../domain/context/contextEngine";

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

/*
 * Fase 4 do redesign visual (2026-09-09) — "Match Intelligence
 * Radar". Só VISUALIZA números que o motor já calcula — nenhum eixo
 * aqui é um score novo inventado pra caber no gráfico:
 *
 * - Ataque: goalExpectationScore (já existe, 0-1).
 * - Ritmo / Pressão: tempoFactor/pressureFactor (já existem,
 *   normalizados pela mesma faixa ±18% de contextEngine.ts —
 *   MIN/MAX_TEMPO_FACTOR e MIN/MAX_PRESSURE_FACTOR).
 * - Equilíbrio: transformação direta e transparente de
 *   |lambdaHome - lambdaAway| (diferença real, só reescalada pra
 *   0-100 — não é uma opinião nova, é o mesmo número de outro jeito).
 * - Confiança: confidence (já existe, 0-1).
 */
interface RadarAxis {
  label: string;
  value: number;
}

function RadarChart({
  axes
}: {
  axes: RadarAxis[];
}) {
  const size = 220;
  const center = size / 2;
  const radius = size / 2 - 34;
  const angleStep = (Math.PI * 2) / axes.length;

  const angleFor = (index: number) =>
    -Math.PI / 2 + index * angleStep;

  const points = axes.map((axis, index) => {
    const angle = angleFor(index);
    const r = radius * clampProbability(axis.value);

    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      labelX: center + (radius + 20) * Math.cos(angle),
      labelY: center + (radius + 20) * Math.sin(angle),
      axis
    };
  });

  const polygonPoints = points
    .map(point => `${point.x},${point.y}`)
    .join(" ");

  const rings = [0.25, 0.5, 0.75, 1].map(fraction =>
    axes
      .map((_, index) => {
        const angle = angleFor(index);
        const r = radius * fraction;

        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
      })
      .join(" ")
  );

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[240px] mx-auto"
    >
      {rings.map((ring, index) => (
        <polygon
          key={index}
          points={ring}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}

      {axes.map((_, index) => (
        <line
          key={index}
          x1={center}
          y1={center}
          x2={
            center +
            radius * Math.cos(angleFor(index))
          }
          y2={
            center +
            radius * Math.sin(angleFor(index))
          }
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}

      <polygon
        points={polygonPoints}
        fill="rgba(25,230,140,0.18)"
        stroke="#19E68C"
        strokeWidth="2"
      />

      {points.map((point, index) => (
        <text
          key={index}
          x={point.labelX}
          y={point.labelY}
          fontSize="9"
          fill="#9aa4bf"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {point.axis.label}
        </text>
      ))}
    </svg>
  );
}


const MARKET_LABELS: Record<MarketCode, string> = {
  HOME: "🏠 Casa",
  DRAW: "🤝 Empate",
  AWAY: "✈️ Fora",

  DOUBLE_CHANCE_1X: "🏠🤝 Casa ou Empate (1X)",
  DOUBLE_CHANCE_X2: "🤝✈️ Empate ou Fora (X2)",

  OVER_1_5: "⚽ Mais de 1.5 Gols",
  OVER_2_5: "⚽ Mais de 2.5 Gols",

  UNDER_1_5: "🥅 Menos de 1.5 Gols",
  UNDER_2_5: "🥅 Menos de 2.5 Gols",

  BTTS_YES: "🎯 Ambas Marcam – Sim",
  BTTS_NO: "🚫 Ambas Marcam – Não",

  DNB_HOME: "🏠🛡️ Empate Anula (Casa)",
  DNB_AWAY: "✈️🛡️ Empate Anula (Fora)"
};

function isMarketCode(
  market: string
): market is MarketCode {
  return Object.prototype.hasOwnProperty.call(
    MARKET_LABELS,
    market
  );
}

function getMarketLabel(
  market?: string
): string {
  if (!market) {
    return "Mercado";
  }

  return isMarketCode(market)
    ? MARKET_LABELS[market]
    : market;
}

/* ==========================================
   VALUE HELPERS
========================================== */

/*
 * Auditoria 2026-08-22 + Fase 3 do redesign (2026-09-09): mesma
 * honestidade de sempre — nunca mostra uma classificação aprovada
 * quando o decisionPipeline marcou `decisionValid: false`, mesmo que
 * `classification` ainda carregue um valor de um estágio anterior.
 * A coluna "Status" do Market Lab usa isto em vez do campo cru.
 */
function getHonestClassification(
  market?: DashboardMarket | null
): BetClassification {
  if (market?.decisionValid === false) {
    return "NO BET";
  }

  return (
    (market?.classification as
      BetClassification | undefined) ??
    "NO BET"
  );
}

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

interface DashboardExplain {
  summary: string;
  positives: string[];
  negatives: string[];
}

/*
 * `market.explain` vem do decisionPipeline (Fase 1 do Decision
 * Intelligence Layer — ver evaluateMarket.ts/explain.ts) já pronto
 * para leitura humana. Aqui só validamos o formato antes de
 * renderizar, sem recalcular nada.
 */
function getExplain(
  market?: DashboardMarket | null
): DashboardExplain | null {
  const explain = market?.explain;

  if (
    !explain ||
    typeof explain !== "object"
  ) {
    return null;
  }

  const record =
    explain as Record<string, unknown>;

  const summary =
    typeof record.summary === "string"
      ? record.summary
      : "";

  const positives =
    Array.isArray(record.positives)
      ? record.positives.filter(
          (item): item is string =>
            typeof item === "string"
        )
      : [];

  const negatives =
    Array.isArray(record.negatives)
      ? record.negatives.filter(
          (item): item is string =>
            typeof item === "string"
        )
      : [];

  if (
    !summary &&
    positives.length === 0 &&
    negatives.length === 0
  ) {
    return null;
  }

  return { summary, positives, negatives };
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

/*
 * `fairOdd` já vem pronto do valuePipeline na maioria dos casos;
 * quando ausente (fonte de dado mais antiga), 1/probabilidade é
 * matematicamente a mesma coisa (odd justa = inverso da
 * probabilidade), então não é um número novo, só o mesmo cálculo
 * feito aqui em vez de lá.
 */
function getFairOdd(
  market?: DashboardMarket | null
): number | null {
  const fairOdd =
    toFiniteNumber(market?.fairOdd);

  if (fairOdd !== null) {
    return fairOdd;
  }

  const probability =
    toFiniteNumber(market?.probability);

  return probability !== null && probability > 0
    ? 1 / probability
    : null;
}

/*
 * Fase 3 do redesign visual (2026-09-09) — "Quantify Verdict".
 * `best` só existe quando o decisionPipeline já aprovou de verdade
 * (actionableMarkets filtra por decisionValid === true antes de
 * escolher `best` — ver decisionPipeline/index.ts), então não precisa
 * de checagem extra aqui como a tabela Market Lab precisa.
 */
function getVerdictBadge(
  classification?: BetClassification
): { label: string; className: string } {
  switch (classification) {
    case "SCALPER":
      return {
        label: "🔵 SCALPER",
        className:
          "text-quantify-cyan border-quantify-cyan/40 bg-quantify-cyan/10"
      };

    case "ELITE":
      return {
        label: "🟢 ELITE",
        className:
          "text-quantify-green border-quantify-green/40 bg-quantify-green/10"
      };

    case "BET":
      return {
        label: "🟢 BET",
        className:
          "text-quantify-green border-quantify-green/40 bg-quantify-green/10"
      };

    case "WATCHLIST":
      return {
        label: "🟡 WATCHLIST",
        className:
          "text-quantify-yellow border-quantify-yellow/40 bg-quantify-yellow/10"
      };

    default:
      return {
        label: "🔴 NO BET",
        className:
          "text-quantify-red border-quantify-red/40 bg-quantify-red/10"
      };
  }
}

/*
 * Isolado fora do componente porque o timestamp só deve
 * ser lido no momento do clique (dentro do handler), nunca
 * durante o render.
 */
function currentTimestamp() {
  return Date.now();
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

  /*
   * Qual mercado do card "Ranking de Valor" tem o "Por quê?"
   * aberto. Só um por vez — não precisa persistir entre análises.
   */
  const [
    expandedExplainKey,
    setExpandedExplainKey
  ] = useState<string | null>(null);

  /*
   * AUDITORIA (2026-09-05): o card principal "DECISÃO
   * QUANTITATIVA" mostra `best` mas nunca teve o "Por quê?" —
   * só o card menor "Ranking de Valor" tinha. Corrigido: mesmo
   * dado (best.explain), estado de expansão independente.
   */
  const [
    isBestExplainOpen,
    setIsBestExplainOpen
  ] = useState(false);

  const fullHistory =
    useMemo(
      () => {
        const storedHistory =
          getHistory();

        return Array.isArray(
          storedHistory
        )
          ? storedHistory
          : [];
      },
      /*
       * historyVersion não é lido no corpo do callback:
       * é apenas o gatilho para reler getHistory(), que
       * vem de um store externo mutável (trackingEngine).
       */
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /*
   * Estatísticas oficiais vêm de trackingEngine.getStats() —
   * a mesma fonte usada pelo relatório de performance. O
   * Dashboard não recalcula ROI/winrate por conta própria.
   */
  const stats =
    useMemo(
      () =>
        getStats(),
      /*
       * Mesmo motivo do useMemo acima: historyVersion só
       * força a releitura de getStats() após registrar ou
       * liquidar uma entrada.
       */
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        historyVersion
      ]
    );

  const calibrationReport =
    useMemo(
      () =>
        buildCalibrationReport(fullHistory),
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

/*
 * A tabela do Market Lab mostra TODOS os mercados (nunca corta a
 * lista), ordenados pela EV de verdade — antes a lista vinha na
 * ordem do rankingScore composto (rank interno da decisão) e a
 * tabela cortava para as 5 primeiras, então o card "Melhor EV
 * encontrado" podia apontar pra um mercado que nem aparecia embaixo.
 * Aqui é só apresentação: nenhum valor de probabilidade/EV/decisão é
 * recalculado, só a ordem de exibição muda.
 */
const marketsByEv: DashboardMarket[] =
  [...markets].sort(
    (a, b) =>
      safeEvForSort(b.ev) -
      safeEvForSort(a.ev)
  );

/*
 * Fase 4 — Match Intelligence Radar. Normaliza campos que o motor já
 * produz (ver comentário em RadarChart acima) para 0-1, sem inventar
 * nenhum número novo.
 */
const radarLambdaHome =
  toFiniteNumber(
    dashboardData.lambdaHome
  );

const radarLambdaAway =
  toFiniteNumber(
    dashboardData.lambdaAway
  );

const radarBalance =
  radarLambdaHome !== null &&
  radarLambdaAway !== null
    ? 1 -
      Math.min(
        Math.abs(radarLambdaHome - radarLambdaAway) / 2,
        1
      )
    : 0;

const radarAxes: RadarAxis[] = [
  {
    label: "Ataque",
    value: clampProbability(
      dashboardData.goalExpectationScore
    )
  },

  {
    label: "Ritmo",
    value: normalizeToUnit(
      toFiniteNumber(dashboardData.tempoFactor),
      MIN_TEMPO_FACTOR,
      MAX_TEMPO_FACTOR
    )
  },

  {
    label: "Pressão",
    value: normalizeToUnit(
      toFiniteNumber(dashboardData.pressureFactor),
      MIN_PRESSURE_FACTOR,
      MAX_PRESSURE_FACTOR
    )
  },

  {
    label: "Equilíbrio",
    value: radarBalance
  },

  {
    label: "Confiança",
    value: clampProbability(
      dashboardData.confidence
    )
  }
];

  /* ==========================================
     AÇÕES
  ========================================== */

  function handleRegister() {
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
        currentTimestamp()
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
        currentTimestamp(),

      type:
        classification,

      analysisSnapshot:
        buildAnalysisSnapshot(
          dashboardData,
          best
        )
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

      {/* QUANTIFY VERDICT */}

      <Card>
        <h2 className="text-xs text-zinc-400 tracking-wide">
          ⚽ QUANTIFY VERDICT
        </h2>

        {best ? (
          <>
            <div className="flex justify-between items-center gap-3 mt-3">
              <span
                className={
                  `text-sm font-bold px-3 py-1 rounded-full border ${
                    getVerdictBadge(best.classification).className
                  }`
                }
              >
                {getVerdictBadge(best.classification).label}
              </span>

              {best.rank !==
                undefined && (
                <div className="text-xs text-zinc-500">
                  Ranking #
                  {best.rank}
                </div>
              )}
            </div>

            <div className="text-2xl font-bold mt-3 text-quantify-ice">
              {getMarketLabel(best.market)}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mt-4 text-zinc-400">
              <Metric
                label="Probabilidade do modelo"
                value={
                  formatPercent(
                    best.probability,
                    1
                  )
                }
              />

              <Metric
                label="Odd justa"
                value={
                  formatDecimal(
                    getFairOdd(best),
                    2
                  )
                }
              />

              <Metric
                label="Odd de mercado"
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
                    1
                  )
                }
              />

              <Metric
                label="Confiança"
                value={
                  formatPercent(
                    best.confidence,
                    0
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
                    0
                  )
                }
              />
            </div>

            <StrengthBar
              value={
                best.probability
              }
            />

            <div className="text-xs text-quantify-cyan mt-3">
              🧠 Passou por todas as validações do DecisionPipeline
            </div>

            {(() => {
              const bestExplain = getExplain(best);

              if (!bestExplain) {
                return null;
              }

              return (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setIsBestExplainOpen(
                        open => !open
                      )
                    }
                    className="text-xs text-zinc-400 hover:text-zinc-200 mt-3 underline decoration-dotted"
                  >
                    {isBestExplainOpen
                      ? "Ocultar por quê"
                      : "Por quê?"}
                  </button>

                  {isBestExplainOpen && (
                    <div className="mt-2 text-xs space-y-2 border-t border-zinc-800 pt-2">
                      <div className="text-zinc-300">
                        {bestExplain.summary}
                      </div>

                      {bestExplain.positives.length > 0 && (
                        <ul className="space-y-1">
                          {bestExplain.positives.map(
                            (item, itemIndex) => (
                              <li
                                key={`best-positive-${itemIndex}`}
                                className="text-green-400"
                              >
                                + {item}
                              </li>
                            )
                          )}
                        </ul>
                      )}

                      {bestExplain.negatives.length > 0 && (
                        <ul className="space-y-1">
                          {bestExplain.negatives.map(
                            (item, itemIndex) => (
                              <li
                                key={`best-negative-${itemIndex}`}
                                className="text-red-400"
                              >
                                - {item}
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        ) : (
          <div className="mt-3">
            <span className="text-sm font-bold px-3 py-1 rounded-full border text-quantify-red border-quantify-red/40 bg-quantify-red/10">
              🔴 NO BET
            </span>

            <div className="text-sm text-zinc-400 mt-3">
              Nenhum mercado sobreviveu ao DecisionPipeline
              {dashboardData.reason
                ? ` — ${dashboardData.reason}`
                : ""}.
            </div>

            {markets.length > 0 && (() => {
              const evValues =
                markets
                  .map(m => toFiniteNumber(m.ev))
                  .filter(
                    (v): v is number => v !== null
                  );

              const positiveEvCount =
                evValues.filter(v => v > 0).length;

              const bestEv =
                evValues.length > 0
                  ? Math.max(...evValues)
                  : null;

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mt-3">
                  <Metric
                    label="Mercados avaliados"
                    value={String(markets.length)}
                  />

                  <Metric
                    label="Com EV positivo"
                    value={String(positiveEvCount)}
                  />

                  <Metric
                    label="Melhor EV encontrado"
                    value={formatPercent(bestEv, 1)}
                  />
                </div>
              );
            })()}
          </div>
        )}
      </Card>

      {/* MATCH INTELLIGENCE RADAR */}

      {best && (
        <Card>
          <h2 className="text-xs text-zinc-400 tracking-wide mb-1">
            🧭 Match Intelligence Radar
          </h2>

          <RadarChart axes={radarAxes} />
        </Card>
      )}

      {/* ESTATÍSTICAS */}

      <div className="text-xs text-zinc-500 -mb-2">
        📊 Histórico consolidado de todas as entradas já registradas —
        independente da análise em tela acima.
      </div>

      <div className="grid md:grid-cols-7 gap-4">

        <Card>
          <h2 className="text-xs text-zinc-400">
            💰 ROI
          </h2>

          <div
            className={
              `text-2xl font-bold mt-2 ${
                stats.roi >= 0
                  ? "text-quantify-green"
                  : "text-quantify-red"
              }`
            }
          >
            {formatPercent(
              stats.roi,
              1
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            🎯 WINRATE
          </h2>

          <div className="text-2xl font-bold mt-2 text-quantify-ice">
            {formatPercent(
              stats.winRate,
              0
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            📈 BETS
          </h2>

          <div className="text-2xl font-bold mt-2 text-quantify-ice">
            {stats.totalBets}
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            ✅ WIN
          </h2>

          <div className="text-2xl font-bold text-quantify-green mt-2">
            {stats.wins}
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            ❌ LOSS
          </h2>

          <div className="text-2xl font-bold text-quantify-red mt-2">
            {stats.losses}
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            📊 EV MÉDIO
          </h2>

          <div className="text-2xl font-bold mt-2 text-quantify-ice">
            {formatPercent(
              stats.evMedio,
              1
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-xs text-zinc-400">
            🎲 ODD MÉDIA
          </h2>

          <div className="text-2xl font-bold mt-2 text-quantify-ice">
            {formatDecimal(
              stats.oddMedia,
              2
            )}
          </div>
        </Card>

      </div>

      {/* CALIBRAÇÃO */}

      <CalibrationPanel report={calibrationReport} />

      {/* MARKET LAB */}

      <Card>
        <h2 className="font-bold mb-3">
          📊 Market Lab
        </h2>

        {markets.length >
        0 ? (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead className="sticky top-0 bg-quantify-bg/95 backdrop-blur-xl">
                <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-2">
                    Mercado
                  </th>

                  <th className="py-2 px-2 text-right">
                    Modelo
                  </th>

                  <th className="py-2 px-2 text-right">
                    Odd justa
                  </th>

                  <th className="py-2 px-2 text-right">
                    Sua odd
                  </th>

                  <th className="py-2 px-2 text-right">
                    EV
                  </th>

                  <th className="py-2 pl-2 text-right">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {marketsByEv
                  .map(
                    (
                      market,
                      index
                    ) => {
                      const explainKey =
                        String(
                          market.market ??
                          index
                        );

                      const explain =
                        getExplain(market);

                      const isExplainOpen =
                        expandedExplainKey ===
                        explainKey;

                      const ev =
                        toFiniteNumber(
                          market.ev
                        );

                      return (
                        <>
                          <tr
                            key={
                              explainKey
                            }
                            onClick={() =>
                              explain &&
                              setExpandedExplainKey(
                                isExplainOpen
                                  ? null
                                  : explainKey
                              )
                            }
                            className={
                              `border-b border-zinc-800/60 ${
                                explain
                                  ? "cursor-pointer hover:bg-white/5"
                                  : ""
                              } ${
                                getHeat(
                                  market
                                )
                              }`
                            }
                          >
                            <td className="py-2.5 pr-2">
                              <span className="text-zinc-600 mr-1">
                                #
                                {index + 1}
                              </span>

                              {getMarketLabel(market.market)}
                            </td>

                            <td className="py-2.5 px-2 text-right">
                              {formatPercent(
                                market.probability,
                                1
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-right text-zinc-400">
                              {formatDecimal(
                                getFairOdd(market),
                                2
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-right">
                              {formatDecimal(
                                market.odd,
                                2
                              )}
                            </td>

                            <td
                              className={
                                `py-2.5 px-2 text-right font-semibold ${
                                  ev !== null && ev > 0
                                    ? "text-quantify-green"
                                    : "text-quantify-red"
                                }`
                              }
                            >
                              {formatPercent(
                                market.ev,
                                1
                              )}
                            </td>

                            <td
                              className={
                                `py-2.5 pl-2 text-right font-semibold ${
                                  getClassificationColor(
                                    getHonestClassification(market)
                                  )
                                }`
                              }
                            >
                              {getHonestClassification(market)}
                            </td>
                          </tr>

                          {isExplainOpen && explain && (
                            <tr key={`${explainKey}-explain`}>
                              <td
                                colSpan={6}
                                className="pb-3 px-2"
                              >
                                <div className="text-xs space-y-2 border-t border-zinc-800 pt-2">
                                  <div className="text-zinc-300">
                                    {explain.summary}
                                  </div>

                                  {explain.positives.length > 0 && (
                                    <ul className="space-y-1">
                                      {explain.positives.map(
                                        (item, itemIndex) => (
                                          <li
                                            key={`positive-${itemIndex}`}
                                            className="text-green-400"
                                          >
                                            + {item}
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  )}

                                  {explain.negatives.length > 0 && (
                                    <ul className="space-y-1">
                                      {explain.negatives.map(
                                        (item, itemIndex) => (
                                          <li
                                            key={`negative-${itemIndex}`}
                                            className="text-red-400"
                                          >
                                            - {item}
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    }
                  )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">
            Os mercados analisados aparecerão aqui assim que uma
            análise rodar — mesmo quando o resultado for NO BET.
          </div>
        )}
      </Card>

      {/* PERFORMANCE */}

      <Card>
        <h2 className="mb-3">
          📈 Performance
        </h2>

        {history.length > 0 ? (
          <>
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
                          ? "text-quantify-green"
                          : bet.result ===
                            "loss"
                            ? "text-quantify-red"
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
          </>
        ) : (
          <div className="text-sm text-zinc-500">
            Nenhuma entrada liquidada ainda. Assim que houver
            histórico, este painel mostra o desempenho recente.
          </div>
        )}
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
                    <span className="font-semibold text-quantify-ice">
                      {bet.match ||
                        "Jogo"}
                    </span>

                    <span className="text-zinc-400">
                      {getMarketLabel(bet.market)}
                    </span>

                    <span className="text-[10px] text-quantify-cyan">
                      {bet.type ||
                        "BET"}
                      {bet.source ===
                        "AI" &&
                        " · 🧠 IA"}
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
                            ? "text-quantify-green text-xs"
                            : "text-quantify-red text-xs"
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
                          className="text-quantify-green text-[10px]"
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
                          className="text-quantify-red text-[10px]"
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
              Nenhuma execução registrada ainda. Registre uma entrada
              aprovada pra começar o acompanhamento operacional.
            </div>
          )}
        </div>
      </Card>

      {/* CONTROLES */}

      <div className="flex gap-2">
        <button
          onClick={
            handleRegister
          }
          disabled={
            !best
          }
          className={
            best
              ? "bg-quantify-green text-quantify-bg font-semibold hover:brightness-110 px-4 py-2 rounded"
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

function safeEvForSort(
  value: unknown
): number {
  const parsed =
    toFiniteNumber(value);

  return parsed ??
    Number.NEGATIVE_INFINITY;
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

/*
 * Guarda o payload bruto da análise junto com a aposta, para
 * permitir auditoria futura contra jogos já encerrados (sem
 * isso, o histórico só tem odd/probabilidade/EV do resultado,
 * nunca os stats digitados nem os fatores intermediários que
 * geraram aquele número).
 */
function buildAnalysisSnapshot(
  dashboardData: DashboardData,
  registeredMarket?:
    DashboardMarket |
    null
): AnalysisSnapshot {
  const debug =
    dashboardData.debug as
      | Record<string, unknown>
      | undefined;

  const uncertainty =
    registeredMarket?.uncertainty as
      | Record<string, unknown>
      | undefined;

  const robustness =
    registeredMarket?.robustness as
      | Record<string, unknown>
      | undefined;

  const registeredMarketDebug =
    registeredMarket?.debug as
      | Record<string, unknown>
      | undefined;

  const correlationEngineDebug =
    registeredMarketDebug
      ?.correlationEngine as
      | Record<string, unknown>
      | undefined;

  const familyConsensus =
    registeredMarket?.familyConsensus as
      | { direction?: unknown; confirmingMarkets?: unknown }
      | undefined;

  const explainRecord =
    registeredMarket?.explain as
      | Record<string, unknown>
      | undefined;

  const modelDebug =
    debug?.modelPipeline as
      | Record<string, unknown>
      | undefined;

  const contextAdjusted =
    modelDebug?.contextAdjusted as
      | Record<string, unknown>
      | undefined;

  return {
    input:
      dashboardData.input,

    homeStats:
      dashboardData.homeStats,

    awayStats:
      dashboardData.awayStats,

    league:
      typeof dashboardData.league ===
        "string"
        ? dashboardData.league
        : undefined,

    lambdaHome:
      toFiniteNumber(
        dashboardData.lambdaHome
      ) ??
      undefined,

    lambdaAway:
      toFiniteNumber(
        dashboardData.lambdaAway
      ) ??
      undefined,

    totalLambda:
      toFiniteNumber(
        dashboardData.totalLambda
      ) ??
      undefined,

    tempoFactor:
      toFiniteNumber(
        dashboardData.tempoFactor ??
        contextAdjusted?.tempoFactor
      ) ??
      undefined,

    pressureFactor:
      toFiniteNumber(
        dashboardData.pressureFactor ??
        contextAdjusted?.pressureFactor
      ) ??
      undefined,

    modelAgreementScore:
      toFiniteNumber(
        registeredMarket?.modelAgreementScore
      ),

    effectiveProbability:
      toFiniteNumber(
        uncertainty?.effectiveProbability
      ),

    uncertaintyPenalty:
      toFiniteNumber(
        uncertainty?.uncertaintyPenalty
      ),

    uncertaintyClassification:
      typeof registeredMarket
        ?.uncertaintyClassification ===
        "string"
        ? registeredMarket.uncertaintyClassification
        : null,

    robustnessScore:
      toFiniteNumber(
        robustness?.robustnessScore
      ),

    correlationPenaltyDiagnostic:
      toFiniteNumber(
        registeredMarket
          ?.correlationPenaltyDiagnostic
      ),

    mostRedundantWith:
      typeof correlationEngineDebug
        ?.mostRedundantWith ===
        "string"
        ? correlationEngineDebug.mostRedundantWith
        : null,

    decisionScore:
      toFiniteNumber(
        registeredMarket?.decisionScore
      ),

    extremeValueClassification:
      typeof registeredMarket
        ?.extremeValueClassification ===
        "string"
        ? registeredMarket.extremeValueClassification
        : null,

    familyConsensusDirection:
      typeof familyConsensus?.direction ===
        "string"
        ? familyConsensus.direction
        : null,

    familyConsensusMarkets:
      Array.isArray(
        familyConsensus?.confirmingMarkets
      )
        ? familyConsensus.confirmingMarkets
        : null,

    decisionState:
      typeof registeredMarket
        ?.decisionState ===
        "string"
        ? registeredMarket.decisionState
        : null,

    decisionDrivers:
      Array.isArray(
        explainRecord?.decisionDrivers
      )
        ? explainRecord.decisionDrivers
        : null,

    decisionWarnings:
      Array.isArray(
        explainRecord?.decisionWarnings
      )
        ? explainRecord.decisionWarnings
        : null
  };
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

/*
 * Normaliza um valor real (ex: tempoFactor, ~0.82-1.18) pra 0-1
 * dividindo primeiro e só então limitando — ao contrário de limitar
 * antes de dividir, isso continua correto mesmo se a faixa min/max
 * mudar de tamanho no futuro.
 */
function normalizeToUnit(
  value: number | null,
  min: number,
  max: number
): number {
  if (value === null || max <= min) {
    return 0;
  }

  return clampProbability(
    (value - min) / (max - min)
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