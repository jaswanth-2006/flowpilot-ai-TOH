from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from postgrest.exceptions import APIError

from app.core.database import supabase
from app.schemas.execution_engine import (
    ApprovalDecisionRequest,
    BusinessMemoryItem,
    ExecutionEnquiryCreate,
    ExecutionPlanContent,
    ExecutionPlanRecord,
    ExecutionSnapshot,
    DecisionItem,
    FinalRecommendation,
    RecommendationUpdateRequest,
    ThinkingPanelStep,
    WorkflowStep,
)

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover - dependency import is validated at runtime
    genai = None


TABLE_NAME = "execution_plans"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_LOCAL_EXECUTION_PLAN_STORE: dict[str, ExecutionPlanRecord] = {}

logger = logging.getLogger(__name__)

THINKING_PANEL_TEMPLATE = [
    ("reading_enquiry", "Reading enquiry...", "Parse the customer request, urgency, and business goal."),
    ("understanding_intent", "Understanding intent...", "Extract the real outcome the customer wants."),
    ("planning_execution", "Planning execution...", "Break the request into operational stages and checkpoints."),
    ("selecting_agents", "Selecting agents...", "Choose the AI agents that should own each decision."),
    ("checking_inventory", "Checking inventory...", "Verify stock, lead times, and availability pressure."),
    ("comparing_suppliers", "Comparing suppliers...", "Evaluate supplier speed, margin, and reliability."),
    ("calculating_quotation", "Calculating quotation...", "Estimate pricing, margin, and delivery impact."),
    ("preparing_approval", "Preparing approval...", "Flag any risk, exception, or manual approval needed."),
    ("generating_pdf", "Generating PDF...", "Package the recommendation into a client-ready artifact."),
    ("sending_email", "Sending email...", "Prepare the response for human review or outbound delivery."),
]


class ExecutionEngineError(RuntimeError):
    pass


def _strip_json_code_fences(raw_text: str) -> str:
    cleaned_text = raw_text.strip()
    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?\s*", "", cleaned_text.strip(), flags=re.IGNORECASE)
        cleaned_text = re.sub(r"\s*```$", "", cleaned_text.strip())
    return cleaned_text.strip()


def _extract_gemini_response_text(response: Any) -> str:
    if response is None:
        raise ExecutionEngineError("Gemini response was empty.")

    if hasattr(response, "text") and isinstance(response.text, str) and response.text.strip():
        return response.text

    candidates: list[str] = []

    def add_text(candidate: Any) -> None:
        if isinstance(candidate, str) and candidate.strip():
            candidates.append(candidate.strip())

    if hasattr(response, "output"):
        output = response.output
    elif isinstance(response, dict):
        output = response.get("output")
    else:
        output = None

    if isinstance(output, list):
        for item in output:
            if isinstance(item, dict):
                add_text(item.get("text"))
                content = item.get("content")
                if isinstance(content, str):
                    add_text(content)
                elif isinstance(content, list):
                    for content_item in content:
                        if isinstance(content_item, dict):
                            add_text(content_item.get("text"))
                            add_text(content_item.get("content"))
                        else:
                            add_text(content_item)
            elif isinstance(item, str):
                add_text(item)
    elif isinstance(output, dict):
        add_text(output.get("text"))
        content = output.get("content")
        if isinstance(content, str):
            add_text(content)
        elif isinstance(content, list):
            for content_item in content:
                if isinstance(content_item, dict):
                    add_text(content_item.get("text"))
                    add_text(content_item.get("content"))
                else:
                    add_text(content_item)

    if hasattr(response, "message") and isinstance(response.message, str) and response.message.strip():
        add_text(response.message)

    if candidates:
        return candidates[0]

    raise ExecutionEngineError("Unable to extract text from Gemini response.")


def _extract_json_object(raw_text: str) -> str | None:
    cleaned_text = _strip_json_code_fences(raw_text)

    try:
        json.loads(cleaned_text)
        return cleaned_text
    except json.JSONDecodeError:
        pass

    brace_start = cleaned_text.find("{")
    if brace_start == -1:
        return None

    depth = 0
    for index in range(brace_start, len(cleaned_text)):
        char = cleaned_text[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                candidate_text = cleaned_text[brace_start : index + 1]
                try:
                    json.loads(candidate_text)
                    return candidate_text
                except json.JSONDecodeError:
                    return None

    return None


def _parse_gemini_payload(response_text: str) -> dict[str, Any]:
    cleaned_text = _strip_json_code_fences(response_text)
    candidate_text = _extract_json_object(cleaned_text) or cleaned_text

    try:
        parsed_payload = json.loads(candidate_text)
    except json.JSONDecodeError as exc:
        raise ExecutionEngineError("Gemini did not return valid JSON.") from exc

    if not isinstance(parsed_payload, dict):
        raise ExecutionEngineError("Gemini response must be a JSON object.")

    _validate_gemini_payload(parsed_payload)
    return parsed_payload


def _validate_gemini_payload(payload: dict[str, Any]) -> None:
    required_keys = [
        "intent",
        "required_tasks",
        "required_agents",
        "thinking_panel",
        "decision_panel",
        "workflow_steps",
        "risk_analysis",
        "approval_requirement",
        "final_recommendation",
        "business_memory",
    ]
    missing_keys = [key for key in required_keys if key not in payload]
    if missing_keys:
        raise ExecutionEngineError(f"Gemini payload missing required keys: {', '.join(missing_keys)}")

    list_keys = [
        "required_tasks",
        "required_agents",
        "thinking_panel",
        "decision_panel",
        "workflow_steps",
        "risk_analysis",
        "business_memory",
    ]
    for key in list_keys:
        if not isinstance(payload.get(key), list):
            raise ExecutionEngineError(f"Gemini payload '{key}' must be an array.")

    for key in ["required_tasks", "required_agents"]:
        values = payload.get(key, [])
        if not all(isinstance(item, str) and item.strip() for item in values):
            raise ExecutionEngineError(f"Gemini payload '{key}' must be a list of non-empty strings.")

    for key in ["thinking_panel", "decision_panel", "workflow_steps", "risk_analysis", "business_memory"]:
        values = payload.get(key, [])
        if not all(isinstance(item, dict) for item in values):
            raise ExecutionEngineError(f"Gemini payload '{key}' must be a list of objects.")

    final_payload = payload["final_recommendation"]
    if not isinstance(final_payload, dict):
        raise ExecutionEngineError("Gemini payload 'final_recommendation' must be an object.")

    final_keys = [
        "supplier",
        "products",
        "estimated_quote",
        "expected_margin",
        "delivery_timeline",
        "approval_required",
        "business_reasoning",
    ]
    missing_final = [key for key in final_keys if key not in final_payload]
    if missing_final:
        raise ExecutionEngineError(
            "Gemini payload final_recommendation missing keys: " + ", ".join(missing_final)
        )
    if not isinstance(final_payload["products"], list):
        raise ExecutionEngineError("Gemini payload 'final_recommendation.products' must be an array.")
    if not all(isinstance(item, str) for item in final_payload["products"]):
        raise ExecutionEngineError("Gemini payload 'final_recommendation.products' must be a string array.")


def _normalize_workflow_steps(raw_steps: list[dict[str, Any]]) -> list[WorkflowStep]:
    normalized_steps: list[WorkflowStep] = []

    for index, step in enumerate(raw_steps, start=1):
        if not isinstance(step, dict):
            continue

        normalized_steps.append(
            WorkflowStep(
                id=str(step.get("id") or f"step-{index}"),
                title=str(step.get("title") or f"Step {index}"),
                description=str(step.get("description") or ""),
                reasoning=str(step.get("reasoning") or ""),
                expected_output=str(step.get("expected_output") or ""),
                input_summary=str(step.get("input_summary") or ""),
                output_summary=str(step.get("output_summary") or ""),
                execution_time_seconds=float(step.get("execution_time_seconds") or 0.0),
                assigned_agent=str(step.get("assigned_agent") or "General Execution Agent"),
                order=index,
                status="pending",
            )
        )

    return normalized_steps


def _build_plan_content(raw_payload: dict[str, Any]) -> ExecutionPlanContent:
    return ExecutionPlanContent(
        intent=str(raw_payload.get("intent") or "Investigate and resolve the customer enquiry."),
        required_tasks=[str(item) for item in raw_payload.get("required_tasks", []) if str(item).strip()],
        required_agents=[str(item) for item in raw_payload.get("required_agents", []) if str(item).strip()],
        thinking_panel=_normalize_thinking_panel(raw_payload.get("thinking_panel", [])),
        decision_panel=_normalize_decision_panel(raw_payload.get("decision_panel", [])),
        workflow_steps=_normalize_workflow_steps(raw_payload.get("workflow_steps", [])),
        risk_analysis=[
            {
                "risk": str(item.get("risk") or "Unknown risk"),
                "impact": str(item.get("impact") or "Unknown impact"),
                "mitigation": str(item.get("mitigation") or "Review manually"),
            }
            for item in raw_payload.get("risk_analysis", [])
            if isinstance(item, dict)
        ],
        approval_requirement=str(raw_payload.get("approval_requirement") or "No approval requirement provided."),
        final_recommendation=_normalize_final_recommendation(raw_payload.get("final_recommendation", {})),
        business_memory=_normalize_business_memory(raw_payload.get("business_memory", [])),
        execution_history=[],
    )


def _normalize_thinking_panel(raw_steps: list[dict[str, Any]]) -> list[ThinkingPanelStep]:
    if not raw_steps:
        raw_steps = [
            {"id": step_id, "label": label, "detail": detail}
            for step_id, label, detail in THINKING_PANEL_TEMPLATE
        ]

    normalized_steps: list[ThinkingPanelStep] = []
    for index, step in enumerate(raw_steps, start=1):
        if not isinstance(step, dict):
            continue

        normalized_steps.append(
            ThinkingPanelStep(
                id=str(step.get("id") or f"thinking-{index}"),
                label=str(step.get("label") or f"Thinking step {index}"),
                detail=str(step.get("detail") or ""),
                status=str(step.get("status") or "pending"),
            )
        )

    return normalized_steps


def _normalize_decision_panel(raw_items: list[dict[str, Any]]) -> list[DecisionItem]:
    normalized_items: list[DecisionItem] = []

    for index, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            continue

        normalized_items.append(
            DecisionItem(
                title=str(item.get("title") or f"Decision {index}"),
                why=str(item.get("why") or ""),
                evidence=[str(value) for value in item.get("evidence", []) if str(value).strip()],
                selected_option=str(item.get("selected_option") or ""),
                confidence=str(item.get("confidence") or "Medium"),
            )
        )

    return normalized_items


def _normalize_business_memory(raw_items: list[dict[str, Any]]) -> list[BusinessMemoryItem]:
    normalized_items: list[BusinessMemoryItem] = []

    for index, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            continue

        execution_id = item.get("execution_id") if isinstance(item, dict) else None
        normalized_items.append(
            BusinessMemoryItem(
                execution_id=str(execution_id) if execution_id else None,
                title=str(item.get("title") or f"Memory {index}"),
                summary=str(item.get("summary") or ""),
                similarity_reason=str(item.get("similarity_reason") or ""),
                influence=str(item.get("influence") or ""),
            )
        )

    return normalized_items


def _normalize_final_recommendation(raw_payload: dict[str, Any]) -> FinalRecommendation | None:
    if not isinstance(raw_payload, dict):
        return None

    return FinalRecommendation(
        supplier=str(raw_payload.get("supplier") or "Unknown supplier"),
        products=[str(item) for item in raw_payload.get("products", []) if str(item).strip()],
        estimated_quote=str(raw_payload.get("estimated_quote") or "TBD"),
        expected_margin=str(raw_payload.get("expected_margin") or "TBD"),
        delivery_timeline=str(raw_payload.get("delivery_timeline") or "TBD"),
        approval_required=str(raw_payload.get("approval_required") or "Approval recommended."),
        business_reasoning=str(raw_payload.get("business_reasoning") or ""),
    )


def _load_supabase_rows(table_name: str, limit: int = 100) -> list[dict[str, Any]]:
    if supabase is None:
        return []

    try:
        response = supabase.table(table_name).select("*").limit(limit).execute()
        return response.data or []
    except Exception:
        return []


def _summarize_supabase_context(enquiry: str) -> tuple[str, str, str]:
    customers = _load_supabase_rows("customers", limit=10)
    suppliers = _load_supabase_rows("suppliers", limit=25)
    products = _load_supabase_rows("products", limit=50)

    customer_summary = "\n".join(
        f"- {str(customer.get('name') or 'Unknown')} | company: {str(customer.get('company_id') or 'N/A')} | segment: {str(customer.get('segment') or 'N/A')}"
        for customer in customers
    ) or "- No customer data available"

    supplier_summary = "\n".join(
        f"- {str(supplier.get('name') or 'Unknown')} | rating: {supplier.get('rating', 'N/A')} | lead_time: {supplier.get('lead_time', 'N/A')} | available_products: {len([p for p in products if p.get('supplier_id') == supplier.get('id')])} | stock: {sum(int(p.get('inventory') or 0) for p in products if p.get('supplier_id') == supplier.get('id'))} | price_range: {min((float(p.get('price') or 0) for p in products if p.get('supplier_id') == supplier.get('id')), default='N/A')} - {max((float(p.get('price') or 0) for p in products if p.get('supplier_id') == supplier.get('id')), default='N/A')}"
        for supplier in suppliers
    ) or "- No supplier data available"

    product_summary = "\n".join(
        f"- {str(product.get('name') or 'Unknown')} | sku: {str(product.get('sku') or 'N/A')} | supplier_id: {str(product.get('supplier_id') or 'N/A')} | price: {product.get('price', 'N/A')} | inventory: {product.get('inventory', 'N/A')} | category: {str(product.get('category') or 'N/A')}"
        for product in products
    ) or "- No product data available"

    return customer_summary, supplier_summary, product_summary


def _normalize_lead_time(value: Any) -> int:
    if value is None:
        return 999

    raw = str(value).lower().strip()
    if raw.isdigit():
        return int(raw)

    match = re.search(r"(\d+)", raw)
    if match:
        quantity = int(match.group(1))
        if "week" in raw:
            return quantity * 7
        if "day" in raw:
            return quantity
        if "hour" in raw:
            return max(1, quantity // 24)

    return 999


def _score_supplier_candidates(suppliers: list[dict[str, Any]], products: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    if not suppliers or not products:
        return None, []

    products_by_supplier: dict[str, list[dict[str, Any]]] = {}
    for product in products:
        supplier_id = str(product.get("supplier_id") or "")
        if supplier_id:
            products_by_supplier.setdefault(supplier_id, []).append(product)

    scores: list[tuple[float, dict[str, Any], list[dict[str, Any]]]] = []
    for supplier in suppliers:
        supplier_id = str(supplier.get("id") or "")
        supplier_products = products_by_supplier.get(supplier_id, [])
        if not supplier_products:
            continue

        total_inventory = sum(int(product.get("inventory") or 0) for product in supplier_products)
        average_price = (
            sum(float(product.get("price") or 0) for product in supplier_products) / len(supplier_products)
            if supplier_products else 0.0
        )
        rating = float(supplier.get("rating") or 0)
        lead_days = _normalize_lead_time(supplier.get("lead_time"))
        inventory_score = min(total_inventory / 10.0, 25.0)
        delivery_score = max(0.0, 20.0 - lead_days)
        price_score = max(0.0, 15.0 - (average_price / 20.0))
        rating_score = rating * 4.0

        score = inventory_score + delivery_score + price_score + rating_score
        scores.append((score, supplier, supplier_products))

    if not scores:
        return None, []

    scores.sort(key=lambda item: item[0], reverse=True)
    _, best_supplier, best_products = scores[0]
    return best_supplier, best_products


def _build_grounded_recommendation(
    enquiry: str,
    customers: list[dict[str, Any]],
    suppliers: list[dict[str, Any]],
    products: list[dict[str, Any]],
) -> FinalRecommendation:
    customer_context = ", ".join(
        str(customer.get("name") or customer.get("company_id") or "customer")
        for customer in customers[:3]
    ) or "the requesting customer"

    matched_products = [
        product
        for product in products
        if any(
            token in str(product.get("name", "")).lower() or token in str(product.get("category", "")).lower()
            for token in _tokenize_text(enquiry.lower())
        )
    ]
    if not matched_products:
        matched_products = list(products)

    chosen_supplier, supplier_products = _score_supplier_candidates(suppliers, matched_products)
    if not chosen_supplier or not supplier_products:
        return _choose_best_fallback_recommendation(enquiry)

    top_products = sorted(
        supplier_products,
        key=lambda item: (int(item.get("inventory") or 0), float(item.get("price") or 0)),
        reverse=True,
    )[:3]

    selected_product_names = [str(product.get("name") or "Unknown product") for product in top_products]
    total_price = sum(float(product.get("price") or 0) for product in top_products)
    estimated_quote = f"${total_price * 1.25:,.2f}"
    expected_margin = f"{max(12, min(28, int(total_price * 0.20)))}%"
    supplier_name = str(chosen_supplier.get("name") or "Recommended supplier not found")
    delivery_timeline = str(chosen_supplier.get("lead_time") or "Standard delivery")
    rating = float(chosen_supplier.get("rating") or 0)
    total_inventory = sum(int(product.get("inventory") or 0) for product in supplier_products)
    average_price = (
        sum(float(product.get("price") or 0) for product in supplier_products) / len(supplier_products)
        if supplier_products else 0.0
    )
    lead_days = _normalize_lead_time(chosen_supplier.get("lead_time"))

    approval_required = (
        "Approval required due to low stock, long lead time, or weaker supplier rating."
        if total_inventory < 20 or lead_days > 10 or rating < 4.0
        else "No special approval required."
    )

    business_reasoning = (
        f"Selected {supplier_name} for {customer_context} because it had the strongest real data profile among the available suppliers: "
        f"inventory of {total_inventory} units, a lead time of {delivery_timeline}, an average price of ${average_price:.2f} per item, "
        f"and a rating of {rating}/5. The chosen products were prioritized for stock availability and price competitiveness, "
        f"which makes this recommendation more reliable for fulfillment and margin than the lower-scoring alternatives."
    )

    return FinalRecommendation(
        supplier=supplier_name,
        products=selected_product_names,
        estimated_quote=estimated_quote,
        expected_margin=expected_margin,
        delivery_timeline=delivery_timeline,
        approval_required=approval_required,
        business_reasoning=business_reasoning,
    )
    rating = float(supplier.get("rating") or 0)
    return total_inventory < max(5, product_count * 2) or lead_days > 14 or rating < 3.5


def _recover_unavailable_supplier(record: ExecutionPlanRecord) -> tuple[ExecutionPlanRecord, str | None]:
    if not record.execution_plan.final_recommendation:
        return record, None

    current_recommendation = record.execution_plan.final_recommendation
    original_supplier = current_recommendation.supplier
    supplier = _load_supplier_by_name(original_supplier)
    if supplier and not _supplier_is_unavailable(supplier, len(current_recommendation.products)):
        return record, None

    alternate = _find_alternate_supplier(original_supplier, record.enquiry)
    if not alternate:
        return record, None

    plan_copy = record.execution_plan.model_copy(deep=True)
    plan_copy.final_recommendation = alternate
    plan_copy.approval_requirement = alternate.approval_required
    plan_copy.final_recommendation.business_reasoning = (
        f"Original supplier {original_supplier} became unavailable. "
        f"The AI recovered with alternate supplier {alternate.supplier}. "
        f"{alternate.business_reasoning}"
    )

    updated_record = record.model_copy(update={"execution_plan": plan_copy})
    note = (
        f"Supplier '{original_supplier}' became unavailable during execution. "
        f"The AI recovered by selecting alternate supplier '{alternate.supplier}'."
    )
    return updated_record, note


def _choose_best_recommendation(enquiry: str) -> FinalRecommendation:
    customers = _load_supabase_rows("customers", limit=25)
    suppliers = _load_supabase_rows("suppliers", limit=50)
    products = _load_supabase_rows("products", limit=100)
    return _build_grounded_recommendation(enquiry, customers, suppliers, products)


def _find_alternate_supplier(original_supplier_name: str, enquiry: str) -> FinalRecommendation | None:
    suppliers = _load_supabase_rows("suppliers", limit=50)
    products = _load_supabase_rows("products", limit=100)
    if not suppliers or not products:
        return None

    matched_products = [
        product
        for product in products
        if any(
            token in str(product.get("name", "")).lower() or token in str(product.get("category", "")).lower()
            for token in _tokenize_text(enquiry.lower())
        )
    ]
    if not matched_products:
        matched_products = products

    alternate_suppliers = [supplier for supplier in suppliers if str(supplier.get("name", "")).strip().lower() != original_supplier_name.strip().lower()]
    if not alternate_suppliers:
        return None

    chosen_supplier, supplier_products = _score_supplier_candidates(alternate_suppliers, matched_products)
    if not chosen_supplier or not supplier_products:
        return None

    top_products = sorted(
        supplier_products,
        key=lambda item: (int(item.get("inventory") or 0), float(item.get("price") or 0)),
        reverse=True,
    )[:3]
    selected_product_names = [str(product.get("name") or "Unknown product") for product in top_products]
    total_price = sum(float(product.get("price") or 0) for product in top_products)
    supplier_name = str(chosen_supplier.get("name") or "Alternative supplier not found")
    delivery_timeline = str(chosen_supplier.get("lead_time") or "Standard delivery")
    rating = float(chosen_supplier.get("rating") or 0)
    total_inventory = sum(int(product.get("inventory") or 0) for product in supplier_products)

    approval_required = (
        "Approval required because the selected supplier has constrained inventory or longer lead time."
        if total_inventory < 20 or _normalize_lead_time(chosen_supplier.get("lead_time")) > 10 or rating < 4.0
        else "No special approval required."
    )

    business_reasoning = (
        f"After the primary supplier became unavailable, the AI selected {supplier_name} as the next best supplier, "
        f"because it still has sufficient inventory and a competitive lead time ({delivery_timeline}). "
        f"The products were chosen to preserve fulfillment probability while keeping the quote viable."
    )

    return FinalRecommendation(
        supplier=supplier_name,
        products=selected_product_names,
        estimated_quote=f"${total_price * 1.25:,.2f}",
        expected_margin=f"{max(12, min(28, int(total_price * 0.20)))}%",
        delivery_timeline=delivery_timeline,
        approval_required=approval_required,
        business_reasoning=business_reasoning,
    )


def _choose_best_fallback_recommendation(enquiry: str) -> FinalRecommendation:
    products = _load_supabase_rows("products", limit=100)
    suppliers = _load_supabase_rows("suppliers", limit=50)
    if not suppliers or not products:
        return FinalRecommendation(
            supplier="Recommended supplier not found",
            products=["Product recommendations unavailable"],
            estimated_quote="TBD",
            expected_margin="TBD",
            delivery_timeline="TBD",
            approval_required="Approval recommended when data is unavailable.",
            business_reasoning="No inventory or supplier data could be loaded from Supabase, so the recommendation uses a default fallback path.",
        )

    chosen_supplier, supplier_products = _score_supplier_candidates(suppliers, products)
    if not chosen_supplier or not supplier_products:
        return FinalRecommendation(
            supplier="Recommended supplier not found",
            products=["No suitable product matches found"],
            estimated_quote="TBD",
            expected_margin="TBD",
            delivery_timeline="TBD",
            approval_required="Approval recommended when exact matching data is unavailable.",
            business_reasoning="Unable to identify a strong supplier-product match from the available data.",
        )

    top_products = sorted(
        supplier_products,
        key=lambda item: (int(item.get("inventory") or 0), float(item.get("price") or 0)),
        reverse=True,
    )[:3]
    selected_product_names = [str(product.get("name") or "Unknown product") for product in top_products]
    total_price = sum(float(product.get("price") or 0) for product in top_products)
    supplier_name = str(chosen_supplier.get("name") or "Recommended supplier not found")
    delivery_timeline = str(chosen_supplier.get("lead_time") or "Standard delivery")
    rating = float(chosen_supplier.get("rating") or 0)
    total_inventory = sum(int(product.get("inventory") or 0) for product in supplier_products)

    approval_required = (
        "Approval required because the selected supplier has constrained inventory or longer lead time."
        if total_inventory < 20 or _normalize_lead_time(chosen_supplier.get("lead_time")) > 10 or rating < 4.0
        else "No special approval required."
    )

    return FinalRecommendation(
        supplier=supplier_name,
        products=selected_product_names,
        estimated_quote=f"${total_price * 1.25:,.2f}",
        expected_margin=f"{max(12, min(28, int(total_price * 0.20)))}%",
        delivery_timeline=delivery_timeline,
        approval_required=approval_required,
        business_reasoning=(
            f"Chosen supplier {supplier_name} because it shows the best real-time fulfillment profile in the current dataset: "
            f"strong stock availability, manageable lead time, and a solid quality rating. "
            f"This fallback recommendation leans on actual Supabase inventory and supplier metrics rather than a generic default."
        ),
    )


def _tokenize_text(value: str) -> set[str]:
    return {token for token in re.split(r"[^a-z0-9]+", value.lower()) if len(token) > 2}


def _text_similarity(left: str, right: str) -> float:
    left_tokens = _tokenize_text(left)
    right_tokens = _tokenize_text(right)
    if not left_tokens or not right_tokens:
        return 0.0

    overlap = len(left_tokens & right_tokens)
    return overlap / max(len(left_tokens | right_tokens), 1)


def _build_business_memory(enquiry: str) -> list[BusinessMemoryItem]:
    recent_rows = list_execution_plans(limit=12)
    scored_rows: list[tuple[float, dict[str, Any]]] = []

    for row in recent_rows:
        if not isinstance(row, dict):
            continue

        row_enquiry = str(row.get("enquiry") or "")
        execution_plan = row.get("execution_plan") or {}
        if not isinstance(execution_plan, dict):
            execution_plan = {}

        candidate_text = " ".join(
            [
                row_enquiry,
                str(execution_plan.get("intent") or ""),
                " ".join(str(task) for task in execution_plan.get("required_tasks", []) if str(task).strip()),
            ]
        )
        similarity = _text_similarity(enquiry, candidate_text)
        if similarity > 0:
            scored_rows.append((similarity, row))

    scored_rows.sort(key=lambda item: item[0], reverse=True)
    selected_rows = scored_rows[:3]

    if not selected_rows:
        return [
            BusinessMemoryItem(
                execution_id=None,
                title="No prior comparable execution",
                summary="This is the first request in this category, so the engine is using a conservative default memory pattern.",
                similarity_reason="No earlier execution had enough keyword overlap to qualify as a meaningful match.",
                influence="The recommendation starts with broad supplier and inventory validation before narrowing to a quote.",
            )
        ]

    memory_items: list[BusinessMemoryItem] = []
    for similarity, row in selected_rows:
        execution_plan = row.get("execution_plan") or {}
        if not isinstance(execution_plan, dict):
            execution_plan = {}

        intent = str(execution_plan.get("intent") or row.get("enquiry") or "Similar execution")
        status = str(row.get("status") or "completed")
        execution_id = str(row.get("id") or "")
        required_tasks = [str(task) for task in execution_plan.get("required_tasks", []) if str(task).strip()]
        summary = (
            f"Previous execution '{intent}' finished with {status}. "
            f"It covered {len(required_tasks)} task(s) and is a {int(similarity * 100)}% lexical match."
        )
        memory_items.append(
            BusinessMemoryItem(
                execution_id=execution_id or None,
                title=intent,
                summary=summary,
                similarity_reason="Shared business vocabulary across enquiry, intent, and task descriptions.",
                influence="This pattern biases the recommendation toward the same operational path and agent mix.",
            )
        )

    return memory_items


def _get_gemini_model():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.info("GEMINI_API_KEY not configured; using deterministic fallback.")
        return None

    if genai is None:
        logger.warning("google.generativeai package is unavailable; using deterministic fallback.")
        return None

    try:
        genai.configure(api_key=api_key)
        return genai.GenerativeModel(GEMINI_MODEL)
    except Exception:
        logger.warning("Gemini client initialization failed; using deterministic fallback.", exc_info=True)
        return None


def _build_fallback_plan_content(enquiry: str, business_memory: list[BusinessMemoryItem]) -> ExecutionPlanContent:
    normalized_enquiry = enquiry.lower()
    is_quote_request = any(keyword in normalized_enquiry for keyword in ["quote", "pricing", "price", "margin"])
    is_inventory_request = any(keyword in normalized_enquiry for keyword in ["inventory", "stock", "availability"])
    is_supplier_request = any(keyword in normalized_enquiry for keyword in ["supplier", "vendor", "delivery", "lead time"])

    thinking_panel = [
        ThinkingPanelStep(id=step_id, label=label, detail=detail, status="completed" if index < 2 else "running" if index == 2 else "pending")
        for index, (step_id, label, detail) in enumerate(THINKING_PANEL_TEMPLATE)
    ]

    workflow_steps: list[WorkflowStep] = [
        WorkflowStep(
            id="step-1",
            title="Read and classify enquiry",
            description="Parse the customer request and identify the commercial objective.",
            reasoning="The workflow starts by converting the raw enquiry into an operational brief.",
            expected_output="A clear execution brief with the key business goal.",
            input_summary="Customer enquiry text",
            output_summary="Structured objective and operating constraints",
            execution_time_seconds=1.2,
            assigned_agent="Intake Agent",
            order=1,
            status="pending",
        ),
        WorkflowStep(
            id="step-2",
            title="Check inventory and feasibility",
            description="Validate whether the request can be fulfilled with current stock or service capacity.",
            reasoning="Inventory and feasibility must be proven before any recommendation can be trusted.",
            expected_output="Availability summary and feasibility verdict.",
            input_summary="Inventory records and product demand",
            output_summary="Stock status and constraints",
            execution_time_seconds=1.5,
            assigned_agent="Inventory Agent",
            order=2,
            status="pending",
        ),
        WorkflowStep(
            id="step-3",
            title="Compare suppliers",
            description="Rank suppliers by delivery speed, margin, and reliability.",
            reasoning="Supplier comparison explains why the engine recommends a specific vendor.",
            expected_output="Supplier shortlist with a recommended winner.",
            input_summary="Supplier ratings, lead times, and product mapping",
            output_summary="Chosen supplier with rationale",
            execution_time_seconds=1.7,
            assigned_agent="Supplier Analyst",
            order=3,
            status="pending",
        ),
        WorkflowStep(
            id="step-4",
            title="Calculate quote and margin",
            description="Estimate pricing, margin, and delivery impact for the recommended option.",
            reasoning="A demo-worthy answer needs a commercial outcome, not only an operational one.",
            expected_output="Quote recommendation with margin signal.",
            input_summary="Supplier result and unit economics",
            output_summary="Recommended quote and profitability view",
            execution_time_seconds=1.4,
            assigned_agent="Pricing Agent",
            order=4,
            status="pending",
        ),
        WorkflowStep(
            id="step-5",
            title="Prepare approval and response",
            description="Flag approval requirements and prepare the final customer-ready recommendation.",
            reasoning="Approval and response packaging are the final demo steps that complete the storyline.",
            expected_output="Approval note and customer response package.",
            input_summary="Quote, margin, and exception rules",
            output_summary="Approval recommendation and response draft",
            execution_time_seconds=1.3,
            assigned_agent="Operations Agent",
            order=5,
            status="pending",
        ),
    ]

    if not is_inventory_request:
        workflow_steps = [step for step in workflow_steps if step.order != 2]
    if not is_supplier_request:
        workflow_steps = [step for step in workflow_steps if step.order != 3]
    if not is_quote_request:
        workflow_steps = [step for step in workflow_steps if step.order != 4]

    for index, step in enumerate(workflow_steps, start=1):
        step.order = index

    return ExecutionPlanContent(
        intent="Resolve the customer enquiry with an explainable AI operations plan.",
        required_tasks=[
            "Classify the enquiry",
            "Check feasibility",
            "Compare suppliers",
            "Prepare quote",
            "Prepare approval",
        ],
        required_agents=[
            "Intake Agent",
            "Inventory Agent",
            "Supplier Analyst",
            "Pricing Agent",
            "Operations Agent",
        ],
        thinking_panel=thinking_panel,
        decision_panel=[
            DecisionItem(
                title="Primary recommendation",
                why="The system should choose the fastest explainable route to a demo-ready answer.",
                evidence=["No Gemini API key available in this workspace", "Use deterministic fallback for reliability"],
                selected_option="Run the local fallback planning path",
                confidence="High",
            ),
            DecisionItem(
                title="Business memory influence",
                why="Past executions still provide useful framing even when the model is offline.",
                evidence=[memory_item.title for memory_item in business_memory[:2]] or ["No prior execution available"],
                selected_option="Bias the plan toward the most similar prior operations pattern",
                confidence="Medium",
            ),
        ],
        workflow_steps=workflow_steps,
        risk_analysis=[
            {
                "risk": "Margin pressure",
                "impact": "The recommendation could become unprofitable.",
                "mitigation": "Escalate to approval if margin falls below threshold.",
            },
            {
                "risk": "Supplier availability mismatch",
                "impact": "A quoted order may not be fulfillable on time.",
                "mitigation": "Check inventory and lead times before finalizing the quote.",
            },
        ],
        approval_requirement="Require approval if the recommended margin is below threshold or inventory is constrained.",
        business_memory=business_memory,
        final_recommendation=_choose_best_recommendation(enquiry),
        execution_history=[],
    )


def _build_gemini_prompt(enquiry: str, customer_context: str, supplier_context: str, product_context: str) -> str:
    return f"""
You are the FlowPilot AI Operations Center. Your job is to generate a single explainable execution plan for the customer's enquiry.
Use the actual business data below to ground every recommendation in real Supabase context.
Only output valid JSON with no markdown fences or extra commentary.

Customer context:
{customer_context}

Supplier context:
{supplier_context}

Product context:
{product_context}

Customer enquiry:
{enquiry}

Guidelines:
- Use actual inventory, supplier rating, delivery time, and pricing from the provided dataset.
- Choose products and a supplier that are realistically available based on stock and supplier metrics.
- If the chosen supplier is not a good fit, explain why and provide a stronger alternative.
- Every recommendation must include clear business reasoning grounded in the data.
- Keep the plan actionable and operationally specific.
- Keep the response structure strict and valid JSON.

Required JSON structure:
{{
  "intent": string,
  "required_tasks": [string],
  "required_agents": [string],
  "thinking_panel": [{{"id": string, "label": string, "detail": string, "status": string}}],
  "decision_panel": [{{"title": string, "why": string, "evidence": [string], "selected_option": string, "confidence": string}}],
  "workflow_steps": [{{"id": string, "title": string, "description": string, "reasoning": string, "input_summary": string, "output_summary": string, "execution_time_seconds": number, "assigned_agent": string}}],
  "risk_analysis": [{{"risk": string, "impact": string, "mitigation": string}}],
  "approval_requirement": string,
  "final_recommendation": {{
    "supplier": string,
    "products": [string],
    "estimated_quote": string,
    "expected_margin": string,
    "delivery_timeline": string,
    "approval_required": string,
    "business_reasoning": string
  }},
  "business_memory": [{{"execution_id": string | null, "title": string, "summary": string, "similarity_reason": string, "influence": string}}]
}}
""".strip()


def _generate_plan_from_gemini(enquiry: str) -> tuple[ExecutionPlanContent, str]:
    business_memory = _build_business_memory(enquiry)
    customer_context, supplier_context, product_context = _summarize_supabase_context(enquiry)
    model = _get_gemini_model()
    if model is None:
        logger.info("Gemini unavailable; using deterministic planner.")
        return _build_fallback_plan_content(enquiry, business_memory), "fallback"

    prompt = _build_gemini_prompt(enquiry, customer_context, supplier_context, product_context)

    try:
        response = model.generate_content(prompt)
        response_text = _extract_gemini_response_text(response)
        raw_payload = _parse_gemini_payload(response_text)
        plan_content = _build_plan_content(raw_payload)

        if not plan_content.decision_panel:
            plan_content.decision_panel = _build_default_decisions(plan_content, business_memory)
        if not plan_content.business_memory:
            plan_content.business_memory = business_memory
        if not plan_content.final_recommendation:
            plan_content.final_recommendation = _choose_best_recommendation(enquiry)

        logger.info("Execution plan generated by Gemini planner.")
        return plan_content, "gemini"
    except Exception as exc:
        logger.warning("Gemini generation failed; falling back to deterministic planner: %s", exc)
        return _build_fallback_plan_content(enquiry, business_memory), "fallback"


def _build_default_decisions(
    plan_content: ExecutionPlanContent,
    business_memory: list[BusinessMemoryItem],
) -> list[DecisionItem]:
    primary_agent = plan_content.required_agents[0] if plan_content.required_agents else "AI Operations Agent"
    task_count = len(plan_content.required_tasks)
    memory_reason = business_memory[0].similarity_reason if business_memory else "No prior similar execution"
    return [
        DecisionItem(
            title="Recommended workflow shape",
            why="The request needs a compact operational flow that can be narrated live in the demo.",
            evidence=[f"{task_count} task(s) identified", memory_reason],
            selected_option=f"Use {primary_agent} as the coordination owner",
            confidence="High",
        ),
        DecisionItem(
            title="Recommendation path",
            why="The workflow should prove value before generating the final output.",
            evidence=["Inventory or service feasibility first", "Quote or approval second"],
            selected_option="Check feasibility, compare suppliers, then finalize approval",
            confidence="High",
        ),
    ]


def _execution_plan_table():
    if supabase is None:
        raise ExecutionEngineError("Supabase is not configured; using local execution plan memory.")

    return supabase.table(TABLE_NAME)


def _is_missing_execution_plan_table_error(exc: Exception) -> bool:
    if isinstance(exc, ExecutionEngineError) and "local execution plan memory" in str(exc):
        return True

    if isinstance(exc, APIError):
        error_code = getattr(exc, "code", None)
        error_message = str(getattr(exc, "message", exc))
        return error_code == "PGRST205" or "Could not find the table 'public.execution_plans'" in error_message

    error_text = str(exc)
    return "Could not find the table 'public.execution_plans'" in error_text or "PGRST205" in error_text


def _record_from_row(row: dict[str, Any]) -> ExecutionPlanRecord:
    return ExecutionPlanRecord.model_validate(row)


def _serialize_record(record: ExecutionPlanRecord) -> dict[str, Any]:
    return record.model_dump(exclude_none=True)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clone_steps(steps: list[WorkflowStep]) -> list[WorkflowStep]:
    return [step.model_copy(deep=True) for step in steps]


def _build_snapshot(
    frame_type: str,
    note: str,
    workflow_steps: list[WorkflowStep],
    active_step: WorkflowStep | None = None,
) -> ExecutionSnapshot:
    return ExecutionSnapshot(
        id=str(uuid4()),
        type=frame_type,
        timestamp=_utc_now_iso(),
        note=note,
        active_step_id=active_step.id if active_step else None,
        active_step_title=active_step.title if active_step else None,
        workflow_state=_clone_steps(workflow_steps),
    )


def _persist_state(
    record: ExecutionPlanRecord,
    workflow_steps: list[WorkflowStep],
    *,
    status: str,
    frame_type: str,
    note: str,
    active_step: WorkflowStep | None = None,
) -> ExecutionPlanRecord:
    plan_copy = record.execution_plan.model_copy(deep=True)
    history = list(plan_copy.execution_history)
    history.append(_build_snapshot(frame_type, note, workflow_steps, active_step))
    plan_copy.execution_history = history
    updated_record = record.model_copy(update={"status": status, "execution_plan": plan_copy})
    return _persist_record(updated_record)


def _persist_record(record: ExecutionPlanRecord) -> ExecutionPlanRecord:
    payload = _serialize_record(record)
    try:
        response = _execution_plan_table().upsert(payload).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to persist execution plan.",
            )

        return _record_from_row(response.data[0])
    except Exception as exc:
        if _is_missing_execution_plan_table_error(exc):
            _LOCAL_EXECUTION_PLAN_STORE[record.id] = record.model_copy(deep=True)
            return record
        raise


def _update_record(plan_id: str, updates: dict[str, Any]) -> ExecutionPlanRecord:
    if supabase is None:
        if plan_id not in _LOCAL_EXECUTION_PLAN_STORE:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution plan not found.",
            )
        current = _LOCAL_EXECUTION_PLAN_STORE[plan_id]
        updated = current.model_copy(update=updates)
        _LOCAL_EXECUTION_PLAN_STORE[plan_id] = updated
        return updated.model_copy(deep=True)

    response = _execution_plan_table().update(updates).eq("id", plan_id).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution plan not found.",
        )

    return _record_from_row(response.data[0])


def list_execution_plans(limit: int = 20):
    try:
        response = _execution_plan_table().select("*").order("created_at", desc=True).limit(limit).execute()
        return response.data or []
    except Exception as exc:
        if _is_missing_execution_plan_table_error(exc):
            records = sorted(
                (_serialize_record(record) for record in _LOCAL_EXECUTION_PLAN_STORE.values()),
                key=lambda item: item.get("created_at") or "",
                reverse=True,
            )
            return records[:limit]
        raise


def get_execution_plan(plan_id: str) -> ExecutionPlanRecord:
    try:
        response = _execution_plan_table().select("*").eq("id", plan_id).limit(1).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution plan not found.",
            )

        return _record_from_row(response.data[0])
    except Exception as exc:
        if _is_missing_execution_plan_table_error(exc):
            if plan_id not in _LOCAL_EXECUTION_PLAN_STORE:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Execution plan not found.",
                ) from exc

            return _LOCAL_EXECUTION_PLAN_STORE[plan_id].model_copy(deep=True)
        raise


def submit_approval_decision(plan_id: str, approval_payload: ApprovalDecisionRequest) -> ExecutionPlanRecord:
    current_record = get_execution_plan(plan_id)
    plan_copy = current_record.execution_plan.model_copy(deep=True)
    plan_copy.approval_status = approval_payload.decision

    note_map = {
        "approved": "Plan approved by human reviewer.",
        "rejected": "Plan rejected by human reviewer.",
        "changes_requested": "Human reviewer requested changes to the plan.",
    }
    note = note_map.get(approval_payload.decision, "Approval decision recorded.")
    if approval_payload.note:
        note = f"{note} Note: {approval_payload.note}"

    updated_record = current_record.model_copy(update={"execution_plan": plan_copy})
    updated_record = _persist_state(
        updated_record,
        current_record.execution_plan.workflow_steps,
        status=current_record.status,
        frame_type="plan_running" if current_record.status == "running" else current_record.status,
        note=note,
    )
    return updated_record


def submit_recommendation_update(plan_id: str, recommendation_payload: RecommendationUpdateRequest) -> ExecutionPlanRecord:
    current_record = get_execution_plan(plan_id)
    plan_copy = current_record.execution_plan.model_copy(deep=True)
    final_recommendation = plan_copy.final_recommendation

    if final_recommendation is None:
        raise ExecutionEngineError("No final recommendation exists for this plan.")

    if recommendation_payload.supplier is not None:
        final_recommendation.supplier = recommendation_payload.supplier
    if recommendation_payload.products is not None:
        final_recommendation.products = [product for product in recommendation_payload.products if product.strip()]
    if recommendation_payload.estimated_quote is not None:
        final_recommendation.estimated_quote = recommendation_payload.estimated_quote
    if recommendation_payload.expected_margin is not None:
        final_recommendation.expected_margin = recommendation_payload.expected_margin
    if recommendation_payload.delivery_timeline is not None:
        final_recommendation.delivery_timeline = recommendation_payload.delivery_timeline

    plan_copy.final_recommendation = final_recommendation
    plan_copy.approval_status = "changes_requested"

    note_parts = ["Human reviewer modified the final recommendation."]
    if recommendation_payload.supplier is not None:
        note_parts.append("Supplier updated.")
    if recommendation_payload.products is not None:
        note_parts.append("Products updated.")
    if recommendation_payload.estimated_quote is not None:
        note_parts.append("Quote updated.")
    if recommendation_payload.expected_margin is not None:
        note_parts.append("Margin updated.")
    if recommendation_payload.delivery_timeline is not None:
        note_parts.append("Delivery timeline updated.")

    note = " ".join(note_parts)
    updated_record = current_record.model_copy(update={"execution_plan": plan_copy})
    updated_record = _persist_state(
        updated_record,
        current_record.execution_plan.workflow_steps,
        status=current_record.status,
        frame_type="plan_running" if current_record.status == "running" else current_record.status,
        note=note,
    )
    return updated_record


def create_execution_plan(enquiry_payload: ExecutionEnquiryCreate) -> ExecutionPlanRecord:
    generated_plan, planner_source = _generate_plan_from_gemini(enquiry_payload.enquiry)
    if planner_source == "gemini":
        logger.info("Execution plan created from Gemini planner.")
    else:
        logger.warning("Execution plan created from fallback planner.")

    record = ExecutionPlanRecord(
        id=str(uuid4()),
        enquiry=enquiry_payload.enquiry,
        status="pending",
        execution_plan=generated_plan,
    )
    return _persist_state(
        record,
        generated_plan.workflow_steps,
        status="pending",
        frame_type="plan_created",
        note="Execution plan generated from customer enquiry.",
    )


async def execute_plan(plan_id: str) -> None:
    try:
        current_record = get_execution_plan(plan_id)
        working_steps = _clone_steps(current_record.execution_plan.workflow_steps)
        current_record = _persist_state(
            current_record,
            working_steps,
            status="running",
            frame_type="plan_running",
            note="Execution engine started processing the plan.",
        )

        for step in working_steps:
            for current_step in working_steps:
                if current_step.id == step.id:
                    current_step.status = "running"
                    current_step.input_summary = current_step.input_summary or f"Inputs required to run {step.title}."
                    break

            current_record = _persist_state(
                current_record,
                working_steps,
                status="running",
                frame_type="step_running",
                note=f"Starting {step.title}.",
                active_step=step,
            )
            await asyncio.sleep(max(0.8, min(step.execution_time_seconds or 1.5, 2.4)))

            for current_step in working_steps:
                if current_step.id == step.id:
                    current_step.status = "completed"
                    current_step.output_summary = current_step.output_summary or f"Completed result for {step.title}."
                    break

            current_record = _persist_state(
                current_record,
                working_steps,
                status="running",
                frame_type="step_completed",
                note=f"Completed {step.title}.",
                active_step=step,
            )

            if "supplier" in step.title.lower():
                recovered_record, recovery_note = _recover_unavailable_supplier(current_record)
                if recovery_note:
                    current_record = _persist_state(
                        recovered_record,
                        working_steps,
                        status="running",
                        frame_type="step_running",
                        note=recovery_note,
                        active_step=step,
                    )

        _persist_state(
            current_record,
            working_steps,
            status="completed",
            frame_type="plan_completed",
            note="Execution plan completed successfully.",
        )
    except Exception as exc:
        try:
            failed_record = get_execution_plan(plan_id)
            failed_plan = failed_record.execution_plan.model_copy(deep=True)
            for current_step in failed_plan.workflow_steps:
                if current_step.status == "running":
                    current_step.status = "failed"
                    break
            failed_snapshot_plan = failed_record.model_copy(
                update={"status": "failed", "execution_plan": failed_plan}
            )
            _persist_state(
                failed_snapshot_plan,
                failed_plan.workflow_steps,
                status="failed",
                frame_type="plan_failed",
                note="Execution engine aborted after an error.",
            )
        except Exception:
            pass
        raise ExecutionEngineError(str(exc)) from exc
