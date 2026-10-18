CREATE TABLE public.sms_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_user_id uuid NOT NULL, admin_label text NOT NULL,
 request_key uuid NOT NULL, title text NOT NULL, body text NOT NULL, category text NOT NULL CHECK(category IN ('service','marketing')),
 audience jsonb NOT NULL, segments integer NOT NULL CHECK(segments BETWEEN 1 AND 8), is_test boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','sending','completed','partially_failed','failed')),
 created_at timestamptz NOT NULL DEFAULT now(), queued_at timestamptz, completed_at timestamptz,
 UNIQUE(admin_user_id,request_key)
);
GRANT SELECT ON public.sms_campaigns TO authenticated;
GRANT ALL ON public.sms_campaigns TO service_role;
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_campaign_admin_read ON public.sms_campaigns FOR SELECT TO authenticated USING(public.is_super_admin());
CREATE TABLE public.sms_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.sms_campaigns(id), user_id uuid NOT NULL,
 phone text NOT NULL, display_name text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','sent','delivered','failed','rejected','unknown','excluded')),
 attempts integer NOT NULL DEFAULT 0, provider_message_id text, failure_reason text, claimed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,phone)
);
GRANT SELECT ON public.sms_recipients TO authenticated;
GRANT ALL ON public.sms_recipients TO service_role;
ALTER TABLE public.sms_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_recipient_admin_read ON public.sms_recipients FOR SELECT TO authenticated USING(public.is_super_admin());
CREATE INDEX sms_recipient_queue ON public.sms_recipients(campaign_id,status);
CREATE UNIQUE INDEX sms_provider_message_unique ON public.sms_recipients(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE TABLE public.sms_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.sms_campaigns(id), recipient_id uuid REFERENCES public.sms_recipients(id),
 actor_id uuid, event text NOT NULL, detail text, event_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_events TO authenticated;
GRANT ALL ON public.sms_events TO service_role;
ALTER TABLE public.sms_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_event_admin_read ON public.sms_events FOR SELECT TO authenticated USING(public.is_super_admin());
CREATE INDEX sms_event_history ON public.sms_events(campaign_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.sms_normalize_phone(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 WITH raw AS (SELECT regexp_replace(trim(coalesce(p,'')),'[^0-9]','','g') d WHERE trim(coalesce(p,'')) ~ '^[+0-9 ().-]+$'), norm AS (
 SELECT CASE WHEN d ~ '^0[789][01][0-9]{8}$' THEN '234'||substring(d FROM 2) WHEN d ~ '^[789][01][0-9]{8}$' THEN '234'||d WHEN d LIKE '00234%' THEN substring(d FROM 3) ELSE d END d FROM raw)
 SELECT '+'||d FROM norm WHERE d ~ '^234[789][01][0-9]{8}$'
$$;
CREATE OR REPLACE FUNCTION public.sms_audience_source(p_category text) RETURNS TABLE(user_id uuid,display_name text,phone text,verified boolean,role_key text,eligible boolean,exclusion text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH base AS (
 SELECT u.id uid,coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),fm.full_name,f.owner_name,'Registered user') nm,
 public.sms_normalize_phone(coalesce(nullif(u.phone,''),nullif(u.raw_user_meta_data->>'phone',''),nullif(fm.phone,''),nullif(f.phone,''),nullif(cp.phone,''))) ph,
 u.phone_confirmed_at IS NOT NULL AND public.sms_normalize_phone(u.phone) IS NOT NULL ver,
 coalesce(ur.role::text,'user') rk, coalesce(cp.sms_opt_in,false) sms, coalesce(cp.marketing_opt_in,false) marketing,
 coalesce(f.status,'active') fs, coalesce(fm.status,'active') ms
 FROM auth.users u
 LEFT JOIN public.communication_preferences cp ON cp.user_id=u.id
 LEFT JOIN LATERAL (SELECT m.full_name,m.phone,m.status FROM public.farm_members m WHERE m.user_id=u.id ORDER BY (m.status='active') DESC,m.created_at LIMIT 1) fm ON true
 LEFT JOIN LATERAL (SELECT x.owner_name,x.phone,x.status FROM public.farms x WHERE x.owner_id=u.id ORDER BY x.created_at LIMIT 1) f ON true
 LEFT JOIN public.user_roles ur ON ur.user_id=u.id AND ur.role='super_admin'
 ), scored AS (SELECT *, CASE WHEN ph IS NULL THEN 'Missing or invalid Nigerian mobile number' WHEN fs='suspended' OR ms<>'active' THEN 'Account inactive' WHEN NOT sms THEN 'No SMS consent' WHEN p_category='marketing' AND NOT marketing THEN 'No promotional consent' WHEN p_category='marketing' AND EXISTS (SELECT 1 FROM public.engagement_messages em WHERE em.user_id=uid AND em.category='marketing' AND em.status NOT IN ('skipped','failed') AND em.sent_at>now()-interval '24 hours') THEN 'Recent promotional contact' WHEN p_category='marketing' AND EXISTS (SELECT 1 FROM public.sms_recipients sr JOIN public.sms_campaigns sc ON sc.id=sr.campaign_id WHERE sr.user_id=uid AND sc.category='marketing' AND sr.status IN ('sending','accepted','sent','delivered','unknown') AND sr.updated_at>now()-interval '24 hours') THEN 'Recent promotional SMS' ELSE NULL END ex FROM base)
 SELECT uid,nm,ph,ver,rk,ex IS NULL,ex FROM scored
$$;
REVOKE ALL ON FUNCTION public.sms_audience_source(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_audience_source(text) TO service_role;
CREATE OR REPLACE FUNCTION public.sms_admin_audience(p_category text DEFAULT 'service',p_search text DEFAULT '',p_role text DEFAULT 'all',p_verified boolean DEFAULT false,p_page integer DEFAULT 0,p_selected uuid[] DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
 DECLARE result jsonb;
 BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
 IF p_category NOT IN ('service','marketing') OR p_role NOT IN ('all','user','super_admin') OR length(p_search)>100 OR p_page<0 THEN RAISE EXCEPTION 'Invalid audience'; END IF;
 WITH all_users AS (SELECT * FROM public.sms_audience_source(p_category)), filtered AS (
 SELECT * FROM all_users WHERE (p_role='all' OR role_key=p_role) AND (NOT p_verified OR verified) AND (p_selected IS NULL OR user_id=ANY(p_selected))
 ), page_rows AS (SELECT * FROM filtered WHERE display_name ILIKE '%'||p_search||'%' OR phone ILIKE '%'||p_search||'%' ORDER BY display_name,user_id LIMIT 25 OFFSET least(p_page,10000)*25)
 SELECT jsonb_build_object('total_registered',(SELECT count(*) FROM all_users),'valid_phones',(SELECT count(*) FROM all_users WHERE phone IS NOT NULL),'eligible',(SELECT count(DISTINCT phone) FROM filtered WHERE eligible),'excluded',(SELECT count(*) FROM filtered WHERE NOT eligible),'duplicate_phones',(SELECT count(*)-count(DISTINCT phone) FROM filtered WHERE eligible),'total_matches',(SELECT count(*) FROM filtered WHERE display_name ILIKE '%'||p_search||'%' OR phone ILIKE '%'||p_search||'%'),'rows',coalesce((SELECT jsonb_agg(to_jsonb(page_rows)) FROM page_rows),'[]'::jsonb)) INTO result;
 RETURN result;
 END $$;
REVOKE ALL ON FUNCTION public.sms_admin_audience(text,text,text,boolean,integer,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sms_admin_audience(text,text,text,boolean,integer,uuid[]) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.sms_create_campaign(p_actor uuid,p_request uuid,p_title text,p_body text,p_category text,p_segments integer,p_role text,p_verified boolean,p_selected uuid[],p_test boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE cid uuid; existing uuid; recent integer;
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 SELECT id INTO existing FROM public.sms_campaigns WHERE admin_user_id=p_actor AND request_key=p_request;
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_actor::text));
 SELECT count(*) INTO recent FROM public.sms_campaigns WHERE admin_user_id=p_actor AND created_at>now()-interval '1 hour';
 IF recent>=10 THEN RAISE EXCEPTION 'Campaign limit reached; try again later'; END IF;
 IF length(trim(p_title)) NOT BETWEEN 1 AND 120 OR length(trim(p_body)) NOT BETWEEN 1 AND 1200 OR p_segments NOT BETWEEN 1 AND 8 OR p_category NOT IN ('service','marketing') OR p_role NOT IN ('all','user','super_admin') OR p_body !~* 'poultrypro' THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
 IF p_category='marketing' AND p_body NOT LIKE '%https://poultrypro.life/settings%' THEN RAISE EXCEPTION 'Promotional preferences link required'; END IF;
 IF EXISTS(SELECT 1 FROM public.sms_campaigns WHERE admin_user_id=p_actor AND body=p_body AND category=p_category AND created_at>now()-interval '10 minutes') THEN RAISE EXCEPTION 'An identical recent campaign already exists'; END IF;
 INSERT INTO public.sms_campaigns(admin_user_id,admin_label,request_key,title,body,category,segments,is_test,audience)
 SELECT p_actor,coalesce(u.email,'Administrator'),p_request,trim(p_title),trim(p_body),p_category,p_segments,p_test,jsonb_build_object('role',p_role,'verified',p_verified,'selected',p_selected) FROM auth.users u WHERE u.id=p_actor RETURNING id INTO cid;
 INSERT INTO public.sms_recipients(campaign_id,user_id,phone,display_name)
 SELECT cid,user_id,phone,display_name FROM (SELECT DISTINCT ON (phone) * FROM public.sms_audience_source(p_category) WHERE eligible AND (p_role='all' OR role_key=p_role) AND (NOT p_verified OR verified) AND (p_selected IS NULL OR user_id=ANY(p_selected)) AND (NOT p_test OR user_id=p_actor) ORDER BY phone,user_id) x;
 IF NOT EXISTS(SELECT 1 FROM public.sms_recipients WHERE campaign_id=cid) THEN RAISE EXCEPTION 'No eligible recipients'; END IF;
 INSERT INTO public.sms_events(campaign_id,actor_id,event) VALUES(cid,p_actor,'draft_created');
 INSERT INTO public.admin_audit_log(admin_user_id,action_type,new_value) VALUES(p_actor,'sms_campaign_created',jsonb_build_object('campaign_id',cid));
 RETURN cid;
 END $$;
REVOKE ALL ON FUNCTION public.sms_create_campaign(uuid,uuid,text,text,text,integer,text,boolean,uuid[],boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_create_campaign(uuid,uuid,text,text,text,integer,text,boolean,uuid[],boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.sms_queue_campaign(p_actor uuid,p_campaign uuid,p_count integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE c public.sms_campaigns; n integer;
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 SELECT * INTO c FROM public.sms_campaigns WHERE id=p_campaign FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Campaign not found'; END IF;
 IF c.status<>'draft' THEN RETURN; END IF;
 SELECT count(*) INTO n FROM public.sms_recipients WHERE campaign_id=p_campaign;
 IF n<>p_count OR n=0 THEN RAISE EXCEPTION 'Recipient count changed; review again'; END IF;
 IF c.created_at<now()-interval '30 minutes' THEN RAISE EXCEPTION 'Draft expired; prepare a new campaign'; END IF;
 UPDATE public.sms_campaigns SET status='queued',queued_at=now() WHERE id=p_campaign;
 INSERT INTO public.sms_events(campaign_id,actor_id,event,detail) VALUES(p_campaign,p_actor,'explicitly_confirmed',n::text||' recipients');
 INSERT INTO public.admin_audit_log(admin_user_id,action_type,new_value) VALUES(p_actor,'sms_campaign_confirmed',jsonb_build_object('campaign_id',p_campaign,'recipients',n));
 END $$;
REVOKE ALL ON FUNCTION public.sms_queue_campaign(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_queue_campaign(uuid,uuid,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.sms_claim_batch(p_campaign uuid,p_actor uuid) RETURNS SETOF public.sms_recipients LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE c public.sms_campaigns;
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 SELECT * INTO c FROM public.sms_campaigns WHERE id=p_campaign FOR UPDATE;
 IF c.status NOT IN ('queued','sending') THEN RETURN; END IF;
 UPDATE public.sms_recipients SET status='unknown',failure_reason='Interrupted submission; reconcile before any resend',updated_at=now() WHERE campaign_id=p_campaign AND status='sending' AND claimed_at<now()-interval '5 minutes';
 UPDATE public.sms_recipients r SET status='excluded',failure_reason='Consent, account eligibility or registered number changed',updated_at=now() WHERE r.campaign_id=p_campaign AND r.status='pending' AND NOT EXISTS(SELECT 1 FROM public.sms_audience_source(c.category) a WHERE a.user_id=r.user_id AND a.phone=r.phone AND a.eligible);
 UPDATE public.sms_campaigns SET status='sending' WHERE id=p_campaign;
 RETURN QUERY WITH claim AS (SELECT id FROM public.sms_recipients WHERE campaign_id=p_campaign AND status='pending' ORDER BY id LIMIT 5 FOR UPDATE SKIP LOCKED)
 UPDATE public.sms_recipients r SET status='sending',attempts=attempts+1,claimed_at=now(),updated_at=now() FROM claim WHERE r.id=claim.id RETURNING r.*;
 END $$;
REVOKE ALL ON FUNCTION public.sms_claim_batch(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_claim_batch(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.sms_record_result(p_recipient uuid,p_status text,p_reference text,p_reason text,p_actor uuid,p_event_key text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE r public.sms_recipients;
 BEGIN
 IF p_status NOT IN ('accepted','sent','delivered','failed','rejected','unknown','excluded') THEN RAISE EXCEPTION 'Invalid delivery status'; END IF;
 SELECT * INTO r FROM public.sms_recipients WHERE id=p_recipient FOR UPDATE;
 IF r.id IS NULL THEN RETURN; END IF;
 IF p_event_key IS NOT NULL AND EXISTS(SELECT 1 FROM public.sms_events WHERE event_key=p_event_key) THEN RETURN; END IF;
 IF r.status='delivered' OR (r.status='sent' AND p_status='accepted') OR (r.status IN ('failed','rejected','excluded') AND p_status IN ('accepted','sent')) THEN RETURN; END IF;
 UPDATE public.sms_recipients SET status=p_status,provider_message_id=coalesce(p_reference,provider_message_id),failure_reason=left(p_reason,300),updated_at=now() WHERE id=p_recipient;
 INSERT INTO public.sms_events(campaign_id,recipient_id,actor_id,event,detail,event_key) VALUES(r.campaign_id,r.id,p_actor,p_status,left(p_reason,300),p_event_key);
 END $$;
REVOKE ALL ON FUNCTION public.sms_record_result(uuid,text,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_record_result(uuid,text,text,text,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.sms_finish_campaign(p_campaign uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE good integer; bad integer; outstanding integer; s text;
 BEGIN
 PERFORM 1 FROM public.sms_campaigns WHERE id=p_campaign AND status<>'draft' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT count(*) FILTER(WHERE status IN ('accepted','sent','delivered')),count(*) FILTER(WHERE status IN ('failed','rejected','unknown','excluded')),count(*) FILTER(WHERE status IN ('pending','sending')) INTO good,bad,outstanding FROM public.sms_recipients WHERE campaign_id=p_campaign;
 IF outstanding>0 THEN RETURN; END IF;
 s:=CASE WHEN bad=0 THEN 'completed' WHEN good=0 THEN 'failed' ELSE 'partially_failed' END;
 UPDATE public.sms_campaigns SET status=s,completed_at=now() WHERE id=p_campaign AND status<>s;
 IF FOUND THEN INSERT INTO public.sms_events(campaign_id,event,detail) VALUES(p_campaign,'processing_finished','Delivery confirmation remains separate from provider acceptance'); END IF;
 END $$;
REVOKE ALL ON FUNCTION public.sms_finish_campaign(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_finish_campaign(uuid) TO service_role;