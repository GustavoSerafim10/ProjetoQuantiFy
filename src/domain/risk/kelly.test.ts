import { describe, expect, it } from "vitest";

import { kellyCriterion } from "./kelly";

describe("kellyCriterion", () => {
  it("computes the standard Kelly fraction: f = (bp - q) / b", () => {
    // p = 0.60, odd = 2.00 -> b = 1, q = 0.40
    // f = (1*0.6 - 0.4) / 1 = 0.20
    expect(kellyCriterion(0.6, 2.0)).toBeCloseTo(0.2, 4);
  });

  it("returns 0 when the edge is negative instead of a negative stake", () => {
    // p = 0.40, odd = 2.00 -> b = 1, q = 0.60
    // f = (0.4 - 0.6) / 1 = -0.20 -> clamped to 0
    expect(kellyCriterion(0.4, 2.0)).toBe(0);
  });

  it("returns 0 for probability <= 0", () => {
    expect(kellyCriterion(0, 2.0)).toBe(0);
    expect(kellyCriterion(-0.1, 2.0)).toBe(0);
  });

  it("returns 0 for probability >= 1", () => {
    expect(kellyCriterion(1, 2.0)).toBe(0);
    expect(kellyCriterion(1.5, 2.0)).toBe(0);
  });

  it("returns 0 for odd <= 1 (no payout above stake)", () => {
    expect(kellyCriterion(0.6, 1.0)).toBe(0);
    expect(kellyCriterion(0.6, 0.9)).toBe(0);
  });

  it("returns 0 for non-finite inputs instead of NaN", () => {
    expect(kellyCriterion(NaN, 2.0)).toBe(0);
    expect(kellyCriterion(0.6, NaN)).toBe(0);
    expect(kellyCriterion(0.6, Infinity)).toBe(0);
  });

  /*
   * DNB (Empate Anula): a fração ótima de log-crescimento para uma
   * aposta com 3 resultados (ganha/perde/anula) é
   *   f* = (p_win*b - p_lose) / (b*(p_win + p_lose))
   * porque o resultado ANULA contribui ln(1)=0 e não participa da
   * otimização. Substituindo p_win = p_cond*(1-p_void) e
   * p_lose = (1-p_cond)*(1-p_void), o fator (1-p_void) cancela e
   * f* vira exatamente kellyCriterion(p_cond, odd) — ou seja, o
   * Kelly padrão já é a fórmula correta para DNB sem nenhum ajuste,
   * mesmo que o mercado tenha um terceiro resultado.
   */
  it("matches the direct 3-outcome (win/lose/void) Kelly formula for a DNB-style bet", () => {
    const pHome = 0.5;
    const pDraw = 0.25;
    const pAway = 0.25;
    const odd = 2.2;
    const b = odd - 1;

    expect(pHome + pDraw + pAway).toBeCloseTo(1, 6);

    const pConditional = pHome / (pHome + pAway);

    const directThreeOutcomeKelly =
      (pHome * b - pAway) / (b * (pHome + pAway));

    // kellyCriterion arredonda para 4 casas decimais internamente.
    expect(kellyCriterion(pConditional, odd)).toBeCloseTo(
      directThreeOutcomeKelly,
      3
    );
  });
});
