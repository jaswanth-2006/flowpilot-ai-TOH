from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    supplier_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    sku: str = Field(min_length=1)
    category: str = Field(min_length=1)
    price: float = Field(ge=0)
    inventory: int = Field(ge=0)
    description: str = ""


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    supplier_id: str | None = None
    name: str | None = None
    sku: str | None = None
    category: str | None = None
    price: float | None = Field(default=None, ge=0)
    inventory: int | None = Field(default=None, ge=0)
    description: str | None = None
