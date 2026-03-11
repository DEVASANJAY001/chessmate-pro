import { useState, useRef, useEffect, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CandleChart } from "./CandleChart";
import { AIPatternAnalysis } from "./AIPatternAnalysis";
import { ChartDrawingOverlay } from "./ChartDrawingOverlay";
import { useAlertSound } from "@/hooks/useAlertSound";
import {
  BarChart3, Maximize2, Minimize2, Brain, Eye, EyeOff,
  ArrowUpDown, ArrowLeftRight, RotateCcw, Volume2, VolumeX,
  Pencil, Grid3X3, LayoutGrid, Columns2, Rows2,
  GripHorizontal, Move, ChevronDown, ChevronUp,
} from "lucide-react";
import type { CandleSet, SupportResistanceLevel, Signal, ChartPattern, CandlestickPattern } from "@/types/scanner";

interface FlexibleChartWorkspaceProps {
  candleSets: CandleSet[];
  srLevels: SupportResistanceLevel[];
  signals: Signal[];
  chartPatterns?: ChartPattern[];
  candlestickPatterns?: CandlestickPattern[];
  indexName: string;
}

type Timeframe = "1min" | "5min" | "15min";
type LayoutMode = "single" | "horizontal" | "vertical" | "quad" | "triple-left" | "triple-right";

export function FlexibleChartWorkspace({
  candleSets, srLevels, signals, chartPatterns = [], candlestickPatterns = [], indexName,
}: FlexibleChartWorkspaceProps) {
  const [layout, setLayout] = useState<LayoutMode>("horizontal");
  const [timeframes, setTimeframes] = useState<Timeframe[]>(["5min", "1min", "15min", "5min"]);
  const [showSR, setShowSR] = useState(true);
  const [showPatterns, setShowPatterns] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [focusedPanel, setFocusedPanel] = useState<number | null>(null);
  const [aiPatterns, setAiPatterns] = useState<ChartPattern[]>([]);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const chartContainerRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { soundEnabled, toggleSound, playPatternAlert } = useAlertSound();

  const allTimeframes: { value: Timeframe; label: string }[] = [
    { value: "1min", label: "1M" },
    { value: "5min", label: "5M" },
    { value: "15min", label: "15M" },
  ];

  const getChartData = (tf: Timeframe) => {
    const candleSet = candleSets.find(cs => cs.timeframe === tf);
    const tfSR = showSR ? srLevels.filter(l => l.timeframe === tf) : [];
    const tfSignals = showSignals ? signals : [];
    const tfChartPatterns = showPatterns && tf === "5min" ? [...chartPatterns, ...aiPatterns] : (showPatterns ? aiPatterns : []);
    const tfCandlePatterns = showPatterns && tf === "5min" ? candlestickPatterns : [];
    return { candleSet, tfSR, tfSignals, tfChartPatterns, tfCandlePatterns };
  };

  const handleAIPatterns = (patterns: ChartPattern[]) => {
    setAiPatterns(patterns);
    setShowPatterns(true);
    
    // Play sound alert for detected patterns
    if (patterns.length > 0) {
      const primaryBias = patterns[0].bias;
      playPatternAlert(primaryBias, patterns.length);
    }
  };

  const renderChart = (tf: Timeframe, index: number, height: number = 300) => {
    const { candleSet, tfSR, tfSignals, tfChartPatterns, tfCandlePatterns } = getChartData(tf);
    const isFocused = focusedPanel === index;

    return (
      <div className="h-full flex flex-col" ref={el => { chartContainerRefs.current[index] = el; }}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <GripHorizontal className="h-3 w-3 text-muted-foreground/50" />
            <BarChart3 className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-medium text-foreground">{indexName}</span>
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary">
              {tf}
            </Badge>
          </div>
          <div className="flex items-center gap-0.5">
            {/* Timeframe selector */}
            <div className="flex gap-0.5 bg-secondary rounded p-0.5 mr-1">
              {allTimeframes.map(t => (
                <button
                  key={t.value}
                  onClick={() => {
                    const newTfs = [...timeframes];
                    newTfs[index] = t.value;
                    setTimeframes(newTfs);
                  }}
                  className={`px-1.5 py-0.5 text-[8px] font-medium rounded transition-colors ${
                    tf === t.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button
              variant="ghost" size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setFocusedPanel(isFocused ? null : index)}
            >
              {isFocused ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Chart area with optional drawing overlay */}
        <div className="flex-1 min-h-0 p-1 relative">
          {candleSet && candleSet.candles.length > 0 ? (
            <>
              <CandleChart
                candles={candleSet.candles}
                srLevels={tfSR}
                signals={tfSignals}
                chartPatterns={tfChartPatterns}
                candlestickPatterns={tfCandlePatterns}
                timeframe={tf}
                height={height}
              />
              {showDrawing && (
                <div className="absolute inset-0" style={{ top: 0, left: 0 }}>
                  <ChartDrawingOverlay
                    width={chartContainerRefs.current[index]?.clientWidth || 400}
                    height={height}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-[11px]">
              No data for {tf}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Focused single panel view
  if (focusedPanel !== null) {
    const tf = timeframes[focusedPanel] || "5min";
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {renderChart(tf, focusedPanel, 500)}
        </CardContent>
      </Card>
    );
  }

  const hasPatterns = chartPatterns.length > 0 || candlestickPatterns.length > 0 || aiPatterns.length > 0;

  const layoutOptions: { value: LayoutMode; icon: React.ReactNode; label: string }[] = [
    { value: "single", icon: <span className="text-[9px] font-bold">1</span>, label: "Single" },
    { value: "horizontal", icon: <Columns2 className="h-3 w-3" />, label: "Side by Side" },
    { value: "vertical", icon: <Rows2 className="h-3 w-3" />, label: "Stacked" },
    { value: "triple-left", icon: <LayoutGrid className="h-3 w-3" />, label: "1 Left + 2 Right" },
    { value: "triple-right", icon: <LayoutGrid className="h-3 w-3 rotate-180" />, label: "2 Left + 1 Right" },
    { value: "quad", icon: <Grid3X3 className="h-3 w-3" />, label: "Quad" },
  ];

  return (
    <div className="space-y-1.5">
      {/* Toolbar */}
      <Card className="border-border bg-card">
        <CardContent className="p-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-medium text-foreground">Chart Workspace</span>
              <button
                onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {toolbarCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </button>
            </div>

            {/* Quick actions always visible */}
            <div className="flex items-center gap-1">
              <Button
                variant={showDrawing ? "secondary" : "ghost"} size="sm"
                className={`h-6 px-2 text-[9px] gap-1 ${showDrawing ? "text-primary border-primary/30" : ""}`}
                onClick={() => setShowDrawing(!showDrawing)}
              >
                <Pencil className="h-3 w-3" />
                Draw
              </Button>
              <Button
                variant={showAIPanel ? "secondary" : "ghost"} size="sm"
                className={`h-6 px-2 text-[9px] gap-1 ${showAIPanel ? "text-accent border-accent/30" : ""}`}
                onClick={() => setShowAIPanel(!showAIPanel)}
              >
                <Brain className="h-3 w-3" />
                AI Detect
              </Button>
              <Button
                variant="ghost" size="sm"
                className="h-6 w-6 p-0"
                onClick={toggleSound}
                title={soundEnabled ? "Mute alerts" : "Enable alerts"}
              >
                {soundEnabled ? <Volume2 className="h-3 w-3 text-primary" /> : <VolumeX className="h-3 w-3 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          {/* Expanded toolbar */}
          {!toolbarCollapsed && (
            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/50 flex-wrap">
              {/* Layout buttons */}
              <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
                {layoutOptions.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setLayout(l.value)}
                    className={`px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5 ${
                      layout === l.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={l.label}
                  >
                    {l.icon}
                  </button>
                ))}
              </div>

              {/* Overlay toggles */}
              <div className="flex gap-0.5">
                <Button
                  variant={showSR ? "secondary" : "ghost"} size="sm"
                  className="h-6 px-2 text-[9px] gap-1"
                  onClick={() => setShowSR(!showSR)}
                >
                  {showSR ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  S/R
                </Button>
                <Button
                  variant={showPatterns ? "secondary" : "ghost"} size="sm"
                  className="h-6 px-2 text-[9px] gap-1"
                  onClick={() => setShowPatterns(!showPatterns)}
                >
                  {showPatterns ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Patterns
                </Button>
                <Button
                  variant={showSignals ? "secondary" : "ghost"} size="sm"
                  className="h-6 px-2 text-[9px] gap-1"
                  onClick={() => setShowSignals(!showSignals)}
                >
                  {showSignals ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Signals
                </Button>
              </div>

              {aiPatterns.length > 0 && (
                <Button
                  variant="ghost" size="sm"
                  className="h-6 px-2 text-[9px] gap-1 text-muted-foreground"
                  onClick={() => setAiPatterns([])}
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear AI
                </Button>
              )}
            </div>
          )}

          {/* AI Patterns indicator */}
          {aiPatterns.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/50">
              <Brain className="h-3 w-3 text-accent" />
              <span className="text-[9px] text-accent font-medium">AI detected {aiPatterns.length} pattern(s)</span>
              {aiPatterns.map((p, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`text-[8px] px-1 py-0 ${
                    p.bias === "BULLISH" ? "border-success/30 text-success" : "border-danger/30 text-danger"
                  }`}
                >
                  {p.type.replace(/_/g, " ")} {p.confidence}%
                </Badge>
              ))}
              {soundEnabled && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary">
                  🔔 Sound ON
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Analysis Panel */}
      {showAIPanel && (
        <AIPatternAnalysis
          candleSets={candleSets}
          indexName={indexName}
          onPatternsDetected={handleAIPatterns}
        />
      )}

      {/* Charts */}
      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          {layout === "single" && (
            <div style={{ height: 420 }}>
              {renderChart(timeframes[0], 0, 400)}
            </div>
          )}

          {layout === "horizontal" && (
            <ResizablePanelGroup direction="horizontal" className="min-h-[380px]">
              <ResizablePanel defaultSize={50} minSize={20}>
                {renderChart(timeframes[0], 0, 360)}
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
              <ResizablePanel defaultSize={50} minSize={20}>
                {renderChart(timeframes[1], 1, 360)}
              </ResizablePanel>
            </ResizablePanelGroup>
          )}

          {layout === "vertical" && (
            <ResizablePanelGroup direction="vertical" className="min-h-[650px]">
              <ResizablePanel defaultSize={50} minSize={20}>
                {renderChart(timeframes[0], 0, 300)}
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
              <ResizablePanel defaultSize={50} minSize={20}>
                {renderChart(timeframes[1], 1, 300)}
              </ResizablePanel>
            </ResizablePanelGroup>
          )}

          {layout === "triple-left" && (
            <ResizablePanelGroup direction="horizontal" className="min-h-[600px]">
              <ResizablePanel defaultSize={55} minSize={30}>
                {renderChart(timeframes[0], 0, 580)}
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
              <ResizablePanel defaultSize={45} minSize={25}>
                <ResizablePanelGroup direction="vertical">
                  <ResizablePanel defaultSize={50} minSize={25}>
                    {renderChart(timeframes[1], 1, 275)}
                  </ResizablePanel>
                  <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
                  <ResizablePanel defaultSize={50} minSize={25}>
                    {renderChart(timeframes[2] || "15min", 2, 275)}
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}

          {layout === "triple-right" && (
            <ResizablePanelGroup direction="horizontal" className="min-h-[600px]">
              <ResizablePanel defaultSize={45} minSize={25}>
                <ResizablePanelGroup direction="vertical">
                  <ResizablePanel defaultSize={50} minSize={25}>
                    {renderChart(timeframes[0], 0, 275)}
                  </ResizablePanel>
                  <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
                  <ResizablePanel defaultSize={50} minSize={25}>
                    {renderChart(timeframes[1], 1, 275)}
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
              <ResizablePanel defaultSize={55} minSize={30}>
                {renderChart(timeframes[2] || "15min", 2, 580)}
              </ResizablePanel>
            </ResizablePanelGroup>
          )}

          {layout === "quad" && (
            <ResizablePanelGroup direction="vertical" className="min-h-[650px]">
              <ResizablePanel defaultSize={50} minSize={20}>
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel defaultSize={50} minSize={20}>
                    {renderChart(timeframes[0], 0, 300)}
                  </ResizablePanel>
                  <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
                  <ResizablePanel defaultSize={50} minSize={20}>
                    {renderChart(timeframes[1], 1, 300)}
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
              <ResizablePanel defaultSize={50} minSize={20}>
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel defaultSize={50} minSize={20}>
                    {renderChart(timeframes[2] || "15min", 2, 300)}
                  </ResizablePanel>
                  <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
                  <ResizablePanel defaultSize={50} minSize={20}>
                    <div className="h-full flex flex-col">
                      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/50">
                        <BarChart3 className="h-3 w-3 text-accent" />
                        <span className="text-[10px] font-medium text-foreground">Pattern Summary</span>
                      </div>
                      <div className="flex-1 p-2 overflow-auto">
                        <PatternSummary
                          chartPatterns={[...chartPatterns, ...aiPatterns]}
                          candlestickPatterns={candlestickPatterns}
                        />
                      </div>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-3 px-2 flex-wrap">
        {showSR && (
          <>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 bg-success" style={{ borderTop: "1px dashed" }} />
              <span className="text-[9px] text-success">Support</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 bg-danger" style={{ borderTop: "1px dashed" }} />
              <span className="text-[9px] text-danger">Resistance</span>
            </div>
          </>
        )}
        {showSignals && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[9px] text-primary">Signal</span>
          </div>
        )}
        {showPatterns && hasPatterns && (
          <>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded border border-success/40 bg-success/10" />
              <span className="text-[9px] text-success">Bullish</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded border border-danger/40 bg-danger/10" />
              <span className="text-[9px] text-danger">Bearish</span>
            </div>
          </>
        )}
        {showDrawing && (
          <div className="flex items-center gap-1">
            <Pencil className="h-3 w-3 text-primary" />
            <span className="text-[9px] text-primary">Drawing Mode</span>
          </div>
        )}
        {aiPatterns.length > 0 && (
          <div className="flex items-center gap-1">
            <Brain className="h-3 w-3 text-accent" />
            <span className="text-[9px] text-accent">AI Detected</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact pattern summary for quad view
function PatternSummary({
  chartPatterns,
  candlestickPatterns,
}: {
  chartPatterns: ChartPattern[];
  candlestickPatterns: CandlestickPattern[];
}) {
  if (chartPatterns.length === 0 && candlestickPatterns.length === 0) {
    return <p className="text-[10px] text-muted-foreground">No patterns detected</p>;
  }

  return (
    <div className="space-y-2">
      {chartPatterns.map((p, i) => (
        <div key={`cp-${i}`} className="flex items-center justify-between py-0.5 border-b border-border/30 last:border-0">
          <span className={`text-[10px] font-medium ${p.bias === "BULLISH" ? "text-success" : "text-danger"}`}>
            {p.type.replace(/_/g, " ")}
          </span>
          <span className={`text-[9px] tabular-nums font-bold ${p.confidence >= 70 ? "text-success" : "text-warning"}`}>
            {p.confidence}%
          </span>
        </div>
      ))}
      {candlestickPatterns.slice(0, 6).map((p, i) => (
        <div key={`csp-${i}`} className="flex items-center justify-between py-0.5 border-b border-border/30 last:border-0">
          <span className={`text-[10px] ${p.bias === "BULLISH" ? "text-success" : p.bias === "BEARISH" ? "text-danger" : "text-muted-foreground"}`}>
            {p.type.replace(/_/g, " ")}
          </span>
          <span className="text-[9px] text-muted-foreground">{p.bias}</span>
        </div>
      ))}
    </div>
  );
}
