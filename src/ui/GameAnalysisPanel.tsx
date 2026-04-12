import { useState } from "react";
import type { RankedMarket } from "../application/engines/marketRanking";

interface Props {
  markets: RankedMarket[];
}

export default function GameAnalysisPanel({ markets }: Props) {

  const [minEdge, setMinEdge] = useState(0);
  const [maxRisk, setMaxRisk] = useState(10);
  const [onlyBets, setOnlyBets] = useState(false);
  const [category, setCategory] = useState("ALL");

  function getStatus(ev: number) {
    if (ev >= 0.05) return "BET";
    if (ev >= 0.02) return "MARGINAL";
    return "NO BET";
  }

  function statusColor(status: string) {
    if (status === "BET") return "text-emerald-400";
    if (status === "MARGINAL") return "text-yellow-400";
    return "text-red-400";
  }

  function rowHighlight(status: string) {
    if (status === "BET") return "bg-emerald-900/20";
    if (status === "MARGINAL") return "bg-yellow-900/20";
    return "";
  }

  const rankedMarkets = [...markets]
    .sort((a, b) => b.edgeScore - a.edgeScore);

  const filteredMarkets = rankedMarkets
    .filter(m => m.edgeScore >= minEdge)
    .filter(m => m.riskScore <= maxRisk)
    .filter(m => !onlyBets || m.expectedValue > 0)
    .filter(m => category === "ALL" || m.category === category);

  return (
    <div className="bg-black text-white p-12">

      <h2 className="text-3xl mb-8 font-bold">
        🏆 Ranking Quant Profissional
      </h2>

      {/* 🔎 FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">

        <div>
          <label className="text-sm text-gray-400">
            Edge mínimo: {minEdge}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={minEdge}
            onChange={(e) => setMinEdge(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">
            Risco máximo: {maxRisk}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={maxRisk}
            onChange={(e) => setMaxRisk(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">
            Categoria
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-gray-900 p-2 rounded mt-1"
          >
            <option value="ALL">Todas</option>
            <option value="CORE">CORE</option>
            <option value="SEMI">SEMI</option>
            <option value="ADVANCED">ADVANCED</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={onlyBets}
            onChange={() => setOnlyBets(!onlyBets)}
          />
          <span>Mostrar apenas EV &gt; 0</span>
        </div>

      </div>

      {filteredMarkets.length === 0 ? (
        <div className="text-gray-500 text-lg">
          Nenhuma oportunidade dentro dos critérios atuais.
        </div>
      ) : (
<div className="overflow-x-auto">
  <table className="w-full text-left border-collapse">

    <thead>
      <tr className="border-b border-gray-700 text-gray-400 uppercase text-sm">
        <th className="p-3">Rank</th>
        <th className="p-3">Market</th>
        <th className="p-3">EV</th>
        <th className="p-3">Edge</th>
        <th className="p-3">Risk</th>
        <th className="p-3">Kelly</th>
        <th className="p-3">Status</th>
      </tr>
    </thead>

    <tbody>
      {rankedMarkets.map((m, i) => {

        const status = getStatus(m.expectedValue);

        const isVisible =
          m.edgeScore >= minEdge &&
          m.riskScore <= maxRisk &&
          (!onlyBets || m.expectedValue > 0) &&
          (category === "ALL" || m.category === category);

        return (
          <tr
            key={i}
            className={`border-b border-gray-800 transition ${
              isVisible ? "opacity-100" : "opacity-30"
            } ${rowHighlight(status)}`}
          >
            <td className="p-3 font-bold">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </td>

            <td className="p-3 font-semibold">
              {m.market}
            </td>

            <td className={`p-3 font-semibold ${
              m.expectedValue > 0
                ? "text-emerald-400"
                : "text-red-400"
            }`}>
              {(m.expectedValue * 100).toFixed(2)}%
            </td>

            <td className="p-3">
              {m.edgeScore.toFixed(1)}
            </td>

            <td className="p-3">
              {m.riskScore.toFixed(1)}
            </td>

            <td className="p-3">
              {(m.kelly * 100).toFixed(1)}%
            </td>

            <td className={`p-3 font-bold ${statusColor(status)}`}>
              {status}
            </td>
          </tr>
        );
      })}
    </tbody>

  </table>
</div>
      )}

    </div>
  );
}