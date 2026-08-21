import { sanitizeProbability } from "./numericHelpers";

/* ==========================================
   MATRIZ POISSON INDEPENDENTE
========================================== */

export function buildIndependentMatrix(
  homeDistribution: number[],
  awayDistribution: number[],
  maxGoals: number
): number[][] {
  const matrix: number[][] = [];

  for (
    let homeGoals = 0;
    homeGoals <= maxGoals;
    homeGoals++
  ) {
    const row: number[] = [];

    for (
      let awayGoals = 0;
      awayGoals <= maxGoals;
      awayGoals++
    ) {
      const homeProbability =
        sanitizeProbability(
          homeDistribution[homeGoals]
        );

      const awayProbability =
        sanitizeProbability(
          awayDistribution[awayGoals]
        );

      const jointProbability =
        homeProbability *
        awayProbability;

      row.push(
        Number.isFinite(jointProbability)
          ? Math.max(
              0,
              jointProbability
            )
          : 0
      );
    }

    matrix.push(row);
  }

  return matrix;
}
