from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator


class TransactionWebhookPayload(BaseModel):
    """
    Incoming webhook payload simulating an Open Finance transaction.
    """
    workspace_id: str = Field(..., description="Target workspace ID in Balder", min_length=1, max_length=50)
    amount: float = Field(..., description="Transaction monetary value (positive or negative)")
    description: str = Field(..., description="Transaction description / vendor name", min_length=1, max_length=500)
    date: datetime | str = Field(
        default_factory=datetime.utcnow,
        description="Transaction datetime in ISO 8601 format"
    )
    external_provider_id: Optional[str] = Field(
        default=None,
        description="External banking/Open Finance reference ID"
    )
    type: Optional[Literal["income", "expense"]] = Field(
        default=None,
        description="Transaction type. If omitted, inferred from amount (negative=expense, positive=income)"
    )

    @field_validator("date", mode="before")
    def parse_datetime(cls, v):
        if isinstance(v, str):
            # Parse ISO or return formatted string
            try:
                dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                return dt
            except ValueError:
                return v
        return v

    def get_iso_date(self) -> str:
        if isinstance(self.date, datetime):
            return self.date.strftime("%Y-%m-%dT%H:%M:%S.000+00:00")
        return str(self.date)

    def get_type(self) -> str:
        if self.type:
            return self.type
        return "expense" if self.amount < 0 or "pagamento" in self.description.lower() or "pix" in self.description.lower() else "income"


class AuditResult(BaseModel):
    """
    Result returned from the AI Auditor service.
    """
    matched_anchor_name: Optional[str] = None
    expected_amount: Optional[float] = None
    predicted_category: Optional[str] = None
    ai_confidence_score: float
    is_anomaly: bool
    ai_justification_suggestion: str


class TransactionAuditResponse(BaseModel):
    """
    Response schema for POST /webhooks/transactions.
    """
    success: bool
    message: str
    transaction_id: str
    audit: AuditResult
    recorded_data: dict
