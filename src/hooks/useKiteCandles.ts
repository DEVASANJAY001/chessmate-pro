import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CandleData } from "@/types/scanner";

const INSTRUMENT_TOKENS: Record<string, string> = {
    NIFTY: "256265",
    SENSEX: "265",
};

const INTERVAL_MAP: Record<string, string> = {
    "1min": "minute",
    "5min": "5minute",
    "15min": "15minute",
};

interface UseKiteCandlesReturn {
    candles: CandleData[];
    loading: boolean;
    error: string | null;
    lastFetch: Date | null;
}

export function useKiteCandles(
    index: string = "SENSEX",
    timeframe: string = "5min",
    pollMs: number = 1000
): UseKiteCandlesReturn {
    const [candles, setCandles] = useState<CandleData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetch, setLastFetch] = useState<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isFetchingRef = useRef(false);

    const fetchCandles = useCallback(async () => {
        if (isFetchingRef.current) return; // skip if previous fetch still running
        isFetchingRef.current = true;

        try {
            const token = INSTRUMENT_TOKENS[index] || "265";
            const interval = INTERVAL_MAP[timeframe] || "5minute";
            const qs = `instrument_token=${token}&interval=${interval}&days=1`;

            const { data, error: fnErr } = await supabase.functions.invoke(
                `fetch-candles?${qs}`
            );

            if (fnErr) {
                setError(fnErr.message);
            } else if (data?.candles?.length > 0) {
                setCandles(data.candles);
                setError(null);
                setLastFetch(new Date());
            } else if (data?.error) {
                setError(data.error);
            }
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [index, timeframe]);

    useEffect(() => {
        setLoading(true);
        fetchCandles();

        intervalRef.current = setInterval(fetchCandles, pollMs);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchCandles, pollMs]);

    return { candles, loading, error, lastFetch };
}
