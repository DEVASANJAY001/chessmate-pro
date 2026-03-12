import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ScannerResponse, IndexType, ScanMode } from "@/types/scanner";

const POLL_INTERVAL = 1000;

function isMarketOpen(): boolean {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay();
  const timeInMinutes = ist.getHours() * 60 + ist.getMinutes();
  return day >= 1 && day <= 5 && timeInMinutes >= 540 && timeInMinutes <= 930;
}

export function useScanner(index: IndexType = "NIFTY", expiry?: string, mode: ScanMode = "scanner") {
  const [data, setData] = useState<ScannerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCachedData = useCallback(async () => {
    try {
      const cacheId = `${index}_${mode}`;
      const { data: cached } = await supabase
        .from("last_scan_cache")
        .select("*")
        .eq("id", cacheId)
        .maybeSingle();

      if (cached?.scan_data) {
        const scanData = cached.scan_data as unknown as ScannerResponse;
        setData(scanData);
        setLastUpdate(new Date(cached.cached_at));
        setIsCached(true);
        setError(null);
      } else {
        setError("No cached data available. Market will update when open.");
      }
    } catch (err) {
      setError("Failed to load cached data.");
    } finally {
      setLoading(false);
    }
  }, [index, mode]);

  const fetchLiveData = useCallback(async () => {
    try {
      const params: Record<string, string> = { index, mode };
      if (expiry) params.expiry = expiry;
      const queryString = new URLSearchParams(params).toString();

      const { data: result, error: fnError } = await supabase.functions.invoke(
        `scan-options?${queryString}`
      );

      if (fnError) {
        setError(fnError.message);
        return;
      }

      if (result?.error && (!result?.contracts || result.contracts.length === 0)) {
        // Live scan failed (e.g. expired token), try cache fallback
        await fetchCachedData();
        if (!data) setError(result.error);
        return;
      }

      setError(null);
      setData(result as ScannerResponse);
      setLastUpdate(new Date());
      setIsCached(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [index, expiry, mode]);

  useEffect(() => {
    setLoading(true);

    if (isMarketOpen()) {
      fetchLiveData();
      intervalRef.current = setInterval(() => {
        if (isMarketOpen()) {
          fetchLiveData();
        } else {
          // Market just closed, fetch cached
          if (intervalRef.current) clearInterval(intervalRef.current);
          fetchCachedData();
        }
      }, POLL_INTERVAL);
    } else {
      fetchCachedData();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLiveData, fetchCachedData]);

  return { data, loading, error, lastUpdate, isCached, refetch: isMarketOpen() ? fetchLiveData : fetchCachedData };
}
