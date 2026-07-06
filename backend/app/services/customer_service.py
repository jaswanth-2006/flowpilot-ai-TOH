from fastapi import HTTPException, status

from app.core.database import supabase
from app.schemas.customer import CustomerCreate, CustomerUpdate


TABLE_NAME = "customers"


def list_customers():
    response = supabase.table(TABLE_NAME).select("*").execute()
    return response.data or []


def create_customer(customer: CustomerCreate):
    response = supabase.table(TABLE_NAME).insert(customer.model_dump()).execute()
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

    response = (
        supabase
        .table(TABLE_NAME)
        .update(updates)
        .eq("id", customer_id)
        .execute()
    )

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
    response = (
        supabase
        .table(TABLE_NAME)
        .delete()
        .eq("id", customer_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    return {
        "message": "Customer Deleted Successfully",
        "data": response.data,
    }