import asyncio

from fastapi import APIRouter, HTTPException, status

from app.schemas.execution_engine import ExecutionEnquiryCreate
from app.services.execution_engine_service import (
    ExecutionEngineError,
    create_execution_plan,
    get_execution_plan,
    list_execution_plans,
    execute_plan,
)


router = APIRouter(
    prefix="/execution-engine",
    tags=["Execution Engine"],
)


@router.post("/plans")
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
