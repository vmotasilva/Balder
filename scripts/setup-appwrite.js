import { Client, Databases, Permission, Role } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'balder_db';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureCollection(colId, name) {
    try {
        const col = await databases.getCollection(databaseId, colId);
        console.log(`Coleção "${name}" (${colId}) já existe.`);
        return col;
    } catch (e) {
        if (e.code === 404) {
            console.log(`Criando coleção "${name}" (${colId})...`);
            const col = await databases.createCollection(
                databaseId,
                colId,
                name,
                [
                    Permission.create(Role.users()),
                    Permission.read(Role.users()),
                    Permission.update(Role.users()),
                    Permission.delete(Role.users()),
                ],
                true // documentSecurity: cada usuário vê e gerencia apenas seus próprios registros
            );
            console.log(`Coleção "${name}" criada com sucesso.`);
            return col;
        }
        throw e;
    }
}

async function createMissingAttribute(colId, existingKeys, attrDef) {
    if (existingKeys.includes(attrDef.key)) {
        return;
    }
    console.log(`  -> Criando atributo "${attrDef.key}" na coleção ${colId}...`);
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
            await databases.createBooleanAttribute(
                databaseId,
                colId,
                attrDef.key,
                attrDef.required ?? false,
                attrDef.default ?? null
            );
        }
        await wait(500); // pequeno intervalo para fila do Appwrite
    } catch (err) {
        if (err.code === 409) {
            console.log(`     Atributo "${attrDef.key}" já existe.`);
        } else {
            console.error(`     Erro ao criar atributo "${attrDef.key}":`, err.message);
        }
    }
}

async function setup() {
    try {
        console.log(`Verificando banco de dados "${databaseId}"...`);
        try {
            await databases.get(databaseId);
            console.log(`Banco "${databaseId}" encontrado e pronto.`);
        } catch (e) {
            if (e.code === 404) {
                console.log(`Criando banco de dados "${databaseId}"...`);
                await databases.create(databaseId, 'Balder Database');
                console.log('Banco de dados criado com sucesso.');
            } else {
                throw e;
            }
        }

        // 1. MOVEMENTS
        const movementsCol = await ensureCollection('movements', 'Movements');
        const movementExisting = (movementsCol.attributes || []).map(a => a.key);
        const movementAttrs = [
            { key: 'title', type: 'string', size: 255, required: true },
            { key: 'type', type: 'string', size: 50, required: true },
            { key: 'amount', type: 'float', required: true },
            { key: 'dueDate', type: 'string', size: 50, required: true },
            { key: 'bank', type: 'string', size: 100, required: true },
            { key: 'status', type: 'string', size: 50, required: true },
            { key: 'category', type: 'string', size: 100, required: true },
            { key: 'notes', type: 'string', size: 1000, required: false },
            { key: 'installmentNumber', type: 'integer', required: false },
            { key: 'installmentsTotal', type: 'integer', required: false },
            { key: 'installmentGroupId', type: 'string', size: 100, required: false },
            { key: 'interestRatePercent', type: 'float', required: false },
        ];
        for (const attr of movementAttrs) {
            await createMissingAttribute('movements', movementExisting, attr);
        }

        // 2. NATURES
        const naturesCol = await ensureCollection('natures', 'Natures');
        const natureExisting = (naturesCol.attributes || []).map(a => a.key);
        const natureAttrs = [
            { key: 'name', type: 'string', size: 255, required: true },
            { key: 'initialBudget', type: 'float', required: false, default: 0 },
            { key: 'description', type: 'string', size: 1000, required: false },
            { key: 'icon', type: 'string', size: 50, required: true },
            { key: 'color', type: 'string', size: 50, required: true },
            { key: 'type', type: 'string', size: 50, required: false, default: 'FIXA' },
            { key: 'mappings', type: 'string', size: 1000000, required: false },
            { key: 'overCeilingJustification', type: 'string', size: 2000, required: false },
            { key: 'justificationHistory', type: 'string', size: 1000000, required: false },
        ];
        for (const attr of natureAttrs) {
            await createMissingAttribute('natures', natureExisting, attr);
        }

        // 3. GOALS
        const goalsCol = await ensureCollection('goals', 'Goals');
        const goalExisting = (goalsCol.attributes || []).map(a => a.key);
        const goalAttrs = [
            { key: 'title', type: 'string', size: 255, required: true },
            { key: 'category', type: 'string', size: 100, required: true },
            { key: 'currentAmount', type: 'float', required: true },
            { key: 'targetAmount', type: 'float', required: true },
            { key: 'monthlyContribution', type: 'float', required: true },
            { key: 'targetDate', type: 'string', size: 50, required: true },
            { key: 'icon', type: 'string', size: 50, required: true },
            { key: 'color', type: 'string', size: 50, required: true },
        ];
        for (const attr of goalAttrs) {
            await createMissingAttribute('goals', goalExisting, attr);
        }

        console.log('\n✅ Setup do Appwrite concluído com sucesso!');
        console.log('As coleções "movements", "natures" e "goals" estão configuradas e prontas com Document-Level Security.');
    } catch (error) {
        console.error('❌ Erro no setup:', error);
    }
}

setup();
