
-- Create a table to cache last scan results for when market is closed
CREATE TABLE public.last_scan_cache (
  id TEXT PRIMARY KEY DEFAULT 'default',
  index_name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'scanner',
  scan_data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow public read/write (no auth needed for this app)
ALTER TABLE public.last_scan_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.last_scan_cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.last_scan_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.last_scan_cache FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.last_scan_cache FOR DELETE USING (true);
