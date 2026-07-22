import {
  useMemo
} from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

import {
  getHistory
} from "../domain/tracking/trackingEngine";

/* ==========================================
   BANKROLL CHART — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - ler o histórico liquidado;
 * - calcular o resultado acumulado;
 * - exibir a curva de evolução;
 * - não recalcular stake, ROI ou decisão.
 */

/* ==========================================
   CONTRATOS
========================================== */

interface TrackingEntry {
  result?:
    | "win"
    | "loss";

  profit?: number;

  [key: string]:
    unknown;
}

interface BankrollPoint {
  index: number;
  bankroll: number;
}

/* ==========================================
   COMPONENTE
========================================== */

export default function BankrollChart() {
  const history =
    useMemo(
      () => {
        const storedHistory =
          getHistory();

        if (
          !Array.isArray(
            storedHistory
          )
        ) {
          return [];
        }

        return (
          storedHistory as
            TrackingEntry[]
        ).filter(
          entry =>
            entry.result ===
              "win" ||
            entry.result ===
              "loss"
        );
      },
      []
    );

  const data =
    useMemo(
      () =>
        buildBankrollData(
          history
        ),
      [
        history
      ]
    );

  if (
    data.length === 0
  ) {
    return null;
  }

  const finalValue =
    data[
      data.length - 1
    ]?.bankroll ??
    0;

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-zinc-800">

      <h2 className="text-lg font-bold mb-4">
        📈 Evolução da Banca
      </h2>

      <ResponsiveContainer
        width="100%"
        height={300}
      >
        <LineChart
          data={data}
          margin={{
            top: 10,
            right: 12,
            left: 0,
            bottom: 0
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#27272a"
          />

          <XAxis
            dataKey="index"
            stroke="#71717a"
            tick={{
              fill: "#71717a",
              fontSize: 12
            }}
            tickLine={false}
            axisLine={{
              stroke: "#3f3f46"
            }}
          />

          <YAxis
            stroke="#71717a"
            tick={{
              fill: "#71717a",
              fontSize: 12
            }}
            tickLine={false}
            axisLine={{
              stroke: "#3f3f46"
            }}
            tickFormatter={
              value =>
                formatNumber(
                  value,
                  2
                )
            }
          />

          <Tooltip
            formatter={
              value => [
                formatNumber(
                  value,
                  2
                ),
                "Resultado acumulado"
              ]
            }
            labelFormatter={
              label =>
                `Entrada ${label}`
            }
            contentStyle={{
              backgroundColor:
                "#18181b",

              border:
                "1px solid #27272a",

              borderRadius:
                "8px",

              color:
                "#f4f4f5"
            }}
          />

          <Line
            type="monotone"
            dataKey="bankroll"
            stroke={
              finalValue >= 0
                ? "#22c55e"
                : "#ef4444"
            }
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4
            }}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex justify-between items-center gap-4 mt-3">
        <p
          className={
            `text-sm ${
              finalValue >= 0
                ? "text-green-400"
                : "text-red-400"
            }`
          }
        >
          Resultado acumulado:{" "}
          {formatNumber(
            finalValue,
            2
          )}
        </p>

        <span className="text-xs text-zinc-500">
          {data.length}{" "}
          {data.length === 1
            ? "entrada liquidada"
            : "entradas liquidadas"}
        </span>
      </div>

    </div>
  );
}

/* ==========================================
   CONSTRUÇÃO DA CURVA
========================================== */

function buildBankrollData(
  history:
    TrackingEntry[]
): BankrollPoint[] {
  let bankroll =
    0;

  return history.map(
    (
      entry,
      index
    ) => {
      const profit =
        parseFiniteNumber(
          entry.profit
        ) ??
        0;

      bankroll +=
        profit;

      return {
        index:
          index + 1,

        bankroll:
          roundNumber(
            bankroll,
            6
          )
      };
    }
  );
}

/* ==========================================
   HELPERS
========================================== */

function parseFiniteNumber(
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

function roundNumber(
  value: number,
  decimals = 6
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
      factor
    ) /
    factor
  );
}

function formatNumber(
  value: unknown,
  decimals = 2
): string {
  const parsed =
    parseFiniteNumber(
      value
    );

  if (
    parsed === null
  ) {
    return "—";
  }

  return parsed.toFixed(
    decimals
  );
}