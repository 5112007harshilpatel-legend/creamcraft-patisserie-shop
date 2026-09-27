-- Run in Supabase SQL Editor as project owner. All fixtures roll back.
begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','cc-admin-qa@example.invalid'),('00000000-0000-4000-8000-000000000002','cc-user-qa@example.invalid');
insert into cc_private.admins values('00000000-0000-4000-8000-000000000001');
insert into public.cc_orders(id,fingerprint,name,email,occasion,event_date,flavour,size,status) values('00000000-0000-4000-8000-000000000003','qa','QA','qa@example.invalid','Birthday',current_date+7,'Vanilla','6 inch','completed');
do $$ begin if (select status from public.cc_orders where id='00000000-0000-4000-8000-000000000003')<>'pending' then raise exception 'Initial status failed'; end if; end $$;
set local role anon;
do $$ begin
 begin perform * from public.cc_orders; raise exception 'Anon read leaked'; exception when insufficient_privilege then null; end;
 begin perform * from public.cc_messages; raise exception 'Anon messages leaked'; exception when insufficient_privilege then null; end;
 if exists(select 1 from storage.objects where bucket_id='cc-references') then raise exception 'Anon image metadata leaked'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"admin":true}}',true);
set local role authenticated;
do $$ declare n integer; begin
 if public.cc_is_admin() then raise exception 'Self-assigned metadata promoted user'; end if;
 if exists(select 1 from public.cc_orders) or exists(select 1 from public.cc_messages) then raise exception 'Nonadmin data leaked'; end if;
 if exists(select 1 from storage.objects where bucket_id='cc-references') then raise exception 'Nonadmin storage leaked'; end if;
 update public.cc_orders set status='completed';get diagnostics n=row_count;if n<>0 then raise exception 'Nonadmin updated order';end if;
 begin insert into cc_private.admins values('00000000-0000-4000-8000-000000000002');raise exception 'Self promotion allowed';exception when insufficient_privilege then null;end;
 begin perform public.cc_rate_limit(repeat('a',64));raise exception 'Private RPC exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare n integer; begin
 if not public.cc_is_admin() then raise exception 'Admin not recognized';end if;
 if not exists(select 1 from public.cc_orders where id='00000000-0000-4000-8000-000000000003') then raise exception 'Admin cannot read';end if;
 update public.cc_orders set status='preparing' where id='00000000-0000-4000-8000-000000000003';get diagnostics n=row_count;if n<>1 then raise exception 'Admin update failed';end if;
 begin update public.cc_orders set name='Tamper';raise exception 'Admin altered customer information';exception when insufficient_privilege then null;end;
 begin update public.cc_orders set status='invalid';raise exception 'Invalid status allowed';exception when check_violation then null;end;
end $$;
reset role;
delete from cc_private.admins where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin if public.cc_is_admin() or exists(select 1 from public.cc_orders) then raise exception 'Revocation failed';end if;end $$;
reset role;
rollback;
select 'PASS: initial pending, anon denial, nonadmin denial, metadata spoofing, self-promotion denial, admin read/update, invalid status, column restrictions and immediate revocation' as result;
