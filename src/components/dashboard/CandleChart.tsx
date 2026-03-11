import { useMemo } from "react";
import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, CartesianGrid, Customized,
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
  // Map candlestick patterns by their index for quick lookup
  const candlePatternMap = useMemo(() => {
    const map = new Map<number, CandlestickPattern>();
    for (const cp of candlestickPatterns) {
      map.set(cp.index, cp);
    }
    return map;
  }, [candlestickPatterns]);

  const chartData = useMemo(() => {
    if (!candles || candles.length === 0) return [];

    const signalTimes = new Set(
      signals.map(s => {
        const d = new Date(s.created_at);
        return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
      })
    );

    return candles.map((c, idx) => {
      const d = new Date(c.timestamp);
      const hh = d.getHours();
      const mm = String(d.getMinutes()).padStart(2, "0");
      const timeStr = `${hh}:${mm}`;
      const dateStr = `${d.getDate()}/${d.getMonth() + 1} ${timeStr}`;
      const bullish = c.close >= c.open;

      const cp = candlePatternMap.get(idx);

      return {
        time: timeStr,
        fullTime: dateStr,
        index: idx,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        range: [c.low, c.high] as [number, number],
        body: bullish ? [c.open, c.close] as [number, number] : [c.close, c.open] as [number, number],
        bullish,
        hasSignal: signalTimes.has(timeStr),
        candlePatternType: cp?.type,
        candlePatternBias: cp?.bias,
      } satisfies ChartCandle;
    });
  }, [candles, signals, candlePatternMap]);

  const { minPrice, maxPrice } = useMemo(() => {
    if (chartData.length === 0) return { minPrice: 0, maxPrice: 100 };
    const allLows = chartData.map(c => c.low);
    const allHighs = chartData.map(c => c.high);
    const srPrices = srLevels.map(l => l.price);
    const min = Math.min(...allLows, ...srPrices);
    const max = Math.max(...allHighs, ...srPrices);
    const padding = (max - min) * 0.08; // extra padding for pattern labels
    return { minPrice: min - padding, maxPrice: max + padding };
  }, [chartData, srLevels]);

  const supports = srLevels.filter(l => l.level_type === "support");
  const resistances = srLevels.filter(l => l.level_type === "resistance");

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-[11px]" style={{ height }}>
        No candle data available
      </div>
    );
  }

  // Custom candle shape with candlestick pattern markers
  const CandleShape = (props: any) => {
    const { x, y, width, payload } = props;
    if (!payload) return null;

    const { open, high, low, close, bullish, hasSignal, candlePatternType, candlePatternBias } = payload;
    const scaleY = (price: number) => {
      const chartHeight = height - 50;
      return 25 + (1 - (price - minPrice) / (maxPrice - minPrice)) * chartHeight;
    };

    const candleWidth = Math.max(2, Math.min(width * 0.7, 8));
    const cx = x + width / 2;
    const bodyTop = scaleY(Math.max(open, close));
    const bodyBottom = scaleY(Math.min(open, close));
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);
    const wickTop = scaleY(high);
    const wickBottom = scaleY(low);

    const fillColor = bullish ? "hsl(var(--success))" : "hsl(var(--danger))";
    const wickColor = bullish ? "hsl(var(--success) / 0.6)" : "hsl(var(--danger) / 0.6)";

    return (
      <g>
        {/* Wick */}
        <line x1={cx} y1={wickTop} x2={cx} y2={wickBottom} stroke={wickColor} strokeWidth={1} />
        {/* Body */}
        <rect
          x={cx - candleWidth / 2}
          y={bodyTop}
          width={candleWidth}
          height={bodyHeight}
          fill={fillColor}
          stroke={fillColor}
          strokeWidth={0.5}
        />
        {/* Signal marker */}
        {hasSignal && (
          <g>
            <circle cx={cx} cy={wickTop - 8} r={3} fill="hsl(var(--primary))" />
            <text x={cx} y={wickTop - 13} textAnchor="middle" fill="hsl(var(--primary))" fontSize={7} fontWeight="bold">
              S
            </text>
          </g>
        )}
        {/* Candlestick pattern marker */}
        {candlePatternType && (
          <g>
            {/* Glow ring */}
            <circle
              cx={cx}
              cy={candlePatternBias === "BEARISH" ? wickTop - 18 : wickBottom + 18}
              r={7}
              fill={candlePatternBias === "BULLISH" ? "hsl(var(--success) / 0.15)" : candlePatternBias === "BEARISH" ? "hsl(var(--danger) / 0.15)" : "hsl(var(--accent) / 0.15)"}
              stroke={candlePatternBias === "BULLISH" ? "hsl(var(--success) / 0.5)" : candlePatternBias === "BEARISH" ? "hsl(var(--danger) / 0.5)" : "hsl(var(--accent) / 0.5)"}
              strokeWidth={1}
            />
            {/* Icon */}
            <text
              x={cx}
              y={candlePatternBias === "BEARISH" ? wickTop - 14 : wickBottom + 22}
              textAnchor="middle"
              fontSize={8}
              fill={candlePatternBias === "BULLISH" ? "hsl(var(--success))" : candlePatternBias === "BEARISH" ? "hsl(var(--danger))" : "hsl(var(--accent))"}
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

          // Calculate pixel positions from the axis scale
          const bandWidth = xAxis.bandSize || (xAxis.width / chartData.length);
          const x1 = xAxis.x + startIdx * bandWidth;
          const x2 = xAxis.x + (endIdx + 1) * bandWidth;
          const yTop = yAxis.y;
          const yBottom = yAxis.y + yAxis.height;

          const isBullish = pattern.bias === "BULLISH";
          const fillColor = isBullish ? "hsl(var(--success))" : "hsl(var(--danger))";
          const label = PATTERN_LABELS[pattern.type] || pattern.type;

          // Find the price range within pattern
          const patternCandles = chartData.slice(startIdx, endIdx + 1);
          const patternHigh = Math.max(...patternCandles.map(c => c.high));
          const patternLow = Math.min(...patternCandles.map(c => c.low));

          const scaleY = (price: number) => {
            const chartHeight = height - 50;
            return 25 + (1 - (price - minPrice) / (maxPrice - minPrice)) * chartHeight;
          };

          const regionTop = scaleY(patternHigh);
          const regionBottom = scaleY(patternLow);
          const midX = (x1 + x2) / 2;

          return (
            <g key={`pattern-${i}`}>
              {/* Shaded region */}
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
                ry={3}
              />
              {/* Top label badge */}
              <rect
                x={midX - 16}
                y={regionTop - 18}
                width={32}
                height={14}
                fill={fillColor}
                fillOpacity={0.15}
                stroke={fillColor}
                strokeOpacity={0.4}
                strokeWidth={0.5}
                rx={3}
                ry={3}
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
              {/* Confidence badge */}
              <text
                x={midX}
                y={regionBottom + 14}
                textAnchor="middle"
                fill={fillColor}
                fillOpacity={0.7}
                fontSize={6}
              >
                {pattern.confidence}%
              </text>
              {/* Boundary markers */}
              <line x1={x1} y1={regionTop - 4} x2={x1} y2={regionBottom + 4} stroke={fillColor} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2 2" />
              <line x1={x2} y1={regionTop - 4} x2={x2} y2={regionBottom + 4} stroke={fillColor} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2 2" />
            </g>
          );
        })}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]?.payload) return null;
    const d = payload[0].payload as ChartCandle;
    return (
      <div className="bg-popover border border-border rounded-md p-2 text-[10px] shadow-lg">
        <p className="text-muted-foreground mb-1">{d.fullTime}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span className="text-muted-foreground">O:</span>
          <span className="tabular-nums font-medium text-foreground">{d.open.toFixed(2)}</span>
          <span className="text-muted-foreground">H:</span>
          <span className="tabular-nums font-medium text-foreground">{d.high.toFixed(2)}</span>
          <span className="text-muted-foreground">L:</span>
          <span className="tabular-nums font-medium text-foreground">{d.low.toFixed(2)}</span>
          <span className="text-muted-foreground">C:</span>
          <span className={`tabular-nums font-bold ${d.bullish ? "text-success" : "text-danger"}`}>
            {d.close.toFixed(2)}
          </span>
        </div>
        {d.hasSignal && (
          <p className="text-primary font-medium mt-1">📍 Signal generated</p>
        )}
        {d.candlePatternType && (
          <p className={`font-medium mt-1 ${
            d.candlePatternBias === "BULLISH" ? "text-success" : d.candlePatternBias === "BEARISH" ? "text-danger" : "text-accent"
          }`}>
            {CANDLE_PATTERN_ICONS[d.candlePatternType]} {d.candlePatternType.replace(/_/g, " ")} ({d.candlePatternBias})
          </p>
        )}
      </div>
    );
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 25, right: 10, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            interval={Math.max(1, Math.floor(chartData.length / 10))}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v.toFixed(0)}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* S/R Reference Lines */}
          {supports.map((s, i) => (
            <ReferenceLine
              key={`s-${i}`}
              y={s.price}
              stroke="hsl(var(--success))"
              strokeDasharray="4 2"
              strokeWidth={s.strength >= 2 ? 1.5 : 1}
              label={{
                value: `S ${s.price.toFixed(0)}`,
                position: "left",
                fill: "hsl(var(--success))",
                fontSize: 8,
              }}
            />
          ))}
          {resistances.map((r, i) => (
            <ReferenceLine
              key={`r-${i}`}
              y={r.price}
              stroke="hsl(var(--danger))"
              strokeDasharray="4 2"
              strokeWidth={r.strength >= 2 ? 1.5 : 1}
              label={{
                value: `R ${r.price.toFixed(0)}`,
                position: "left",
                fill: "hsl(var(--danger))",
                fontSize: 8,
              }}
            />
          ))}

          {/* Chart pattern overlays */}
          <Customized component={PatternOverlays} />

          {/* Invisible bars that trigger tooltip + position candle shapes */}
          <Bar dataKey="high" fill="transparent" shape={<CandleShape />} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
