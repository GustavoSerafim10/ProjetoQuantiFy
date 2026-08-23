import { describe, expect, it } from "vitest";

import { valuePipeline } from "./valuePipeline";

describe("valuePipeline — DNB void-aware EV", () => {
  /*
   * Regressão do bug encontrado ao implementar Empate Anula: o
   * valuePipeline recalcula o EV de forma independente
   * (`directEv`) e rejeita o mercado como
   * EXPECTED_VALUE_FUNCTION_MISMATCH se `ev` não bater exatamente
   * com essa conta. Se o desconto por anulação (voidProbability)
   * fosse aplicado só na chamada de expectedValue() e esquecido no
   * directEv, toda linha DNB seria descartada silenciosamente.
   */
  it("discounts DNB_HOME's EV by the draw probability without triggering EXPECTED_VALUE_FUNCTION_MISMATCH", () => {
    const pHome = 0.5;
    const pDraw = 0.25;
    const pAway = 0.25;

    const pConditional = pHome / (pHome + pAway); // 0.6667
    const odd = 2.2;

    const result = valuePipeline(
      {
        probabilityValid: true,
        probs: {
          DRAW: pDraw,
          DNB_HOME: pConditional
        }
      },
      {
        DNB_HOME: odd
      }
    );

    const dnbHome = result.markets.find(
      (m: { market: string }) => m.market === "DNB_HOME"
    );

    expect(dnbHome).toBeDefined();

    // EV_DNB = (1 - p_draw) * (p_cond * odd - 1)
    const expectedEv =
      (1 - pDraw) * (pConditional * odd - 1);

    expect(dnbHome!.ev).toBeCloseTo(expectedEv, 4);

    // Sanidade: o EV descontado é estritamente menor que a
    // fórmula ingênua (sem desconto) sobre o mesmo par prob/odd.
    const naiveEv = pConditional * odd - 1;
    expect(dnbHome!.ev).toBeLessThan(naiveEv);
  });

  it("still applies the plain formula (no discount) for a non-DNB market", () => {
    const probability = 0.6;
    const odd = 2.0;

    const result = valuePipeline(
      {
        probabilityValid: true,
        probs: {
          DRAW: 0.25,
          HOME: probability
        }
      },
      {
        HOME: odd
      }
    );

    const home = result.markets.find(
      (m: { market: string }) => m.market === "HOME"
    );

    expect(home).toBeDefined();
    expect(home!.ev).toBeCloseTo(probability * odd - 1, 4);
  });
});
