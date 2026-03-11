
CREATE TABLE public.support_resistance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  index_name text NOT NULL DEFAULT 'NIFTY',
  timeframe text NOT NULL, -- '1min', '5min', '15min'
  level_type text NOT NULL, -- 'support' or 'resistance'
  price numeric NOT NULL,
  strength integer NOT NULL DEFAULT 1, -- how many times touched
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_resistance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read support_resistance" ON public.support_resistance FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert support_resistance" ON public.support_resistance FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update support_resistance" ON public.support_resistance FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete support_resistance" ON public.support_resistance FOR DELETE TO public USING (true);
