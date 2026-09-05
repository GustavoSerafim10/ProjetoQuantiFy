import { describe, expect, it } from "vitest";

import { evaluateMarketDominance } from "./dominance";
import type { EvaluatedDecisionMarket } from "./types";

function marketWithRedundancy({
  market,
  mostRedundantWith,
  maxPositivePhi,
  correlationPenaltyDiagnostic
}: {
  market: string;
  mostRedundantWith: string | null;
  maxPositivePhi: number | null;
  correlationPenaltyDiagnostic: number;
}): EvaluatedDecisionMarket {
  return {
    market,
    classification: "BET",
    correlationPenaltyDiagnostic,
    debug: {
      correlationEngine: {
        mostRedundantWith,
        maxPositivePhi
      }
    }
  } as unknown as EvaluatedDecisionMarket;
}

describe("evaluateMarketDominance", () => {
  it("mantém o mercado de maior ranking e domina o redundante ranqueado abaixo", () => {
    // HOME é o primeiro (maior ranking); DOUBLE_CHANCE_1X aponta
    // HOME como seu par mais redundante.
    const home = marketWithRedundancy({
      market: "HOME",
      mostRedundantWith: null,
      maxPositivePhi: null,
      correlationPenaltyDiagnostic: 0
    });

    const doubleChance1X = marketWithRedundancy({
      market: "DOUBLE_CHANCE_1X",
      mostRedundantWith: "HOME",
      maxPositivePhi: 0.9,
      correlationPenaltyDiagnostic: 0.135
    });

    const result = evaluateMarketDominance([home, doubleChance1X]);

    expect(result.kept.map(m => m.market)).toEqual(["HOME"]);
    expect(result.dominated.map(m => m.market)).toEqual([
      "DOUBLE_CHANCE_1X"
    ]);
    expect(
      (result.dominated[0] as unknown as { dominatedBy: string })
        .dominatedBy
    ).toBe("HOME");
  });

  it("não domina mercados sem redundância detectada entre si", () => {
    const home = marketWithRedundancy({
      market: "HOME",
      mostRedundantWith: null,
      maxPositivePhi: null,
      correlationPenaltyDiagnostic: 0
    });

    const over25 = marketWithRedundancy({
      market: "OVER_2_5",
      mostRedundantWith: null,
      maxPositivePhi: null,
      correlationPenaltyDiagnostic: 0
    });

    const result = evaluateMarketDominance([home, over25]);

    expect(result.kept.map(m => m.market)).toEqual([
      "HOME",
      "OVER_2_5"
    ]);
    expect(result.dominated).toHaveLength(0);
  });

  it("não domina quando o phi fica abaixo do piso de significância", () => {
    const home = marketWithRedundancy({
      market: "HOME",
      mostRedundantWith: null,
      maxPositivePhi: null,
      correlationPenaltyDiagnostic: 0
    });

    const doubleChance1X = marketWithRedundancy({
      market: "DOUBLE_CHANCE_1X",
      mostRedundantWith: "HOME",
      maxPositivePhi: 0.10, // abaixo do piso de 0.30
      correlationPenaltyDiagnostic: 0.015
    });

    const result = evaluateMarketDominance([home, doubleChance1X]);

    expect(result.kept.map(m => m.market)).toEqual([
      "HOME",
      "DOUBLE_CHANCE_1X"
    ]);
    expect(result.dominated).toHaveLength(0);
  });

  it("`best` (índice 0) nunca é dominado, mesmo se apontar redundância", () => {
    const best = marketWithRedundancy({
      market: "DNB_HOME",
      // Mesmo se por algum motivo o próprio "melhor" mercado
      // carregasse um mostRedundantWith, não existe nenhum
      // mercado "kept" anterior a ele para dominá-lo.
      mostRedundantWith: "HOME",
      maxPositivePhi: 0.95,
      correlationPenaltyDiagnostic: 0.14
    });

    const home = marketWithRedundancy({
      market: "HOME",
      mostRedundantWith: null,
      maxPositivePhi: null,
      correlationPenaltyDiagnostic: 0
    });

    const result = evaluateMarketDominance([best, home]);

    expect(result.kept.map(m => m.market)).toEqual([
      "DNB_HOME",
      "HOME"
    ]);
  });

  it("três mercados redundantes entre si: só o melhor ranqueado sobrevive", () => {
    const under25 = marketWithRedundancy({
      market: "UNDER_2_5",
      mostRedundantWith: null,
      maxPositivePhi: null,
      correlationPenaltyDiagnostic: 0
    });

    const bttsNo = marketWithRedundancy({
      market: "BTTS_NO",
      mostRedundantWith: "UNDER_2_5",
      maxPositivePhi: 0.55,
      correlationPenaltyDiagnostic: 0.0825
    });

    const dnbHome = marketWithRedundancy({
      market: "DNB_HOME",
      mostRedundantWith: "UNDER_2_5",
      maxPositivePhi: 0.40,
      correlationPenaltyDiagnostic: 0.06
    });

    const result = evaluateMarketDominance([
      under25,
      bttsNo,
      dnbHome
    ]);

    expect(result.kept.map(m => m.market)).toEqual(["UNDER_2_5"]);
    expect(result.dominated.map(m => m.market).sort()).toEqual(
      ["BTTS_NO", "DNB_HOME"].sort()
    );
  });
});
