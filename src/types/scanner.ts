export interface OptionContract {
  instrument_token: number;
  trading_symbol: string;
  strike: number;
  option_type: "CE" | "PE";
  ltp: number;
  volume: number;
  oi: number;
  oi_change: number;
  iv: number;
  volume_score: number;
  oi_score: number;
  oi_change_score: number;
  iv_score: number;
  volume_spike_score: number;
  confidence: number;
  volume_burst: boolean;
  signal: string | null;
  // Hero Zero fields
  delta?: number;
  gamma?: number;
  theta?: number;
  bid_ask_spread?: number;
  gamma_exposure?: number;
  ema20?: number;
  rsi?: number;
  macd_signal?: string;
  max_pain?: number;
  hero_score?: number;
  strike_distance?: number;
  entry_price?: number;
  stop_loss?: number;
  target1?: number;
  target2?: number;
  target3?: number;
}

export interface Signal {
  id: string;
  trading_symbol: string;
  strike: number;
  option_type: string;
  type: "BUY" | "SELL";
  entry_price: number;
  stop_loss: number;
  price: number; // Added price
  target1: number;
  target2: number;
  target3: number;
  confidence: number;
  reason: string;
  timestamp: string;
  pattern_id?: string;
  created_at: string;
}

export interface SupportResistanceLevel {
  timeframe: string;
  level_type: "support" | "resistance";
  price: number;
  strength: number;
}

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleSet {
  timeframe: string;
  candles: CandleData[];
}

export interface ChartPattern {
  type:
  | "head_and_shoulders" | "inverse_head_and_shoulders" | "double_top" | "double_bottom"
  | "triple_top" | "triple_bottom" | "rounding_top" | "rounding_bottom"
  | "diamond_top" | "diamond_bottom"
  | "bull_flag" | "bear_flag" | "bull_pennant" | "bear_pennant"
  | "ascending_triangle" | "descending_triangle" | "symmetrical_triangle"
  | "rectangle" | "cup_and_handle" | "inverted_cup_and_handle"
  | "rising_wedge" | "falling_wedge" | "expanding_wedge"
  | "ascending_channel" | "descending_channel" | "horizontal_channel"
  | "broadening_formation" | "megaphone" | "vcp"
  | "gartley" | "butterfly" | "bat" | "crab" | "shark" | "cypher"
  | "hh_hl" | "lh_ll" | "bos" | "choch" | "liquidity_sweep" | "breakout_retest";
  confidence: number;
  points: { index: number; price: number }[];
  label: string;
  color?: string;
  description: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
}

export interface CandlestickPattern {
  index: number;
  timestamp: string;
  type:
  | "doji" | "hammer" | "shooting_star" | "bullish_engulfing" | "bearish_engulfing"
  | "morning_star" | "evening_star" | "harami" | "piercing_line"
  | "dark_cloud_cover" | "three_white_soldiers" | "three_black_rows";
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
}

export interface PredictionResult {
  next_move: "UP" | "DOWN" | "SIDEWAYS";
  confidence: number;
  reason: string;
  layers: {
    structure: string;
    patterns: string;
    candles: string;
    indicators: string;
  };
}

export interface OIAnalysis {
  strike: number;
  option_type: "CE" | "PE";
  oi: number;
  oi_change: number;
  ltp_change: number;
  interpretation: "long_buildup" | "short_buildup" | "short_covering" | "long_unwinding";
  description: string;
}

export interface StrikeSR {
  strike: number;
  ce_oi: number;
  pe_oi: number;
  ce_oi_change: number;
  pe_oi_change: number;
  type: "support" | "resistance" | "pivot";
  strength: number;
}

export interface ScannerResponse {
  contracts: OptionContract[];
  nifty_price: number;
  sensex_price?: number;
  pcr: number;
  signals: Signal[];
  new_signals?: Signal[];
  error?: string;
  total_contracts?: number;
  atm_strike?: number;
  expiry_dates?: string[];
  max_pain?: number;
  index_name?: string;
  selected_expiry?: string;
  is_monthly?: boolean;
  support_resistance?: SupportResistanceLevel[];
  candle_data?: CandleSet[];
  chart_patterns?: ChartPattern[];
  oi_analysis?: OIAnalysis[];
  strike_sr?: StrikeSR[];
}

export type IndexType = "NIFTY" | "SENSEX";
export type ScanMode = "scanner" | "herozero" | "institutional" | "scalping" | "conservative";
export type EngineMode = "institutional" | "scalping" | "conservative";

export interface EngineState {
  mode: EngineMode;
  market_bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  volatility_regime: "EXPANDING" | "CONTRACTING" | "FLAT";
  atr_rising: boolean;
  opening_range: { high: number; low: number } | null;
  volume_above_avg: boolean;
  ema_structure: { ema9: number; ema20: number; ema50: number };
  rsi: number;
  daily_trades: number;
  max_trades: number;
  consecutive_losses: number;
  max_consecutive_losses: number;
  cooldown_active: boolean;
  cooldown_candles_left: number;
  time_window_ok: boolean;
  lunch_session: boolean;
  setup_detected: boolean;
  setup_type: "PULLBACK" | "BREAKOUT" | null;
  trigger_confirmed: boolean;
  can_trade: boolean;
  no_trade_reason: string | null;
  spot_price: number;
}

export interface EngineSignal {
  id: string;
  trading_symbol: string;
  strike: number;
  option_type: "CE" | "PE";
  entry_price: number;
  stop_loss: number;
  target1: number;
  target2: number;
  confidence: number;
  direction: "LONG" | "SHORT";
  mode: EngineMode;
  reason: string;
  created_at: string;
  risk_reward: number;
}

export interface EngineResponse {
  engine_state: EngineState;
  signals: EngineSignal[];
  contracts: OptionContract[];
  nifty_price: number;
  sensex_price?: number;
  pcr: number;
  atm_strike?: number;
  expiry_dates?: string[];
  max_pain?: number;
  index_name?: string;
  selected_expiry?: string;
  flow_steps: FlowStep[];
}

export interface FlowStep {
  name: string;
  passed: boolean;
  detail: string;
}
