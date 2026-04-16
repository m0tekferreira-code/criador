-- ============================================================
-- AdCreative Pro - Supabase Schema
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Tabela de marcas salvas
create table public.brands (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  brand_analysis text not null,
  palette text[] not null default '{}',
  md_content text not null,
  created_at timestamptz default now() not null
);

-- 2. Tabela de criativos gerados
create table public.creatives (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  brand_id uuid references public.brands(id) on delete set null,
  size text not null,
  copy_text text,
  design_concept text,
  image_path text not null,
  created_at timestamptz default now() not null
);

-- 3. RLS (Row Level Security) - cada usuario so ve seus dados
alter table public.brands enable row level security;
alter table public.creatives enable row level security;

create policy "Users can view own brands"
  on public.brands for select
  using (auth.uid() = user_id);

create policy "Users can insert own brands"
  on public.brands for insert
  with check (auth.uid() = user_id);

create policy "Users can update own brands"
  on public.brands for update
  using (auth.uid() = user_id);

create policy "Users can delete own brands"
  on public.brands for delete
  using (auth.uid() = user_id);

create policy "Users can view own creatives"
  on public.creatives for select
  using (auth.uid() = user_id);

create policy "Users can insert own creatives"
  on public.creatives for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own creatives"
  on public.creatives for delete
  using (auth.uid() = user_id);

-- 4. Storage buckets
insert into storage.buckets (id, name, public) values ('logos', 'logos', false);
insert into storage.buckets (id, name, public) values ('references', 'references', false);
insert into storage.buckets (id, name, public) values ('creatives', 'creatives', false);

-- Storage policies - usuarios autenticados podem acessar seus proprios arquivos
create policy "Users can upload logos"
  on storage.objects for insert
  with check (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view own logos"
  on storage.objects for select
  using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own logos"
  on storage.objects for delete
  using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload references"
  on storage.objects for insert
  with check (bucket_id = 'references' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view own references"
  on storage.objects for select
  using (bucket_id = 'references' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own references"
  on storage.objects for delete
  using (bucket_id = 'references' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload creatives"
  on storage.objects for insert
  with check (bucket_id = 'creatives' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view own creatives"
  on storage.objects for select
  using (bucket_id = 'creatives' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own creatives"
  on storage.objects for delete
  using (bucket_id = 'creatives' and auth.uid()::text = (storage.foldername(name))[1]);
