import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Minus, TrendingUp, Trash2, MousePointer, RulerIcon,
  CircleDot, Type,
} from "lucide-react";

export type DrawingTool = "select" | "trendline" | "horizontal" | "ray" | "label";
export type DrawingColor = "primary" | "success" | "danger" | "warning" | "accent";

export interface DrawnLine {
  id: string;
  tool: DrawingTool;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: DrawingColor;
  label?: string;
}

interface ChartDrawingOverlayProps {
  width: number;
  height: number;
  onLinesChange?: (lines: DrawnLine[]) => void;
}

const COLOR_MAP: Record<DrawingColor, string> = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  danger: "hsl(var(--danger))",
  warning: "hsl(var(--warning))",
  accent: "hsl(var(--accent))",
};

export function ChartDrawingOverlay({ width, height, onLinesChange }: ChartDrawingOverlayProps) {
  const [tool, setTool] = useState<DrawingTool>("select");
  const [color, setColor] = useState<DrawingColor>("primary");
  const [lines, setLines] = useState<DrawnLine[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<Partial<DrawnLine> | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ lineId: string; point: "start" | "end" | "body"; offsetX: number; offsetY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getMousePos = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tool === "select") return;
    const pos = getMousePos(e);
    
    const newLine: Partial<DrawnLine> = {
      id: crypto.randomUUID(),
      tool,
      x1: pos.x,
      y1: tool === "horizontal" ? pos.y : pos.y,
      x2: pos.x,
      y2: tool === "horizontal" ? pos.y : pos.y,
      color,
    };
    setCurrentLine(newLine);
    setDrawing(true);
    setSelectedLine(null);
  }, [tool, color, getMousePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePos(e);

    if (dragging) {
      setLines(prev => prev.map(l => {
        if (l.id !== dragging.lineId) return l;
        if (dragging.point === "start") return { ...l, x1: pos.x, y1: l.tool === "horizontal" ? pos.y : pos.y };
        if (dragging.point === "end") return { ...l, x2: pos.x, y2: l.tool === "horizontal" ? l.y1 : pos.y };
        // body drag
        const dx = pos.x - dragging.offsetX;
        const dy = pos.y - dragging.offsetY;
        return { ...l, x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy };
      }));
      if (dragging.point === "body") {
        setDragging({ ...dragging, offsetX: pos.x, offsetY: pos.y });
      }
      return;
    }

    if (!drawing || !currentLine) return;

    if (currentLine.tool === "horizontal") {
      setCurrentLine(prev => prev ? { ...prev, x2: width, y2: prev.y1 } : null);
    } else if (currentLine.tool === "ray") {
      // Extend ray to edge
      setCurrentLine(prev => prev ? { ...prev, x2: pos.x, y2: pos.y } : null);
    } else {
      setCurrentLine(prev => prev ? { ...prev, x2: pos.x, y2: pos.y } : null);
    }
  }, [drawing, currentLine, getMousePos, width, dragging]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(null);
      return;
    }
    if (!drawing || !currentLine) return;
    
    const finalLine = {
      ...currentLine,
      x2: currentLine.tool === "horizontal" ? width : currentLine.x2,
      y2: currentLine.tool === "horizontal" ? currentLine.y1 : currentLine.y2,
    } as DrawnLine;

    // Only add if line has some length
    const dx = Math.abs(finalLine.x2 - finalLine.x1);
    const dy = Math.abs(finalLine.y2 - finalLine.y1);
    if (dx > 3 || dy > 3) {
      const newLines = [...lines, finalLine];
      setLines(newLines);
      onLinesChange?.(newLines);
    }
    setCurrentLine(null);
    setDrawing(false);
  }, [drawing, currentLine, lines, width, onLinesChange, dragging]);

  const handleLineClick = useCallback((e: React.MouseEvent, lineId: string) => {
    if (tool === "select") {
      e.stopPropagation();
      setSelectedLine(lineId === selectedLine ? null : lineId);
    }
  }, [tool, selectedLine]);

  const handleEndpointDrag = useCallback((e: React.MouseEvent, lineId: string, point: "start" | "end") => {
    if (tool !== "select") return;
    e.stopPropagation();
    const pos = getMousePos(e);
    setDragging({ lineId, point, offsetX: pos.x, offsetY: pos.y });
  }, [tool, getMousePos]);

  const deleteLine = useCallback((id: string) => {
    const newLines = lines.filter(l => l.id !== id);
    setLines(newLines);
    onLinesChange?.(newLines);
    setSelectedLine(null);
  }, [lines, onLinesChange]);

  const clearAll = useCallback(() => {
    setLines([]);
    onLinesChange?.([]);
    setSelectedLine(null);
  }, [onLinesChange]);

  // Delete selected line on Delete/Backspace
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedLine) {
        deleteLine(selectedLine);
      }
      if (e.key === "Escape") {
        setSelectedLine(null);
        setTool("select");
        setDrawing(false);
        setCurrentLine(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedLine, deleteLine]);

  const renderLine = (line: DrawnLine | Partial<DrawnLine>, isPreview = false) => {
    if (!line.x1 || !line.y1) return null;
    const strokeColor = COLOR_MAP[line.color || "primary"];
    const isSelected = !isPreview && selectedLine === line.id;
    const opacity = isPreview ? 0.6 : 1;
    const strokeWidth = isSelected ? 2.5 : 1.5;
    const dashArray = line.tool === "ray" ? "6 3" : line.tool === "horizontal" ? "4 4" : "none";

    let x2 = line.x2 || line.x1;
    let y2 = line.y2 || line.y1;

    // Extend ray beyond canvas
    if (line.tool === "ray" && line.x1 != null && line.y1 != null) {
      const dx = x2 - line.x1;
      const dy = y2 - line.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const scale = Math.max(width, height) * 2 / len;
        x2 = line.x1 + dx * scale;
        y2 = line.y1 + dy * scale;
      }
    }

    return (
      <g key={line.id || "preview"}>
        {/* Hit area for easier clicking */}
        {!isPreview && (
          <line
            x1={line.x1} y1={line.y1} x2={x2} y2={y2}
            stroke="transparent" strokeWidth={12}
            style={{ cursor: tool === "select" ? "pointer" : "crosshair" }}
            onClick={(e) => line.id && handleLineClick(e, line.id)}
            onMouseDown={(e) => {
              if (tool === "select" && line.id) {
                e.stopPropagation();
                const pos = getMousePos(e);
                setDragging({ lineId: line.id, point: "body", offsetX: pos.x, offsetY: pos.y });
                setSelectedLine(line.id);
              }
            }}
          />
        )}
        <line
          x1={line.x1} y1={line.y1} x2={x2} y2={y2}
          stroke={strokeColor} strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          opacity={opacity}
          style={{ pointerEvents: "none" }}
        />
        {/* Endpoints for selected line */}
        {isSelected && (
          <>
            <circle
              cx={line.x1} cy={line.y1} r={5}
              fill={strokeColor} stroke="hsl(var(--background))" strokeWidth={2}
              style={{ cursor: "grab" }}
              onMouseDown={(e) => line.id && handleEndpointDrag(e, line.id, "start")}
            />
            <circle
              cx={line.x2} cy={line.y2} r={5}
              fill={strokeColor} stroke="hsl(var(--background))" strokeWidth={2}
              style={{ cursor: "grab" }}
              onMouseDown={(e) => line.id && handleEndpointDrag(e, line.id, "end")}
            />
          </>
        )}
      </g>
    );
  };

  const tools: { value: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { value: "select", icon: <MousePointer className="h-3 w-3" />, label: "Select" },
    { value: "trendline", icon: <TrendingUp className="h-3 w-3" />, label: "Trend Line" },
    { value: "horizontal", icon: <Minus className="h-3 w-3" />, label: "H-Line" },
    { value: "ray", icon: <RulerIcon className="h-3 w-3" />, label: "Ray" },
  ];

  const colors: { value: DrawingColor; label: string }[] = [
    { value: "primary", label: "Green" },
    { value: "danger", label: "Red" },
    { value: "warning", label: "Yellow" },
    { value: "accent", label: "Orange" },
    { value: "success", label: "Bright" },
  ];

  return (
    <div className="relative" style={{ width, height }}>
      {/* Drawing toolbar */}
      <div className="absolute top-1 left-1 z-20 flex items-center gap-0.5 bg-card/90 backdrop-blur-sm border border-border rounded-md p-0.5 shadow-lg">
        {tools.map(t => (
          <button
            key={t.value}
            onClick={() => { setTool(t.value); setSelectedLine(null); }}
            className={`p-1 rounded transition-colors ${
              tool === t.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-0.5" />
        {colors.map(c => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-transform ${
              color === c.value ? "scale-125 border-foreground" : "border-transparent"
            }`}
            style={{ backgroundColor: COLOR_MAP[c.value] }}
            title={c.label}
          />
        ))}
        <div className="w-px h-4 bg-border mx-0.5" />
        {selectedLine && (
          <button
            onClick={() => deleteLine(selectedLine)}
            className="p-1 rounded text-danger hover:bg-danger/10 transition-colors"
            title="Delete selected"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={clearAll}
          className="p-1 rounded text-muted-foreground hover:text-danger transition-colors"
          title="Clear all"
          disabled={lines.length === 0}
        >
          <Trash2 className="h-3 w-3" />
        </button>
        {lines.length > 0 && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 ml-0.5 border-border text-muted-foreground">
            {lines.length}
          </Badge>
        )}
      </div>

      {/* SVG overlay */}
      <svg
        ref={svgRef}
        className="absolute inset-0 z-10"
        width={width}
        height={height}
        style={{
          cursor: tool === "select" ? "default" : "crosshair",
          pointerEvents: tool === "select" && !selectedLine && !dragging ? "none" : "all",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => {
          if (tool === "select" && !dragging) {
            setSelectedLine(null);
          }
        }}
      >
        {lines.map(l => renderLine(l))}
        {currentLine && renderLine(currentLine, true)}
      </svg>
    </div>
  );
}
