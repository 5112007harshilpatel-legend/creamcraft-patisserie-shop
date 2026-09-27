begin;
create schema cc_private;
revoke all on schema cc_private from public;
grant usage on schema cc_private to authenticated, service_role;
create table cc_private.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table cc_private.admins enable row level security;
revoke all on cc_private.admins from public, anon, authenticated;
create function cc_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from cc_private.admins where user_id=(select auth.uid())) $$;
revoke all on function cc_private.is_admin() from public;
grant execute on function cc_private.is_admin() to authenticated;
create function public.cc_is_admin() returns boolean language sql stable security invoker set search_path='' as $$ select cc_private.is_admin() $$;
revoke all on function public.cc_is_admin() from public;
grant execute on function public.cc_is_admin() to authenticated;
create table public.cc_orders (
 id uuid primary key, fingerprint text not null, created_at timestamptz not null default now(),
 name text not null check(length(name) between 1 and 100), email text not null check(length(email) between 3 and 254),
 occasion text not null check(occasion in ('Birthday','Wedding','Anniversary','Just because','Something else')),
 event_date date not null, flavour text not null check(length(flavour) between 1 and 100), size text not null check(length(size) between 1 and 100),
 dietary text not null default '' check(length(dietary)<=300), notes text not null default '' check(length(notes)<=2000), reference_path text,
 status text not null default 'pending' check(status in ('pending','confirmed','preparing','completed','cancelled'))
);
create table public.cc_messages (
 id uuid primary key, fingerprint text not null, created_at timestamptz not null default now(),
 name text not null check(length(name) between 1 and 100), email text not null check(length(email) between 3 and 254), message text not null check(length(message) between 1 and 3000)
);
create function cc_private.initial_pending() returns trigger language plpgsql set search_path='' as $$ begin new.status := 'pending'; return new; end; $$;
create trigger cc_order_pending before insert on public.cc_orders for each row execute function cc_private.initial_pending();
alter table public.cc_orders enable row level security;
alter table public.cc_messages enable row level security;
revoke all on public.cc_orders,public.cc_messages from public,anon,authenticated;
grant select on public.cc_orders,public.cc_messages to authenticated;
grant update(status) on public.cc_orders to authenticated;
grant all on public.cc_orders,public.cc_messages to service_role;
create policy cc_order_read on public.cc_orders for select to authenticated using ((select cc_private.is_admin()));
create policy cc_order_update on public.cc_orders for update to authenticated using ((select cc_private.is_admin())) with check ((select cc_private.is_admin()));
create policy cc_message_read on public.cc_messages for select to authenticated using ((select cc_private.is_admin()));
create index cc_orders_created on public.cc_orders(created_at desc);
create index cc_messages_created on public.cc_messages(created_at desc);
create table cc_private.rate_limits (key text primary key, window_start timestamptz not null, hits integer not null);
alter table cc_private.rate_limits enable row level security;
revoke all on cc_private.rate_limits from public,anon,authenticated;
-- Atomic counters: all instances share the same limits; fixed lock ordering.
create function public.cc_rate_limit(email_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare k text; n integer; w timestamptz := date_trunc('hour',now()); begin
 if email_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 foreach k in array array['global', 'email:'||email_hash] loop
 insert into cc_private.rate_limits values(k,w,1) on conflict(key) do update set window_start=w,hits=case when cc_private.rate_limits.window_start=w then cc_private.rate_limits.hits+1 else 1 end returning hits into n;
 if n > (case when k='global' then 100 else 5 end) then return false; end if;
 end loop;
 delete from cc_private.rate_limits where window_start < now()-interval '2 days';
 return true;
end; $$;
revoke all on function public.cc_rate_limit(text) from public,anon,authenticated;
grant execute on function public.cc_rate_limit(text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cc-references','cc-references',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy cc_reference_admin_read on storage.objects for select to authenticated using(bucket_id='cc-references' and (select cc_private.is_admin()));
commit;
