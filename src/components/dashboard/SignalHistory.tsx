import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Signal } from "@/types/scanner";
import { Bell, Loader2, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type IndexFilter = "ALL" | "NIFTY" | "SENSEX";

export function SignalHistory() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexFilter, setIndexFilter] = useState<IndexFilter>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copySignal(s: Signal) {
    const time = new Date(s.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    const safeTradePrice = (s.entry_price + (s.target1 - s.entry_price) * 0.5).toFixed(2);
    const text = `🚨 TRADE ALERT 🚨

📊 ${s.trading_symbol}

⏰ Time: ${time}

💰 Entry: ₹${s.entry_price.toFixed(2)}
🛑 SL: ₹${s.stop_loss.toFixed(2)}

🟢 Safe Trade: ₹${safeTradePrice}
🎯 T1: ₹${s.target1.toFixed(2)}

⚡ Follow SL strictly
📈 Book profits as per levels
Trade disciplined.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(s.id);
      toast({ title: "Copied!", description: "Trade alert copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  useEffect(() => {
    async function fetchTodaySignals() {
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffset);
      const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
      const todayStartUTC = new Date(todayStart.getTime() - istOffset).toISOString();

      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .gte("created_at", todayStartUTC)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setSignals(data as unknown as Signal[]);
      }
      setLoading(false);
    }

    fetchTodaySignals();
    const interval = setInterval(fetchTodaySignals, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredSignals = signals.filter((s) => {
    if (indexFilter === "ALL") return true;
    // Derive index from trading_symbol
    return s.trading_symbol.startsWith(indexFilter);
  });

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Bell className="h-4 w-4 text-info" />
            Today's Signals ({filteredSignals.length})
          </span>
        </CardTitle>
        {/* Index Filter */}
        <div className="flex gap-0.5 bg-secondary rounded-md p-0.5 mt-1.5">
          {(["ALL", "NIFTY", "SENSEX"] as IndexFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setIndexFilter(f)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                indexFilter === f
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSignals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No signals generated today</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-auto">
            {filteredSignals.map((s) => (
              <div
                key={s.id}
                className="bg-secondary rounded p-2.5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-[9px] ${s.option_type === "CE" ? "bg-success" : "bg-danger"} text-primary-foreground`}>
                      {s.option_type}
                    </Badge>
                    <span className="font-medium text-foreground">{s.trading_symbol}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {new Date(s.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </span>
                    <button
                      onClick={() => copySignal(s)}
                      className="p-0.5 rounded hover:bg-primary/10 transition-colors"
                      title="Copy trade alert"
                    >
                      {copiedId === s.id ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-muted-foreground tabular-nums">
                  <span>Entry: ₹{s.entry_price.toFixed(2)}</span>
                  <span className="text-danger">SL: ₹{s.stop_loss.toFixed(2)}</span>
                  <span className="text-success">T1: ₹{s.target1.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
