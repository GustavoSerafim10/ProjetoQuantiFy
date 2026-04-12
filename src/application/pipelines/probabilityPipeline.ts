import { calibrateProbability } from "../../domain/calibration/probabilityCalibration";

/* ===========================
   🎯 BASELINES POR MERCADO
=========================== */
const MARKET_BASELINES: Record<string, number> = {
  HOME: 0.45,
  DRAW: 0.27,
  AWAY: 0.28,

  OVER_1_5: 0.72,
  OVER_2_5: 0.52,

  BTTS_YES: 0.50,
  BTTS_NO: 0.50,

  DOUBLE_CHANCE_1X: 0.72,
  DOUBLE_CHANCE_X2: 0.72,
};

/* ===========================
   🔧 SAMPLE ADJUSTMENT
=========================== */
function applySampleAdjustment(
  probability: number,
  sampleSize: number,
  baseline: number
) {
  const weight = sampleSize / (sampleSize + 8);

  return (
    probability * weight +
    baseline * (1 - weight)
  );
}

/* ===========================
   🔥 AJUSTE + CALIBRAÇÃO
=========================== */
function adjustAndCalibrate(
  market: string,
  probability: number,
  sampleSize: number
) {
  const safeProb = probability ?? 0;

  const adjusted = applySampleAdjustment(
    safeProb,
    sampleSize,
    MARKET_BASELINES[market] ?? 0.5
  );

  return calibrateProbability(adjusted);
}

/* ===========================
   🚀 PIPELINE
=========================== */
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