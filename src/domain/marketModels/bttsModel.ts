export interface BTTSModelOutput {
  yes: number;
  no: number;
  confidence: number;
}

/**
 * BTTS Model (Both Teams To Score)
 * Baseado na matriz conjunta de gols
 * (nível institucional — sem independência simplificada)
 */
export function bttsModel(matrix: number[][]): BTTSModelOutput {

  let yes = 0;
  let no = 0;

  const size = matrix.length;

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {

      const prob = matrix[i][j];

      if (i > 0 && j > 0) {
        yes += prob;
      } else {
        no += prob;
      }
    }
  }

  /**
   * Confiança do modelo:
   * Quanto mais distante de 50%, maior confiança
   */
  const confidence = Math.abs(yes - 0.5) * 2;

  return {
    yes,
    no,
    confidence
  };
}