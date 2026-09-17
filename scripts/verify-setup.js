import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function verify() {
  console.log('=== VERIFICAÇÃO DO BANCO BALDER_DB NO APPWRITE ===');
  for (const cid of ['movements', 'natures', 'goals']) {
    const col = await databases.getCollection('balder_db', cid);
    console.log(`\nColeção: ${col.name} [${col['$id']}]`);
    console.log(`Document Security (Multi-tenant): ${col.documentSecurity ? 'ATIVO' : 'INATIVO'}`);
    console.log(`Total de Atributos: ${col.attributes.length}`);
    col.attributes.forEach(a => console.log(`  • ${a.key} (${a.type})`));
  }
}

verify().catch(console.error);
