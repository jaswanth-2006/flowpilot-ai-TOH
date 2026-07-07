from pydantic import BaseModel, Field


class CustomerBase(BaseModel):
    company_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    phone: str = Field(min_length=1)
    address: str = Field(min_length=1)
    notes: str = ""


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    company_id: str | None = None
    name: str | None = None
    email: str | None = Field(default=None, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    phone: str | None = None
    address: str | None = None
    notes: str | None = None
