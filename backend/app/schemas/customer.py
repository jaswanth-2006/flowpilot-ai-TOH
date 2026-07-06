from pydantic import BaseModel


class CustomerBase(BaseModel):
    company_id: str
    name: str
    email: str
    phone: str
    address: str
    notes: str = ""


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    company_id: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None