import asyncio

from fastapi import APIRouter, HTTPException, status

from app.schemas.execution_engine import ExecutionEnquiryCreate, ApprovalDecisionRequest, RecommendationUpdateRequest
from app.services.execution_engine_service import (
    ExecutionEngineError,
    create_execution_plan,
    get_execution_plan,
    list_execution_plans,
    execute_plan,
    submit_approval_decision,
    submit_recommendation_update,
)


router = APIRouter(
    prefix="/execution-engine",
    tags=["Execution Engine"],
)


@router.post("/plans", status_code=status.HTTP_201_CREATED)
async def submit_enquiry(enquiry_payload: ExecutionEnquiryCreate):
    try:
        record = create_execution_plan(enquiry_payload)
        asyncio.create_task(execute_plan(record.id))
        return {
            "message": "Execution plan created successfully",
            "data": record.model_dump(),
        }
    except ExecutionEngineError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/plans")
def get_plans():
    return list_execution_plans()


@router.get("/plans/{plan_id}")
def get_plan_details(plan_id: str):
    return get_execution_plan(plan_id).model_dump()


@router.post("/plans/{plan_id}/approval")
def approve_plan(plan_id: str, approval_payload: ApprovalDecisionRequest):
    try:
        record = submit_approval_decision(plan_id, approval_payload)
        return {
            "message": "Approval decision recorded successfully",
            "data": record.model_dump(),
        }
    except ExecutionEngineError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.patch("/plans/{plan_id}/recommendation")
def update_recommendation(plan_id: str, recommendation_payload: RecommendationUpdateRequest):
    try:
        record = submit_recommendation_update(plan_id, recommendation_payload)
        return {
            "message": "Final recommendation updated successfully",
            "data": record.model_dump(),
        }
    except ExecutionEngineError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
