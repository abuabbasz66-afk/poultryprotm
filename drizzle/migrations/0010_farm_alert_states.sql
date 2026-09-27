CREATE TABLE public.farm_alert_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  source text NOT NULL DEFAULT 'intelligence',
  room text,
  title text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'active',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farm_id, alert_key),
  CONSTRAINT farm_alert_states_status_chk CHECK (status IN ('active','acknowledged','resolved')),
  CONSTRAINT farm_alert_states_severity_chk CHECK (severity IN ('normal','watch','warning','critical'))
);
CREATE INDEX farm_alert_states_farm_status_idx ON public.farm_alert_states (farm_id, status, last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.farm_alert_states TO authenticated;
GRANT ALL ON public.farm_alert_states TO service_role;

ALTER TABLE public.farm_alert_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm members read alert states" ON public.farm_alert_states
  FOR SELECT TO authenticated USING (public.can(farm_id, 'dashboard.view'));
CREATE POLICY "Farm members add alert states" ON public.farm_alert_states
  FOR INSERT TO authenticated WITH CHECK (public.can(farm_id, 'dashboard.view'));
CREATE POLICY "Farm members update alert states" ON public.farm_alert_states
  FOR UPDATE TO authenticated USING (public.can(farm_id, 'dashboard.view')) WITH CHECK (public.can(farm_id, 'dashboard.view'));

CREATE TRIGGER farm_alert_states_updated_at BEFORE UPDATE ON public.farm_alert_states
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();