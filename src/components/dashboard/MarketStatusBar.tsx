import { useMarketStatus } from "@/hooks/useMarketStatus";
import { Circle } from "lucide-react";

export function MarketStatusBar() {
  const { isOpen, statusText } = useMarketStatus();

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-medium tracking-wide ${
      isOpen ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
    }`}>
      <Circle className={`h-2 w-2 fill-current ${isOpen ? "animate-pulse" : ""}`} />
      <span>{statusText}</span>
      {!isOpen && (
        <span className="ml-auto text-muted-foreground text-[9px]">Showing last cached data</span>
      )}
    </div>
  );
}
