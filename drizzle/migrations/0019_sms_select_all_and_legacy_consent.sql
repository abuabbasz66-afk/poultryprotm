-- Audience with explicit consent status. Never writes consent.
-- granted: SMS opt-in recorded. declined: preferences saved with SMS off (or account messages off).
-- not_recorded: legacy account that never saved preferences.
CREATE OR REPLACE FUNCTION public.sms_audience_detail(p_category text)
RETURNS TABLE(user_id uuid,display_name text,phone text,verified boolean,role_key text,consent_status text,eligible boolean,exclusion text,consent_warning boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH base AS (
 SELECT u.id uid,coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),fm.full_name,f.owner_name,'Registered user') nm,
 public.sms_normalize_phone(coalesce(nullif(u.phone,''),nullif(u.raw_user_meta_data->>'phone',''),nullif(fm.phone,''),nullif(f.phone,''),nullif(cp.phone,''))) ph,
 u.phone_confirmed_at IS NOT NULL AND public.sms_normalize_phone(u.phone) IS NOT NULL ver,
 coalesce(ur.role::text,'user') rk,
 CASE WHEN cp.sms_opt_in THEN 'granted'
      WHEN cp.user_id IS NOT NULL AND (cp.consent_source IS NOT NULL OR cp.consent_date IS NOT NULL) THEN 'declined'
      ELSE 'not_recorded' END cs,
 coalesce(cp.marketing_opt_in,false) marketing,
 cp.user_id IS NOT NULL AND cp.subscription_notifications_opt_in = false AND cp.consent_source IS NOT NULL acct_off,
 coalesce(f.status,'active') fs, coalesce(fm.status,'active') ms
 FROM auth.users u
 LEFT JOIN public.communication_preferences cp ON cp.user_id=u.id
 LEFT JOIN LATERAL (SELECT m.full_name,m.phone,m.status FROM public.farm_members m WHERE m.user_id=u.id ORDER BY (m.status='active') DESC,m.created_at LIMIT 1) fm ON true
 LEFT JOIN LATERAL (SELECT x.owner_name,x.phone,x.status FROM public.farms x WHERE x.owner_id=u.id ORDER BY x.created_at LIMIT 1) f ON true
 LEFT JOIN public.user_roles ur ON ur.user_id=u.id AND ur.role='super_admin'
 ), scored AS (SELECT *, CASE
   WHEN ph IS NULL THEN 'Missing or invalid Nigerian mobile number'
   WHEN fs='suspended' OR ms<>'active' THEN 'Account inactive'
   WHEN cs='declined' THEN 'Turned off SMS in communication preferences'
   WHEN p_category='service' AND acct_off THEN 'Turned off account and subscription messages'
   WHEN p_category='marketing' AND cs<>'granted' THEN 'No SMS consent recorded (required for promotions)'
   WHEN p_category='marketing' AND NOT marketing THEN 'No promotional consent'
   WHEN p_category='marketing' AND EXISTS (SELECT 1 FROM public.engagement_messages em WHERE em.user_id=uid AND em.category='marketing' AND em.status NOT IN ('skipped','failed') AND em.sent_at>now()-interval '24 hours') THEN 'Recent promotional contact'
   WHEN p_category='marketing' AND EXISTS (SELECT 1 FROM public.sms_recipients sr JOIN public.sms_campaigns sc ON sc.id=sr.campaign_id WHERE sr.user_id=uid AND sc.category='marketing' AND sr.status IN ('sending','accepted','sent','delivered','unknown') AND sr.updated_at>now()-interval '24 hours') THEN 'Recent promotional SMS'
   ELSE NULL END ex FROM base)
 SELECT uid,nm,ph,ver,rk,cs,ex IS NULL,ex,(ex IS NULL AND cs='not_recorded') FROM scored
$$;
REVOKE ALL ON FUNCTION public.sms_audience_detail(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_audience_detail(text) TO service_role;

-- Keep the legacy signature used by queue claim/recheck functions in sync with the new rules.
CREATE OR REPLACE FUNCTION public.sms_audience_source(p_category text) RETURNS TABLE(user_id uuid,display_name text,phone text,verified boolean,role_key text,eligible boolean,exclusion text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT user_id,display_name,phone,verified,role_key,eligible,exclusion FROM public.sms_audience_detail(p_category)
$$;
REVOKE ALL ON FUNCTION public.sms_audience_source(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_audience_source(text) TO service_role;

-- Selection: manual (included ids), all_accounts or all_eligible (minus excluded ids) within role/verified filters.
CREATE OR REPLACE FUNCTION public.sms_selection(p_category text,p_role text,p_verified boolean,p_mode text,p_included uuid[],p_excluded uuid[])
RETURNS SETOF record LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::record WHERE false $$;
DROP FUNCTION public.sms_selection(text,text,boolean,text,uuid[],uuid[]);
CREATE FUNCTION public.sms_selected_audience(p_category text,p_role text,p_verified boolean,p_mode text,p_included uuid[],p_excluded uuid[])
RETURNS TABLE(user_id uuid,display_name text,phone text,verified boolean,role_key text,consent_status text,eligible boolean,exclusion text,consent_warning boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.* FROM public.sms_audience_detail(p_category) a
 WHERE (p_role='all' OR a.role_key=p_role) AND (NOT p_verified OR a.verified)
 AND CASE p_mode
   WHEN 'manual' THEN a.user_id = ANY(coalesce(p_included,'{}'::uuid[]))
   WHEN 'all_accounts' THEN NOT (a.user_id = ANY(coalesce(p_excluded,'{}'::uuid[])))
   WHEN 'all_eligible' THEN a.eligible AND NOT (a.user_id = ANY(coalesce(p_excluded,'{}'::uuid[])))
   ELSE false END
$$;
REVOKE ALL ON FUNCTION public.sms_selected_audience(text,text,boolean,text,uuid[],uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_selected_audience(text,text,boolean,text,uuid[],uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.sms_admin_audience_v2(p_category text,p_search text,p_role text,p_verified boolean,p_page integer,p_mode text,p_included uuid[],p_excluded uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
 DECLARE result jsonb;
 BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
 IF p_category NOT IN ('service','marketing') OR p_role NOT IN ('all','user','super_admin') OR p_mode NOT IN ('none','manual','all_accounts','all_eligible') OR length(coalesce(p_search,''))>100 OR p_page<0 OR coalesce(array_length(p_included,1),0)>5000 OR coalesce(array_length(p_excluded,1),0)>5000 THEN RAISE EXCEPTION 'Invalid audience'; END IF;
 WITH all_users AS (SELECT * FROM public.sms_audience_detail(p_category)),
 filtered AS (SELECT * FROM all_users WHERE (p_role='all' OR role_key=p_role) AND (NOT p_verified OR verified)),
 sel AS (SELECT * FROM public.sms_selected_audience(p_category,p_role,p_verified,p_mode,p_included,p_excluded)),
 page_rows AS (SELECT * FROM filtered WHERE display_name ILIKE '%'||coalesce(p_search,'')||'%' OR phone ILIKE '%'||coalesce(p_search,'')||'%' ORDER BY display_name,user_id LIMIT 25 OFFSET least(p_page,10000)*25)
 SELECT jsonb_build_object(
  'total_registered',(SELECT count(*) FROM all_users),
  'filtered_accounts',(SELECT count(*) FROM filtered),
  'filtered_valid_phones',(SELECT count(*) FROM filtered WHERE phone IS NOT NULL),
  'filtered_eligible_accounts',(SELECT count(*) FROM filtered WHERE eligible),
  'selected_accounts',(SELECT count(*) FROM sel),
  'selected_valid_phones',(SELECT count(*) FROM sel WHERE phone IS NOT NULL),
  'selected_invalid_phones',(SELECT count(*) FROM sel WHERE phone IS NULL),
  'selected_eligible_accounts',(SELECT count(*) FROM sel WHERE eligible),
  'eligible',(SELECT count(DISTINCT phone) FROM sel WHERE eligible),
  'duplicate_phones',(SELECT count(*)-count(DISTINCT phone) FROM sel WHERE eligible),
  'excluded',(SELECT count(*) FROM sel WHERE NOT eligible),
  'consent_not_recorded',(SELECT count(*) FROM sel WHERE consent_warning),
  'exclusion_reasons',coalesce((SELECT jsonb_object_agg(exclusion,n) FROM (SELECT exclusion,count(*) n FROM sel WHERE NOT eligible GROUP BY exclusion) r),'{}'::jsonb),
  'total_matches',(SELECT count(*) FROM filtered WHERE display_name ILIKE '%'||coalesce(p_search,'')||'%' OR phone ILIKE '%'||coalesce(p_search,'')||'%'),
  'rows',coalesce((SELECT jsonb_agg(to_jsonb(page_rows)) FROM page_rows),'[]'::jsonb)) INTO result;
 RETURN result;
 END $$;
REVOKE ALL ON FUNCTION public.sms_admin_audience_v2(text,text,text,boolean,integer,text,uuid[],uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sms_admin_audience_v2(text,text,text,boolean,integer,text,uuid[],uuid[]) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.sms_create_campaign_v2(p_actor uuid,p_request uuid,p_title text,p_body text,p_category text,p_segments integer,p_role text,p_verified boolean,p_mode text,p_included uuid[],p_excluded uuid[],p_test boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE cid uuid; existing uuid; recent integer; summary jsonb;
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 SELECT id INTO existing FROM public.sms_campaigns WHERE admin_user_id=p_actor AND request_key=p_request;
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_actor::text));
 SELECT count(*) INTO recent FROM public.sms_campaigns WHERE admin_user_id=p_actor AND created_at>now()-interval '1 hour';
 IF recent>=10 THEN RAISE EXCEPTION 'Campaign limit reached; try again later'; END IF;
 IF p_mode NOT IN ('manual','all_accounts','all_eligible') OR coalesce(array_length(p_included,1),0)>5000 OR coalesce(array_length(p_excluded,1),0)>5000 THEN RAISE EXCEPTION 'Invalid selection'; END IF;
 IF length(trim(p_title)) NOT BETWEEN 1 AND 120 OR length(trim(p_body)) NOT BETWEEN 1 AND 1200 OR p_segments NOT BETWEEN 1 AND 8 OR p_category NOT IN ('service','marketing') OR p_role NOT IN ('all','user','super_admin') OR p_body !~* 'poultrypro' THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
 IF p_category='marketing' AND p_body NOT LIKE '%https://poultrypro.life/settings%' THEN RAISE EXCEPTION 'Promotional preferences link required'; END IF;
 IF EXISTS(SELECT 1 FROM public.sms_campaigns WHERE admin_user_id=p_actor AND body=p_body AND category=p_category AND created_at>now()-interval '10 minutes') THEN RAISE EXCEPTION 'An identical recent campaign already exists'; END IF;
 CREATE TEMP TABLE IF NOT EXISTS _sms_sel ON COMMIT DROP AS SELECT * FROM public.sms_audience_detail('service') WHERE false;
 TRUNCATE _sms_sel;
 INSERT INTO _sms_sel SELECT * FROM public.sms_selected_audience(p_category,p_role,p_verified,CASE WHEN p_test THEN 'manual' ELSE p_mode END,CASE WHEN p_test THEN ARRAY[p_actor] ELSE p_included END,p_excluded);
 SELECT jsonb_build_object('mode',CASE WHEN p_test THEN 'test' ELSE p_mode END,'role',p_role,'verified',p_verified,
   'selected_accounts',count(*),'valid_phones',count(*) FILTER (WHERE phone IS NOT NULL),
   'eligible_recipients',count(DISTINCT phone) FILTER (WHERE eligible),
   'excluded',count(*) FILTER (WHERE NOT eligible),
   'consent_not_recorded',count(*) FILTER (WHERE consent_warning),
   'excluded_ids',coalesce(array_length(p_excluded,1),0),
   'exclusion_reasons',coalesce((SELECT jsonb_object_agg(exclusion,n) FROM (SELECT exclusion,count(*) n FROM _sms_sel WHERE NOT eligible GROUP BY exclusion) r),'{}'::jsonb))
 INTO summary FROM _sms_sel;
 INSERT INTO public.sms_campaigns(admin_user_id,admin_label,request_key,title,body,category,segments,is_test,audience)
 SELECT p_actor,coalesce(u.email,'Administrator'),p_request,trim(p_title),trim(p_body),p_category,p_segments,p_test,summary FROM auth.users u WHERE u.id=p_actor RETURNING id INTO cid;
 INSERT INTO public.sms_recipients(campaign_id,user_id,phone,display_name)
 SELECT cid,user_id,phone,display_name FROM (SELECT DISTINCT ON (phone) * FROM _sms_sel WHERE eligible ORDER BY phone,user_id) x;
 IF NOT EXISTS(SELECT 1 FROM public.sms_recipients WHERE campaign_id=cid) THEN RAISE EXCEPTION 'No eligible recipients'; END IF;
 INSERT INTO public.sms_events(campaign_id,actor_id,event,detail) VALUES(cid,p_actor,'draft_created',summary - 'excluded_ids');
 INSERT INTO public.admin_audit_log(admin_user_id,action_type,new_value) VALUES(p_actor,'sms_campaign_created',jsonb_build_object('campaign_id',cid,'summary',summary));
 RETURN cid;
 END $$;
REVOKE ALL ON FUNCTION public.sms_create_campaign_v2(uuid,uuid,text,text,text,integer,text,boolean,text,uuid[],uuid[],boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_create_campaign_v2(uuid,uuid,text,text,text,integer,text,boolean,text,uuid[],uuid[],boolean) TO service_role;