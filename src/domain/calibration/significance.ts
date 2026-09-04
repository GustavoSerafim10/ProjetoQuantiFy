/*
 * Teste de significância de uma proporção observada (ex.: win rate
 * real de um mercado) contra uma proporção esperada (ex.: a
 * probabilidade média que o próprio modelo previu para esse
 * mercado) — aproximação normal padrão (mesmo z de 95% já usado em
 * monteCarloBacktest.ts para o IC95 do ROI). Existe pra separar
 * "o modelo errou de verdade nesse mercado" de "aconteceu de dar
 * uma sequência ruim, mas é ruído de amostra pequena" — sem isso,
 * qualquer correção baseada em histórico real vira só mais um
 * threshold burro reagindo a variância normal.
 */

const Z_95 = 1.959963984540054;

export function isSignificantDeviation(
  sampleSize: number,
  observedRate: number,
  expectedRate: number
): boolean {
  if (
    !Number.isFinite(sampleSize) ||
    sampleSize <= 0 ||
    !Number.isFinite(observedRate) ||
    !Number.isFinite(expectedRate)
  ) {
    return false;
  }

  /*
   * expectedRate em 0 ou 1 faria standardError = 0 — não dá pra
   * testar significância contra uma probabilidade "certeza
   * absoluta" (nenhum mercado real tem isso). Trata como não
   * testável em vez de gerar um z infinito/artificial.
   */
  if (expectedRate <= 0 || expectedRate >= 1) {
    return false;
  }

  const standardError = Math.sqrt(
    (expectedRate * (1 - expectedRate)) / sampleSize
  );

  if (!Number.isFinite(standardError) || standardError === 0) {
    return false;
  }

  const z = (observedRate - expectedRate) / standardError;

  return Number.isFinite(z) && Math.abs(z) > Z_95;
}
