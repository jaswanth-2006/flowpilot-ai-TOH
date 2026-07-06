from fastapi import HTTPException, status

from app.core.database import supabase
from app.schemas.product import ProductCreate, ProductUpdate


PRODUCT_TABLE = "products"
SUPPLIER_TABLE = "suppliers"


def list_products():
    response = supabase.table(PRODUCT_TABLE).select("*").execute()
    return response.data or []


def create_product(product: ProductCreate):
    response = (
        supabase
        .table(PRODUCT_TABLE)
        .insert(product.model_dump())
        .select("*")
        .execute()
    )
    return {
        "message": "Product Created Successfully",
        "data": response.data or [],
    }


def update_product(product_id: str, product: ProductUpdate):
    updates = product.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No product fields provided for update",
        )

    response = (
        supabase
        .table(PRODUCT_TABLE)
        .update(updates)
        .eq("id", product_id)
        .select("*")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return {
        "message": "Product Updated Successfully",
        "data": response.data,
    }


def delete_product(product_id: str):
    response = (
        supabase
        .table(PRODUCT_TABLE)
        .delete()
        .eq("id", product_id)
        .select("*")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return {
        "message": "Product Deleted Successfully",
        "data": response.data,
    }


def list_suppliers():
    response = supabase.table(SUPPLIER_TABLE).select("*").execute()
    return response.data or []
