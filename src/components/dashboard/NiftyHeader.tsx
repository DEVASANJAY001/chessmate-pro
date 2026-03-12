import { Activity, Clock, Layers, TrendingUp, TrendingDown, Target, Zap } from "lucide-react";
import type { IndexType, PredictionResult } from "@/types/scanner";
import { useEffect, useState, useRef } from "react";

interface NiftyHeaderProps {
  price: number;
  pcr: number;
  lastUpdate: Date | null;
  atmStrike?: number;
  indexName: IndexType;
  maxPain?: number;
  selectedExpiry?: string;
  isCached?: boolean;
  nLayerStatus?: { bias: string; summary: string } | null;
  prediction?: PredictionResult;
}

export function NiftyHeader({ 
  price, pcr, lastUpdate, atmStrike, indexName, maxPain, selectedExpiry, isCached, nLayerStatus, prediction
}: NiftyHeaderProps) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevPrice = useRef(price);

  useEffect(() => {
    if (price !== prevPrice.current && price > 0 && prevPrice.current > 0) {
      setFlash(price > prevPrice.current ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 1000);
      prevPrice.current = price;
      return () => clearTimeout(timer);
    }
    prevPrice.current = price;
  }, [price]);

  const pcrColor = pcr > 1 ? "text-success" : pcr < 0.7 ? "text-danger" : "text-warning";
  const label = indexName === "SENSEX" ? "SENSEX" : "NIFTY 50";

  return (
    <header className="bg-background/95 backdrop-blur-md border-b border-border/50 px-2 sm:px-4 py-2 sm:py-3 sticky top-0 z-50">
      <div className="flex flex-col sm:flex-row items-center justify-between max-w-[1600px] mx-auto gap-2 sm:gap-4">
        {/* Left: Branding + Spot Price */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:gap-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg sm:rounded-xl border border-primary/20">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-[8px] sm:text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground leading-none mb-0.5 sm:mb-1">
                {label} PRO
              </h1>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <span className={`text-lg sm:text-2xl font-bold tabular-nums leading-none transition-all duration-300 ${
                  flash === "up" ? "text-success scale-105" : 
                  flash === "down" ? "text-danger scale-105" : 
                  "text-foreground"
                }`}>
                  {price > 0 ? `₹${price.toLocaleString("en-IN")}` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Prediction Status (Compact) */}
          {prediction && (
            <div className={`sm:hidden p-1.5 rounded-lg border border-border/60 ${
              prediction.next_move === "UP" ? "bg-success/10 text-success border-success/20" : 
              prediction.next_move === "DOWN" ? "bg-danger/10 text-danger border-danger/20" : "bg-warning/10 text-warning border-warning/20"
            }`}>
              {prediction.next_move === "UP" ? <TrendingUp className="h-4 w-4" /> : 
               prediction.next_move === "DOWN" ? <TrendingDown className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            </div>
          )}

          {/* Desktop Prediction Layer */}
          {prediction && (
            <div className="hidden sm:flex xl:flex items-center gap-4 px-4 py-2 bg-secondary/30 rounded-2xl border border-border/60 hover:border-primary/40 transition-colors group cursor-default">
              <div className={`p-1.5 rounded-lg ${
                prediction.next_move === "UP" ? "bg-success/20 text-success" : 
                prediction.next_move === "DOWN" ? "bg-danger/20 text-danger" : "bg-warning/20 text-warning"
              }`}>
                {prediction.next_move === "UP" ? <TrendingUp className="h-4 w-4" /> : 
                 prediction.next_move === "DOWN" ? <TrendingDown className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
              </div>
              <div className="hidden lg:block">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent animate-pulse">Scalping Signal</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-muted text-foreground ring-1 ring-border">
                    {prediction.confidence}%
                  </span>
                </div>
                <div className="text-xs font-bold flex items-center gap-2">
                  <span className={prediction.next_move === "UP" ? "text-success" : prediction.next_move === "DOWN" ? "text-danger" : "text-warning"}>
                    {prediction.next_move}
                  </span>
                  <span className="text-muted-foreground font-medium text-[10px] truncate max-w-[100px]">• {prediction.reason}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Key Stats */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2 sm:gap-8 border-t sm:border-t-0 sm:border-l border-border/40 pt-2 sm:pt-0 sm:pl-8">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-center">
              <div className="text-[8px] sm:text-[9px] uppercase text-muted-foreground tracking-widest">PCR</div>
              <div className={`text-xs sm:text-sm font-bold tabular-nums ${pcrColor}`}>
                {pcr > 0 ? pcr.toFixed(2) : "—"}
              </div>
            </div>
            {atmStrike && (
              <div className="text-center">
                <div className="text-[8px] sm:text-[9px] uppercase text-muted-foreground tracking-widest">ATM</div>
                <div className="text-xs sm:text-sm font-bold tabular-nums text-foreground">{atmStrike}</div>
              </div>
            )}
            {selectedExpiry && (
              <div className="text-center">
                <div className="text-[8px] sm:text-[9px] uppercase text-muted-foreground tracking-widest">Expiry</div>
                <div className="text-[10px] sm:text-[11px] font-bold text-accent">
                  {new Date(selectedExpiry + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </div>
              </div>
            )}
          </div>
          
          <div className="text-right flex flex-col items-end">
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-muted-foreground tabular-nums uppercase tracking-tighter">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
              {lastUpdate ? lastUpdate.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true }) : "—"}
            </div>
            {isCached && (
              <div className="text-[7px] sm:text-[8px] font-black text-warning uppercase tracking-tighter">DELAYED</div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
