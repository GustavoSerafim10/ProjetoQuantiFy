export function calculateXGProxy(
  shotsOnTarget: number = 0,
  shots: number = 0
): number {

  // pesos calibrados empiricamente
  const xg =
    shotsOnTarget * 0.30 +
    shots * 0.08;

  return Math.max(0.2, xg);
}