
ALTER TABLE public.labels
  ADD COLUMN IF NOT EXISTS last_tracking_update timestamptz,
  ADD COLUMN IF NOT EXISTS raw_courier_status text,
  ADD COLUMN IF NOT EXISTS last_tracking_error text;
