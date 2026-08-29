import { describe, expect, it } from "vitest";

import { normalizeStats } from "./dataNormalizer";

describe("normalizeStats — finalizacoes totais ausentes", () => {
  it("nao inclui avgShots/shotsPerGame quando o dado nunca foi informado (regressao: 0 forcado escondia a ausencia)", () => {
    const result = normalizeStats({
      matches: 23,
      goalsFor: 27,
      goalsAgainst: 27
    });

    expect(result.avgShots).toBeUndefined();
    expect(result.shotsPerGame).toBeUndefined();
  });

  it("inclui avgShots/shotsPerGame quando informado, mesmo que zero", () => {
    const result = normalizeStats({
      matches: 23,
      goalsFor: 27,
      goalsAgainst: 27,
      avgShots: 0
    });

    expect(result.avgShots).toBe(0);
    expect(result.shotsPerGame).toBe(0);
  });
});
