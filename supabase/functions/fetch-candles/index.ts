import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const instrumentToken = url.searchParams.get("instrument_token") || "256265";
    const interval = url.searchParams.get("interval") || "5minute";
    const days = parseInt(url.searchParams.get("days") || "5");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Kite credentials
    const { data: config } = await supabase
      .from("kite_config")
      .select("api_key, access_token")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "No API credentials configured", candles: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const kiteHeaders: Record<string, string> = {
      "X-Kite-Version": "3",
      Authorization: `token ${config.api_key}:${config.access_token}`,
    };

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    
    // Use proper date format: yyyy-MM-dd HH:mm:ss
    const formatDate = (d: Date, time: string) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} ${time}`;
    };
    
    const fromStr = formatDate(from, "09:00:00");
    const toStr = formatDate(now, "15:30:00");

    const apiUrl = `https://api.kite.trade/instruments/historical/${instrumentToken}/${interval}?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`;
    
    console.log(`Fetching candles: ${apiUrl}`);
    
    const res = await fetch(apiUrl, { headers: kiteHeaders });

    const responseText = await res.text();
    console.log(`Kite historical response status: ${res.status}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ error: `Non-JSON response: ${responseText.slice(0, 200)}`, candles: [], status: res.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data?.data?.candles || data.data.candles.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: data?.message || data?.error || "No candle data returned", 
          candles: [], 
          status: res.status,
          kite_error: data?.error_type,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit candles based on interval
    const limits: Record<string, number> = {
      minute: 120,
      "3minute": 60,
      "5minute": 80,
      "15minute": 50,
    };
    const limit = limits[interval] || 60;

    const candles = data.data.candles.slice(-limit).map((c: any[]) => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));

    return new Response(
      JSON.stringify({ candles }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fetch candles error:", error);
    return new Response(
      JSON.stringify({ error: String(error), candles: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
