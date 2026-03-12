import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, SeriesMarker, Time, CandlestickSeries, LineSeries } from 'lightweight-charts';
import type { CandleData, SupportResistanceLevel, Signal, ChartPattern } from "@/types/scanner";
import { generateTrendLines, autoDetectPatterns, calculateVWAP, mergeSRLevels, scanHistoricalSignals, scanHistoricalPatterns, findSwingPoints, predictScalpMove, generateScalpSignals } from '@/lib/analysis';
import "@fontsource/jetbrains-mono";

interface TradingViewChartProps {
  candles: CandleData[];
  srLevels?: SupportResistanceLevel[];
  signals?: Signal[];
  chartPatterns?: ChartPattern[];
  timeframe: string;
  height?: number;
}

export function TradingViewChart({
  candles, srLevels = [], signals = [], chartPatterns = [],
  timeframe, height = 300
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const vwapSeriesRef = useRef<any>(null);
  const trendLinesRef = useRef<any[]>([]);
  const patternSeriesRef = useRef<any[]>([]);
  const priceLinesRef = useRef<any[]>([]);
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);
  const [extractedSignal, setExtractedSignal] = useState<Signal | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const lastUpdateRef = useRef<string | null>(null);
  const signalsRef = useRef<Signal[]>([]);
  const isUserPannedRef = useRef<boolean>(false);

  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "hsl(215, 14%, 55%)",
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "hsl(220, 14%, 14%)" },
        horzLines: { color: "hsl(220, 14%, 14%)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      rightPriceScale: { borderColor: "hsl(220, 14%, 18%)", autoScale: true },
      timeScale: {
        borderColor: "hsl(220, 14%, 18%)",
        timeVisible: true,
        tickMarkFormatter: (time: any) => {
          const date = new Date(time * 1000);
          return new Intl.DateTimeFormat('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
          }).format(date);
        },
      },
      localization: {
        locale: 'en-IN',
        timeFormatter: (time: number) => {
          return new Intl.DateTimeFormat('en-IN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
          }).format(new Date(time * 1000));
        }
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(142, 60%, 45%)",
      downColor: "hsl(0, 72%, 55%)",
      borderUpColor: "hsl(142, 60%, 45%)",
      borderDownColor: "hsl(0, 72%, 55%)",
      wickUpColor: "hsl(142, 60%, 45%)",
      wickDownColor: "hsl(0, 72%, 55%)",
    });

    const vwapSeries = chart.addSeries(LineSeries, {
      color: "hsl(43, 96%, 58%)",
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "VWAP",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    vwapSeriesRef.current = vwapSeries;

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    chart.subscribeClick((param) => {
      if (!param.point || !param.time) return; // Don't close on background click

      const clickedTime = param.time as number;
      const sig = signalsRef.current.find(s => {
        const sigTime = Math.floor(new Date(s.timestamp || "").getTime() / 1000);
        return Math.abs(sigTime - clickedTime) <= 300;
      });

      if (sig) {
        setExtractedSignal(prev => (prev?.id === sig.id ? null : sig));
        setPopupPos({ x: param.point.x, y: param.point.y });
      }
    });

    // Detect manual user movement
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const timeScale = chart.timeScale();
      const range = timeScale.getVisibleLogicalRange();
      if (!range || !candles || candles.length === 0) return;

      const lastIndex = candles.length - 1;
      // If user has scrolled away from the right edge (buffer of 5 bars)
      if (range.to < lastIndex - 2) {
        isUserPannedRef.current = true;
      } else {
        isUserPannedRef.current = false;
      }
    });

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current || !candles || candles.length === 0) return;

    // Skip only if data is exactly the same (last timestamp + count + last price)
    const lastC = candles[candles.length - 1];
    const dataKey = `${lastC.timestamp}-${candles.length}-${lastC.close}`;
    if (lastUpdateRef.current === dataKey) return;
    lastUpdateRef.current = dataKey;

    try {
      const formattedData = candles
        .map(c => ({
          time: (new Date(c.timestamp).getTime() / 1000) as Time,
          open: c.open, high: c.high, low: c.low, close: c.close,
        }))
        .filter(d => !isNaN(d.time as number) && typeof d.open === 'number' && typeof d.close === 'number')
        .sort((a, b) => (a.time as number) - (b.time as number));
      seriesRef.current.setData(formattedData);

      // VWAP
      const vwapDataValues = calculateVWAP(candles);
      const vwapData = vwapDataValues
        .map((val, i) => {
          if (!candles[i]) return null;
          return {
            time: (new Date(candles[i].timestamp).getTime() / 1000) as Time,
            value: val
          };
        })
        .filter((d): d is { time: Time; value: number } => d !== null && !isNaN(d.time as number) && typeof d.value === 'number')
        .sort((a, b) => (a.time as number) - (b.time as number));
      vwapSeriesRef.current?.setData(vwapData);

      // ---- CLEANUP OLD PRICE LINES ----
      priceLinesRef.current.forEach(line => {
        try { seriesRef.current?.removePriceLine(line); } catch { }
      });
      priceLinesRef.current = [];

      // ---- S/R LEVELS (as price lines — these WORK) ----
      const mergedLevels = mergeSRLevels(srLevels);
      mergedLevels.forEach(level => {
        if (typeof level.price !== 'number' || isNaN(level.price)) return;
        const type = (level.level_type || "").toLowerCase();
        const isSupport = type.includes("support") || type.includes("sup");
        const line = seriesRef.current?.createPriceLine({
          price: level.price,
          color: isSupport ? "hsl(142, 60%, 45%)" : "hsl(0, 72%, 55%)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: isSupport ? "SUP" : "RES",
        });
        if (line) priceLinesRef.current.push(line);
      });

      // ---- TREND LINES (as price lines connecting swing points) ----
      const { highs: swH, lows: swL } = findSwingPoints(candles, 2, 0.0002); // Even lower threshold

      // Draw swing high trend level
      if (swH.length >= 2) {
        const recentHigh = swH[swH.length - 1];
        const line = seriesRef.current?.createPriceLine({
          price: recentHigh.price,
          color: 'hsl(0, 80%, 60%)',
          lineWidth: 2, // Thicker
          lineStyle: 0, // Solid for main trend
          axisLabelVisible: true,
          title: '▼ RESISTANCE',
        });
        if (line) priceLinesRef.current.push(line);

        // Second swing high for trend
        const prevHigh = swH[swH.length - 2];
        const line2 = seriesRef.current?.createPriceLine({
          price: prevHigh.price,
          color: 'hsla(0, 60%, 50%, 0.5)', // Faded
          lineWidth: 1,
          lineStyle: 1, // Dashed
          axisLabelVisible: false,
          title: '',
        });
        if (line2) priceLinesRef.current.push(line2);
      }

      // Draw swing low trend level
      if (swL.length >= 2) {
        const recentLow = swL[swL.length - 1];
        const line = seriesRef.current?.createPriceLine({
          price: recentLow.price,
          color: 'hsl(142, 80%, 50%)',
          lineWidth: 2, // Thicker
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: '▲ SUPPORT',
        });
        if (line) priceLinesRef.current.push(line);

        const prevLow = swL[swL.length - 2];
        const line2 = seriesRef.current?.createPriceLine({
          price: prevLow.price,
          color: 'hsla(142, 50%, 40%, 0.5)', // Faded
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: false,
          title: '',
        });
        if (line2) priceLinesRef.current.push(line2);
      }

      // ---- MARKERS (patterns + signals) ----
      const markers: SeriesMarker<Time>[] = [];

      // Detect patterns
      const autoPatterns = autoDetectPatterns(candles);
      const histPatterns = scanHistoricalPatterns(candles);
      const allP = [...(chartPatterns || []), ...autoPatterns, ...histPatterns];
      const uniquePMap = new Map();
      allP.forEach(p => {
        const key = `${p.type}-${p.points[p.points.length - 1].index}`;
        if (!uniquePMap.has(key)) uniquePMap.set(key, p);
      });
      const finalPatterns = Array.from(uniquePMap.values());

      // Pattern markers (arrows with labels)
      finalPatterns.forEach(p => {
        if (!p.points || p.points.length < 1) return;
        const color = p.bias === 'BULLISH' ? '#22c55e' : p.bias === 'BEARISH' ? '#ef4444' : '#94a3b8';
        const lastPt = p.points[p.points.length - 1];
        const candle = candles[lastPt.index];
        if (candle) {
          markers.push({
            time: (new Date(candle.timestamp).getTime() / 1000) as Time,
            position: p.bias === 'BULLISH' ? 'belowBar' : 'aboveBar',
            color,
            shape: p.bias === 'BULLISH' ? 'arrowUp' : 'arrowDown',
            text: p.label.toUpperCase(),
            size: 1
          });
        }
      });

      // Signal markers (YELLOW DOTS)
      // 1. Generate live signal from CURRENT candles (Kite) for zero lag
      const currentPred = predictScalpMove(candles, srLevels);
      const liveSignals = generateScalpSignals(candles, currentPred);

      // 2. Combine with historical signals
      const histSignals = scanHistoricalSignals(candles, srLevels);
      const allSignals = [...signals, ...histSignals, ...liveSignals];

      const uniqueSignalsMap = new Map();
      allSignals.forEach(s => {
        const t = Math.floor(new Date(s.timestamp).getTime() / 60000);
        if (!uniqueSignalsMap.has(t) || s.id.startsWith("SCALP")) {
          uniqueSignalsMap.set(t, s);
        }
      });
      const finalSignals = Array.from(uniqueSignalsMap.values());
      signalsRef.current = finalSignals;

      finalSignals.forEach(sig => {
        const t = (new Date(sig.timestamp || lastC.timestamp).getTime() / 1000) as Time;
        if (!isNaN(t as number)) {
          markers.push({
            time: t,
            position: sig.type === 'BUY' ? 'belowBar' : 'aboveBar',
            color: '#FFD700',
            shape: 'circle',
            text: '⚡',
            size: 2
          });
        }
      });

      // Apply all markers at once
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      seriesRef.current.setMarkers(markers);

      // Auto-zoom to current price (last ~100 candles)
      // Only if user hasn't manually moved away
      if (chartRef.current && formattedData.length > 0 && !isUserPannedRef.current) {
        const timeScale = chartRef.current.timeScale();
        const lastIndex = formattedData.length - 1;
        const barsToShow = window.innerWidth < 768 ? 40 : 100;
        timeScale.setVisibleLogicalRange({
          from: lastIndex - barsToShow,
          to: lastIndex + 3,
        });
      }

    } catch (err) { console.error("Chart Render Error:", err); }
  }, [candles, signals, srLevels, chartPatterns]);

  const activeP = [...(chartPatterns || []), ...autoDetectPatterns(candles)].slice(-3);

  return (
    <div className="w-full h-full relative group">
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 pointer-events-none">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-white/10 backdrop-blur-md">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Live Scalp Engine</span>
        </div>
        {/* Active Patterns List (Restored) */}
        <div className="flex flex-col gap-1 mt-0.5">
          {activeP.map((p, i) => (
            <div key={`pat-${i}`} className={`flex items-center gap-2 px-2 py-0.5 rounded bg-black/40 border border-white/5 backdrop-blur-sm`}>
              <span className={`text-[9px] font-black uppercase ${p.bias === 'BULLISH' ? 'text-success' : 'text-danger'}`}>
                {p.bias === 'BULLISH' ? '▲' : '▼'} {p.label}
              </span>
              <span className="text-[8px] text-white/50">{p.confidence}% CONF</span>
            </div>
          ))}
        </div>
        {/* Scalp Signals List */}
        <div className="flex flex-col gap-1.5 mt-1">
          {signals.filter(s => s?.id && s.id.startsWith("SCALP")).slice(-3).map((s) => (
            <div
              key={s.id}
              onClick={() => setExpandedSignalId(expandedSignalId === s.id ? null : s.id)}
              className={`p-2 rounded border backdrop-blur-md pointer-events-auto cursor-pointer transition-all hover:scale-[1.02] ${expandedSignalId === s.id
                ? 'bg-black/80 border-yellow-400/60 shadow-[0_0_20px_rgba(255,215,0,0.3)]'
                : 'bg-black/40 border-white/5 hover:border-yellow-400/40'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full bg-yellow-400 ${expandedSignalId === s.id ? 'animate-pulse' : ''}`} />
                  <span className={`text-[10px] font-bold tracking-tighter ${s.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                    ⚡ {s.type || 'SIGNAL'} {s.option_type || ''}
                  </span>
                </div>
                <span className="text-[8px] text-white/40">{new Date(s.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {expandedSignalId === s.id && (
                <div className="mt-2 border-t border-yellow-400/20 pt-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <div className="flex flex-col">
                      <span className="text-[7px] text-white/40 uppercase font-black">Entry</span>
                      <span className="text-[11px] font-black text-white">₹{(s.entry_price || s.price || 0).toFixed(1)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] text-red-400/60 uppercase font-black">SL</span>
                      <span className="text-[11px] font-black text-red-400">₹{(s.stop_loss || 0).toFixed(1)}</span>
                    </div>
                    <div className="flex flex-col col-span-2 mt-1 px-1.5 py-1 bg-green-900/20 rounded border border-green-500/20">
                      <span className="text-[7px] text-green-400/60 uppercase font-black mb-1">🎯 Targets</span>
                      <div className="flex justify-between items-center">
                        <div className="text-center">
                          <p className="text-[6px] text-white/30 uppercase">T1</p>
                          <p className="text-[9px] font-bold text-green-400">₹{(s.target1 || 0).toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[6px] text-white/30 uppercase">T2</p>
                          <p className="text-[9px] font-bold text-green-400">₹{(s.target2 || 0).toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[6px] text-white/30 uppercase">T3</p>
                          <p className="text-[9px] font-bold text-green-400">₹{(s.target3 || 0).toFixed(1)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[7px] text-white/30 italic truncate max-w-[120px]">{s.reason}</span>
                    <span className="text-[7px] font-bold text-yellow-400 px-1 rounded bg-yellow-400/10">ACTIVE</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {mergeSRLevels(srLevels).slice(0, 3).map((l, i) => (
          <div key={`sr-${i}`} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="text-[8px] font-medium text-white/70 uppercase">
              {l.level_type.includes('support') || l.level_type.includes('sup') ? 'SUP' : 'RES'}: {l.price.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* On-Chart Signal Extraction Popup */}
      {(() => {
        if (!extractedSignal || !popupPos) return null;
        // Find the freshest version of this signal in our current list
        const freshSig = signalsRef.current.find(s => s.id === extractedSignal.id) || extractedSignal;

        return (
          <div
            className="absolute z-50 pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
            style={{
              left: Math.min(Math.max(popupPos.x - 90, 10), (chartContainerRef.current?.clientWidth || 0) - 200),
              top: Math.min(Math.max(popupPos.y - 180, 10), (chartContainerRef.current?.clientHeight || 0) - 220)
            }}
          >
            <div className="bg-black/95 border-2 border-yellow-400/70 backdrop-blur-xl rounded-xl p-3 shadow-[0_0_40px_rgba(255,215,0,0.4)] min-w-[200px]">
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className={`text-xs font-black uppercase tracking-wider ${freshSig.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                    ⚡ {freshSig.type} SIGNAL
                  </div>
                  <div className="text-[9px] text-yellow-400/80 font-bold">{freshSig.confidence}% Confidence</div>
                </div>
                <button
                  onClick={() => setExtractedSignal(null)}
                  className="text-white/40 hover:text-white transition-colors text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Trade Details */}
              <div className="space-y-1.5 border-t border-yellow-400/20 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-white/50 uppercase font-bold">Entry</span>
                  <span className="text-sm font-black text-white">₹{(freshSig.entry_price || freshSig.price || 0).toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-red-400/70 uppercase font-bold">Stop Loss</span>
                  <span className="text-sm font-black text-red-400">₹{(freshSig.stop_loss || 0).toFixed(1)}</span>
                </div>
                <div className="bg-green-900/20 rounded-lg p-2 border border-green-500/20 mt-1">
                  <span className="text-[8px] text-green-400/80 uppercase font-black block mb-1.5">🎯 Targets</span>
                  <div className="flex justify-between text-center gap-2">
                    <div>
                      <p className="text-[7px] text-white/40 uppercase">T1</p>
                      <p className="text-[11px] font-bold text-green-400">₹{(freshSig.target1 || 0).toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[7px] text-white/40 uppercase">T2</p>
                      <p className="text-[11px] font-bold text-green-400">₹{(freshSig.target2 || 0).toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[7px] text-white/40 uppercase">T3</p>
                      <p className="text-[11px] font-bold text-green-400">₹{(freshSig.target3 || 0).toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[8px] text-white/30 italic line-clamp-2">
                {freshSig.reason}
              </div>
            </div>
            {/* Arrow pointing to candle */}
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-yellow-400/70 mx-auto" />
          </div>
        );
      })()}
    </div>
  );
}
