-- 1. Recommendation lifecycle fields ---------------------------------------
ALTER TABLE public.ai_recommendations
  ADD COLUMN IF NOT EXISTS room_label text,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_date timestamptz,
  ADD COLUMN IF NOT EXISTS before_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS after_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS intelligence_version text NOT NULL DEFAULT 'v1.1',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS ai_reco_farm_status_idx ON public.ai_recommendations (farm_id, status, created_at DESC);

-- 2. Learning signals -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES public.ai_recommendations(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  insight_key text,
  category text,
  weight numeric NOT NULL DEFAULT 1,
  trusted boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  intelligence_version text NOT NULL DEFAULT 'v1.1',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_learning_signals TO authenticated;
GRANT ALL ON public.ai_learning_signals TO service_role;

ALTER TABLE public.ai_learning_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_signal_select ON public.ai_learning_signals
  FOR SELECT TO authenticated USING (can(farm_id, 'ai.view'));
CREATE POLICY ai_signal_insert ON public.ai_learning_signals
  FOR INSERT TO authenticated WITH CHECK (can(farm_id, 'ai.view'));

CREATE INDEX IF NOT EXISTS ai_signal_farm_idx ON public.ai_learning_signals (farm_id, created_at DESC);

-- 3. Recommendation performance (farm-scoped) -------------------------------
CREATE OR REPLACE FUNCTION public.ai_recommendation_performance(_farm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT can(_farm_id, 'ai.view') THEN
    RAISE EXCEPTION 'Not authorised for this farm';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'approved', count(*) FILTER (WHERE status = 'approved'),
    'rejected', count(*) FILTER (WHERE status = 'rejected'),
    'completed', count(*) FILTER (WHERE status = 'completed'),
    'dismissed', count(*) FILTER (WHERE status = 'dismissed'),
    'open', count(*) FILTER (WHERE status IN ('open','new','viewed')),
    'outcome_improved', count(*) FILTER (WHERE outcome = 'improved'),
    'outcome_no_change', count(*) FILTER (WHERE outcome = 'no_change'),
    'outcome_worse', count(*) FILTER (WHERE outcome = 'worse'),
    'outcome_too_early', count(*) FILTER (WHERE outcome = 'too_early'),
    'avg_confidence', coalesce(round(avg(confidence)), 0),
    'signals', (SELECT count(*) FROM ai_learning_signals s WHERE s.farm_id = _farm_id AND s.trusted)
  )
  INTO result
  FROM ai_recommendations r
  WHERE r.farm_id = _farm_id;

  RETURN coalesce(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_recommendation_performance(uuid) TO authenticated;

-- 4. Anonymous cross-farm benchmarks ---------------------------------------
CREATE OR REPLACE FUNCTION public.ai_farm_benchmarks(_farm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  min_sample constant int := 5;
  my_birds numeric;
  lo numeric;
  hi numeric;
  peers int;
  result jsonb;
BEGIN
  IF NOT can(_farm_id, 'ai.view') THEN
    RAISE EXCEPTION 'Not authorised for this farm';
  END IF;

  WITH farm_birds AS (
    SELECT f.id AS farm_id,
           coalesce(sum(r.current), 0)::numeric AS birds
    FROM farms f
    LEFT JOIN rooms r ON r.farm_id = f.id AND coalesce(r.status,'active') = 'active'
    GROUP BY f.id
  ),
  farm_metrics AS (
    SELECT b.farm_id,
           b.birds,
           (SELECT coalesce(sum(m.loss),0)::numeric
              FROM mortality m
             WHERE m.farm_id = b.farm_id
               AND m.date >= to_char(current_date - 30, 'YYYY-MM-DD')) AS deaths30,
           (SELECT coalesce(sum(fu.bags),0)::numeric
              FROM feed_usage fu
             WHERE fu.farm_id = b.farm_id
               AND fu.date >= to_char(current_date - 30, 'YYYY-MM-DD')) AS bags30,
           (SELECT coalesce(sum(e.r2 + e.r3 + e.r4 + e.extra),0)::numeric
              FROM egg_production e
             WHERE e.farm_id = b.farm_id
               AND e.date >= to_char(current_date - 30, 'YYYY-MM-DD')) AS crates30
    FROM farm_birds b
    WHERE b.birds > 0
  ),
  scored AS (
    SELECT farm_id,
           birds,
           CASE WHEN birds > 0 THEN (deaths30 / birds) * 100 ELSE NULL END AS mortality_pct30,
           CASE WHEN birds > 0 THEN (crates30 * 30) / birds / 30 * 100 ELSE NULL END AS lay_pct30,
           CASE WHEN birds > 0 THEN (bags30 * 25) / birds / 30 ELSE NULL END AS feed_kg_bird_day
    FROM farm_metrics
  )
  SELECT s.birds INTO my_birds FROM scored s WHERE s.farm_id = _farm_id;

  IF my_birds IS NULL OR my_birds <= 0 THEN
    RETURN jsonb_build_object('available', false, 'reason', 'no_flock');
  END IF;

  lo := my_birds * 0.4;
  hi := my_birds * 2.5;

  WITH farm_birds AS (
    SELECT f.id AS farm_id, coalesce(sum(r.current),0)::numeric AS birds
    FROM farms f
    LEFT JOIN rooms r ON r.farm_id = f.id AND coalesce(r.status,'active') = 'active'
    GROUP BY f.id
  ),
  farm_metrics AS (
    SELECT b.farm_id, b.birds,
           (SELECT coalesce(sum(m.loss),0)::numeric FROM mortality m
             WHERE m.farm_id = b.farm_id AND m.date >= to_char(current_date - 30,'YYYY-MM-DD')) AS deaths30,
           (SELECT coalesce(sum(fu.bags),0)::numeric FROM feed_usage fu
             WHERE fu.farm_id = b.farm_id AND fu.date >= to_char(current_date - 30,'YYYY-MM-DD')) AS bags30,
           (SELECT coalesce(sum(e.r2 + e.r3 + e.r4 + e.extra),0)::numeric FROM egg_production e
             WHERE e.farm_id = b.farm_id AND e.date >= to_char(current_date - 30,'YYYY-MM-DD')) AS crates30
    FROM farm_birds b WHERE b.birds > 0
  ),
  scored AS (
    SELECT farm_id, birds,
           CASE WHEN birds > 0 THEN (deaths30 / birds) * 100 END AS mortality_pct30,
           CASE WHEN birds > 0 THEN (crates30 * 30) / birds / 30 * 100 END AS lay_pct30,
           CASE WHEN birds > 0 THEN (bags30 * 25) / birds / 30 END AS feed_kg_bird_day
    FROM farm_metrics
  ),
  peer AS (
    SELECT * FROM scored WHERE birds BETWEEN lo AND hi
  )
  SELECT jsonb_build_object(
    'available', (SELECT count(*) FROM peer) >= min_sample,
    'peer_count', (SELECT count(*) FROM peer),
    'min_sample', min_sample,
    'band', jsonb_build_object('low', round(lo), 'high', round(hi)),
    'mine', (SELECT jsonb_build_object(
                'lay_pct30', round(lay_pct30::numeric, 2),
                'mortality_pct30', round(mortality_pct30::numeric, 3),
                'feed_kg_bird_day', round(feed_kg_bird_day::numeric, 3))
             FROM peer WHERE farm_id = _farm_id),
    'peer_avg', (SELECT jsonb_build_object(
                'lay_pct30', round(avg(lay_pct30)::numeric, 2),
                'mortality_pct30', round(avg(mortality_pct30)::numeric, 3),
                'feed_kg_bird_day', round(avg(feed_kg_bird_day)::numeric, 3))
             FROM peer),
    'percentile_lay', (SELECT CASE WHEN count(*) > 0 THEN round(
                100.0 * count(*) FILTER (WHERE p.lay_pct30 <= (SELECT lay_pct30 FROM peer WHERE farm_id = _farm_id)) / count(*))
                END FROM peer p WHERE p.lay_pct30 IS NOT NULL)
  ) INTO result
  FROM (SELECT 1) x;

  RETURN coalesce(result, jsonb_build_object('available', false, 'reason', 'no_data'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_farm_benchmarks(uuid) TO authenticated;

-- 5. Intelligence version ---------------------------------------------------
INSERT INTO public.ai_model_versions (version, status, trained_at, farms_used, records_used, metrics, notes)
SELECT 'v1.1', 'active', now(), 0, 0,
       '{"kind":"deterministic-rules","loop":"approval-feedback-outcome"}'::jsonb,
       'Adds recommendation approval workflow, rejection reasons, outcome tracking with before/after metrics, traceable learning signals, anonymous cross-farm benchmarking and recommendation performance reporting.'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_model_versions WHERE version = 'v1.1');

UPDATE public.ai_model_versions SET status = 'superseded' WHERE version <> 'v1.1' AND status = 'active';