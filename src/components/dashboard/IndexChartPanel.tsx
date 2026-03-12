import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TradingViewChart } from "./TradingViewChart";
import { BarChart3 } from "lucide-react";
import type { CandleSet, SupportResistanceLevel, Signal, ChartPattern, CandlestickPattern } from "@/types/scanner";
import { useKiteCandles } from "@/hooks/useKiteCandles";
import { MiniChartWindow } from "./MiniChartWindow";
import { MonitorSmartphone } from "lucide-react";

interface IndexChartPanelProps {
  candleSets: CandleSet[];
  srLevels: SupportResistanceLevel[];
  signals: Signal[];
  chartPatterns?: ChartPattern[];
  candlestickPatterns?: CandlestickPattern[];
  indexName: string;
}

type Timeframe = "1min" | "5min" | "15min";

export function IndexChartPanel({ candleSets, srLevels, signals, chartPatterns = [], candlestickPatterns = [], indexName }: IndexChartPanelProps) {
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>("5min");
  const [showMiniChart, setShowMiniChart] = useState(false);

  // Fast direct Kite candle fetch (bypasses heavy scan-options)
  const { candles: kiteCandles, loading: kiteLoading, error: kiteError } = useKiteCandles(
    indexName.toUpperCase().includes("SENSEX") ? "SENSEX" : "NIFTY",
    activeTimeframe,
    1000 // Poll every 1 second
  );

  // Fallback to scanner data if Kite fetch hasn't returned yet
  const fallbackCandleSet = candleSets.find(cs => cs.timeframe === activeTimeframe);
  const chartCandles = kiteCandles.length > 0 ? kiteCandles : (fallbackCandleSet?.candles || []);

  const currentSRLevels = srLevels.filter(l => l.timeframe === activeTimeframe);
  const showPatterns = activeTimeframe === "5min";

  const timeframes: { value: Timeframe; label: string }[] = [
    { value: "1min", label: "1M" },
    { value: "5min", label: "5M" },
    { value: "15min", label: "15M" },
  ];

  const hasPatterns = showPatterns && (chartPatterns.length > 0 || candlestickPatterns.length > 0);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-1 px-3 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            {indexName} Chart — S/R, Signals & Patterns
            {kiteCandles.length > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded bg-green-500/20 text-green-400 text-[8px] font-black flex items-center gap-1 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                KITE LIVE
              </span>
            )}
            {kiteError && (
              <span className="ml-1 px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[8px] font-bold">CACHED</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 bg-secondary rounded-md p-0.5">
            <button
              onClick={() => setShowMiniChart(!showMiniChart)}
              className={`p-1 rounded transition-colors ${showMiniChart ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Mini TV Chart"
            >
              <MonitorSmartphone className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3 bg-white/10 mx-0.5" />
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setActiveTimeframe(tf.value)}
                className={`px-2.5 py-0.5 text-[10px] font-medium rounded transition-colors ${activeTimeframe === tf.value
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {chartCandles.length > 0 ? (
          <div className="relative border rounded-lg overflow-hidden border-white/5">
            <TradingViewChart
              candles={chartCandles}
              srLevels={currentSRLevels}
              signals={signals}
              chartPatterns={showPatterns ? chartPatterns : []}
              timeframe={activeTimeframe}
              height={340}
            />
            {showMiniChart && (
              <MiniChartWindow onClose={() => setShowMiniChart(false)} />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[340px] text-muted-foreground text-[11px]">
            {kiteLoading ? "Loading chart from Kite..." : "No chart data available. Data loads during market hours."}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-1 px-2 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-success" style={{ borderTop: "1px dashed" }} />
            <span className="text-[9px] text-success">Support</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-danger" style={{ borderTop: "1px dashed" }} />
            <span className="text-[9px] text-danger">Resistance</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FFD700' }} />
            <span className="text-[9px]" style={{ color: '#FFD700' }}>Signal</span>
          </div>
          {hasPatterns && (
            <>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border border-success/40 bg-success/10" />
                <span className="text-[9px] text-success">Bullish</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border border-danger/40 bg-danger/10" />
                <span className="text-[9px] text-danger">Bearish</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
