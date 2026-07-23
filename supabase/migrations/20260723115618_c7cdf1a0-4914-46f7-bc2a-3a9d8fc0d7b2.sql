
CREATE TABLE public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  receiver_name TEXT NOT NULL,
  receiver_address_line1 TEXT NOT NULL,
  receiver_address_line2 TEXT,
  receiver_city TEXT NOT NULL,
  receiver_state TEXT NOT NULL,
  receiver_pincode TEXT NOT NULL,
  receiver_mobile_1 TEXT NOT NULL,
  receiver_mobile_2 TEXT,
  courier_name TEXT NOT NULL,
  tracking_id TEXT NOT NULL,
  order_reference TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.labels TO anon, authenticated;
GRANT ALL ON public.labels TO service_role;

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to labels" ON public.labels FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_labels_created_at ON public.labels (created_at DESC);
CREATE INDEX idx_labels_status ON public.labels (status);
