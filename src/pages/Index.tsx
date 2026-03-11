import { useState, useMemo } from "react";
import { useScanner } from "@/hooks/useScanner";
import { NiftyHeader } from "@/components/dashboard/NiftyHeader";
import { BestContractCard } from "@/components/dashboard/BestContractCard";
import { ContractsTable } from "@/components/dashboard/ContractsTable";
import { VolumeBurstPanel } from "@/components/dashboard/VolumeBurstPanel";
import { SignalHistory } from "@/components/dashboard/SignalHistory";
import { AdminPanel } from "@/components/dashboard/AdminPanel";
import { HeroZeroCard } from "@/components/dashboard/HeroZeroCard";
import { HeroZeroTable } from "@/components/dashboard/HeroZeroTable";
import { MarketStatusBar } from "@/components/dashboard/MarketStatusBar";
import { EnginePanel } from "@/components/dashboard/EnginePanel";
import { TradeDashboard } from "@/components/dashboard/TradeDashboard";
import { SupportResistancePanel } from "@/components/dashboard/SupportResistancePanel";
import { IndexChartPanel } from "@/components/dashboard/IndexChartPanel";
import { FlexibleChartWorkspace } from "@/components/dashboard/FlexibleChartWorkspace";
import { PatternPanel } from "@/components/dashboard/PatternPanel";
import { OIAnalysisPanel } from "@/components/dashboard/OIAnalysisPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Settings, LayoutDashboard, Loader2, Flame, Filter, BarChart3, Brain, CalendarIcon } from "lucide-react";
import type { IndexType, ScanMode, OptionContract } from "@/types/scanner";
import { format } from "date-fns";

type OptionFilter = "ALL" | "CE" | "PE";
type SortBy = "confidence" | "volume" | "oi" | "ltp" | "hero_score";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"dashboard" | "herozero" | "engine" | "trades" | "settings">("dashboard");
  const [indexType, setIndexType] = useState<IndexType>("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const [optionFilter, setOptionFilter] = useState<OptionFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("confidence");
  const mode: ScanMode = activeTab === "herozero" ? "herozero" : "scanner";

  const { data, loading, error, lastUpdate, isCached } = useScanner(indexType, expiry || undefined, mode);

  const rawContracts = data?.contracts || [];
  const signals = data?.signals || [];
  const spotPrice = (indexType === "SENSEX" ? data?.sensex_price : data?.nifty_price) || 0;
  const expiryDates = data?.expiry_dates || [];

  // Apply filters
  const filteredContracts = rawContracts
    .filter((c: OptionContract) => optionFilter === "ALL" || c.option_type === optionFilter)
    .sort((a: OptionContract, b: OptionContract) => {
      switch (sortBy) {
        case "volume": return b.volume - a.volume;
        case "oi": return b.oi - a.oi;
        case "ltp": return b.ltp - a.ltp;
        case "hero_score": return (b.hero_score || 0) - (a.hero_score || 0);
        default: return b.confidence - a.confidence;
      }
    });

  const bestContract = filteredContracts.length > 0 ? filteredContracts[0] : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketStatusBar />
      <NiftyHeader
        price={spotPrice}
        pcr={data?.pcr || 0}
        lastUpdate={lastUpdate}
        atmStrike={data?.atm_strike}
        indexName={indexType}
        maxPain={data?.max_pain}
        selectedExpiry={data?.selected_expiry}
        isCached={isCached}
      />

      {/* Nav + Filters */}
      <div className="flex flex-col gap-2 px-3 py-2 border-b border-border">
        {/* Tab Row */}
        <div className="flex gap-1">
          <Button
            variant={activeTab === "dashboard" ? "secondary" : "ghost"}
            size="sm"
            className="text-[11px] gap-1 h-7 px-2.5"
            onClick={() => { setActiveTab("dashboard"); setSortBy("confidence"); }}
          >
            <LayoutDashboard className="h-3 w-3" />
            Scanner
          </Button>
          <Button
            variant={activeTab === "herozero" ? "secondary" : "ghost"}
            size="sm"
            className="text-[11px] gap-1 h-7 px-2.5"
            onClick={() => { setActiveTab("herozero"); setSortBy("hero_score"); }}
          >
            <Flame className="h-3 w-3" />
            Hero Zero
          </Button>
          <Button
            variant={activeTab === "engine" ? "secondary" : "ghost"}
            size="sm"
            className="text-[11px] gap-1 h-7 px-2.5"
            onClick={() => setActiveTab("engine")}
          >
            <Brain className="h-3 w-3" />
            Engine
          </Button>
          <Button
            variant={activeTab === "trades" ? "secondary" : "ghost"}
            size="sm"
            className="text-[11px] gap-1 h-7 px-2.5"
            onClick={() => setActiveTab("trades")}
          >
            <BarChart3 className="h-3 w-3" />
            Dashboard
          </Button>
          <Button
            variant={activeTab === "settings" ? "secondary" : "ghost"}
            size="sm"
            className="text-[11px] gap-1 h-7 px-2.5"
            onClick={() => setActiveTab("settings")}
          >
            <Settings className="h-3 w-3" />
            Settings
          </Button>
        </div>

        {/* Filter Row */}
        {activeTab !== "settings" && activeTab !== "trades" && activeTab !== "engine" && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Index */}
            <Select value={indexType} onValueChange={(v) => { setIndexType(v as IndexType); setExpiry(""); }}>
              <SelectTrigger className="w-[90px] h-7 text-[11px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="NIFTY" className="text-xs">NIFTY</SelectItem>
                <SelectItem value="SENSEX" className="text-xs">SENSEX</SelectItem>
              </SelectContent>
            </Select>

            {/* Expiry Calendar Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 bg-secondary border-border px-2">
                  <CalendarIcon className="h-3 w-3" />
                  {expiry ? format(new Date(expiry + "T00:00:00"), "dd MMM yy") : "Next Expiry"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border z-50" align="start">
                <Calendar
                  mode="single"
                  selected={expiry ? new Date(expiry + "T00:00:00") : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const yyyy = date.getFullYear();
                      const mm = String(date.getMonth() + 1).padStart(2, "0");
                      const dd = String(date.getDate()).padStart(2, "0");
                      setExpiry(`${yyyy}-${mm}-${dd}`);
                    } else {
                      setExpiry("");
                    }
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  initialFocus
                />
                {expiry && (
                  <div className="p-2 border-t border-border">
                    <Button variant="ghost" size="sm" className="w-full text-[11px] h-7" onClick={() => setExpiry("")}>
                      Reset to Next Expiry
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* CE/PE Filter */}
            <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
              {(["ALL", "CE", "PE"] as OptionFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setOptionFilter(f)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    optionFilter === f
                      ? f === "CE" ? "bg-success/20 text-success" : f === "PE" ? "bg-danger/20 text-danger" : "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-[90px] h-7 text-[11px] bg-secondary border-border">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="confidence" className="text-xs">Score</SelectItem>
                <SelectItem value="volume" className="text-xs">Volume</SelectItem>
                <SelectItem value="oi" className="text-xs">OI</SelectItem>
                <SelectItem value="ltp" className="text-xs">LTP</SelectItem>
                {activeTab === "herozero" && (
                  <SelectItem value="hero_score" className="text-xs">Hero Score</SelectItem>
                )}
              </SelectContent>
            </Select>

            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 p-3 space-y-3 max-w-7xl mx-auto w-full">
        {activeTab === "settings" ? (
          <AdminPanel />
        ) : activeTab === "trades" ? (
          <TradeDashboard />
        ) : activeTab === "engine" ? (
          <EnginePanel indexType={indexType} />
        ) : activeTab === "herozero" ? (
          <>
            {error && (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="py-2">
                  <p className="text-[11px] text-warning">{error}</p>
                </CardContent>
              </Card>
            )}

            <HeroZeroCard contract={bestContract} spotPrice={spotPrice} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SupportResistancePanel levels={data?.support_resistance || []} spotPrice={spotPrice} />
              <OIAnalysisPanel
                oiAnalysis={data?.oi_analysis || []}
                strikeSR={data?.strike_sr || []}
                spotPrice={spotPrice}
              />
            </div>

            <IndexChartPanel
              candleSets={data?.candle_data || []}
              srLevels={data?.support_resistance || []}
              signals={signals}
              chartPatterns={data?.chart_patterns || []}
              candlestickPatterns={data?.candlestick_patterns || []}
              indexName={indexType}
            />
            <Card className="border-border bg-card">
              <CardHeader className="pb-1 px-3 pt-3">
                <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-warning" />
                  Hero Zero ({filteredContracts.length}) – {indexType}
                  {optionFilter !== "ALL" && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${optionFilter === "CE" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                      {optionFilter} only
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <HeroZeroTable contracts={filteredContracts} />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {error && (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="py-2">
                  <p className="text-[11px] text-warning">{error}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <BestContractCard contract={bestContract} />
              <VolumeBurstPanel contracts={filteredContracts} />
              <SignalHistory />
              <SupportResistancePanel levels={data?.support_resistance || []} spotPrice={spotPrice} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PatternPanel
                chartPatterns={data?.chart_patterns || []}
                candlestickPatterns={data?.candlestick_patterns || []}
              />
              <OIAnalysisPanel
                oiAnalysis={data?.oi_analysis || []}
                strikeSR={data?.strike_sr || []}
                spotPrice={spotPrice}
              />
            </div>

            <IndexChartPanel
              candleSets={data?.candle_data || []}
              srLevels={data?.support_resistance || []}
              signals={signals}
              chartPatterns={data?.chart_patterns || []}
              candlestickPatterns={data?.candlestick_patterns || []}
              indexName={indexType}
            />

            <Card className="border-border bg-card">
              <CardHeader className="pb-1 px-3 pt-3">
                <CardTitle className="text-xs text-muted-foreground">
                  Top {filteredContracts.length} Contracts – {indexType}
                  {optionFilter !== "ALL" && (
                    <span className={`text-[9px] ml-2 px-1.5 py-0.5 rounded ${optionFilter === "CE" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                      {optionFilter} only
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ContractsTable contracts={filteredContracts} />
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
