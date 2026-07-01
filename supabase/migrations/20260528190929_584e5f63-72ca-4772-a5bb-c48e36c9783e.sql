ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS details_complete boolean NOT NULL DEFAULT false;