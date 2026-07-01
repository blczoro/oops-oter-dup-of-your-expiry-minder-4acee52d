
-- Documents table
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_item_id_idx ON public.documents(item_id);
CREATE INDEX documents_user_id_idx ON public.documents(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their documents"
  ON public.documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_share_access('item', item_id, 'viewer'));

CREATE POLICY "Owners can insert their documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete their documents"
  ON public.documents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Backups table
CREATE TABLE public.backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  size bigint NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX backups_user_id_idx ON public.backups(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own backups"
  ON public.backups FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger fn (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage RLS for the 'documents' bucket (path: {user_id}/{item_id}/{filename})
CREATE POLICY "Users read their own document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload their own document files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update their own document files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete their own document files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
