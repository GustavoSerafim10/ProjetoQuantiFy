import { describe, expect, it } from "vitest";

import { runMonteCarloBacktest } from "./monteCarloBacktest";
import { runBacktest } from "./runBacktest";

/*
 * Regression: before 2026-09-03, runBacktest() had no way to vary
 * its synthetic match batch between calls (resetMatchGeneratorSeed()
 * always reset to the same hardcoded seed). That made
 * runMonteCarloBacktest()'s "N independent simulations" loop call
 * runBacktest() with the exact same seed every time — every
 * simulation was byte-identical, roiStdDev was always 0, and the
 * quality/stability report was meaningless (always looked perfectly
 * stable no matter what). Fixed by adding an optional `seed` to
 * RunBacktestOptions, defaulted so every OTHER caller (tests,
 * calibration sweeps) keeps the exact same deterministic behavior.
 */
describe("runBacktest seed option", () => {
  it("without a seed, two calls stay byte-identical (existing determinism contract)", () => {
    const a = runBacktest(300, 1000, { monteCarloSimulations: 150 });
    const b = runBacktest(300, 1000, { monteCarloSimulations: 150 });

    expect(a.roi).toBe(b.roi);
    expect(a.totalBets).toBe(b.totalBets);
  }, 20000);

  it("with different seeds, two calls diverge", () => {
    const a = runBacktest(300, 1000, {
      monteCarloSimulations: 150,
      seed: "test-seed-a"
    });

    const b = runBacktest(300, 1000, {
      monteCarloSimulations: 150,
      seed: "test-seed-b"
    });

    expect(a.roi).not.toBe(b.roi);
  }, 20000);

  it("the same seed reproduces the same result", () => {
    const a = runBacktest(300, 1000, {
      monteCarloSimulations: 150,
      seed: "reproducible-seed"
    });

    const b = runBacktest(300, 1000, {
      monteCarloSimulations: 150,
      seed: "reproducible-seed"
    });

    expect(a.roi).toBe(b.roi);
    expect(a.totalBets).toBe(b.totalBets);
  }, 20000);
});

describe("runMonteCarloBacktest", () => {
  it("produces genuinely varying simulations, not N copies of the same run", () => {
    const summary = runMonteCarloBacktest(6, 300, {
      minimumReliableSimulations: 1,
      minimumReliableTotalBets: 1
    });

    const rois = summary.simulations.map(s => s.roi);
    const uniqueRois = new Set(rois);

    // Regression guard: before the fix this was always 1 (all 6
    // identical). A handful of genuinely independent synthetic
    // batches should essentially never collide.
    expect(uniqueRois.size).toBeGreaterThan(1);
    expect(summary.roiStdDev).toBeGreaterThan(0);
  }, 40000);

  it("still gives byte-identical results across two full runs with the same seedPrefix", () => {
    const first = runMonteCarloBacktest(3, 300, {
      seedPrefix: "fixed-prefix"
    });

    const second = runMonteCarloBacktest(3, 300, {
      seedPrefix: "fixed-prefix"
    });

    expect(first.simulations.map(s => s.roi)).toEqual(
      second.simulations.map(s => s.roi)
    );
  }, 40000);
});
