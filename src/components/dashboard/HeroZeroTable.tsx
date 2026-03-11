import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { OptionContract } from "@/types/scanner";
import { ChevronDown, ChevronRight, Target, ShieldAlert, Copy, Check } from "lucide-react";
import { ContractChart } from "./ContractChart";

interface HeroZeroTableProps {
  contracts: OptionContract[];
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

export function HeroZeroTable({ contracts }: HeroZeroTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedRow, setCopiedRow] = useState<string | null>(null);

  if (contracts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No Hero Zero contracts found. Configure your API token in Settings.
      </div>
    );
  }

  const handleCopy = (c: OptionContract) => {
    const t = calcTargets(c.ltp);
    const text = `🔥 Hero Zero Pick\n${c.trading_symbol} ${c.option_type}\nEntry: ₹${t.entry.toFixed(2)}\nSL: ₹${t.sl}\nT1: ₹${t.t1} | T2: ₹${t.t2} | T3: ₹${t.t3}\nScore: ${c.hero_score || 0}`;
    navigator.clipboard.writeText(text);
    setCopiedRow(c.trading_symbol);
    setTimeout(() => setCopiedRow(null), 1500);
  };

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-6"></TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-8">#</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Symbol</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Strike</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">Type</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Premium</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right hidden sm:table-cell">Volume</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right hidden sm:table-cell">OI</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right hidden md:table-cell">Theta</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right hidden md:table-cell">Spread</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right hidden md:table-cell">GEX</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right hidden md:table-cell">RSI</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Hero Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c, i) => {
            const scoreColor =
              (c.hero_score || 0) >= 70
                ? "text-success"
                : (c.hero_score || 0) >= 40
                ? "text-warning"
                : "text-danger";
            const premiumColor = c.ltp <= 10 ? "text-success" : c.ltp <= 20 ? "text-warning" : "text-foreground";
            const isExpanded = expandedRow === c.trading_symbol;
            const t = calcTargets(c.ltp);

            return (
              <>
                <TableRow
                  key={c.trading_symbol}
                  className="border-border/50 cursor-pointer hover:bg-secondary/50"
                  onClick={() => setExpandedRow(isExpanded ? null : c.trading_symbol)}
                >
                  <TableCell className="text-xs text-muted-foreground px-1">
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">{i + 1}</TableCell>
                  <TableCell className="text-xs font-medium text-foreground">{c.trading_symbol}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{c.strike}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        c.option_type === "CE"
                          ? "border-success/40 text-success"
                          : "border-danger/40 text-danger"
                      }`}
                    >
                      {c.option_type}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-xs text-right tabular-nums font-medium ${premiumColor}`}>
                    ₹{c.ltp.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums hidden sm:table-cell">
                    {c.volume > 1000 ? `${(c.volume / 1000).toFixed(0)}K` : c.volume}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums hidden sm:table-cell">
                    {c.oi > 1000 ? `${(c.oi / 1000).toFixed(0)}K` : c.oi}
                  </TableCell>
                  <TableCell className={`text-xs text-right tabular-nums hidden md:table-cell font-medium ${(c.theta || 0) < -0.5 ? "text-danger" : "text-foreground"}`}>
                    {c.theta !== undefined ? c.theta.toFixed(3) : "—"}
                  </TableCell>
                  <TableCell className={`text-xs text-right tabular-nums hidden md:table-cell font-medium ${(c.bid_ask_spread || 0) <= 0.5 ? "text-success" : (c.bid_ask_spread || 0) > 2 ? "text-danger" : "text-foreground"}`}>
                    ₹{c.bid_ask_spread?.toFixed(2) || "—"}
                  </TableCell>
                  <TableCell className={`text-xs text-right tabular-nums hidden md:table-cell font-medium ${(c.gamma_exposure || 0) > 0 ? "text-warning" : "text-foreground"}`}>
                    {c.gamma_exposure?.toFixed(1) || "—"}
                  </TableCell>
                  <TableCell className={`text-xs text-right tabular-nums hidden md:table-cell ${
                    (c.rsi || 50) >= 30 && (c.rsi || 50) <= 50 ? "text-success" : (c.rsi || 50) > 70 ? "text-danger" : ""
                  }`}>
                    {c.rsi?.toFixed(1) || "—"}
                  </TableCell>
                  <TableCell className={`text-xs text-right tabular-nums font-bold ${scoreColor}`}>
                    {c.hero_score || 0}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${c.trading_symbol}-detail`} className="border-border/30 bg-secondary/30">
                    <TableCell colSpan={13} className="p-3 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1 text-xs">
                          <Target className="h-3 w-3 text-primary" />
                          <span className="text-muted-foreground">Entry:</span>
                          <span className="font-bold tabular-nums text-foreground">₹{t.entry.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <ShieldAlert className="h-3 w-3 text-danger" />
                          <span className="text-muted-foreground">SL:</span>
                          <span className="font-bold tabular-nums text-danger">₹{t.sl}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">T1:</span>
                          <span className="font-bold tabular-nums text-success ml-1">₹{t.t1}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">T2:</span>
                          <span className="font-bold tabular-nums text-success ml-1">₹{t.t2}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">T3:</span>
                          <span className="font-bold tabular-nums text-success ml-1">₹{t.t3}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground ml-1">
                          RR: 1:{((t.t2 - t.entry) / (t.entry - t.sl)).toFixed(1)}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy(c); }}
                          className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedRow === c.trading_symbol ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                          {copiedRow === c.trading_symbol ? "Copied" : "Copy"}
                        </button>
                      </div>
                      {/* Contract Chart */}
                      <ContractChart
                        instrumentToken={c.instrument_token}
                        tradingSymbol={c.trading_symbol}
                        strike={c.strike}
                        spotPrice={c.ltp}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
