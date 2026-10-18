CREATE OR REPLACE FUNCTION public.sms_guard_activation_setting()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF (TG_OP <> 'INSERT' AND OLD.key = 'sms_owner_activation') OR (TG_OP <> 'DELETE' AND NEW.key = 'sms_owner_activation') THEN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'SMS activation settings require protected owner controls'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sms_activation_setting_guard BEFORE INSERT OR UPDATE OR DELETE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.sms_guard_activation_setting();

CREATE OR REPLACE FUNCTION public.sms_activation_transition(p_actor uuid,p_action text,p_fingerprint text,p_campaign uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s jsonb; c public.sms_campaigns%ROWTYPE; r public.sms_recipients%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('sms_owner_activation'));
 SELECT value INTO s FROM public.platform_settings WHERE key='sms_owner_activation' FOR UPDATE;
 s:=coalesce(s,'{}'::jsonb);
 IF p_action='disable' THEN s:=s || jsonb_build_object('enabled',false);
 ELSIF p_action='verify' THEN
  IF length(p_fingerprint)<>64 THEN RAISE EXCEPTION 'Invalid configuration'; END IF;
  IF s->>'fingerprint' IS DISTINCT FROM p_fingerprint OR s->>'owner_id' IS DISTINCT FROM p_actor::text THEN s:='{}'::jsonb; END IF;
  s:=s || jsonb_build_object('fingerprint',p_fingerprint,'owner_id',p_actor,'verified_at',now(),'route_approved',true,'enabled',false);
 ELSE
  IF s->>'fingerprint' IS DISTINCT FROM p_fingerprint OR s->>'owner_id' IS DISTINCT FROM p_actor::text OR coalesce((s->>'verified_at')::timestamptz,'epoch')<now()-interval '24 hours' THEN RAISE EXCEPTION 'Verify current provider configuration first'; END IF;
  IF p_action='reserve_test' THEN
   SELECT * INTO c FROM public.sms_campaigns WHERE id=p_campaign;
   IF c.id IS NULL OR NOT c.is_test OR c.admin_user_id<>p_actor OR c.category<>'service' OR (SELECT count(*) FROM public.sms_recipients WHERE campaign_id=p_campaign)<>1 OR NOT EXISTS(SELECT 1 FROM public.sms_recipients WHERE campaign_id=p_campaign AND user_id=p_actor) THEN RAISE EXCEPTION 'Only a single owner service test is allowed'; END IF;
   IF s ? 'test_campaign' AND s->>'test_campaign'<>p_campaign::text THEN RAISE EXCEPTION 'One test already authorised; review its result before requesting another'; END IF;
   s:=s || jsonb_build_object('test_campaign',p_campaign,'test_authorised_at',now());
  ELSIF p_action='receipt' THEN
   IF s->>'test_campaign' IS DISTINCT FROM p_campaign::text THEN RAISE EXCEPTION 'Test does not match current verification'; END IF;
   SELECT * INTO r FROM public.sms_recipients WHERE campaign_id=p_campaign AND user_id=p_actor;
   IF r.id IS NULL OR r.provider_message_id IS NULL OR r.status NOT IN ('accepted','sent','delivered') THEN RAISE EXCEPTION 'Provider submission must be confirmed before confirming receipt'; END IF;
   s:=s || jsonb_build_object('receipt_confirmed_at',now(),'receipt_confirmed_by',p_actor);
  ELSIF p_action='enable' THEN
   IF NOT(s ? 'receipt_confirmed_at') THEN RAISE EXCEPTION 'Confirm receipt of the owner test first'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.sms_recipients WHERE campaign_id=(s->>'test_campaign')::uuid AND user_id=p_actor AND provider_message_id IS NOT NULL AND status IN ('accepted','sent','delivered')) THEN RAISE EXCEPTION 'Test result is not eligible for activation'; END IF;
   s:=s || jsonb_build_object('enabled',true,'enabled_at',now());
  ELSE RAISE EXCEPTION 'Invalid activation action'; END IF;
 END IF;
 INSERT INTO public.platform_settings(key,value,updated_at) VALUES('sms_owner_activation',s,now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
 INSERT INTO public.admin_audit_log(admin_user_id,action_type,new_value) VALUES(p_actor,'sms_activation_'||p_action,jsonb_build_object('campaign_id',p_campaign,'enabled',coalesce((s->>'enabled')::boolean,false)));
 RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.sms_activation_transition(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_activation_transition(uuid,text,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.sms_guard_activation_setting() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_guard_activation_setting() TO service_role;