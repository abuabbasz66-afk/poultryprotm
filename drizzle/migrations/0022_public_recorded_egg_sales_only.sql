-- Add an egg-sales-only aggregate without changing existing callers or farm permissions.
-- Finance sale amounts are NGN. Egg Trays are packaging, not egg sales.
-- Removed rows are absent; the ledger has no reversal or payment-confirmation status.
CREATE OR REPLACE FUNCTION public.landing_recorded_egg_sales()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH sales AS (
 SELECT r.*, count(*) OVER (PARTITION BY r.farm_id, r.entry_date, r.category, r.item,
 r.quantity, r.unit, r.unit_price, r.amount, r.customer, r.payment_method, r.notes) AS matching_entries
 FROM public.farm_revenue r
 WHERE r.category = 'eggs' AND r.item IN ('Table Eggs','Jumbo Eggs','Cracked Eggs')
 AND EXISTS (SELECT 1 FROM public.farms f WHERE f.id = r.farm_id)
 AND r.entry_date IS NOT NULL
 AND r.amount > 0 AND r.amount::text NOT IN ('NaN','Infinity','-Infinity')
 AND r.quantity > 0 AND r.quantity::text NOT IN ('NaN','Infinity','-Infinity')
 AND r.unit_price > 0 AND r.unit_price::text NOT IN ('NaN','Infinity','-Infinity')
 AND abs(r.amount - r.quantity * r.unit_price) <= 0.01
)
SELECT jsonb_build_object(
 'recorded_egg_sales', (SELECT CASE WHEN count(*) = 0 OR bool_or(matching_entries > 1) THEN NULL ELSE sum(amount) END FROM sales),
 'currency', 'NGN'
)
$function$;
REVOKE ALL ON FUNCTION public.landing_recorded_egg_sales() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_recorded_egg_sales() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.landing_recorded_egg_sales() IS 'Public aggregate only: genuine NGN egg-sale ledger amounts; no production estimates, packaging, other income, private farm data or claim of verified cash receipts. Missing valid sales or ambiguous duplicates return null.';