CREATE OR REPLACE FUNCTION public.price_key(_item text, _category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(_category,'') = 'eggs' OR coalesce(_item,'') ~* 'egg'  THEN 'eggs'
    WHEN coalesce(_category,'') = 'feed' OR coalesce(_item,'') ~* 'feed' THEN 'feed'
    ELSE lower(btrim(regexp_replace(coalesce(_item,''), '\s+', ' ', 'g')))
  END
$$;

DO $$
DECLARE
  _grp RECORD;
  _keep RECORD;
  _loser RECORD;
BEGIN
  FOR _grp IN
    SELECT farm_id, public.price_key(item, category) AS k
    FROM public.prices
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  LOOP
    SELECT * INTO _keep
    FROM public.prices
    WHERE farm_id = _grp.farm_id AND public.price_key(item, category) = _grp.k
    ORDER BY effective_from DESC NULLS LAST, created_at DESC
    LIMIT 1;

    FOR _loser IN
      SELECT * FROM public.prices
      WHERE farm_id = _grp.farm_id
        AND public.price_key(item, category) = _grp.k
        AND id <> _keep.id
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.price_history h
        WHERE h.farm_id = _loser.farm_id
          AND public.price_key(h.item, h.category) = _grp.k
          AND h.new_price = _loser.price
      ) THEN
        INSERT INTO public.price_history
          (farm_id, price_id, item, category, unit, old_price, new_price, effective_from, note)
        VALUES
          (_loser.farm_id, NULL, _keep.item, _loser.category, _loser.unit, NULL, _loser.price,
           _loser.effective_from, 'Archived automatically — merged duplicate active price');
      END IF;

      DELETE FROM public.prices WHERE id = _loser.id;
    END LOOP;

    UPDATE public.price_history
       SET item = _keep.item
     WHERE farm_id = _grp.farm_id
       AND public.price_key(item, category) = _grp.k
       AND item <> _keep.item;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS prices_one_active_per_item
  ON public.prices (farm_id, public.price_key(item, category));