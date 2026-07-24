ALTER TABLE public.labels
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_address text,
  ADD COLUMN IF NOT EXISTS sender_phone text,
  ADD COLUMN IF NOT EXISTS sender_website text,
  ADD COLUMN IF NOT EXISTS sender_review_url text;