-- 1. Receipt path must be scoped to the expense's own farm folder
CREATE OR REPLACE FUNCTION public.validate_expense_receipt_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.receipt_path IS NOT NULL AND NEW.receipt_path <> '' THEN
    IF position('..' in NEW.receipt_path) > 0
       OR NEW.receipt_path NOT LIKE (NEW.farm_id::text || '/%') THEN
      RAISE EXCEPTION 'receipt_path must be stored under the farm folder %/', NEW.farm_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_expense_receipt_path ON public.farm_expenses;
CREATE TRIGGER validate_expense_receipt_path
  BEFORE INSERT OR UPDATE ON public.farm_expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense_receipt_path();

-- 2. Payments are read-only for app clients; writes only via service role
REVOKE INSERT, UPDATE, DELETE ON public.farm_payments FROM authenticated;
REVOKE ALL ON public.farm_payments FROM anon;
GRANT SELECT ON public.farm_payments TO authenticated;
GRANT ALL ON public.farm_payments TO service_role;

-- 3. Health records must reference a batch from the same farm
CREATE OR REPLACE FUNCTION public.validate_layer_batch_health_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  batch_farm uuid;
BEGIN
  SELECT farm_id INTO batch_farm FROM public.layer_batches WHERE id = NEW.batch_id;
  IF batch_farm IS NULL OR batch_farm <> NEW.farm_id THEN
    RAISE EXCEPTION 'batch does not belong to this farm';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_layer_batch_health_scope ON public.layer_batch_health;
CREATE TRIGGER validate_layer_batch_health_scope
  BEFORE INSERT OR UPDATE ON public.layer_batch_health
  FOR EACH ROW EXECUTE FUNCTION public.validate_layer_batch_health_scope();