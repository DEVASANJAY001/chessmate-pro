import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OptionContract } from "@/types/scanner";
import { Zap } from "lucide-react";

interface VolumeBurstPanelProps {
  contracts: OptionContract[];
}

export function VolumeBurstPanel({ contracts }: VolumeBurstPanelProps) {
  const burstContracts = contracts.filter((c) => c.volume_burst);

  return (
    <Card className="border-warning/20 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-warning" />
          Volume Bursts
          {burstContracts.length > 0 && (
            <Badge className="text-[10px] bg-warning text-accent-foreground ml-2">
              {burstContracts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {burstContracts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No volume bursts detected</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-auto">
            {burstContracts.map((c) => (
              <div
                key={c.trading_symbol}
                className="flex items-center justify-between bg-warning/5 border border-warning/10 rounded px-2.5 py-1.5 animate-burst"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      c.option_type === "CE"
                        ? "border-success/40 text-success"
                        : "border-danger/40 text-danger"
                    }`}
                  >
                    {c.option_type}
                  </Badge>
                  <span className="text-xs font-medium">{c.strike}</span>
                </div>
                <div className="flex items-center gap-2 text-xs tabular-nums">
                  <span className="text-warning font-bold">{c.confidence}%</span>
                  <span className="text-muted-foreground">₹{c.ltp.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
