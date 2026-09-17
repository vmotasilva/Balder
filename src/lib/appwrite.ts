import { Client, Databases, Account } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || '';
export const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID || '';

const client = new Client();

if (projectId) {
  client
      .setEndpoint(endpoint)
      .setProject(projectId);
} else {
  console.warn("Appwrite Project ID not set! Please configure .env file.");
}

export const account = new Account(client);
export const databases = new Databases(client);
export { client };

// Coleções do banco
export const COLLECTIONS = {
  MOVEMENTS: 'movements',
  NATURES: 'natures',
  GOALS: 'goals',
  ACCOUNTS: 'accounts',
  SALARY_CONTRACTS: 'salary_contracts',
  CHECKPOINTS: 'checkpoints',
  PAYMENT_METHODS: 'payment_methods',
};
