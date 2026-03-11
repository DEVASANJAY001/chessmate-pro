import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OptionContract } from "@/types/scanner";
import { TrendingUp, Shield, Target } from "lucide-react";

interface BestContractCardProps {
  contract: OptionContract | null;
}

export function BestContractCard({ contract }: BestContractCardProps) {
  if (!contract) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Best Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Waiting for data...</p>
        </CardContent>
      </Card>
    );
  }

  const confidenceColor =
    contract.confidence >= 75
      ? "text-success"
      : contract.confidence >= 50
      ? "text-warning"
      : "text-danger";

  const entry = contract.ltp;
  const sl = (entry * 0.7).toFixed(2);
  const t1 = (entry * 1.3).toFixed(2);
  const t2 = (entry * 1.6).toFixed(2);
  const t3 = (entry * 2.2).toFixed(2);

  return (
    <Card className={`border-primary/30 bg-card ${contract.volume_burst ? "animate-pulse-glow" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            #1 Ranked Contract
          </CardTitle>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
              {contract.option_type}
            </Badge>
            {contract.volume_burst && (
              <Badge className="text-[10px] bg-warning text-accent-foreground animate-pulse">
                BURST
              </Badge>
            )}
            {contract.signal && (
              <Badge className="text-[10px] bg-success text-primary-foreground">
                {contract.signal}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-lg font-bold text-foreground">{contract.trading_symbol}</p>
            <p className="text-xs text-muted-foreground">Strike: {contract.strike}</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-black tabular-nums ${confidenceColor}`}>
              {contract.confidence}%
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Confidence</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" /> Entry
            </div>
            <span className="font-bold text-foreground tabular-nums">₹{entry.toFixed(2)}</span>
          </div>
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" /> SL
            </div>
            <span className="font-bold text-danger tabular-nums">₹{sl}</span>
          </div>
          <div className="bg-secondary rounded p-2 col-span-2">
            <div className="text-muted-foreground mb-1">Targets</div>
            <div className="flex justify-between">
              <span className="font-bold text-success tabular-nums">T1: ₹{t1}</span>
              <span className="font-bold text-success tabular-nums">T2: ₹{t2}</span>
              <span className="font-bold text-success tabular-nums">T3: ₹{t3}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 text-[10px]">
          <div className="text-center">
            <div className="text-muted-foreground">Vol</div>
            <div className="font-bold tabular-nums">{(contract.volume / 1000).toFixed(0)}K</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">OI</div>
            <div className="font-bold tabular-nums">{(contract.oi / 1000).toFixed(0)}K</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">IV</div>
            <div className="font-bold tabular-nums">{contract.iv.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">LTP</div>
            <div className="font-bold tabular-nums">₹{contract.ltp.toFixed(2)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
