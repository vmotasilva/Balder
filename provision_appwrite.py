#!/usr/bin/env python3
"""
Balder Database Provisioning Script for Appwrite
Author: Infrastructure & Appwrite Specialist
Description: Idempotent database, table/collection, and column/attribute provisioning
             with asynchronous status polling for Appwrite Cloud (1.8+ TablesDB & Databases).
"""

import os
import sys
import time
import argparse
import warnings
from typing import Dict, Any, List
from dotenv import load_dotenv

# Silence SDK migration/deprecation warnings for clean output
warnings.filterwarnings("ignore", category=DeprecationWarning)

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from appwrite.client import Client
from appwrite.services.tables_db import TablesDB
from appwrite.exception import AppwriteException


SCHEMA_CONFIG = {
    "database": {
        "id": "balder_db",
        "name": "Balder Database"
    },
    "tables": [
        {
            "id": "workspaces",
            "name": "workspaces",
            "columns": [
                {
                    "key": "name",
                    "type": "string",
                    "size": 255,
                    "required": True
                },
                {
                    "key": "type",
                    "type": "enum",
                    "elements": ["family", "business"],
                    "required": True
                },
                {
                    "key": "created_at",
                    "type": "datetime",
                    "required": True
                }
            ]
        },
        {
            "id": "workspace_members",
            "name": "workspace_members",
            "columns": [
                {
                    "key": "workspace_id",
                    "type": "string",
                    "size": 50,
                    "required": True
                },
                {
                    "key": "user_id",
                    "type": "string",
                    "size": 50,
                    "required": True
                },
                {
                    "key": "role",
                    "type": "enum",
                    "elements": ["admin", "partner", "dependent"],
                    "required": True
                }
            ]
        },
        {
            "id": "templates",
            "name": "templates",
            "columns": [
                {
                    "key": "creator_id",
                    "type": "string",
                    "size": 50,
                    "required": True
                },
                {
                    "key": "name",
                    "type": "string",
                    "size": 255,
                    "required": True
                },
                {
                    "key": "is_premium",
                    "type": "boolean",
                    "required": True
                },
                {
                    "key": "price",
                    "type": "float",
                    "required": False
                }
            ]
        },
        {
            "id": "fixed_anchors",
            "name": "fixed_anchors",
            "columns": [
                {
                    "key": "workspace_id",
                    "type": "string",
                    "size": 50,
                    "required": True
                },
                {
                    "key": "name",
                    "type": "string",
                    "size": 255,
                    "required": True
                },
                {
                    "key": "expected_amount",
                    "type": "float",
                    "required": True
                },
                {
                    "key": "category",
                    "type": "string",
                    "size": 100,
                    "required": True
                },
                {
                    "key": "periodicity",
                    "type": "enum",
                    "elements": ["monthly", "annual", "variable_season"],
                    "required": True
                }
            ]
        },
        {
            "id": "transactions",
            "name": "transactions",
            "columns": [
                {
                    "key": "workspace_id",
                    "type": "string",
                    "size": 50,
                    "required": True
                },
                {
                    "key": "external_provider_id",
                    "type": "string",
                    "size": 255,
                    "required": False
                },
                {
                    "key": "date",
                    "type": "datetime",
                    "required": True
                },
                {
                    "key": "description",
                    "type": "string",
                    "size": 500,
                    "required": True
                },
                {
                    "key": "amount",
                    "type": "float",
                    "required": True
                },
                {
                    "key": "type",
                    "type": "enum",
                    "elements": ["income", "expense"],
                    "required": True
                },
                {
                    "key": "predicted_category",
                    "type": "string",
                    "size": 100,
                    "required": False
                },
                {
                    "key": "ai_confidence_score",
                    "type": "float",
                    "required": False
                },
                {
                    "key": "is_anomaly",
                    "type": "boolean",
                    "required": True,
                    "default": False
                },
                {
                    "key": "ai_justification_suggestion",
                    "type": "string",
                    "size": 1000,
                    "required": False
                },
                {
                    "key": "user_validated",
                    "type": "boolean",
                    "required": False,
                    "default": False
                }
            ]
        }
    ]
}


class AppwriteProvisioner:
    def __init__(self, endpoint: str, project_id: str, api_key: str):
        self.endpoint = endpoint
        self.project_id = project_id
        self.api_key = api_key

        self.client = Client()
        self.client.set_endpoint(self.endpoint)
        self.client.set_project(self.project_id)
        self.client.set_key(self.api_key)

        self.tdb = TablesDB(self.client)

    def log(self, icon: str, msg: str):
        print(f"[{time.strftime('%H:%M:%S')}] {icon} {msg}", flush=True)

    def ensure_database(self, db_id: str, name: str):
        self.log("🔍", f"Checking database '{db_id}'...")
        try:
            db = self.tdb.get(database_id=db_id)
            self.log("✅", f"Database '{db_id}' exists ('{db.name}').")
            return db
        except AppwriteException as e:
            if e.code == 404:
                self.log("🚀", f"Database '{db_id}' not found. Creating '{name}'...")
                db = self.tdb.create(database_id=db_id, name=name)
                self.log("🎉", f"Database '{db_id}' created successfully.")
                return db
            raise

    def ensure_table(self, db_id: str, table_id: str, name: str):
        self.log("🔍", f"Checking table/collection '{table_id}' in '{db_id}'...")
        try:
            tbl = self.tdb.get_table(database_id=db_id, table_id=table_id)
            self.log("✅", f"Table/collection '{table_id}' already exists.")
            return tbl
        except AppwriteException as e:
            if e.code == 404:
                self.log("🚀", f"Table/collection '{table_id}' not found. Creating '{name}'...")
                tbl = self.tdb.create_table(
                    database_id=db_id,
                    table_id=table_id,
                    name=name
                )
                self.log("🎉", f"Table/collection '{table_id}' created successfully.")
                return tbl
            raise

    def _get_status_str(self, status_val: Any) -> str:
        if hasattr(status_val, "value"):
            return str(status_val.value).lower()
        s = str(status_val).lower()
        if "." in s:
            s = s.split(".")[-1]
        return s

    def wait_for_column(self, db_id: str, table_id: str, key: str, timeout: int = 60, poll_interval: float = 1.0):
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                col = self.tdb.get_column(database_id=db_id, table_id=table_id, key=key)
                status = self._get_status_str(getattr(col, "status", "available"))
                if status == "available":
                    self.log("  ✨", f"Column/Attribute '{key}' is active (status: available).")
                    return True
                elif status == "failed":
                    raise RuntimeError(f"Column/Attribute '{key}' failed during Appwrite creation.")
                else:
                    self.log("  ⏳", f"Column/Attribute '{key}' status is '{status}'... waiting.")
            except AppwriteException as e:
                self.log("  ⚠️", f"Error checking column '{key}': {e.message}")
            time.sleep(poll_interval)

        raise TimeoutError(f"Timed out after {timeout}s waiting for column '{key}' to become available.")

    def ensure_column(self, db_id: str, table_id: str, spec: Dict[str, Any]):
        key = spec["key"]
        col_type = spec["type"]
        required = spec.get("required", False)
        default = spec.get("default", None)

        # Check if column already exists
        try:
            col = self.tdb.get_column(database_id=db_id, table_id=table_id, key=key)
            status = self._get_status_str(getattr(col, "status", "available"))
            if status == "available":
                self.log("  ✅", f"Column/Attribute '{key}' ({col_type}) already exists and is active.")
                return
            elif status in ("processing", "waiting"):
                self.log("  ⏳", f"Column/Attribute '{key}' exists but is '{status}'. Waiting...")
                self.wait_for_column(db_id, table_id, key)
                return
        except AppwriteException as e:
            if e.code != 404:
                raise

        self.log("  ➕", f"Creating column/attribute '{key}' ({col_type}, required={required})...")

        try:
            if col_type == "string":
                size = spec.get("size", 255)
                self.tdb.create_string_column(
                    database_id=db_id,
                    table_id=table_id,
                    key=key,
                    size=size,
                    required=required,
                    default=default
                )
            elif col_type == "enum":
                elements = spec["elements"]
                self.tdb.create_enum_column(
                    database_id=db_id,
                    table_id=table_id,
                    key=key,
                    elements=elements,
                    required=required,
                    default=default
                )
            elif col_type == "datetime":
                self.tdb.create_datetime_column(
                    database_id=db_id,
                    table_id=table_id,
                    key=key,
                    required=required,
                    default=default
                )
            elif col_type == "boolean":
                try:
                    self.tdb.create_boolean_column(
                        database_id=db_id,
                        table_id=table_id,
                        key=key,
                        required=required,
                        default=default
                    )
                except AppwriteException as be:
                    # In some Appwrite versions, default is rejected if required=True
                    if "default" in be.message.lower() and required:
                        self.log("  ⚠️", f"Appwrite rejected default with required=True for '{key}'. Retrying with required=False...")
                        self.tdb.create_boolean_column(
                            database_id=db_id,
                            table_id=table_id,
                            key=key,
                            required=False,
                            default=default
                        )
                    else:
                        raise be
            elif col_type == "float":
                self.tdb.create_float_column(
                    database_id=db_id,
                    table_id=table_id,
                    key=key,
                    required=required,
                    default=default
                )
            else:
                raise ValueError(f"Unsupported column type: {col_type}")

        except AppwriteException as e:
            if "already exists" in e.message.lower():
                self.log("  ✅", f"Column/Attribute '{key}' was created concurrently.")
            else:
                raise

        # Wait for asynchronous column readiness
        self.wait_for_column(db_id, table_id, key)

    def provision_all(self):
        self.log("🛡️", "Starting Balder Appwrite Infrastructure Provisioning...")
        db_cfg = SCHEMA_CONFIG["database"]
        self.ensure_database(db_cfg["id"], db_cfg["name"])

        for tbl_cfg in SCHEMA_CONFIG["tables"]:
            tbl_id = tbl_cfg["id"]
            tbl_name = tbl_cfg["name"]
            print("-" * 60)
            self.ensure_table(db_cfg["id"], tbl_id, tbl_name)

            for col_spec in tbl_cfg["columns"]:
                self.ensure_column(db_cfg["id"], tbl_id, col_spec)

        print("=" * 60)
        self.log("🏁", "All database schemas, tables/collections, and columns/attributes provisioned successfully!")


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="Provision Appwrite Database for Balder")
    parser.add_argument("--endpoint", default=os.getenv("APPWRITE_ENDPOINT", "https://sfo.cloud.appwrite.io/v1"), help="Appwrite API Endpoint")
    parser.add_argument("--project-id", default=os.getenv("APPWRITE_PROJECT_ID"), help="Appwrite Project ID")
    parser.add_argument("--api-key", default=os.getenv("APPWRITE_API_KEY"), help="Appwrite Server API Key")

    args = parser.parse_args()

    if not args.project_id:
        print("\n❌ ERRO: APPWRITE_PROJECT_ID não fornecido!", file=sys.stderr)
        print("Defina a variável APPWRITE_PROJECT_ID no arquivo .env ou passe via argumento --project-id.\n", file=sys.stderr)
        sys.exit(1)

    if not args.api_key:
        print("\n❌ ERRO: APPWRITE_API_KEY não fornecido!", file=sys.stderr)
        print("Defina a variável APPWRITE_API_KEY no arquivo .env ou passe via argumento --api-key.\n", file=sys.stderr)
        sys.exit(1)

    provisioner = AppwriteProvisioner(
        endpoint=args.endpoint,
        project_id=args.project_id,
        api_key=args.api_key
    )

    try:
        provisioner.provision_all()
    except AppwriteException as e:
        print(f"\n❌ Falha no provisionamento do Appwrite (Código {e.code}): {e.message}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Falha inesperada: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
