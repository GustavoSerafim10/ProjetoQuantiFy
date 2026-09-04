import { runMonteCarloBacktest } from "../src/application/backtest/monteCarloBacktest.ts";

/*
 * CLI de robustez estatística — roda N backtests sintéticos
 * genuinamente independentes (ver monteCarloBacktest.ts) e imprime
 * um resumo legível: não é "qual foi o ROI de UM backtest", é "o
 * quão estável essa política de decisão é através de muitas
 * amostras diferentes" — IC95, Sharpe, Sortino, risco de ruína,
 * percentis. Uso: npm run backtest:robustness
 * (ou com argumentos: npm run backtest:robustness -- 200 2000)
 */

const simulationsArg = Number(process.argv[2]);
const matchesArg = Number(process.argv[3]);

const simulations =
  Number.isFinite(simulationsArg) && simulationsArg > 0
    ? Math.round(simulationsArg)
    : 100;

const matchesPerSimulation =
  Number.isFinite(matchesArg) && matchesArg > 0
    ? Math.round(matchesArg)
    : 1500;

console.log(
  `\nRodando ${simulations} simulações independentes de ${matchesPerSimulation} partidas sintéticas cada...\n(pode levar alguns minutos)\n`
);

const startedAt = Date.now();

/*
 * leagueStrength.ts avisa (console.warn) toda vez que resolve uma
 * liga desconhecida — legítimo numa análise ao vivo real, mas puro
 * ruído aqui: o backtest sintético usa uma chave de liga que nunca
 * existe de propósito, então esse aviso dispara em toda partida de
 * toda simulação. Silenciado só neste script, não na lib.
 */
const originalConsoleWarn = console.warn;
console.warn = () => {};

let summary: ReturnType<typeof runMonteCarloBacktest>;

try {
  summary = runMonteCarloBacktest(simulations, matchesPerSimulation, {
    minimumReliableSimulations: Math.min(simulations, 30),
    minimumReliableTotalBets: 100
  });
} finally {
  console.warn = originalConsoleWarn;
}

const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

function pct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

function fmt(value: number | null, decimals = 3): string {
  return value === null ? "—" : value.toFixed(decimals);
}

console.log("=".repeat(60));
console.log("RELATÓRIO DE ROBUSTEZ ESTATÍSTICA");
console.log("=".repeat(60));

console.log(`\nSimulações completadas: ${summary.metadata.simulationsCompleted}/${summary.metadata.simulationsRequested}`);
console.log(`Apostas totais: ${summary.totalBetsAcrossSimulations} (média ${summary.averageBetsPerSimulation.toFixed(1)}/simulação)`);
console.log(`Tempo: ${elapsedSeconds}s`);

console.log(`\n--- ROI ---`);
console.log(`Média: ${pct(summary.roi.mean)}  |  Mediana: ${pct(summary.roi.median)}  |  Desvio padrão: ${pct(summary.roi.standardDeviation)}`);
console.log(`IC95%: [${pct(summary.roi.confidenceInterval95.lower)}, ${pct(summary.roi.confidenceInterval95.upper)}]`);
console.log(`Percentis: p05=${pct(summary.roi.percentiles.p05)}  p25=${pct(summary.roi.percentiles.p25)}  p50=${pct(summary.roi.percentiles.p50)}  p75=${pct(summary.roi.percentiles.p75)}  p95=${pct(summary.roi.percentiles.p95)}`);

console.log(`\n--- RISCO ---`);
console.log(`Drawdown médio: ${pct(summary.averageDrawdown)}`);
console.log(`Probabilidade de lucro: ${pct(summary.probabilityOfProfit)}`);
console.log(`Probabilidade de ruína: ${pct(summary.probabilityOfRuin)}`);
console.log(`Sharpe: ${fmt(summary.sharpeRatio)}  |  Sortino: ${fmt(summary.sortinoRatio)}`);

console.log(`\n--- DIAGNÓSTICO ---`);
console.log(`Estatisticamente confiável: ${summary.diagnostics.statisticallyReliable ? "sim" : "não"}`);
console.log(`Lucrativo: ${summary.diagnostics.profitable ? "sim" : "não"}`);
console.log(`Estável: ${summary.diagnostics.stable ? "sim" : "não"}`);
console.log(`Alta variância: ${summary.diagnostics.highVariance ? "sim" : "não"}`);

if (summary.diagnostics.warnings.length > 0) {
  console.log(`\nAvisos: ${summary.diagnostics.warnings.join(", ")}`);
}

console.log(`\n--- QUALIDADE GERAL: ${summary.quality} (${summary.qualityScore}/100) ---\n`);
