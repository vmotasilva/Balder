/**
 * Balder Database Provisioning Script for Appwrite (Node.js)
 * Author: Infrastructure & Appwrite Specialist
 * Description: Idempotent database, collection, and attribute provisioning
 *              with asynchronous status polling for Appwrite.
 */

const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

const SCHEMA_CONFIG = {
    database: {
        id: "balder_db",
        name: "Balder Database"
    },
    collections: [
        {
            id: "workspaces",
            name: "workspaces",
            attributes: [
                { key: "name", type: "string", size: 255, required: true },
                { key: "type", type: "enum", elements: ["family", "business"], required: true },
                { key: "created_at", type: "datetime", required: true }
            ]
        },
        {
            id: "workspace_members",
            name: "workspace_members",
            attributes: [
                { key: "workspace_id", type: "string", size: 50, required: true },
                { key: "user_id", type: "string", size: 50, required: true },
                { key: "role", type: "enum", elements: ["admin", "partner", "dependent"], required: true }
            ]
        },
        {
            id: "templates",
            name: "templates",
            attributes: [
                { key: "creator_id", type: "string", size: 50, required: true },
                { key: "name", type: "string", size: 255, required: true },
                { key: "is_premium", type: "boolean", required: true },
                { key: "price", type: "float", required: false }
            ]
        },
        {
            id: "fixed_anchors",
            name: "fixed_anchors",
            attributes: [
                { key: "workspace_id", type: "string", size: 50, required: true },
                { key: "name", type: "string", size: 255, required: true },
                { key: "expected_amount", type: "float", required: true },
                { key: "category", type: "string", size: 100, required: true },
                { key: "periodicity", type: "enum", elements: ["monthly", "annual", "variable_season"], required: true }
            ]
        },
        {
            id: "transactions",
            name: "transactions",
            attributes: [
                { key: "workspace_id", type: "string", size: 50, required: true },
                { key: "external_provider_id", type: "string", size: 255, required: false },
                { key: "date", type: "datetime", required: true },
                { key: "description", type: "string", size: 500, required: true },
                { key: "amount", type: "float", required: true },
                { key: "type", type: "enum", elements: ["income", "expense"], required: true },
                { key: "predicted_category", type: "string", size: 100, required: false },
                { key: "ai_confidence_score", type: "float", required: false },
                { key: "is_anomaly", type: "boolean", required: true, default: false },
                { key: "ai_justification_suggestion", type: "string", size: 1000, required: false },
                { key: "user_validated", type: "boolean", required: false, default: false }
            ]
        }
    ]
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function log(icon, msg) {
    const time = new Date().toTimeString().split(' ')[0];
    console.log(`[${time}] ${icon} ${msg}`);
}

async function waitForAttribute(databases, dbId, colId, key, timeout = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const attr = await databases.getAttribute(dbId, colId, key);
            if (attr.status === 'available') {
                log('  ✨', `Attribute '${key}' is active (status: available).`);
                return true;
            } else if (attr.status === 'failed') {
                throw new Error(`Attribute '${key}' failed during Appwrite creation.`);
            } else {
                log('  ⏳', `Attribute '${key}' is ${attr.status}... waiting.`);
            }
        } catch (err) {
            log('  ⚠️', `Error checking attribute '${key}': ${err.message}`);
        }
        await sleep(1000);
    }
    throw new Error(`Timeout waiting for attribute '${key}' to be ready.`);
}

async function ensureAttribute(databases, dbId, colId, spec) {
    const { key, type, required, default: defValue, size, elements } = spec;

    try {
        const attr = await databases.getAttribute(dbId, colId, key);
        if (attr.status === 'available') {
            log('  ✅', `Attribute '${key}' (${type}) already exists and is active.`);
            return;
        } else if (attr.status === 'processing' || attr.status === 'waiting') {
            log('  ⏳', `Attribute '${key}' exists but is ${attr.status}. Waiting...`);
            await waitForAttribute(databases, dbId, colId, key);
            return;
        }
    } catch (err) {
        if (err.code !== 404) throw err;
    }

    log('  ➕', `Creating attribute '${key}' (${type}, required=${required})...`);

    if (type === 'string') {
        await databases.createStringAttribute(dbId, colId, key, size || 255, required, defValue);
    } else if (type === 'enum') {
        await databases.createEnumAttribute(dbId, colId, key, elements, required, defValue);
    } else if (type === 'datetime') {
        await databases.createDatetimeAttribute(dbId, colId, key, required, defValue);
    } else if (type === 'boolean') {
        try {
            await databases.createBooleanAttribute(dbId, colId, key, required, defValue);
        } catch (be) {
            if (be.message && be.message.toLowerCase().includes('default') && required) {
                log('  ⚠️', `Appwrite rejected default with required=true for '${key}'. Falling back to required=false...`);
                await databases.createBooleanAttribute(dbId, colId, key, false, defValue);
            } else {
                throw be;
            }
        }
    } else if (type === 'float') {
        await databases.createFloatAttribute(dbId, colId, key, required, undefined, undefined, defValue);
    }

    await waitForAttribute(databases, dbId, colId, key);
}

async function provision() {
    const endpoint = process.env.APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!projectId) {
        console.error('\n❌ ERRO: APPWRITE_PROJECT_ID não definido no .env!\n');
        process.exit(1);
    }
    if (!apiKey) {
        console.error('\n❌ ERRO: APPWRITE_API_KEY não definido no .env!\n');
        process.exit(1);
    }

    const client = new Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    const databases = new Databases(client);

    log('🛡️', 'Starting Balder Appwrite Infrastructure Provisioning (Node.js)...');

    const dbId = SCHEMA_CONFIG.database.id;
    const dbName = SCHEMA_CONFIG.database.name;

    log('🔍', `Checking database '${dbId}'...`);
    try {
        const db = await databases.get(dbId);
        log('✅', `Database '${dbId}' already exists ('${db.name}').`);
    } catch (err) {
        if (err.code === 404) {
            log('🚀', `Creating database '${dbName}' (${dbId})...`);
            await databases.create(dbId, dbName);
            log('🎉', `Database '${dbId}' created successfully.`);
        } else {
            throw err;
        }
    }

    for (const col of SCHEMA_CONFIG.collections) {
        console.log('-'.repeat(60));
        log('🔍', `Checking collection '${col.id}'...`);
        try {
            await databases.getCollection(dbId, col.id);
            log('✅', `Collection '${col.id}' already exists.`);
        } catch (err) {
            if (err.code === 404) {
                log('🚀', `Creating collection '${col.name}' (${col.id})...`);
                await databases.createCollection(dbId, col.id, col.name);
                log('🎉', `Collection '${col.id}' created successfully.`);
            } else {
                throw err;
            }
        }

        for (const attr of col.attributes) {
            await ensureAttribute(databases, dbId, col.id, attr);
        }
    }

    console.log('='.repeat(60));
    log('🏁', 'All database schemas, collections, and attributes provisioned successfully!');
}

provision().catch(err => {
    console.error('\n❌ Erro durante o provisionamento:', err);
    process.exit(1);
});
