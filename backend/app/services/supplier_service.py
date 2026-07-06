from fastapi import HTTPException, status

from app.core.database import supabase
from app.schemas.supplier import SupplierCreate, SupplierUpdate


TABLE_NAME = "suppliers"


def list_suppliers():
    response = supabase.table(TABLE_NAME).select("*").order("created_at", desc=True).execute()
    return response.data or []


def create_supplier(supplier: SupplierCreate):
    response = supabase.table(TABLE_NAME).insert(supplier.model_dump()).select("*").execute()
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

    response = (
        supabase
        .table(TABLE_NAME)
        .update(updates)
        .eq("id", supplier_id)
        .select("*")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )

    return {
        "message": "Supplier Updated Successfully",
        "data": response.data,
    }


def delete_supplier(supplier_id: str):
    response = (
        supabase
        .table(TABLE_NAME)
        .delete()
        .eq("id", supplier_id)
        .select("*")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )

    return {
        "message": "Supplier Deleted Successfully",
        "data": response.data,
    }
