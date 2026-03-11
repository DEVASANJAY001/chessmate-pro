
-- Kite Connect API configuration (stores daily access token)
CREATE TABLE public.kite_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key TEXT NOT NULL,
  access_token TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kite_config ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (personal use, no auth)
CREATE POLICY "Allow public read kite_config"
  ON public.kite_config FOR SELECT
  USING (true);

-- Allow anyone to insert/update (personal use)
CREATE POLICY "Allow public insert kite_config"
  ON public.kite_config FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update kite_config"
  ON public.kite_config FOR UPDATE
  USING (true);

-- Volume history snapshots for spike calculation
CREATE TABLE public.volume_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instrument_token BIGINT NOT NULL,
  trading_symbol TEXT NOT NULL,
  strike NUMERIC NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('CE', 'PE')),
  volume BIGINT NOT NULL DEFAULT 0,
  oi BIGINT NOT NULL DEFAULT 0,
  ltp NUMERIC NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.volume_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read volume_history"
  ON public.volume_history FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert volume_history"
  ON public.volume_history FOR INSERT
  WITH CHECK (true);

-- Index for fast spike queries
CREATE INDEX idx_volume_history_symbol_time 
  ON public.volume_history (trading_symbol, recorded_at DESC);

CREATE INDEX idx_volume_history_recorded 
  ON public.volume_history (recorded_at DESC);

-- Trade signals
CREATE TABLE public.signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trading_symbol TEXT NOT NULL,
  strike NUMERIC NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('CE', 'PE')),
  entry_price NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  target1 NUMERIC NOT NULL,
  target2 NUMERIC NOT NULL,
  target3 NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  reason TEXT NOT NULL DEFAULT 'Volume Burst + Smart Flow Detected',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read signals"
  ON public.signals FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert signals"
  ON public.signals FOR INSERT
  WITH CHECK (true);

-- Enable realtime for signals
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;

-- Cleanup old volume history (keep last 10 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_old_volume_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.volume_history
  WHERE recorded_at < now() - interval '10 minutes';
END;
$$;
