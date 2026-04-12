import type { RankedMarket } from "../application/engines/marketRanking";

type Props = {
  markets: RankedMarket[];
};

export default function QuantGameReport({ markets }: Props) {

  if (!markets || markets.length === 0) {
    return null;
  }

  const sorted = [...markets].sort(
    (a, b) => b.signalScore - a.signalScore
  );

  const best = sorted[0];
  const top3 = sorted.slice(0, 3);

  return (
    <div className="bg-black text-white p-6 rounded-2xl border border-zinc-800 space-y-4">

      <h2 className="text-xl font-bold">📊 Quant Report</h2>

      {/* 🔥 MELHOR */}
      {best && (
        <div className="bg-green-900/20 p-3 rounded-xl">
          <p className="text-xs text-zinc-400">🔥 Melhor oportunidade</p>
          <p className="font-bold">{best.market}</p>
          <p className="text-sm">
            {Math.round((best?.probability ?? 0) * 100)}% | EV {((best?.ev ?? 0) * 100).toFixed(1)}%
          </p>
        </div>
      )}

      {/* ⚡ TOP 3 */}
      <div>
        <p className="text-xs text-zinc-400 mb-1">📈 Top mercados</p>

        {top3.map((m, i) => (
          <div key={i} className="flex justify-between text-sm border-b border-zinc-800 py-1">
            <span>{m.market}</span>
            <span>{Math.round((m.probability ?? 0) * 100)}%</span>
          </div>
        ))}
      </div>

      {/* ⚠️ ALERTA */}
      {best?.riskScore > 0.6 && (
        <div className="text-red-400 text-xs">
          ⚠️ Risco elevado detectado
        </div>
      )}

    </div>
  );
}