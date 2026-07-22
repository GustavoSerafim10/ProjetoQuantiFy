import {
  useMemo
} from "react";

import {
  getHistory
} from "../domain/tracking/trackingEngine";

/* ==========================================
   PERFORMANCE CHART — QUANTIFY V7
========================================== */

/*
 * Responsabilidade:
 *
 * - ler o histórico liquidado;
 * - calcular o lucro acumulado;
 * - exibir a evolução do resultado;
 * - não recalcular ROI ou decisões.
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

interface PerformancePoint {
  index: number;
  cumulativeProfit: number;
}

/* ==========================================
   COMPONENTE
========================================== */

export default function PerformanceChart() {
  const history =
    useMemo(
      () => {
        const stored =
          getHistory();

        if (!Array.isArray(stored)) {
          return [];
        }

        return (
          stored as
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
        buildPerformanceData(
          history
        ),
      [
        history
      ]
    );

  if (data.length === 0) {
    return null;
  }

  const values =
    data.map(
      point =>
        point.cumulativeProfit
    );

  /*
   * Incluímos zero no domínio para que:
   *
   * - séries totalmente positivas tenham uma
   *   base visual em zero;
   * - séries totalmente negativas também sejam
   *   comparadas contra zero;
   * - o menor valor não seja artificialmente
   *   representado como barra mínima.
   */
  const maximum =
    Math.max(
      0,
      ...values
    );

  const minimum =
    Math.min(
      0,
      ...values
    );

  const range =
    maximum -
    minimum ||
    1;

  const cumulative =
    data[
      data.length - 1
    ]?.cumulativeProfit ??
    0;

  function normalizeHeight(
    value: number
  ): number {
    const normalized =
      (
        value -
        minimum
      ) /
      range;

    return clamp(
      normalized * 100,
      0,
      100
    );
  }

  return (
    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">

      <h2 className="text-lg font-bold mb-2">
        📈 Evolução da Banca
      </h2>

      <div className="flex items-end gap-1 h-40 overflow-x-auto">

        {data.map(
          point => {
            const height =
              normalizeHeight(
                point.cumulativeProfit
              );

            const isProfit =
              point.cumulativeProfit >=
              0;

            return (
              <div
                key={
                  point.index
                }
                title={
                  `Entrada ${point.index}: ` +
                  formatNumber(
                    point.cumulativeProfit,
                    2
                  )
                }
                className={
                  `min-w-2 w-2 rounded-t ${
                    isProfit
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`
                }
                style={{
                  height:
                    `${
                      Math.max(
                        4,
                        height
                      )
                    }%`
                }}
              />
            );
          }
        )}

      </div>

      <div className="flex justify-between text-xs text-zinc-500 mt-2">
        <span>
          Mín:{" "}
          {formatNumber(
            minimum,
            2
          )}
        </span>

        <span>
          Máx:{" "}
          {formatNumber(
            maximum,
            2
          )}
        </span>
      </div>

      <p
        className={
          `text-sm mt-2 ${
            cumulative >= 0
              ? "text-green-400"
              : "text-red-400"
          }`
        }
      >
        Resultado:{" "}
        {formatNumber(
          cumulative,
          2
        )}
      </p>

    </div>
  );
}

/* ==========================================
   CONSTRUÇÃO DA SÉRIE
========================================== */

function buildPerformanceData(
  history:
    TrackingEntry[]
): PerformancePoint[] {
  let cumulativeProfit =
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

      cumulativeProfit +=
        profit;

      return {
        index:
          index + 1,

        cumulativeProfit:
          roundNumber(
            cumulativeProfit,
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

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      value,
      maximum
    )
  );
}

function roundNumber(
  value: number,
  decimals = 6
): number {
  if (!Number.isFinite(value)) {
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

  if (parsed === null) {
    return "—";
  }

  return parsed.toFixed(
    decimals
  );
}