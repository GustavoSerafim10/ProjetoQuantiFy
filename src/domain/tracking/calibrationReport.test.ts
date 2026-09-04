import { describe, expect, it } from "vitest";

import { buildCalibrationReport } from "./calibrationReport";
import type { Bet } from "./trackingEngine";

function bet(overrides: Partial<Bet>): Bet {
  return {
    id: overrides.id ?? Math.random().toString(36),
    match: "Match X",
    market: "HOME",
    odd: 2.0,
    probability: 0.5,
    ev: 0.1,
    kelly: 0.05,
    stake: 10,
    createdAt: overrides.createdAt ?? Date.now(),
    type: "BET",
    ...overrides
  };
}

describe("buildCalibrationReport", () => {
  it("returns an empty-sample warning with no settled bets", () => {
    const report = buildCalibrationReport([]);

    expect(report.overall.bets).toBe(0);
    expect(report.sampleWarning).toMatch(/Nenhuma aposta liquidada/);
    expect(report.recentVsAllTime).toBeNull();
  });

  it("ignores unsettled bets (no result yet)", () => {
    const bets = [
      bet({ result: undefined }),
      bet({ result: "win", profit: 10 })
    ];

    const report = buildCalibrationReport(bets);

    expect(report.overall.bets).toBe(1);
  });

  it("computes winRate, avgProbability and calibrationError correctly", () => {
    const bets = [
      bet({ probability: 0.6, result: "win", profit: 6, stake: 10 }),
      bet({ probability: 0.6, result: "loss", profit: -10, stake: 10 }),
      bet({ probability: 0.6, result: "win", profit: 6, stake: 10 })
    ];

    const report = buildCalibrationReport(bets);

    expect(report.overall.bets).toBe(3);
    expect(report.overall.winRate).toBeCloseTo(2 / 3, 4);
    expect(report.overall.avgProbability).toBeCloseTo(0.6, 4);
    expect(report.overall.calibrationError).toBeCloseTo(
      Math.abs(0.6 - 2 / 3),
      4
    );
  });

  it("computes a Brier score of 0 for perfect predictions", () => {
    const bets = [
      bet({ probability: 1, result: "win" }),
      bet({ probability: 0, result: "loss" })
    ];

    const report = buildCalibrationReport(bets);

    expect(report.overall.brierScore).toBe(0);
  });

  it("computes a Brier score of 0.25 for uninformative 50% predictions", () => {
    const bets = [
      bet({ probability: 0.5, result: "win" }),
      bet({ probability: 0.5, result: "loss" })
    ];

    const report = buildCalibrationReport(bets);

    expect(report.overall.brierScore).toBeCloseTo(0.25, 4);
  });

  it("groups by market and by classification independently", () => {
    const bets = [
      bet({ market: "HOME", type: "BET", result: "win", profit: 5 }),
      bet({ market: "HOME", type: "ELITE", result: "loss", profit: -10 }),
      bet({ market: "OVER_2_5", type: "BET", result: "win", profit: 8 })
    ];

    const report = buildCalibrationReport(bets);

    expect(report.byMarket.HOME.bets).toBe(2);
    expect(report.byMarket.OVER_2_5.bets).toBe(1);

    expect(report.byClassification.BET.bets).toBe(2);
    expect(report.byClassification.ELITE.bets).toBe(1);
  });

  it("flags small samples below the confidence threshold", () => {
    const bets = Array.from({ length: 5 }, () =>
      bet({ result: "win", profit: 1 })
    );

    const report = buildCalibrationReport(bets);

    expect(report.sampleWarning).toMatch(/Amostra pequena/);
  });

  it("does not warn once the sample clears the confidence threshold", () => {
    const bets = Array.from({ length: 30 }, () =>
      bet({ result: "win", profit: 1 })
    );

    const report = buildCalibrationReport(bets);

    expect(report.sampleWarning).toBeNull();
  });

  it("builds recentVsAllTime only once there are enough settled bets for the window", () => {
    const fewBets = Array.from({ length: 5 }, (_, i) =>
      bet({ result: "win", profit: 1, createdAt: i })
    );

    expect(
      buildCalibrationReport(fewBets, { recentWindow: 20 })
        .recentVsAllTime
    ).toBeNull();

    const enoughBets = Array.from({ length: 25 }, (_, i) =>
      bet({ result: "win", profit: 1, createdAt: i })
    );

    const report = buildCalibrationReport(enoughBets, {
      recentWindow: 20
    });

    expect(report.recentVsAllTime).not.toBeNull();
    expect(report.recentVsAllTime?.recent.bets).toBe(20);
    expect(report.recentVsAllTime?.allTime.bets).toBe(25);
  });

  it("takes the most recent bets by createdAt for the recent window, not array order", () => {
    const bets = [
      bet({ createdAt: 100, result: "loss", profit: -1, probability: 0.9 }),
      ...Array.from({ length: 25 }, (_, i) =>
        bet({
          createdAt: 200 + i,
          result: "win",
          profit: 1,
          probability: 0.5
        })
      )
    ];

    const report = buildCalibrationReport(bets, { recentWindow: 20 });

    // the oldest bet (the single loss) must be excluded from the
    // 20-bet recent window once there are 26 settled bets total
    expect(report.recentVsAllTime?.recent.losses).toBe(0);
    expect(report.recentVsAllTime?.allTime.losses).toBe(1);
  });
});
