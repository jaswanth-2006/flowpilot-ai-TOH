from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from postgrest.exceptions import APIError

from app.core.database import supabase
from app.schemas.execution_engine import (
    BusinessMemoryItem,
    ExecutionEnquiryCreate,
    ExecutionPlanContent,
    ExecutionPlanRecord,
    ExecutionSnapshot,
    DecisionItem,
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


def _parse_gemini_payload(response_text: str) -> dict[str, Any]:
    cleaned_text = _strip_json_code_fences(response_text)

    try:
        parsed_payload = json.loads(cleaned_text)
    except json.JSONDecodeError as exc:
        raise ExecutionEngineError("Gemini did not return valid JSON.") from exc

    if not isinstance(parsed_payload, dict):
        raise ExecutionEngineError("Gemini response must be a JSON object.")

    return parsed_payload


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
    if not GEMINI_API_KEY:
        return None

    if genai is None:
        return None

    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(GEMINI_MODEL)


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
        execution_history=[],
    )


def _generate_plan_from_gemini(enquiry: str) -> ExecutionPlanContent:
    business_memory = _build_business_memory(enquiry)
    model = _get_gemini_model()
    if model is None:
        return _build_fallback_plan_content(enquiry, business_memory)

    prompt = f"""
You are the FlowPilot AI Operations Center.
Analyze the customer's enquiry and produce a polished, explainable, demo-ready execution plan.

Return only valid JSON with these keys:
- intent: concise summary of what the enquiry is trying to achieve
- required_tasks: array of strings
- required_agents: array of strings
- thinking_panel: array of objects with keys id, label, detail, status
- decision_panel: array of objects with keys title, why, evidence, selected_option, confidence
- workflow_steps: array of objects with keys id, title, description, reasoning, input_summary, output_summary, execution_time_seconds, assigned_agent
- risk_analysis: array of objects with keys risk, impact, mitigation
- approval_requirement: string describing whether approval is needed and from whom
- business_memory: array of objects with keys execution_id, title, summary, similarity_reason, influence

Rules:
- Do not wrap the response in markdown or code fences.
- Never output commentary outside the JSON object.
- Keep workflow steps dynamic based on the enquiry.
- Use a realistic number of steps for the request complexity.
- Make the plan actionable, specific, and operationally grounded.
- Make the decision panel explain why each recommendation was chosen.
- Use the provided business memory to explain how earlier executions influenced the plan.

Business memory context:
{json.dumps([memory_item.model_dump() for memory_item in business_memory], ensure_ascii=False)}

Customer enquiry:
{enquiry}
""".strip()

    try:
        response = model.generate_content(prompt)
        response_text = getattr(response, "text", "") or ""
        raw_payload = _parse_gemini_payload(response_text)
        plan_content = _build_plan_content(raw_payload)
        if not plan_content.decision_panel:
            plan_content.decision_panel = _build_default_decisions(plan_content, business_memory)
        if not plan_content.business_memory:
            plan_content.business_memory = business_memory
        return plan_content
    except Exception:
        return _build_fallback_plan_content(enquiry, business_memory)


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
    return supabase.table(TABLE_NAME)


def _is_missing_execution_plan_table_error(exc: Exception) -> bool:
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


def create_execution_plan(enquiry_payload: ExecutionEnquiryCreate) -> ExecutionPlanRecord:
    generated_plan = _generate_plan_from_gemini(enquiry_payload.enquiry)
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
