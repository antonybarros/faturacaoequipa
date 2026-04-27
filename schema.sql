-- Schema para Faturacao da Equipa
-- Executar no Supabase SQL Editor

-- Tabela de faturacao
create table if not exists faturacao (
  id uuid default gen_random_uuid() primary key,
  vendedor text not null,
  pais text not null check (pais in ('PT', 'ES', 'FR', 'DE', 'IT', 'UK', 'OTHER')),
  valor numeric(12,2) not null default 0,
  data date not null,
  mes integer generated always as (extract(month from data)) stored,
  ano integer generated always as (extract(year from data)) stored,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Objetivos mensais por pais
create table if not exists objetivos (
  id uuid default gen_random_uuid() primary key,
  pais text not null,
  mes integer not null check (mes between 1 and 12),
  ano integer not null,
  objetivo numeric(12,2) not null default 0,
  created_at timestamp with time zone default now(),
  unique(pais, mes, ano)
);

-- Enable RLS
alter table faturacao enable row level security;
alter table objetivos enable row level security;

-- Policies: leitura publica (so leitura)
create policy "Leitura publica faturacao" on faturacao for select using (true);
create policy "Leitura publica objetivos" on objetivos for select using (true);

-- Policy: escrita apenas para admin autenticado
create policy "Admin pode inserir faturacao" on faturacao for insert with check (auth.role() = 'authenticated');
create policy "Admin pode atualizar faturacao" on faturacao for update using (auth.role() = 'authenticated');
create policy "Admin pode inserir objetivos" on objetivos for insert with check (auth.role() = 'authenticated');
create policy "Admin pode atualizar objetivos" on objetivos for update using (auth.role() = 'authenticated');

-- Dados de teste (dias 1-7, objetivo PT 317500)
insert into objetivos (pais, mes, ano, objetivo) values ('PT', 4, 2026, 317500) on conflict (pais, mes, ano) do update set objetivo = excluded.objetivo;
insert into objetivos (pais, mes, ano, objetivo) values ('ES', 4, 2026, 150000) on conflict (pais, mes, ano) do update set objetivo = excluded.objetivo;