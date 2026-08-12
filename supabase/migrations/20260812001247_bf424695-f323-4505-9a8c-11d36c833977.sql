DROP POLICY IF EXISTS "Update production" ON public.egg_production;

CREATE POLICY "Update production"
ON public.egg_production
FOR UPDATE
TO authenticated
USING (public.can(farm_id, 'production.write'))
WITH CHECK (public.can(farm_id, 'production.write'));