
CREATE TABLE public.reminder_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('reminder','item')),
  source_id uuid NOT NULL,
  title text NOT NULL,
  reminder_type text NOT NULL DEFAULT 'Other',
  original_date date NOT NULL,
  recurrence text NOT NULL DEFAULT 'none',
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX reminder_completions_user_idx ON public.reminder_completions(user_id, completed_at DESC);
CREATE INDEX reminder_completions_source_idx ON public.reminder_completions(source_type, source_id, original_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_completions TO authenticated;
GRANT ALL ON public.reminder_completions TO service_role;

ALTER TABLE public.reminder_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own completions" ON public.reminder_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own completions" ON public.reminder_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own completions" ON public.reminder_completions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own completions" ON public.reminder_completions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
