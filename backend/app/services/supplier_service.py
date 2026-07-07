from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from uuid import uuid4

from app.core.database import supabase
from app.schemas.supplier import SupplierCreate, SupplierUpdate


TABLE_NAME = "suppliers"
_LOCAL_SUPPLIERS: dict[str, dict] = {}


def _use_local_store() -> bool:
    return supabase is None


def list_suppliers():
    if _use_local_store():
        return list(_LOCAL_SUPPLIERS.values())

    try:
        response = supabase.table(TABLE_NAME).select("*").order("created_at", desc=True).execute()
        return (response.data or []) + list(_LOCAL_SUPPLIERS.values())
    except APIError:
        return list(_LOCAL_SUPPLIERS.values())


def create_supplier(supplier: SupplierCreate):
    payload = supplier.model_dump()
    if _use_local_store():
        supplier_id = str(uuid4())
        row = {"id": supplier_id, **payload}
        _LOCAL_SUPPLIERS[supplier_id] = row
        return {
            "message": "Supplier Created Successfully",
            "data": [row],
        }

    try:
        response = supabase.table(TABLE_NAME).insert(payload).select("*").execute()
    except APIError:
        supplier_id = str(uuid4())
        row = {"id": supplier_id, **payload}
        _LOCAL_SUPPLIERS[supplier_id] = row
        return {
            "message": "Supplier Created Successfully in local fallback storage because Supabase supplier columns do not match the app contract",
            "data": [row],
        }
    return {
        "message": "Supplier Created Successfully",
        "data": response.data or [],
    }


def update_supplier(supplier_id: str, supplier: SupplierUpdate):
    updates = supplier.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No supplier fields provided for update",
        )

    if _use_local_store():
        if supplier_id not in _LOCAL_SUPPLIERS:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        _LOCAL_SUPPLIERS[supplier_id] = {**_LOCAL_SUPPLIERS[supplier_id], **updates}
        return {
            "message": "Supplier Updated Successfully",
            "data": [_LOCAL_SUPPLIERS[supplier_id]],
        }

    try:
        response = (
            supabase
            .table(TABLE_NAME)
            .update(updates)
            .eq("id", supplier_id)
            .select("*")
            .execute()
        )
    except APIError:
        if supplier_id in _LOCAL_SUPPLIERS:
            _LOCAL_SUPPLIERS[supplier_id] = {**_LOCAL_SUPPLIERS[supplier_id], **updates}
            return {
                "message": "Supplier Updated Successfully in local fallback storage",
                "data": [_LOCAL_SUPPLIERS[supplier_id]],
            }
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Supabase failed to update supplier records because the table schema does not match the app contract")

    if not response.data:
        if supplier_id in _LOCAL_SUPPLIERS:
            _LOCAL_SUPPLIERS[supplier_id] = {**_LOCAL_SUPPLIERS[supplier_id], **updates}
            return {
                "message": "Supplier Updated Successfully in local fallback storage",
                "data": [_LOCAL_SUPPLIERS[supplier_id]],
            }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )

    return {
        "message": "Supplier Updated Successfully",
        "data": response.data,
    }


def delete_supplier(supplier_id: str):
    if _use_local_store():
        row = _LOCAL_SUPPLIERS.pop(supplier_id, None)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        return {
            "message": "Supplier Deleted Successfully",
            "data": [row],
        }

    try:
        response = (
            supabase
            .table(TABLE_NAME)
            .delete()
            .eq("id", supplier_id)
            .select("*")
            .execute()
        )
    except APIError:
        row = _LOCAL_SUPPLIERS.pop(supplier_id, None)
        if row is not None:
            return {
                "message": "Supplier Deleted Successfully from local fallback storage",
                "data": [row],
            }
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Supabase failed to delete supplier records because the table schema does not match the app contract")

    if not response.data:
        row = _LOCAL_SUPPLIERS.pop(supplier_id, None)
        if row is not None:
            return {
                "message": "Supplier Deleted Successfully from local fallback storage",
                "data": [row],
            }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )

    return {
        "message": "Supplier Deleted Successfully",
        "data": response.data,
    }
