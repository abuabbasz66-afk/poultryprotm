-- Customer subscription engagement & retention system (additive only).

create table if not exists public.communication_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp_opt_in boolean not null default false,
  sms_opt_in boolean not null default false,
  phone_contact_opt_in boolean not null default false,
  marketing_opt_in boolean not null default false,
  subscription_notifications_opt_in boolean not null default true,
  phone text,
  consent_date timestamptz,
  consent_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.communication_preferences to authenticated;
grant all on public.communication_preferences to service_role;
alter table public.communication_preferences enable row level security;

drop policy if exists "Users read own communication preferences" on public.communication_preferences;
create policy "Users read own communication preferences"
  on public.communication_preferences for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "Users insert own communication preferences" on public.communication_preferences;
create policy "Users insert own communication preferences"
  on public.communication_preferences for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own communication preferences" on public.communication_preferences;
create policy "Users update own communication preferences"
  on public.communication_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists communication_preferences_touch on public.communication_preferences;
create trigger communication_preferences_touch
  before update on public.communication_preferences
  for each row execute function public.set_updated_at();

create table if not exists public.engagement_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  campaign_key text not null,
  category text not null check (category in ('service','marketing')),
  channel text not null check (channel in ('whatsapp','sms','phone','email')),
  segment text,
  body text not null,
  phone text,
  status text not null default 'sent'
    check (status in ('queued','sent','delivered','read','clicked','replied','failed','skipped','opted_out')),
  outcome text,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists engagement_messages_user_idx on public.engagement_messages (user_id, sent_at desc);
create index if not exists engagement_messages_sent_idx on public.engagement_messages (sent_at desc);

grant select on public.engagement_messages to authenticated;
grant all on public.engagement_messages to service_role;
alter table public.engagement_messages enable row level security;

drop policy if exists "Recipients and admins read engagement messages" on public.engagement_messages;
create policy "Recipients and admins read engagement messages"
  on public.engagement_messages for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

create table if not exists public.engagement_call_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  phone text,
  reason text,
  status text not null default 'open' check (status in ('open','scheduled','done','cancelled')),
  notes text,
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists engagement_call_requests_status_idx
  on public.engagement_call_requests (status, created_at desc);

grant select, insert on public.engagement_call_requests to authenticated;
grant all on public.engagement_call_requests to service_role;
alter table public.engagement_call_requests enable row level security;

drop policy if exists "Users read own call requests" on public.engagement_call_requests;
create policy "Users read own call requests"
  on public.engagement_call_requests for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "Users create own call requests" on public.engagement_call_requests;
create policy "Users create own call requests"
  on public.engagement_call_requests for insert to authenticated
  with check (user_id = auth.uid());

create or replace function public.engagement_frequency_limits()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value from public.platform_settings where key = 'engagement_frequency'),
    '{"per_day": 1, "per_week": 3}'::jsonb
  )
$$;

revoke all on function public.engagement_frequency_limits() from public, anon;
grant execute on function public.engagement_frequency_limits() to authenticated, service_role;

create or replace function public.admin_engagement_audience(_segment text default null, _limit integer default 300)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  farm_id uuid,
  farm_name text,
  plan text,
  farm_status text,
  segment text,
  registered_at timestamptz,
  last_activity timestamptz,
  active_days integer,
  has_production boolean,
  has_feed boolean,
  has_health boolean,
  has_finance boolean,
  expires_at timestamptz,
  whatsapp_opt_in boolean,
  sms_opt_in boolean,
  phone_contact_opt_in boolean,
  marketing_opt_in boolean,
  last_message_at timestamptz,
  messages_24h integer,
  messages_7d integer,
  can_send_marketing boolean,
  block_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _lim integer := greatest(1, least(coalesce(_limit, 300), 1000));
  _per_day integer := coalesce((public.engagement_frequency_limits() ->> 'per_day')::int, 1);
  _per_week integer := coalesce((public.engagement_frequency_limits() ->> 'per_week')::int, 3);
begin
  if not public.is_super_admin() then
    raise exception 'Not authorised';
  end if;

  return query
  with base as (
    select
      u.id as uid,
      u.email::text as email,
      u.created_at as registered_at,
      f.id as fid,
      f.name as fname,
      coalesce(f.subscription_plan, 'basic') as plan,
      f.status as fstatus,
      coalesce(f.owner_name, '') as owner_name,
      coalesce(f.phone, cp.phone) as phone,
      f.paystack_subscription_status as ps_status,
      coalesce(f.subscription_next_payment_at, f.trial_ends_at) as expires_at,
      cp.whatsapp_opt_in, cp.sms_opt_in, cp.phone_contact_opt_in, cp.marketing_opt_in
    from auth.users u
    left join lateral (
      select * from public.farms fx where fx.owner_id = u.id order by fx.created_at limit 1
    ) f on true
    left join public.communication_preferences cp on cp.user_id = u.id
  ),
  act as (
    select p.user_id as auid,
           max(p.created_at) as last_activity,
           count(distinct date(p.created_at))::int as active_days
    from public.platform_activity_log p
    group by p.user_id
  ),
  recs as (
    select b.fid as rfid,
      exists (select 1 from public.egg_production e where e.farm_id = b.fid)
        or exists (select 1 from public.broiler_daily d where d.farm_id = b.fid) as has_production,
      exists (select 1 from public.feed_usage fu where fu.farm_id = b.fid) as has_feed,
      exists (select 1 from public.health_records h where h.farm_id = b.fid)
        or exists (select 1 from public.mortality m where m.farm_id = b.fid) as has_health,
      exists (select 1 from public.farm_expenses x where x.farm_id = b.fid)
        or exists (select 1 from public.farm_revenue r where r.farm_id = b.fid) as has_finance,
      exists (select 1 from public.layer_batches lb where lb.farm_id = b.fid)
        or exists (select 1 from public.broiler_batches bb where bb.farm_id = b.fid) as has_flock
    from base b where b.fid is not null
  ),
  ev as (
    select pe.user_id as euid,
      max(pe.created_at) filter (where pe.event_name = 'CHECKOUT_STARTED') as checkout_at,
      max(pe.created_at) filter (where pe.event_name = 'PAYMENT_SUCCESS') as paid_at,
      max(pe.created_at) filter (where pe.event_name = 'PAYMENT_FAILED') as failed_at
    from public.product_events pe group by pe.user_id
  ),
  msg as (
    select m.user_id as muid,
      max(m.sent_at) as last_message_at,
      count(*) filter (where m.category = 'marketing' and m.sent_at > now() - interval '24 hours')::int as m24,
      count(*) filter (where m.category = 'marketing' and m.sent_at > now() - interval '7 days')::int as m7
    from public.engagement_messages m
    where m.status not in ('skipped','failed')
    group by m.user_id
  ),
  scored as (
    select b.*, a.last_activity, coalesce(a.active_days, 0) as active_days,
      coalesce(r.has_production, false) as has_production,
      coalesce(r.has_feed, false) as has_feed,
      coalesce(r.has_health, false) as has_health,
      coalesce(r.has_finance, false) as has_finance,
      coalesce(r.has_flock, false) as has_flock,
      e.checkout_at, e.paid_at, e.failed_at,
      mm.last_message_at,
      coalesce(mm.m24, 0) as m24, coalesce(mm.m7, 0) as m7
    from base b
    left join act a on a.auid = b.uid
    left join recs r on r.rfid = b.fid
    left join ev e on e.euid = b.uid
    left join msg mm on mm.muid = b.uid
  ),
  segged as (
    select s.*,
      case
        when s.fid is null then 'REGISTERED_NOT_SETUP'
        when s.ps_status = 'cancelled' then 'CANCELLED'
        when s.plan in ('standard','premium') and s.expires_at is not null and s.expires_at < now() then 'PREMIUM_EXPIRED'
        when s.plan in ('standard','premium') and s.expires_at is not null and s.expires_at < now() + interval '7 days' then 'PREMIUM_EXPIRING'
        when s.plan in ('standard','premium') then 'PREMIUM_ACTIVE'
        when s.failed_at is not null and (s.paid_at is null or s.failed_at > s.paid_at) then 'PAYMENT_FAILED'
        when s.checkout_at is not null and (s.paid_at is null or s.checkout_at > s.paid_at) then 'CHECKOUT_STARTED'
        when not (s.has_flock and s.has_production) then 'SETUP_INCOMPLETE'
        when s.last_activity is null or s.last_activity < now() - interval '30 days' then 'INACTIVE_FREE'
        when s.active_days >= 3 and s.last_activity > now() - interval '14 days' then 'ACTIVE_FREE'
        else 'ACTIVATED_FREE'
      end as segment
    from scored s
  )
  select
    g.uid, g.email, nullif(g.owner_name, ''), g.phone, g.fid, g.fname, g.plan, g.fstatus,
    g.segment, g.registered_at, g.last_activity, g.active_days,
    g.has_production, g.has_feed, g.has_health, g.has_finance, g.expires_at,
    coalesce(g.whatsapp_opt_in, false), coalesce(g.sms_opt_in, false),
    coalesce(g.phone_contact_opt_in, false), coalesce(g.marketing_opt_in, false),
    g.last_message_at, g.m24, g.m7,
    (coalesce(g.marketing_opt_in, false)
      and coalesce(g.whatsapp_opt_in, false)
      and g.phone is not null
      and g.m24 < _per_day and g.m7 < _per_week
      and g.segment <> 'PREMIUM_ACTIVE') as can_send_marketing,
    case
      when not coalesce(g.marketing_opt_in, false) then 'No marketing consent'
      when not coalesce(g.whatsapp_opt_in, false) then 'No WhatsApp consent'
      when g.segment = 'PREMIUM_ACTIVE' then 'Already subscribed'
      when g.m24 >= _per_day then 'Daily limit reached'
      when g.m7 >= _per_week then 'Weekly limit reached'
      when g.phone is null then 'No phone number on record'
      else null
    end
  from segged g
  where (_segment is null or g.segment = _segment)
  order by g.registered_at desc
  limit _lim;
end;
$$;

revoke all on function public.admin_engagement_audience(text, integer) from public, anon;
grant execute on function public.admin_engagement_audience(text, integer) to authenticated, service_role;

create or replace function public.admin_engagement_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _res jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorised';
  end if;

  with aud as (select * from public.admin_engagement_audience(null, 1000))
  select jsonb_build_object(
    'total_users', (select count(*) from aud),
    'whatsapp_opt_in', (select count(*) from aud where whatsapp_opt_in),
    'sms_opt_in', (select count(*) from aud where sms_opt_in),
    'marketing_opt_in', (select count(*) from aud where marketing_opt_in),
    'phone_opt_in', (select count(*) from aud where phone_contact_opt_in),
    'premium_users', (select count(*) from aud where segment in ('PREMIUM_ACTIVE','PREMIUM_EXPIRING')),
    'free_active', (select count(*) from aud where segment = 'ACTIVE_FREE'),
    'inactive', (select count(*) from aud where segment = 'INACTIVE_FREE'),
    'expiring', (select count(*) from aud where segment = 'PREMIUM_EXPIRING'),
    'expired', (select count(*) from aud where segment = 'PREMIUM_EXPIRED'),
    'payment_failed', (select count(*) from aud where segment = 'PAYMENT_FAILED'),
    'checkout_abandoned', (select count(*) from aud where segment = 'CHECKOUT_STARTED'),
    'eligible_marketing', (select count(*) from aud where can_send_marketing),
    'segments', (select coalesce(jsonb_object_agg(segment, c), '{}'::jsonb)
                 from (select segment, count(*) as c from aud group by segment) s),
    'messages_total', (select count(*) from public.engagement_messages),
    'messages_7d', (select count(*) from public.engagement_messages where sent_at > now() - interval '7 days'),
    'messages_replied', (select count(*) from public.engagement_messages where status = 'replied'),
    'messages_clicked', (select count(*) from public.engagement_messages where status in ('clicked','replied')),
    'open_call_requests', (select count(*) from public.engagement_call_requests where status = 'open'),
    'limits', public.engagement_frequency_limits()
  ) into _res;

  return _res;
end;
$$;

revoke all on function public.admin_engagement_stats() from public, anon;
grant execute on function public.admin_engagement_stats() to authenticated, service_role;

create or replace function public.admin_log_engagement_message(
  _user_id uuid,
  _campaign_key text,
  _category text,
  _channel text,
  _body text,
  _farm_id uuid default null,
  _segment text default null,
  _phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _per_day integer := coalesce((public.engagement_frequency_limits() ->> 'per_day')::int, 1);
  _per_week integer := coalesce((public.engagement_frequency_limits() ->> 'per_week')::int, 3);
  _m24 integer; _m7 integer;
  _plan text;
  _marketing boolean;
  _whatsapp boolean;
  _sms boolean;
  _id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorised';
  end if;
  if _user_id is null or coalesce(trim(_campaign_key), '') = '' or coalesce(trim(_body), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'Missing message details');
  end if;
  if _category not in ('service','marketing') then
    return jsonb_build_object('ok', false, 'reason', 'Unknown message category');
  end if;
  if _channel not in ('whatsapp','sms','phone','email') then
    return jsonb_build_object('ok', false, 'reason', 'Unknown channel');
  end if;

  select coalesce(cp.marketing_opt_in, false), coalesce(cp.whatsapp_opt_in, false), coalesce(cp.sms_opt_in, false)
    into _marketing, _whatsapp, _sms
  from public.communication_preferences cp where cp.user_id = _user_id;
  _marketing := coalesce(_marketing, false);
  _whatsapp := coalesce(_whatsapp, false);
  _sms := coalesce(_sms, false);

  if _category = 'marketing' then
    if not _marketing then
      return jsonb_build_object('ok', false, 'reason', 'This farmer has not opted in to marketing messages');
    end if;
    if _channel = 'whatsapp' and not _whatsapp then
      return jsonb_build_object('ok', false, 'reason', 'This farmer has not opted in to WhatsApp');
    end if;
    if _channel = 'sms' and not _sms then
      return jsonb_build_object('ok', false, 'reason', 'This farmer has not opted in to SMS');
    end if;

    select coalesce(f.subscription_plan, 'basic') into _plan
    from public.farms f where f.owner_id = _user_id order by f.created_at limit 1;
    if coalesce(_plan, 'basic') in ('standard', 'premium') then
      return jsonb_build_object('ok', false, 'reason', 'Already on a paid plan - promotional messages stop here');
    end if;

    select count(*) filter (where sent_at > now() - interval '24 hours'),
           count(*) filter (where sent_at > now() - interval '7 days')
      into _m24, _m7
    from public.engagement_messages
    where user_id = _user_id and category = 'marketing' and status not in ('skipped','failed');

    if coalesce(_m24, 0) >= _per_day then
      return jsonb_build_object('ok', false, 'reason', 'Daily message limit already reached for this farmer');
    end if;
    if coalesce(_m7, 0) >= _per_week then
      return jsonb_build_object('ok', false, 'reason', 'Weekly message limit already reached for this farmer');
    end if;
  end if;

  insert into public.engagement_messages
    (user_id, farm_id, campaign_key, category, channel, segment, body, phone, status, sent_by)
  values
    (_user_id, _farm_id, upper(trim(_campaign_key)), _category, _channel, _segment,
     left(_body, 2000), _phone, 'sent', auth.uid())
  returning id into _id;

  return jsonb_build_object('ok', true, 'id', _id);
end;
$$;

revoke all on function public.admin_log_engagement_message(uuid, text, text, text, text, uuid, text, text) from public, anon;
grant execute on function public.admin_log_engagement_message(uuid, text, text, text, text, uuid, text, text) to authenticated, service_role;

create or replace function public.admin_set_engagement_status(_id uuid, _status text, _outcome text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorised';
  end if;
  if _status not in ('sent','delivered','read','clicked','replied','failed','opted_out') then
    return jsonb_build_object('ok', false, 'reason', 'Unknown status');
  end if;
  update public.engagement_messages
     set status = _status,
         outcome = coalesce(left(_outcome, 500), outcome),
         responded_at = case when _status in ('replied','clicked') then now() else responded_at end
   where id = _id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_set_engagement_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_engagement_status(uuid, text, text) to authenticated, service_role;

create or replace function public.admin_engagement_history(_user_id uuid default null, _limit integer default 100)
returns setof public.engagement_messages
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorised';
  end if;
  return query
  select * from public.engagement_messages
  where (_user_id is null or user_id = _user_id)
  order by sent_at desc
  limit greatest(1, least(coalesce(_limit, 100), 500));
end;
$$;

revoke all on function public.admin_engagement_history(uuid, integer) from public, anon;
grant execute on function public.admin_engagement_history(uuid, integer) to authenticated, service_role;

create or replace function public.request_support_call(_reason text default null, _phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _farm uuid;
  _open integer;
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;
  select public.current_farm_id() into _farm;

  select count(*) into _open from public.engagement_call_requests
   where user_id = _uid and status in ('open','scheduled');
  if coalesce(_open, 0) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'You already have a call request waiting');
  end if;

  insert into public.engagement_call_requests (user_id, farm_id, phone, reason)
  values (_uid, _farm, left(coalesce(_phone, ''), 40), left(coalesce(_reason, ''), 500));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.request_support_call(text, text) from public, anon;
grant execute on function public.request_support_call(text, text) to authenticated, service_role;

create or replace function public.admin_list_call_requests(_limit integer default 100)
returns table (
  id uuid, user_id uuid, email text, farm_id uuid, farm_name text,
  phone text, reason text, status text, notes text,
  plan text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorised';
  end if;
  return query
  select c.id, c.user_id, u.email::text, c.farm_id, f.name,
         coalesce(nullif(c.phone, ''), f.phone), c.reason, c.status, c.notes,
         coalesce(f.subscription_plan, 'basic'),
         c.created_at
  from public.engagement_call_requests c
  left join auth.users u on u.id = c.user_id
  left join public.farms f on f.id = c.farm_id
  order by c.created_at desc
  limit greatest(1, least(coalesce(_limit, 100), 500));
end;
$$;

revoke all on function public.admin_list_call_requests(integer) from public, anon;
grant execute on function public.admin_list_call_requests(integer) to authenticated, service_role;

create or replace function public.admin_set_call_request(_id uuid, _status text, _notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorised';
  end if;
  if _status not in ('open','scheduled','done','cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'Unknown status');
  end if;
  update public.engagement_call_requests
     set status = _status,
         notes = coalesce(left(_notes, 1000), notes),
         handled_by = auth.uid(),
         handled_at = now()
   where id = _id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_set_call_request(uuid, text, text) from public, anon;
grant execute on function public.admin_set_call_request(uuid, text, text) to authenticated, service_role;
