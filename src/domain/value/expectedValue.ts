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

  if (ev > 0.05) {
    return "STRONG VALUE";
  }

  if (ev > 0) {
    return "VALUE";
  }

  if (ev === 0) {
    return "BREAKEVEN";
  }

  return "NO VALUE";
}