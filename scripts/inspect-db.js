import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function inspect() {
  const cols = await databases.listCollections('balder_db');
  for (const c of cols.collections) {
    console.log(`\n========================================`);
    console.log(`Collection: ${c.name} (ID: ${c['$id']})`);
    console.log(`Document Security: ${c.documentSecurity}`);
    console.log(`Permissions:`, c['$permissions']);
    console.log(`Attributes (${c.attributes.length}):`);
    for (const a of c.attributes) {
      console.log(`  - ${a.key} (${a.type}, required: ${a.required})`);
    }
  }
}

inspect().catch(console.error);
