export function expectedValue(
  probability: number,
  odd: number
): number {
  if (probability <= 0 || odd <= 0) {
    throw new Error("Probability and odd must be greater than zero");
  }

  return (probability * odd) - 1;
}

export function classifyBet(ev: number): string {
  if (ev >= 0.12) {
    return "STRONG VALUE";
  }

  if (ev >= 0.05) {
    return "VALUE";
  }

  if (ev > 0) {
    return "MARGINAL VALUE";
  }

  if (ev === 0) {
    return "BREAKEVEN";
  }

  return "NO VALUE";
}

export function classifyOperationalValue(
  probability: number,
  odd: number
): string {
  const ev = expectedValue(probability, odd);

  if (odd < 1.45 && ev < 0.18) {
    return "LOW_ODD_FAKE_VALUE";
  }

  if (odd < 1.35) {
    return "ODD_TOO_COMPRESSED";
  }

  if (probability >= 0.82 && odd < 1.50) {
    return "OVERCONFIDENCE_RISK";
  }

  if (ev >= 0.15 && odd >= 1.50) {
    return "STRONG_VALUE";
  }

  if (ev >= 0.08) {
    return "VALUE";
  }

  if (ev > 0) {
    return "MARGINAL_VALUE";
  }

  return "NO_VALUE";
}