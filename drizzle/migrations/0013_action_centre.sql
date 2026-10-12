ALTER TABLE public.farm_alert_states
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS evidence text,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS baseline_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS in_progress_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_by uuid,
  ADD COLUMN IF NOT EXISTS dismiss_reason text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;

ALTER TABLE public.farm_alert_states DROP CONSTRAINT farm_alert_states_status_chk;
ALTER TABLE public.farm_alert_states ADD CONSTRAINT farm_alert_states_status_chk
  CHECK (status IN ('active','acknowledged','assigned','in_progress','resolved','dismissed'));

CREATE TABLE public.farm_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  action text NOT NULL,
  from_status text,
  to_status text,
  note text,
  assigned_to uuid,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX farm_alert_events_farm_key_idx ON public.farm_alert_events (farm_id, alert_key, created_at DESC);

GRANT SELECT ON public.farm_alert_events TO authenticated;
GRANT ALL ON public.farm_alert_events TO service_role;
ALTER TABLE public.farm_alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farm members read alert events" ON public.farm_alert_events
  FOR SELECT TO authenticated USING (public.can(farm_id, 'dashboard.view'));

-- Category -> module write permission required to manage an alert.
CREATE OR REPLACE FUNCTION public.alert_manage_permission(_category text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _category
    WHEN 'production' THEN 'production.write'
    WHEN 'operations' THEN 'production.write'
    WHEN 'mortality' THEN 'mortality.write'
    WHEN 'feed' THEN 'feed.write'
    WHEN 'inventory' THEN 'inventory.write'
    WHEN 'health' THEN 'health.write'
    WHEN 'finance' THEN 'financials.write'
    ELSE 'dashboard.view' END
$$;

-- Browser writes (the sync step) may only open or auto-resolve alerts.
-- Workflow states and their fields change only through alert_transition().
CREATE OR REPLACE FUNCTION public.guard_alert_state()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.alert_rpc', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('active','resolved') OR NEW.assigned_to IS NOT NULL
       OR NEW.dismiss_reason IS NOT NULL OR NEW.resolution_note IS NOT NULL THEN
      RAISE EXCEPTION 'Use the alert actions to change this alert' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('active','resolved') THEN
    RAISE EXCEPTION 'Use the alert actions to change this alert' USING ERRCODE = '42501';
  END IF;
  -- Re-opening is allowed only from resolved, or from dismissed after its cooldown.
  IF NEW.status = 'active' AND OLD.status = 'dismissed'
     AND OLD.cooldown_until IS NOT NULL AND OLD.cooldown_until > now()
     AND NOT (NEW.severity = 'critical' AND OLD.severity <> 'critical') THEN
    RAISE EXCEPTION 'Alert is in its cooldown period' USING ERRCODE = '42501';
  END IF;
  IF (NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
     OR (NEW.dismiss_reason IS NOT NULL AND NEW.dismiss_reason IS DISTINCT FROM OLD.dismiss_reason)
     OR (NEW.resolution_note IS NOT NULL AND NEW.resolution_note IS DISTINCT FROM OLD.resolution_note)
     OR (NEW.acknowledged_by IS NOT NULL AND NEW.acknowledged_by IS DISTINCT FROM OLD.acknowledged_by) THEN
    RAISE EXCEPTION 'Use the alert actions to change this alert' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER farm_alert_states_guard BEFORE INSERT OR UPDATE ON public.farm_alert_states
  FOR EACH ROW EXECUTE FUNCTION public.guard_alert_state();

-- Every status change (manual or automatic) is written to the history.
CREATE OR REPLACE FUNCTION public.log_alert_state_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.alert_rpc', true), '') = '1' THEN
    RETURN NEW; -- alert_transition() writes its own event with the note
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO farm_alert_events (farm_id, alert_key, action, to_status, actor)
    VALUES (NEW.farm_id, NEW.alert_key, 'detected', NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO farm_alert_events (farm_id, alert_key, action, from_status, to_status, actor)
    VALUES (NEW.farm_id, NEW.alert_key,
      CASE WHEN NEW.status = 'resolved' THEN 'auto_resolved' ELSE 'reopened' END,
      OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER farm_alert_states_log AFTER INSERT OR UPDATE ON public.farm_alert_states
  FOR EACH ROW EXECUTE FUNCTION public.log_alert_state_event();

CREATE OR REPLACE FUNCTION public.alert_transition(
  _farm uuid, _key text, _action text,
  _note text DEFAULT NULL, _assignee uuid DEFAULT NULL, _alert jsonb DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r farm_alert_states%ROWTYPE;
  uid uuid := auth.uid();
  next_status text;
  perm text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  IF NOT public.can(_farm, 'dashboard.view') THEN
    RAISE EXCEPTION 'You do not have access to this farm' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM farm_alert_states WHERE farm_id = _farm AND alert_key = _key FOR UPDATE;
  IF NOT FOUND THEN
    IF _alert IS NULL THEN RAISE EXCEPTION 'Alert not found' USING ERRCODE = 'P0002'; END IF;
    PERFORM set_config('app.alert_rpc', '1', true);
    INSERT INTO farm_alert_states (farm_id, alert_key, category, severity, room, title, message, priority, evidence, generated_at, baseline_snapshot)
    VALUES (_farm, _key, _alert->>'category', _alert->>'severity', _alert->>'room', _alert->>'title',
      _alert->>'message', _alert->>'priority', _alert->>'evidence', now(), _alert->'snapshot')
    RETURNING * INTO r;
    INSERT INTO farm_alert_events (farm_id, alert_key, action, to_status, actor)
    VALUES (_farm, _key, 'detected', 'active', uid);
  END IF;

  perm := public.alert_manage_permission(r.category);
  IF _action <> 'acknowledge' AND NOT public.can(_farm, perm) THEN
    RAISE EXCEPTION 'You can view this alert but not manage it' USING ERRCODE = '42501';
  END IF;

  next_status := CASE _action
    WHEN 'acknowledge' THEN 'acknowledged'
    WHEN 'assign' THEN 'assigned'
    WHEN 'start' THEN 'in_progress'
    WHEN 'resolve' THEN 'resolved'
    WHEN 'dismiss' THEN 'dismissed'
    WHEN 'reopen' THEN 'active'
    WHEN 'note' THEN r.status
    ELSE NULL END;
  IF next_status IS NULL THEN RAISE EXCEPTION 'Unknown action' USING ERRCODE = '22023'; END IF;

  IF _action IN ('acknowledge','assign','start','resolve','dismiss') AND r.status IN ('resolved','dismissed') THEN
    RAISE EXCEPTION 'This alert is already closed' USING ERRCODE = '22023';
  END IF;
  IF _action = 'reopen' AND r.status NOT IN ('resolved','dismissed') THEN
    RAISE EXCEPTION 'Only closed alerts can be reopened' USING ERRCODE = '22023';
  END IF;
  IF _action = 'dismiss' AND coalesce(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'A reason is required to dismiss' USING ERRCODE = '22023';
  END IF;
  IF _action = 'note' AND coalesce(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'Note is empty' USING ERRCODE = '22023';
  END IF;
  IF _action = 'assign' THEN
    IF _assignee IS NULL OR NOT EXISTS (
      SELECT 1 FROM farm_members m WHERE m.farm_id = _farm AND m.user_id = _assignee AND m.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Choose an active member of this farm' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('app.alert_rpc', '1', true);
  UPDATE farm_alert_states SET
    status = next_status,
    acknowledged_at = CASE WHEN _action = 'acknowledge' THEN now() ELSE acknowledged_at END,
    acknowledged_by = CASE WHEN _action = 'acknowledge' THEN uid ELSE acknowledged_by END,
    assigned_to = CASE WHEN _action = 'assign' THEN _assignee ELSE assigned_to END,
    assigned_at = CASE WHEN _action = 'assign' THEN now() ELSE assigned_at END,
    in_progress_at = CASE WHEN _action = 'start' THEN now() ELSE in_progress_at END,
    resolved_at = CASE WHEN _action = 'resolve' THEN now() WHEN _action = 'reopen' THEN NULL ELSE resolved_at END,
    resolved_by = CASE WHEN _action = 'resolve' THEN uid WHEN _action = 'reopen' THEN NULL ELSE resolved_by END,
    resolution_note = CASE WHEN _action = 'resolve' THEN nullif(btrim(_note), '') ELSE resolution_note END,
    dismissed_at = CASE WHEN _action = 'dismiss' THEN now() WHEN _action = 'reopen' THEN NULL ELSE dismissed_at END,
    dismissed_by = CASE WHEN _action = 'dismiss' THEN uid WHEN _action = 'reopen' THEN NULL ELSE dismissed_by END,
    dismiss_reason = CASE WHEN _action = 'dismiss' THEN btrim(_note) WHEN _action = 'reopen' THEN NULL ELSE dismiss_reason END,
    cooldown_until = CASE WHEN _action = 'dismiss' THEN now() + interval '3 days' WHEN _action = 'reopen' THEN NULL ELSE cooldown_until END
  WHERE id = r.id;

  INSERT INTO farm_alert_events (farm_id, alert_key, action, from_status, to_status, note, assigned_to, actor)
  VALUES (_farm, _key, _action, r.status, next_status, nullif(btrim(_note), ''),
    CASE WHEN _action = 'assign' THEN _assignee END, uid);
  PERFORM set_config('app.alert_rpc', '', true);
  RETURN next_status;
END $$;

REVOKE ALL ON FUNCTION public.alert_transition(uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alert_transition(uuid, text, text, text, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.log_alert_state_event() FROM PUBLIC, anon, authenticated;
