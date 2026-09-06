"""
Balder AI Auditor Service - Google Gemini Powered
Performs financial transaction auditing, anomaly detection, category prediction,
and continuous budgetary auditing using Google Gemini (SDK google-generativeai).
Includes safe fallbacks for resilience and Vercel serverless environments.
"""

import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

import google.generativeai as genai
from app.core.config import settings
from app.models.schemas import AuditResult

logger = logging.getLogger("balder.ai_auditor")

# ------------------------------------------------------------------------------
# Configure Google Gemini Client
# ------------------------------------------------------------------------------
GEMINI_API_KEY = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        logger.info("Google Gemini SDK configurado com sucesso para auditoria financeira.")
    except Exception as e:
        logger.warning(f"Falha ao configurar SDK do Google Gemini: {e}")
else:
    logger.warning("GEMINI_API_KEY não encontrada nas variáveis de ambiente. O serviço usará fallback seguro.")


class AIAuditorService:
    """
    Financial auditor intelligence service powered by Google Gemini.
    """

    SYSTEM_PROMPT = """Você é o Balder AI, um auditor financeiro implacável, meticuloso e especialista em detecção de desvios orçamentários, fraudes e anomalias financeiras via Open Finance.

Sua missão é analisar uma nova transação financeira contra o orçamento e a lista de âncoras fixas (gastos recorrentes previstos) do workspace do cliente.

Critérios de Auditoria:
1. Correspondência com Âncoras Fixas:
   - Verifique se a descrição da transação corresponde a alguma âncora fixa cadastrada (ex: concessionárias de energia, água, aluguel, condomínio, assinaturas, folhas de pagamento, contratos recorrentes).
   - Se houver correspondência, compare o valor da transação com o valor esperado (expected_amount) da âncora.
   - Se o valor executado for discrepante da previsão (ex: superior a 15-20% do previsto), marque "is_anomaly": true.
   - Se estiver dentro da margem esperada, marque "is_anomaly": false.
2. Gastos Avulsos / Não Cadastrados:
   - Se não houver âncora fixa correspondente e o valor for expressivo ou atípico para despesas cotidianas não planejadas, considere como anomalia ("is_anomaly": true).
   - Gastos cotidianos moderados sem desvio severo devem ter "is_anomaly": false.
3. Receitas (income):
   - A menos que pareça uma movimentação atípica ou crédito errôneo, receitas ordinárias têm "is_anomaly": false.
4. Justificativa:
   - "ai_justification_suggestion": Escreva um texto explicativo em português brasileiro, curto, direto e profissional (1 a 2 frases) explicando exatamente a razão do parecer (ex: citando a porcentagem de desvio sobre a âncora ou a falta de previsão no orçamento).
5. Confiança:
   - "ai_confidence_score": Um número decimal float entre 0.0 e 1.0 indicando a certeza da sua auditoria.
6. Categoria:
   - "predicted_category": Sugira a categoria mais adequada para a transação em português (ex: "Moradia / Habitação", "Alimentação & Mercado", "Tecnologia & Cloud", "Operacional", "Outros").

Você DEVE retornar EXATAMENTE um objeto JSON válido no seguinte formato:
{
  "is_anomaly": boolean,
  "ai_confidence_score": float,
  "ai_justification_suggestion": string,
  "predicted_category": string
}
"""

    @classmethod
    def _fallback_audit(
        cls,
        description: str,
        amount: float,
        anchors: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Safe heuristic fallback when Gemini is unreachable, timed out, or API key is absent.
        Guarantees is_anomaly=False by default or safe baseline analysis.
        """
        abs_amount = abs(amount)
        desc_lower = description.lower()
        matched_anchor = None

        for anchor in anchors:
            a_name = anchor.get("name", "").lower()
            if a_name and (a_name in desc_lower or desc_lower in a_name):
                matched_anchor = anchor
                break

        if matched_anchor:
            expected = float(matched_anchor.get("expected_amount", 0.0))
            category = matched_anchor.get("category", "Despesas Fixas")
            anchor_name = matched_anchor.get("name", "Âncora Fixa")

            if expected > 0 and abs_amount > (expected * 1.25):
                deviation = ((abs_amount - expected) / expected) * 100
                return {
                    "is_anomaly": True,
                    "ai_confidence_score": 0.85,
                    "ai_justification_suggestion": (
                        f"Alerta de Desvio: gasto de R$ {abs_amount:.2f} excedeu a âncora '{anchor_name}' "
                        f"(esperado: R$ {expected:.2f}) em {deviation:.1f}%."
                    ),
                    "predicted_category": category,
                    "matched_anchor_name": anchor_name,
                    "expected_amount": expected,
                }
            else:
                return {
                    "is_anomaly": False,
                    "ai_confidence_score": 0.90,
                    "ai_justification_suggestion": (
                        f"Transação em conformidade com a âncora fixa '{anchor_name}'."
                    ),
                    "predicted_category": category,
                    "matched_anchor_name": anchor_name,
                    "expected_amount": expected,
                }

        # Unanchored transactions: high value unplanned expense flags anomaly
        if abs_amount >= 1500.00:
            return {
                "is_anomaly": True,
                "ai_confidence_score": 0.75,
                "ai_justification_suggestion": (
                    f"Atenção: Transação avulsa de valor expressivo (R$ {abs_amount:.2f}) não vinculada a "
                    f"nenhuma âncora fixa registrada no workspace. Recomenda-se validação manual."
                ),
                "predicted_category": "Despesas Gerais",
                "matched_anchor_name": None,
                "expected_amount": None,
            }

        # Regular unanchored safe fallback
        return {
            "is_anomaly": False,
            "ai_confidence_score": 0.70,
            "ai_justification_suggestion": "Transação registrada em conformidade na esteira de auditoria.",
            "predicted_category": "Despesas Gerais",
            "matched_anchor_name": None,
            "expected_amount": None,
        }

    @classmethod
    async def audit_transaction(
        cls,
        description: str,
        amount: float,
        date: str,
        anchors: List[Dict[str, Any]],
        workspace_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Audits transaction using Google Gemini with structured JSON output.
        Falls back safely to local heuristics on timeout, missing API key, or parsing errors.
        """
        # If API key is missing, execute safe fallback immediately
        current_api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        if not current_api_key:
            logger.info("GEMINI_API_KEY ausente. Executando auditoria em modo fallback seguro.")
            return cls._fallback_audit(description, amount, anchors)

        try:
            # Build anchors prompt context
            anchors_summary = []
            for a in anchors:
                name = a.get("name", "N/A")
                expected = a.get("expected_amount", 0.0)
                cat = a.get("category", "Geral")
                period = a.get("periodicity", "mensal")
                anchors_summary.append(f"- {name}: R$ {expected:.2f} ({cat}, {period})")

            anchors_text = (
                "\n".join(anchors_summary)
                if anchors_summary
                else "Nenhuma âncora fixa cadastrada neste workspace."
            )

            user_prompt = f"""DADOS DA TRANSAÇÃO A AUDITAR:
- Descrição: {description}
- Valor: R$ {abs(amount):.2f} ({'Receita' if amount > 0 else 'Despesa'})
- Data: {date}

ÂNCOLAS FIXAS CADASTRADAS NO WORKSPACE DO CLIENTE:
{anchors_text}

Analise criticamente se o gasto está conforme ou se é uma anomalia orçamentária e responda estritamente em JSON."""

            # Configure and call Gemini model
            model = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL or "gemini-1.5-flash",
                system_instruction=cls.SYSTEM_PROMPT,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.1,
                }
            )

            # Call Gemini asynchronously with timeout
            response = await asyncio.wait_for(
                model.generate_content_async(user_prompt),
                timeout=12.0
            )

            raw_text = response.text.strip() if response and response.text else ""

            # Clean markdown codeblocks if present
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

            parsed_data = json.loads(raw_text.strip())

            # Validate expected keys and types
            is_anomaly = bool(parsed_data.get("is_anomaly", False))
            confidence = float(parsed_data.get("ai_confidence_score", 0.85))
            confidence = max(0.0, min(1.0, confidence))  # Clamp between 0.0 and 1.0

            justification = str(
                parsed_data.get(
                    "ai_justification_suggestion",
                    "Transação avaliada pelo auditor financeiro Gemini."
                )
            ).strip()

            category = str(
                parsed_data.get("predicted_category", "Outros / Geral")
            ).strip()

            # Find matching anchor if mentioned or matching description
            desc_lower = description.lower()
            matched_anchor_name = None
            expected_amount = None
            for a in anchors:
                a_name = a.get("name", "")
                if a_name and (a_name.lower() in desc_lower or a_name.lower() in justification.lower()):
                    matched_anchor_name = a_name
                    expected_amount = float(a.get("expected_amount", 0.0))
                    break

            logger.info(
                f"Auditoria Gemini concluída: '{description}' -> Anomalia={is_anomaly}, "
                f"Confiança={confidence:.2f}, Categoria='{category}'"
            )

            return {
                "is_anomaly": is_anomaly,
                "ai_confidence_score": confidence,
                "ai_justification_suggestion": justification,
                "predicted_category": category,
                "matched_anchor_name": matched_anchor_name,
                "expected_amount": expected_amount,
            }

        except asyncio.TimeoutError:
            logger.warning(f"Timeout na chamada ao Google Gemini para '{description}'. Usando fallback seguro.")
            return cls._fallback_audit(description, amount, anchors)
        except Exception as e:
            logger.error(f"Erro ao processar auditoria com Google Gemini: {e}. Usando fallback seguro.")
            return cls._fallback_audit(description, amount, anchors)
