import { useMemo, useState } from "react";
import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Customized,
} from "recharts";
import type { CandleData, SupportResistanceLevel, Signal, ChartPattern, CandlestickPattern } from "@/types/scanner";

interface CandleChartProps {
  candles: CandleData[];
  srLevels?: SupportResistanceLevel[];
  signals?: Signal[];
  chartPatterns?: ChartPattern[];
  candlestickPatterns?: CandlestickPattern[];
  timeframe: string;
  height?: number;
}

interface ChartCandle {
  time: string;
  fullTime: string;
  index: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  range: [number, number];
  body: [number, number];
  bullish: boolean;
  hasSignal: boolean;
  candlePatternType?: string;
  candlePatternBias?: string;
  timestamp: Date;
}

const PATTERN_LABELS: Record<string, string> = {
  double_top: "DT",
  double_bottom: "DB",
  ascending_triangle: "AT",
  descending_triangle: "DT",
  bull_flag: "BF",
  bear_flag: "BrF",
  head_and_shoulders: "H&S",
  inverse_head_and_shoulders: "IH&S",
};

const CANDLE_PATTERN_ICONS: Record<string, string> = {
  hammer: "🔨",
  inverted_hammer: "⬆",
  bullish_engulfing: "🟢",
  bearish_engulfing: "🔴",
  doji: "✚",
  shooting_star: "⭐",
  morning_star: "🌅",
  evening_star: "🌆",
};

export function CandleChart({
  candles, srLevels = [], signals = [], chartPatterns = [], candlestickPatterns = [],
  timeframe, height = 280,
}: CandleChartProps) {
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number; payload: any } | null>(null);
  
  // Panning and Zooming State
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number } | null>(null);
  const isDragging = useRef(false);
  const lastMouseX = useRef(0);

  const candlePatternMap = useMemo(() => {
    const map = new Map<number, CandlestickPattern>();
    for (const cp of candlestickPatterns) {
      map.set(cp.index, cp);
    }
    return map;
  }, [candlestickPatterns]);

  // Initial and dynamic range handling
  const chartDataTotal = useMemo(() => {
    if (!candles || candles.length === 0) return [];

    const signalTimes = new Set(
      signals.map(s => {
        const d = new Date(s.created_at);
        return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
      })
    );

    return candles.map((c, idx) => {
      const d = new Date(c.timestamp);
      const timeStr = formatTime(d);
      const bullish = c.close >= c.open;
      const cp = candlePatternMap.get(idx);

      return {
        time: timeStr,
        fullTime: `${d.getDate()} ${formatMonth(d.getMonth())} '26 ${timeStr}`,
        index: idx,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        timestamp: d,
        range: [c.low, c.high] as [number, number],
        body: bullish ? [c.open, c.close] as [number, number] : [c.close, c.open] as [number, number],
        bullish,
        hasSignal: signalTimes.has(timeStr),
        candlePatternType: cp?.type,
        candlePatternBias: cp?.bias,
      };
    });
  }, [candles, signals, candlePatternMap]);

  // Update visible range when data grows
  useEffect(() => {
     if (chartDataTotal.length > 0 && !visibleRange) {
        // Initial view: show last 60 candles
        const end = chartDataTotal.length;
        const start = Math.max(0, end - 60);
        setVisibleRange({ start, end });
     } else if (chartDataTotal.length > 0 && visibleRange) {
        // If we were at the end, stay at the end
        if (visibleRange.end >= chartDataTotal.length - 1) {
            const diff = chartDataTotal.length - visibleRange.end;
            if (diff > 0) {
               setVisibleRange(prev => prev ? { start: prev.start + diff, end: prev.end + diff } : null);
            }
        }
     }
  }, [chartDataTotal.length]);

  const chartData = useMemo(() => {
    if (!visibleRange) return chartDataTotal.slice(-60);
    return chartDataTotal.slice(Math.floor(visibleRange.start), Math.ceil(visibleRange.end));
  }, [chartDataTotal, visibleRange]);

  const lastPrice = chartDataTotal.length > 0 ? chartDataTotal[chartDataTotal.length - 1].close : 0;
  const isLastBullish = chartDataTotal.length > 0 ? chartDataTotal[chartDataTotal.length - 1].bullish : true;

  const { minPrice, maxPrice } = useMemo(() => {
    if (chartData.length === 0) return { minPrice: 0, maxPrice: 100 };
    const allLows = chartData.map(c => c.low);
    const allHighs = chartData.map(c => c.high);
    const srPrices = srLevels.map(l => l.price);
    const min = Math.min(...allLows, ...srPrices);
    const max = Math.max(...allHighs, ...srPrices);
    const padding = (max - min) * 0.1;
    return { minPrice: min - padding, maxPrice: max + padding };
  }, [chartData, srLevels]);

  // Interaction Handlers
  const onMouseDown = (e: any) => {
    isDragging.current = true;
    lastMouseX.current = e.chartX;
  };

  const onMouseMove = (state: any) => {
    if (isDragging.current && state.chartX && visibleRange) {
        const deltaX = lastMouseX.current - state.chartX;
        const dataLength = chartDataTotal.length;
        const visibleCount = visibleRange.end - visibleRange.start;
        // Sensitivity based on chart width (approx)
        const moveAmount = (deltaX / 800) * visibleCount; 
        
        let newStart = visibleRange.start + moveAmount;
        let newEnd = visibleRange.end + moveAmount;

        // Boundaries
        if (newStart < 0) {
            newEnd -= newStart;
            newStart = 0;
        }
        if (newEnd > dataLength) {
            newStart -= (newEnd - dataLength);
            newEnd = dataLength;
        }

        setVisibleRange({ start: newStart, end: newEnd });
        lastMouseX.current = state.chartX;
    }

    if (state.isTooltipActive) {
      setCrosshairPos({
        x: state.chartX,
        y: state.chartY,
        payload: state.activePayload?.[0]?.payload,
      });
    } else {
      setCrosshairPos(null);
    }
  };

  const onMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!visibleRange) return;
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const center = (visibleRange.start + visibleRange.end) / 2;
    const halfWidth = ((visibleRange.end - visibleRange.start) * zoomFactor) / 2;
    
    let newStart = center - halfWidth;
    let newEnd = center + halfWidth;

    // Minimum zoom (5 candles)
    if (newEnd - newStart < 5) return;

    // Boundaries
    if (newStart < 0) newStart = 0;
    if (newEnd > chartDataTotal.length) newEnd = chartDataTotal.length;

    setVisibleRange({ start: newStart, end: newEnd });
  };

  const CrosshairRenderer = (props: any) => {
    const { viewBox } = props;
    if (!crosshairPos || !viewBox) return null;

    const { x, y, payload } = crosshairPos;
    const { width, height: viewHeight } = viewBox;

    return (
      <g>
        {/* Horizontal Line */}
        <line
          x1={viewBox.x}
          y1={y}
          x2={viewBox.x + width}
          y2={y}
          stroke="#555"
          strokeDasharray="3 3"
          pointerEvents="none"
        />
        {/* Vertical Line */}
        <line
          x1={x}
          y1={viewBox.y}
          x2={x}
          y2={viewBox.y + viewHeight}
          stroke="#555"
          strokeDasharray="3 3"
          pointerEvents="none"
        />
        {/* Price Tag (Right) */}
        <g transform={`translate(${viewBox.x + width}, ${y - 10})`}>
          <rect width={55} height={20} fill="#333" rx={2} />
          <text x={27} y={14} textAnchor="middle" fill="#fff" fontSize={9} fontWeight="bold">
             {calculatePriceFromY(y, viewBox.y, viewHeight, minPrice, maxPrice).toFixed(1)}
          </text>
        </g>
        {/* Time Tag (Bottom) */}
        {payload && (
          <g transform={`translate(${x - 35}, ${viewBox.y + viewHeight})`}>
            <rect width={70} height={20} fill="#000" rx={2} />
            <text x={35} y={14} textAnchor="middle" fill="#fff" fontSize={9}>
              {payload.time}
            </text>
          </g>
        )}
      </g>
    );
  };

  const CandleShape = (props: any) => {
    const { x, width, payload } = props;
    if (!payload) return null;

    const { open, high, low, close, bullish } = payload;
    
    // Y Positioning logic inside shape based on global min/max
    const getYScaling = (price: number) => {
        const h = height - 40; // Approx height available for candles
        return 10 + (1 - (price - minPrice) / (maxPrice - minPrice)) * h;
    };

    const cx = x + width / 2;
    const candleWidth = Math.max(3, width * 0.8);
    
    const yOpen = getYScaling(open);
    const yClose = getYScaling(close);
    const yHigh = getYScaling(high);
    const yLow = getYScaling(low);

    const bodyTop = Math.min(yOpen, yClose);
    const bodyBottom = Math.max(yOpen, yClose);
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

    const color = bullish ? "#26a69a" : "#ef5350";
    const { hasSignal, candlePatternType, candlePatternBias } = payload;

    return (
      <g>
        <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
        <rect
          x={cx - candleWidth / 2}
          y={bodyTop}
          width={candleWidth}
          height={bodyHeight}
          fill={color}
          stroke={color}
        />
        {/* Signal marker */}
        {hasSignal && (
          <g>
            <circle cx={cx} cy={yHigh - 8} r={3} fill="#00bcd4" />
            <text x={cx} y={yHigh - 13} textAnchor="middle" fill="#00bcd4" fontSize={7} fontWeight="bold">
              S
            </text>
          </g>
        )}
        {/* Candlestick pattern marker */}
        {candlePatternType && (
          <g>
            <text
              x={cx}
              y={candlePatternBias === "BEARISH" ? yHigh - 14 : yLow + 22}
              textAnchor="middle"
              fontSize={8}
            >
              {CANDLE_PATTERN_ICONS[candlePatternType] || "●"}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Chart pattern overlay renderer
  const PatternOverlays = (props: any) => {
    const { xAxisMap, yAxisMap } = props;
    if (!xAxisMap || !yAxisMap || chartPatterns.length === 0) return null;

    const xAxis = Object.values(xAxisMap)[0] as any;
    const yAxis = Object.values(yAxisMap)[0] as any;
    if (!xAxis || !yAxis) return null;

    return (
      <g>
        {chartPatterns.map((pattern, i) => {
          const startIdx = Math.max(0, pattern.start_index);
          const endIdx = Math.min(chartData.length - 1, pattern.end_index);

          if (startIdx >= chartData.length || endIdx < 0) return null;

          const bandWidth = xAxis.bandSize || (xAxis.width / chartData.length);
          const x1 = xAxis.x + startIdx * bandWidth;
          const x2 = xAxis.x + (endIdx + 1) * bandWidth;

          const isBullish = pattern.bias === "BULLISH";
          const fillColor = isBullish ? "#26a69a" : "#ef5350";
          const label = PATTERN_LABELS[pattern.type] || pattern.type;

          const patternCandles = chartData.slice(startIdx, endIdx + 1);
          const patternHigh = Math.max(...patternCandles.map(c => c.high));
          const patternLow = Math.min(...patternCandles.map(c => c.low));

          const getYScaling = (price: number) => {
             const h = height - 40;
             return 10 + (1 - (price - minPrice) / (maxPrice - minPrice)) * h;
          };

          const regionTop = getYScaling(patternHigh);
          const regionBottom = getYScaling(patternLow);
          const midX = (x1 + x2) / 2;

          return (
            <g key={`pattern-${i}`}>
              <rect
                x={x1}
                y={regionTop - 4}
                width={Math.max(4, x2 - x1)}
                height={Math.max(4, regionBottom - regionTop + 8)}
                fill={fillColor}
                fillOpacity={0.06}
                stroke={fillColor}
                strokeOpacity={0.3}
                strokeWidth={1}
                strokeDasharray="4 2"
                rx={3}
              />
              <text
                x={midX}
                y={regionTop - 8}
                textAnchor="middle"
                fill={fillColor}
                fontSize={7}
                fontWeight="bold"
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div 
      className="bg-[#0B0D14] rounded-sm overflow-hidden border border-border/10 select-none" 
      style={{ height }}
      onWheel={handleWheel}
      onDoubleClick={() => setVisibleRange(null)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 60, bottom: 20, left: 0 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            setCrosshairPos(null);
            onMouseUp();
          }}
        >
          <CartesianGrid stroke="#1F222D" vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#787B86", fontSize: 9 }}
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis
            orientation="right"
            domain={[minPrice, maxPrice]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#787B86", fontSize: 10 }}
            tickFormatter={(v) => v.toFixed(0)}
            width={50}
          />
          <Tooltip content={<div className="hidden" />} cursor={false} />

          {/* S/R Lines */}
          {srLevels.map((lvl, i) => (
             <ReferenceLine
                key={i}
                y={lvl.price}
                stroke={lvl.level_type === "support" ? "#089981" : "#F23645"}
                strokeDasharray="2 2"
                strokeOpacity={0.4}
                label={{ 
                    position: 'left', 
                    value: lvl.level_type === "support" ? `S` : `R`, 
                    fill: lvl.level_type === "support" ? "#089981" : "#F23645",
                    fontSize: 10 
                }}
             />
          ))}

          {/* Last Price Line */}
          <ReferenceLine
            y={lastPrice}
            stroke={isLastBullish ? "#26a69a" : "#ef5350"}
            strokeDasharray="2 2"
            label={{
              position: "right",
              value: lastPrice.toFixed(2),
              fill: "#fff",
              fontSize: 10,
              fontWeight: "bold",
              background: isLastBullish ? "#26a69a" : "#ef5350",
              className: "price-badge"
            }}
          />

          <Bar
            dataKey="body"
            shape={<CandleShape />}
            isAnimationActive={false}
          />

          <Customized component={PatternOverlays} />
          <Customized component={CrosshairRenderer} />
        </ComposedChart>
      </ResponsiveContainer>
      <style>{`
        .price-badge tspan {
           background: inherit;
           padding: 2px 4px;
        }
      `}</style>
    </div>
  );
}

// Helper Functions
function formatTime(d: Date) {
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatMonth(m: number) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[m];
}

function calculatePriceFromY(y: number, viewY: number, viewHeight: number, min: number, max: number) {
    const normalizedY = 1 - (y - viewY) / viewHeight;
    return min + normalizedY * (max - min);
}
