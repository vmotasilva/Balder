# Balder - Microsserviço de Inteligência Financeira e Auditoria IA

Microsserviço construído com **FastAPI** e **Appwrite Python SDK** para processamento de transações bancárias (Open Finance), correlação com despesas planejadas (âncoras fixas) e auditoria automatizada por IA.

---

## 🏗️ Arquitetura do Projeto

```
Balder/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   └── webhooks.py          # Rota POST /webhooks/transactions
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Variáveis de ambiente e configurações
│   │   └── appwrite.py          # Wrapper do Client Appwrite e Databases/TablesDB
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py           # Modelos Pydantic de entrada e saída
│   └── services/
│       ├── __init__.py
│       └── ai_auditor.py        # Módulo isolado de auditoria e regras de IA
├── tests/
│   ├── __init__.py
│   └── test_audit_webhook.py   # Testes de integração ponta a ponta
├── main.py                      # Ponto de entrada FastAPI e inicialização do servidor
├── provision_appwrite.py        # Script de provisionamento idempotente do Appwrite
├── requirements.txt             # Dependências Python
└── .env                         # Variáveis de ambiente (ignorado no Git)
```

---

## ⚙️ Variáveis de Ambiente (`.env`)

```env
APPWRITE_ENDPOINT=https://sfo.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=6a9c60c1003ddd007882
APPWRITE_API_KEY=sua_api_key_aqui
APPWRITE_DATABASE_ID=balder_db
```

---

## 🚀 Como Executar o Microsserviço

### 1. Instalar Dependências
```bash
pip install -r requirements.txt
```

### 2. Iniciar o Servidor FastAPI com Uvicorn
```bash
python main.py
```
*Ou diretamente via Uvicorn:*
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- Documentação Swagger interativa: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

---

## 📡 Rota de Webhook: Ingestão Open Finance

### `POST /webhooks/transactions`

#### Exemplo de Payload de Entrada:
```json
{
  "workspace_id": "workspace_exemplo_123",
  "amount": -2850.00,
  "description": "Pix Aluguel Apartamento",
  "date": "2026-09-05T15:30:00.000+00:00"
}
```

#### Fluxo de Execução:
1. Consulta âncoras da coleção `fixed_anchors` no Appwrite vinculadas ao `workspace_id` usando `Query.equal`.
2. O serviço `ai_auditor.py` calcula o desvio orçamentário ou detecta anomalias de liquidez/fornecedor.
3. Persiste a transação na coleção `transactions` do Appwrite com os campos auditados:
   - `predicted_category`
   - `ai_confidence_score`
   - `is_anomaly`
   - `ai_justification_suggestion`
4. Retorna confirmação e ID da transação criada no Appwrite.

---

## 🧪 Como Rodar os Testes Automatizados

```bash
python tests/test_audit_webhook.py
```
