
CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  purchase_date DATE,
  expiry_date DATE NOT NULL,
  reminder_days INTEGER NOT NULL DEFAULT 7,
  notes TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own items" ON public.items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own items" ON public.items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own items" ON public.items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX items_user_id_idx ON public.items(user_id);
CREATE INDEX items_expiry_date_idx ON public.items(expiry_date);
