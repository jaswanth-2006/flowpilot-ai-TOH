from fastapi import FastAPI

app = FastAPI(
    title="FlowPilot AI",
    version="1.0.0"
)

@app.get("/")
def home():
    return {
        "message":"FlowPilot Backend Running 🚀"
    }