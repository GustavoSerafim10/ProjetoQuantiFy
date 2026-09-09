import { useState } from "react";

import type { OddsPayload } from "./types";
import type { MultiBookOddsPayload } from "../../domain/odds/multiBookOdds";

/* ==========================================
   MARKET ODDS GRID — CONSENSO DE-VIG
========================================== */

/*
 * Achado real em 2026-09-08: odds médias de várias casas
 * (bet365/Betano/Superbet) com a margem removida (de-vig) acertaram
 * 5 de 6 entradas reais na Champions League. Este componente é só a
 * grade de odds por mercado — controlado de fora (InputPanel), lado
 * a lado com a comparação de estatísticas na mesma tela e na mesma
 * análise (o usuário pediu explicitamente pra ver os dois juntos).
 * Desde 2026-09-09 essas odds e as estatísticas da tela também
 * entram juntas na mesma conta de probabilidade quando ambas estão
 * preenchidas — ver fusedModelPipeline.ts/lambdaFusion.ts.
 */

/*
 * Genérico de propósito (achado real em 2026-09-09): nomes fixos de
 * casa (Bet365/Betano/Superbet) davam a impressão de que era preciso
 * abrir várias casas toda vez. Só a primeira coluna é necessária —
 * a sua casa de sempre, qualquer que seja. As outras duas são um
 * bônus de precisão totalmente opcional.
 */
const BOOKMAKER_LABELS = [
  "Sua casa",
  "Casa 2 (opcional)",
  "Casa 3 (opcional)"
] as const;

export type MarketKey = keyof MultiBookOddsPayload;

interface MarketRowConfig {
  key: MarketKey;
  label: string;
}

export const MARKET_GROUPS: Array<{
  title: string;
  rows: MarketRowConfig[];
}> = [
  {
    title: "1X2",
    rows: [
      { key: "home", label: "Casa" },
      { key: "draw", label: "Empate" },
      { key: "away", label: "Fora" }
    ]
  },
  {
    title: "Mais/Menos 1.5 gols",
    rows: [
      { key: "over15", label: "Mais de 1.5" },
      { key: "under15", label: "Menos de 1.5" }
    ]
  },
  {
    title: "Mais/Menos 2.5 gols",
    rows: [
      { key: "over25", label: "Mais de 2.5" },
      { key: "under25", label: "Menos de 2.5" }
    ]
  },
  {
    title: "Ambas marcam",
    rows: [
      { key: "bttsYes", label: "Sim" },
      { key: "bttsNo", label: "Não" }
    ]
  },
  {
    title: "Dupla chance",
    rows: [
      { key: "homeOrDraw", label: "1X" },
      { key: "awayOrDraw", label: "X2" }
    ]
  },
  {
    title: "Empate anula (DNB)",
    rows: [
      { key: "dnbHome", label: "Casa" },
      { key: "dnbAway", label: "Fora" }
    ]
  }
];

export type MarketOddsForm = Partial<
  Record<MarketKey, [string, string, string]>
>;

export function emptyMarketOddsRow(): [string, string, string] {
  return ["", "", ""];
}

function parseOdd(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
}

/*
 * Converte o form controlado em `{marketOdds, odds}` — a primeira
 * coluna preenchida em cada linha vira o preço usado para EV
 * (`odds`); todas as colunas preenchidas entram no consenso
 * (`marketOdds`).
 */
export function buildMarketOddsPayload(
  form: MarketOddsForm
): { marketOdds: MultiBookOddsPayload; odds: OddsPayload } {
  const marketOdds: MultiBookOddsPayload = {};
  const odds: OddsPayload = {};

  for (const group of MARKET_GROUPS) {
    for (const row of group.rows) {
      const rawRow = form[row.key] ?? emptyMarketOddsRow();
      const parsedValues = rawRow
        .map(parseOdd)
        .filter((value): value is number => value !== null);

      if (parsedValues.length === 0) {
        continue;
      }

      marketOdds[row.key] = parsedValues;

      const firstValid = rawRow.map(parseOdd).find(value => value !== null);

      if (firstValid !== undefined) {
        (odds as Record<string, number>)[row.key] = firstValid;
      }
    }
  }

  return { marketOdds, odds };
}

export function hasAnyMarketOdds(form: MarketOddsForm): boolean {
  return Object.values(form).some(
    row =>
      Array.isArray(row) &&
      row.some(value => parseOdd(value) !== null)
  );
}

export default function MarketOddsPanel({
  form,
  onChange
}: {
  form: MarketOddsForm;
  onChange: (next: MarketOddsForm) => void;
}) {
  /*
   * Achado real em 2026-09-09 (2a vez, mesmo dia): mesmo com as
   * colunas 2/3 já marcadas como opcionais, ver 3 campos de odd por
   * linha toda vez ainda pareceu cansativo. Por padrão mostra só 1
   * campo por mercado (o fluxo antigo, "uma casa só") — quem quiser
   * o ganho de precisão do consenso de-vig com mais casas expande
   * manualmente. Nada do motor mudou: `marketOddsForm`/
   * `buildMarketOddsPayload`/`fuseLambdas` continuam aceitando 1 a 3
   * odds por mercado exatamente como antes.
   */
  const [showExtraBooks, setShowExtraBooks] = useState(false);

  const visibleLabels = showExtraBooks
    ? BOOKMAKER_LABELS
    : BOOKMAKER_LABELS.slice(0, 1);

  const gridColsClass =
    visibleLabels.length === 1 ? "grid-cols-2" : "grid-cols-4";

  function handleOddChange(
    market: MarketKey,
    columnIndex: number,
    value: string
  ) {
    const row = form[market] ?? emptyMarketOddsRow();
    const nextRow = [...row] as [string, string, string];
    nextRow[columnIndex] = value;

    onChange({
      ...form,
      [market]: nextRow
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
        <div>
          Preencha a odd da sua casa de sempre — já é suficiente para
          calcular o valor esperado (EV).
        </div>

        <button
          type="button"
          onClick={() => setShowExtraBooks(current => !current)}
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-quantify-green hover:bg-zinc-800 transition"
        >
          {showExtraBooks
            ? "− Ocultar casas extras"
            : "+ Mais casas (opcional, mais preciso)"}
        </button>
      </div>

      {showExtraBooks && (
        <div className="text-xs text-zinc-400">
          Colunas extras são opcionais: se você conferir mais 1 ou 2
          casas, elas entram no cálculo do consenso (de-vig) e deixam o
          número um pouco mais preciso — mas não são obrigatórias.
        </div>
      )}

      {MARKET_GROUPS.map(group => (
        <section
          key={group.title}
          className="bg-gradient-to-br from-quantify-card to-quantify-bg p-6 rounded-2xl border border-zinc-800 shadow-xl"
        >
          <h3 className="text-sm text-zinc-400 mb-4 text-center font-semibold tracking-wide">
            {group.title}
          </h3>

          <div
            className={`grid ${gridColsClass} gap-2 text-[10px] uppercase tracking-wide text-zinc-500 mb-2`}
          >
            <div>Mercado</div>
            {visibleLabels.map(label => (
              <div key={label} className="text-center">
                {label}
              </div>
            ))}
          </div>

          {group.rows.map(row => (
            <div
              key={row.key}
              className={`grid ${gridColsClass} gap-2 items-center py-1.5`}
            >
              <div className="text-xs text-zinc-300">{row.label}</div>

              {visibleLabels.map((label, columnIndex) => (
                <input
                  key={label}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="1.01"
                  value={form[row.key]?.[columnIndex] ?? ""}
                  onChange={e =>
                    handleOddChange(row.key, columnIndex, e.target.value)
                  }
                  placeholder="—"
                  className="inputElite text-center"
                />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
