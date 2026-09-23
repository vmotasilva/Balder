import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('⚠️ Aviso: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão configurados no arquivo .env.');
  console.log('Por favor, adicione suas credenciais do Supabase no arquivo .env para testar.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('====================================================');
  console.log('⚡ BALDER: TESTE DE CONEXÃO COM SUPABASE');
  console.log(`URL: ${supabaseUrl}`);
  console.log('====================================================');

  const tables = [
    'movements',
    'natures',
    'goals',
    'accounts',
    'salary_contracts',
    'checkpoints',
    'payment_methods',
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ Tabela "${table}": Erro (${error.message})`);
    } else {
      console.log(`✓ Tabela "${table}": Acessível via RLS.`);
    }
  }

  console.log('====================================================');
  console.log('Teste concluído!');
}

testConnection().catch(console.error);
