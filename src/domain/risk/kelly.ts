/*
 * Achado real em 2026-09-09: este arquivo tinha uma segunda fórmula
 * de stake (`calculateStakePro`), usada só pelo backtest, com Kelly
 * cheio e multiplicadores próprios — divergente da fórmula real de
 * produção (`calculateDecisionStake`, em
 * application/pipelines/decisionPipeline/stake.ts, que já usa
 * Kelly fracionado + fatores de risco/confiança/classificação).
 * Isso fazia a curva de banca/ROI/drawdown do backtest não
 * corresponder ao dimensionamento real de aposta. Removida —
 * runBacktest.ts agora usa `best.stake`, o valor que o
 * decisionPipeline real já calcula.
 */
export function kellyCriterion(
  probability: number,
  odd: number
): number {
  const p = Number(probability);
  const o = Number(odd);

  if (
    !Number.isFinite(p) ||
    !Number.isFinite(o) ||
    p <= 0 ||
    p >= 1 ||
    o <= 1
  ) {
    return 0;
  }

  const b = o - 1;
  const q = 1 - p;

  const kelly = ((b * p) - q) / b;

  return Number(Math.max(kelly, 0).toFixed(4));
}
