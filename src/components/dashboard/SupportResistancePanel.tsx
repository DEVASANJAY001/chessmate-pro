import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Layers } from "lucide-react";
import type { SupportResistanceLevel } from "@/types/scanner";

interface SupportResistancePanelProps {
  levels: SupportResistanceLevel[];
  spotPrice: number;
}

export function SupportResistancePanel({ levels, spotPrice }: SupportResistancePanelProps) {
  if (!levels || levels.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-1 px-3 pt-3">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Support & Resistance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground">No S/R data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const timeframes = ["1min", "5min", "15min"];

  const supports = levels
    .filter(l => l.level_type === "support")
    .sort((a, b) => b.price - a.price);

  const resistances = levels
    .filter(l => l.level_type === "resistance")
    .sort((a, b) => a.price - b.price);

  // Multi-timeframe confluence: levels appearing in 2+ timeframes
  const findConfluence = (items: SupportResistanceLevel[], threshold = 15) => {
    const confluent: { price: number; timeframes: string[]; strength: number }[] = [];
    const used = new Set<number>();

    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;
      const group = [items[i]];
      for (let j = i + 1; j < items.length; j++) {
        if (!used.has(j) && Math.abs(items[i].price - items[j].price) <= threshold) {
          group.push(items[j]);
          used.add(j);
        }
      }
      used.add(i);
      if (group.length > 0) {
        confluent.push({
          price: Number((group.reduce((s, g) => s + g.price, 0) / group.length).toFixed(2)),
          timeframes: [...new Set(group.map(g => g.timeframe))],
          strength: group.reduce((s, g) => s + g.strength, 0),
        });
      }
    }
    return confluent.sort((a, b) => b.timeframes.length - a.timeframes.length || b.strength - a.strength).slice(0, 5);
  };

  const confluentSupports = findConfluence(supports);
  const confluentResistances = findConfluence(resistances);

  const strengthBar = (strength: number, max: number) => {
    const pct = Math.min(100, (strength / Math.max(max, 1)) * 100);
    return (
      <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    );
  };

  const maxStrength = Math.max(
    ...confluentSupports.map(s => s.strength),
    ...confluentResistances.map(r => r.strength),
    1
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-1 px-3 pt-3">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          Support & Resistance (1m / 5m / 15m)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Resistances (above spot) */}
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <ArrowUp className="h-3 w-3 text-danger" />
            <span className="text-[10px] font-medium text-danger uppercase tracking-wider">Resistance</span>
          </div>
          <div className="space-y-1">
            {confluentResistances.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No resistance levels detected</p>
            ) : (
              confluentResistances.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold tabular-nums text-danger">
                    ₹{r.price.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1">
                    {r.timeframes.map(tf => (
                      <Badge key={tf} variant="outline" className="text-[8px] px-1 py-0 border-danger/30 text-danger">
                        {tf}
                      </Badge>
                    ))}
                  </div>
                  {strengthBar(r.strength, maxStrength)}
                  <span className="text-[9px] text-muted-foreground tabular-nums w-8 text-right">
                    {((r.price - spotPrice) / spotPrice * 100).toFixed(2)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Spot Price Marker */}
        <div className="flex items-center gap-2 py-1 border-y border-dashed border-primary/30">
          <span className="text-[10px] text-muted-foreground">SPOT</span>
          <span className="text-[11px] font-bold text-primary tabular-nums">₹{spotPrice.toFixed(2)}</span>
        </div>

        {/* Supports (below spot) */}
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <ArrowDown className="h-3 w-3 text-success" />
            <span className="text-[10px] font-medium text-success uppercase tracking-wider">Support</span>
          </div>
          <div className="space-y-1">
            {confluentSupports.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No support levels detected</p>
            ) : (
              confluentSupports.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold tabular-nums text-success">
                    ₹{s.price.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1">
                    {s.timeframes.map(tf => (
                      <Badge key={tf} variant="outline" className="text-[8px] px-1 py-0 border-success/30 text-success">
                        {tf}
                      </Badge>
                    ))}
                  </div>
                  {strengthBar(s.strength, maxStrength)}
                  <span className="text-[9px] text-muted-foreground tabular-nums w-8 text-right">
                    {((spotPrice - s.price) / spotPrice * 100).toFixed(2)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Confluence indicator */}
        {(confluentSupports.some(s => s.timeframes.length >= 2) || confluentResistances.some(r => r.timeframes.length >= 2)) && (
          <div className="pt-1 border-t border-border">
            <p className="text-[9px] text-primary flex items-center gap-1">
              <Layers className="h-2.5 w-2.5" />
              Multi-timeframe confluence detected — stronger signal reliability
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
