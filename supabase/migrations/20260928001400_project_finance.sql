-- Project finances: contract terms and budget per work site (projects).
-- Visibility follows the existing projects RLS policies (select/update); the UI only shows
-- these values to users with view_finance, and only manage_projects can change them.

alter table public.projects
  add column if not exists contract_type text
    check (contract_type is null or contract_type in ('per_unit','fixed','hourly')),
  add column if not exists contract_price numeric(14,2)
    check (contract_price is null or contract_price >= 0),
  add column if not exists contract_currency text not null default 'EUR'
    check (contract_currency in ('EUR','SEK','ISK')),
  add column if not exists contract_unit text not null default 'm3'
    check (contract_unit in ('m3','units','loads','other')),
  add column if not exists expected_volume numeric(14,2)
    check (expected_volume is null or expected_volume >= 0),
  add column if not exists budget_hours numeric(12,1)
    check (budget_hours is null or budget_hours >= 0),
  add column if not exists budget_cost numeric(14,2)
    check (budget_cost is null or budget_cost >= 0);

comment on column public.projects.contract_type is 'per_unit = price × produced quantity, fixed = lump sum, hourly = price × net work hours';
comment on column public.projects.contract_price is 'Contract price in contract_currency (per unit / total / per hour depending on contract_type)';
comment on column public.projects.contract_unit is 'Production unit the per_unit price applies to (matches production_logs.unit)';
comment on column public.projects.expected_volume is 'Planned total volume in contract_unit (used for progress of fixed-price contracts)';
comment on column public.projects.budget_hours is 'Budgeted net work hours';
comment on column public.projects.budget_cost is 'Budgeted total cost in contract_currency';
