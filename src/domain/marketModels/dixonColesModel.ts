export function dixonColesAdjustment(
  i: number,
  j: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number = -0.1 // correlação padrão
): number {

  if (i === 0 && j === 0) {
    return 1 - (lambdaHome * lambdaAway * rho);
  }

  if (i === 0 && j === 1) {
    return 1 + (lambdaHome * rho);
  }

  if (i === 1 && j === 0) {
    return 1 + (lambdaAway * rho);
  }

  if (i === 1 && j === 1) {
    return 1 - rho;
  }

  return 1;
}