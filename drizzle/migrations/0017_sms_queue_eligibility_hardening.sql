CREATE OR REPLACE FUNCTION public.sms_claim_batch(p_campaign uuid,p_actor uuid) RETURNS SETOF public.sms_recipients LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE c public.sms_campaigns;
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 SELECT * INTO c FROM public.sms_campaigns WHERE id=p_campaign FOR UPDATE;
 IF c.id IS NULL OR c.status NOT IN ('queued','sending') THEN RETURN; END IF;
 UPDATE public.sms_recipients SET status='unknown',failure_reason='Interrupted submission; reconcile before any resend',updated_at=now() WHERE campaign_id=p_campaign AND status='sending' AND claimed_at<now()-interval '5 minutes';
 UPDATE public.sms_recipients r SET status='excluded',failure_reason='Consent, account eligibility or registered number changed',updated_at=now() WHERE r.campaign_id=p_campaign AND r.status='pending' AND NOT EXISTS(SELECT 1 FROM public.sms_audience_source('service') a LEFT JOIN public.communication_preferences cp ON cp.user_id=a.user_id WHERE a.user_id=r.user_id AND a.phone=r.phone AND a.eligible AND (c.category='service' OR cp.marketing_opt_in=true));
 UPDATE public.sms_campaigns SET status='sending' WHERE id=p_campaign;
 RETURN QUERY WITH claim AS (SELECT id FROM public.sms_recipients WHERE campaign_id=p_campaign AND status='pending' ORDER BY id LIMIT 5 FOR UPDATE SKIP LOCKED)
 UPDATE public.sms_recipients r SET status='sending',attempts=attempts+1,claimed_at=now(),updated_at=now() FROM claim WHERE r.id=claim.id RETURNING r.*;
 END $$;
CREATE OR REPLACE FUNCTION public.sms_recipient_allowed(p_recipient uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.sms_recipients r JOIN public.sms_campaigns c ON c.id=r.campaign_id JOIN public.sms_audience_source('service') a ON a.user_id=r.user_id AND a.phone=r.phone LEFT JOIN public.communication_preferences cp ON cp.user_id=r.user_id WHERE r.id=p_recipient AND r.status='sending' AND c.status='sending' AND a.eligible AND (c.category='service' OR (cp.marketing_opt_in=true AND (
 (SELECT count(*) FROM public.engagement_messages em WHERE em.user_id=r.user_id AND em.category='marketing' AND em.status NOT IN ('skipped','failed') AND em.sent_at>now()-interval '24 hours') +
 (SELECT count(*) FROM public.sms_recipients other JOIN public.sms_campaigns oc ON oc.id=other.campaign_id WHERE other.user_id=r.user_id AND other.campaign_id<>r.campaign_id AND oc.category='marketing' AND other.status IN ('sending','accepted','sent','delivered','unknown') AND other.updated_at>now()-interval '24 hours')
 )<coalesce((public.engagement_frequency_limits()->>'per_day')::integer,1) AND (
 (SELECT count(*) FROM public.engagement_messages em WHERE em.user_id=r.user_id AND em.category='marketing' AND em.status NOT IN ('skipped','failed') AND em.sent_at>now()-interval '7 days') +
 (SELECT count(*) FROM public.sms_recipients other JOIN public.sms_campaigns oc ON oc.id=other.campaign_id WHERE other.user_id=r.user_id AND other.campaign_id<>r.campaign_id AND oc.category='marketing' AND other.status IN ('sending','accepted','sent','delivered','unknown') AND other.updated_at>now()-interval '7 days')
 )<coalesce((public.engagement_frequency_limits()->>'per_week')::integer,3))))
$$;
REVOKE ALL ON FUNCTION public.sms_claim_batch(uuid,uuid),public.sms_recipient_allowed(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_claim_batch(uuid,uuid),public.sms_recipient_allowed(uuid) TO service_role;