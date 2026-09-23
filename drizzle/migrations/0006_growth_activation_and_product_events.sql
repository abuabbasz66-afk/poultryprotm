-- ============================================================
-- PoultryPro growth: product events, onboarding state, feedback
-- Additive only. No existing table, policy or function is dropped.
-- ============================================================

-- 1. product_events -------------------------------------------------
create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  event_name text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on public.product_events to authenticated;
grant all on public.product_events to service_role;

alter table public.product_events enable row level security;

create policy "Users read their own product events"
  on public.product_events for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or (farm_id is not null and (
      exists (select 1 from public.farms f where f.id = product_events.farm_id and f.owner_id = auth.uid())
      or exists (select 1 from public.farm_members m
                 where m.farm_id = product_events.farm_id
                   and m.user_id = auth.uid()
                   and coalesce(m.status, 'active') = 'active')
    ))
  );

create index if not exists product_events_name_created_idx on public.product_events (event_name, created_at desc);
create index if not exists product_events_farm_idx on public.product_events (farm_id, event_name);
create index if not exists product_events_user_idx on public.product_events (user_id, created_at desc);

-- One-time milestones are recorded once per farm (or per user when no farm).
create unique index if not exists product_events_once_farm_idx
  on public.product_events (farm_id, event_name)
  where farm_id is not null and (event_name like 'FIRST\_%' or event_name in
    ('ACCOUNT_CREATED','FARM_CREATED','FLOCK_CREATED','ROOM_CREATED','FARM_ACTIVATED'));

create unique index if not exists product_events_once_user_idx
  on public.product_events (user_id, event_name)
  where farm_id is null and event_name in ('ACCOUNT_CREATED','ONBOARDING_GOAL_SET');

-- 2. user_onboarding -------------------------------------------------
create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_goal text,
  goal_set_at timestamptz,
  checklist_dismissed_at timestamptz,
  completed_at timestamptz,
  first_insight_seen_at timestamptz,
  upgrade_prompt_dismissed_at timestamptz,
  checkout_reminder_dismissed_at timestamptz,
  feedback_prompt_dismissed_at timestamptz,
  whatsapp_consent boolean not null default false,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.user_onboarding to authenticated;
grant all on public.user_onboarding to service_role;

alter table public.user_onboarding enable row level security;

create policy "Users read their own onboarding state"
  on public.user_onboarding for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());
create policy "Users create their own onboarding state"
  on public.user_onboarding for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users update their own onboarding state"
  on public.user_onboarding for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger user_onboarding_touch before update on public.user_onboarding
  for each row execute function public.set_updated_at();

-- 3. user_feedback ---------------------------------------------------
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  kind text not null check (kind in ('product','exit','interview')),
  sentiment text,
  reason text,
  message text,
  contact_name text,
  contact_email text,
  contact_phone text,
  farm_size text,
  main_challenge text,
  preferred_contact text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

grant select, insert on public.user_feedback to authenticated;
grant all on public.user_feedback to service_role;

alter table public.user_feedback enable row level security;

create policy "Users read their own feedback"
  on public.user_feedback for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());
create policy "Users submit their own feedback"
  on public.user_feedback for insert to authenticated
  with check (user_id = auth.uid());
create policy "Super admins update feedback"
  on public.user_feedback for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create index if not exists user_feedback_created_idx on public.user_feedback (created_at desc);

-- 4. track_product_event ---------------------------------------------
create or replace function public.track_product_event(
  _event_name text,
  _farm_id uuid default null,
  _resource_type text default null,
  _resource_id uuid default null,
  _metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _farm uuid := _farm_id;
  _id uuid;
begin
  if _uid is null then return null; end if;
  if _event_name is null or length(_event_name) = 0 or length(_event_name) > 64 then
    return null;
  end if;

  -- Farm must belong to the caller; anything else is discarded, never trusted.
  if _farm is not null then
    if not exists (
      select 1 from public.farms f where f.id = _farm and f.owner_id = _uid
      union all
      select 1 from public.farm_members m
       where m.farm_id = _farm and m.user_id = _uid and coalesce(m.status,'active') = 'active'
    ) then
      _farm := null;
    end if;
  end if;

  insert into public.product_events (user_id, farm_id, event_name, resource_type, resource_id, metadata)
  values (_uid, _farm, upper(_event_name), _resource_type, _resource_id,
          coalesce(_metadata, '{}'::jsonb))
  on conflict do nothing
  returning id into _id;

  return _id;
end;
$$;

revoke all on function public.track_product_event(text, uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.track_product_event(text, uuid, text, uuid, jsonb) to authenticated, service_role;

-- 5. farm_activation_status -------------------------------------------
-- Real-data activation state for the caller's current farm.
create or replace function public.farm_activation_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _farm uuid;
  _has_farm boolean := false;
  _has_flock boolean := false;
  _has_room boolean := false;
  _has_production boolean := false;
  _has_operational boolean := false;
  _first_record timestamptz;
  _active_days int := 0;
  _records int := 0;
begin
  if _uid is null then return jsonb_build_object('has_farm', false); end if;
  _farm := public.current_farm_id();
  if _farm is null then return jsonb_build_object('has_farm', false); end if;
  _has_farm := true;

  _has_flock := exists (select 1 from public.layer_batches b where b.farm_id = _farm)
             or exists (select 1 from public.broiler_batches b where b.farm_id = _farm);
  _has_room := exists (select 1 from public.rooms r where r.farm_id = _farm);
  _has_production := exists (select 1 from public.egg_production e where e.farm_id = _farm)
                  or exists (select 1 from public.broiler_daily d where d.farm_id = _farm);
  _has_operational := exists (select 1 from public.feed_usage f where f.farm_id = _farm)
                   or exists (select 1 from public.mortality m where m.farm_id = _farm)
                   or exists (select 1 from public.health_records h where h.farm_id = _farm)
                   or exists (select 1 from public.farm_expenses x where x.farm_id = _farm)
                   or exists (select 1 from public.farm_revenue v where v.farm_id = _farm);

  select min(created_at) into _first_record from (
    select created_at from public.egg_production where farm_id = _farm
    union all select created_at from public.feed_usage where farm_id = _farm
    union all select created_at from public.mortality where farm_id = _farm
  ) s;

  select count(*), count(distinct date(created_at)) into _records, _active_days
  from public.platform_activity_log where farm_id = _farm and user_id = _uid;

  return jsonb_build_object(
    'has_farm', _has_farm,
    'has_flock', _has_flock,
    'has_room', _has_room,
    'has_production', _has_production,
    'has_operational', _has_operational,
    'activated', _has_farm and _has_flock and _has_room and _has_production and _has_operational,
    'first_record_at', _first_record,
    'active_days', _active_days,
    'activity_count', _records,
    'farm_id', _farm
  );
end;
$$;

revoke all on function public.farm_activation_status() from public, anon;
grant execute on function public.farm_activation_status() to authenticated, service_role;

-- 6. admin_growth_stats -------------------------------------------------
create or replace function public.admin_growth_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _users int; _farms int; _activated int; _repeat int;
  _free int; _standard int; _premium int;
  _upgrade_viewed int; _checkout int; _paid int; _mrr numeric;
  _new_users_30 int; _cancelled int;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select count(*) into _users from auth.users;
  select count(*) into _new_users_30 from auth.users where created_at > now() - interval '30 days';
  select count(*) into _farms from public.farms;

  select count(*) into _activated from public.farms f
   where exists (select 1 from public.rooms r where r.farm_id = f.id)
     and (exists (select 1 from public.layer_batches b where b.farm_id = f.id)
          or exists (select 1 from public.broiler_batches b where b.farm_id = f.id))
     and (exists (select 1 from public.egg_production e where e.farm_id = f.id)
          or exists (select 1 from public.broiler_daily d where d.farm_id = f.id))
     and (exists (select 1 from public.feed_usage u where u.farm_id = f.id)
          or exists (select 1 from public.mortality m where m.farm_id = f.id)
          or exists (select 1 from public.health_records h where h.farm_id = f.id)
          or exists (select 1 from public.farm_expenses x where x.farm_id = f.id)
          or exists (select 1 from public.farm_revenue v where v.farm_id = f.id));

  -- Repeated usage: farm active on 3+ distinct days.
  select count(*) into _repeat from (
    select farm_id from public.platform_activity_log
     where farm_id is not null
     group by farm_id having count(distinct date(created_at)) >= 3
  ) s;

  select
    count(*) filter (where coalesce(subscription_plan,'basic') = 'basic'),
    count(*) filter (where subscription_plan = 'standard'),
    count(*) filter (where subscription_plan = 'premium')
  into _free, _standard, _premium
  from public.farms;

  select count(distinct farm_id) into _upgrade_viewed from public.product_events
   where event_name in ('UPGRADE_VIEWED','PREMIUM_FEATURE_VIEWED','PRICING_VIEWED');
  select count(distinct farm_id) into _checkout from public.farm_payments;
  select count(distinct farm_id) into _paid from public.farm_payments where status = 'success';
  select count(*) into _cancelled from public.product_events where event_name = 'SUBSCRIPTION_CANCELLED';

  select coalesce(sum(case when subscription_plan = 'standard' then 950
                           when subscription_plan = 'premium' then 1950 else 0 end), 0)
    into _mrr from public.farms
   where coalesce(status,'active') = 'active';

  return jsonb_build_object(
    'total_users', _users,
    'new_users_30d', _new_users_30,
    'total_farms', _farms,
    'activated_farms', _activated,
    'repeat_usage_farms', _repeat,
    'free_farms', _free,
    'standard_farms', _standard,
    'premium_farms', _premium,
    'upgrade_viewed_farms', _upgrade_viewed,
    'checkout_started_farms', _checkout,
    'paid_farms', _paid,
    'cancelled_events', _cancelled,
    'mrr_ngn', _mrr
  );
end;
$$;

revoke all on function public.admin_growth_stats() from public, anon;
grant execute on function public.admin_growth_stats() to authenticated, service_role;

-- 7. admin_growth_dropoff ----------------------------------------------
create or replace function public.admin_growth_dropoff()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _no_farm int; _no_flock int; _no_production int; _no_return int;
  _no_upgrade_view int; _checkout_failed int;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;

  select count(*) into _no_farm from auth.users u
   where not exists (select 1 from public.farms f where f.owner_id = u.id);

  select count(*) into _no_flock from public.farms f
   where not exists (select 1 from public.layer_batches b where b.farm_id = f.id)
     and not exists (select 1 from public.broiler_batches b where b.farm_id = f.id);

  select count(*) into _no_production from public.farms f
   where not exists (select 1 from public.egg_production e where e.farm_id = f.id)
     and not exists (select 1 from public.broiler_daily d where d.farm_id = f.id);

  select count(*) into _no_return from (
    select farm_id from public.platform_activity_log where farm_id is not null
     group by farm_id having count(distinct date(created_at)) = 1
  ) s;

  select count(*) into _no_upgrade_view from public.farms f
   where not exists (select 1 from public.product_events e
                      where e.farm_id = f.id
                        and e.event_name in ('UPGRADE_VIEWED','PREMIUM_FEATURE_VIEWED','PRICING_VIEWED'));

  select count(distinct farm_id) into _checkout_failed from public.farm_payments p
   where p.status <> 'success'
     and not exists (select 1 from public.farm_payments q
                      where q.farm_id = p.farm_id and q.status = 'success');

  return jsonb_build_object(
    'registered_no_farm', _no_farm,
    'farm_no_flock', _no_flock,
    'farm_no_production', _no_production,
    'single_session_farms', _no_return,
    'active_no_upgrade_view', _no_upgrade_view,
    'checkout_without_payment', _checkout_failed
  );
end;
$$;

revoke all on function public.admin_growth_dropoff() from public, anon;
grant execute on function public.admin_growth_dropoff() to authenticated, service_role;

-- 8. admin_list_feedback -------------------------------------------------
create or replace function public.admin_list_feedback(_limit int default 100)
returns setof public.user_feedback
language sql
stable
security definer
set search_path = public
as $$
  select * from public.user_feedback
   where public.is_super_admin()
   order by created_at desc
   limit greatest(1, least(coalesce(_limit, 100), 500));
$$;

revoke all on function public.admin_list_feedback(int) from public, anon;
grant execute on function public.admin_list_feedback(int) to authenticated, service_role;
