-- ============ 1. CUSTOM PER-MEMBER PERMISSIONS ============
ALTER TABLE public.farm_members
  ADD COLUMN IF NOT EXISTS custom_permissions BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.farm_member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.farm_members(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, permission)
);

GRANT SELECT ON public.farm_member_permissions TO authenticated;
GRANT ALL ON public.farm_member_permissions TO service_role;

ALTER TABLE public.farm_member_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_permissions_select" ON public.farm_member_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.farm_members m WHERE m.id = member_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.farms f WHERE f.id = farm_id AND f.owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_member_permissions_member ON public.farm_member_permissions(member_id);

-- Effective permissions for a member: owner => '*', custom list when enabled, else role defaults.
CREATE OR REPLACE FUNCTION public.member_effective_permissions(_member_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN m.role_key = 'owner' THEN ARRAY['*']::text[]
    WHEN m.custom_permissions THEN COALESCE(
      (SELECT array_agg(p.permission) FROM public.farm_member_permissions p WHERE p.member_id = m.id),
      ARRAY[]::text[])
    ELSE COALESCE(
      (SELECT array_agg(rp.permission) FROM public.role_permissions rp WHERE rp.role_key = m.role_key),
      ARRAY[]::text[])
  END
  FROM public.farm_members m
  WHERE m.id = _member_id;
$$;

CREATE OR REPLACE FUNCTION public.can(_farm uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _farm IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = _farm AND f.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.farm_members m
      WHERE m.farm_id = _farm AND m.user_id = auth.uid() AND m.status = 'active'
        AND public.member_effective_permissions(m.id) && ARRAY[_perm, '*']::text[]
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_recent(_farm uuid, _perm text, _created timestamp with time zone)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.can(_farm, _perm) AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = _farm AND f.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.farm_members m
      WHERE m.farm_id = _farm AND m.user_id = auth.uid() AND m.status = 'active'
        AND public.member_effective_permissions(m.id) && ARRAY['*']::text[]
    )
    OR _created > now() - interval '24 hours'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_farm_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _m RECORD; _perms text[];
BEGIN
  SELECT m.*, r.label AS role_label INTO _m
  FROM public.farm_members m JOIN public.farm_roles r ON r.key = m.role_key
  WHERE m.user_id = auth.uid()
  ORDER BY CASE WHEN m.role_key = 'owner' THEN 0 ELSE 1 END, m.created_at
  LIMIT 1;

  IF _m.id IS NULL THEN
    RETURN jsonb_build_object('has_membership', false);
  END IF;

  _perms := public.member_effective_permissions(_m.id);

  RETURN jsonb_build_object(
    'has_membership', true,
    'member_id', _m.id,
    'farm_id', _m.farm_id,
    'role', _m.role_key,
    'role_label', _m.role_label,
    'full_name', _m.full_name,
    'email', _m.email,
    'phone', _m.phone,
    'status', _m.status,
    'must_change_password', _m.must_change_password,
    'custom_permissions', COALESCE(_m.custom_permissions, false),
    'permissions', to_jsonb(_perms)
  );
END $$;

-- Owner-facing read of a member's access list.
CREATE OR REPLACE FUNCTION public.farm_staff_get_permissions(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _m RECORD;
BEGIN
  SELECT * INTO _m FROM public.farm_members WHERE id = _member_id;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF NOT public.can(_m.farm_id, 'staff.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'member_id', _m.id,
    'role', _m.role_key,
    'custom_permissions', _m.custom_permissions,
    'permissions', to_jsonb(public.member_effective_permissions(_m.id))
  );
END $$;

-- Owner-facing write. _custom = false restores the role defaults.
CREATE OR REPLACE FUNCTION public.farm_staff_set_permissions(_member_id uuid, _custom boolean, _permissions text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _m RECORD; _p TEXT;
BEGIN
  SELECT * INTO _m FROM public.farm_members WHERE id = _member_id;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF NOT public.can(_m.farm_id, 'staff.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _m.role_key = 'owner' THEN RAISE EXCEPTION 'cannot_restrict_owner'; END IF;

  DELETE FROM public.farm_member_permissions WHERE member_id = _member_id;

  IF _custom THEN
    FOREACH _p IN ARRAY COALESCE(_permissions, ARRAY[]::text[]) LOOP
      IF _p <> '*' AND length(trim(_p)) > 0 THEN
        INSERT INTO public.farm_member_permissions(member_id, farm_id, permission)
        VALUES (_member_id, _m.farm_id, trim(_p))
        ON CONFLICT (member_id, permission) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.farm_members SET custom_permissions = COALESCE(_custom, false), updated_at = now()
  WHERE id = _member_id;

  RETURN jsonb_build_object('ok', true, 'permissions', to_jsonb(public.member_effective_permissions(_member_id)));
END $$;

-- ============ 2. BROILER VACCINATION & MEDICATION ============
CREATE TABLE IF NOT EXISTS public.broiler_vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.broiler_batches(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  date_given DATE NOT NULL,
  age_days INTEGER,
  administered_by TEXT,
  notes TEXT,
  recorded_by UUID,
  recorded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broiler_vaccinations TO authenticated;
GRANT ALL ON public.broiler_vaccinations TO service_role;
ALTER TABLE public.broiler_vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broiler_vaccinations_select" ON public.broiler_vaccinations
  FOR SELECT TO authenticated USING (farm_id IN (SELECT public.my_farm_ids()));
CREATE POLICY "broiler_vaccinations_insert" ON public.broiler_vaccinations
  FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'health.write'));
CREATE POLICY "broiler_vaccinations_update" ON public.broiler_vaccinations
  FOR UPDATE TO authenticated
  USING (public.can_edit_recent(farm_id, 'health.write', created_at))
  WITH CHECK (public.can_edit_recent(farm_id, 'health.write', created_at));
CREATE POLICY "broiler_vaccinations_delete" ON public.broiler_vaccinations
  FOR DELETE TO authenticated USING (public.can(farm_id, 'health.delete'));

CREATE TABLE IF NOT EXISTS public.broiler_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.broiler_batches(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  dosage TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  purpose TEXT,
  notes TEXT,
  recorded_by UUID,
  recorded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broiler_medications TO authenticated;
GRANT ALL ON public.broiler_medications TO service_role;
ALTER TABLE public.broiler_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broiler_medications_select" ON public.broiler_medications
  FOR SELECT TO authenticated USING (farm_id IN (SELECT public.my_farm_ids()));
CREATE POLICY "broiler_medications_insert" ON public.broiler_medications
  FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'health.write'));
CREATE POLICY "broiler_medications_update" ON public.broiler_medications
  FOR UPDATE TO authenticated
  USING (public.can_edit_recent(farm_id, 'health.write', created_at))
  WITH CHECK (public.can_edit_recent(farm_id, 'health.write', created_at));
CREATE POLICY "broiler_medications_delete" ON public.broiler_medications
  FOR DELETE TO authenticated USING (public.can(farm_id, 'health.delete'));

CREATE TRIGGER broiler_vaccinations_touch BEFORE UPDATE ON public.broiler_vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER broiler_medications_touch BEFORE UPDATE ON public.broiler_medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_broiler_vacc_batch ON public.broiler_vaccinations(batch_id);
CREATE INDEX IF NOT EXISTS idx_broiler_med_batch ON public.broiler_medications(batch_id);