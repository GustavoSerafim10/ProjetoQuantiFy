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

const MARKET_SAMPLE_STRENGTH: Record<string, number> = {
  HOME: 16,
  DRAW: 18,
  AWAY: 16,

  OVER_1_5: 10,
  OVER_2_5: 12,

  BTTS_YES: 12,
  BTTS_NO: 12,

  DOUBLE_CHANCE_1X: 10,
  DOUBLE_CHANCE_X2: 10,
};

function clampProbability(probability: number, fallback = 0.5) {
  const num = Number(probability);

  if (!Number.isFinite(num)) return fallback;

  return Math.max(0.01, Math.min(num, 0.99));
}

function normalizeResultProbabilities(result: any) {
  const home = clampProbability(result?.homeWin, 0.42);
  const draw = clampProbability(result?.draw, 0.28);
  const away = clampProbability(result?.awayWin, 0.30);

  const total = home + draw + away;

  if (total <= 0) {
    return {
      homeWin: 0.42,
      draw: 0.28,
      awayWin: 0.30,
    };
  }

  return {
    homeWin: home / total,
    draw: draw / total,
    awayWin: away / total,
  };
}

function normalizeBinaryPair(
  yes: number,
  no: number,
  fallbackYes: number,
  fallbackNo: number
) {
  const safeYes = clampProbability(yes, fallbackYes);
  const safeNo = clampProbability(no, fallbackNo);

  const total = safeYes + safeNo;

  if (total <= 0) {
    return {
      yes: fallbackYes,
      no: fallbackNo,
    };
  }

  return {
    yes: safeYes / total,
    no: safeNo / total,
  };
}

function applySampleAdjustment(
  market: string,
  probability: number,
  sampleSize: number
) {
  const baseline = MARKET_BASELINES[market] ?? 0.5;
  const strength = MARKET_SAMPLE_STRENGTH[market] ?? 12;

  const safeProbability = clampProbability(probability, baseline);
  const safeSample = Math.max(0, Number(sampleSize ?? 0));

  const weight = safeSample / (safeSample + strength);

  const adjusted =
    safeProbability * weight +
    baseline * (1 - weight);

  return {
    raw: Number(safeProbability.toFixed(4)),
    baseline,
    sampleSize: safeSample,
    weight: Number(weight.toFixed(4)),
    adjusted: Number(adjusted.toFixed(4)),
  };
}

function adjustAndCalibrate(
  market: string,
  probability: number,
  sampleSize: number
) {
  const sampleAdjusted = applySampleAdjustment(
    market,
    probability,
    sampleSize
  );

  const calibrated = calibrateProbability(sampleAdjusted.adjusted);

  return {
    probability: clampProbability(calibrated, sampleAdjusted.adjusted),
    debug: {
      ...sampleAdjusted,
      calibrated: Number(
        clampProbability(calibrated, sampleAdjusted.adjusted).toFixed(4)
      ),
    },
  };
}

export function probabilityPipeline(data: any) {
  const { goals, btts, result } = data;

  const sampleSize = data.sampleSize ?? 20;

  const normalizedResult = normalizeResultProbabilities(result);

  const normalizedBtts = normalizeBinaryPair(
    btts?.yes,
    btts?.no,
    MARKET_BASELINES.BTTS_YES,
    MARKET_BASELINES.BTTS_NO
  );

  const over15Raw = clampProbability(
    goals?.over15,
    MARKET_BASELINES.OVER_1_5
  );

  const over25Raw = clampProbability(
    goals?.over25,
    MARKET_BASELINES.OVER_2_5
  );

  const home = adjustAndCalibrate(
    "HOME",
    normalizedResult.homeWin,
    sampleSize
  );

  const draw = adjustAndCalibrate(
    "DRAW",
    normalizedResult.draw,
    sampleSize
  );

  const away = adjustAndCalibrate(
    "AWAY",
    normalizedResult.awayWin,
    sampleSize
  );

  const over15 = adjustAndCalibrate(
    "OVER_1_5",
    over15Raw,
    sampleSize
  );

  const over25 = adjustAndCalibrate(
    "OVER_2_5",
    over25Raw,
    sampleSize
  );

  const bttsYes = adjustAndCalibrate(
    "BTTS_YES",
    normalizedBtts.yes,
    sampleSize
  );

  const bttsNo = adjustAndCalibrate(
    "BTTS_NO",
    normalizedBtts.no,
    sampleSize
  );

  const doubleChance1XRaw =
    normalizedResult.homeWin + normalizedResult.draw;

  const doubleChanceX2Raw =
    normalizedResult.awayWin + normalizedResult.draw;

  const doubleChance1X = adjustAndCalibrate(
    "DOUBLE_CHANCE_1X",
    doubleChance1XRaw,
    sampleSize
  );

  const doubleChanceX2 = adjustAndCalibrate(
    "DOUBLE_CHANCE_X2",
    doubleChanceX2Raw,
    sampleSize
  );

  const probs = {
    HOME: home.probability,
    DRAW: draw.probability,
    AWAY: away.probability,

    OVER_1_5: over15.probability,
    OVER_2_5: over25.probability,

    BTTS_YES: bttsYes.probability,
    BTTS_NO: bttsNo.probability,

    DOUBLE_CHANCE_1X: doubleChance1X.probability,
    DOUBLE_CHANCE_X2: doubleChanceX2.probability,
  };

  return {
    ...data,
    probs,

    debug: {
      ...(data.debug || {}),
      probabilityPipeline: {
        sampleSize,
        normalizedResult,
        normalizedBtts,

        raw: {
          HOME: normalizedResult.homeWin,
          DRAW: normalizedResult.draw,
          AWAY: normalizedResult.awayWin,
          OVER_1_5: over15Raw,
          OVER_2_5: over25Raw,
          BTTS_YES: normalizedBtts.yes,
          BTTS_NO: normalizedBtts.no,
          DOUBLE_CHANCE_1X: doubleChance1XRaw,
          DOUBLE_CHANCE_X2: doubleChanceX2Raw,
        },

        adjusted: {
          HOME: home.debug,
          DRAW: draw.debug,
          AWAY: away.debug,
          OVER_1_5: over15.debug,
          OVER_2_5: over25.debug,
          BTTS_YES: bttsYes.debug,
          BTTS_NO: bttsNo.debug,
          DOUBLE_CHANCE_1X: doubleChance1X.debug,
          DOUBLE_CHANCE_X2: doubleChanceX2.debug,
        },

        final: probs,
      },
    },
  };
}