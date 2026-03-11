import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OptionContract } from "@/types/scanner";
import { Flame, TrendingUp, TrendingDown, BarChart3, Clock, Droplets, Zap, Target, ShieldAlert } from "lucide-react";

interface HeroZeroCardProps {
  contract: OptionContract | null;
  spotPrice: number;
}

function calcTargets(ltp: number) {
  return {
    entry: ltp,
    sl: +(ltp * 0.65).toFixed(2),
    t1: +(ltp * 1.5).toFixed(2),
    t2: +(ltp * 2.0).toFixed(2),
    t3: +(ltp * 3.0).toFixed(2),
  };
}

export function HeroZeroCard({ contract, spotPrice }: HeroZeroCardProps) {
  if (!contract) {
    return (
      <Card className="border-border bg-card col-span-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-warning" />
            Hero Zero – Best Pick
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Waiting for data...</p>
        </CardContent>
      </Card>
    );
  }

  const scoreColor =
    (contract.hero_score || 0) >= 70
      ? "text-success"
      : (contract.hero_score || 0) >= 40
      ? "text-warning"
      : "text-danger";

  const t = calcTargets(contract.ltp);

  return (
    <Card className="border-warning/30 bg-card col-span-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-warning" />
            Hero Zero – #1 Pick
          </CardTitle>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
              {contract.option_type}
            </Badge>
            <Badge className="text-[10px] bg-accent text-accent-foreground">
              ₹{contract.ltp.toFixed(2)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-lg font-bold text-foreground">{contract.trading_symbol}</p>
            <p className="text-xs text-muted-foreground">
              Strike: {contract.strike} · {contract.strike_distance !== undefined ? `${contract.strike_distance} strikes from ATM` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-black tabular-nums ${scoreColor}`}>
              {contract.hero_score || 0}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hero Score</p>
          </div>
        </div>

        {/* Entry / SL / Targets */}
        <div className="grid grid-cols-5 gap-1.5 text-xs">
          <div className="bg-primary/10 rounded p-2 text-center">
            <div className="text-muted-foreground flex items-center justify-center gap-1"><Target className="h-3 w-3" />Entry</div>
            <span className="font-bold tabular-nums text-foreground">₹{t.entry.toFixed(2)}</span>
          </div>
          <div className="bg-danger/10 rounded p-2 text-center">
            <div className="text-muted-foreground flex items-center justify-center gap-1"><ShieldAlert className="h-3 w-3" />SL</div>
            <span className="font-bold tabular-nums text-danger">₹{t.sl}</span>
          </div>
          <div className="bg-success/10 rounded p-2 text-center">
            <div className="text-muted-foreground">T1</div>
            <span className="font-bold tabular-nums text-success">₹{t.t1}</span>
          </div>
          <div className="bg-success/10 rounded p-2 text-center">
            <div className="text-muted-foreground">T2</div>
            <span className="font-bold tabular-nums text-success">₹{t.t2}</span>
          </div>
          <div className="bg-success/10 rounded p-2 text-center">
            <div className="text-muted-foreground">T3</div>
            <span className="font-bold tabular-nums text-success">₹{t.t3}</span>
          </div>
        </div>

        {/* ML-Validated Score Breakdown (9 factors) */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground">OI (25%)</div>
            <span className="font-bold tabular-nums text-foreground">
              {(contract.oi / 1000).toFixed(0)}K
            </span>
            {contract.oi_change > 0 && (
              <span className="text-success text-[10px] ml-1">
                +{((contract.oi_change / contract.oi) * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground">IV (20%)</div>
            <span className={`font-bold tabular-nums ${contract.iv > 20 ? "text-warning" : "text-foreground"}`}>
              {contract.iv.toFixed(1)}%
            </span>
          </div>
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground">LTP (25%)</div>
            <span className={`font-bold tabular-nums ${contract.ltp <= 10 ? "text-success" : "text-warning"}`}>
              ₹{contract.ltp.toFixed(2)}
            </span>
          </div>
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Theta (3%)
            </div>
            <span className={`font-bold tabular-nums ${(contract.theta || 0) < -0.5 ? "text-danger" : "text-foreground"}`}>
              {contract.theta !== undefined ? contract.theta.toFixed(3) : "—"}
            </span>
          </div>
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <Droplets className="h-3 w-3" /> Liquidity (4%)
            </div>
            <span className={`font-bold tabular-nums ${(contract.bid_ask_spread || 0) <= 0.5 ? "text-success" : (contract.bid_ask_spread || 0) > 2 ? "text-danger" : "text-foreground"}`}>
              ₹{contract.bid_ask_spread?.toFixed(2) || "—"}
            </span>
          </div>
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" /> GEX (3%)
            </div>
            <span className={`font-bold tabular-nums ${(contract.gamma_exposure || 0) > 0 ? "text-warning" : "text-foreground"}`}>
              {contract.gamma_exposure?.toFixed(1) || "—"}
            </span>
          </div>
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              {spotPrice > (contract.ema20 || 0) ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-danger" />
              )}
              EMA 20 (5%)
            </div>
            <span className="font-bold tabular-nums text-foreground">
              {contract.ema20 ? `₹${contract.ema20.toFixed(0)}` : "—"}
            </span>
          </div>
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> RSI
            </div>
            <span className={`font-bold tabular-nums ${
              (contract.rsi || 50) >= 30 && (contract.rsi || 50) <= 50 ? "text-success" : (contract.rsi || 50) > 70 ? "text-danger" : "text-foreground"
            }`}>
              {contract.rsi?.toFixed(1) || "—"}
            </span>
          </div>
          <div className="bg-secondary rounded p-2">
            <div className="text-muted-foreground">Dist / Max Pain</div>
            <span className="font-bold tabular-nums text-foreground">
              {contract.strike_distance !== undefined ? `${contract.strike_distance}ATM` : "—"}
              <span className="text-info ml-1 text-[10px]">{contract.max_pain || ""}</span>
            </span>
          </div>
        </div>

        {/* PCR / OI Change hint */}
        <div className="text-[10px] text-muted-foreground bg-secondary/50 rounded p-2">
          OI Change: <span className={`font-bold ${contract.oi_change > 0 ? "text-success" : "text-danger"}`}>
            {contract.oi_change > 0 ? "+" : ""}{contract.oi_change.toLocaleString()}
          </span>
          {" · "}Confidence: <span className="font-bold text-foreground">{contract.confidence}%</span>
          {contract.volume_burst && (
            <Badge className="text-[9px] bg-warning/20 text-warning border-warning/30 ml-2">BURST</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
