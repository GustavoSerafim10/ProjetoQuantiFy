export interface ResultModelOutput {
  homeWin: number;
  draw: number;
  awayWin: number;

  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;

  doubleChance1X: number;
  doubleChanceX2: number;
  doubleChance12: number;

  confidence: number;
}

/**
 * Result Model (1X2)
 * Baseado na matriz conjunta de gols.
 * Mantém compatibilidade com homeWin/draw/awayWin
 * e adiciona probabilidades padronizadas + double chance.
 */
export function resultModel(matrix: number[][]): ResultModelOutput {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  const size = matrix.length;

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const prob = matrix[i]?.[j] ?? 0;

      if (i > j) homeWin += prob;
      else if (i === j) draw += prob;
      else awayWin += prob;
    }
  }

  const total = homeWin + draw + awayWin;

  if (total > 0) {
    homeWin /= total;
    draw /= total;
    awayWin /= total;
  }

  const maxProb = Math.max(homeWin, draw, awayWin);

  const confidence = Math.max(
    0,
    Math.min(1, Math.abs(maxProb - 0.33) * 1.5)
  );

  return {
    // compatibilidade antiga
    homeWin,
    draw,
    awayWin,

    // padrão novo
    homeWinProb: homeWin,
    drawProb: draw,
    awayWinProb: awayWin,

    doubleChance1X: homeWin + draw,
    doubleChanceX2: awayWin + draw,
    doubleChance12: homeWin + awayWin,

    confidence
  };
}