import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    PROJECT_NAME: str = "Balder AI Financial Auditor"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Appwrite configuration
    APPWRITE_ENDPOINT: str = os.getenv("APPWRITE_ENDPOINT", "https://sfo.cloud.appwrite.io/v1")
    APPWRITE_PROJECT_ID: str = os.getenv("APPWRITE_PROJECT_ID", "")
    APPWRITE_API_KEY: str = os.getenv("APPWRITE_API_KEY", "")
    APPWRITE_DATABASE_ID: str = os.getenv("APPWRITE_DATABASE_ID", "balder_db")

    # Collections / Tables
    COLLECTION_TRANSACTIONS: str = "transactions"
    COLLECTION_FIXED_ANCHORS: str = "fixed_anchors"
    COLLECTION_WORKSPACES: str = "workspaces"
    COLLECTION_WORKSPACE_MEMBERS: str = "workspace_members"
    COLLECTION_TEMPLATES: str = "templates"

settings = Settings()
