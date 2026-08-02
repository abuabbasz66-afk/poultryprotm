-- ============ ROLE CATALOGUE ============
CREATE TABLE public.farm_roles (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.farm_roles TO authenticated;
GRANT ALL ON public.farm_roles TO service_role;
ALTER TABLE public.farm_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles are readable by signed-in users" ON public.farm_roles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.role_permissions (
  role_key text NOT NULL REFERENCES public.farm_roles(key) ON DELETE CASCADE,
  permission text NOT NULL,
  PRIMARY KEY (role_key, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Role permissions are readable by signed-in users" ON public.role_permissions FOR SELECT TO authenticated USING (true);

INSERT INTO public.farm_roles(key, label, description, sort_order) VALUES
  ('owner',   'Farm Owner',    'Full administrative control of the farm account.', 10),
  ('manager', 'Farm Manager',  'Runs daily farm operations and records.',          20),
  ('sales',   'Sales Officer', 'Manages sales, customers and payments.',           30);

INSERT INTO public.role_permissions(role_key, permission) VALUES ('owner', '*');

INSERT INTO public.role_permissions(role_key, permission)
SELECT 'manager', p FROM unnest(ARRAY[
  'dashboard.view',
  'production.read','production.write',
  'feed.read','feed.write',
  'inventory.read','inventory.write',
  'formulas.read',
  'health.read','health.write',
  'mortality.read','mortality.write',
  'rooms.read','rooms.write',
  'prices.read',
  'reports.read'
]) p;

INSERT INTO public.role_permissions(role_key, permission)
SELECT 'sales', p FROM unnest(ARRAY[
  'dashboard.view',
  'sales.read','sales.write',
  'customers.read','customers.write',
  'payments.read','payments.write',
  'prices.read'
]) p;

-- ============ FARM MEMBERS ============
CREATE TABLE public.farm_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  role_key text NOT NULL REFERENCES public.farm_roles(key),
  status text NOT NULL DEFAULT 'active',
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX farm_members_farm_user_idx ON public.farm_members(farm_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX farm_members_farm_email_idx ON public.farm_members(farm_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX farm_members_user_idx ON public.farm_members(user_id);
CREATE UNIQUE INDEX farm_members_phone_idx ON public.farm_members(phone) WHERE phone IS NOT NULL AND phone <> '';

GRANT SELECT ON public.farm_members TO authenticated;
GRANT ALL ON public.farm_members TO service_role;
ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER farm_members_updated_at BEFORE UPDATE ON public.farm_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACCESS HELPERS ============
CREATE OR REPLACE FUNCTION public.my_farm_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.farms WHERE owner_id = auth.uid()
  UNION
  SELECT farm_id FROM public.farm_members WHERE user_id = auth.uid() AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.can(_farm uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _farm IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.farms f WHERE f.id = _farm AND f.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.farm_members m
      JOIN public.role_permissions rp ON rp.role_key = m.role_key
      WHERE m.farm_id = _farm AND m.user_id = auth.uid() AND m.status = 'active'
        AND rp.permission IN (_perm, '*')
    )
  );
$$;

CREATE POLICY "Members read their farm roster" ON public.farm_members
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can(farm_id, 'staff.manage'));

-- Backfill owners as members, and keep it automatic for new farms.
INSERT INTO public.farm_members (farm_id, user_id, full_name, email, phone, role_key, status)
SELECT f.id, f.owner_id, COALESCE(f.owner_name, ''), u.email::text, f.phone, 'owner', 'active'
FROM public.farms f LEFT JOIN auth.users u ON u.id = f.owner_id
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.on_farm_created_add_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  SELECT u.email::text INTO _email FROM auth.users u WHERE u.id = NEW.owner_id;
  INSERT INTO public.farm_members (farm_id, user_id, full_name, email, phone, role_key, status)
  VALUES (NEW.id, NEW.owner_id, COALESCE(NEW.owner_name, ''), _email, NEW.phone, 'owner', 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER farms_add_owner_member AFTER INSERT ON public.farms
FOR EACH ROW EXECUTE FUNCTION public.on_farm_created_add_owner();

-- Session context for the app.
CREATE OR REPLACE FUNCTION public.my_farm_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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

  SELECT COALESCE(array_agg(permission), ARRAY[]::text[]) INTO _perms
  FROM public.role_permissions WHERE role_key = _m.role_key;

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
    'permissions', to_jsonb(_perms)
  );
END $$;

CREATE OR REPLACE FUNCTION public.touch_member_login()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.farm_members SET last_login_at = now() WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.farm_members SET must_change_password = false WHERE user_id = auth.uid();
$$;

-- Phone -> account email, exact match only, so staff can sign in with a phone number.
CREATE OR REPLACE FUNCTION public.resolve_login_email(_identifier text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.email FROM public.farm_members m
  WHERE m.status = 'active' AND m.email IS NOT NULL
    AND regexp_replace(COALESCE(m.phone,''), '[^0-9]', '', 'g') <> ''
    AND regexp_replace(COALESCE(m.phone,''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(_identifier,''), '[^0-9]', '', 'g')
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- Farm-scoped audit trail for owners.
CREATE OR REPLACE FUNCTION public.farm_activity_log(_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, created_at timestamptz, module text, action text, entity_id uuid,
              device text, browser text, ip_address text, success boolean,
              actor_name text, actor_email text, actor_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _farm uuid;
BEGIN
  SELECT farm_id FROM public.farm_members WHERE user_id = auth.uid()
   ORDER BY CASE WHEN role_key='owner' THEN 0 ELSE 1 END LIMIT 1 INTO _farm;
  IF _farm IS NULL OR NOT public.can(_farm, 'audit.read') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT a.id, a.created_at, a.module, a.action, a.entity_id,
         a.device, a.browser, a.ip_address, a.success,
         COALESCE(m.full_name, ''), COALESCE(m.email, u.email::text), COALESCE(r.label, 'Unknown')
  FROM public.platform_activity_log a
  LEFT JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN public.farm_members m ON m.user_id = a.user_id AND m.farm_id = a.farm_id
  LEFT JOIN public.farm_roles r ON r.key = m.role_key
  WHERE a.farm_id = _farm
  ORDER BY a.created_at DESC
  LIMIT COALESCE(_limit, 200);
END $$;

-- ============ REWRITE FARM DATA POLICIES ============
DROP POLICY "Owners manage their farm" ON public.farms;
CREATE POLICY "Members read their farm" ON public.farms FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR id IN (SELECT public.my_farm_ids()));
CREATE POLICY "Owners create their farm" ON public.farms FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Settings managers update the farm" ON public.farms FOR UPDATE TO authenticated
  USING (public.can(id, 'settings.write')) WITH CHECK (public.can(id, 'settings.write'));
CREATE POLICY "Owners delete their farm" ON public.farms FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY "Farm owner manages egg production" ON public.egg_production;
CREATE POLICY "Read production" ON public.egg_production FOR SELECT TO authenticated USING (public.can(farm_id,'production.read'));
CREATE POLICY "Insert production" ON public.egg_production FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'production.write'));
CREATE POLICY "Update production" ON public.egg_production FOR UPDATE TO authenticated USING (public.can(farm_id,'production.write')) WITH CHECK (public.can(farm_id,'production.write'));
CREATE POLICY "Delete production" ON public.egg_production FOR DELETE TO authenticated USING (public.can(farm_id,'production.delete'));

DROP POLICY "Farm owner manages feed usage" ON public.feed_usage;
CREATE POLICY "Read feed usage" ON public.feed_usage FOR SELECT TO authenticated USING (public.can(farm_id,'feed.read'));
CREATE POLICY "Insert feed usage" ON public.feed_usage FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'feed.write'));
CREATE POLICY "Update feed usage" ON public.feed_usage FOR UPDATE TO authenticated USING (public.can(farm_id,'feed.write')) WITH CHECK (public.can(farm_id,'feed.write'));
CREATE POLICY "Delete feed usage" ON public.feed_usage FOR DELETE TO authenticated USING (public.can(farm_id,'feed.delete'));

DROP POLICY "Farm owner manages feed_inventory" ON public.feed_inventory;
CREATE POLICY "Read inventory" ON public.feed_inventory FOR SELECT TO authenticated USING (public.can(farm_id,'inventory.read'));
CREATE POLICY "Insert inventory" ON public.feed_inventory FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'inventory.write'));
CREATE POLICY "Update inventory" ON public.feed_inventory FOR UPDATE TO authenticated USING (public.can(farm_id,'inventory.write')) WITH CHECK (public.can(farm_id,'inventory.write'));
CREATE POLICY "Delete inventory" ON public.feed_inventory FOR DELETE TO authenticated USING (public.can(farm_id,'inventory.delete'));

DROP POLICY "Farm owner manages feed_ledger" ON public.feed_ledger;
CREATE POLICY "Read ledger" ON public.feed_ledger FOR SELECT TO authenticated USING (public.can(farm_id,'inventory.read'));
CREATE POLICY "Insert ledger" ON public.feed_ledger FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'inventory.write'));
CREATE POLICY "Update ledger" ON public.feed_ledger FOR UPDATE TO authenticated USING (public.can(farm_id,'inventory.write')) WITH CHECK (public.can(farm_id,'inventory.write'));
CREATE POLICY "Delete ledger" ON public.feed_ledger FOR DELETE TO authenticated USING (public.can(farm_id,'inventory.delete'));

DROP POLICY "Farm owners manage their formulas" ON public.feed_formulas;
CREATE POLICY "Read formulas" ON public.feed_formulas FOR SELECT TO authenticated USING (public.can(farm_id,'formulas.read'));
CREATE POLICY "Insert formulas" ON public.feed_formulas FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'formulas.write'));
CREATE POLICY "Update formulas" ON public.feed_formulas FOR UPDATE TO authenticated USING (public.can(farm_id,'formulas.write')) WITH CHECK (public.can(farm_id,'formulas.write'));
CREATE POLICY "Delete formulas" ON public.feed_formulas FOR DELETE TO authenticated USING (public.can(farm_id,'formulas.write'));

DROP POLICY "Farm owners manage their ingredients" ON public.feed_formula_ingredients;
CREATE POLICY "Read ingredients" ON public.feed_formula_ingredients FOR SELECT TO authenticated USING (public.can(farm_id,'formulas.read'));
CREATE POLICY "Insert ingredients" ON public.feed_formula_ingredients FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'formulas.write'));
CREATE POLICY "Update ingredients" ON public.feed_formula_ingredients FOR UPDATE TO authenticated USING (public.can(farm_id,'formulas.write')) WITH CHECK (public.can(farm_id,'formulas.write'));
CREATE POLICY "Delete ingredients" ON public.feed_formula_ingredients FOR DELETE TO authenticated USING (public.can(farm_id,'formulas.write'));

DROP POLICY "Farm owner manages health records" ON public.health_records;
CREATE POLICY "Read health" ON public.health_records FOR SELECT TO authenticated USING (public.can(farm_id,'health.read'));
CREATE POLICY "Insert health" ON public.health_records FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'health.write'));
CREATE POLICY "Update health" ON public.health_records FOR UPDATE TO authenticated USING (public.can(farm_id,'health.write')) WITH CHECK (public.can(farm_id,'health.write'));
CREATE POLICY "Delete health" ON public.health_records FOR DELETE TO authenticated USING (public.can(farm_id,'health.delete'));

DROP POLICY "Farm owner manages mortality" ON public.mortality;
CREATE POLICY "Read mortality" ON public.mortality FOR SELECT TO authenticated USING (public.can(farm_id,'mortality.read'));
CREATE POLICY "Insert mortality" ON public.mortality FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'mortality.write'));
CREATE POLICY "Update mortality" ON public.mortality FOR UPDATE TO authenticated USING (public.can(farm_id,'mortality.write')) WITH CHECK (public.can(farm_id,'mortality.write'));
CREATE POLICY "Delete mortality" ON public.mortality FOR DELETE TO authenticated USING (public.can(farm_id,'mortality.delete'));

DROP POLICY "Farm owner manages rooms" ON public.rooms;
CREATE POLICY "Read rooms" ON public.rooms FOR SELECT TO authenticated USING (public.can(farm_id,'rooms.read'));
CREATE POLICY "Insert rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'rooms.write'));
CREATE POLICY "Update rooms" ON public.rooms FOR UPDATE TO authenticated USING (public.can(farm_id,'rooms.write')) WITH CHECK (public.can(farm_id,'rooms.write'));
CREATE POLICY "Delete rooms" ON public.rooms FOR DELETE TO authenticated USING (public.can(farm_id,'rooms.delete'));

DROP POLICY "Farm owner manages prices" ON public.prices;
CREATE POLICY "Read prices" ON public.prices FOR SELECT TO authenticated USING (public.can(farm_id,'prices.read'));
CREATE POLICY "Insert prices" ON public.prices FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'prices.write'));
CREATE POLICY "Update prices" ON public.prices FOR UPDATE TO authenticated USING (public.can(farm_id,'prices.write')) WITH CHECK (public.can(farm_id,'prices.write'));
CREATE POLICY "Delete prices" ON public.prices FOR DELETE TO authenticated USING (public.can(farm_id,'prices.delete'));

DROP POLICY "Farm owner reads price history" ON public.price_history;
DROP POLICY "Farm owner writes price history" ON public.price_history;
CREATE POLICY "Read price history" ON public.price_history FOR SELECT TO authenticated USING (public.can(farm_id,'prices.read'));
CREATE POLICY "Write price history" ON public.price_history FOR INSERT TO authenticated WITH CHECK (public.can(farm_id,'prices.write'));