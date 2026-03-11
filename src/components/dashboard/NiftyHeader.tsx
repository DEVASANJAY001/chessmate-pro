import { Activity, Calendar, Clock } from "lucide-react";
import type { IndexType } from "@/types/scanner";

interface NiftyHeaderProps {
  price: number;
  pcr: number;
  lastUpdate: Date | null;
  atmStrike?: number;
  indexName: IndexType;
  maxPain?: number;
  selectedExpiry?: string;
  isCached?: boolean;
}

export function NiftyHeader({ price, pcr, lastUpdate, atmStrike, indexName, maxPain, selectedExpiry, isCached }: NiftyHeaderProps) {
  const pcrColor = pcr > 1 ? "text-success" : pcr < 0.7 ? "text-danger" : "text-warning";
  const label = indexName === "SENSEX" ? "SENSEX" : "NIFTY 50";

  const formatTime = (date: Date) => {
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <header className="border-b border-border px-3 py-2.5">
      {/* Top Row: Logo + Price */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary shrink-0" />
          <div>
            <h1 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground leading-none">
              Smart Option Selector
            </h1>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-foreground tabular-nums leading-none">
                {price > 0 ? `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
              </span>
              <span className="text-[10px] text-muted-foreground">{label}</span>
              {isCached && (
                <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium">
                  CACHED
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Time */}
        <div className="text-right">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
            <Clock className="h-3 w-3" />
            {lastUpdate ? formatTime(lastUpdate) : "—"}
          </div>
        </div>
      </div>

      {/* Bottom Row: Stats */}
      <div className="flex items-center gap-3 mt-2 overflow-x-auto scrollbar-none">
        <div className="flex flex-col items-center shrink-0">
          <span className="text-[9px] uppercase text-muted-foreground tracking-wider">PCR</span>
          <span className={`text-sm font-bold tabular-nums ${pcrColor}`}>
            {pcr > 0 ? pcr.toFixed(2) : "—"}
          </span>
        </div>
        {atmStrike && (
          <div className="flex flex-col items-center shrink-0">
            <span className="text-[9px] uppercase text-muted-foreground tracking-wider">ATM</span>
            <span className="text-sm font-bold tabular-nums text-foreground">{atmStrike}</span>
          </div>
        )}
        {selectedExpiry && (
          <div className="flex flex-col items-center shrink-0">
            <span className="text-[9px] uppercase text-muted-foreground tracking-wider">Expiry</span>
            <span className="text-[11px] font-bold tabular-nums text-accent">
              {new Date(selectedExpiry + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" })}
            </span>
          </div>
        )}
        {maxPain && maxPain > 0 && (
          <div className="flex flex-col items-center shrink-0">
            <span className="text-[9px] uppercase text-muted-foreground tracking-wider">Max Pain</span>
            <span className="text-sm font-bold tabular-nums text-info">{maxPain}</span>
          </div>
        )}
      </div>
    </header>
  );
}
