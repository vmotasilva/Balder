import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.SUPABASE_PUBLISHABLE_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Variáveis de ambiente VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não configuradas. A aplicação funcionará em Modo Demonstração/Convidado.'
  );
}

// Inicializa o cliente do Supabase
// Se as credenciais estiverem vazias, usamos placeholders válidos para evitar throws na inicialização
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

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
