import { calculateRiskV2 } from "../../domain/analysis/riskEngine";
import { classifyZone } from "./zoneClassifier";
import { calculateStakePro } from "../../domain/risk/kelly";

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

export function decisionEngine(input: any) {
  const probability = safe(input.probability, 0);
  const bookmakerOdd = safe(input.bookmakerOdd ?? input.odd, 0);
  const expectedValue = safe(input.ev ?? input.expectedValue, -1);
  const kelly = safe(input.kelly, 0);

  const lambdaHome = safe(input.lambdaHome, 1.2);
  const lambdaAway = safe(input.lambdaAway, 1.0);

  if (probability <= 0 || bookmakerOdd <= 1) {
    return {
      decision: "NO BET",
      reason: "INVALID_INPUT",
      probability,
      bookmakerOdd,
      expectedValue,
      kelly,
      riskScore: 1,
      zone: "RED",
      stake: 0
    };
  }

  const fairOdd = 1 / probability;

  const riskScore = safe(
    input.risk ??
    input.riskScore ??
    calculateRiskV2({
      probability,
      ev: expectedValue,
      kelly,
      market: input.market,
      lambdaHome,
      lambdaAway
    }),
    0.6
  );

  let decision = "NO BET";
  let reason = "NO_EDGE";

  if (
    expectedValue >= 0.12 &&
    probability >= 0.62 &&
    riskScore <= 0.55
  ) {
    decision = "ELITE";
    reason = "STRONG_VALUE";
  } else if (
    expectedValue >= 0.07 &&
    probability >= 0.58 &&
    riskScore <= 0.62
  ) {
    decision = "BET";
    reason = "OPERATIONAL_VALUE";
  } else if (
    expectedValue >= 0.035 &&
    probability >= 0.54 &&
    riskScore <= 0.68
  ) {
    decision = "WATCHLIST";
    reason = "POTENTIAL_VALUE";
  }

 const zone = classifyZone({
  expectedValue,
  riskScore,
  kelly,
  probability
});

const stake =
  ["ELITE", "BET"].includes(decision)
    ? calculateStakePro({
        ...input,
        probability,
        ev: expectedValue,
        kelly,
        risk: riskScore
      })
    : 0;

return {
  ...input,
  probability,
  bookmakerOdd,
  fairOdd,
  expectedValue,
  ev: expectedValue,
  kelly,
  riskScore,
  risk: riskScore,
  decision,
  reason,
  zone,
  stake
};
}