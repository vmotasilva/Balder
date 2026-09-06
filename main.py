import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.config import settings
from app.core.appwrite import get_appwrite_service
from app.api.webhooks import router as webhooks_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("balder")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown events.
    Verifies Appwrite connectivity on launch.
    """
    logger.info("Initializing Balder AI Financial Auditor...")
    try:
        appwrite = get_appwrite_service()
        logger.info(f"Connected to Appwrite project '{settings.APPWRITE_PROJECT_ID}' in '{settings.APPWRITE_ENDPOINT}'.")
    except Exception as e:
        logger.warning(f"Could not initialize Appwrite client during startup: {e}")
    yield
    logger.info("Balder AI Microservice shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Balder - Financial Intelligence & AI Expense Audit Microservice",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(webhooks_router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "appwrite_configured": bool(settings.APPWRITE_PROJECT_ID and settings.APPWRITE_API_KEY)
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
