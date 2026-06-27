export function applyCorrelationAdjustments(
  markets: any[],
  context: any
) {
  if (!Array.isArray(markets)) return [];

  const safe = (n: any, fallback = 0) => {
    const num = Number(n);
    return Number.isFinite(num) ? num : fallback;
  };

  const clamp = (n: number, min = 0, max = 1) =>
    Math.max(min, Math.min(n, max));

  const lambdaHome = safe(context?.lambdaHome, 1);
  const lambdaAway = safe(context?.lambdaAway, 1);
  const goalExpectationScore = safe(context?.goalExpectationScore, 0.5);

  const totalLambda = lambdaHome + lambdaAway;
  const diffLambda = Math.abs(lambdaHome - lambdaAway);
  const minLambda = Math.min(lambdaHome, lambdaAway);

  const marketNames = markets.map(x =>
    String(x?.market ?? "").toUpperCase()
  );

  return markets.map((m: any) => {
    const name = String(m?.market ?? "").toUpperCase();

    let penalty = 0;
    let boost = 0;
    const warnings: string[] = [...((m.warnings as string[]) ?? [])];

    if (name === "OVER_2_5" && marketNames.includes("BTTS_YES")) {
      boost += 0.02;
      warnings.push("POSITIVE_CORRELATION_OVER25_BTTS_YES");
    }

    if (name === "BTTS_YES" && marketNames.includes("OVER_2_5")) {
      boost += 0.02;
      warnings.push("POSITIVE_CORRELATION_BTTS_YES_OVER25");
    }

    if (name === "OVER_2_5" && marketNames.includes("BTTS_NO")) {
      penalty += 0.04;
      warnings.push("NEGATIVE_CORRELATION_OVER25_BTTS_NO");
    }

    if (name === "BTTS_NO" && marketNames.includes("OVER_2_5")) {
      penalty += 0.04;
      warnings.push("NEGATIVE_CORRELATION_BTTS_NO_OVER25");
    }

    if (name === "BTTS_NO" && goalExpectationScore < 0.45) {
      boost += 0.04;
      warnings.push("LOW_GOAL_SUPPORTS_BTTS_NO");
    }

    if (name === "HOME_WIN" && marketNames.includes("DOUBLE_CHANCE_1X")) {
      penalty += 0.025;
      warnings.push("DUPLICATED_HOME_EXPOSURE");
    }

    if (name === "AWAY_WIN" && marketNames.includes("DOUBLE_CHANCE_X2")) {
      penalty += 0.025;
      warnings.push("DUPLICATED_AWAY_EXPOSURE");
    }

    if (name === "DOUBLE_CHANCE_1X" && marketNames.includes("HOME_WIN")) {
      penalty += 0.015;
      warnings.push("PROTECTED_HOME_EXPOSURE");
    }

    if (name === "DOUBLE_CHANCE_X2" && marketNames.includes("AWAY_WIN")) {
      penalty += 0.015;
      warnings.push("PROTECTED_AWAY_EXPOSURE");
    }

    if (["HOME_WIN", "AWAY_WIN"].includes(name) && diffLambda < 0.30) {
      penalty += 0.05;
      warnings.push("LOW_LAMBDA_DIFF_RESULT_RISK");
    }

    if (name === "OVER_2_5" && goalExpectationScore < 0.55) {
      penalty += 0.04;
      warnings.push("LOW_GOAL_SCORE_OVER25_RISK");
    }

    if (name === "OVER_1_5" && totalLambda < 2.0) {
      penalty += 0.035;
      warnings.push("LOW_TOTAL_LAMBDA_OVER15_RISK");
    }

    if (name === "BTTS_YES" && totalLambda < 2.2) {
      penalty += 0.04;
      warnings.push("LOW_TOTAL_LAMBDA_BTTS_RISK");
    }

    if (name === "BTTS_YES" && minLambda < 0.80) {
      penalty += 0.055;
      warnings.push("LOW_MIN_LAMBDA_BTTS_RISK");
    }

    if (name === "OVER_2_5" && diffLambda > 1.65 && minLambda < 0.85) {
      penalty += 0.045;
      warnings.push("UNBALANCED_OVER25_RISK");
    }

    if (
      ["BTTS_YES", "OVER_2_5"].includes(name) &&
      minLambda >= 1.0 &&
      totalLambda >= 2.75
    ) {
      boost += 0.035;
      warnings.push("STRUCTURE_SUPPORTS_GOALS");
    }

    const baseRisk = clamp(safe(m.riskScore ?? m.risk, 0.5));
    const baseConfidence = clamp(safe(m.confidence, 0.6));

    const netAdjustment = penalty - boost;

    const newRisk = clamp(baseRisk + netAdjustment);
    const newConfidence = clamp(baseConfidence - netAdjustment * 0.7);

    return {
      ...m,
      riskScore: Number(newRisk.toFixed(4)),
      risk: Number(newRisk.toFixed(4)),
      confidence: Number(newConfidence.toFixed(4)),
      correlationPenalty: Number(penalty.toFixed(4)),
      correlationBoost: Number(boost.toFixed(4)),
      correlationNet: Number(netAdjustment.toFixed(4)),
      correlationAdjusted: true,
      warnings,

      debug: {
        ...(m.debug || {}),
        correlationEngine: {
          lambdaHome,
          lambdaAway,
          totalLambda: Number(totalLambda.toFixed(4)),
          diffLambda: Number(diffLambda.toFixed(4)),
          minLambda: Number(minLambda.toFixed(4)),
          goalExpectationScore,
          penalty: Number(penalty.toFixed(4)),
          boost: Number(boost.toFixed(4)),
          netAdjustment: Number(netAdjustment.toFixed(4)),
          baseRisk,
          newRisk: Number(newRisk.toFixed(4)),
          baseConfidence,
          newConfidence: Number(newConfidence.toFixed(4)),
          warnings,
        },
      },
    };
  });
}