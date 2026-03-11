import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, ShieldCheck, BarChart3 } from "lucide-react";

type TimePeriod = "today" | "week" | "month" | "all";
type IndexFilter = "ALL" | "NIFTY" | "SENSEX";
type ModeFilter = "ALL" | "scanner" | "herozero";

interface TradeResult {
  id: string;
  signal_id: string;
  outcome: "pass" | "fail" | "safe_exit" | "active";
  exit_price: number | null;
  pnl: number | null;
  resolved_at: string | null;
  index_name: string;
  mode: string;
  created_at: string;
  signal?: {
    trading_symbol: string;
    strike: number;
    option_type: string;
    entry_price: number;
    stop_loss: number;
    target1: number;
    confidence: number;
    created_at: string;
  };
}

export function TradeDashboard() {
  const [trades, setTrades] = useState<TradeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>("today");
  const [indexFilter, setIndexFilter] = useState<IndexFilter>("ALL");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("ALL");

  useEffect(() => {
    async function fetchTrades() {
      setLoading(true);
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffset);

      let startDate: Date;
      switch (period) {
        case "today":
          startDate = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
          break;
        case "week":
          startDate = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate() - istNow.getDay());
          break;
        case "month":
          startDate = new Date(istNow.getFullYear(), istNow.getMonth(), 1);
          break;
        default:
          startDate = new Date(2020, 0, 1);
      }

      const startUTC = new Date(startDate.getTime() - istOffset).toISOString();

      const { data, error } = await supabase
        .from("trade_results")
        .select("*, signal:signals(*)")
        .gte("created_at", startUTC)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTrades(data as unknown as TradeResult[]);
      }
      setLoading(false);
    }

    fetchTrades();
    const interval = setInterval(fetchTrades, 15000);
    return () => clearInterval(interval);
  }, [period]);

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (indexFilter !== "ALL" && t.index_name !== indexFilter) return false;
      if (modeFilter !== "ALL" && t.mode !== modeFilter) return false;
      return true;
    });
  }, [trades, indexFilter, modeFilter]);

  const stats = useMemo(() => {
    const resolved = filtered.filter((t) => t.outcome !== "active");
    const wins = resolved.filter((t) => t.outcome === "pass").length;
    const losses = resolved.filter((t) => t.outcome === "fail").length;
    const safeExits = resolved.filter((t) => t.outcome === "safe_exit").length;
    const active = filtered.filter((t) => t.outcome === "active").length;
    const totalPnl = resolved.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = resolved.length > 0 ? ((wins / resolved.length) * 100).toFixed(1) : "0.0";

    return { wins, losses, safeExits, active, totalPnl, winRate, total: resolved.length };
  }, [filtered]);

  const outcomeColors: Record<string, string> = {
    pass: "bg-success text-primary-foreground",
    fail: "bg-danger text-primary-foreground",
    safe_exit: "bg-warning text-primary-foreground",
    active: "bg-info text-primary-foreground",
  };

  return (
    <div className="space-y-3">
      {/* Filters Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Time Period */}
        <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
          {(["today", "week", "month", "all"] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors capitalize ${
                period === p ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "all" ? "All Time" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Today"}
            </button>
          ))}
        </div>

        {/* Index Filter */}
        <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
          {(["ALL", "NIFTY", "SENSEX"] as IndexFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setIndexFilter(f)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                indexFilter === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Mode Filter */}
        <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
          {(["ALL", "scanner", "herozero"] as ModeFilter[]).map((m) => (
            <button
              key={m}
              onClick={() => setModeFilter(m)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors capitalize ${
                modeFilter === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "ALL" ? "ALL" : m === "herozero" ? "Hero Zero" : "Scanner"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-info" />
              <span className="text-[10px] text-muted-foreground">Win Rate</span>
            </div>
            <p className="text-lg font-bold text-foreground">{stats.winRate}%</p>
            <p className="text-[10px] text-muted-foreground">{stats.total} trades</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              <span className="text-[10px] text-muted-foreground">Wins</span>
            </div>
            <p className="text-lg font-bold text-success">{stats.wins}</p>
            <p className="text-[10px] text-muted-foreground">T1 hit</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-danger" />
              <span className="text-[10px] text-muted-foreground">Losses</span>
            </div>
            <p className="text-lg font-bold text-danger">{stats.losses}</p>
            <p className="text-[10px] text-muted-foreground">SL hit</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-warning" />
              <span className="text-[10px] text-muted-foreground">Safe Exit</span>
            </div>
            <p className="text-lg font-bold text-warning">{stats.safeExits}</p>
            <p className="text-[10px] text-muted-foreground">50% of T1</p>
          </CardContent>
        </Card>
      </div>

      {/* P/L Card */}
      <Card className="border-border bg-card">
        <CardContent className="p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Total P/L</p>
            <p className={`text-xl font-bold tabular-nums ${stats.totalPnl >= 0 ? "text-success" : "text-danger"}`}>
              ₹{stats.totalPnl.toFixed(2)}
            </p>
          </div>
          {stats.active > 0 && (
            <Badge className="bg-info text-primary-foreground text-[10px]">
              {stats.active} active
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Trade Log Table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-1 px-3 pt-3">
          <CardTitle className="text-xs text-muted-foreground">Trade Log ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4">No trades found for this period</p>
          ) : (
            <div className="overflow-auto max-h-[400px]">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr className="text-muted-foreground">
                    <th className="text-left p-2 font-medium">Symbol</th>
                    <th className="text-left p-2 font-medium">Type</th>
                    <th className="text-right p-2 font-medium">Entry</th>
                    <th className="text-right p-2 font-medium">Exit</th>
                    <th className="text-right p-2 font-medium">P/L</th>
                    <th className="text-center p-2 font-medium">Result</th>
                    <th className="text-left p-2 font-medium">Mode</th>
                    <th className="text-right p-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/50">
                      <td className="p-2 font-medium text-foreground">{t.signal?.trading_symbol || "—"}</td>
                      <td className="p-2">
                        <Badge className={`text-[9px] ${t.signal?.option_type === "CE" ? "bg-success" : "bg-danger"} text-primary-foreground`}>
                          {t.signal?.option_type || "—"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right tabular-nums">₹{t.signal?.entry_price?.toFixed(2) || "—"}</td>
                      <td className="p-2 text-right tabular-nums">{t.exit_price ? `₹${t.exit_price.toFixed(2)}` : "—"}</td>
                      <td className={`p-2 text-right tabular-nums font-medium ${(t.pnl || 0) >= 0 ? "text-success" : "text-danger"}`}>
                        {t.pnl != null ? `₹${t.pnl.toFixed(2)}` : "—"}
                      </td>
                      <td className="p-2 text-center">
                        <Badge className={`text-[9px] ${outcomeColors[t.outcome]}`}>
                          {t.outcome === "safe_exit" ? "SAFE" : t.outcome.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-2 text-muted-foreground capitalize">{t.mode}</td>
                      <td className="p-2 text-right text-muted-foreground tabular-nums">
                        {new Date(t.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
