CREATE TABLE public.export_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_name text,
  export_label text NOT NULL,
  scope text NOT NULL,
  format text NOT NULL,
  record_types text[] NOT NULL DEFAULT '{}',
  range_label text NOT NULL,
  range_from date,
  range_to date,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.export_audit_log TO authenticated;
GRANT ALL ON public.export_audit_log TO service_role;

ALTER TABLE public.export_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members insert own export log"
ON public.export_audit_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can(farm_id, 'dashboard.view'));

CREATE POLICY "Own exports readable"
ON public.export_audit_log FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can(farm_id, 'audit.read'));

CREATE INDEX export_audit_log_farm_created_idx ON public.export_audit_log (farm_id, created_at DESC);