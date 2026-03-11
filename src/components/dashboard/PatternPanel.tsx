import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, CandlestickChart } from "lucide-react";
import type { ChartPattern, CandlestickPattern } from "@/types/scanner";

interface PatternPanelProps {
  chartPatterns: ChartPattern[];
  candlestickPatterns: CandlestickPattern[];
}

const CHART_PATTERN_LABELS: Record<string, string> = {
  double_top: "Double Top",
  double_bottom: "Double Bottom",
  ascending_triangle: "Ascending Triangle",
  descending_triangle: "Descending Triangle",
  bull_flag: "Bull Flag",
  bear_flag: "Bear Flag",
  head_and_shoulders: "Head & Shoulders",
  inverse_head_and_shoulders: "Inv. H&S",
};

const CANDLE_PATTERN_LABELS: Record<string, string> = {
  hammer: "Hammer",
  inverted_hammer: "Inv. Hammer",
  bullish_engulfing: "Bullish Engulfing",
  bearish_engulfing: "Bearish Engulfing",
  doji: "Doji",
  shooting_star: "Shooting Star",
  morning_star: "Morning Star",
  evening_star: "Evening Star",
};

export function PatternPanel({ chartPatterns, candlestickPatterns }: PatternPanelProps) {
  const hasData = chartPatterns.length > 0 || candlestickPatterns.length > 0;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-1 px-3 pt-3">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-accent" />
          Pattern Detection
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {!hasData ? (
          <p className="text-[11px] text-muted-foreground">No patterns detected. Data updates during market hours.</p>
        ) : (
          <>
            {/* Chart Patterns */}
            {chartPatterns.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <BarChart3 className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Chart Patterns</span>
                </div>
                <div className="space-y-1">
                  {chartPatterns.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-1.5">
                        {p.bias === "BULLISH" ? (
                          <TrendingUp className="h-3 w-3 text-success" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-danger" />
                        )}
                        <span className="text-[11px] font-medium text-foreground">
                          {CHART_PATTERN_LABELS[p.type] || p.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[8px] px-1 py-0 ${
                            p.bias === "BULLISH"
                              ? "border-success/30 text-success"
                              : "border-danger/30 text-danger"
                          }`}
                        >
                          {p.bias}
                        </Badge>
                        <span className={`text-[10px] font-bold tabular-nums ${
                          p.confidence >= 70 ? "text-success" : p.confidence >= 50 ? "text-warning" : "text-danger"
                        }`}>
                          {p.confidence}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Candlestick Patterns */}
            {candlestickPatterns.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <CandlestickChart className="h-3 w-3 text-accent" />
                  <span className="text-[10px] font-medium text-accent uppercase tracking-wider">Candlestick Patterns</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {candlestickPatterns.slice(0, 8).map((p, i) => {
                    const time = new Date(p.timestamp).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <Badge
                        key={i}
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0.5 ${
                          p.bias === "BULLISH"
                            ? "border-success/30 text-success"
                            : p.bias === "BEARISH"
                            ? "border-danger/30 text-danger"
                            : "border-muted-foreground/30 text-muted-foreground"
                        }`}
                      >
                        {CANDLE_PATTERN_LABELS[p.type] || p.type} @ {time}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
