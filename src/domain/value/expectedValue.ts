export function expectedValue(
  probability: number,
  odd: number
): number {
  const p = Number(probability);
  const o = Number(odd);

  if (!Number.isFinite(p) || !Number.isFinite(o)) {
    return -1;
  }

  if (p <= 0 || p >= 1 || o <= 1) {
    return -1;
  }

  return (p * o) - 1;
}

export function classifyBet(ev: number): string {
  if (ev >= 0.12) return "STRONG_VALUE";
  if (ev >= 0.05) return "VALUE";
  if (ev > 0) return "MARGINAL_VALUE";
  if (ev === 0) return "BREAKEVEN";

  return "NO_VALUE";
}

export function classifyOperationalValue(
  probability: number,
  odd: number
): string {
  const ev = expectedValue(probability, odd);

  if (ev <= 0) {
    return "NO_VALUE";
  }

  if (odd < 1.30) {
    return "ODD_TOO_COMPRESSED";
  }

  if (odd < 1.40 && ev < 0.16) {
    return "LOW_ODD_FAKE_VALUE";
  }

  if (probability >= 0.84 && odd < 1.42) {
    return "OVERCONFIDENCE_RISK";
  }

  if (ev >= 0.15 && odd >= 1.45) {
    return "STRONG_VALUE";
  }

  if (ev >= 0.08) {
    return "VALUE";
  }

  if (ev >= 0.035) {
    return "WATCHLIST_VALUE";
  }

  return "MARGINAL_VALUE";
}