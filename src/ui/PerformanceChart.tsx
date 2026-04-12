import { getHistory } from "../domain/tracking/trackingEngine";

export default function PerformanceChart() {

  const history = getHistory().filter(b => b.result);

  let cumulative = 0;

  const data = history.map((b, i) => {
    cumulative += b.profit || 0;

    return {
      x: i + 1,
      y: cumulative
    };
  });

  if (data.length === 0) {
    return null;
  }

  // 🔥 NORMALIZAÇÃO
  const values = data.map(d => d.y);
  const max = Math.max(...values);
  const min = Math.min(...values);

  const range = max - min || 1;

  function normalize(value: number) {
    return ((value - min) / range) * 100;
  }

  return (
    <div className="bg-zinc-900 p-4 rounded-xl">
      <h2 className="text-lg font-bold mb-2">📈 Evolução da Banca</h2>

      <div className="flex items-end gap-1 h-40">

        {data.map((d, i) => {

          const height = normalize(d.y);

          const isProfit = d.y >= 0;

          return (
            <div
              key={i}
              className={`w-2 rounded ${
                isProfit ? "bg-green-500" : "bg-red-500"
              }`}
              style={{
                height: `${Math.max(5, height)}%`
              }}
            />
          );
        })}

      </div>

      <div className="flex justify-between text-xs text-zinc-500 mt-2">
        <span>Min: {min.toFixed(2)}</span>
        <span>Max: {max.toFixed(2)}</span>
      </div>

      <p className={`text-sm mt-2 ${
        cumulative >= 0 ? "text-green-400" : "text-red-400"
      }`}>
        Resultado: {cumulative.toFixed(2)}
      </p>
    </div>
  );
}