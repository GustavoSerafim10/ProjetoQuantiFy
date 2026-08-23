import { describe, expect, it } from "vitest";

import { classifyMarket } from "./marketClassifier";

describe("classifyMarket", () => {
  it("classifies the three canonical result codes as MATCH_RESULT", () => {
    expect(classifyMarket("HOME")).toBe("MATCH_RESULT");
    expect(classifyMarket("AWAY")).toBe("MATCH_RESULT");
    expect(classifyMarket("DRAW")).toBe("MATCH_RESULT");
  });

  it("classifies double chance codes as DOUBLE_CHANCE", () => {
    expect(classifyMarket("DOUBLE_CHANCE_1X")).toBe("DOUBLE_CHANCE");
    expect(classifyMarket("DOUBLE_CHANCE_X2")).toBe("DOUBLE_CHANCE");
  });

  it("classifies over/under codes as TOTAL_GOALS", () => {
    expect(classifyMarket("OVER_1_5")).toBe("TOTAL_GOALS");
    expect(classifyMarket("OVER_2_5")).toBe("TOTAL_GOALS");
    expect(classifyMarket("UNDER_1_5")).toBe("TOTAL_GOALS");
    expect(classifyMarket("UNDER_2_5")).toBe("TOTAL_GOALS");
  });

  it("classifies DNB codes as DNB", () => {
    expect(classifyMarket("DNB_HOME")).toBe("DNB");
    expect(classifyMarket("DNB_AWAY")).toBe("DNB");
  });

  it("classifies BTTS codes as BOTH_TEAMS", () => {
    expect(classifyMarket("BTTS_YES")).toBe("BOTH_TEAMS");
    expect(classifyMarket("BTTS_NO")).toBe("BOTH_TEAMS");
  });

  it("falls back to MATCH_RESULT for an unrecognized market", () => {
    expect(classifyMarket("SOMETHING_UNKNOWN")).toBe("MATCH_RESULT");
  });

  /*
   * Legacy space-separated labels (e.g. from gameAnalyzer-style
   * callers) don't match any specific branch but must still resolve
   * to MATCH_RESULT via the default fallback rather than throwing or
   * miscategorizing.
   */
  it("still resolves legacy 'HOME WIN'/'AWAY WIN' labels to MATCH_RESULT", () => {
    expect(classifyMarket("HOME WIN")).toBe("MATCH_RESULT");
    expect(classifyMarket("AWAY WIN")).toBe("MATCH_RESULT");
  });
});
