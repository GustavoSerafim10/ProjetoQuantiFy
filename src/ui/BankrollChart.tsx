import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

import { getHistory } from "../domain/tracking/trackingEngine";

export default function BankrollChart() {

  const history = getHistory().filter(b => b.result);

  let bankroll = 0;

  const data = history.map((b, index) => {
    bankroll += b.profit || 0;

    return {
      index: index + 1,
      bankroll
    };
  });

  if (data.length === 0) {
    return null;
  }

  const finalValue = data[data.length - 1].bankroll;

  return (
    <div className="bg-gray-900 p-4 rounded-xl">
      <h2 className="text-lg font-bold mb-4">
        📈 Evolução da Banca
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />

          <XAxis
            dataKey="index"
            stroke="#71717a"
          />

          <YAxis
            stroke="#71717a"
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a"
            }}
          />

          <Line
            type="monotone"
            dataKey="bankroll"
            stroke={finalValue >= 0 ? "#22c55e" : "#ef4444"}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className={`text-sm mt-2 ${
        finalValue >= 0 ? "text-green-400" : "text-red-400"
      }`}>
        Resultado: {finalValue.toFixed(2)}
      </p>
    </div>
  );
}