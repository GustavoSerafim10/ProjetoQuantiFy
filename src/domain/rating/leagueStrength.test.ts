import { describe, expect, it } from "vitest";

import { resolveLeagueStrength } from "./leagueStrength";

/*
 * Achado real em 2026-09-08: o usuário digitou "Série B -
 * Brasileirão" (ordem invertida do que os aliases existentes
 * esperavam) e caiu no fallback de liga padrão sem aviso nenhum,
 * enfraquecendo a base de gols usada pelo modelPipeline legado.
 */
describe("resolveLeagueStrength — Brasileirão Série B", () => {
  it("recognizes 'Série B - Brasileirão' (ordem como o usuário realmente digitou)", () => {
    const resolved = resolveLeagueStrength("Série B - Brasileirão");

    expect(resolved.found).toBe(true);
    expect(resolved.usedDefault).toBe(false);
    expect(resolved.key).toBe("brasileiraoserieb");
  });

  it("still recognizes the existing aliases (regressão)", () => {
    expect(resolveLeagueStrength("Brasileirão Série B").key).toBe(
      "brasileiraoserieb"
    );
    expect(resolveLeagueStrength("Série B").key).toBe(
      "brasileiraoserieb"
    );
    expect(resolveLeagueStrength("Brasileirão B").key).toBe(
      "brasileiraoserieb"
    );
  });

  it("falls back to default for a genuinely unknown league, with a warning", () => {
    const resolved = resolveLeagueStrength("Liga Totalmente Inventada");

    expect(resolved.found).toBe(false);
    expect(resolved.usedDefault).toBe(true);
  });
});
