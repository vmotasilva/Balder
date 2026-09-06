import logging
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schemas import (
    TransactionWebhookPayload,
    TransactionAuditResponse,
    AuditResult,
)
from app.services.ai_auditor import AIAuditorService
from app.core.appwrite import AppwriteService, get_appwrite_service

logger = logging.getLogger("balder.webhooks")
router = APIRouter(prefix="/webhooks", tags=["Open Finance Webhooks"])


@router.post(
    "/transactions",
    response_model=TransactionAuditResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Receive Open Finance Transaction & Run AI Audit",
    description="Processes incoming banking transactions, correlates with fixed anchors, runs AI audit heuristics, and records to Appwrite."
)
async def process_transaction_webhook(
    payload: TransactionWebhookPayload,
    appwrite: AppwriteService = Depends(get_appwrite_service)
):
    """
    Core Open Finance ingestion and audit endpoint:
    1. Queries registered fixed anchors for the given workspace.
    2. Runs AI auditor evaluation (confidence, anomaly, justification).
    3. Persists the transaction and audit metrics in Appwrite.
    """
    try:
        # Step 1: Query fixed anchors registered in workspace for pattern matching
        anchors = appwrite.find_fixed_anchors_by_workspace(payload.workspace_id)
        logger.info(
            f"Found {len(anchors)} fixed anchors for workspace '{payload.workspace_id}'."
        )

        # Step 2: Run AI audit with Google Gemini
        audit_dict = await AIAuditorService.audit_transaction(
            description=payload.description,
            amount=payload.amount,
            date=payload.get_iso_date(),
            anchors=anchors,
            workspace_id=payload.workspace_id
        )

        audit_result = AuditResult(
            matched_anchor_name=audit_dict.get("matched_anchor_name"),
            expected_amount=audit_dict.get("expected_amount"),
            predicted_category=audit_dict.get("predicted_category"),
            ai_confidence_score=float(audit_dict.get("ai_confidence_score", 0.8)),
            is_anomaly=bool(audit_dict.get("is_anomaly", False)),
            ai_justification_suggestion=str(audit_dict.get("ai_justification_suggestion", ""))
        )

        # Step 3: Prepare structured Appwrite document payload
        transaction_doc = {
            "workspace_id": payload.workspace_id,
            "external_provider_id": payload.external_provider_id,
            "date": payload.get_iso_date(),
            "description": payload.description,
            "amount": float(abs(payload.amount)),
            "type": payload.get_type(),
            "predicted_category": audit_result.predicted_category,
            "ai_confidence_score": float(audit_result.ai_confidence_score),
            "is_anomaly": bool(audit_result.is_anomaly),
            "ai_justification_suggestion": audit_result.ai_justification_suggestion,
            "user_validated": False
        }

        # Step 4: Insert transaction into Appwrite
        inserted = appwrite.insert_transaction(transaction_doc)
        trans_id = inserted["id"]

        logger.info(
            f"Transaction '{trans_id}' persisted in Appwrite. Anomaly={audit_result.is_anomaly}"
        )

        return TransactionAuditResponse(
            success=True,
            message="Transação processada e auditada com sucesso pelo Balder AI.",
            transaction_id=trans_id,
            audit=audit_result,
            recorded_data=transaction_doc
        )

    except Exception as e:
        logger.error(f"Failed to process transaction webhook: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno no processamento e auditoria da transação: {str(e)}"
        )
