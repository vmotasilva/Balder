import { Client, Account, Databases, TablesDB } from 'react-native-appwrite';

/**
 * Appwrite Client Configuration for Balder Mobile
 * Consumes public Expo environment variables with fallback defaults.
 */
export const APPWRITE_ENDPOINT =
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';

export const APPWRITE_PROJECT_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '6a9c60c1003ddd007882';

export const APPWRITE_DATABASE_ID =
  process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || 'balder_db';

// Collection / Table IDs
export const COLLECTIONS = {
  WORKSPACES: 'workspaces',
  WORKSPACE_MEMBERS: 'workspace_members',
  TEMPLATES: 'templates',
  FIXED_ANCHORS: 'fixed_anchors',
  TRANSACTIONS: 'transactions',
} as const;

// Initialize Appwrite Client
export const client = new Client();

client
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

// Initialize Services
export const account = new Account(client);
export const databases = new Databases(client);
export const tablesDB = new TablesDB(client);

export default client;
