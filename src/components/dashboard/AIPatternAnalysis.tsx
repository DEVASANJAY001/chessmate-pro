import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import type { CandleSet, ChartPattern } from "@/types/scanner";

interface AIPatternAnalysisProps {
  candleSets: CandleSet[];
  indexName: string;
  onPatternsDetected: (patterns: ChartPattern[]) => void;
}

export function AIPatternAnalysis({ candleSets, indexName, onPatternsDetected }: AIPatternAnalysisProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ patterns: ChartPattern[]; summary: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      const candleSet5m = candleSets.find(cs => cs.timeframe === "5min");
      const candleSet1m = candleSets.find(cs => cs.timeframe === "1min");
      const candles = candleSet5m?.candles || candleSet1m?.candles || [];

      if (candles.length < 10) {
        setError("Not enough candle data for AI analysis (need at least 10 candles)");
        setAnalyzing(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("ai-pattern-detect", {
        body: { candles: candles.slice(-60), index_name: indexName },
      });

      if (fnError) {
        setError(fnError.message);
        setAnalyzing(false);
        return;
      }

      if (data?.patterns) {
        const patterns = data.patterns as ChartPattern[];
        setResult({ patterns, summary: data.summary || "" });
        onPatternsDetected(patterns);
      } else {
        setResult({ patterns: [], summary: data?.summary || "No patterns found." });
      }
    } catch (err) {
      setError(String(err));
    }

    setAnalyzing(false);
  };

  return (
    <Card className="border-accent/20 bg-card">
      <CardHeader className="pb-1 px-3 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs text-accent flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            AI Pattern Detection
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-accent/30 text-accent">
              Gemini
            </Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-3 text-[10px] gap-1 border-accent/30 hover:bg-accent/10 text-accent"
            onClick={analyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {analyzing ? "Analyzing..." : "Scan Patterns"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        {error && <p className="text-[10px] text-danger">{error}</p>}

        {!result && !error && !analyzing && (
          <p className="text-[10px] text-muted-foreground">
            Click "Scan Patterns" to use AI to visually analyze candlestick charts and detect patterns like
            head & shoulders, double tops/bottoms, flags, triangles, and more. Detected patterns will be
            overlaid on your charts.
          </p>
        )}

        {result && (
          <div className="space-y-2">
            {result.summary && (
              <p className="text-[10px] text-foreground leading-relaxed">{result.summary}</p>
            )}
            {result.patterns.length > 0 ? (
              <div className="space-y-1">
                {result.patterns.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-1.5">
                      {p.bias === "BULLISH" ? (
                        <TrendingUp className="h-3 w-3 text-success" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-danger" />
                      )}
                      <span className="text-[11px] font-medium text-foreground">
                        {p.type.replace(/_/g, " ")}
                      </span>
                      <Badge variant="outline" className="text-[8px] px-1 py-0 border-accent/30 text-accent">
                        AI
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[8px] px-1 py-0 ${
                          p.bias === "BULLISH" ? "border-success/30 text-success" : "border-danger/30 text-danger"
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
            ) : (
              <p className="text-[10px] text-muted-foreground">No patterns detected by AI.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
