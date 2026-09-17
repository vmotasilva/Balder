import { Client, Databases, Permission, Role } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'balder_db';

if (!projectId || !apiKey) {
  console.error('❌ Erro: VITE_APPWRITE_PROJECT_ID e APPWRITE_API_KEY devem estar definidos no arquivo .env');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Garante a existência da coleção e habilita Document-Level Security
 */
async function ensureCollectionWithDLS(colId, name) {
  try {
    const col = await databases.getCollection(databaseId, colId);
    console.log(`\n📦 Coleção "${name}" (${colId}) já existe.`);
    
    // Assegura que Document-Level Security esteja ativado
    if (!col.documentSecurity) {
      console.log(`  -> Ativando Document-Level Security na coleção "${colId}"...`);
      await databases.updateCollection(
        databaseId,
        colId,
        name,
        [Permission.create(Role.users())],
        true // documentSecurity: true
      );
      console.log(`  ✓ Document-Level Security ativado com sucesso!`);
    } else {
      console.log(`  ✓ Document-Level Security já está ativo.`);
    }

    return col;
  } catch (e) {
    if (e.code === 404) {
      console.log(`\n🚀 Criando coleção "${name}" (${colId}) com Document-Level Security...`);
      const col = await databases.createCollection(
        databaseId,
        colId,
        name,
        [
          Permission.create(Role.users()), // Apenas usuários autenticados podem criar documentos
        ],
        true // documentSecurity: true -> Acesso a leitura/edição/deleção controlado estritamente por documento
      );
      console.log(`  ✓ Coleção "${name}" criada com sucesso.`);
      return col;
    }
    throw e;
  }
}

/**
 * Cria atributo caso ainda não exista na coleção
 */
async function createAttributeSafely(colId, existingKeys, attrDef) {
  if (existingKeys.includes(attrDef.key)) {
    console.log(`  • Atributo "${attrDef.key}" (${attrDef.type}) já existe.`);
    return;
  }

  console.log(`  + Criando atributo "${attrDef.key}" (${attrDef.type}, ${attrDef.required ? 'obrigatório' : 'opcional'})...`);
  try {
    if (attrDef.type === 'string') {
      await databases.createStringAttribute(
        databaseId,
        colId,
        attrDef.key,
        attrDef.size || 255,
        attrDef.required ?? false,
        attrDef.default ?? null
      );
    } else if (attrDef.type === 'float') {
      await databases.createFloatAttribute(
        databaseId,
        colId,
        attrDef.key,
        attrDef.required ?? false,
        attrDef.min ?? null,
        attrDef.max ?? null,
        attrDef.default ?? null
      );
    } else if (attrDef.type === 'integer') {
      await databases.createIntegerAttribute(
        databaseId,
        colId,
        attrDef.key,
        attrDef.required ?? false,
        attrDef.min ?? null,
        attrDef.max ?? null,
        attrDef.default ?? null
      );
    } else if (attrDef.type === 'boolean') {
      const hasDefault = attrDef.default !== null && attrDef.default !== undefined;
      await databases.createBooleanAttribute(
        databaseId,
        colId,
        attrDef.key,
        hasDefault ? false : (attrDef.required ?? false),
        hasDefault ? attrDef.default : null
      );
    }

    // Intervalo de segurança para a fila de indexação do Appwrite processar o atributo
    await wait(600);
    console.log(`    ✓ Atributo "${attrDef.key}" criado.`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`    • Atributo "${attrDef.key}" já estava em processamento ou criado.`);
    } else {
      console.error(`    ❌ Erro ao criar atributo "${attrDef.key}":`, err.message);
    }
  }
}

async function runMigration() {
  console.log('====================================================');
  console.log('⚡ BALDER: MIGRATION APPWRITE CLOUD (DLS ENABLED)');
  console.log(`Endpoint:   ${endpoint}`);
  console.log(`Project ID: ${projectId}`);
  console.log(`Database:   ${databaseId}`);
  console.log('====================================================');

  try {
    // 0. Garante existência do Banco de Dados
    try {
      await databases.get(databaseId);
      console.log(`✓ Banco de dados "${databaseId}" verificado.`);
    } catch (e) {
      if (e.code === 404) {
        console.log(`Criando banco de dados "${databaseId}"...`);
        await databases.create(databaseId, 'Balder Database');
        console.log('✓ Banco de dados criado com sucesso.');
      } else {
        throw e;
      }
    }

    // ----------------------------------------------------
    // 1. Coleção: ACCOUNTS
    // ----------------------------------------------------
    const accountsCol = await ensureCollectionWithDLS('accounts', 'Accounts');
    const existingAccounts = (accountsCol.attributes || []).map((a) => a.key);
    const accountsAttrs = [
      { key: 'name', type: 'string', size: 255, required: true },
      { key: 'type', type: 'string', size: 50, required: true },
      { key: 'institution', type: 'string', size: 100, required: false },
      { key: 'initialBalance', type: 'float', required: true },
      { key: 'color', type: 'string', size: 50, required: false },
      { key: 'icon', type: 'string', size: 50, required: false },
    ];
    for (const attr of accountsAttrs) {
      await createAttributeSafely('accounts', existingAccounts, attr);
    }

    // ----------------------------------------------------
    // 2. Coleção: SALARY_CONTRACTS
    // ----------------------------------------------------
    const salaryCol = await ensureCollectionWithDLS('salary_contracts', 'Salary Contracts');
    const existingSalary = (salaryCol.attributes || []).map((a) => a.key);
    const salaryAttrs = [
      { key: 'employer', type: 'string', size: 255, required: true },
      { key: 'role', type: 'string', size: 255, required: false },
      { key: 'paymentSchedule', type: 'string', size: 50, required: true },
      { key: 'paymentDay', type: 'integer', required: true },
      { key: 'secondPaymentDay', type: 'integer', required: false },
      { key: 'firstInstallmentAmount', type: 'float', required: false },
      { key: 'secondInstallmentAmount', type: 'float', required: false },
      { key: 'currentNetAmount', type: 'float', required: true },
      { key: 'receivingBankName', type: 'string', size: 100, required: true },
    ];
    for (const attr of salaryAttrs) {
      await createAttributeSafely('salary_contracts', existingSalary, attr);
    }

    // ----------------------------------------------------
    // 3. Coleção: CHECKPOINTS
    // ----------------------------------------------------
    const checkpointsCol = await ensureCollectionWithDLS('checkpoints', 'Checkpoints');
    const existingCheckpoints = (checkpointsCol.attributes || []).map((a) => a.key);
    const checkpointAttrs = [
      { key: 'startDate', type: 'string', size: 20, required: true },
      { key: 'initialBalance', type: 'float', required: true },
      { key: 'creditCardDebt', type: 'float', required: false },
      { key: 'cardDueDate', type: 'string', size: 20, required: false },
      { key: 'cardName', type: 'string', size: 100, required: false },
      { key: 'cardInstallments', type: 'integer', required: false },
      { key: 'cardInstallmentAmount', type: 'float', required: false },
      { key: 'isActive', type: 'boolean', required: true, default: false },
    ];
    for (const attr of checkpointAttrs) {
      await createAttributeSafely('checkpoints', existingCheckpoints, attr);
    }

    // ----------------------------------------------------
    // 4. Coleção: PAYMENT_METHODS
    // ----------------------------------------------------
    const paymentMethodsCol = await ensureCollectionWithDLS('payment_methods', 'Payment Methods');
    const existingPaymentMethods = (paymentMethodsCol.attributes || []).map((a) => a.key);
    const paymentMethodsAttrs = [
      { key: 'name', type: 'string', size: 255, required: true },
      { key: 'type', type: 'string', size: 50, required: true },
      { key: 'creditLimit', type: 'float', required: false },
      { key: 'closingDay', type: 'integer', required: false },
      { key: 'dueDay', type: 'integer', required: false },
      { key: 'accountId', type: 'string', size: 100, required: false },
    ];
    for (const attr of paymentMethodsAttrs) {
      await createAttributeSafely('payment_methods', existingPaymentMethods, attr);
    }

    console.log('\n====================================================');
    console.log('🎉 PROVISIONAMENTO APPWRITE CONCLUÍDO COM SUCESSO!');
    console.log('Todas as 4 coleções foram criadas/atualizadas com:');
    console.log(' - Document-Level Security ATIVADO (documentSecurity: true)');
    console.log(' - Permissão de criação para usuários logados: Role.users()');
    console.log(' - Atributos e tipos rigorosamente mapeados.');
    console.log('====================================================');
  } catch (error) {
    console.error('\n❌ Erro durante o provisionamento:', error);
    process.exit(1);
  }
}

runMigration();
