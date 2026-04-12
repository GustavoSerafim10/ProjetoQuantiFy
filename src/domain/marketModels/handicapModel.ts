export interface HandicapMarket {
  line: number;
  homeProb: number;
  awayProb: number;
}

export interface HandicapModelOutput {
  markets: HandicapMarket[];
}

/**
 * Handicap Model
 * Baseado na matriz de gols (diferença de placar)
 */
export function handicapModel(matrix: number[][]): HandicapModelOutput {

  const size = matrix.length;

  const diffMap: Record<number, number> = {};

  // 🎯 Distribuição da diferença de gols
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {

      const diff = i - j;
      const prob = matrix[i][j];

      diffMap[diff] = (diffMap[diff] || 0) + prob;
    }
  }

  /**
   * Linhas principais de handicap
   */
  const lines = [-2, -1, -0.5, 0, 0.5, 1, 2];

  const markets: HandicapMarket[] = lines.map((line) => {

    let homeProb = 0;
    let awayProb = 0;

    Object.entries(diffMap).forEach(([d, prob]) => {

      const diff = Number(d);

      if (diff > line) {
        homeProb += prob;
      } else {
        awayProb += prob;
      }
    });

    return {
      line,
      homeProb,
      awayProb
    };
  });

  return { markets };
}