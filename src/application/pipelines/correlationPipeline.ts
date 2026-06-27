import { applyCorrelationAdjustments } from "../../domain/correlation/correlationEngine";

export function correlationPipeline(data: any) {
  const markets = data.markets ?? [];

  const adjustedMarkets = applyCorrelationAdjustments(markets, {
    lambdaHome: data.lambdaHome,
    lambdaAway: data.lambdaAway,
    goalExpectationScore: data.goalExpectationScore,
  });

  const correlatedMarkets = adjustedMarkets.map((m: any) => {
    const name = String(m.market ?? "").toUpperCase();

    const warnings: string[] = [
      ...((m.warnings as string[]) ?? []),
    ];

    let correlationPenalty = Number(m.correlationPenalty ?? 0);

    if (
      name === "OVER_2_5" &&
      hasExactMarket(adjustedMarkets, "BTTS_NO")
    ) {
      warnings.push("CONFLICT_OVER25_BTTS_NO");
      correlationPenalty += 0.06;
    }

    if (
      name === "BTTS_NO" &&
      hasExactMarket(adjustedMarkets, "OVER_2_5")
    ) {
      warnings.push("CONFLICT_BTTS_NO_OVER25");
      correlationPenalty += 0.06;
    }

    if (
      name === "HOME_WIN" &&
      hasExactMarket(adjustedMarkets, "DOUBLE_CHANCE_1X")
    ) {
      warnings.push("DUPLICATED_EXPOSURE_HOME_DC");
      correlationPenalty += 0.03;
    }

    if (
      name === "AWAY_WIN" &&
      hasExactMarket(adjustedMarkets, "DOUBLE_CHANCE_X2")
    ) {
      warnings.push("DUPLICATED_EXPOSURE_AWAY_DC");
      correlationPenalty += 0.03;
    }

    const diff = Math.abs(
      Number(data.lambdaHome ?? 1) -
      Number(data.lambdaAway ?? 1)
    );

    if (name === "BTTS_YES" && diff > 1.4) {
      warnings.push("BTTS_YES_UNBALANCED_GAME");
      correlationPenalty += 0.07;
    }

    return {
      ...m,
      correlationPenalty: Number(correlationPenalty.toFixed(4)),
      warnings,
      debug: {
        ...(m.debug || {}),
        correlationPipeline: {
          warnings,
          correlationPenalty: Number(correlationPenalty.toFixed(4)),
        },
      },
    };
  });

  return {
    ...data,
    markets: correlatedMarkets,
    rawMarkets: adjustedMarkets,
    correlationApplied: true,

    debug: {
      ...(data.debug || {}),
      correlationPipeline: {
        inputMarkets: markets.length,
        outputMarkets: correlatedMarkets.length,
        removedMarkets: 0,
        note: "Correlation no longer hard-filters markets; it only adds warnings and penalties.",
      },
    },
  };
}

function hasExactMarket(markets: any[], target: string) {
  return markets.some(
    m => String(m.market ?? "").toUpperCase() === target
  );
}