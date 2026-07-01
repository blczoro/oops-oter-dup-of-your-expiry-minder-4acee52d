
-- Fix linter: restrict has_share_access EXECUTE to authenticated only
REVOKE EXECUTE ON FUNCTION public.has_share_access(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_share_access(text, uuid, text) TO authenticated, service_role;

-- Create reminder_completions (audit log of completions)
CREATE TABLE public.reminder_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('reminder','item')),
  source_id uuid NOT NULL,
  title text NOT NULL,
  reminder_type text NOT NULL,
  original_date date NOT NULL,
  recurrence text NOT NULL DEFAULT 'none',
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reminder_completions_user_idx ON public.reminder_completions (user_id, completed_at DESC);
CREATE INDEX reminder_completions_source_idx ON public.reminder_completions (source_type, source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_completions TO authenticated;
GRANT ALL ON public.reminder_completions TO service_role;

ALTER TABLE public.reminder_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Completions: users manage their own"
  ON public.reminder_completions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
