CREATE POLICY "Allow public delete volume_history"
ON public.volume_history
FOR DELETE
USING (true);