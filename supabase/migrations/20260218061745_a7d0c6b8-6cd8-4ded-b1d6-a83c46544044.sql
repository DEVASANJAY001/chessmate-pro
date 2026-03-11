
-- Table to track signal outcomes (pass/fail/safe_exit)
CREATE TABLE public.trade_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('pass', 'fail', 'safe_exit', 'active')),
  exit_price NUMERIC,
  pnl NUMERIC,
  resolved_at TIMESTAMP WITH TIME ZONE,
  index_name TEXT NOT NULL DEFAULT 'NIFTY',
  mode TEXT NOT NULL DEFAULT 'scanner',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_results ENABLE ROW LEVEL SECURITY;

-- Public read/insert/update policies (no auth in this app)
CREATE POLICY "Allow public read trade_results" ON public.trade_results FOR SELECT USING (true);
CREATE POLICY "Allow public insert trade_results" ON public.trade_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update trade_results" ON public.trade_results FOR UPDATE USING (true);

-- Index for fast lookups
CREATE INDEX idx_trade_results_signal_id ON public.trade_results(signal_id);
CREATE INDEX idx_trade_results_outcome ON public.trade_results(outcome);
CREATE INDEX idx_trade_results_created_at ON public.trade_results(created_at);

-- Also add index_name and mode columns to signals table for filtering
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS index_name TEXT NOT NULL DEFAULT 'NIFTY';
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'scanner';
