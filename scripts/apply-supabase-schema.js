import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

const config = {
  host: process.env.SUPABASE_DB_HOST || 'db.zlwghcqisnejjqugsxvp.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || '',
  ssl: {
    rejectUnauthorized: false,
  },
};

async function applySchema() {
  console.log('⚡ Conectando ao banco de dados Supabase...');
  console.log(`Host: ${config.host}`);
  
  const client = new Client(config);
  try {
    await client.connect();
    console.log('✓ Conectado com sucesso ao PostgreSQL do Supabase!');

    const schemaPath = path.resolve(__dirname, '../supabase/schema.sql');
    console.log(`Lendo arquivo SQL em: ${schemaPath}`);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executando script DDL e configurando RLS...');
    await client.query(sql);

    console.log('🎉 SUCESSO! Todas as tabelas, índices e políticas RLS foram criadas!');

    // Verifica tabelas criadas
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\nTabelas no schema public:');
    res.rows.forEach(r => console.log(` - ${r.table_name}`));

  } catch (err) {
    console.error('❌ Erro ao aplicar schema no Supabase:', err);
  } finally {
    await client.end();
  }
}

applySchema();
