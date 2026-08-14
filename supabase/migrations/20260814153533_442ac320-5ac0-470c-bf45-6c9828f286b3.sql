-- AI recommendations / insights lifecycle
CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  insight_key text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'monitor',
  title text NOT NULL,
  summary text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  feedback text,
  feedback_note text,
  acted_on text,
  outcome_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farm_id, insight_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_reco_select ON public.ai_recommendations FOR SELECT TO authenticated USING (can(farm_id, 'ai.view'));
CREATE POLICY ai_reco_insert ON public.ai_recommendations FOR INSERT TO authenticated WITH CHECK (can(farm_id, 'ai.view'));
CREATE POLICY ai_reco_update ON public.ai_recommendations FOR UPDATE TO authenticated USING (can(farm_id, 'ai.view')) WITH CHECK (can(farm_id, 'ai.view'));
CREATE POLICY ai_reco_delete ON public.ai_recommendations FOR DELETE TO authenticated USING (can(farm_id, 'settings.write'));
CREATE TRIGGER ai_recommendations_updated_at BEFORE UPDATE ON public.ai_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Data quality flags
CREATE TABLE public.ai_data_quality_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_id uuid,
  entry_date date,
  rule text NOT NULL,
  status text NOT NULL DEFAULT 'REVIEW_REQUIRED',
  detail text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farm_id, source_table, source_id, rule)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_data_quality_flags TO authenticated;
GRANT ALL ON public.ai_data_quality_flags TO service_role;
ALTER TABLE public.ai_data_quality_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_dq_select ON public.ai_data_quality_flags FOR SELECT TO authenticated USING (can(farm_id, 'ai.view'));
CREATE POLICY ai_dq_insert ON public.ai_data_quality_flags FOR INSERT TO authenticated WITH CHECK (can(farm_id, 'ai.view'));
CREATE POLICY ai_dq_update ON public.ai_data_quality_flags FOR UPDATE TO authenticated USING (can(farm_id, 'ai.view')) WITH CHECK (can(farm_id, 'ai.view'));
CREATE POLICY ai_dq_delete ON public.ai_data_quality_flags FOR DELETE TO authenticated USING (can(farm_id, 'settings.write'));
CREATE TRIGGER ai_dq_updated_at BEFORE UPDATE ON public.ai_data_quality_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AI assistant conversation (private to the user within their farm)
CREATE TABLE public.ai_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_assistant_messages TO authenticated;
GRANT ALL ON public.ai_assistant_messages TO service_role;
ALTER TABLE public.ai_assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_msg_select ON public.ai_assistant_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND can(farm_id, 'ai.view'));
CREATE POLICY ai_msg_insert ON public.ai_assistant_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND can(farm_id, 'ai.view'));
CREATE POLICY ai_msg_delete ON public.ai_assistant_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX ai_msg_farm_user_idx ON public.ai_assistant_messages (farm_id, user_id, created_at DESC);

-- Model versioning / performance metadata (platform level)
CREATE TABLE public.ai_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  trained_at timestamptz NOT NULL DEFAULT now(),
  data_period_start date,
  data_period_end date,
  farms_used integer NOT NULL DEFAULT 0,
  records_used integer NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_model_versions TO authenticated;
GRANT ALL ON public.ai_model_versions TO service_role;
ALTER TABLE public.ai_model_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_model_select ON public.ai_model_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY ai_model_admin_all ON public.ai_model_versions FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE TRIGGER ai_model_versions_updated_at BEFORE UPDATE ON public.ai_model_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ai_model_versions (version, status, data_period_start, data_period_end, farms_used, records_used, metrics, notes)
VALUES (
  'v1.0-baseline',
  'active',
  CURRENT_DATE - 180,
  CURRENT_DATE,
  0,
  0,
  '{"method":"deterministic-baseline","forecast":"trend + farm baseline","validation":"backtested on farm history"}'::jsonb,
  'Phase 1-2 statistical intelligence engine: farm baselines, anomaly detection, short-horizon forecasting. No cross-farm model training yet.'
);
