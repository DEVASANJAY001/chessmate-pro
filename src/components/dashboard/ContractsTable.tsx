import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { OptionContract } from "@/types/scanner";
import { ChevronDown, ChevronRight, Target, ShieldAlert, Copy, Check } from "lucide-react";
import { ContractChart } from "./ContractChart";

interface ContractsTableProps {
  contracts: OptionContract[];
}

function calcTargets(ltp: number) {
  return {
    entry: ltp,
    sl: +(ltp * 0.70).toFixed(2),
    t1: +(ltp * 1.3).toFixed(2),
    t2: +(ltp * 1.6).toFixed(2),
    t3: +(ltp * 2.0).toFixed(2),
  };
}

export function ContractsTable({ contracts }: ContractsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedRow, setCopiedRow] = useState<string | null>(null);

  if (contracts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No contracts loaded yet. Configure your API token in Settings.
      </div>
    );
  }

  const handleCopy = (c: OptionContract) => {
    const t = calcTargets(c.ltp);
    const text = `📊 Scanner Pick\n${c.trading_symbol} ${c.option_type}\nEntry: ₹${t.entry.toFixed(2)}\nSL: ₹${t.sl}\nT1: ₹${t.t1} | T2: ₹${t.t2} | T3: ₹${t.t3}\nConfidence: ${c.confidence}%`;
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
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">LTP</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right hidden sm:table-cell">Volume</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right hidden sm:table-cell">OI</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right hidden md:table-cell">IV</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Score</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">Signal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c, i) => {
            const confColor =
              c.confidence >= 75
                ? "text-success"
                : c.confidence >= 50
                ? "text-warning"
                : "text-danger";
            const isExpanded = expandedRow === c.trading_symbol;
            const t = calcTargets(c.ltp);

            return (
              <>
                <TableRow
                  key={c.trading_symbol}
                  className={`border-border/50 cursor-pointer hover:bg-secondary/50 ${c.volume_burst ? "animate-burst" : ""}`}
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
                  <TableCell className="text-xs text-right tabular-nums font-medium">
                    ₹{c.ltp.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums hidden sm:table-cell">
                    {c.volume > 1000 ? `${(c.volume / 1000).toFixed(0)}K` : c.volume}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums hidden sm:table-cell">
                    {c.oi > 1000 ? `${(c.oi / 1000).toFixed(0)}K` : c.oi}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums hidden md:table-cell">
                    {c.iv.toFixed(1)}%
                  </TableCell>
                  <TableCell className={`text-xs text-right tabular-nums font-bold ${confColor}`}>
                    {c.confidence}%
                  </TableCell>
                  <TableCell className="text-center">
                    {c.volume_burst && (
                      <Badge className="text-[9px] bg-warning/20 text-warning border-warning/30">
                        BURST
                      </Badge>
                    )}
                    {c.signal && (
                      <Badge className="text-[9px] bg-success text-primary-foreground ml-1">
                        BUY
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${c.trading_symbol}-detail`} className="border-border/30 bg-secondary/30">
                    <TableCell colSpan={11} className="p-3 space-y-3">
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
