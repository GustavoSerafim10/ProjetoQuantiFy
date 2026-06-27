export interface MarketItem {
  market: string;
  odd: number;
  source?: string;

  category?: "RESULT" | "DOUBLE_CHANCE" | "GOALS" | "BTTS";
  enabled?: boolean;
  createdAt?: number;

  probability?: number;
  ev?: number;
  risk?: number;
  confidence?: number;
  edge?: number;

  decision?: string;
  reason?: string;

  pipelineHistory?: string[];
  debug?: Record<string, any>;
}