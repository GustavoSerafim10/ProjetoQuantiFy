import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

import { eliteAnalyzer } from "../src/application/orchestrator/eliteAnalyzer";
import { buildCalibrationReport } from "../src/domain/tracking/calibrationReport";
import type { Bet } from "../src/domain/tracking/trackingEngine";

/*
 * CLI de validação real, fora do backtest sintético e fora do
 * localStorage do navegador. Motivo (ver conversa 2026-09-08): o
 * usuário não confia nos números do motor porque a única validação
 * que existia era contra o próprio matchGenerator (viesado, já
 * documentado) ou uma amostra de 4 apostas via UI. Isso roda o
 * MESMO eliteAnalyzer de produção (não uma reimplementação) sobre
 * jogos reais que o usuário for enviando, e guarda tudo num ledger
 * (data/realWorldLedger.json) até o jogo terminar — daí
 * buildCalibrationReport (a mesma matemática do CalibrationPanel)
 * mede Brier score/ROI reais assim que houver amostra.
 *
 * Uso:
 *   npx tsx scripts/realWorld.ts analyze caminho/jogo.json
 *   npx tsx scripts/realWorld.ts settle <id> win|loss
 *   npx tsx scripts/realWorld.ts report
 *   npx tsx scripts/realWorld.ts list
 */

const LEDGER_PATH = resolve(
  import.meta.dirname,
  "../data/realWorldLedger.json"
);

interface LedgerEntry {
  id: string;
  createdAt: number;

  match: string;
  league?: string;

  input: unknown;

  recommendation: {
    market: string;
    probability: number;
    odd: number;
    ev: number;
    classification?: string;
    stake?: number;
  } | null;

  noBetReason?: string;

  note?: string;

  result?: "win" | "loss";
}

function loadLedger(): LedgerEntry[] {
  if (!existsSync(LEDGER_PATH)) {
    return [];
  }

  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf-8"));
  } catch {
    console.warn("⚠️ Ledger corrompido ou vazio, começando do zero.");
    return [];
  }
}

function saveLedger(entries: LedgerEntry[]) {
  mkdirSync(dirname(LEDGER_PATH), { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

/* ==========================================
   ANALYZE
========================================== */

interface GameInputFile {
  match: { home: string; away: string; league?: string };
  stats?: { home: Record<string, number>; away: Record<string, number> };
  odds: Record<string, number>;

  /*
   * Odds de várias casas (bet365/Betano/Superbet) por mercado —
   * quando presente, o eliteAnalyzer usa o consenso de-vig
   * (marketModelPipeline) em vez do Poisson-de-stats. `stats` fica
   * opcional nesse modo.
   */
  marketOdds?: Record<string, number[]>;

  note?: string;
}

function analyzeCommand(filePath: string) {
  const raw = readFileSync(resolve(filePath), "utf-8");
  const data: GameInputFile = JSON.parse(raw);

  const analyzerInput = {
    homeStats: data.stats?.home ?? {},
    awayStats: data.stats?.away ?? {},
    league: data.match.league ?? "",
    odds: data.odds,
    marketOdds: data.marketOdds,
    match: data.match,
    computeRobustness: true
  };

  const output = eliteAnalyzer(analyzerInput) as {
    match?: string;
    best?: {
      market?: string;
      probability?: number;
      odd?: number;
      ev?: number;
      classification?: string;
      stake?: number;
    } | null;
    reason?: string;
    markets?: Array<{
      market?: string;
      probability?: number;
      impliedProbability?: number;
      odd?: number;
      ev?: number;
      classification?: string;
    }>;
  };

  const best = output.best ?? null;

  const entry: LedgerEntry = {
    id: `game-${Date.now()}`,
    createdAt: Date.now(),

    match: output.match ?? `${data.match.home} vs ${data.match.away}`,
    league: data.match.league,

    input: data,

    recommendation: best
      ? {
          market: String(best.market ?? ""),
          probability: Number(best.probability ?? 0),
          odd: Number(best.odd ?? 0),
          ev: Number(best.ev ?? 0),
          classification: best.classification,
          stake: best.stake
        }
      : null,

    noBetReason: best ? undefined : output.reason,

    note: data.note
  };

  const ledger = loadLedger();
  ledger.push(entry);
  saveLedger(ledger);

  console.log(`\n=== ${entry.match} ===\n`);

  if (entry.recommendation) {
    console.log(`ENTRADA: ${entry.recommendation.market}`);
    console.log(`Probabilidade (modelo): ${(entry.recommendation.probability * 100).toFixed(1)}%`);
    console.log(`Odd: ${entry.recommendation.odd}`);
    console.log(`EV: ${entry.recommendation.ev.toFixed(4)}`);
    console.log(`Classificação: ${entry.recommendation.classification ?? "?"}`);
  } else {
    console.log(`SEM ENTRADA — ${entry.noBetReason ?? "motivo não informado"}`);
  }

  /*
   * Sempre mostra todos os mercados, mesmo em NO BET — é a única
   * forma de o usuário ver "o modelo disse 62% aqui, a odd implica
   * 55%" e julgar por si se confia naquele número específico, em
   * vez de só receber um veredito de caixa-preta.
   */
  if (Array.isArray(output.markets) && output.markets.length > 0) {
    console.log("\nTodos os mercados avaliados:");

    for (const market of output.markets) {
      const probability =
        typeof market.probability === "number"
          ? `${(market.probability * 100).toFixed(1)}%`
          : "?";

      const implied =
        typeof market.impliedProbability === "number"
          ? `${(market.impliedProbability * 100).toFixed(1)}%`
          : "?";

      const ev =
        typeof market.ev === "number" ? market.ev.toFixed(4) : "?";

      console.log(
        `  ${market.market ?? "?"}: modelo ${probability} | mercado implica ${implied} | odd ${market.odd ?? "?"} | EV ${ev} | ${market.classification ?? "?"}`
      );
    }
  }

  console.log(`\nRegistrado no ledger com id: ${entry.id}`);
  console.log(`Quando o jogo acabar: npx tsx scripts/realWorld.ts settle ${entry.id} win|loss`);
}

/* ==========================================
   SETTLE
========================================== */

function settleCommand(id: string, result: string) {
  if (result !== "win" && result !== "loss") {
    console.error('Resultado inválido. Use "win" ou "loss".');
    process.exit(1);
  }

  const ledger = loadLedger();
  const entry = ledger.find(item => item.id === id);

  if (!entry) {
    console.error(`Entrada não encontrada: ${id}`);
    process.exit(1);
  }

  if (entry.result) {
    console.warn(`⚠️ Entrada já liquidada como "${entry.result}". Sobrescrevendo.`);
  }

  entry.result = result;
  saveLedger(ledger);

  console.log(`✅ ${entry.match} marcada como ${result.toUpperCase()}.`);
}

/* ==========================================
   REPORT
========================================== */

function reportCommand() {
  const ledger = loadLedger();

  const bets: Bet[] = ledger
    .filter(entry => entry.recommendation && entry.result)
    .map(entry => ({
      id: entry.id,
      match: entry.match,
      market: entry.recommendation!.market,
      odd: entry.recommendation!.odd,
      probability: entry.recommendation!.probability,
      ev: entry.recommendation!.ev,
      kelly: 0,
      stake: 1,
      result: entry.result,
      createdAt: entry.createdAt,
      type: normalizeType(entry.recommendation!.classification)
    }));

  const report = buildCalibrationReport(bets);

  console.log(`\n=== CALIBRAÇÃO REAL (${bets.length} apostas liquidadas) ===\n`);

  if (report.sampleWarning) {
    console.log(`⚠️ ${report.sampleWarning}\n`);
  }

  console.log("GERAL:", report.overall);

  console.log("\nPOR MERCADO:");
  for (const [market, bucket] of Object.entries(report.byMarket)) {
    console.log(`  ${market}:`, bucket);
  }

  const pending = ledger.filter(entry => entry.recommendation && !entry.result);

  if (pending.length > 0) {
    console.log(`\n${pending.length} entrada(s) aguardando resultado:`);
    for (const entry of pending) {
      console.log(`  ${entry.id} — ${entry.match} (${entry.recommendation!.market})`);
    }
  }
}

function normalizeType(
  classification?: string
): Bet["type"] {
  if (
    classification === "SCALPER" ||
    classification === "ELITE" ||
    classification === "BET" ||
    classification === "WATCHLIST"
  ) {
    return classification;
  }

  return "BET";
}

/* ==========================================
   LIST
========================================== */

function listCommand() {
  const ledger = loadLedger();

  if (ledger.length === 0) {
    console.log("Ledger vazio.");
    return;
  }

  for (const entry of ledger) {
    const status = entry.result
      ? entry.result.toUpperCase()
      : entry.recommendation
        ? "PENDENTE"
        : "SEM ENTRADA";

    console.log(
      `${entry.id} | ${entry.match} | ${entry.recommendation?.market ?? "-"} | ${status}`
    );
  }
}

/* ==========================================
   CLI
========================================== */

const [, , command, ...args] = process.argv;

switch (command) {
  case "analyze":
    analyzeCommand(args[0]);
    break;

  case "settle":
    settleCommand(args[0], args[1]);
    break;

  case "report":
    reportCommand();
    break;

  case "list":
    listCommand();
    break;

  default:
    console.log(
      "Uso: npx tsx scripts/realWorld.ts <analyze <file.json> | settle <id> <win|loss> | report | list>"
    );
}
