-- Test fixtures: two organizations (A = demo seeded, B = separate company)
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','owner.a@test.local'),
 ('00000000-0000-0000-0000-00000000000b','manager.a@test.local'),
 ('00000000-0000-0000-0000-00000000000c','foreman.a@test.local'),
 ('00000000-0000-0000-0000-00000000000d','mechanic.a@test.local'),
 ('00000000-0000-0000-0000-00000000000e','employee.a@test.local'),
 ('00000000-0000-0000-0000-0000000000b1','owner.b@test.local'),
 ('00000000-0000-0000-0000-0000000000b2','employee.b@test.local'),
 ('00000000-0000-0000-0000-0000000000ff','outsider@test.local');

do $$
declare a uuid; b uuid;
begin
  a := public.bootstrap_organization('Org A (DEMO)', 'org-a', '00000000-0000-0000-0000-00000000000a', 'Māris', '', true);
  perform public.add_organization_member(a, '00000000-0000-0000-0000-00000000000b', 'manager');
  perform public.add_organization_member(a, '00000000-0000-0000-0000-00000000000c', 'foreman');
  perform public.add_organization_member(a, '00000000-0000-0000-0000-00000000000d', 'mechanic');
  perform public.add_organization_member(a, '00000000-0000-0000-0000-00000000000e', 'employee');
  perform public.seed_demo_data(a, jsonb_build_object(
    'manager',  '00000000-0000-0000-0000-00000000000b',
    'foreman',  '00000000-0000-0000-0000-00000000000c',
    'mechanic', '00000000-0000-0000-0000-00000000000d',
    'employee', '00000000-0000-0000-0000-00000000000e'));

  b := public.bootstrap_organization('Org B', 'org-b', '00000000-0000-0000-0000-0000000000b1', 'Other', 'Owner', false);
  perform public.add_organization_member(b, '00000000-0000-0000-0000-0000000000b2', 'employee', null, 'Bee', 'Worker');
  insert into public.projects (organization_id, country_id, code, name, status)
    select b, id, 'B-001', 'Org B project', 'active' from public.countries where organization_id = b and code = 'SE';
  insert into public.expenses (organization_id, expense_date, amount, currency, category, description, status)
    values (b, current_date, 100, 'SEK', 'food', 'B lunch', 'approved');
  -- private file in org A attached to an expense of the demo employee
  insert into storage.objects (bucket_id, name, owner)
    select 'receipts', a::text || '/expense/' || x.id || '/receipt.jpg', '00000000-0000-0000-0000-00000000000a'
    from public.expenses x where x.organization_id = a order by x.created_at limit 1;
  insert into public.files (organization_id, bucket, path, entity_type, entity_id, kind, uploaded_by)
    select a, 'receipts', a::text || '/expense/' || x.id || '/receipt.jpg', 'expense', x.id, 'receipt', '00000000-0000-0000-0000-00000000000a'
    from public.expenses x where x.organization_id = a order by x.created_at limit 1;
end $$;
