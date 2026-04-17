import { supabase } from './supabase';

interface Migration {
  version: number;
  name: string;
  up: string;
}

/**
 * Lista de migrations ordenada por versao.
 * Para adicionar uma nova migration, basta adicionar um item ao array.
 * O sistema detecta automaticamente quais faltam e executa na ordem.
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_brands_table',
    up: `
      create table if not exists public.brands (
        id uuid default gen_random_uuid() primary key,
        user_id uuid references auth.users(id) on delete cascade not null,
        name text not null,
        brand_analysis text not null,
        palette text[] not null default '{}',
        md_content text not null,
        created_at timestamptz default now() not null
      );
      alter table public.brands enable row level security;
      do $$ begin
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
      end $$;
    `,
  },
  {
    version: 2,
    name: 'create_creatives_table',
    up: `
      create table if not exists public.creatives (
        id uuid default gen_random_uuid() primary key,
        user_id uuid references auth.users(id) on delete cascade not null,
        brand_id uuid references public.brands(id) on delete set null,
        size text not null,
        copy_text text,
        design_concept text,
        image_path text not null,
        created_at timestamptz default now() not null
      );
      alter table public.creatives enable row level security;
      do $$ begin
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
    `,
  },
  {
    version: 3,
    name: 'add_caption_to_creatives',
    up: `alter table public.creatives add column if not exists caption text;`,
  },
  {
    version: 4,
    name: 'create_user_settings',
    up: `
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
    `,
  },
];

const MIGRATIONS_VERSION_KEY = 'adcreative_migrations_version';

/**
 * Executa migrations pendentes.
 * Usa localStorage como fallback se a tabela app_migrations nao existir,
 * e tenta usar a tabela do Supabase via RPC quando disponivel.
 *
 * IMPORTANTE: As migrations SQL precisam da service_role key para criar
 * tabelas/policies (anon key nao tem permissao de DDL).
 * Se a service_role nao estiver configurada, o sistema pula a execucao
 * automatica e loga instruções no console para rodar manualmente.
 */
export async function runMigrations(): Promise<void> {
  const localVersion = parseInt(localStorage.getItem(MIGRATIONS_VERSION_KEY) || '0', 10);
  const latestVersion = migrations[migrations.length - 1]?.version ?? 0;

  if (localVersion >= latestVersion) {
    return; // Tudo atualizado
  }

  console.log(`[Migrations] Versao local: ${localVersion}, ultima: ${latestVersion}. Verificando pendentes...`);

  const pending = migrations.filter(m => m.version > localVersion);

  // Tenta verificar se as tabelas ja existem (caso alguem tenha rodado o schema.sql manualmente)
  const allTablesExist = await checkTablesExist();

  if (allTablesExist) {
    console.log('[Migrations] Todas as tabelas ja existem. Atualizando versao local.');
    localStorage.setItem(MIGRATIONS_VERSION_KEY, String(latestVersion));
    return;
  }

  // Tenta rodar via supabase.rpc (precisa de uma funcao no banco — ver abaixo)
  let ranViaSql = false;
  for (const migration of pending) {
    try {
      const { error } = await supabase.rpc('run_migration_sql', { sql_text: migration.up });
      if (error) {
        throw error;
      }
      console.log(`[Migrations] ✓ v${migration.version}: ${migration.name}`);
      localStorage.setItem(MIGRATIONS_VERSION_KEY, String(migration.version));
      ranViaSql = true;
    } catch {
      // rpc nao disponivel, loga para rodar manualmente
      if (!ranViaSql) {
        console.warn(
          `[Migrations] Nao foi possivel executar migrations automaticamente.\n` +
          `Execute o seguinte SQL no Supabase Dashboard (SQL Editor):\n\n` +
          pending.map(m => `-- v${m.version}: ${m.name}\n${m.up}`).join('\n\n')
        );

        // Verifica tabelas individualmente para atualizar a versão parcial
        await updateVersionFromExistingTables();
      }
      break;
    }
  }
}

async function checkTablesExist(): Promise<boolean> {
  try {
    const checks = await Promise.all([
      supabase.from('brands').select('id').limit(0),
      supabase.from('creatives').select('id').limit(0),
      supabase.from('user_settings').select('id').limit(0),
    ]);
    return checks.every(c => !c.error);
  } catch {
    return false;
  }
}

async function updateVersionFromExistingTables(): Promise<void> {
  let maxVersion = 0;
  try {
    const { error: e1 } = await supabase.from('brands').select('id').limit(0);
    if (!e1) maxVersion = 1;
    const { error: e2 } = await supabase.from('creatives').select('id').limit(0);
    if (!e2) maxVersion = 2;
    // Verifica se caption existe tentando seleciona-la
    const { error: e3 } = await supabase.from('creatives').select('caption').limit(0);
    if (!e3) maxVersion = 3;
    const { error: e4 } = await supabase.from('user_settings').select('id').limit(0);
    if (!e4) maxVersion = 4;
  } catch {
    // ignora
  }
  if (maxVersion > 0) {
    localStorage.setItem(MIGRATIONS_VERSION_KEY, String(maxVersion));
    console.log(`[Migrations] Tabelas existentes detectadas ate v${maxVersion}.`);
  }
}
