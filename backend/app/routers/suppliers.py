from fastapi import APIRouter, status

from app.schemas.supplier import SupplierCreate, SupplierUpdate
from app.services.supplier_service import (
    create_supplier as create_supplier_service,
    delete_supplier as delete_supplier_service,
    list_suppliers,
    update_supplier as update_supplier_service,
)


router = APIRouter(
    prefix="/suppliers",
    tags=["Suppliers"],
)


@router.get("/")
def get_suppliers():
    return list_suppliers()


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_supplier(supplier: SupplierCreate):
    return create_supplier_service(supplier)


@router.put("/{supplier_id}")
def update_supplier_details(supplier_id: str, supplier: SupplierUpdate):
    return update_supplier_service(supplier_id, supplier)


@router.delete("/{supplier_id}")
def delete_supplier_details(supplier_id: str):
    return delete_supplier_service(supplier_id)
