import React, { useState } from 'react';
import { X, Maximize2, Minimize2, Move } from 'lucide-react';

interface MiniChartWindowProps {
    onClose: () => void;
    url?: string;
}

export function MiniChartWindow({ onClose, url = "https://minitv.lovable.app/" }: MiniChartWindowProps) {
    const [isMinimized, setIsMinimized] = useState(false);

    if (isMinimized) {
        return (
            <div className="absolute bottom-4 right-4 z-[100] flex items-center gap-2 p-2 bg-black/90 border border-white/20 rounded-lg backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300">
                <button
                    onClick={() => setIsMinimized(false)}
                    className="flex items-center gap-2 text-[10px] font-bold text-white/70 hover:text-white transition-colors"
                >
                    <Maximize2 className="w-3 h-3 text-primary" />
                    EXT-TV ACTIVE
                </button>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-3 h-3 text-white/40" />
                </button>
            </div>
        );
    }

    return (
        <div className="absolute top-12 right-4 w-[320px] h-[240px] md:w-[420px] md:h-[300px] z-[100] flex flex-col bg-black/95 border border-white/10 rounded-xl overflow-hidden backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 pointer-events-auto">
            {/* Header / Drag Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 cursor-move">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/50">External TV Feed</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-1 hover:bg-white/10 rounded-md transition-colors"
                        title="Minimize"
                    >
                        <Minimize2 className="w-3 h-3 text-white/60" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-danger/20 rounded-md transition-colors group"
                        title="Close"
                    >
                        <X className="w-3 h-3 text-white/60 group-hover:text-danger" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative bg-black">
                <iframe
                    src={url}
                    className="w-full h-full border-none"
                    title="External TV Chart"
                    allow="autoplay; fullscreen"
                />
                {/* Anti-overlay protection (subtle) */}
                <div className="absolute inset-0 pointer-events-none border border-white/5" />
            </div>

            {/* Footer info */}
            <div className="px-2 py-1 bg-black/40 border-t border-white/5 flex justify-between items-center">
                <span className="text-[7px] text-white/20 font-medium">MINITV.LOVABLE.APP</span>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-green-500/50" />
                    <div className="w-1 h-1 rounded-full bg-green-500/50" />
                </div>
            </div>
        </div>
    );
}
