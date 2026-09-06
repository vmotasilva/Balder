"""
Balder AI Auditor Service
Handles financial transaction auditing, anomaly detection, category prediction,
and justification generation. Designed for seamless extension to LLMs (e.g., Google Gemini).
"""

from typing import List, Dict, Any, Tuple
from app.models.schemas import AuditResult


class AIAuditorService:
    """
    Financial auditor intelligence layer.
    Evaluates transactions against fixed anchors and detects deviations or unusual activities.
    """

    # Keyword mappings for heuristic category prediction (to be extended with Gemini embeddings/LLM)
    CATEGORY_KEYWORDS = {
        "Alimentação / Mercado": ["supermercado", "mercado", "carrefour", "pao de acucar", "assai", "hortifruti", "atacadista", "ifood", "restaurante", "lanchonete", "padaria"],
        "Transporte / Mobilidade": ["uber", "99app", "combustivel", "posto", "ipiranga", "shell", "estacionamento", "sem parar", "pedagio"],
        "Streaming / Assinaturas": ["netflix", "spotify", "prime", "amazon", "youtube", "hbo", "disney", "apple.com"],
        "Moradia / Contas": ["aluguel", "condominio", "enel", "sabesp", "cpfl", "luz", "agua", "gas", "internet", "claro", "vivo"],
        "Saúde / Farmácia": ["farmacia", "droga raia", "drogasil", "hospital", "laboratorio", "consulta"],
        "Educação": ["escola", "colegio", "faculdade", "curso", "udemy", "alura"],
        "Lazer / Entretenimento": ["cinema", "ingresso", "show", "teatro", "hotel", "airbnb", "viagem"]
    }

    @classmethod
    def _find_best_anchor_match(cls, description: str, anchors: List[Dict[str, Any]]) -> Dict[str, Any] | None:
        """
        Finds a registered fixed anchor matching the transaction description.
        """
        desc_lower = description.lower()
        for anchor in anchors:
            anchor_name = anchor.get("name", "").lower()
            if not anchor_name:
                continue
            # Bidirectional containment match
            if anchor_name in desc_lower or desc_lower in anchor_name:
                return anchor
        return None

    @classmethod
    def _predict_category(cls, description: str, matched_anchor: Dict[str, Any] | None = None) -> str:
        """
        Predicts category based on matched anchor or fallback keyword heuristics.
        """
        if matched_anchor and matched_anchor.get("category"):
            return matched_anchor["category"]

        desc_lower = description.lower()
        for category, keywords in cls.CATEGORY_KEYWORDS.items():
            if any(kw in desc_lower for kw in keywords):
                return category

        return "Outros / Despesas Gerais"

    @classmethod
    def audit_transaction(
        cls,
        workspace_id: str,
        amount: float,
        description: str,
        anchors: List[Dict[str, Any]]
    ) -> AuditResult:
        """
        Main auditing routine.
        Computes ai_confidence_score, detects anomalies, and generates justified explanations.
        """
        abs_amount = abs(amount)
        matched_anchor = cls._find_best_anchor_match(description, anchors)
        category = cls._predict_category(description, matched_anchor)

        # Case 1: Transaction matches an existing fixed anchor
        if matched_anchor:
            expected = float(matched_anchor.get("expected_amount", 0.0))
            anchor_name = matched_anchor.get("name", "Âncora Fixa")

            if expected > 0:
                deviation = (abs_amount - expected) / expected
                # Flag as anomaly if deviation exceeds 20%
                if deviation > 0.20:
                    is_anomaly = True
                    confidence = 0.88
                    justification = (
                        f"Alerta de Desvio Orçamentário: O valor de R$ {abs_amount:.2f} excedeu a âncora fixa "
                        f"'{anchor_name}' (esperado: R$ {expected:.2f}) em {deviation * 100:.1f}%. "
                        f"Sugere-se verificação de cobrança indevida ou reajuste."
                    )
                elif deviation < -0.40:
                    # Significantly lower than planned (might be partial or incomplete bill)
                    is_anomaly = False
                    confidence = 0.90
                    justification = (
                        f"Despesa compatível com âncora '{anchor_name}', porém abaixo da média planejada "
                        f"(esperado: R$ {expected:.2f}, pago: R$ {abs_amount:.2f})."
                    )
                else:
                    # In compliance
                    is_anomaly = False
                    confidence = 0.96
                    justification = (
                        f"Despesa auditada e validada em conformidade com a âncora fixa '{anchor_name}' "
                        f"(planejado: R$ {expected:.2f}, realizado: R$ {abs_amount:.2f})."
                    )
            else:
                is_anomaly = False
                confidence = 0.85
                justification = f"Despesa vinculada à âncora '{anchor_name}' sem valor-teto fixado."

            return AuditResult(
                matched_anchor_name=anchor_name,
                expected_amount=expected,
                predicted_category=category,
                ai_confidence_score=confidence,
                is_anomaly=is_anomaly,
                ai_justification_suggestion=justification
            )

        # Case 2: Unplanned / Non-anchored transaction
        # Heuristic: Large unexpected expense (> R$ 1,500.00) flags an alert
        if abs_amount >= 1500.00:
            is_anomaly = True
            confidence = 0.75
            justification = (
                f"Atenção: Transação avulsa de valor expressivo (R$ {abs_amount:.2f}) não vinculada a "
                f"nenhuma âncora fixa registrada no workspace. Recomenda-se validação manual."
            )
        else:
            is_anomaly = False
            confidence = 0.82
            justification = (
                f"Transação corrente processada e classificada sob '{category}'. "
                f"Nenhum padrão anômalo detectado nos limites habituais de liquidez."
            )

        return AuditResult(
            matched_anchor_name=None,
            expected_amount=None,
            predicted_category=category,
            ai_confidence_score=confidence,
            is_anomaly=is_anomaly,
            ai_justification_suggestion=justification
        )
