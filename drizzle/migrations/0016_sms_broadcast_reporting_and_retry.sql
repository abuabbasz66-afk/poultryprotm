CREATE OR REPLACE FUNCTION public.sms_admin_overview() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
 BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
 RETURN jsonb_build_object('total_registered',(SELECT count(*) FROM auth.users),'valid_phones',(SELECT count(*) FROM public.sms_audience_source('service') WHERE phone IS NOT NULL),'messages_sent',(SELECT count(*) FROM public.sms_recipients WHERE status IN ('sent','delivered')),'accepted',(SELECT count(*) FROM public.sms_recipients WHERE status='accepted'),'delivered',(SELECT count(*) FROM public.sms_recipients WHERE status='delivered'),'delivery_final',(SELECT count(*) FROM public.sms_recipients WHERE status IN ('delivered','failed','rejected')));
 END $$;
REVOKE ALL ON FUNCTION public.sms_admin_overview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sms_admin_overview() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.sms_admin_campaign_counts(p_campaign uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
 BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
 RETURN (SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb) FROM (SELECT status,count(*) n FROM public.sms_recipients WHERE campaign_id=p_campaign GROUP BY status) x);
 END $$;
REVOKE ALL ON FUNCTION public.sms_admin_campaign_counts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sms_admin_campaign_counts(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.sms_recipient_allowed(p_recipient uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.sms_recipients r JOIN public.sms_campaigns c ON c.id=r.campaign_id JOIN public.sms_audience_source('service') a ON a.user_id=r.user_id AND a.phone=r.phone LEFT JOIN public.communication_preferences cp ON cp.user_id=r.user_id WHERE r.id=p_recipient AND r.status='sending' AND c.status='sending' AND a.eligible AND (c.category='service' OR (cp.marketing_opt_in=true AND NOT EXISTS(SELECT 1 FROM public.sms_recipients other JOIN public.sms_campaigns oc ON oc.id=other.campaign_id WHERE other.user_id=r.user_id AND other.campaign_id<>r.campaign_id AND oc.category='marketing' AND other.status IN ('sending','accepted','sent','delivered','unknown') AND other.updated_at>now()-interval '24 hours') AND NOT EXISTS(SELECT 1 FROM public.engagement_messages em WHERE em.user_id=r.user_id AND em.category='marketing' AND em.status NOT IN ('skipped','failed') AND em.sent_at>now()-interval '24 hours'))))
$$;
REVOKE ALL ON FUNCTION public.sms_recipient_allowed(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_recipient_allowed(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.sms_retry_rejected(p_actor uuid,p_campaign uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE n integer;
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 PERFORM 1 FROM public.sms_campaigns WHERE id=p_campaign AND status IN ('completed','failed','partially_failed') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign is still active'; END IF;
 UPDATE public.sms_recipients SET status='pending',failure_reason=NULL,updated_at=now() WHERE campaign_id=p_campaign AND status='rejected' AND provider_message_id IS NULL AND attempts<3;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=0 THEN RAISE EXCEPTION 'No safely rejected submissions eligible for retry'; END IF;
 UPDATE public.sms_campaigns SET status='queued',completed_at=NULL WHERE id=p_campaign;
 INSERT INTO public.sms_events(campaign_id,actor_id,event,detail) VALUES(p_campaign,p_actor,'retry_explicitly_confirmed',n::text||' rejected submissions; unknown submissions excluded');
 INSERT INTO public.admin_audit_log(admin_user_id,action_type,new_value) VALUES(p_actor,'sms_retry_confirmed',jsonb_build_object('campaign_id',p_campaign,'recipients',n));
 RETURN n;
 END $$;
REVOKE ALL ON FUNCTION public.sms_retry_rejected(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_retry_rejected(uuid,uuid) TO service_role;