interface ConfidenceInput {
  goals: any;
  btts: any;
  result: any;
  lambdaHome: number;
  lambdaAway: number;
}

export function calculateGlobalConfidence(input: ConfidenceInput): number {
  const { goals, btts, result, lambdaHome, lambdaAway } = input;

  const safeGoalsOver25 = Number(goals?.over25 ?? 0.5);
  const safeBttsYes = Number(btts?.yes ?? 0.5);

  const safeHomeWin = Number(result?.homeWin ?? 0.33);
  const safeDraw = Number(result?.draw ?? 0.33);
  const safeAwayWin = Number(result?.awayWin ?? 0.33);

  const safeLambdaHome = Number(lambdaHome ?? 1.2);
  const safeLambdaAway = Number(lambdaAway ?? 1.0);

  const totalLambda = safeLambdaHome + safeLambdaAway;
  const lambdaDiff = Math.abs(safeLambdaHome - safeLambdaAway);
  const minLambda = Math.min(safeLambdaHome, safeLambdaAway);

  const maxResult = Math.max(safeHomeWin, safeDraw, safeAwayWin);
  const resultSeparation = maxResult - Math.min(safeHomeWin, safeAwayWin, safeDraw);

  const dominance = Math.min(0.45, Math.abs(maxResult - 0.33) * 1.15);

  const goalsBias = Math.abs(safeGoalsOver25 - 0.5);
  const bttsBias = Math.abs(safeBttsYes - 0.5);
  const resultBias = Math.abs(maxResult - 0.33);

  const consistency =
    (goalsBias * 0.35) +
    (bttsBias * 0.25) +
    (resultBias * 0.40);

  let structureFactor = 0.50;

  if (totalLambda >= 2.2 && totalLambda <= 3.05) {
    structureFactor = 0.66;
  } else if (totalLambda < 2.2) {
    structureFactor = 0.54;
  } else {
    structureFactor = 0.58;
  }

  if (lambdaDiff > 0.55 && lambdaDiff <= 1.50) {
    structureFactor += 0.04;
  }

  if (lambdaDiff < 0.25 && safeDraw >= 0.27) {
    structureFactor += 0.03;
  }

  if (totalLambda >= 2.7 && minLambda >= 0.95) {
    structureFactor += 0.03;
  }

  if (totalLambda >= 2.8 && minLambda < 0.75) {
    structureFactor -= 0.08;
  }

  if (lambdaDiff > 1.8) {
    structureFactor -= 0.07;
  }

  if (safeGoalsOver25 > 0.68 && totalLambda < 2.45) {
    structureFactor -= 0.07;
  }

  if (safeBttsYes > 0.62 && minLambda < 0.85) {
    structureFactor -= 0.08;
  }

  if (resultSeparation < 0.12) {
    structureFactor -= 0.03;
  }

  structureFactor = Math.max(0, Math.min(structureFactor, 1));

  let confidence =
    (dominance * 0.28) +
    (consistency * 0.32) +
    (structureFactor * 0.40);

  confidence = Math.max(0, Math.min(1, confidence));

  return Number(confidence.toFixed(4));
}