export interface ResultModelOutput {
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: number;
}

/**
 * Result Model (1X2)
 * Baseado na matriz conjunta de gols
 */
export function resultModel(matrix: number[][]): ResultModelOutput {

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  const size = matrix.length;

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {

      const prob = matrix[i][j];

      if (i > j) homeWin += prob;
      else if (i === j) draw += prob;
      else awayWin += prob;
    }
  }

  /**
   * Confiança:
   * diferença entre maior probabilidade e equilíbrio
   */
  const maxProb = Math.max(homeWin, draw, awayWin);
  const confidence = Math.abs(maxProb - 0.33) * 1.5;

  return {
    homeWin,
    draw,
    awayWin,
    confidence
  };
}