import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OptionContract {
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
}

interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FlowStep {
  name: string;
  passed: boolean;
  detail: string;
}

type EngineMode = "institutional" | "scalping" | "conservative";

// =================== UTILITY FUNCTIONS ===================

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  const recent = changes.slice(-period);
  let gains = 0, losses = 0;
  for (const c of recent) {
    if (c > 0) gains += c;
    else losses += Math.abs(c);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateMACD(prices: number[]): { signal: string; histogram: number } {
  if (prices.length < 26) return { signal: "NEUTRAL", histogram: 0 };
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calculateEMA(macdLine.slice(-9), 9);
  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const histogram = lastMACD - lastSignal;
  return {
    signal: histogram > 0 ? "BULLISH" : histogram < 0 ? "BEARISH" : "NEUTRAL",
    histogram,
  };
}

function calculateATR(candles: Candle[], period = 14): number[] {
  if (candles.length < 2) return [0];
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  // Simple moving average ATR
  const atrValues: number[] = [];
  for (let i = 0; i < trs.length; i++) {
    if (i < period - 1) {
      atrValues.push(trs.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1));
    } else {
      atrValues.push(trs.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
    }
  }
  return atrValues;
}

function getISTDate(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
}

// =================== CANDLESTICK PATTERN DETECTION ===================

interface CandlestickPattern {
  index: number;
  timestamp: string;
  type: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
}

function detectCandlestickPatterns(candles: Candle[]): CandlestickPattern[] {
  const patterns: CandlestickPattern[] = [];
  if (candles.length < 3) return patterns;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const bullish = c.close > c.open;
    const prevBody = Math.abs(prev.close - prev.open);

    // Doji: body < 10% of range
    if (range > 0 && body / range < 0.1) {
      patterns.push({ index: i, timestamp: c.timestamp, type: "doji", bias: "NEUTRAL", description: "Indecision — body < 10% of range" });
    }

    // Hammer: small body at top, long lower wick (>2x body), downtrend context
    if (range > 0 && lowerWick > body * 2 && upperWick < body * 0.5 && prev.close < prev.open) {
      patterns.push({ index: i, timestamp: c.timestamp, type: "hammer", bias: "BULLISH", description: "Hammer — potential reversal from downtrend" });
    }

    // Shooting Star: small body at bottom, long upper wick, uptrend context
    if (range > 0 && upperWick > body * 2 && lowerWick < body * 0.5 && prev.close > prev.open) {
      patterns.push({ index: i, timestamp: c.timestamp, type: "shooting_star", bias: "BEARISH", description: "Shooting Star — potential reversal from uptrend" });
    }

    // Bullish Engulfing
    if (prev.close < prev.open && bullish && c.open <= prev.close && c.close >= prev.open && body > prevBody) {
      patterns.push({ index: i, timestamp: c.timestamp, type: "bullish_engulfing", bias: "BULLISH", description: "Bullish Engulfing — buyers overwhelm sellers" });
    }

    // Bearish Engulfing
    if (prev.close > prev.open && !bullish && c.open >= prev.close && c.close <= prev.open && body > prevBody) {
      patterns.push({ index: i, timestamp: c.timestamp, type: "bearish_engulfing", bias: "BEARISH", description: "Bearish Engulfing — sellers overwhelm buyers" });
    }

    // Inverted Hammer
    if (range > 0 && upperWick > body * 2 && lowerWick < body * 0.3 && prev.close < prev.open) {
      patterns.push({ index: i, timestamp: c.timestamp, type: "inverted_hammer", bias: "BULLISH", description: "Inverted Hammer — potential bullish reversal" });
    }

    // Morning Star (3-candle)
    if (i >= 2) {
      const pp = candles[i - 2];
      const midBody = Math.abs(prev.close - prev.open);
      const ppRange = pp.high - pp.low;
      if (pp.close < pp.open && ppRange > 0 && midBody / ppRange < 0.3 && bullish && c.close > (pp.open + pp.close) / 2) {
        patterns.push({ index: i, timestamp: c.timestamp, type: "morning_star", bias: "BULLISH", description: "Morning Star — 3-candle bullish reversal" });
      }
    }

    // Evening Star (3-candle)
    if (i >= 2) {
      const pp = candles[i - 2];
      const midBody = Math.abs(prev.close - prev.open);
      const ppRange = pp.high - pp.low;
      if (pp.close > pp.open && ppRange > 0 && midBody / ppRange < 0.3 && !bullish && c.close < (pp.open + pp.close) / 2) {
        patterns.push({ index: i, timestamp: c.timestamp, type: "evening_star", bias: "BEARISH", description: "Evening Star — 3-candle bearish reversal" });
      }
    }
  }

  // Return last 10 patterns (most recent)
  return patterns.slice(-10);
}

// =================== CHART PATTERN DETECTION ===================

interface ChartPattern {
  type: string;
  confidence: number;
  start_index: number;
  end_index: number;
  description: string;
  bias: "BULLISH" | "BEARISH";
}

function detectChartPatterns(candles: Candle[]): ChartPattern[] {
  const patterns: ChartPattern[] = [];
  if (candles.length < 20) return patterns;

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  // Find swing highs and lows
  const swingHighs: { idx: number; price: number }[] = [];
  const swingLows: { idx: number; price: number }[] = [];
  const lb = 3;

  for (let i = lb; i < candles.length - lb; i++) {
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lb; j++) {
      if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) isHigh = false;
      if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) isLow = false;
    }
    if (isHigh) swingHighs.push({ idx: i, price: highs[i] });
    if (isLow) swingLows.push({ idx: i, price: lows[i] });
  }

  // Double Top: two swing highs at similar level
  for (let i = 0; i < swingHighs.length - 1; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const h1 = swingHighs[i], h2 = swingHighs[j];
      if (Math.abs(h2.idx - h1.idx) < 5) continue; // minimum distance
      const avgPrice = (h1.price + h2.price) / 2;
      const diff = Math.abs(h1.price - h2.price) / avgPrice;
      if (diff < 0.003) { // within 0.3%
        // Check for valley between
        const valleyBetween = lows.slice(h1.idx, h2.idx + 1);
        const minValley = Math.min(...valleyBetween);
        if (minValley < avgPrice * 0.99) {
          const conf = Math.round(Math.max(50, 90 - diff * 10000));
          patterns.push({
            type: "double_top", confidence: conf,
            start_index: h1.idx, end_index: h2.idx,
            description: `Double Top at ${avgPrice.toFixed(0)} — bearish reversal signal`,
            bias: "BEARISH",
          });
        }
      }
    }
  }

  // Double Bottom: two swing lows at similar level
  for (let i = 0; i < swingLows.length - 1; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      const l1 = swingLows[i], l2 = swingLows[j];
      if (Math.abs(l2.idx - l1.idx) < 5) continue;
      const avgPrice = (l1.price + l2.price) / 2;
      const diff = Math.abs(l1.price - l2.price) / avgPrice;
      if (diff < 0.003) {
        const peakBetween = highs.slice(l1.idx, l2.idx + 1);
        const maxPeak = Math.max(...peakBetween);
        if (maxPeak > avgPrice * 1.01) {
          const conf = Math.round(Math.max(50, 90 - diff * 10000));
          patterns.push({
            type: "double_bottom", confidence: conf,
            start_index: l1.idx, end_index: l2.idx,
            description: `Double Bottom at ${avgPrice.toFixed(0)} — bullish reversal signal`,
            bias: "BULLISH",
          });
        }
      }
    }
  }

  // Head and Shoulders
  if (swingHighs.length >= 3) {
    for (let i = 0; i < swingHighs.length - 2; i++) {
      const left = swingHighs[i], head = swingHighs[i + 1], right = swingHighs[i + 2];
      if (head.price > left.price && head.price > right.price) {
        const shoulderDiff = Math.abs(left.price - right.price) / head.price;
        if (shoulderDiff < 0.005) { // shoulders within 0.5%
          patterns.push({
            type: "head_and_shoulders", confidence: Math.round(75 - shoulderDiff * 5000),
            start_index: left.idx, end_index: right.idx,
            description: `H&S at ${head.price.toFixed(0)} — bearish reversal`,
            bias: "BEARISH",
          });
        }
      }
    }
  }

  // Inverse Head and Shoulders
  if (swingLows.length >= 3) {
    for (let i = 0; i < swingLows.length - 2; i++) {
      const left = swingLows[i], head = swingLows[i + 1], right = swingLows[i + 2];
      if (head.price < left.price && head.price < right.price) {
        const shoulderDiff = Math.abs(left.price - right.price) / head.price;
        if (shoulderDiff < 0.005) {
          patterns.push({
            type: "inverse_head_and_shoulders", confidence: Math.round(75 - shoulderDiff * 5000),
            start_index: left.idx, end_index: right.idx,
            description: `Inv. H&S at ${head.price.toFixed(0)} — bullish reversal`,
            bias: "BULLISH",
          });
        }
      }
    }
  }

  // Ascending Triangle: flat resistance + rising lows
  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const recentHighs = swingHighs.slice(-3);
    const recentLows = swingLows.slice(-3);
    const highPrices = recentHighs.map(h => h.price);
    const highRange = (Math.max(...highPrices) - Math.min(...highPrices)) / Math.max(...highPrices);
    if (highRange < 0.003 && recentLows.length >= 2) {
      const risingLows = recentLows.every((l, idx) => idx === 0 || l.price > recentLows[idx - 1].price);
      if (risingLows) {
        patterns.push({
          type: "ascending_triangle", confidence: 65,
          start_index: Math.min(recentHighs[0].idx, recentLows[0].idx),
          end_index: Math.max(recentHighs[recentHighs.length - 1].idx, recentLows[recentLows.length - 1].idx),
          description: "Ascending Triangle — flat resistance with rising lows",
          bias: "BULLISH",
        });
      }
    }
  }

  // Descending Triangle: flat support + falling highs
  if (swingLows.length >= 2 && swingHighs.length >= 2) {
    const recentLows = swingLows.slice(-3);
    const recentHighs = swingHighs.slice(-3);
    const lowPrices = recentLows.map(l => l.price);
    const lowRange = (Math.max(...lowPrices) - Math.min(...lowPrices)) / Math.max(...lowPrices);
    if (lowRange < 0.003 && recentHighs.length >= 2) {
      const fallingHighs = recentHighs.every((h, idx) => idx === 0 || h.price < recentHighs[idx - 1].price);
      if (fallingHighs) {
        patterns.push({
          type: "descending_triangle", confidence: 65,
          start_index: Math.min(recentHighs[0].idx, recentLows[0].idx),
          end_index: Math.max(recentHighs[recentHighs.length - 1].idx, recentLows[recentLows.length - 1].idx),
          description: "Descending Triangle — flat support with falling highs",
          bias: "BEARISH",
        });
      }
    }
  }

  // Bull/Bear Flag: strong move followed by tight consolidation
  const recentLen = Math.min(20, candles.length);
  const recentCandles = candles.slice(-recentLen);
  if (recentCandles.length >= 10) {
    const moveLen = 5;
    const flagLen = recentCandles.length - moveLen;
    const pole = recentCandles.slice(0, moveLen);
    const flag = recentCandles.slice(moveLen);
    const poleMove = pole[pole.length - 1].close - pole[0].open;
    const flagRange = Math.max(...flag.map(c => c.high)) - Math.min(...flag.map(c => c.low));
    const poleRange = Math.abs(poleMove);

    if (poleRange > 0 && flagRange / poleRange < 0.4) {
      if (poleMove > 0) {
        patterns.push({
          type: "bull_flag", confidence: 60,
          start_index: candles.length - recentLen,
          end_index: candles.length - 1,
          description: "Bull Flag — strong up-move followed by tight consolidation",
          bias: "BULLISH",
        });
      } else {
        patterns.push({
          type: "bear_flag", confidence: 60,
          start_index: candles.length - recentLen,
          end_index: candles.length - 1,
          description: "Bear Flag — strong down-move followed by tight consolidation",
          bias: "BEARISH",
        });
      }
    }
  }

  return patterns.slice(0, 5); // top 5 patterns
}

// =================== OI ANALYSIS ===================

interface OIAnalysisResult {
  strike: number;
  option_type: "CE" | "PE";
  oi: number;
  oi_change: number;
  ltp_change: number;
  interpretation: string;
  description: string;
}

function analyzeOIChanges(contracts: OptionContract[]): OIAnalysisResult[] {
  const results: OIAnalysisResult[] = [];

  for (const c of contracts) {
    if (c.oi === 0 || c.oi_change === 0) continue;

    const oiPctChange = c.oi_change / c.oi;
    if (Math.abs(oiPctChange) < 0.05) continue; // Skip insignificant changes

    // LTP change approximation: use relative position vs OI change
    // OI up + Price up = Long Buildup (bullish)
    // OI up + Price down = Short Buildup (bearish)
    // OI down + Price up = Short Covering (bullish)
    // OI down + Price down = Long Unwinding (bearish)
    // We use oi_change and ltp relative to mid-price as proxy
    const oiUp = c.oi_change > 0;
    // Approximate price direction from ltp vs theoretical value
    // For calls: higher ltp relative to IV = price up; for puts: inverse
    const ltpChange = c.ltp; // we track direction later from volume/price relationship

    let interpretation: string;
    let description: string;

    if (oiUp) {
      if (c.option_type === "CE") {
        // CE OI rising: if volume is high, likely long buildup (call buyers) or short buildup (call writers)
        // Heuristic: if IV is rising with OI, it's long buildup; if IV falling, short buildup
        if (c.iv > 20) {
          interpretation = "long_buildup";
          description = `CE Long Buildup at ${c.strike} — OI +${(oiPctChange * 100).toFixed(1)}%, bullish signal`;
        } else {
          interpretation = "short_buildup";
          description = `CE Short Buildup at ${c.strike} — OI +${(oiPctChange * 100).toFixed(1)}%, writers adding positions`;
        }
      } else {
        if (c.iv > 20) {
          interpretation = "long_buildup";
          description = `PE Long Buildup at ${c.strike} — OI +${(oiPctChange * 100).toFixed(1)}%, bearish signal`;
        } else {
          interpretation = "short_buildup";
          description = `PE Short Buildup at ${c.strike} — OI +${(oiPctChange * 100).toFixed(1)}%, writers adding positions`;
        }
      }
    } else {
      if (c.option_type === "CE") {
        interpretation = "short_covering";
        description = `CE Short Covering at ${c.strike} — OI ${(oiPctChange * 100).toFixed(1)}%, writers exiting`;
      } else {
        interpretation = "long_unwinding";
        description = `PE Long Unwinding at ${c.strike} — OI ${(oiPctChange * 100).toFixed(1)}%, longs exiting`;
      }
    }

    results.push({
      strike: c.strike,
      option_type: c.option_type,
      oi: c.oi,
      oi_change: c.oi_change,
      ltp_change: ltpChange,
      interpretation,
      description,
    });
  }

  return results
    .sort((a, b) => Math.abs(b.oi_change) - Math.abs(a.oi_change))
    .slice(0, 12);
}

// =================== STRIKE S/R FROM OPTIONS CHAIN ===================

interface StrikeSRResult {
  strike: number;
  ce_oi: number;
  pe_oi: number;
  ce_oi_change: number;
  pe_oi_change: number;
  type: "support" | "resistance" | "pivot";
  strength: number;
}

function calculateStrikeSR(contracts: OptionContract[], spotPrice: number, strikeGap: number): StrikeSRResult[] {
  // Group by strike
  const strikeMap = new Map<number, { ce_oi: number; pe_oi: number; ce_oi_change: number; pe_oi_change: number }>();
  
  for (const c of contracts) {
    if (!strikeMap.has(c.strike)) {
      strikeMap.set(c.strike, { ce_oi: 0, pe_oi: 0, ce_oi_change: 0, pe_oi_change: 0 });
    }
    const entry = strikeMap.get(c.strike)!;
    if (c.option_type === "CE") {
      entry.ce_oi = c.oi;
      entry.ce_oi_change = c.oi_change;
    } else {
      entry.pe_oi = c.oi;
      entry.pe_oi_change = c.oi_change;
    }
  }

  const results: StrikeSRResult[] = [];
  for (const [strike, data] of strikeMap) {
    // Max CE OI = Resistance (writers selling calls = resistance)
    // Max PE OI = Support (writers selling puts = support)
    const totalOI = data.ce_oi + data.pe_oi;
    if (totalOI === 0) continue;

    let type: "support" | "resistance" | "pivot";
    if (data.pe_oi > data.ce_oi * 1.5) {
      type = "support"; // more put writing = support
    } else if (data.ce_oi > data.pe_oi * 1.5) {
      type = "resistance"; // more call writing = resistance
    } else {
      type = "pivot";
    }

    results.push({
      strike,
      ce_oi: data.ce_oi,
      pe_oi: data.pe_oi,
      ce_oi_change: data.ce_oi_change,
      pe_oi_change: data.pe_oi_change,
      type,
      strength: totalOI,
    });
  }

  return results
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 8);
}

// =================== SUPPORT & RESISTANCE CALCULATION ===================

interface SRLevel {
  timeframe: string;
  level_type: "support" | "resistance";
  price: number;
  strength: number;
}

function findPivotPoints(candles: Candle[], lookback = 3): { supports: number[]; resistances: number[] } {
  const supports: number[] = [];
  const resistances: number[] = [];
  
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwingLow = true;
    let isSwingHigh = true;
    
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isSwingLow = false;
      }
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isSwingHigh = false;
      }
    }
    
    if (isSwingLow) supports.push(candles[i].low);
    if (isSwingHigh) resistances.push(candles[i].high);
  }
  
  return { supports, resistances };
}

function clusterLevels(prices: number[], threshold: number): { price: number; strength: number }[] {
  if (prices.length === 0) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const clusters: { prices: number[] }[] = [];
  let currentCluster = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= threshold) {
      currentCluster.push(sorted[i]);
    } else {
      clusters.push({ prices: currentCluster });
      currentCluster = [sorted[i]];
    }
  }
  clusters.push({ prices: currentCluster });
  
  return clusters.map(c => ({
    price: Number((c.prices.reduce((a, b) => a + b, 0) / c.prices.length).toFixed(2)),
    strength: c.prices.length,
  })).sort((a, b) => b.strength - a.strength).slice(0, 5);
}

interface CandleSet {
  timeframe: string;
  candles: Candle[];
}

async function calculateSupportResistance(
  kiteHeaders: Record<string, string>,
  indexName: string,
  spotPrice: number,
): Promise<{ levels: SRLevel[]; candleSets: CandleSet[] }> {
  const instrumentToken = indexName === "SENSEX" ? "265" : "256265";
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 5);
  const formatDate = (d: Date, time: string) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${time}`;
  };
  const fromStr = formatDate(from, "09:00:00");
  const toStr = formatDate(now, "15:30:00");
  
  const timeframes = [
    { interval: "minute", label: "1min", clusterThreshold: 5 },
    { interval: "5minute", label: "5min", clusterThreshold: 10 },
    { interval: "15minute", label: "15min", clusterThreshold: 15 },
  ];
  
  const allLevels: SRLevel[] = [];
  const candleSets: CandleSet[] = [];
  
  for (const tf of timeframes) {
    try {
      const res = await fetch(
        `https://api.kite.trade/instruments/historical/${instrumentToken}/${tf.interval}?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`,
        { headers: kiteHeaders }
      );
      const data = await res.json();
      
      if (data?.data?.candles) {
        const candles: Candle[] = data.data.candles.map((c: any[]) => ({
          timestamp: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5],
        }));
        
        // Keep last N candles for chart display
        const chartLimit = tf.label === "1min" ? 120 : tf.label === "5min" ? 80 : 50;
        candleSets.push({ timeframe: tf.label, candles: candles.slice(-chartLimit) });
        
        const { supports, resistances } = findPivotPoints(candles, tf.label === "1min" ? 2 : 3);
        
        const range = spotPrice * 0.02;
        const nearSupports = supports.filter(p => Math.abs(p - spotPrice) <= range);
        const nearResistances = resistances.filter(p => Math.abs(p - spotPrice) <= range);
        
        const clusteredSupports = clusterLevels(nearSupports, tf.clusterThreshold);
        const clusteredResistances = clusterLevels(nearResistances, tf.clusterThreshold);
        
        for (const s of clusteredSupports) {
          allLevels.push({ timeframe: tf.label, level_type: "support", price: s.price, strength: s.strength });
        }
        for (const r of clusteredResistances) {
          allLevels.push({ timeframe: tf.label, level_type: "resistance", price: r.price, strength: r.strength });
        }
      }
    } catch (e) {
      console.error(`S/R fetch error for ${tf.label}:`, e);
    }
  }
  
  return { levels: allLevels, candleSets };
}

function getExpiryDates(indexName: string, count = 5): string[] {
  const dates: string[] = [];
  const ist = getISTDate();
  const today = new Date(ist.getFullYear(), ist.getMonth(), ist.getDate());
  const expiryDay = indexName === "SENSEX" ? 4 : 2;
  let d = new Date(today);
  for (let attempts = 0; attempts < 60 && dates.length < count; attempts++) {
    if (d.getDay() === expiryDay) {
      const dateStr = d.toISOString().split("T")[0];
      if (d >= today && !dates.includes(dateStr)) {
        dates.push(dateStr);
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function calcGreeks(spotPrice: number, strike: number, iv: number, daysToExpiry: number, optionType: "CE" | "PE") {
  if (iv <= 0 || daysToExpiry <= 0 || spotPrice <= 0) {
    return { delta: optionType === "CE" ? 0.5 : -0.5, gamma: 0 };
  }
  const t = daysToExpiry / 365;
  const sigma = iv / 100;
  const r = 0.07;
  const d1 = (Math.log(spotPrice / strike) + (r + 0.5 * sigma * sigma) * t) / (sigma * Math.sqrt(t));
  const normCDF = (x: number) => {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const t2 = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t2 + a4) * t2) + a3) * t2 + a2) * t2 + a1) * t2 * Math.exp(-absX * absX / 2);
    return 0.5 * (1.0 + sign * y);
  };
  const normPDF = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const delta = optionType === "CE" ? normCDF(d1) : normCDF(d1) - 1;
  const gamma = normPDF(d1) / (spotPrice * sigma * Math.sqrt(t));
  return { delta: Number(delta.toFixed(4)), gamma: Number(gamma.toFixed(6)) };
}

function buildSymbols(indexName: string, expiryDate: Date, strikes: number[], isMonthlyExpiry: boolean): string[] {
  const instruments: string[] = [];
  const year = expiryDate.getFullYear().toString().slice(-2);
  const monthCodes = ["1","2","3","4","5","6","7","8","9","O","N","D"];
  const monthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const monthCode = monthCodes[expiryDate.getMonth()];
  const mon = monthNames[expiryDate.getMonth()];
  const day = String(expiryDate.getDate()).padStart(2, "0");
  const exchange = indexName === "SENSEX" ? "BFO" : "NFO";
  const prefix = indexName === "SENSEX" ? "SENSEX" : "NIFTY";
  for (const strike of strikes) {
    if (isMonthlyExpiry) {
      instruments.push(`${exchange}:${prefix}${year}${mon}${strike}CE`);
      instruments.push(`${exchange}:${prefix}${year}${mon}${strike}PE`);
    } else {
      instruments.push(`${exchange}:${prefix}${year}${monthCode}${day}${strike}CE`);
      instruments.push(`${exchange}:${prefix}${year}${monthCode}${day}${strike}PE`);
    }
  }
  return instruments;
}

function isLastExpiryOfMonth(expiryDate: Date, expiryDayOfWeek: number): boolean {
  const nextSameDay = new Date(expiryDate);
  nextSameDay.setDate(nextSameDay.getDate() + 7);
  return nextSameDay.getMonth() !== expiryDate.getMonth();
}

// =================== ENGINE MODE CONFIG ===================

interface ModeConfig {
  maxTrades: number;
  maxConsecutiveLosses: number;
  cooldownCandles: number;
  timeWindowStart: number; // IST minutes from midnight
  timeWindowEnd: number;
  emaFast: number;
  emaSlow: number;
  candleInterval: string; // "3minute" | "5minute" | "15minute"
  targetPct: number; // target % premium gain
  slPct: number;
  requireAllConditions: boolean;
  noLunchTrade: boolean;
  noReentryOnStrike: boolean;
}

function getModeConfig(mode: EngineMode): ModeConfig {
  switch (mode) {
    case "institutional":
      return {
        maxTrades: 6, maxConsecutiveLosses: 2, cooldownCandles: 3,
        timeWindowStart: 585, timeWindowEnd: 930, // 9:45 - 15:30
        emaFast: 20, emaSlow: 50, candleInterval: "5minute",
        targetPct: 0.30, slPct: 0.30,
        requireAllConditions: false, noLunchTrade: true, noReentryOnStrike: false,
      };
    case "scalping":
      return {
        maxTrades: 10, maxConsecutiveLosses: 3, cooldownCandles: 2,
        timeWindowStart: 585, timeWindowEnd: 885, // 9:45 - 14:45
        emaFast: 9, emaSlow: 50, candleInterval: "3minute",
        targetPct: 0.30, slPct: 0.20,
        requireAllConditions: false, noLunchTrade: false, noReentryOnStrike: false,
      };
    case "conservative":
      return {
        maxTrades: 5, maxConsecutiveLosses: 2, cooldownCandles: 5,
        timeWindowStart: 585, timeWindowEnd: 750, // 9:45 - 12:30
        emaFast: 20, emaSlow: 50, candleInterval: "5minute",
        targetPct: 0.40, slPct: 0.20,
        requireAllConditions: true, noLunchTrade: true, noReentryOnStrike: true,
      };
  }
}

// =================== ENGINE ANALYSIS ===================

interface EngineAnalysis {
  candles: Candle[];
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  volatilityRegime: "EXPANDING" | "CONTRACTING" | "FLAT";
  atrRising: boolean;
  openingRange: { high: number; low: number } | null;
  volumeAboveAvg: boolean;
  ema9: number;
  ema20: number;
  ema50: number;
  rsi: number;
  setupDetected: boolean;
  setupType: "PULLBACK" | "BREAKOUT" | null;
  triggerConfirmed: boolean;
  direction: "LONG" | "SHORT" | null;
}

function analyzeEngine(candles: Candle[], spotPrice: number, mode: EngineMode, config: ModeConfig): EngineAnalysis {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // EMA structure
  const ema9Arr = calculateEMA(closes, 9);
  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, 50);
  const ema9 = ema9Arr[ema9Arr.length - 1] || spotPrice;
  const ema20 = ema20Arr[ema20Arr.length - 1] || spotPrice;
  const ema50 = ema50Arr[ema50Arr.length - 1] || spotPrice;

  // RSI
  const rsi = calculateRSI(closes);

  // ATR
  const atrValues = calculateATR(candles);
  const lastATRs = atrValues.slice(-5);
  const atrRising = lastATRs.length >= 3 && lastATRs[lastATRs.length - 1] > lastATRs[lastATRs.length - 3];

  // Volatility regime
  const recentRanges = candles.slice(-5).map(c => c.high - c.low);
  const avgRange = candles.slice(-20).reduce((s, c) => s + (c.high - c.low), 0) / Math.min(20, candles.length);
  const currentRange = recentRanges[recentRanges.length - 1] || 0;
  let volatilityRegime: "EXPANDING" | "CONTRACTING" | "FLAT" = "FLAT";
  if (atrRising || currentRange > 1.2 * avgRange) volatilityRegime = "EXPANDING";
  else if (currentRange < 0.7 * avgRange) volatilityRegime = "CONTRACTING";

  // Volume above average
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  const lastVolume = volumes[volumes.length - 1] || 0;
  const volumeAboveAvg = lastVolume > avgVolume;

  // Market bias
  let bias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  if (spotPrice > ema20 && ema20 > ema50) bias = "BULLISH";
  else if (spotPrice < ema20 && ema20 < ema50) bias = "BEARISH";

  // Opening range (first 15min candles)
  let openingRange: { high: number; low: number } | null = null;
  // Get today's candles only
  const ist = getISTDate();
  const todayStr = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(ist.getDate()).padStart(2, "0")}`;
  const todayCandles = candles.filter(c => c.timestamp.startsWith(todayStr));
  if (todayCandles.length >= 3) {
    // First 3 five-minute candles = 15 minutes
    const orCandles = mode === "scalping" ? todayCandles.slice(0, 5) : todayCandles.slice(0, 3);
    openingRange = {
      high: Math.max(...orCandles.map(c => c.high)),
      low: Math.min(...orCandles.map(c => c.low)),
    };
  }

  // Setup detection
  let setupDetected = false;
  let setupType: "PULLBACK" | "BREAKOUT" | null = null;
  let triggerConfirmed = false;
  let direction: "LONG" | "SHORT" | null = null;

  const fastEma = mode === "scalping" ? ema9 : ema20;

  if (bias === "BULLISH") {
    // Pullback to fast EMA
    const pullbackToEma = closes.length >= 3 &&
      closes[closes.length - 2] <= fastEma * 1.002 &&
      closes[closes.length - 1] > fastEma;

    // Higher low pattern
    const recentLows = lows.slice(-5);
    const higherLow = recentLows.length >= 3 && recentLows[recentLows.length - 1] > recentLows[recentLows.length - 3];

    // Breakout of opening range
    const breakout = openingRange && spotPrice > openingRange.high;

    if (pullbackToEma || higherLow) {
      setupDetected = true;
      setupType = "PULLBACK";
    }
    if (breakout && bias === "BULLISH") {
      setupDetected = true;
      setupType = "BREAKOUT";
    }

    // Trigger: strong bullish close + volume
    const lastCandle = candles[candles.length - 1];
    if (lastCandle && lastCandle.close > lastCandle.open && volumeAboveAvg) {
      triggerConfirmed = true;
    }
    direction = "LONG";
  } else if (bias === "BEARISH") {
    const pullbackToEma = closes.length >= 3 &&
      closes[closes.length - 2] >= fastEma * 0.998 &&
      closes[closes.length - 1] < fastEma;

    const recentHighs = highs.slice(-5);
    const lowerHigh = recentHighs.length >= 3 && recentHighs[recentHighs.length - 1] < recentHighs[recentHighs.length - 3];

    const breakout = openingRange && spotPrice < openingRange.low;

    if (pullbackToEma || lowerHigh) {
      setupDetected = true;
      setupType = "PULLBACK";
    }
    if (breakout && bias === "BEARISH") {
      setupDetected = true;
      setupType = "BREAKOUT";
    }

    const lastCandle = candles[candles.length - 1];
    if (lastCandle && lastCandle.close < lastCandle.open && volumeAboveAvg) {
      triggerConfirmed = true;
    }
    direction = "SHORT";
  }

  // Conservative mode: require ALL conditions
  if (mode === "conservative") {
    const allMet = bias !== "NEUTRAL" && volatilityRegime === "EXPANDING" &&
      volumeAboveAvg && setupDetected && triggerConfirmed && atrRising;
    if (!allMet) {
      setupDetected = false;
      triggerConfirmed = false;
    }
  }

  // Institutional: require volatility expansion
  if (mode === "institutional" && volatilityRegime !== "EXPANDING") {
    triggerConfirmed = false;
  }

  return {
    candles, bias, volatilityRegime, atrRising, openingRange,
    volumeAboveAvg, ema9, ema20, ema50, rsi,
    setupDetected, setupType, triggerConfirmed, direction,
  };
}

// =================== MAIN HANDLER ===================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const indexName = url.searchParams.get("index") || "NIFTY";
    const expiry = url.searchParams.get("expiry");
    const mode = url.searchParams.get("mode") || "scanner";

    // Get Kite config
    const { data: configData, error: configError } = await supabase
      .from("kite_config")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !configData) {
      return new Response(
        JSON.stringify({
          error: "Kite API not configured. Please set your API key and access token in Settings.",
          contracts: [], nifty_price: 0, pcr: 0, signals: [],
          expiry_dates: getExpiryDates(indexName),
          index_name: indexName,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { api_key, access_token } = configData;
    const kiteHeaders = {
      "X-Kite-Version": "3",
      Authorization: `token ${api_key}:${access_token}`,
    };

    // Fetch spot price
    const quoteSymbol = indexName === "SENSEX" ? "BSE:SENSEX" : "NSE:NIFTY 50";
    let spotPrice = 0;
    try {
      const quoteRes = await fetch(
        `https://api.kite.trade/quote?i=${encodeURIComponent(quoteSymbol)}`,
        { headers: kiteHeaders }
      );
      const quoteData = await quoteRes.json();
      console.log("Kite quote response status:", quoteRes.status);
      if (quoteData?.data?.[quoteSymbol]) {
        spotPrice = quoteData.data[quoteSymbol].last_price;
      }
    } catch (e) {
      console.error("Failed to fetch spot price:", e);
    }

    // Calculate ATM strike
    const strikeGap = indexName === "SENSEX" ? 100 : 50;
    const atmStrike = Math.round(spotPrice / strikeGap) * strikeGap;
    const isEngineMode = ["institutional", "scalping", "conservative"].includes(mode);
    const strikeRange = mode === "herozero" ? 5 : 10;
    const strikes: number[] = [];
    for (let i = -strikeRange; i <= strikeRange; i++) {
      strikes.push(atmStrike + i * strikeGap);
    }

    // Determine expiry date
    let expiryDate: Date;
    if (expiry) {
      expiryDate = new Date(expiry + "T00:00:00");
    } else {
      const expiryDates = getExpiryDates(indexName, 1);
      if (expiryDates.length > 0) {
        expiryDate = new Date(expiryDates[0] + "T00:00:00");
      } else {
        const expiryDay = indexName === "SENSEX" ? 4 : 2;
        const ist = getISTDate();
        const today = new Date(ist.getFullYear(), ist.getMonth(), ist.getDate());
        const dayOfWeek = today.getDay();
        const daysUntil = (expiryDay - dayOfWeek + 7) % 7;
        expiryDate = new Date(today);
        expiryDate.setDate(today.getDate() + (daysUntil === 0 ? 0 : daysUntil));
      }
    }

    const ist = getISTDate();
    const todayDate = new Date(ist.getFullYear(), ist.getMonth(), ist.getDate());
    const daysToExpiry = Math.max(0.01, (expiryDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    const expiryDayOfWeek = indexName === "SENSEX" ? 4 : 2;
    const monthlyExpiry = isLastExpiryOfMonth(expiryDate, expiryDayOfWeek);
    const instruments = buildSymbols(indexName, expiryDate, strikes, monthlyExpiry);

    // Fetch option chain quotes
    const allContracts: OptionContract[] = [];
    const batchSize = 50;

    for (let i = 0; i < instruments.length; i += batchSize) {
      const batch = instruments.slice(i, i + batchSize);
      const queryString = batch.map((inst) => `i=${encodeURIComponent(inst)}`).join("&");
      try {
        const optRes = await fetch(`https://api.kite.trade/quote?${queryString}`, { headers: kiteHeaders });
        const optData = await optRes.json();
        if (optData?.data) {
          const exchange = indexName === "SENSEX" ? "BFO:" : "NFO:";
          for (const [key, value] of Object.entries(optData.data)) {
            const v = value as any;
            const symbol = key.replace(exchange, "");
            const isCall = symbol.endsWith("CE");
            const optType = isCall ? "CE" : "PE";
            let strikePrice = 0;
            for (const s of strikes) {
              if (symbol.includes(String(s) + optType)) { strikePrice = s; break; }
            }
            const optTypeTyped = optType as "CE" | "PE";
            const contractIV = v.implied_volatility || 0;
            const greeks = calcGreeks(spotPrice, strikePrice, contractIV, daysToExpiry, optTypeTyped);
            // Extract bid-ask spread from depth
            const bestBid = v.depth?.buy?.[0]?.price || 0;
            const bestAsk = v.depth?.sell?.[0]?.price || 0;
            const bidAskSpread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
            
            // Approximate theta: -(ltp / daysToExpiry) for 0DTE decay
            const approxTheta = daysToExpiry > 0 ? -((v.last_price || 0) / daysToExpiry) : 0;
            
            // Gamma exposure: gamma * oi * spot^2 / 100 (simplified near-ATM measure)
            const gammaExp = Math.abs(strikePrice - spotPrice) <= strikeGap * 2
              ? (greeks.gamma * (v.oi || 0) * spotPrice * spotPrice) / 1e8
              : 0;

            allContracts.push({
              instrument_token: v.instrument_token || 0,
              trading_symbol: symbol, strike: strikePrice, option_type: optTypeTyped,
              ltp: v.last_price || 0, volume: v.volume || 0, oi: v.oi || 0,
              oi_change: v.oi_day_change || 0, iv: contractIV,
              volume_score: 0, oi_score: 0, oi_change_score: 0, iv_score: 0, volume_spike_score: 0,
              confidence: 0, volume_burst: false, signal: null,
              strike_distance: Math.abs(strikePrice - atmStrike) / strikeGap,
              delta: greeks.delta, gamma: greeks.gamma,
              theta: Number(approxTheta.toFixed(4)),
              bid_ask_spread: Number(bidAskSpread.toFixed(2)),
              gamma_exposure: Number(gammaExp.toFixed(2)),
            });
          }
        }
      } catch (e) {
        console.error("Batch fetch error:", e);
      }
    }

    if (allContracts.length === 0) {
      return new Response(
        JSON.stringify({
          contracts: [], nifty_price: indexName === "NIFTY" ? spotPrice : 0,
          sensex_price: indexName === "SENSEX" ? spotPrice : 0,
          pcr: 0, signals: [], error: "No option data received from Kite API. Check token validity.",
          expiry_dates: getExpiryDates(indexName), index_name: indexName, atm_strike: atmStrike,
          support_resistance: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =================== SUPPORT & RESISTANCE ===================
    let srLevels: SRLevel[] = [];
    let candleSets: CandleSet[] = [];
    try {
      const srResult = await calculateSupportResistance(kiteHeaders, indexName, spotPrice);
      srLevels = srResult.levels;
      candleSets = srResult.candleSets;
      
      // Store S/R levels in DB
      if (srLevels.length > 0) {
        // Clear old levels for this index
        await supabase.from("support_resistance").delete().eq("index_name", indexName);
        
        // Insert new levels
        const rows = srLevels.map(l => ({
          index_name: indexName,
          timeframe: l.timeframe,
          level_type: l.level_type,
          price: l.price,
          strength: l.strength,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from("support_resistance").insert(rows);
      }
    } catch (e) {
      console.error("S/R calculation error:", e);
    }

    // =================== PATTERN DETECTION ===================
    let chartPatterns: ChartPattern[] = [];
    let candlestickPatterns: CandlestickPattern[] = [];
    
    // Use the 5min candles for pattern detection
    const fiveMinCandles = candleSets.find(cs => cs.timeframe === "5min")?.candles || [];
    if (fiveMinCandles.length > 0) {
      chartPatterns = detectChartPatterns(fiveMinCandles);
      candlestickPatterns = detectCandlestickPatterns(fiveMinCandles);
    }

    // =================== OI ANALYSIS ===================
    const oiAnalysis = analyzeOIChanges(allContracts);
    const strikeSR = calculateStrikeSR(allContracts, spotPrice, strikeGap);

    // Pattern-based signal confluence scoring
    let patternBias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    const bullishPatterns = chartPatterns.filter(p => p.bias === "BULLISH").length +
      candlestickPatterns.filter(p => p.bias === "BULLISH").length;
    const bearishPatterns = chartPatterns.filter(p => p.bias === "BEARISH").length +
      candlestickPatterns.filter(p => p.bias === "BEARISH").length;
    if (bullishPatterns > bearishPatterns) patternBias = "BULLISH";
    else if (bearishPatterns > bullishPatterns) patternBias = "BEARISH";

    // Use S/R for signal confluence scoring
    const nearestSupport = srLevels
      .filter(l => l.level_type === "support" && l.price < spotPrice)
      .sort((a, b) => b.price - a.price)[0];
    const nearestResistance = srLevels
      .filter(l => l.level_type === "resistance" && l.price > spotPrice)
      .sort((a, b) => a.price - b.price)[0];

    // Volume spike
    const avgVolume = allContracts.reduce((s, c) => s + c.volume, 0) / (allContracts.length || 1);
    for (const contract of allContracts) {
      contract.volume_spike_score = avgVolume > 0 ? contract.volume / avgVolume : 0;
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // =================== ENGINE MODE PROCESSING ===================
    if (isEngineMode) {
      const engineMode = mode as EngineMode;
      const modeConfig = getModeConfig(engineMode);
      const flowSteps: FlowStep[] = [];

      // Fetch candle data
      let candles: Candle[] = [];
      try {
        const instrumentToken = indexName === "SENSEX" ? "265" : "256265";
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 5);
        const fmtD = (d: Date, t: string) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${t}`;
        const fromStr = fmtD(from, "09:00:00");
        const toStr = fmtD(now, "15:30:00");

        const histRes = await fetch(
          `https://api.kite.trade/instruments/historical/${instrumentToken}/${modeConfig.candleInterval}?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`,
          { headers: kiteHeaders }
        );
        const histData = await histRes.json();
        if (histData?.data?.candles) {
          candles = histData.data.candles.map((c: any[]) => ({
            timestamp: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5],
          }));
        }
      } catch (e) {
        console.error("Candle fetch error:", e);
      }

      // IST time check
      const istTimeInMinutes = ist.getHours() * 60 + ist.getMinutes();
      const timeWindowOk = istTimeInMinutes >= modeConfig.timeWindowStart && istTimeInMinutes <= modeConfig.timeWindowEnd;
      flowSteps.push({ name: "Time Window", passed: timeWindowOk, detail: timeWindowOk ? `${Math.floor(modeConfig.timeWindowStart/60)}:${String(modeConfig.timeWindowStart%60).padStart(2,"0")} - ${Math.floor(modeConfig.timeWindowEnd/60)}:${String(modeConfig.timeWindowEnd%60).padStart(2,"0")}` : "Outside trading window" });

      // Lunch session check
      const isLunch = istTimeInMinutes >= 720 && istTimeInMinutes <= 780;
      const lunchOk = !modeConfig.noLunchTrade || !isLunch;
      flowSteps.push({ name: "Lunch Filter", passed: lunchOk, detail: isLunch ? "Lunch session (12:00-1:00)" : "Active session" });

      // Daily trade count from DB
      const todayStartUTC = new Date(todayDate.getTime() - 5.5 * 60 * 60 * 1000).toISOString();
      const { data: todayTrades } = await supabase
        .from("trade_results")
        .select("id, outcome")
        .eq("mode", mode)
        .eq("index_name", indexName)
        .gte("created_at", todayStartUTC);

      const dailyTradeCount = todayTrades?.length || 0;
      const dailyLimitOk = dailyTradeCount < modeConfig.maxTrades;
      flowSteps.push({ name: "Daily Trade Limit", passed: dailyLimitOk, detail: `${dailyTradeCount}/${modeConfig.maxTrades} trades used` });

      // Consecutive losses
      const recentOutcomes = (todayTrades || [])
        .filter(t => t.outcome !== "active")
        .map(t => t.outcome);
      let consecutiveLosses = 0;
      for (let i = recentOutcomes.length - 1; i >= 0; i--) {
        if (recentOutcomes[i] === "fail") consecutiveLosses++;
        else break;
      }
      const consLossOk = consecutiveLosses < modeConfig.maxConsecutiveLosses;
      flowSteps.push({ name: "Consecutive Loss Rule", passed: consLossOk, detail: `${consecutiveLosses}/${modeConfig.maxConsecutiveLosses} consecutive losses` });

      // Active trade check
      const activeTrades = (todayTrades || []).filter(t => t.outcome === "active");
      const noActiveTrade = activeTrades.length === 0;
      flowSteps.push({ name: "Active Trade Check", passed: noActiveTrade, detail: noActiveTrade ? "No active trade" : `${activeTrades.length} active` });

      // Cooldown check (simplified: check if last trade was within cooldown period)
      let cooldownActive = false;
      let cooldownCandlesLeft = 0;
      if (todayTrades && todayTrades.length > 0) {
        // We approximate cooldown as: N candles × candle interval minutes
        const candleMinutes = modeConfig.candleInterval === "3minute" ? 3 : 5;
        const cooldownMinutes = modeConfig.cooldownCandles * candleMinutes;
        // Check last resolved trade time
        const { data: lastResolved } = await supabase
          .from("trade_results")
          .select("resolved_at")
          .eq("mode", mode)
          .eq("index_name", indexName)
          .not("resolved_at", "is", null)
          .order("resolved_at", { ascending: false })
          .limit(1);
        if (lastResolved && lastResolved.length > 0 && lastResolved[0].resolved_at) {
          const lastTime = new Date(lastResolved[0].resolved_at).getTime();
          const elapsed = (Date.now() - lastTime) / (1000 * 60);
          if (elapsed < cooldownMinutes) {
            cooldownActive = true;
            cooldownCandlesLeft = Math.ceil((cooldownMinutes - elapsed) / candleMinutes);
          }
        }
      }
      flowSteps.push({ name: "Cooldown", passed: !cooldownActive, detail: cooldownActive ? `${cooldownCandlesLeft} candles remaining` : "Ready" });

      // Engine analysis
      const analysis = analyzeEngine(candles, spotPrice, engineMode, modeConfig);

      flowSteps.push({ name: "Market Bias", passed: analysis.bias !== "NEUTRAL", detail: analysis.bias });
      flowSteps.push({ name: "Volatility Regime", passed: analysis.volatilityRegime === "EXPANDING", detail: `${analysis.volatilityRegime} | ATR ${analysis.atrRising ? "Rising" : "Flat"}` });
      flowSteps.push({ name: "Setup Detection", passed: analysis.setupDetected, detail: analysis.setupType || "No setup" });
      flowSteps.push({ name: "Trigger Confirmation", passed: analysis.triggerConfirmed, detail: analysis.triggerConfirmed ? "Confirmed" : "Not triggered" });

      const canTrade = timeWindowOk && lunchOk && dailyLimitOk && consLossOk &&
        noActiveTrade && !cooldownActive && analysis.setupDetected && analysis.triggerConfirmed;

      let noTradeReason: string | null = null;
      if (!canTrade) {
        if (!timeWindowOk) noTradeReason = "Outside trading window";
        else if (!lunchOk) noTradeReason = "Lunch session - no trades";
        else if (!dailyLimitOk) noTradeReason = "Daily trade limit reached";
        else if (!consLossOk) noTradeReason = "Max consecutive losses reached";
        else if (!noActiveTrade) noTradeReason = "Active trade running";
        else if (cooldownActive) noTradeReason = "Cooldown active";
        else if (!analysis.setupDetected) noTradeReason = "No valid setup detected";
        else if (!analysis.triggerConfirmed) noTradeReason = "Trigger not confirmed";
      }

      flowSteps.push({ name: "Trade Decision", passed: canTrade, detail: canTrade ? "SIGNAL GENERATED" : (noTradeReason || "No trade") });

      // Generate engine signal if all conditions pass
      const engineSignals: any[] = [];
      if (canTrade && analysis.direction) {
        const optType = analysis.direction === "LONG" ? "CE" : "PE";
        // Find best ATM contract of the right type
        const candidates = allContracts
          .filter(c => c.option_type === optType && (c.strike_distance || 0) <= 2)
          .sort((a, b) => b.volume - a.volume);
        const bestContract = candidates[0];

        if (bestContract) {
          // Check no re-entry on same strike (conservative)
          let skipReentry = false;
          if (modeConfig.noReentryOnStrike) {
            const { data: existingOnStrike } = await supabase
              .from("signals")
              .select("id")
              .eq("strike", bestContract.strike)
              .eq("mode", mode)
              .gte("created_at", todayStartUTC)
              .limit(1);
            if (existingOnStrike && existingOnStrike.length > 0) skipReentry = true;
          }

          if (!skipReentry) {
            // Dedup check
            const { data: recentSignals } = await supabase
              .from("signals")
              .select("id")
              .eq("trading_symbol", bestContract.trading_symbol)
              .eq("mode", mode)
              .gte("created_at", fiveMinAgo)
              .limit(1);

            if (!recentSignals || recentSignals.length === 0) {
              const entryPrice = bestContract.ltp;
              const sl = Number((entryPrice * (1 - modeConfig.slPct)).toFixed(2));
              const t1 = Number((entryPrice * (1 + modeConfig.targetPct)).toFixed(2));
              const t2 = Number((entryPrice * (1 + modeConfig.targetPct * 1.5)).toFixed(2));
              const rr = modeConfig.targetPct / modeConfig.slPct;

              const signal = {
                trading_symbol: bestContract.trading_symbol,
                strike: bestContract.strike,
                option_type: bestContract.option_type,
                entry_price: entryPrice,
                stop_loss: sl,
                target1: t1,
                target2: t2,
                target3: Number((entryPrice * (1 + modeConfig.targetPct * 2)).toFixed(2)),
                confidence: bestContract.confidence,
                index_name: indexName,
                mode: mode,
                reason: `${engineMode.charAt(0).toUpperCase() + engineMode.slice(1)} | ${analysis.bias} ${analysis.setupType} | R:R ${rr.toFixed(1)}`,
              };

              const { data: insertedSignal } = await supabase.from("signals").insert(signal).select().single();
              if (insertedSignal) {
                await supabase.from("trade_results").insert({
                  signal_id: insertedSignal.id,
                  outcome: "active",
                  index_name: indexName,
                  mode: mode,
                });
                engineSignals.push({
                  ...signal, id: insertedSignal.id,
                  direction: analysis.direction,
                  mode: engineMode,
                  risk_reward: rr,
                  created_at: new Date().toISOString(),
                });
              }
            }
          }
        }
      }

      // Score contracts
      const volumesArr = allContracts.map(c => c.volume);
      const ois = allContracts.map(c => c.oi);
      const normV = normalize(volumesArr);
      const normO = normalize(ois);
      for (let i = 0; i < allContracts.length; i++) {
        allContracts[i].volume_score = normV[i];
        allContracts[i].oi_score = normO[i];
        allContracts[i].confidence = Math.round((normV[i] * 0.5 + normO[i] * 0.5) * 100);
      }

      // PCR
      const totalPutOI = allContracts.filter(c => c.option_type === "PE").reduce((sum, c) => sum + c.oi, 0);
      const totalCallOI = allContracts.filter(c => c.option_type === "CE").reduce((sum, c) => sum + c.oi, 0);
      const pcr = totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 0;

      // Auto-track active trades
      try {
        const { data: activeTradesDb } = await supabase
          .from("trade_results")
          .select("*, signal:signals(*)")
          .eq("outcome", "active");
        if (activeTradesDb) {
          for (const trade of activeTradesDb) {
            const sig = (trade as any).signal;
            if (!sig) continue;
            const match = allContracts.find(c => c.trading_symbol === sig.trading_symbol);
            if (!match) continue;
            const currentLtp = match.ltp;
            const entryPrice = sig.entry_price;
            const stopLoss = sig.stop_loss;
            const target1 = sig.target1;

            let outcome: string | null = null;
            let exitPrice: number | null = null;
            let pnl: number | null = null;

            if (currentLtp <= stopLoss) {
              outcome = "fail"; exitPrice = stopLoss; pnl = stopLoss - entryPrice;
            } else if (currentLtp >= target1) {
              outcome = "pass"; exitPrice = target1; pnl = target1 - entryPrice;
            }

            if (outcome) {
              await supabase.from("trade_results").update({
                outcome, exit_price: exitPrice, pnl, resolved_at: new Date().toISOString(),
              }).eq("id", trade.id);
            }
          }
        }
      } catch (e) {
        console.error("Trade tracking error:", e);
      }

      const maxPain = atmStrike;
      const selectedExpiry = expiryDate.toISOString().split("T")[0];

      const engineState = {
        mode: engineMode,
        market_bias: analysis.bias,
        volatility_regime: analysis.volatilityRegime,
        atr_rising: analysis.atrRising,
        opening_range: analysis.openingRange,
        volume_above_avg: analysis.volumeAboveAvg,
        ema_structure: { ema9: analysis.ema9, ema20: analysis.ema20, ema50: analysis.ema50 },
        rsi: analysis.rsi,
        daily_trades: dailyTradeCount,
        max_trades: modeConfig.maxTrades,
        consecutive_losses: consecutiveLosses,
        max_consecutive_losses: modeConfig.maxConsecutiveLosses,
        cooldown_active: cooldownActive,
        cooldown_candles_left: cooldownCandlesLeft,
        time_window_ok: timeWindowOk,
        lunch_session: isLunch,
        setup_detected: analysis.setupDetected,
        setup_type: analysis.setupType,
        trigger_confirmed: analysis.triggerConfirmed,
        can_trade: canTrade,
        no_trade_reason: noTradeReason,
        spot_price: spotPrice,
      };

      const responseData = {
        engine_state: engineState,
        signals: engineSignals,
        contracts: allContracts.slice(0, 20),
        nifty_price: indexName === "NIFTY" ? spotPrice : 0,
        sensex_price: indexName === "SENSEX" ? spotPrice : 0,
        pcr,
        atm_strike: atmStrike,
        expiry_dates: getExpiryDates(indexName),
        max_pain: maxPain,
        index_name: indexName,
        selected_expiry: selectedExpiry,
        flow_steps: flowSteps,
      };

      // Cache
      const cacheId = `${indexName}_${mode}`;
      try {
        await supabase.from("last_scan_cache").upsert({
          id: cacheId, index_name: indexName, mode, scan_data: responseData, cached_at: new Date().toISOString(),
        }, { onConflict: "id" });
      } catch (e) { console.error("Cache error:", e); }

      return new Response(JSON.stringify(responseData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =================== EXISTING SCANNER / HEROZERO MODE ===================

    if (mode === "herozero") {
      try {
        const instrumentToken = indexName === "SENSEX" ? "265" : "256265";
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 5);
        const fmtD2 = (d: Date, t: string) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${t}`;
        const fromStr = fmtD2(from, "09:00:00");
        const toStr = fmtD2(now, "15:30:00");

        const histRes = await fetch(
          `https://api.kite.trade/instruments/historical/${instrumentToken}/5minute?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`,
          { headers: kiteHeaders }
        );
        const histData = await histRes.json();

        if (histData?.data?.candles) {
          const closes = histData.data.candles.map((c: any[]) => c[4]);
          const ema20Values = calculateEMA(closes, 20);
          const lastEma20 = ema20Values[ema20Values.length - 1];
          const rsi = calculateRSI(closes);
          const macd = calculateMACD(closes);

          for (const contract of allContracts) {
            contract.ema20 = lastEma20;
            contract.rsi = rsi;
            contract.macd_signal = macd.signal;
          }
        }
      } catch (e) {
        console.error("Historical data fetch error:", e);
      }

      // Max Pain calculation
      const strikesSet = [...new Set(allContracts.map(c => c.strike))];
      let minPain = Infinity;
      let maxPainStrike = atmStrike;
      for (const testStrike of strikesSet) {
        let pain = 0;
        for (const c of allContracts) {
          if (c.option_type === "CE") pain += Math.max(0, c.strike - testStrike) * c.oi;
          else pain += Math.max(0, testStrike - c.strike) * c.oi;
        }
        if (pain < minPain) { minPain = pain; maxPainStrike = testStrike; }
      }

      for (const contract of allContracts) { contract.max_pain = maxPainStrike; }

      // Hero Zero ML-validated scoring (v2 - with Theta, Liquidity, Gamma Exposure)
      // Formula: (OI×0.25) + (IV×0.20) + (10/LTP×0.25) + ((1-PCR)×0.15) + ((1/Dist)×0.10) + (EMA×0.05) + (Theta×0.03) + (Liq×0.04) + (Gamma×0.03)
      const hzTotalPutOI = allContracts.filter(c => c.option_type === "PE").reduce((s, c) => s + c.oi, 0);
      const hzTotalCallOI = allContracts.filter(c => c.option_type === "CE").reduce((s, c) => s + c.oi, 0);
      const hzPCR = hzTotalCallOI > 0 ? hzTotalPutOI / hzTotalCallOI : 1;

      // Pre-compute normalization values
      const allOIs = allContracts.map(c => c.oi);
      const maxOI = Math.max(...allOIs, 1);
      const allIVs = allContracts.map(c => c.iv);
      const maxIV = Math.max(...allIVs, 1);
      const allThetas = allContracts.map(c => Math.abs(c.theta || 0));
      const maxTheta = Math.max(...allThetas, 0.01);
      const allSpreads = allContracts.map(c => c.bid_ask_spread || 0);
      const maxSpread = Math.max(...allSpreads, 0.01);
      const allGammaExp = allContracts.map(c => c.gamma_exposure || 0);
      const maxGammaExp = Math.max(...allGammaExp, 0.01);

      const isSensex = indexName === "SENSEX";
      const maxDistPts = isSensex ? 100 : 150;

      // IST time for peak gamma window check (2:15-3:10 PM = 855-910 minutes)
      const istMinutes = ist.getHours() * 60 + ist.getMinutes();
      const inPeakGammaWindow = istMinutes >= 855 && istMinutes <= 910;

      for (const contract of allContracts) {
        // --- FILTERS ---
        const ltpOk = contract.ltp >= 1 && contract.ltp <= 10;
        const oiChangeOk = contract.oi > 0 && contract.oi_change > 0 &&
          (contract.oi_change / contract.oi) >= 0.15 && (contract.oi_change / contract.oi) <= 0.30;
        const pcrOk = isSensex ? hzPCR < 0.75 : hzPCR < 0.7;
        const distPts = (contract.strike_distance || 0) * strikeGap;
        const distOk = distPts <= maxDistPts;
        const emaOk = contract.ema20 && spotPrice > 0 &&
          ((contract.option_type === "CE" && spotPrice > contract.ema20) ||
           (contract.option_type === "PE" && spotPrice < contract.ema20));

        // --- WEIGHTED SCORE COMPONENTS (0-1 each, total weights = 1.10, normalized) ---
        // OI (25%)
        const oiComponent = contract.oi / maxOI;

        // IV (20%)
        const ivComponent = contract.iv / maxIV;

        // LTP (25%): 10/ltp capped at 1
        const ltpComponent = contract.ltp > 0 ? Math.min(1, 10 / contract.ltp) : 0;

        // PCR (15%): (1 - PCR), lower PCR = higher score
        const pcrComponent = Math.min(1, Math.max(0, 1 - hzPCR));

        // Distance (10%): 1/distance, closer = better
        const distComponent = distOk ? Math.max(0, 1 - (distPts / maxDistPts)) : 0;

        // EMA (5%): alignment with option type
        const emaComponent = emaOk ? 1 : 0;

        // Theta (3%): higher absolute theta = more time decay acceleration (good for 0DTE buyers catching gamma)
        const thetaComponent = maxTheta > 0 ? Math.abs(contract.theta || 0) / maxTheta : 0;

        // Liquidity (4%): 1/spread - tighter spread = better (inverse normalized)
        const spreadVal = contract.bid_ask_spread || maxSpread;
        const liqComponent = spreadVal > 0 ? Math.min(1, (maxSpread > 0 ? (1 - spreadVal / maxSpread) : 0)) : 0;

        // Gamma Exposure (3%): near-ATM gamma explosion potential
        const gammaExpComponent = maxGammaExp > 0 ? (contract.gamma_exposure || 0) / maxGammaExp : 0;

        // Weighted score (total weights = 1.10, normalize to 1.0)
        const rawScore = ((oiComponent * 0.25) + (ivComponent * 0.20) + (ltpComponent * 0.25) +
          (pcrComponent * 0.15) + (distComponent * 0.10) + (emaComponent * 0.05) +
          (thetaComponent * 0.03) + (liqComponent * 0.04) + (gammaExpComponent * 0.03)) / 1.10;

        let score = rawScore * 100;

        // Filter bonuses
        if (ltpOk) score *= 1.15;
        if (oiChangeOk) score *= 1.10;
        if (contract.option_type === "CE" && hzPCR < 0.7) score *= 1.05;

        // RSI 30-50 oversold bounce for calls (refined from just <30)
        if (contract.rsi !== undefined) {
          if (contract.option_type === "CE" && contract.rsi >= 30 && contract.rsi <= 50) score *= 1.06;
          if (contract.option_type === "PE" && contract.rsi >= 50 && contract.rsi <= 70) score *= 1.06;
        }

        // Peak gamma time window bonus (2:15-3:10 PM IST)
        if (inPeakGammaWindow) score *= 1.08;

        // S/R confluence bonus: if spot is near a multi-timeframe support (CE) or resistance (PE)
        if (nearestSupport && contract.option_type === "CE") {
          const distToSupport = Math.abs(spotPrice - nearestSupport.price) / spotPrice;
          if (distToSupport < 0.005 && nearestSupport.strength >= 2) score *= 1.10;
          else if (distToSupport < 0.01) score *= 1.05;
        }
        if (nearestResistance && contract.option_type === "PE") {
          const distToRes = Math.abs(nearestResistance.price - spotPrice) / spotPrice;
          if (distToRes < 0.005 && nearestResistance.strength >= 2) score *= 1.10;
          else if (distToRes < 0.01) score *= 1.05;
        }

        contract.hero_score = Math.min(100, Math.round(score));
      }
    }

    // Normalize scores
    const volumes = allContracts.map(c => c.volume);
    const ois = allContracts.map(c => c.oi);
    const oiChanges = allContracts.map(c => Math.abs(c.oi_change));
    const ivs = allContracts.map(c => c.iv);
    const spikes = allContracts.map(c => c.volume_spike_score);

    const normVolumes = normalize(volumes);
    const normOis = normalize(ois);
    const normOiChanges = normalize(oiChanges);
    const normIvs = normalize(ivs);
    const normSpikes = normalize(spikes);
    const avgSpike = spikes.reduce((a, b) => a + b, 0) / spikes.length || 1;

    for (let i = 0; i < allContracts.length; i++) {
      allContracts[i].volume_score = normVolumes[i];
      allContracts[i].oi_score = normOis[i];
      allContracts[i].oi_change_score = normOiChanges[i];
      allContracts[i].iv_score = normIvs[i];
      allContracts[i].volume_spike_score = normSpikes[i];
      allContracts[i].confidence = Math.round(
        (0.2 * normVolumes[i] + 0.2 * normOis[i] + 0.2 * normOiChanges[i] + 0.2 * normIvs[i] + 0.2 * normSpikes[i]) * 100
      );
      allContracts[i].volume_burst = spikes[i] > 1.5 * avgSpike;

      // S/R confluence bonus for scanner mode confidence
      if (mode === "scanner") {
        if (nearestSupport && allContracts[i].option_type === "CE") {
          const distToSup = Math.abs(spotPrice - nearestSupport.price) / spotPrice;
          if (distToSup < 0.005 && nearestSupport.strength >= 2) allContracts[i].confidence = Math.min(100, allContracts[i].confidence + 8);
          else if (distToSup < 0.01) allContracts[i].confidence = Math.min(100, allContracts[i].confidence + 4);
        }
        if (nearestResistance && allContracts[i].option_type === "PE") {
          const distToRes = Math.abs(nearestResistance.price - spotPrice) / spotPrice;
          if (distToRes < 0.005 && nearestResistance.strength >= 2) allContracts[i].confidence = Math.min(100, allContracts[i].confidence + 8);
          else if (distToRes < 0.01) allContracts[i].confidence = Math.min(100, allContracts[i].confidence + 4);
        }

        // Pattern-based confidence bonus
        if (patternBias === "BULLISH" && allContracts[i].option_type === "CE") {
          allContracts[i].confidence = Math.min(100, allContracts[i].confidence + 5 + Math.min(5, bullishPatterns * 2));
        }
        if (patternBias === "BEARISH" && allContracts[i].option_type === "PE") {
          allContracts[i].confidence = Math.min(100, allContracts[i].confidence + 5 + Math.min(5, bearishPatterns * 2));
        }

        // OI analysis boost: long buildup in same direction adds confidence
        const matchingOI = oiAnalysis.filter(oi =>
          oi.strike === allContracts[i].strike && oi.option_type === allContracts[i].option_type
        );
        for (const moi of matchingOI) {
          if (moi.interpretation === "long_buildup") {
            allContracts[i].confidence = Math.min(100, allContracts[i].confidence + 3);
          }
        }
      }
    }

    if (mode === "herozero") {
      allContracts.sort((a, b) => (b.hero_score || 0) - (a.hero_score || 0));
    } else {
      allContracts.sort((a, b) => b.confidence - a.confidence);
    }

    // PCR
    const totalPutOI = allContracts.filter(c => c.option_type === "PE").reduce((sum, c) => sum + c.oi, 0);
    const totalCallOI = allContracts.filter(c => c.option_type === "CE").reduce((sum, c) => sum + c.oi, 0);
    const pcr = totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 0;

    // Signal generation
    const newSignals: any[] = [];
    const topContract = allContracts[0];

    if (topContract && topContract.confidence > 65 && topContract.volume_burst) {
      const { data: recentSignals } = await supabase
        .from("signals").select("id")
        .eq("trading_symbol", topContract.trading_symbol)
        .gte("created_at", fiveMinAgo).limit(1);

      if (!recentSignals || recentSignals.length === 0) {
        const signal = {
          trading_symbol: topContract.trading_symbol, strike: topContract.strike,
          option_type: topContract.option_type, entry_price: topContract.ltp,
          stop_loss: Number((topContract.ltp * 0.7).toFixed(2)),
          target1: Number((topContract.ltp * 1.3).toFixed(2)),
          target2: Number((topContract.ltp * 1.6).toFixed(2)),
          target3: Number((topContract.ltp * 2.2).toFixed(2)),
          confidence: topContract.confidence, index_name: indexName, mode: mode,
        };
        const { data: insertedSignal } = await supabase.from("signals").insert(signal).select().single();
        newSignals.push(signal);
        topContract.signal = "BUY";

        if (insertedSignal) {
          await supabase.from("trade_results").insert({
            signal_id: insertedSignal.id, outcome: "active", index_name: indexName, mode: mode,
          });
        }
      }
    }

    // Auto-track trade outcomes
    try {
      const { data: activeTrades } = await supabase
        .from("trade_results").select("*, signal:signals(*)").eq("outcome", "active");

      if (activeTrades && activeTrades.length > 0) {
        for (const trade of activeTrades) {
          const sig = (trade as any).signal;
          if (!sig) continue;
          const matchingContract = allContracts.find(c => c.trading_symbol === sig.trading_symbol);
          const currentLtp = matchingContract?.ltp;
          if (currentLtp === undefined) continue;

          const entryPrice = sig.entry_price;
          const stopLoss = sig.stop_loss;
          const target1 = sig.target1;
          const safeExitPrice = entryPrice + (target1 - entryPrice) * 0.5;

          let outcome: string | null = null;
          let exitPrice: number | null = null;
          let pnl: number | null = null;

          if (currentLtp <= stopLoss) {
            outcome = "fail"; exitPrice = stopLoss; pnl = stopLoss - entryPrice;
          } else if (currentLtp >= target1) {
            outcome = "pass"; exitPrice = target1; pnl = target1 - entryPrice;
          } else if (currentLtp >= safeExitPrice && currentLtp < target1) {
            outcome = "safe_exit"; exitPrice = currentLtp; pnl = currentLtp - entryPrice;
          }

          if (outcome) {
            await supabase.from("trade_results").update({
              outcome, exit_price: exitPrice, pnl, resolved_at: new Date().toISOString(),
            }).eq("id", trade.id);
          }
        }
      }
    } catch (e) {
      console.error("Trade tracking error:", e);
    }

    const { data: signalHistory } = await supabase
      .from("signals").select("*").order("created_at", { ascending: false }).limit(10);

    const maxPain = allContracts[0]?.max_pain || atmStrike;
    const selectedExpiry = expiryDate.toISOString().split("T")[0];

    const responseData = {
      contracts: allContracts.slice(0, 20),
      nifty_price: indexName === "NIFTY" ? spotPrice : 0,
      sensex_price: indexName === "SENSEX" ? spotPrice : 0,
      pcr, signals: signalHistory || [], new_signals: newSignals,
      total_contracts: allContracts.length, atm_strike: atmStrike,
      expiry_dates: getExpiryDates(indexName), max_pain: maxPain,
      index_name: indexName, selected_expiry: selectedExpiry, is_monthly: monthlyExpiry,
      support_resistance: srLevels,
      candle_data: candleSets,
      chart_patterns: chartPatterns,
      candlestick_patterns: candlestickPatterns,
      oi_analysis: oiAnalysis,
      strike_sr: strikeSR,
    };

    // Cache
    const cacheId = `${indexName}_${mode}`;
    try {
      await supabase.from("last_scan_cache").upsert({
        id: cacheId, index_name: indexName, mode, scan_data: responseData, cached_at: new Date().toISOString(),
      }, { onConflict: "id" });
    } catch (e) { console.error("Cache save error:", e); }

    return new Response(JSON.stringify(responseData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Scanner error:", error);
    return new Response(
      JSON.stringify({ error: String(error), contracts: [], nifty_price: 0, pcr: 0, signals: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
