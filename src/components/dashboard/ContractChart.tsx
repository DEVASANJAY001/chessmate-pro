import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CandleChart } from "./CandleChart";
import { Loader2 } from "lucide-react";
import type { CandleData, SupportResistanceLevel } from "@/types/scanner";

interface ContractChartProps {
  instrumentToken: number;
  tradingSymbol: string;
  strike: number;
  spotPrice: number;
}

type Timeframe = "1min" | "5min" | "15min";

const intervalMap: Record<Timeframe, string> = {
  "1min": "minute",
  "5min": "5minute",
  "15min": "15minute",
};

export function ContractChart({ instrumentToken, tradingSymbol, strike, spotPrice }: ContractChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("5min");
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [srLevels, setSrLevels] = useState<SupportResistanceLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContractCandles() {
      setLoading(true);
      try {
        const token = instrumentToken > 0 ? String(instrumentToken) : "256265";
        const params = new URLSearchParams({
          instrument_token: token,
          interval: intervalMap[timeframe],
          days: "3",
        });

        const { data: result, error: fnError } = await supabase.functions.invoke(
          `fetch-candles?${params.toString()}`
        );

        if (fnError || !result?.candles || result.candles.length === 0) {
          console.error("Contract chart error:", fnError || result?.error);
          setCandles([]);
          setLoading(false);
          return;
        }

        const parsed: CandleData[] = result.candles;
        setCandles(parsed);

        // Calculate S/R from this contract's candles
        const supports: number[] = [];
        const resistances: number[] = [];
        const lookback = 3;
        for (let i = lookback; i < parsed.length - lookback; i++) {
          let isLow = true, isHigh = true;
          for (let j = 1; j <= lookback; j++) {
            if (parsed[i].low >= parsed[i - j].low || parsed[i].low >= parsed[i + j].low) isLow = false;
            if (parsed[i].high <= parsed[i - j].high || parsed[i].high <= parsed[i + j].high) isHigh = false;
          }
          if (isLow) supports.push(parsed[i].low);
          if (isHigh) resistances.push(parsed[i].high);
        }

        const levels: SupportResistanceLevel[] = [];
        const cluster = (prices: number[], type: "support" | "resistance") => {
          if (prices.length === 0) return [];
          const sorted = [...prices].sort((a, b) => a - b);
          const clusters: number[][] = [];
          let current = [sorted[0]];
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] - sorted[i - 1] <= 2) {
              current.push(sorted[i]);
            } else {
              clusters.push(current);
              current = [sorted[i]];
            }
          }
          if (current.length > 0) clusters.push(current);
          return clusters.map(c => ({
            price: Number((c.reduce((a, b) => a + b, 0) / c.length).toFixed(2)),
            strength: c.length,
          })).sort((a, b) => b.strength - a.strength).slice(0, 3);
        };

        if (supports.length > 0) {
          for (const s of cluster(supports, "support")) {
            levels.push({ timeframe, level_type: "support", price: s.price, strength: s.strength });
          }
        }
        if (resistances.length > 0) {
          for (const r of cluster(resistances, "resistance")) {
            levels.push({ timeframe, level_type: "resistance", price: r.price, strength: r.strength });
          }
        }
        setSrLevels(levels);
      } catch (e) {
        console.error("Contract chart error:", e);
      }
      setLoading(false);
    }

    fetchContractCandles();
  }, [instrumentToken, timeframe]);

  const timeframes: { value: Timeframe; label: string }[] = [
    { value: "1min", label: "1M" },
    { value: "5min", label: "5M" },
    { value: "15min", label: "15M" },
  ];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-medium">{tradingSymbol} Chart</span>
        <div className="flex gap-0.5 bg-secondary rounded p-0.5">
          {timeframes.map(tf => (
            <button
              key={tf.value}
              onClick={(e) => { e.stopPropagation(); setTimeframe(tf.value); }}
              className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors ${
                timeframe === tf.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[180px]">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : candles.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-muted-foreground text-[11px]">
          No candle data available
        </div>
      ) : (
        <CandleChart
          candles={candles}
          srLevels={srLevels}
          signals={[]}
          timeframe={timeframe}
          height={180}
        />
      )}
    </div>
  );
}
