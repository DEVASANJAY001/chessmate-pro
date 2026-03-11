import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CandleChart } from "./CandleChart";
import { BarChart3 } from "lucide-react";
import type { CandleSet, SupportResistanceLevel, Signal, ChartPattern, CandlestickPattern } from "@/types/scanner";

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

  const currentCandleSet = candleSets.find(cs => cs.timeframe === activeTimeframe);
  const currentSRLevels = srLevels.filter(l => l.timeframe === activeTimeframe);

  // Only show patterns on 5min (they're detected from 5min candles)
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
          </CardTitle>
          <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setActiveTimeframe(tf.value)}
                className={`px-2.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  activeTimeframe === tf.value
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
        {currentCandleSet && currentCandleSet.candles.length > 0 ? (
          <CandleChart
            candles={currentCandleSet.candles}
            srLevels={currentSRLevels}
            signals={signals}
            chartPatterns={showPatterns ? chartPatterns : []}
            candlestickPatterns={showPatterns ? candlestickPatterns : []}
            timeframe={activeTimeframe}
            height={340}
          />
        ) : (
          <div className="flex items-center justify-center h-[340px] text-muted-foreground text-[11px]">
            No chart data available. Data loads during market hours.
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
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[9px] text-primary">Signal</span>
          </div>
          {hasPatterns && (
            <>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border border-success/40 bg-success/10" />
                <span className="text-[9px] text-success">Bullish Pattern</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border border-danger/40 bg-danger/10" />
                <span className="text-[9px] text-danger">Bearish Pattern</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border border-accent/40 bg-accent/10" />
                <span className="text-[9px] text-accent">Candle Pattern</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
