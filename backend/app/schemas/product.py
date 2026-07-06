from pydantic import BaseModel


class ProductBase(BaseModel):
    supplier_id: str
    name: str
    sku: str
    category: str
    price: float
    inventory: int
    description: str = ""


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    supplier_id: str | None = None
    name: str | None = None
    sku: str | None = None
    category: str | None = None
    price: float | None = None
    inventory: int | None = None
    description: str | None = None
