import warnings
from typing import List, Dict, Any
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.tables_db import TablesDB
from appwrite.query import Query
from appwrite.id import ID
from appwrite.exception import AppwriteException

from app.core.config import settings

warnings.filterwarnings("ignore", category=DeprecationWarning)


class AppwriteService:
    """
    Centralized Appwrite client and database service manager for Balder.
    Supports both Databases service and Appwrite Cloud 1.8+ TablesDB interface.
    """
    def __init__(self):
        if not settings.APPWRITE_PROJECT_ID or not settings.APPWRITE_API_KEY:
            raise ValueError(
                "APPWRITE_PROJECT_ID e APPWRITE_API_KEY devem estar configurados no arquivo .env."
            )

        self.client = Client()
        self.client.set_endpoint(settings.APPWRITE_ENDPOINT)
        self.client.set_project(settings.APPWRITE_PROJECT_ID)
        self.client.set_key(settings.APPWRITE_API_KEY)

        # Standard Appwrite Databases service
        self.databases = Databases(self.client)
        # Modern TablesDB service (Appwrite 1.8+)
        self.tables_db = TablesDB(self.client)
        self.database_id = settings.APPWRITE_DATABASE_ID

    def insert_transaction(self, transaction_data: Dict[str, Any], document_id: str | None = None) -> Dict[str, Any]:
        """
        Inserts a new transaction record into the transactions collection/table.
        """
        doc_id = document_id or ID.unique()
        col = settings.COLLECTION_TRANSACTIONS

        # First attempt via TablesDB (modern Appwrite Cloud schema)
        try:
            row = self.tables_db.create_row(
                database_id=self.database_id,
                table_id=col,
                row_id=doc_id,
                data=transaction_data
            )
            return {
                "id": getattr(row, "id", doc_id),
                "data": getattr(row, "data", transaction_data)
            }
        except AppwriteException as te:
            # Fallback to legacy Databases service if TablesDB is not available
            try:
                doc = self.databases.create_document(
                    database_id=self.database_id,
                    collection_id=col,
                    document_id=doc_id,
                    data=transaction_data
                )
                return {
                    "id": getattr(doc, "id", doc_id),
                    "data": getattr(doc, "data", transaction_data)
                }
            except Exception:
                raise te

    def find_fixed_anchors_by_workspace(self, workspace_id: str) -> List[Dict[str, Any]]:
        """
        Queries the fixed_anchors collection/table for records matching the given workspace_id.
        Uses Query.equal for exact matching.
        """
        queries = [
            Query.equal("workspace_id", workspace_id)
        ]
        col = settings.COLLECTION_FIXED_ANCHORS

        try:
            result = self.tables_db.list_rows(
                database_id=self.database_id,
                table_id=col,
                queries=queries
            )
            rows = getattr(result, "rows", [])
            return [getattr(r, "data", r) for r in rows]
        except AppwriteException:
            # Fallback to Databases service
            result = self.databases.list_documents(
                database_id=self.database_id,
                collection_id=col,
                queries=queries
            )
            docs = getattr(result, "documents", [])
            return [getattr(d, "data", d) for d in docs]


# Global singleton instance
_appwrite_service: AppwriteService | None = None


def get_appwrite_service() -> AppwriteService:
    global _appwrite_service
    if _appwrite_service is None:
        _appwrite_service = AppwriteService()
    return _appwrite_service
