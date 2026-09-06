import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from appwrite.id import ID
from main import app
from app.core.appwrite import get_appwrite_service
from app.core.config import settings

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["appwrite_configured"] is True


def test_transaction_audit_workflow():
    appwrite = get_appwrite_service()
    test_ws = f"ws_test_{ID.unique()[:8]}"

    # Setup: Create a fixed anchor for this workspace in Appwrite
    anchor_id = ID.unique()
    anchor_data = {
        "workspace_id": test_ws,
        "name": "Aluguel Apartamento",
        "expected_amount": 2500.0,
        "category": "Moradia / Contas",
        "periodicity": "monthly"
    }

    try:
        appwrite.tables_db.create_row(
            database_id=settings.APPWRITE_DATABASE_ID,
            table_id=settings.COLLECTION_FIXED_ANCHORS,
            row_id=anchor_id,
            data=anchor_data
        )

        # Test Case 1: Transaction matching the anchor within expected price (Normal)
        payload_normal = {
            "workspace_id": test_ws,
            "amount": -2500.0,
            "description": "Pix Pagamento Aluguel Apartamento",
            "date": "2026-09-05T14:30:00.000+00:00"
        }
        res_normal = client.post("/webhooks/transactions", json=payload_normal)
        assert res_normal.status_code == 201
        data_normal = res_normal.json()
        assert data_normal["success"] is True
        assert data_normal["audit"]["matched_anchor_name"] == "Aluguel Apartamento"
        assert data_normal["audit"]["is_anomaly"] is False
        assert data_normal["audit"]["ai_confidence_score"] >= 0.90
        trans_id_1 = data_normal["transaction_id"]

        # Test Case 2: Transaction matching anchor with 40% deviation (Anomaly)
        payload_anomaly = {
            "workspace_id": test_ws,
            "amount": -3500.0,
            "description": "Aluguel Apartamento - Taxas extras",
            "date": "2026-09-05T14:35:00.000+00:00"
        }
        res_anomaly = client.post("/webhooks/transactions", json=payload_anomaly)
        assert res_anomaly.status_code == 201
        data_anomaly = res_anomaly.json()
        assert data_anomaly["success"] is True
        assert data_anomaly["audit"]["matched_anchor_name"] == "Aluguel Apartamento"
        assert data_anomaly["audit"]["is_anomaly"] is True
        assert "Alerta de Desvio" in data_anomaly["audit"]["ai_justification_suggestion"]
        trans_id_2 = data_anomaly["transaction_id"]

        # Test Case 3: High value unplanned transaction without anchor
        payload_unplanned = {
            "workspace_id": test_ws,
            "amount": -4500.0,
            "description": "Compra Loja Joias LTDA",
            "date": "2026-09-05T14:40:00.000+00:00"
        }
        res_unplanned = client.post("/webhooks/transactions", json=payload_unplanned)
        assert res_unplanned.status_code == 201
        data_unplanned = res_unplanned.json()
        assert data_unplanned["success"] is True
        assert data_unplanned["audit"]["matched_anchor_name"] is None
        assert data_unplanned["audit"]["is_anomaly"] is True
        trans_id_3 = data_unplanned["transaction_id"]

        print("\nAll 3 test scenarios passed successfully!")

        # Cleanup created records from Appwrite
        for tid in [trans_id_1, trans_id_2, trans_id_3]:
            try:
                appwrite.tables_db.delete_row(settings.APPWRITE_DATABASE_ID, settings.COLLECTION_TRANSACTIONS, tid)
            except Exception:
                pass

    finally:
        try:
            appwrite.tables_db.delete_row(settings.APPWRITE_DATABASE_ID, settings.COLLECTION_FIXED_ANCHORS, anchor_id)
        except Exception:
            pass


if __name__ == "__main__":
    test_health()
    test_transaction_audit_workflow()
    print("Automated test executed with 100% success!")
