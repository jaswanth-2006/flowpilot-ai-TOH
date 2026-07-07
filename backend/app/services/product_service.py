from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from uuid import uuid4

from app.core.database import supabase
from app.services.supplier_service import list_suppliers as list_supplier_rows
from app.schemas.product import ProductCreate, ProductUpdate


PRODUCT_TABLE = "products"
SUPPLIER_TABLE = "suppliers"
_LOCAL_PRODUCTS: dict[str, dict] = {}


def _use_local_store() -> bool:
    return supabase is None


def list_products():
    if _use_local_store():
        return list(_LOCAL_PRODUCTS.values())

    try:
        response = supabase.table(PRODUCT_TABLE).select("*").execute()
        return (response.data or []) + list(_LOCAL_PRODUCTS.values())
    except APIError:
        return list(_LOCAL_PRODUCTS.values())


def create_product(product: ProductCreate):
    payload = product.model_dump()
    if _use_local_store():
        product_id = str(uuid4())
        row = {"id": product_id, **payload}
        _LOCAL_PRODUCTS[product_id] = row
        return {
            "message": "Product Created Successfully",
            "data": [row],
        }

    try:
        response = (
            supabase
            .table(PRODUCT_TABLE)
            .insert(payload)
            .select("*")
            .execute()
        )
    except APIError:
        product_id = str(uuid4())
        row = {"id": product_id, **payload}
        _LOCAL_PRODUCTS[product_id] = row
        return {
            "message": "Product Created Successfully in local fallback storage because Supabase product columns do not match the app contract",
            "data": [row],
        }
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

    if _use_local_store():
        if product_id not in _LOCAL_PRODUCTS:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        _LOCAL_PRODUCTS[product_id] = {**_LOCAL_PRODUCTS[product_id], **updates}
        return {
            "message": "Product Updated Successfully",
            "data": [_LOCAL_PRODUCTS[product_id]],
        }

    try:
        response = (
            supabase
            .table(PRODUCT_TABLE)
            .update(updates)
            .eq("id", product_id)
            .select("*")
            .execute()
        )
    except APIError:
        if product_id in _LOCAL_PRODUCTS:
            _LOCAL_PRODUCTS[product_id] = {**_LOCAL_PRODUCTS[product_id], **updates}
            return {
                "message": "Product Updated Successfully in local fallback storage",
                "data": [_LOCAL_PRODUCTS[product_id]],
            }
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Supabase failed to update product records because the table schema does not match the app contract")

    if not response.data:
        if product_id in _LOCAL_PRODUCTS:
            _LOCAL_PRODUCTS[product_id] = {**_LOCAL_PRODUCTS[product_id], **updates}
            return {
                "message": "Product Updated Successfully in local fallback storage",
                "data": [_LOCAL_PRODUCTS[product_id]],
            }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return {
        "message": "Product Updated Successfully",
        "data": response.data,
    }


def delete_product(product_id: str):
    if _use_local_store():
        row = _LOCAL_PRODUCTS.pop(product_id, None)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return {
            "message": "Product Deleted Successfully",
            "data": [row],
        }

    try:
        response = (
            supabase
            .table(PRODUCT_TABLE)
            .delete()
            .eq("id", product_id)
            .select("*")
            .execute()
        )
    except APIError:
        row = _LOCAL_PRODUCTS.pop(product_id, None)
        if row is not None:
            return {
                "message": "Product Deleted Successfully from local fallback storage",
                "data": [row],
            }
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Supabase failed to delete product records because the table schema does not match the app contract")

    if not response.data:
        row = _LOCAL_PRODUCTS.pop(product_id, None)
        if row is not None:
            return {
                "message": "Product Deleted Successfully from local fallback storage",
                "data": [row],
            }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return {
        "message": "Product Deleted Successfully",
        "data": response.data,
    }


def list_suppliers():
    return list_supplier_rows()
