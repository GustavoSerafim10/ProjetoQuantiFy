import { useState } from "react";

import type { MarketOddsAnalysisPayload, OddsPayload } from "./types";
import type { MultiBookOddsPayload } from "../../domain/odds/multiBookOdds";

/* ==========================================
   MARKET ODDS PANEL — CONSENSO DE-VIG
========================================== */

/*
 * Achado real em 2026-09-08: odds médias de várias casas
 * (bet365/Betano/Superbet) com a margem removida (de-vig) acertaram
 * 5 de 6 entradas reais na Champions League — muito melhor que o
 * formulário de estatísticas de time (modo legado, ao lado deste).
 * Este painel não pede nenhuma stat de time: só o preço de cada
 * casa por mercado. A primeira coluna preenchida em cada linha é o
 * preço realmente usado para calcular EV (a casa onde a aposta
 * seria feita); todas as colunas preenchidas entram no consenso.
 */

const BOOKMAKER_LABELS = ["Bet365", "Betano", "Superbet"] as const;

type MarketKey = keyof MultiBookOddsPayload;

interface MarketRowConfig {
  key: MarketKey;
  label: string;
}

const MARKET_GROUPS: Array<{
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

type MarketOddsForm = Partial<
  Record<MarketKey, [string, string, string]>
>;

function emptyRow(): [string, string, string] {
  return ["", "", ""];
}

function parseOdd(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
}

export default function MarketOddsPanel({
  onAnalyze
}: {
  onAnalyze: (data: MarketOddsAnalysisPayload) => void | Promise<void>;
}) {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [league, setLeague] = useState("");

  const [form, setForm] = useState<MarketOddsForm>({});

  const [validationError, setValidationError] = useState<string | null>(
    null
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOddChange(
    market: MarketKey,
    columnIndex: number,
    value: string
  ) {
    setValidationError(null);

    setForm(previous => {
      const row = previous[market] ?? emptyRow();
      const nextRow = [...row] as [string, string, string];
      nextRow[columnIndex] = value;

      return {
        ...previous,
        [market]: nextRow
      };
    });
  }

  async function handleSubmit() {
    const home = homeTeam.trim();
    const away = awayTeam.trim();

    if (!home || !away) {
      setValidationError(
        "Informe os nomes do time mandante e do visitante."
      );
      return;
    }

    const marketOdds: MultiBookOddsPayload = {};
    const odds: OddsPayload = {};

    for (const group of MARKET_GROUPS) {
      for (const row of group.rows) {
        const rawRow = form[row.key] ?? emptyRow();
        const parsedValues = rawRow
          .map(parseOdd)
          .filter((value): value is number => value !== null);

        if (parsedValues.length === 0) {
          continue;
        }

        marketOdds[row.key] = parsedValues;

        const firstValid = rawRow
          .map(parseOdd)
          .find(value => value !== null);

        if (firstValid !== undefined) {
          (odds as Record<string, number>)[row.key] = firstValid;
        }
      }
    }

    if (Object.keys(marketOdds).length === 0) {
      setValidationError(
        "Informe pelo menos uma odd de pelo menos uma casa para algum mercado."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await Promise.resolve(
        onAnalyze({
          mode: "market",
          match: { home, away, league },
          marketOdds,
          odds
        })
      );
    } catch (error) {
      setValidationError(
        error instanceof Error
          ? error.message
          : "Não foi possível executar a análise."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          value={homeTeam}
          onChange={e => setHomeTeam(e.target.value)}
          placeholder="🏠 Casa"
          className="inputElite"
        />

        <input
          value={league}
          onChange={e => setLeague(e.target.value)}
          placeholder="🏆 Liga"
          className="inputElite"
        />

        <input
          value={awayTeam}
          onChange={e => setAwayTeam(e.target.value)}
          placeholder="🚀 Fora"
          className="inputElite"
        />
      </div>

      <div className="text-xs text-zinc-400">
        A primeira coluna preenchida em cada linha é o preço usado para
        calcular o valor esperado (EV) — a casa onde você realmente
        apostaria. Todas as colunas preenchidas entram no cálculo do
        consenso (de-vig). Pode deixar casas em branco.
      </div>

      {MARKET_GROUPS.map(group => (
        <section
          key={group.title}
          className="bg-gradient-to-br from-[#121826] to-[#0f172a] p-6 rounded-2xl border border-zinc-800 shadow-xl"
        >
          <h3 className="text-sm text-zinc-400 mb-4 text-center font-semibold tracking-wide">
            {group.title}
          </h3>

          <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-zinc-500 mb-2">
            <div>Mercado</div>
            {BOOKMAKER_LABELS.map(label => (
              <div key={label} className="text-center">
                {label}
              </div>
            ))}
          </div>

          {group.rows.map(row => (
            <div
              key={row.key}
              className="grid grid-cols-4 gap-2 items-center py-1.5"
            >
              <div className="text-xs text-zinc-300">{row.label}</div>

              {BOOKMAKER_LABELS.map((label, columnIndex) => (
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

      {validationError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          ⚠️ {validationError}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={
          `w-full py-4 rounded-xl font-bold text-white
           bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500
           transition shadow-lg ${
             isSubmitting
               ? "opacity-60 cursor-wait"
               : "hover:scale-[1.02]"
           }`
        }
      >
        {isSubmitting ? "⏳ ANALISANDO..." : "📊 ANALISAR PELO CONSENSO DE MERCADO"}
      </button>
    </div>
  );
}
