import { calibrateProbability } from "../../domain/calibration/probabilityCalibration";

const MARKET_BASELINES: Record<string, number> = {
  HOME: 0.42,
  DRAW: 0.28,
  AWAY: 0.30,

  OVER_1_5: 0.68,
  OVER_2_5: 0.48,

  BTTS_YES: 0.48,
  BTTS_NO: 0.52,

  DOUBLE_CHANCE_1X: 0.68,
  DOUBLE_CHANCE_X2: 0.68,
};

function applySampleAdjustment(
  probability: number,
  sampleSize: number,
  baseline: number
) {
  const safeProbability = Math.max(0.01, Math.min(Number(probability ?? baseline), 0.99));
  const safeSample = Math.max(0, Number(sampleSize ?? 0));

  const weight = safeSample / (safeSample + 12);

  return (
    safeProbability * weight +
    baseline * (1 - weight)
  );
}

function adjustAndCalibrate(
  market: string,
  probability: number,
  sampleSize: number
) {
  const adjusted = applySampleAdjustment(
    probability,
    sampleSize,
    MARKET_BASELINES[market] ?? 0.5
  );

  return calibrateProbability(adjusted);
}

export function probabilityPipeline(data: any) {
  const {
    goals,
    btts,
    result
  } = data;

  const sampleSize = data.sampleSize ?? 10;

  const probs = {
    HOME: adjustAndCalibrate("HOME", result?.homeWin, sampleSize),
    DRAW: adjustAndCalibrate("DRAW", result?.draw, sampleSize),
    AWAY: adjustAndCalibrate("AWAY", result?.awayWin, sampleSize),

    OVER_1_5: adjustAndCalibrate("OVER_1_5", goals?.over15, sampleSize),
    OVER_2_5: adjustAndCalibrate("OVER_2_5", goals?.over25, sampleSize),

    BTTS_YES: adjustAndCalibrate("BTTS_YES", btts?.yes, sampleSize),
    BTTS_NO: adjustAndCalibrate("BTTS_NO", btts?.no, sampleSize),

    DOUBLE_CHANCE_1X: adjustAndCalibrate(
      "DOUBLE_CHANCE_1X",
      (result?.homeWin ?? 0) + (result?.draw ?? 0),
      sampleSize
    ),

    DOUBLE_CHANCE_X2: adjustAndCalibrate(
      "DOUBLE_CHANCE_X2",
      (result?.awayWin ?? 0) + (result?.draw ?? 0),
      sampleSize
    ),
  };

  return {
    ...data,
    probs
  };
}