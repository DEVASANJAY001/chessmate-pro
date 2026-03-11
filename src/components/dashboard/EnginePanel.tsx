import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, TrendingUp, TrendingDown, Shield, Zap, Target,
  CheckCircle2, XCircle, Clock, Activity, ArrowUpRight, ArrowDownRight,
  Copy, Check
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { EngineMode, EngineResponse, EngineState, FlowStep, IndexType } from "@/types/scanner";

const MODE_INFO: Record<EngineMode, { label: string; icon: typeof Shield; color: string; desc: string }> = {
  institutional: { label: "Institutional", icon: Shield, color: "text-info", desc: "3-6 trades • High quality • Volatility expansion required" },
  scalping: { label: "Scalping", icon: Zap, color: "text-warning", desc: "6-10 trades • 3min candles • Quick exits" },
  conservative: { label: "Conservative", icon: Target, color: "text-success", desc: "2-5 trades • Sniper mode • All conditions must pass" },
};

function isMarketOpen(): boolean {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay();
  const t = ist.getHours() * 60 + ist.getMinutes();
  return day >= 1 && day <= 5 && t >= 540 && t <= 930;
}

export function EnginePanel({ indexType = "NIFTY" }: { indexType?: IndexType }) {
  const [engineMode, setEngineMode] = useState<EngineMode>("institutional");
  const [data, setData] = useState<EngineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ index: indexType, mode: engineMode });
      const { data: result, error: fnError } = await supabase.functions.invoke(
        `scan-options?${params.toString()}`
      );
      if (fnError) { setError(fnError.message); return; }
      if (result?.error && !result?.engine_state) {
        setError(result.error);
        return;
      }
      setError(null);
      setData(result as EngineResponse);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [indexType, engineMode]);

  const fetchCached = useCallback(async () => {
    try {
      const cacheId = `${indexType}_${engineMode}`;
      const { data: cached } = await supabase
        .from("last_scan_cache")
        .select("*")
        .eq("id", cacheId)
        .maybeSingle();
      if (cached?.scan_data) {
        setData(cached.scan_data as unknown as EngineResponse);
        setError(null);
      } else {
        setError("No cached data. Engine will update when market opens.");
      }
    } catch { setError("Failed to load cached data."); }
    finally { setLoading(false); }
  }, [indexType, engineMode]);

  useEffect(() => {
    setLoading(true);
    if (isMarketOpen()) {
      fetchData();
      intervalRef.current = setInterval(() => {
        if (isMarketOpen()) fetchData();
        else { if (intervalRef.current) clearInterval(intervalRef.current); fetchCached(); }
      }, 3000);
    } else {
      fetchCached();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData, fetchCached]);

  const state = data?.engine_state;
  const flowSteps = data?.flow_steps || [];

  function copySignal(s: any) {
    const time = new Date(s.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    const safeTradePrice = (s.entry_price + (s.target1 - s.entry_price) * 0.5).toFixed(2);
    const text = `🚨 TRADE ALERT 🚨\n\n📊 ${s.trading_symbol}\n\n⏰ Time: ${time}\n\n💰 Entry: ₹${s.entry_price.toFixed(2)}\n🛑 SL: ₹${s.stop_loss.toFixed(2)}\n\n🟢 Safe Trade: ₹${safeTradePrice}\n🎯 T1: ₹${s.target1.toFixed(2)}\n\n⚡ Follow SL strictly\n📈 Book profits as per levels\nTrade disciplined.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(s.id);
      toast({ title: "Copied!", description: "Trade alert copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="space-y-3">
      {/* Mode Selector */}
      <div className="flex gap-1.5">
        {(Object.keys(MODE_INFO) as EngineMode[]).map((m) => {
          const info = MODE_INFO[m];
          const Icon = info.icon;
          return (
            <button
              key={m}
              onClick={() => { setEngineMode(m); setLoading(true); }}
              className={`flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all border ${
                engineMode === m
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/20"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${engineMode === m ? info.color : ""}`} />
              {info.label}
            </button>
          );
        })}
      </div>

      {/* Mode Description */}
      <p className="text-[10px] text-muted-foreground px-1">{MODE_INFO[engineMode].desc}</p>

      {error && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-2">
            <p className="text-[11px] text-warning">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : state ? (
        <>
          {/* Engine State Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card className="border-border bg-card">
              <CardContent className="p-2.5">
                <p className="text-[9px] text-muted-foreground mb-0.5">Bias</p>
                <div className="flex items-center gap-1">
                  {state.market_bias === "BULLISH" ? (
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  ) : state.market_bias === "BEARISH" ? (
                    <ArrowDownRight className="h-4 w-4 text-danger" />
                  ) : (
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={`text-sm font-bold ${
                    state.market_bias === "BULLISH" ? "text-success" : state.market_bias === "BEARISH" ? "text-danger" : "text-muted-foreground"
                  }`}>{state.market_bias}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-2.5">
                <p className="text-[9px] text-muted-foreground mb-0.5">Volatility</p>
                <span className={`text-sm font-bold ${
                  state.volatility_regime === "EXPANDING" ? "text-success" : state.volatility_regime === "CONTRACTING" ? "text-danger" : "text-warning"
                }`}>{state.volatility_regime}</span>
                <p className="text-[9px] text-muted-foreground">ATR {state.atr_rising ? "↑ Rising" : "— Flat"}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-2.5">
                <p className="text-[9px] text-muted-foreground mb-0.5">Trades</p>
                <span className="text-sm font-bold text-foreground">{state.daily_trades}/{state.max_trades}</span>
                <p className="text-[9px] text-muted-foreground">Losses: {state.consecutive_losses}/{state.max_consecutive_losses}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-2.5">
                <p className="text-[9px] text-muted-foreground mb-0.5">Status</p>
                {state.can_trade ? (
                  <Badge className="bg-success text-primary-foreground text-[10px]">READY</Badge>
                ) : (
                  <Badge className="bg-danger text-primary-foreground text-[10px]">NO TRADE</Badge>
                )}
                {state.no_trade_reason && (
                  <p className="text-[9px] text-danger mt-0.5">{state.no_trade_reason}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* EMA Structure */}
          <Card className="border-border bg-card">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Spot: <span className="text-foreground font-medium tabular-nums">{state.spot_price.toFixed(2)}</span></span>
                <span className="text-muted-foreground">EMA9: <span className="font-medium tabular-nums">{state.ema_structure.ema9.toFixed(1)}</span></span>
                <span className="text-muted-foreground">EMA20: <span className="font-medium tabular-nums">{state.ema_structure.ema20.toFixed(1)}</span></span>
                <span className="text-muted-foreground">EMA50: <span className="font-medium tabular-nums">{state.ema_structure.ema50.toFixed(1)}</span></span>
                <span className="text-muted-foreground">RSI: <span className={`font-medium tabular-nums ${state.rsi > 70 ? "text-danger" : state.rsi < 30 ? "text-success" : ""}`}>{state.rsi.toFixed(1)}</span></span>
              </div>
              {state.opening_range && (
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span>Opening Range: <span className="text-success font-medium">{state.opening_range.high.toFixed(1)}</span> – <span className="text-danger font-medium">{state.opening_range.low.toFixed(1)}</span></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signal Flow */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-1 px-3 pt-3">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Signal Flow Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-1">
                {flowSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    {step.passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-danger shrink-0" />
                    )}
                    <span className={`font-medium ${step.passed ? "text-foreground" : "text-muted-foreground"}`}>{step.name}</span>
                    <span className="text-muted-foreground ml-auto text-[10px] tabular-nums">{step.detail}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Engine Signals */}
          {data?.signals && data.signals.length > 0 && (
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="pb-1 px-3 pt-3">
                <CardTitle className="text-xs text-success flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Engine Signals ({data.signals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {data.signals.map((s: any) => (
                  <div key={s.id} className="bg-secondary rounded p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge className={`text-[9px] ${s.option_type === "CE" ? "bg-success" : "bg-danger"} text-primary-foreground`}>
                          {s.direction} {s.option_type}
                        </Badge>
                        <span className="font-medium text-foreground">{s.trading_symbol}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-info text-primary-foreground text-[9px]">R:R {s.risk_reward?.toFixed(1)}</Badge>
                        <button onClick={() => copySignal(s)} className="p-0.5 rounded hover:bg-primary/10 transition-colors" title="Copy">
                          {copiedId === s.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between text-muted-foreground tabular-nums">
                      <span>Entry: ₹{s.entry_price?.toFixed(2)}</span>
                      <span className="text-danger">SL: ₹{s.stop_loss?.toFixed(2)}</span>
                      <span className="text-success">T1: ₹{s.target1?.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{s.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* When to use guide */}
          <Card className="border-border bg-card">
            <CardContent className="p-2.5">
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                {engineMode === "institutional" && "📊 Best for: Strong trend days. Requires volatility expansion + opening range breakout."}
                {engineMode === "scalping" && "⚡ Best for: Fast moving expiry days. 3-min candles, quick exits. Avoid flat/range-bound markets."}
                {engineMode === "conservative" && "🛡 Best for: Uncertain/mixed markets. ALL conditions must pass. Max 5 trades, first half of session only."}
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
