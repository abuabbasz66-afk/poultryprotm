DROP POLICY "Update feed usage" ON public.feed_usage;
CREATE POLICY "Update feed usage" ON public.feed_usage
  FOR UPDATE TO authenticated
  USING (can_edit_recent(farm_id, 'feed.write'::text, created_at))
  WITH CHECK (can(farm_id, 'feed.write'::text));

DROP POLICY "Update mortality" ON public.mortality;
CREATE POLICY "Update mortality" ON public.mortality
  FOR UPDATE TO authenticated
  USING (can_edit_recent(farm_id, 'mortality.write'::text, created_at))
  WITH CHECK (can(farm_id, 'mortality.write'::text));