import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Layers, Activity } from "lucide-react";
import type { OIAnalysis, StrikeSR } from "@/types/scanner";

interface OIAnalysisPanelProps {
  oiAnalysis: OIAnalysis[];
  strikeSR: StrikeSR[];
  spotPrice: number;
}

const INTERPRETATION_CONFIG: Record<string, { label: string; color: string; icon: "up" | "down"; bias: string }> = {
  long_buildup: { label: "Long Buildup", color: "text-success", icon: "up", bias: "Bullish" },
  short_buildup: { label: "Short Buildup", color: "text-danger", icon: "down", bias: "Bearish" },
  short_covering: { label: "Short Covering", color: "text-success", icon: "up", bias: "Bullish" },
  long_unwinding: { label: "Long Unwinding", color: "text-danger", icon: "down", bias: "Bearish" },
};

export function OIAnalysisPanel({ oiAnalysis, strikeSR, spotPrice }: OIAnalysisPanelProps) {
  const hasData = oiAnalysis.length > 0 || strikeSR.length > 0;

  // Count interpretations
  const counts = oiAnalysis.reduce(
    (acc, oi) => {
      acc[oi.interpretation] = (acc[oi.interpretation] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const bullishCount = (counts.long_buildup || 0) + (counts.short_covering || 0);
  const bearishCount = (counts.short_buildup || 0) + (counts.long_unwinding || 0);
  const overallBias = bullishCount > bearishCount ? "BULLISH" : bearishCount > bullishCount ? "BEARISH" : "NEUTRAL";

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-1 px-3 pt-3">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-info" />
          OI Analysis & Strike S/R
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {!hasData ? (
          <p className="text-[11px] text-muted-foreground">No OI data available. Updates during market hours.</p>
        ) : (
          <>
            {/* Overall OI Bias */}
            {oiAnalysis.length > 0 && (
              <div className="flex items-center justify-between bg-secondary rounded-md px-3 py-2">
                <span className="text-[10px] text-muted-foreground">OI Bias</span>
                <Badge
                  className={`text-[10px] ${
                    overallBias === "BULLISH"
                      ? "bg-success text-primary-foreground"
                      : overallBias === "BEARISH"
                      ? "bg-danger text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {overallBias} ({bullishCount}B / {bearishCount}S)
                </Badge>
              </div>
            )}

            {/* OI Interpretation Summary */}
            {oiAnalysis.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Top OI Changes</span>
                <div className="mt-1.5 space-y-1">
                  {oiAnalysis.slice(0, 8).map((oi, i) => {
                    const config = INTERPRETATION_CONFIG[oi.interpretation];
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {config.icon === "up" ? (
                            <ArrowUp className={`h-3 w-3 ${config.color}`} />
                          ) : (
                            <ArrowDown className={`h-3 w-3 ${config.color}`} />
                          )}
                          <span className="text-foreground font-medium">{oi.strike}</span>
                          <Badge
                            variant="outline"
                            className={`text-[8px] px-1 py-0 ${
                              oi.option_type === "CE" ? "border-success/30 text-success" : "border-danger/30 text-danger"
                            }`}
                          >
                            {oi.option_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[8px] px-1 py-0 ${config.color} border-current/30`}>
                            {config.label}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground tabular-nums">
                            OI: {oi.oi_change > 0 ? "+" : ""}{(oi.oi_change / 1000).toFixed(1)}K
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Strike S/R from Options Chain */}
            {strikeSR.length > 0 && (
              <div className="border-t border-border pt-2">
                <div className="flex items-center gap-1 mb-1.5">
                  <Layers className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                    Major Strike Levels (Max OI)
                  </span>
                </div>
                <div className="space-y-1">
                  {strikeSR.map((sr, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className={`font-bold tabular-nums ${
                        sr.type === "support" ? "text-success" : sr.type === "resistance" ? "text-danger" : "text-primary"
                      }`}>
                        ₹{sr.strike}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-success tabular-nums">CE: {(sr.ce_oi / 1000).toFixed(0)}K</span>
                        <span className="text-[9px] text-danger tabular-nums">PE: {(sr.pe_oi / 1000).toFixed(0)}K</span>
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 ${
                          sr.type === "support" ? "border-success/30 text-success" : sr.type === "resistance" ? "border-danger/30 text-danger" : "border-primary/30 text-primary"
                        }`}>
                          {sr.type.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {spotPrice > 0 && (
                  <div className="flex items-center gap-2 py-1 mt-1 border-t border-dashed border-primary/30">
                    <span className="text-[10px] text-muted-foreground">SPOT</span>
                    <span className="text-[11px] font-bold text-primary tabular-nums">₹{spotPrice.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
