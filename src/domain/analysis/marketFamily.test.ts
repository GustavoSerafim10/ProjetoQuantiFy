import { describe, expect, it } from "vitest";

import {
  getMarketFamily,
  getMarketDirection,
  calculateFamilyConsensus
} from "./marketFamily";

describe("getMarketFamily / getMarketDirection", () => {
  it("classifica famílias corretamente", () => {
    expect(getMarketFamily("HOME")).toBe("RESULT");
    expect(getMarketFamily("OVER_2_5")).toBe("GOALS");
    expect(getMarketFamily("BTTS_NO")).toBe("BTTS");
    expect(getMarketFamily("DOUBLE_CHANCE_1X")).toBe("DOUBLE_CHANCE");
    expect(getMarketFamily("DNB_HOME")).toBe("DNB");
  });

  it("RESULT/DOUBLE_CHANCE/DNB não têm direção de gols", () => {
    expect(getMarketDirection("HOME")).toBeNull();
    expect(getMarketDirection("DOUBLE_CHANCE_1X")).toBeNull();
    expect(getMarketDirection("DNB_HOME")).toBeNull();
  });

  it("GOALS/BTTS têm direção", () => {
    expect(getMarketDirection("UNDER_2_5")).toBe("LOW_SCORING");
    expect(getMarketDirection("BTTS_NO")).toBe("LOW_SCORING");
    expect(getMarketDirection("OVER_2_5")).toBe("HIGH_SCORING");
    expect(getMarketDirection("BTTS_YES")).toBe("HIGH_SCORING");
  });
});

describe("calculateFamilyConsensus", () => {
  it("BTTS_NO forte + UNDER_2_5 forte se confirmam (famílias diferentes, mesma direção)", () => {
    const result = calculateFamilyConsensus({
      market: "BTTS_NO",
      otherCandidates: [
        { market: "UNDER_2_5", ev: 0.08 },
        { market: "HOME", ev: 0.05 }
      ]
    });

    expect(result?.direction).toBe("LOW_SCORING");
    expect(result?.confirmingMarkets).toEqual(["UNDER_2_5"]);
  });

  it("não conta a mesma família como confirmação (OVER_1_5 não confirma OVER_2_5)", () => {
    const result = calculateFamilyConsensus({
      market: "OVER_2_5",
      otherCandidates: [
        { market: "OVER_1_5", ev: 0.10 }
      ]
    });

    expect(result).toBeNull();
  });

  it("não conta candidato com EV não positivo", () => {
    const result = calculateFamilyConsensus({
      market: "BTTS_NO",
      otherCandidates: [
        { market: "UNDER_2_5", ev: -0.02 }
      ]
    });

    expect(result).toBeNull();
  });

  it("não conta direção oposta (UNDER_2_5 não confirma BTTS_YES)", () => {
    const result = calculateFamilyConsensus({
      market: "BTTS_YES",
      otherCandidates: [
        { market: "UNDER_2_5", ev: 0.08 }
      ]
    });

    expect(result).toBeNull();
  });

  it("mercados sem direção (RESULT/DOUBLE_CHANCE/DNB) nunca produzem consenso", () => {
    const result = calculateFamilyConsensus({
      market: "HOME",
      otherCandidates: [
        { market: "DOUBLE_CHANCE_1X", ev: 0.05 }
      ]
    });

    expect(result).toBeNull();
  });
});
