import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candles, index_name } = await req.json() as { candles: CandleData[]; index_name: string };

    if (!candles || candles.length < 10) {
      return new Response(JSON.stringify({ error: "Need at least 10 candles", patterns: [], summary: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured", patterns: [], summary: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare candle summary for AI
    const candleSummary = candles.map((c, i) => ({
      i,
      t: c.timestamp,
      o: +c.open.toFixed(2),
      h: +c.high.toFixed(2),
      l: +c.low.toFixed(2),
      c: +c.close.toFixed(2),
      v: c.volume,
    }));

    const prompt = `You are an expert technical analyst. Analyze this ${index_name} candlestick data and detect chart patterns.

CANDLE DATA (index, timestamp, OHLCV):
${JSON.stringify(candleSummary)}

DETECT these patterns if present:
- double_top, double_bottom
- ascending_triangle, descending_triangle
- bull_flag, bear_flag
- head_and_shoulders, inverse_head_and_shoulders

For each pattern found, respond with ONLY valid JSON (no markdown):
{
  "patterns": [
    {
      "type": "<pattern_type>",
      "confidence": <0-100>,
      "start_index": <candle index where pattern starts>,
      "end_index": <candle index where pattern ends>,
      "description": "<brief description>",
      "bias": "BULLISH" | "BEARISH"
    }
  ],
  "summary": "<1-2 sentence market analysis>"
}

Rules:
- Only report patterns with confidence >= 40%
- start_index and end_index must be valid candle indices (0 to ${candles.length - 1})
- Be precise about pattern boundaries
- If no patterns found, return empty patterns array
- ONLY output JSON, nothing else`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({ error: "AI analysis failed", patterns: [], summary: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let parsed: { patterns: any[]; summary: string } = { patterns: [], summary: "" };
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", content);
      parsed = { patterns: [], summary: "AI response could not be parsed." };
    }

    // Validate and sanitize patterns
    const validTypes = [
      "double_top", "double_bottom", "ascending_triangle", "descending_triangle",
      "bull_flag", "bear_flag", "head_and_shoulders", "inverse_head_and_shoulders",
    ];

    const validPatterns = (parsed.patterns || [])
      .filter((p: any) =>
        validTypes.includes(p.type) &&
        typeof p.confidence === "number" &&
        typeof p.start_index === "number" &&
        typeof p.end_index === "number" &&
        p.start_index >= 0 &&
        p.end_index < candles.length &&
        p.start_index <= p.end_index &&
        ["BULLISH", "BEARISH"].includes(p.bias)
      )
      .map((p: any) => ({
        type: p.type,
        confidence: Math.min(100, Math.max(0, Math.round(p.confidence))),
        start_index: p.start_index,
        end_index: p.end_index,
        description: String(p.description || "").slice(0, 200),
        bias: p.bias,
      }));

    return new Response(JSON.stringify({
      patterns: validPatterns,
      summary: String(parsed.summary || "").slice(0, 500),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI pattern detect error:", err);
    return new Response(JSON.stringify({ error: String(err), patterns: [], summary: "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
