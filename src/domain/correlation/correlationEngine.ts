export function applyCorrelationAdjustments(
  markets: any[],
  context: any
) {
  if (!Array.isArray(markets)) return [];

  const { lambdaHome, lambdaAway, goalExpectationScore } = context;

  const safeLambdaHome = Number(lambdaHome ?? 1);
  const safeLambdaAway = Number(lambdaAway ?? 1);

  const totalLambda = safeLambdaHome + safeLambdaAway;
  const diffLambda = Math.abs(safeLambdaHome - safeLambdaAway);
  const minLambda = Math.min(safeLambdaHome, safeLambdaAway);

  const marketNames = markets.map(x =>
    String(x?.market ?? "").toUpperCase()
  );

  return markets.map((m: any) => {
    const name = String(m?.market ?? "").toUpperCase();

    let penalty = 0;
    let boost = 0;

    if (
      name === "OVER_2_5" &&
      marketNames.includes("BTTS_YES")
    ) {
      penalty += 0.05;
    }

    if (
      name === "BTTS_YES" &&
      marketNames.includes("OVER_2_5")
    ) {
      penalty += 0.05;
    }

    if (
      name === "OVER_2_5" &&
      marketNames.includes("BTTS_NO")
    ) {
      penalty += 0.08;
    }

    if (
      name === "BTTS_NO" &&
      marketNames.includes("OVER_2_5")
    ) {
      penalty += 0.08;
    }

    if (
      name === "BTTS_NO" &&
      goalExpectationScore < 0.45
    ) {
      boost += 0.05;
    }

    if (
      name === "HOME_WIN" &&
      marketNames.includes("DOUBLE_CHANCE_1X")
    ) {
      penalty += 0.06;
    }

    if (
      name === "AWAY_WIN" &&
      marketNames.includes("DOUBLE_CHANCE_X2")
    ) {
      penalty += 0.06;
    }

    if (
      name === "DOUBLE_CHANCE_1X" &&
      marketNames.includes("HOME_WIN")
    ) {
      penalty += 0.06;
    }

    if (
      name === "DOUBLE_CHANCE_X2" &&
      marketNames.includes("AWAY_WIN")
    ) {
      penalty += 0.06;
    }

    if (
      ["HOME_WIN", "AWAY_WIN"].includes(name) &&
      diffLambda < 0.35
    ) {
      penalty += 0.07;
    }

    if (
      name === "OVER_2_5" &&
      goalExpectationScore < 0.60
    ) {
      penalty += 0.06;
    }

    if (
      name === "OVER_1_5" &&
      totalLambda < 2.2
    ) {
      penalty += 0.05;
    }

    if (
      name === "BTTS_YES" &&
      totalLambda < 2.4
    ) {
      penalty += 0.06;
    }

    if (
      name === "BTTS_YES" &&
      minLambda < 0.85
    ) {
      penalty += 0.08;
    }

    if (
      name === "OVER_2_5" &&
      diffLambda > 1.6
    ) {
      penalty += 0.07;
    }

    if (
      ["BTTS_YES", "OVER_2_5"].includes(name)
    ) {
      if (
        minLambda >= 1.0 &&
        totalLambda >= 2.8
      ) {
        boost += 0.04;
      }

      if (minLambda < 0.75) {
        penalty += 0.05;
      }
    }

    let newRisk = Number(m.riskScore ?? m.risk ?? 0.5);
    let newConfidence = Number(m.confidence ?? 0.6);

    newRisk = Math.max(
      0,
      Math.min(1, newRisk + penalty - boost)
    );

    newConfidence = Math.max(
      0,
      Math.min(1, newConfidence - penalty + boost)
    );

    return {
      ...m,
      riskScore: Number(newRisk.toFixed(4)),
      confidence: Number(newConfidence.toFixed(4)),
      correlationPenalty: Number(penalty.toFixed(4)),
      correlationBoost: Number(boost.toFixed(4)),
      correlationAdjusted: true
    };
  });
}