-- 1. Farm ownership / identity can never be reassigned through an UPDATE.
CREATE OR REPLACE FUNCTION public.guard_farm_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Farm identity cannot be changed';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Farm ownership cannot be transferred';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_farm_identity ON public.farms;
CREATE TRIGGER guard_farm_identity
  BEFORE UPDATE ON public.farms
  FOR EACH ROW EXECUTE FUNCTION public.guard_farm_identity();

-- 2. Explicit staff-roster write policies (owner / staff.manage only).
DROP POLICY IF EXISTS "Staff managers add members" ON public.farm_members;
CREATE POLICY "Staff managers add members" ON public.farm_members
  FOR INSERT TO authenticated
  WITH CHECK (can(farm_id, 'staff.manage'));

DROP POLICY IF EXISTS "Staff managers update members" ON public.farm_members;
CREATE POLICY "Staff managers update members" ON public.farm_members
  FOR UPDATE TO authenticated
  USING (can(farm_id, 'staff.manage'))
  WITH CHECK (can(farm_id, 'staff.manage'));

DROP POLICY IF EXISTS "Staff managers remove members" ON public.farm_members;
CREATE POLICY "Staff managers remove members" ON public.farm_members
  FOR DELETE TO authenticated
  USING (can(farm_id, 'staff.manage') AND user_id IS DISTINCT FROM auth.uid());

-- No self privilege escalation: nobody may change their own role/status/farm,
-- and no member row may be moved between farms.
CREATE OR REPLACE FUNCTION public.guard_farm_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.farm_id IS DISTINCT FROM OLD.farm_id THEN
    RAISE EXCEPTION 'Membership cannot be moved to another farm';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Membership cannot be reassigned to another user';
  END IF;
  IF OLD.user_id = auth.uid()
     AND (NEW.role_key IS DISTINCT FROM OLD.role_key OR NEW.status IS DISTINCT FROM OLD.status
          OR NEW.custom_permissions IS DISTINCT FROM OLD.custom_permissions) THEN
    RAISE EXCEPTION 'You cannot change your own role, status or permissions';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_farm_member_update ON public.farm_members;
CREATE TRIGGER guard_farm_member_update
  BEFORE UPDATE ON public.farm_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_farm_member_update();

-- The owner row is protected from removal even by staff managers.
CREATE OR REPLACE FUNCTION public.guard_farm_member_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owner uuid;
BEGIN
  SELECT owner_id INTO owner FROM public.farms WHERE id = OLD.farm_id;
  IF OLD.user_id IS NOT NULL AND OLD.user_id = owner THEN
    RAISE EXCEPTION 'The farm owner cannot be removed from the farm';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_farm_member_delete ON public.farm_members;
CREATE TRIGGER guard_farm_member_delete
  BEFORE DELETE ON public.farm_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_farm_member_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_members TO authenticated;
GRANT ALL ON public.farm_members TO service_role;

-- 3. Trigger functions are never callable as ordinary RPCs.
REVOKE ALL ON FUNCTION public.guard_farm_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_farm_member_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_farm_member_delete() FROM PUBLIC, anon, authenticated;