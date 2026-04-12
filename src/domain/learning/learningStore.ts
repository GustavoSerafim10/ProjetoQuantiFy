type LearningEntry = {
  market: string;
  result: "win" | "loss";

  profit: number;
  stake: number;

  probability: number;
  odd: number;

  timestamp: number;
};

let history: LearningEntry[] = [];

/* ===========================
   ➕ ADD RESULT
=========================== */

export function addResult(entry: LearningEntry) {

  if (!entry || !entry.market) return;

  history.push(entry);

  // limite de memória
  if (history.length > 500) {
    history.shift();
  }
}

/* ===========================
   📥 GET
=========================== */

export function getHistory() {
  return history;
}

/* ===========================
   🧹 RESET (OPCIONAL)
=========================== */

export function resetLearning() {
  history = [];
}