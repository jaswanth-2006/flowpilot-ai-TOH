from __future__ import annotations

from app.schemas.execution_engine import ExecutionPlanContent
from app.services import execution_engine_service as service


class _StubGeminiModel:
    def __init__(self, response_text: str):
        self._response_text = response_text

    def generate_content(self, prompt: str):
        return type("Response", (), {"text": self._response_text})()


def test_parse_gemini_payload_extracts_json_from_surrounding_text():
    response_text = (
        'Here is the structured plan:\n'
        '{"intent":"Test intent","required_tasks":[],"required_agents":[],"thinking_panel":[],"decision_panel":[],"workflow_steps":[],"risk_analysis":[],"approval_requirement":"No approval required.","final_recommendation":{"supplier":"Acme","products":[],"estimated_quote":"$0.00","expected_margin":"0%","delivery_timeline":"1 day","approval_required":"No","business_reasoning":"Reason"},"business_memory":[]}'
    )

    payload = service._parse_gemini_payload(response_text)

    assert payload["intent"] == "Test intent"
    assert payload["approval_requirement"] == "No approval required."


def test_generate_plan_falls_back_when_gemini_payload_is_invalid(monkeypatch):
    fallback_plan = ExecutionPlanContent(
        intent="Fallback plan",
        required_tasks=["Use fallback"],
        required_agents=["Fallback Agent"],
        thinking_panel=[],
        decision_panel=[],
        workflow_steps=[],
        risk_analysis=[],
        approval_requirement="Fallback required.",
        business_memory=[],
    )

    monkeypatch.setattr(service, "_get_gemini_model", lambda: _StubGeminiModel("not valid json"))
    monkeypatch.setattr(service, "_build_fallback_plan_content", lambda enquiry, business_memory: fallback_plan)

    plan, source = service._generate_plan_from_gemini("Please quote this request")

    assert source == "fallback"
    assert plan.intent == "Fallback plan"


def test_build_grounded_recommendation_uses_real_supplier_metrics():
    customers = [{"name": "Contoso", "company_id": "c1"}]
    suppliers = [
        {"id": "s1", "name": "Northwind", "rating": 4.8, "lead_time": "3 days", "address": "Seattle"},
        {"id": "s2", "name": "Southwind", "rating": 3.2, "lead_time": "10 days", "address": "Austin"},
    ]
    products = [
        {"name": "Widget", "sku": "W1", "supplier_id": "s1", "price": 90, "inventory": 20, "category": "Hardware"},
        {"name": "Widget", "sku": "W2", "supplier_id": "s2", "price": 110, "inventory": 4, "category": "Hardware"},
    ]

    recommendation = service._build_grounded_recommendation("I need a quote for hardware", customers, suppliers, products)

    assert recommendation.supplier == "Northwind"
    assert "inventory" in recommendation.business_reasoning.lower()
    assert "lead time" in recommendation.business_reasoning.lower()
    assert "rating" in recommendation.business_reasoning.lower()
    assert "price" in recommendation.business_reasoning.lower()
