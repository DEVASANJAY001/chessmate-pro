import type { CandleData, ChartPattern, CandlestickPattern, SupportResistanceLevel, CandleSet, PredictionResult, Signal } from "@/types/scanner";

/**
 * 1. INDICATOR ENGINE (VWAP, VOLUME, RSI, EMA)
 */
export function calculateVWAP(candles: CandleData[]) {
  if (candles.length === 0) return [];
  let cumulativePV = 0;
  let cumulativeV = 0;
  return candles.map(c => {
    cumulativePV += ((c.high + c.low + c.close) / 3) * c.volume;
    cumulativeV += c.volume;
    return cumulativePV / (cumulativeV || 1);
  });
}

export function findSwingPoints(candles: CandleData[], window: number = 3, minMovePercent: number = 0.0005) {
  const highs: { index: number; price: number; type: "HH" | "LH" | "TOP" }[] = [];
  const lows: { index: number; price: number; type: "LL" | "HL" | "BOTTOM" }[] = [];

  for (let i = window; i < candles.length - window; i++) {
    const current = candles[i];
    let isHigh = true, isLow = true;

    for (let j = 1; j <= window; j++) {
      if (candles[i - j].high >= current.high || candles[i + j].high > current.high) isHigh = false;
      if (candles[i - j].low <= current.low || candles[i + j].low < current.low) isLow = false;
    }

    if (isHigh) {
      const last = highs[highs.length - 1];
      // Filter by min move
      if (!last || Math.abs(current.high - last.price) / last.price >= minMovePercent) {
        highs.push({ index: i, price: current.high, type: last ? (current.high > last.price ? "HH" : "LH") : "TOP" });
      }
    }
    if (isLow) {
      const last = lows[lows.length - 1];
      // Filter by min move
      if (!last || Math.abs(current.low - last.price) / last.price >= minMovePercent) {
        lows.push({ index: i, price: current.low, type: last ? (current.low < last.price ? "LL" : "HL") : "BOTTOM" });
      }
    }
  }
  return { highs, lows };
}

/**
 * 2. ADVANCED SCALPING PATTERN DETECTION
 */
export function detectScalpPatterns(candles: CandleData[]): ChartPattern[] {
  const patterns: ChartPattern[] = [];
  // Use a localized window for pattern detection (last 25 candles)
  const windowSize = 25;
  const activeCandles = candles.slice(-windowSize);
  const offset = Math.max(0, candles.length - windowSize);

  const { highs, lows } = findSwingPoints(activeCandles, 2, 0.0005); // Very low for intraday
  if (highs.length < 2 || lows.length < 2) return [];

  // Adjust indices to global candle indices
  const h = highs.map(pt => ({ ...pt, index: pt.index + offset }));
  const l = lows.map(pt => ({ ...pt, index: pt.index + offset }));

  const lastC = candles[candles.length - 1];
  const lastH = h[h.length - 1], lastL = l[l.length - 1];
  const prevH = h[h.length - 2], prevL = l[l.length - 2];

  const isNear = (p1: number, p2: number) => Math.abs(p1 - p2) / p2 < 0.003; // Widened from 0.1% to 0.3%

  // 1. Double Top / Bottom (Localized)
  if (isNear(lastH.price, prevH.price) && lastH.index - prevH.index < 20) {
    patterns.push({
      type: "double_top", confidence: 85, points: [prevH, lastH],
      label: "Double Top", description: "Resistance Rejection", bias: "BEARISH"
    });
  }
  if (isNear(lastL.price, prevL.price) && lastL.index - prevL.index < 20) {
    patterns.push({
      type: "double_bottom", confidence: 85, points: [prevL, lastL],
      label: "Double Bottom", description: "Support Bounce", bias: "BULLISH"
    });
  }

  // 2. Flags (Localized)
  const spikeWindow = activeCandles.slice(-15);
  const spikeMove = spikeWindow[spikeWindow.length - 1].close - spikeWindow[0].close;
  const isConsolidating = Math.abs(lastH.price - lastL.price) < Math.abs(spikeMove) * 0.5;

  if (isConsolidating && Math.abs(spikeMove) > lastC.close * 0.001) {
    if (spikeMove > 0 && lastC.close < lastH.price) {
      patterns.push({
        type: "bull_flag", confidence: 80, points: [prevH, prevL, lastH, lastL],
        label: "Bull Flag", description: "Consolidation before breakout", bias: "BULLISH"
      });
    } else if (spikeMove < 0 && lastC.close > lastL.price) {
      patterns.push({
        type: "bear_flag", confidence: 80, points: [prevL, prevH, lastL, lastH],
        label: "Bear Flag", description: "Consolidation before breakdown", bias: "BEARISH"
      });
    }
  }

  // 3. Ascending / Descending Triangles
  if (isNear(lastH.price, prevH.price) && lastL.price > prevL.price + (lastC.close * 0.0005)) {
    patterns.push({
      type: "ascending_triangle", confidence: 82, points: [prevL, prevH, lastL, lastH],
      label: "Asc Triangle", description: "Rising support", bias: "BULLISH"
    });
  }
  if (isNear(lastL.price, prevL.price) && lastH.price < prevH.price - (lastC.close * 0.0005)) {
    patterns.push({
      type: "descending_triangle", confidence: 82, points: [prevH, prevL, lastH, lastL],
      label: "Desc Triangle", description: "Lower highs", bias: "BEARISH"
    });
  }

  // 4. Head and Shoulders / Inverse H&S (Complex localized)
  if (h.length >= 3) {
    const [h1, h2, h3] = h.slice(-3);
    if (h2.price > h1.price && h2.price > h3.price && isNear(h1.price, h3.price)) {
      patterns.push({
        type: "head_and_shoulders", confidence: 88, points: [h1, h2, h3],
        label: "H&S", description: "Reversal pattern", bias: "BEARISH"
      });
    }
  }
  if (l.length >= 3) {
    const [l1, l2, l3] = l.slice(-3);
    if (l2.price < l1.price && l2.price < l3.price && isNear(l1.price, l3.price)) {
      patterns.push({
        type: "inverse_head_and_shoulders", confidence: 88, points: [l1, l2, l3],
        label: "Inv. H&S", description: "Bullish reversal", bias: "BULLISH"
      });
    }
  }

  // 5. Rectangle Consolidation
  if (h.length >= 2 && l.length >= 2) {
    if (isNear(h[h.length - 1].price, h[h.length - 2].price) && isNear(l[l.length - 1].price, l[l.length - 2].price)) {
      patterns.push({
        type: "rectangle", confidence: 75, points: [l[l.length - 2], h[h.length - 2], l[l.length - 1], h[h.length - 1]],
        label: "Rectangle", description: "Sideways channel", bias: "NEUTRAL"
      });
    }
  }

  // 6. Breakdown / Breakout Detection (Real-time trigger)
  if (isNear(lastL.price, prevL.price) && lastC.close < lastL.price - (lastC.close * 0.0005)) {
    patterns.push({
      type: "breakout_retest", confidence: 90, points: [prevL, lastL, { index: candles.length - 1, price: lastC.close }],
      label: "BREAKDOWN", description: "Support broken", bias: "BEARISH"
    });
  } else if (isNear(lastH.price, prevH.price) && lastC.close > lastH.price + (lastC.close * 0.0005)) {
    patterns.push({
      type: "breakout_retest", confidence: 90, points: [prevH, lastH, { index: candles.length - 1, price: lastC.close }],
      label: "BREAKOUT", description: "Resistance broken", bias: "BULLISH"
    });
  }

  return patterns;
}

/**
 * 3. MICRO STRUCTURE & CANDLESTICKS
 */
export function detectMicroPatterns(candles: CandleData[]): CandlestickPattern[] {
  const patterns: CandlestickPattern[] = [];
  const c = candles[candles.length - 1], prev = candles[candles.length - 2];
  if (!c || !prev) return [];
  const body = Math.abs(c.close - c.open), range = Math.max(c.high - c.low, 0.001);

  if (body < range * 0.1) {
    patterns.push({ index: candles.length - 1, timestamp: c.timestamp, type: "doji", bias: "NEUTRAL", description: "Indecision" });
  }

  if (body < range * 0.3 && (c.open - c.low) > body * 2 && (c.high - c.close) < body * 0.5) {
    patterns.push({ index: candles.length - 1, timestamp: c.timestamp, type: "hammer", bias: "BULLISH", description: "Support bounce" });
  }
  if (body < range * 0.3 && (c.high - c.open) > body * 2 && (c.close - c.low) < body * 0.5) {
    patterns.push({ index: candles.length - 1, timestamp: c.timestamp, type: "shooting_star", bias: "BEARISH", description: "Resistance rejection" });
  }

  if (prev.close < prev.open && c.close > c.open && c.open < prev.close && c.close > prev.open) {
    patterns.push({ index: candles.length - 1, timestamp: c.timestamp, type: "bullish_engulfing", bias: "BULLISH", description: "Strong reversal" });
  }
  if (prev.close > prev.open && c.close < c.open && c.open > prev.close && c.close < prev.open) {
    patterns.push({ index: candles.length - 1, timestamp: c.timestamp, type: "bearish_engulfing", bias: "BEARISH", description: "Strong reversal" });
  }

  return patterns;
}

/**
 * 4. SCALPING PREDICTION ENGINE
 */
export function predictScalpMove(candles: CandleData[], srLevels: SupportResistanceLevel[]): PredictionResult {
  const vwap = calculateVWAP(candles);
  const lastVWAP = vwap[vwap.length - 1];
  const lastC = candles[candles.length - 1];
  const volAvg = candles.slice(-20).reduce((a, b) => a + b.volume, 0) / 20;

  const patterns = detectScalpPatterns(candles);
  const microPatterns = detectMicroPatterns(candles);

  let score = 0;
  const reasons: string[] = [];

  // 1. VWAP Bias
  if (lastC.close > lastVWAP) { score += 1; reasons.push("Above VWAP"); }
  else { score -= 1; reasons.push("Below VWAP"); }

  // 2. Volume Spike
  if (lastC.volume > volAvg * 1.5) { score += (lastC.close > lastC.open ? 1.5 : -1.5); reasons.push("VOL SPIKE"); }

  // 3. Patterns
  patterns.forEach(p => {
    let multiplier = 1;
    if (p.type === "breakout_retest") multiplier = 4; // High weight for breakouts
    if (p.type === "bull_flag" || p.type === "bear_flag") multiplier = 2;

    if (p.bias === "BULLISH") score += 3 * multiplier;
    if (p.bias === "BEARISH") score -= 3 * multiplier;
    reasons.push(p.label);
  });
  microPatterns.forEach(p => {
    if (p.bias === "BULLISH") score += 1;
    if (p.bias === "BEARISH") score -= 1;
    reasons.push(p.type.toUpperCase());
  });

  // 4. S/R Rejection
  const nearSupport = srLevels.some(l => (l.level_type.includes("sup") && Math.abs(lastC.close - l.price) / l.price < 0.002));
  const nearResistance = srLevels.some(l => (l.level_type.includes("res") && Math.abs(lastC.close - l.price) / l.price < 0.002));
  if (nearSupport && lastC.close > lastC.open) { score += 2; reasons.push("S/R Bounce"); }
  if (nearResistance && lastC.close < lastC.open) { score -= 2; reasons.push("S/R Rejection"); }

  const nextMove = score >= 2.0 ? "UP" : score <= -2.0 ? "DOWN" : "SIDEWAYS";
  const confidence = Math.min(Math.abs(score) * 20 + 20, 99);

  return {
    next_move: nextMove as "UP" | "DOWN" | "SIDEWAYS",
    confidence: Math.round(confidence),
    reason: reasons.slice(-2).join(" + ") || "Consolidation",
    layers: {
      structure: nearSupport || nearResistance ? "S/R Heavy" : "Normal",
      patterns: patterns.length > 0 ? "Pattern Match" : "None",
      candles: microPatterns.length > 0 ? "PA Action" : "Neutral",
      indicators: lastC.volume > volAvg * 1.5 ? "High Momentum" : "Steady"
    }
  };
}

export function generateScalpSignals(candles: CandleData[], prediction: PredictionResult): Signal[] {
  if (prediction.confidence < 60 || prediction.next_move === "SIDEWAYS") return [];
  const last = candles[candles.length - 1];
  const price = last.close;
  const isBuy = prediction.next_move === "UP";

  // dynamic risk calculations
  let slPercent = 0.0025; // Default 0.25%
  let t1Percent = 0.0030; // 0.3%
  let t2Percent = 0.0060; // 0.6%
  let t3Percent = 0.0100; // 1.0%

  // If signal is from a breakdown/breakout pattern, adjust levels
  const reason = prediction.reason;
  if (reason.includes("BREAK") || reason.includes("FLAG")) {
    slPercent = 0.0020; // Tighter SL for confirmed breakouts
    t1Percent = 0.0040; // Wider T1 for breakouts
  }

  const slOffset = price * slPercent;
  const t1Offset = price * t1Percent;
  const t2Offset = price * t2Percent;
  const t3Offset = price * t3Percent;

  return [{
    id: `SCALP-${last.timestamp}`,
    trading_symbol: "SCAN",
    type: isBuy ? "BUY" : "SELL",
    option_type: isBuy ? "CE" : "PE",
    strike: 0,
    price: price,
    entry_price: price,
    stop_loss: isBuy ? price - slOffset : price + slOffset,
    target1: isBuy ? price + t1Offset : price - t1Offset,
    target2: isBuy ? price + t2Offset : price - t2Offset,
    target3: isBuy ? price + t3Offset : price - t3Offset,
    reason: prediction.reason,
    confidence: prediction.confidence,
    timestamp: last.timestamp,
    created_at: new Date().toISOString()
  }];
}

export function autoDetectPatterns(candles: CandleData[]): ChartPattern[] {
  return detectScalpPatterns(candles);
}

export function generateTrendLines(candles: CandleData[]) {
  if (candles.length < 10) return [];
  const lookback = Math.min(candles.length, 80);
  const slice = candles.slice(-lookback);
  const offset = candles.length - lookback;
  const { highs, lows } = findSwingPoints(slice, 2, 0.0003); // Very low for trend detection

  const trendLines: { start: { index: number; price: number }; end: { index: number; price: number }; color: string; label: string }[] = [];

  // Support trend line (connecting lows)
  if (lows.length >= 2) {
    trendLines.push({
      start: { index: lows[lows.length - 2].index + offset, price: lows[lows.length - 2].price },
      end: { index: lows[lows.length - 1].index + offset, price: lows[lows.length - 1].price },
      color: 'hsl(142, 70%, 50%)',
      label: 'SUPPORT'
    });
  }

  // Resistance trend line (connecting highs)
  if (highs.length >= 2) {
    trendLines.push({
      start: { index: highs[highs.length - 2].index + offset, price: highs[highs.length - 2].price },
      end: { index: highs[highs.length - 1].index + offset, price: highs[highs.length - 1].price },
      color: 'hsl(0, 72%, 55%)',
      label: 'RESISTANCE'
    });
  }

  // If we have 3+ swing highs, also draw a longer trend line
  if (highs.length >= 3) {
    trendLines.push({
      start: { index: highs[highs.length - 3].index + offset, price: highs[highs.length - 3].price },
      end: { index: highs[highs.length - 1].index + offset, price: highs[highs.length - 1].price },
      color: 'hsl(0, 60%, 45%)',
      label: 'TREND'
    });
  }
  if (lows.length >= 3) {
    trendLines.push({
      start: { index: lows[lows.length - 3].index + offset, price: lows[lows.length - 3].price },
      end: { index: lows[lows.length - 1].index + offset, price: lows[lows.length - 1].price },
      color: 'hsl(142, 50%, 40%)',
      label: 'TREND'
    });
  }

  return trendLines;
}

export function mergeSRLevels(levels: SupportResistanceLevel[], thresholdPercent: number = 0.001) {
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const merged: SupportResistanceLevel[] = [];
  let currentGroup: SupportResistanceLevel[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevPrice = currentGroup[currentGroup.length - 1].price;
    if ((sorted[i].price - prevPrice) / prevPrice < thresholdPercent) {
      currentGroup.push(sorted[i]);
    } else {
      const avgPrice = currentGroup.reduce((sum, l) => sum + l.price, 0) / currentGroup.length;
      merged.push({ ...currentGroup[0], price: avgPrice });
      currentGroup = [sorted[i]];
    }
  }
  const avgPrice = currentGroup.reduce((sum, l) => sum + l.price, 0) / currentGroup.length;
  merged.push({ ...currentGroup[0], price: avgPrice });
  return merged;
}

export function scanHistoricalSignals(candles: CandleData[], srLevels: SupportResistanceLevel[]): Signal[] {
  if (candles.length < 20) return [];
  const signals: Signal[] = [];

  // Generate signals more aggressively - every 5 candles check for a setup
  for (let i = 15; i < candles.length; i += 5) {
    const window = candles.slice(0, i + 1);
    const pred = predictScalpMove(window, srLevels);

    if (pred.confidence >= 50 && pred.next_move !== "SIDEWAYS") {
      const lastC = window[window.length - 1];
      const isBuy = pred.next_move === "UP";
      const price = lastC.close;

      const slOffset = price * 0.0025;
      const t1Offset = price * 0.0030;
      const t2Offset = price * 0.0060;
      const t3Offset = price * 0.0100;

      signals.push({
        id: `HIST-${lastC.timestamp}-${i}`,
        trading_symbol: "HIST SCAN",
        type: isBuy ? "BUY" : "SELL",
        option_type: isBuy ? "CE" : "PE",
        strike: 0,
        price: price,
        entry_price: price,
        stop_loss: isBuy ? price - slOffset : price + slOffset,
        target1: isBuy ? price + t1Offset : price - t1Offset,
        target2: isBuy ? price + t2Offset : price - t2Offset,
        target3: isBuy ? price + t3Offset : price - t3Offset,
        reason: pred.reason,
        confidence: pred.confidence,
        timestamp: lastC.timestamp,
        created_at: new Date(lastC.timestamp).toISOString()
      });
    }
  }
  return signals;
}

export function scanHistoricalPatterns(candles: CandleData[]): ChartPattern[] {
  if (candles.length < 20) return [];
  const allPatterns: ChartPattern[] = [];
  const seenKeys = new Set<string>();

  // Scan every 3 candles for patterns
  for (let i = 15; i < candles.length; i += 3) {
    const window = candles.slice(0, i + 1);
    const patterns = detectScalpPatterns(window);

    patterns.forEach(p => {
      const lastPt = p.points[p.points.length - 1];
      const key = `${p.type}-${lastPt.index}`;
      if (!seenKeys.has(key)) {
        allPatterns.push(p);
        seenKeys.add(key);
      }
    });
  }
  return allPatterns;
}

export function correlateTimeframes(candleSets: CandleSet[]): { bias: string; summary: string } | null {
  if (!candleSets || candleSets.length === 0) return null;

  let bullishCount = 0;
  let bearishCount = 0;
  let totalCount = 0;

  candleSets.forEach(set => {
    if (!set.candles || set.candles.length < 2) return;
    const last = set.candles[set.candles.length - 1];
    const prev = set.candles[set.candles.length - 2];

    totalCount++;
    if (last.close > prev.close) bullishCount++;
    else if (last.close < prev.close) bearishCount++;
  });

  if (totalCount === 0) return null;

  const bias = bullishCount > bearishCount ? "BULLISH" : bearishCount > bullishCount ? "BEARISH" : "NEUTRAL";
  const summary = `${bullishCount}/${totalCount} TFs Bullish`;

  return { bias, summary };
}
