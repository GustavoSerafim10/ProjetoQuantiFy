/*
 * Snapshot bruto da análise no momento em que a aposta foi
 * registrada. Sem isso, uma aposta já liquidada nunca pode ser
 * re-auditada — o histórico guardava só odd/probabilidade/EV do
 * resultado final, nunca os stats de entrada nem os fatores
 * intermediários (tempoFactor, pressureFactor etc.) que geraram
 * aquele número. `input` é o payload bruto (stats digitados,
 * odds, liga) exatamente como chegou no modelPipeline — é o que
 * permite re-rodar essa mesma partida pelo pipeline no futuro
 * para conferir se os fatores fizeram sentido.
 */
export type AnalysisSnapshot = {
  input?: unknown;

  homeStats?: unknown;
  awayStats?: unknown;

  league?: string;

  lambdaHome?: number;
  lambdaAway?: number;
  totalLambda?: number;

  tempoFactor?: number;
  pressureFactor?: number;
};

export type Bet = {
  id: string;

  match: string;
  market: string;
  category?: string;

  odd: number;
  probability: number;

  ev: number;
  kelly: number;

  stake: number;

  result?: "win" | "loss";
  profit?: number;

  createdAt: number;

 type: "SCALPER" | "ELITE" | "BET" | "WATCHLIST";

  analysisSnapshot?: AnalysisSnapshot;
};

/* ===========================
   💾 STORAGE CONFIG
=========================== */

const STORAGE_KEY = "quantify_tracking_v1";

/* ===========================
   📥 LOAD / SAVE
=========================== */

function loadFromStorage(): Bet[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn("⚠️ Erro ao carregar storage:", e);
    return [];
  }
}

function saveToStorage(data: Bet[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("⚠️ Erro ao salvar storage:", e);
  }
}

function removeFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("⚠️ Erro ao limpar storage:", e);
  }
}

/* ===========================
   🧠 STATE
=========================== */

let history: Bet[] = loadFromStorage();

/* ===========================
   📥 REGISTRAR APOSTA
=========================== */

export function registerBet(
  bet: Bet
) {
  const exists =
    history.some(
      item =>
        item.id ===
        bet.id
    );

  if (exists) {
    console.warn(
      "⚠️ Bet já registrada:",
      bet.id
    );

    return;
  }

  if (
    !bet.odd ||
    bet.odd <= 1 ||
    !bet.market
  ) {
    console.warn(
      "⚠️ Bet inválida:",
      bet
    );

    return;
  }

  const normalizedStake =
    Number.isFinite(
      Number(
        bet.stake
      )
    ) &&
    Number(
      bet.stake
    ) > 0
      ? Number(
          bet.stake
        )
      : 1;

  history.push({
    ...bet,

    stake:
      normalizedStake,

    profit:
      0
  });

  saveToStorage(
    history
  );

  console.log(
    "✅ Bet registrada:",
    bet
  );
}
/* ===========================
   🧾 LIQUIDAR APOSTA
=========================== */

export function settleBet(id: string, result: "win" | "loss") {
  const bet = history.find(b => b.id === id);

  if (!bet) {
    console.warn("⚠️ Bet não encontrada:", id);
    return;
  }

  if (bet.result) {
    console.warn("⚠️ Bet já liquidada:", id);
    return;
  }

  bet.result = result;

  if (result === "win") {
    bet.profit = bet.stake * (bet.odd - 1);
  } else {
    bet.profit = -bet.stake;
  }

  saveToStorage(history);
}

/* ===========================
   📊 ESTATÍSTICAS GERAIS
=========================== */

export function getStats() {
  const settled = history.filter(b => b.result);

  const totalBets = settled.length;
  const wins = settled.filter(b => b.result === "win").length;
  const losses = settled.filter(b => b.result === "loss").length;

  const totalProfit = settled.reduce((acc, b) => acc + (b.profit || 0), 0);
  const totalStake = settled.reduce((acc, b) => acc + b.stake, 0);

  const roi = totalStake ? totalProfit / totalStake : 0;
  const winRate = totalBets ? wins / totalBets : 0;

  return {
    totalBets,
    wins,
    losses,
    winRate,
    totalProfit,
    totalStake,
    roi
  };
}

/* ===========================
   📉 DRAWDOWN
=========================== */

export function getDrawdown() {
  let peak = 0;
  let bankroll = 0;
  let maxDrawdown = 0;

  for (const b of history) {
    if (!b.result) continue;

    bankroll += b.profit || 0;

    if (bankroll > peak) {
      peak = bankroll;
    }

    const dd = peak > 0 ? (peak - bankroll) / peak : 0;

    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  }

  return maxDrawdown;
}

/* ===========================
   📦 HISTÓRICO
=========================== */

export function getHistory(): Bet[] {
  return history;
}

/* ===========================
   🧹 RESET TOTAL (HISTÓRICO)
=========================== */

export function resetHistory() {
  history = [];
  removeFromStorage();

  console.log("🧹 Histórico resetado");
}

/* ===========================
   ♻️ RESET RESULTADOS (PRO)
=========================== */

export function clearResults() {
  history = history.map(b => ({
    ...b,
    result: undefined,
    profit: 0
  }));

  saveToStorage(history);

  console.log("♻️ Resultados resetados");
}

/* ===========================
   ❌ REMOVER UMA BET
=========================== */

export function deleteBet(id: string) {
  history = history.filter(b => b.id !== id);
  saveToStorage(history);

  console.log("🗑 Bet removida:", id);
}

/* ===========================
   💀 RESET TOTAL ABSOLUTO
=========================== */

export function clearAll() {
  history = [];
  removeFromStorage();

  console.log("💀 Tudo apagado");
}