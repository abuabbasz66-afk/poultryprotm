DO $migration$
DECLARE fn record; definition text;
BEGIN
 FOR fn IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('admin_farm_intelligence','admin_platform_timeseries','ai_farm_benchmarks','platform_stats','landing_platform_stats','landing_all_farm_egg_value') LOOP
  definition := pg_get_functiondef(fn.oid);
  definition := replace(definition,'r2+r3+r4','r1+r2+r3+r4');
  definition := replace(definition,'r2 + r3 + r4','r1 + r2 + r3 + r4');
  definition := replace(definition,'ep.r2+ep.r3+ep.r4','ep.r1+ep.r2+ep.r3+ep.r4');
  definition := replace(definition,'ep.r2 + ep.r3 + ep.r4','ep.r1 + ep.r2 + ep.r3 + ep.r4');
  definition := replace(definition,'e.r2 + e.r3 + e.r4','e.r1 + e.r2 + e.r3 + e.r4');
  definition := replace(definition,'e.r2::numeric+e.r3+e.r4','e.r1::numeric+e.r2+e.r3+e.r4');
  definition := replace(definition,'-COALESCE(e.broken_r2,0)','-COALESCE(e.broken_r1,0)-COALESCE(e.broken_r2,0)');
  definition := replace(definition,'AND e.r2>=0','AND e.r1>=0 AND e.broken_r1>=0 AND e.r2>=0');
  definition := replace(definition,'FROM public.rooms r WHERE r.farm_id = _farm_id','FROM public.rooms r WHERE r.superseded_by IS NULL AND r.farm_id = _farm_id');
  definition := replace(definition,'FROM public.rooms WHERE farm_id = _farm_id','FROM public.rooms WHERE superseded_by IS NULL AND farm_id = _farm_id');
  definition := replace(definition,'FROM public.rooms)','FROM public.rooms WHERE superseded_by IS NULL)');
  EXECUTE definition;
 END LOOP;
END;
$migration$;