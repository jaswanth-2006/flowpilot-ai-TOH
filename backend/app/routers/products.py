from fastapi import APIRouter

from app.schemas.product import ProductCreate, ProductUpdate
from app.services.product_service import (
    create_product as create_product_service,
    delete_product as delete_product_service,
    list_products,
    list_suppliers,
    update_product as update_product_service,
)


router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


@router.get("/")
def get_products():
    return list_products()


@router.post("/")
def create_product(product: ProductCreate):
    return create_product_service(product)


@router.put("/{product_id}")
def update_product_details(product_id: str, product: ProductUpdate):
    return update_product_service(product_id, product)


@router.delete("/{product_id}")
def delete_product_details(product_id: str):
    return delete_product_service(product_id)


@router.get("/suppliers")
def get_suppliers():
    return list_suppliers()
