from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from uuid import UUID

from app.core.database import supabase
from app.schemas.customer import CustomerCreate, CustomerUpdate


TABLE_NAME = "customers"
_LOCAL_CUSTOMERS: dict[str, dict] = {}


def _use_local_store() -> bool:
    return supabase is None


def _normalize_customer_payload(payload: dict) -> dict:
    normalized = dict(payload)
    company_id = str(normalized.get("company_id") or "").strip()
    try:
        normalized["company_id"] = str(UUID(company_id))
    except (TypeError, ValueError):
        normalized.pop("company_id", None)
    return normalized


def _raise_supabase_error(exc: APIError, action: str) -> None:
    message = getattr(exc, "message", None) or str(exc)
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Supabase failed to {action} customer records: {message}",
    ) from exc


def list_customers():
    if _use_local_store():
        return list(_LOCAL_CUSTOMERS.values())

    try:
        response = supabase.table(TABLE_NAME).select("*").execute()
        return response.data or []
    except APIError as exc:
        _raise_supabase_error(exc, "list")


def create_customer(customer: CustomerCreate):
    payload = _normalize_customer_payload(customer.model_dump())
    if _use_local_store():
        customer_id = str(uuid4())
        row = {"id": customer_id, **payload}
        _LOCAL_CUSTOMERS[customer_id] = row
        return {
            "message": "Customer Created Successfully",
            "data": [row],
        }

    try:
        response = supabase.table(TABLE_NAME).insert(payload).select("*").execute()
    except APIError as exc:
        _raise_supabase_error(exc, "create")
    return {
        "message": "Customer Created Successfully",
        "data": response.data or [],
    }


def update_customer(customer_id: str, customer: CustomerUpdate):
    updates = customer.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No customer fields provided for update",
        )

    if _use_local_store():
        if customer_id not in _LOCAL_CUSTOMERS:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        _LOCAL_CUSTOMERS[customer_id] = {**_LOCAL_CUSTOMERS[customer_id], **updates}
        return {
            "message": "Customer Updated Successfully",
            "data": [_LOCAL_CUSTOMERS[customer_id]],
        }

    updates = _normalize_customer_payload(updates) if "company_id" in updates else updates

    try:
        response = (
            supabase
            .table(TABLE_NAME)
            .update(updates)
            .eq("id", customer_id)
            .select("*")
            .execute()
        )
    except APIError as exc:
        _raise_supabase_error(exc, "update")

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    return {
        "message": "Customer Updated Successfully",
        "data": response.data,
    }


def delete_customer(customer_id: str):
    if _use_local_store():
        row = _LOCAL_CUSTOMERS.pop(customer_id, None)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return {
            "message": "Customer Deleted Successfully",
            "data": [row],
        }

    try:
        response = (
            supabase
            .table(TABLE_NAME)
            .delete()
            .eq("id", customer_id)
            .select("*")
            .execute()
        )
    except APIError as exc:
        _raise_supabase_error(exc, "delete")

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    return {
        "message": "Customer Deleted Successfully",
        "data": response.data,
    }
