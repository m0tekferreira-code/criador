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

do $$ begin
  -- Brands policies
  if not exists (select 1 from pg_policies where tablename = 'brands' and policyname = 'Users can view own brands') then
    create policy "Users can view own brands" on public.brands for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'brands' and policyname = 'Users can insert own brands') then
    create policy "Users can insert own brands" on public.brands for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'brands' and policyname = 'Users can update own brands') then
    create policy "Users can update own brands" on public.brands for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'brands' and policyname = 'Users can delete own brands') then
    create policy "Users can delete own brands" on public.brands for delete using (auth.uid() = user_id);
  end if;

  -- Creatives policies
  if not exists (select 1 from pg_policies where tablename = 'creatives' and policyname = 'Users can view own creatives') then
    create policy "Users can view own creatives" on public.creatives for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'creatives' and policyname = 'Users can insert own creatives') then
    create policy "Users can insert own creatives" on public.creatives for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'creatives' and policyname = 'Users can delete own creatives') then
    create policy "Users can delete own creatives" on public.creatives for delete using (auth.uid() = user_id);
  end if;
end $$;

-- 4. Storage buckets (ignora se ja existem)
insert into storage.buckets (id, name, public) values ('logos', 'logos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('references', 'references', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('creatives', 'creatives', false) on conflict (id) do nothing;

-- Storage policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'Users can upload logos') then
    create policy "Users can upload logos" on storage.objects for insert with check (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'Users can view own logos') then
    create policy "Users can view own logos" on storage.objects for select using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'Users can delete own logos') then
    create policy "Users can delete own logos" on storage.objects for delete using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'Users can upload references') then
    create policy "Users can upload references" on storage.objects for insert with check (bucket_id = 'references' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'Users can view own references') then
    create policy "Users can view own references" on storage.objects for select using (bucket_id = 'references' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'Users can delete own references') then
    create policy "Users can delete own references" on storage.objects for delete using (bucket_id = 'references' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'Users can upload creatives') then
    create policy "Users can upload creatives" on storage.objects for insert with check (bucket_id = 'creatives' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'Users can view own creatives') then
    create policy "Users can view own creatives" on storage.objects for select using (bucket_id = 'creatives' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'Users can delete own creatives') then
    create policy "Users can delete own creatives" on storage.objects for delete using (bucket_id = 'creatives' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;

-- ============================================================
-- Migration: Adicionar coluna caption para descricoes Instagram
-- Execute separadamente se a tabela ja existir:
--   ALTER TABLE public.creatives ADD COLUMN caption text;
-- ============================================================
alter table public.creatives add column if not exists caption text;

-- ============================================================
-- 5. Tabela de configuracoes do usuario (API key, etc.)
-- ============================================================
create table if not exists public.user_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  gemini_api_key text,
  updated_at timestamptz default now() not null
);

alter table public.user_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'user_settings' and policyname = 'Users can view own settings') then
    create policy "Users can view own settings" on public.user_settings for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_settings' and policyname = 'Users can insert own settings') then
    create policy "Users can insert own settings" on public.user_settings for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_settings' and policyname = 'Users can update own settings') then
    create policy "Users can update own settings" on public.user_settings for update using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- 6. Tabela de controle de migrations
-- ============================================================
create table if not exists public.app_migrations (
  id serial primary key,
  version integer not null unique,
  name text not null,
  applied_at timestamptz default now() not null
);
