
import { calculateRiskScore } from "../../domain/risk/riskScore";

function clamp(n: number, min = 0.05, max = 0.95) {
  return Math.max(min, Math.min(Number(n), max));
}

function safe(n: any, fallback = 0) {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

function getMarketType(market: string) {
  const m = String(market ?? "").toLowerCase();

  if (m.includes("double") || m.includes("1x") || m.includes("x2")) return "DOUBLE";
  if (m.includes("over")) return "OVER";
  if (m === "btts_yes") return "BTTS_YES";
  if (m === "btts_no") return "BTTS_NO";
  if (m.includes("home") || m.includes("away") || m.includes("draw")) return "RESULT";

  return "OTHER";
}

export function riskPipeline(data: any) {
  const lambdaHome = safe(data.lambdaHome, 1.2);
  const lambdaAway = safe(data.lambdaAway, 1.0);

  const totalLambda = lambdaHome + lambdaAway;
  const balance = Math.abs(lambdaHome - lambdaAway);

  const markets = (data.markets ?? []).map((m: any) => {
    const type = getMarketType(m.market);

    const baseRisk = calculateRiskScore({
      lambdaHome,
      lambdaAway,
      leagueAvgGoals: data.leagueAvgGoals ?? 1.3,
      eventProbability: m.probability ?? 0.5,
      recentGoalStd: data.recentGoalStd ?? 1,
      seasonGoalAvg: data.seasonGoalAvg ?? 1.2,
    });

    let riskAdjustment = 0;
    const warnings: string[] = [...((m.warnings as string[]) ?? [])];

    if (data?.isLowGoalGame && type === "OVER") {
      riskAdjustment += 0.07;
      warnings.push("LOW_GOAL_GAME_OVER_RISK");
    }

    if (data?.goalExpectationScore !== undefined) {
      const score = safe(data.goalExpectationScore, 0.5);

      if (type === "OVER") {
        if (score < 0.45) {
          riskAdjustment += 0.08;
          warnings.push("LOW_GOAL_SCORE_OVER_RISK");
        } else if (score < 0.55) {
          riskAdjustment += 0.04;
          warnings.push("MODERATE_GOAL_SCORE_OVER_RISK");
        }
      }

      if (type === "BTTS_YES" && score < 0.50) {
        riskAdjustment += 0.04;
        warnings.push("LOW_GOAL_SCORE_BTTS_YES_RISK");
      }

      if (type === "BTTS_NO" && score > 0.65) {
        riskAdjustment += 0.04;
        warnings.push("HIGH_GOAL_SCORE_BTTS_NO_RISK");
      }
    }

    if (balance < 0.25) {
      if (type === "RESULT") {
        riskAdjustment += 0.06;
        warnings.push("BALANCED_GAME_RESULT_RISK");
      }

      if (type === "DOUBLE") {
        riskAdjustment += 0.035;
        warnings.push("BALANCED_GAME_DOUBLE_RISK");
      }

      if (type === "BTTS_NO") {
        riskAdjustment += 0.035;
        warnings.push("BALANCED_GAME_BTTS_NO_RISK");
      }

      if (type === "OVER") {
        riskAdjustment += 0.015;
        warnings.push("BALANCED_GAME_OVER_MINOR_RISK");
      }
    }

    if (totalLambda > 3.2) {
      if (type === "OVER") {
        riskAdjustment -= 0.04;
        warnings.push("HIGH_TOTAL_LAMBDA_SUPPORTS_OVER");
      }

      if (type === "BTTS_NO") {
        riskAdjustment += 0.05;
        warnings.push("HIGH_TOTAL_LAMBDA_BTTS_NO_RISK");
      }
    }

    if (m.probability > 0.84 && m.odd < 1.45) {
      riskAdjustment += 0.035;
      warnings.push("HIGH_PROB_LOW_ODD_RISK");
    }

    const finalRisk = clamp(baseRisk + riskAdjustment);

    return {
      ...m,
      risk: Number(finalRisk.toFixed(4)),
      riskScore: Number(finalRisk.toFixed(4)),
      warnings,

      debug: {
        ...(m.debug || {}),
        riskPipeline: {
          type,
          baseRisk: Number(baseRisk.toFixed(4)),
          riskAdjustment: Number(riskAdjustment.toFixed(4)),
          finalRisk: Number(finalRisk.toFixed(4)),
          totalLambda: Number(totalLambda.toFixed(4)),
          balance: Number(balance.toFixed(4)),
          warnings,
        },
      },
    };
  });

  return {
    ...data,
    markets,

    debug: {
      ...(data.debug || {}),
      riskPipeline: {
        inputMarkets: data.markets?.length ?? 0,
        outputMarkets: markets.length,
        totalLambda: Number(totalLambda.toFixed(4)),
        balance: Number(balance.toFixed(4)),
        note: "Risk now uses additive adjustments instead of aggressive multiplicative cascade.",
      },
    },
  };
}