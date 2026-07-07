from fastapi import APIRouter, status

from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.customer_service import (
    create_customer as create_customer_service,
    delete_customer as delete_customer_service,
    list_customers,
    update_customer as update_customer_service,
)

router = APIRouter(
    prefix="/customers",
    tags=["Customers"]
)

@router.get("/")
def get_customers():
    return list_customers()

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_customer(customer: CustomerCreate):
    return create_customer_service(customer)


@router.put("/{customer_id}")
def update_customer_details(customer_id: str, customer: CustomerUpdate):
    return update_customer_service(customer_id, customer)


@router.delete("/{customer_id}")
def delete_customer_details(customer_id: str):
    return delete_customer_service(customer_id)
