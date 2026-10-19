CREATE POLICY "Super admins review global vaccination programmes"
ON public.vaccination_programmes
FOR UPDATE
TO authenticated
USING (farm_id IS NULL AND public.is_super_admin())
WITH CHECK (farm_id IS NULL AND public.is_super_admin());