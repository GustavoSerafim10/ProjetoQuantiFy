export interface TrackedBet {
  id: string;

  market: string;
  category: string;

  probability: number;
  bookmakerOdd: number;

  stake: number;

  result: "WIN" | "LOSS";

  profit: number;

  timestamp: number;
}