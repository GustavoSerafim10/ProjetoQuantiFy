import { describe, expect, it } from "vitest";

import { deriveDecisionState } from "./decisionState";

describe("deriveDecisionState", () => {
  it("classificação acionável sem sinais de alarme mantém o mesmo estado", () => {
    expect(
      deriveDecisionState({
        classification: "ELITE",
        guardBlockers: [],
        extremeValueClassification: "NORMAL_VALUE",
        modelAgreementScore: 0.9
      })
    ).toBe("ELITE");

    expect(
      deriveDecisionState({
        classification: "BET",
        guardBlockers: [],
        extremeValueClassification: "STRONG_VALUE",
        modelAgreementScore: 0.7
      })
    ).toBe("BET");
  });

  it("NO BET por guard estrutural/qualidade vira REJECT", () => {
    expect(
      deriveDecisionState({
        classification: "NO BET",
        guardBlockers: ["RISK_ABOVE_GLOBAL_MAXIMUM"],
        extremeValueClassification: "NORMAL_VALUE",
        modelAgreementScore: 0.8
      })
    ).toBe("REJECT");

    expect(
      deriveDecisionState({
        classification: "NO BET",
        guardBlockers: ["INVALID_MARKET_STRUCTURE"],
        extremeValueClassification: null,
        modelAgreementScore: null
      })
    ).toBe("REJECT");
  });

  it("NO BET por falta de edge/EV comum permanece NO_BET (não é REJECT)", () => {
    expect(
      deriveDecisionState({
        classification: "NO BET",
        guardBlockers: ["NON_POSITIVE_EV"],
        extremeValueClassification: "NORMAL_VALUE",
        modelAgreementScore: 0.8
      })
    ).toBe("NO_BET");
  });

  it("EV suspeito vira INVESTIGATE mesmo numa aposta já aprovada", () => {
    expect(
      deriveDecisionState({
        classification: "BET",
        guardBlockers: [],
        extremeValueClassification: "SUSPICIOUS_VALUE",
        modelAgreementScore: 0.9
      })
    ).toBe("INVESTIGATE");
  });

  it("discordância severa de modelo vira INVESTIGATE mesmo numa aposta já aprovada", () => {
    expect(
      deriveDecisionState({
        classification: "ELITE",
        guardBlockers: [],
        extremeValueClassification: "NORMAL_VALUE",
        modelAgreementScore: 0.05
      })
    ).toBe("INVESTIGATE");
  });

  it("EV suspeito em NO BET vira INVESTIGATE, não REJECT (sem guard estrutural)", () => {
    expect(
      deriveDecisionState({
        classification: "NO BET",
        guardBlockers: ["NON_POSITIVE_EV"],
        extremeValueClassification: "SUSPICIOUS_VALUE",
        modelAgreementScore: 0.8
      })
    ).toBe("INVESTIGATE");
  });

  it("guard de REJECT tem prioridade sobre INVESTIGATE quando os dois coexistem em NO BET", () => {
    expect(
      deriveDecisionState({
        classification: "NO BET",
        guardBlockers: ["RISK_ABOVE_GLOBAL_MAXIMUM"],
        extremeValueClassification: "SUSPICIOUS_VALUE",
        modelAgreementScore: 0.8
      })
    ).toBe("REJECT");
  });

  it("WATCHLIST sem alarme permanece WATCHLIST", () => {
    expect(
      deriveDecisionState({
        classification: "WATCHLIST",
        guardBlockers: [],
        extremeValueClassification: "NORMAL_VALUE",
        modelAgreementScore: 0.6
      })
    ).toBe("WATCHLIST");
  });
});
