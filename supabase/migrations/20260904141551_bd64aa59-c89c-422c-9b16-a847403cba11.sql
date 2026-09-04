DROP POLICY IF EXISTS "Anyone can view published tutorials" ON public.academy_tutorials;
DROP POLICY IF EXISTS "Anyone can view active academy categories" ON public.academy_categories;

CREATE POLICY "Visitors view published tutorials"
ON public.academy_tutorials FOR SELECT TO anon
USING (is_published = true AND is_archived = false);

CREATE POLICY "Users view published tutorials"
ON public.academy_tutorials FOR SELECT TO authenticated
USING ((is_published = true AND is_archived = false) OR public.is_super_admin());

CREATE POLICY "Visitors view active academy categories"
ON public.academy_categories FOR SELECT TO anon
USING (is_active = true);

CREATE POLICY "Users view active academy categories"
ON public.academy_categories FOR SELECT TO authenticated
USING (is_active = true OR public.is_super_admin());