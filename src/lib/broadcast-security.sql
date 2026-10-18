-- Transactional regression check. Run in a privileged test session; always rolls back.
-- No provider requests, no account creation and no farm-record changes.
BEGIN;
DO $$
DECLARE a uuid; c uuid; r uuid; n integer; ph text; outsider uuid := gen_random_uuid();
BEGIN
 SELECT user_id INTO a FROM public.user_roles WHERE role='super_admin' LIMIT 1;
 IF a IS NULL THEN RAISE EXCEPTION 'Needs an authorised admin'; END IF;
 BEGIN
  PERFORM public.sms_claim_batch(gen_random_uuid(),outsider);
  RAISE EXCEPTION 'FAIL outsider allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Not authorised' THEN RAISE; END IF; END;
 IF has_table_privilege('anon','public.sms_recipients','SELECT') THEN RAISE EXCEPTION 'FAIL anonymous recipient access'; END IF;
 IF has_table_privilege('authenticated','public.sms_campaigns','INSERT') THEN RAISE EXCEPTION 'FAIL direct campaign insertion'; END IF;
 IF has_function_privilege('authenticated','public.sms_claim_batch(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'FAIL direct queue access'; END IF;
 SELECT phone INTO ph FROM public.sms_audience_source('service') WHERE user_id=a AND eligible LIMIT 1;
 IF ph IS NULL THEN RAISE EXCEPTION 'Needs an eligible admin registered phone'; END IF;
 INSERT INTO public.sms_campaigns(admin_user_id,admin_label,request_key,title,body,category,audience,segments,status)
 VALUES(a,'Temporary test',gen_random_uuid(),'Rollback regression','PoultryPro test','service','{}',1,'queued') RETURNING id INTO c;
 INSERT INTO public.sms_recipients(campaign_id,user_id,phone,display_name) VALUES(c,a,ph,'Temporary test') RETURNING id INTO r;
 SELECT count(*) INTO n FROM public.sms_claim_batch(c,a);
 IF n<>1 THEN RAISE EXCEPTION 'FAIL eligible claim'; END IF;
 SELECT count(*) INTO n FROM public.sms_claim_batch(c,a);
 IF n<>0 THEN RAISE EXCEPTION 'FAIL duplicate claim'; END IF;
 IF NOT public.sms_recipient_allowed(r) THEN RAISE EXCEPTION 'FAIL eligible recipient'; END IF;
 UPDATE public.communication_preferences SET sms_opt_in=false WHERE user_id=a;
 IF public.sms_recipient_allowed(r) THEN RAISE EXCEPTION 'FAIL revoked consent'; END IF;
 PERFORM public.sms_record_result(r,'unknown',NULL,'Ambiguous submission',a,'regression-unknown');
 PERFORM public.sms_finish_campaign(c);
 BEGIN
  PERFORM public.sms_retry_rejected(a,c);
  RAISE EXCEPTION 'FAIL unknown retried';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'No safely rejected submissions eligible for retry' THEN RAISE; END IF; END;
 PERFORM public.sms_record_result(r,'delivered','regression-reference',NULL,NULL,'regression-delivered');
 PERFORM public.sms_record_result(r,'delivered','regression-reference',NULL,NULL,'regression-delivered');
 PERFORM public.sms_record_result(r,'accepted','regression-reference',NULL,a,'regression-late');
 IF (SELECT status FROM public.sms_recipients WHERE id=r)<>'delivered' THEN RAISE EXCEPTION 'FAIL terminal status regression'; END IF;
 IF (SELECT count(*) FROM public.sms_events WHERE event_key='regression-delivered')<>1 THEN RAISE EXCEPTION 'FAIL duplicated delivery audit'; END IF;
END $$;
ROLLBACK;