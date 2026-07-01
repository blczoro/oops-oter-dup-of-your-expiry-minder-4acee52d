
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  title text NOT NULL,
  reminder_type text NOT NULL DEFAULT 'Other',
  reminder_date date NOT NULL,
  notes text,
  notify_days_before integer NOT NULL DEFAULT 1,
  recurrence text NOT NULL DEFAULT 'none',
  recurrence_custom_days integer,
  ends_type text NOT NULL DEFAULT 'never',
  ends_after_count integer,
  ends_on_date date,
  status text NOT NULL DEFAULT 'active',
  snoozed_until date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders" ON public.reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reminders" ON public.reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders" ON public.reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders" ON public.reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_reminders_user_date ON public.reminders(user_id, reminder_date);
