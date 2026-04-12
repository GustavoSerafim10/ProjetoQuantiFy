import { motion } from "framer-motion";

import {
  registerBet,
  settleBet,
  getHistory
} from "../domain/tracking/trackingEngine";

/* ===========================
   UI HELPERS
=========================== */

const Card = ({ children }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 bg-white/5 shadow-lg"
  >
    {children}
  </motion.div>
);

const StrengthBar = ({ value }: any) => (
  <div className="w-full h-2 bg-zinc-800 rounded overflow-hidden mt-2">
    <div
      className="h-full bg-gradient-to-r from-green-400 to-emerald-500"
      style={{ width: `${Math.min((value || 0) * 100, 100)}%` }}
    />
  </div>
);

/* ===========================
   HELPERS
=========================== */

function getValueTag(m: any) {
  if (!m) return "";
  if (m.ev >= 0.12) return "💎 VALUE BET";
  if (m.ev >= 0.05) return "🔥 BOA";
  if (m.ev >= 0.02) return "⚠️ MARGINAL";
  return "❌ TRAP";
}

function getValueColor(m: any) {
  if (!m) return "text-zinc-400";
  if (m.ev >= 0.12) return "text-green-400";
  if (m.ev >= 0.05) return "text-emerald-400";
  if (m.ev >= 0.02) return "text-yellow-400";
  return "text-red-400";
}

const Glow = ({ value }: any) => {
  if (value >= 0.15) return <span className="text-green-400 font-bold">{value.toFixed(2)}</span>;
  if (value >= 0.08) return <span className="text-yellow-400">{value.toFixed(2)}</span>;
  return <span className="text-red-400">{value.toFixed(2)}</span>;
};

const getHeat = (m: any) => {
  if (!m?.structureValid) return "border-red-500/30 bg-red-500/5";
  if (m.valueScore > 0.6) return "border-green-500/40 bg-green-500/10";
  if (m.valueScore > 0.45) return "border-yellow-500/30 bg-yellow-500/10";
  return "border-zinc-700";
};

/* ===========================
   📊 STATS
=========================== */

function calculateStats(history: any[]) {
  let wins = 0;
  let losses = 0;

  for (const b of history) {
    if (b.result === "win") wins++;
    if (b.result === "loss") losses++;
  }

  const totalBets = wins + losses;
  const winrate = totalBets ? (wins / totalBets) * 100 : 0;

  // ROI SIMPLIFICADO (sem stake)
  const roi = totalBets ? ((wins - losses) / totalBets) * 100 : 0;

  return {
    wins,
    losses,
    totalBets,
    winrate,
    roi
  };
}

/* ===========================
   DASHBOARD
=========================== */

export default function Dashboard({ data }: any) {

  if (!data) return null;

  const elite = data?.elite;
  const scalper = data?.scalper;

  const best = data?.best || elite || scalper || null;

  const fullHistory = getHistory();
  const history = fullHistory.slice(-6).reverse();

  const stats = calculateStats(fullHistory);

  

  /* ===========================
     ACTIONS
  ============================ */

  function register() {
    if (!best) return;

registerBet({
  id: Date.now().toString(),
  match: data.match,
  market: best.market,
  odd: best.odd,
  probability: best.probability,
  ev: best.ev,
  kelly: best.kelly,
  stake: best.stake || 100,
  createdAt: Date.now(),
  type: best.classification,
});
  }
  /* ===========================
     UI
  ============================ */

  return (
    <div className="p-6 min-h-screen bg-black text-white space-y-6">

      {/* HEADER */}
      <h1 className="text-2xl font-bold tracking-wide">
        {data.match || "Aguardando análise..."}
      </h1>

      {/* HERO */}
      <Card>
        <h2 className="text-xs text-zinc-400">🎯 SNIPER DECISION</h2>

        {best ? (
          <>
            <div className="text-2xl font-bold mt-2 text-green-400">
              {best.market}
            </div>

            <div className={`text-sm mt-2 font-bold ${getValueColor(best)}`}>
              {getValueTag(best)}
            </div>

            <div className="flex justify-between text-xs mt-2 text-zinc-400">
              <span>EV: {best.ev?.toFixed(2)}</span>
              <span>Odd: {best.odd}</span>
              <span>Prob: {Math.round((best.probability || 0) * 100)}%</span>
            </div>

            <StrengthBar value={best.probability} />
          </>
        ) : (
          <div className="text-red-400 mt-2">
            ⚠️ Nenhuma oportunidade com edge suficiente
          </div>
        )}
      </Card>

      {/* 💰 STATS */}
   <div className="grid md:grid-cols-5 gap-4">

  <Card>
    <h2 className="text-xs text-zinc-400">💰 ROI</h2>
    <div className="text-2xl font-bold text-green-400 mt-2">
      {stats.roi.toFixed(1)}%
    </div>
  </Card>

  <Card>
    <h2 className="text-xs text-zinc-400">🎯 WINRATE</h2>
    <div className="text-2xl font-bold mt-2">
      {stats.winrate.toFixed(0)}%
    </div>
  </Card>

  <Card>
    <h2 className="text-xs text-zinc-400">📈 BETS</h2>
    <div className="text-2xl font-bold mt-2">
      {stats.totalBets}
    </div>
  </Card>

  <Card>
    <h2 className="text-xs text-zinc-400">✅ WIN</h2>
    <div className="text-2xl font-bold text-green-400 mt-2">
      {stats.wins}
    </div>
  </Card>

  <Card>
    <h2 className="text-xs text-zinc-400">❌ LOSS</h2>
    <div className="text-2xl font-bold text-red-400 mt-2">
      {stats.losses}
    </div>
  </Card>

</div>

      {/* RANKING */}
      <Card>
        <h2 className="font-bold mb-3">🔥 Ranking de Valor</h2>

        <div className="space-y-2">
          {(data.markets || []).slice(0, 5).map((m: any, i: number) => (
            <div key={i} className={`p-3 rounded-xl border ${getHeat(m)}`}>

              <div className="flex justify-between">
                <span>{m.market}</span>
                <span className={getValueColor(m)}>
                  {getValueTag(m)}
                </span>
              </div>

              <div className="flex justify-between text-xs mt-1">
                <span>EV: <Glow value={m.ev} /></span>
                <span>Value: {m.valueScore?.toFixed(2)}</span>
              </div>

              <StrengthBar value={m.probability} />
            </div>
          ))}
        </div>
      </Card>

      {/* PERFORMANCE */}
      <Card>
  <h2 className="mb-3">📈 Performance</h2>

  <div className="flex gap-2 text-sm">
    {history.slice(-10).map((b: any, i: number) => (
      <span
        key={i}
        className={
          b.result === "win"
            ? "text-green-400"
            : b.result === "loss"
            ? "text-red-400"
            : "text-zinc-500"
        }
      >
        {b.result === "win" ? "W" : b.result === "loss" ? "L" : "-"}
      </span>
    ))}
  </div>

  <div className="text-xs text-zinc-400 mt-2">
    Últimas 10 entradas
  </div>
</Card>

{/* HISTÓRICO */}
<Card>
  <h2 className="mb-3">📜 Execuções</h2>

  {history.map((b: any, i: number) => (
    <div
      key={i}
      className="border-b border-zinc-800 py-2 flex justify-between items-center"
    >
      {/* INFO */}
      <div className="flex flex-col text-xs">

        <span className="font-semibold text-white">
          {b.match || "Jogo"}
        </span>

        <span className="text-zinc-400">
          {b.market}
        </span>

        <span className="text-[10px] text-blue-400">
          {b.type}
        </span>

        <span className="text-zinc-500 text-[10px]">
          Odd {b.odd} | Prob {Math.round(b.probability * 100)}% | EV {b.ev?.toFixed(2)}
        </span>

      </div>

      {/* RESULT / ACTIONS */}
      <div className="flex items-center gap-3">

        {b.result ? (
          <span
            className={
              b.result === "win"
                ? "text-green-400 text-xs"
                : "text-red-400 text-xs"
            }
          >
            {b.result.toUpperCase()}
          </span>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => settleBet(b.id, "win")}
              className="text-green-400 text-[10px]"
            >
              WIN
            </button>

            <button
              onClick={() => settleBet(b.id, "loss")}
              className="text-red-400 text-[10px]"
            >
              LOSS
            </button>
          </div>
        )}

            </div>
    </div>
  ))}
</Card>

      {/* CONTROLES */}
      <div className="flex gap-2">
        <button onClick={register} className="bg-blue-600 px-4 py-2 rounded">Registrar</button>
      </div>

    </div>
  );
}