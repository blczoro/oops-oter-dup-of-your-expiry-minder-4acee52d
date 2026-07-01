
-- 1. Add visibility column to items and reminders
ALTER TABLE public.items
  ADD COLUMN visibility text NOT NULL DEFAULT 'personal'
    CHECK (visibility IN ('personal','shared'));

ALTER TABLE public.reminders
  ADD COLUMN visibility text NOT NULL DEFAULT 'personal'
    CHECK (visibility IN ('personal','shared'));

-- 2. Shares table: membership records per resource
CREATE TABLE public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('item','reminder')),
  resource_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_type, resource_id, member_user_id)
);
CREATE INDEX shares_member_idx ON public.shares (member_user_id, resource_type, resource_id);
CREATE INDEX shares_resource_idx ON public.shares (resource_type, resource_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shares TO authenticated;
GRANT ALL ON public.shares TO service_role;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- 3. Share invites: email or link based invites
CREATE TABLE public.share_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('item','reminder')),
  resource_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','editor')),
  email text,
  token text NOT NULL UNIQUE,
  revoked boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX share_invites_owner_idx ON public.share_invites (owner_id);
CREATE INDEX share_invites_resource_idx ON public.share_invites (resource_type, resource_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_invites TO authenticated;
GRANT ALL ON public.share_invites TO service_role;
ALTER TABLE public.share_invites ENABLE ROW LEVEL SECURITY;

-- 4. Security-definer helper: check share access without recursive RLS
CREATE OR REPLACE FUNCTION public.has_share_access(
  _resource_type text,
  _resource_id uuid,
  _min_role text DEFAULT 'viewer'
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shares s
    WHERE s.resource_type = _resource_type
      AND s.resource_id = _resource_id
      AND s.member_user_id = auth.uid()
      AND (
        _min_role = 'viewer'
        OR (_min_role = 'editor' AND s.role = 'editor')
      )
  );
$$;

-- 5. Replace items policies to include shared access
DROP POLICY IF EXISTS "Users can view own items" ON public.items;
DROP POLICY IF EXISTS "Users can update own items" ON public.items;
DROP POLICY IF EXISTS "Users can delete own items" ON public.items;
DROP POLICY IF EXISTS "Users can insert own items" ON public.items;

CREATE POLICY "Items: owner or shared member can view"
  ON public.items FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (visibility = 'shared' AND public.has_share_access('item', id, 'viewer'))
  );

CREATE POLICY "Items: owner or editor can update"
  ON public.items FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (visibility = 'shared' AND public.has_share_access('item', id, 'editor'))
  );

CREATE POLICY "Items: only owner can delete"
  ON public.items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Items: users insert their own"
  ON public.items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 6. Replace reminders policies similarly
DROP POLICY IF EXISTS "Users can view own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can insert own reminders" ON public.reminders;

CREATE POLICY "Reminders: owner or shared member can view"
  ON public.reminders FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (visibility = 'shared' AND public.has_share_access('reminder', id, 'viewer'))
  );

CREATE POLICY "Reminders: owner or editor can update"
  ON public.reminders FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (visibility = 'shared' AND public.has_share_access('reminder', id, 'editor'))
  );

CREATE POLICY "Reminders: only owner can delete"
  ON public.reminders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Reminders: users insert their own"
  ON public.reminders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 7. Shares policies
CREATE POLICY "Shares: owner or member can view"
  ON public.shares FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = member_user_id);

CREATE POLICY "Shares: only owner can insert"
  ON public.shares FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Shares: only owner can update"
  ON public.shares FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Shares: owner or member can delete"
  ON public.shares FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = member_user_id);

-- 8. Share invites policies
-- Owners manage their own invites; anyone authenticated can look up an invite by token via a server fn (uses admin client).
CREATE POLICY "Invites: owner can view"
  ON public.share_invites FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Invites: owner can insert"
  ON public.share_invites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Invites: owner can update"
  ON public.share_invites FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Invites: owner can delete"
  ON public.share_invites FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);
