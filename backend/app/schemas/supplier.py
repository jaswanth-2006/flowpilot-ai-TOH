from pydantic import BaseModel, Field


class SupplierBase(BaseModel):
    name: str = Field(min_length=1)
    rating: float = Field(ge=0, le=5)
    lead_time: str = Field(min_length=1)
    address: str = Field(min_length=1)
    products_supplied: list[str] = Field(default_factory=list)


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: str | None = None
    rating: float | None = Field(default=None, ge=0, le=5)
    lead_time: str | None = None
    address: str | None = None
    products_supplied: list[str] | None = None
