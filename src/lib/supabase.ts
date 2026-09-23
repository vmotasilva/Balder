import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://zlwghcqisnejjqugsxvp.supabase.co';
const defaultKey = 'sb_publishable_dTZJs1GDyT9jOIc3JA3yRQ_0q3NpIzY';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  defaultUrl;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  defaultKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http')
);

// Inicializa o cliente do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Mapeamento dos nomes das tabelas no PostgreSQL
export const TABLES = {
  MOVEMENTS: 'movements',
  NATURES: 'natures',
  GOALS: 'goals',
  ACCOUNTS: 'accounts',
  SALARY_CONTRACTS: 'salary_contracts',
  CHECKPOINTS: 'checkpoints',
  PAYMENT_METHODS: 'payment_methods',
} as const;
