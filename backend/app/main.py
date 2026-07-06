from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.customers import router as customer_router
from app.routers.execution_engine import router as execution_engine_router
from app.routers.products import router as product_router
from app.routers.suppliers import router as supplier_router

app = FastAPI(title="FlowPilot AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customer_router)
app.include_router(product_router)
app.include_router(supplier_router)
app.include_router(execution_engine_router)

@app.get("/")
def home():
    return {
        "status": "success",
        "message": "FlowPilot Backend Running 🚀"
    }