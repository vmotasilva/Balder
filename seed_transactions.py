import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.tables_db import TablesDB
from appwrite.id import ID

load_dotenv(r'c:\Users\vmota\Documents\Desenvolvimento\Balder\.env')

client = Client()
client.set_endpoint(os.getenv('APPWRITE_ENDPOINT'))
client.set_project(os.getenv('APPWRITE_PROJECT_ID'))
client.set_key(os.getenv('APPWRITE_API_KEY'))

tdb = TablesDB(client)
db_id = os.getenv('APPWRITE_DATABASE_ID', 'balder_db')

family_ws = '6a9cc64500001c2e38ab'
business_ws = '6a9cc652001cd31a9aa6'

now = datetime.now(timezone.utc).isoformat()

transactions = [
    # Family Transactions
    {
        "workspace_id": family_ws,
        "external_provider_id": "tx_fam_001",
        "date": "2026-09-05T18:45:00.000+00:00",
        "description": "Supermercado Pão de Açúcar",
        "amount": 1420.50,
        "type": "expense",
        "predicted_category": "Alimentação & Mercado",
        "ai_confidence_score": 0.89,
        "is_anomaly": True,
        "ai_justification_suggestion": "Valor 77% acima da média móvel histórica (R$ 800,00) para compras de fim de semana na categoria Alimentação.",
        "user_validated": False
    },
    {
        "workspace_id": family_ws,
        "external_provider_id": "tx_fam_002",
        "date": "2026-09-05T10:15:00.000+00:00",
        "description": "Pix Recebido - Dividendos & Proventos",
        "amount": 12500.00,
        "type": "income",
        "predicted_category": "Rendimentos & Investimentos",
        "ai_confidence_score": 0.98,
        "is_anomaly": False,
        "ai_justification_suggestion": None,
        "user_validated": True
    },
    {
        "workspace_id": family_ws,
        "external_provider_id": "tx_fam_003",
        "date": "2026-09-04T15:20:00.000+00:00",
        "description": "Coelba Eletricidade Salvador",
        "amount": 380.40,
        "type": "expense",
        "predicted_category": "Habitação & Utilidades",
        "ai_confidence_score": 0.96,
        "is_anomaly": False,
        "ai_justification_suggestion": "Em conformidade com a âncora fixa 'Coelba' (orçado R$ 400,00).",
        "user_validated": False
    },
    {
        "workspace_id": family_ws,
        "external_provider_id": "tx_fam_004",
        "date": "2026-09-03T21:10:00.000+00:00",
        "description": "Compra Internacional Apple Store Cupertino",
        "amount": 2899.00,
        "type": "expense",
        "predicted_category": "Tecnologia & Equipamentos",
        "ai_confidence_score": 0.92,
        "is_anomaly": True,
        "ai_justification_suggestion": "Despesa não orçada nas âncoras familiares com cobrança em moeda estrangeira convertida.",
        "user_validated": False
    },
    # Business Transactions
    {
        "workspace_id": business_ws,
        "external_provider_id": "tx_biz_001",
        "date": "2026-09-05T16:00:00.000+00:00",
        "description": "AWS Cloud Services Invoice",
        "amount": 8450.20,
        "type": "expense",
        "predicted_category": "Infraestrutura Cloud & SaaS",
        "ai_confidence_score": 0.95,
        "is_anomaly": False,
        "ai_justification_suggestion": "Em conformidade com a âncora fixa de infraestrutura de TI.",
        "user_validated": True
    },
    {
        "workspace_id": business_ws,
        "external_provider_id": "tx_biz_002",
        "date": "2026-09-05T11:00:00.000+00:00",
        "description": "Recebimento Fatura Contrato Enterprise #1042",
        "amount": 85000.00,
        "type": "income",
        "predicted_category": "Receita Operacional",
        "ai_confidence_score": 0.99,
        "is_anomaly": False,
        "ai_justification_suggestion": None,
        "user_validated": True
    },
    {
        "workspace_id": business_ws,
        "external_provider_id": "tx_biz_003",
        "date": "2026-09-04T17:30:00.000+00:00",
        "description": "Consultoria Jurídica Extraordinária",
        "amount": 15000.00,
        "type": "expense",
        "predicted_category": "Serviços Jurídicos",
        "ai_confidence_score": 0.85,
        "is_anomaly": True,
        "ai_justification_suggestion": "Valor extraordinário não previsto no orçamento base mensal de assessoria jurídica.",
        "user_validated": False
    }
]

print("Inserindo transações de teste no Appwrite...")
for tx in transactions:
    row = tdb.create_row(
        database_id=db_id,
        table_id='transactions',
        row_id=ID.unique(),
        data=tx
    )
    print(f"* [{tx['type'].upper()}] {tx['description']} - R$ {tx['amount']} (Anomalia: {tx['is_anomaly']})")

print("Concluido com sucesso!")
