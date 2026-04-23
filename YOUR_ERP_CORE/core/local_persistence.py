from __future__ import annotations

"""Local SQLite persistence for the custom ORM.

This backend stores every BaseModel record as a JSON payload in a single
SQLite table. It is intentionally simple so development data survives
restarts without forcing a full migration to SQLAlchemy models.
"""

from datetime import date, datetime
from enum import Enum
import json
import sqlite3
from pathlib import Path
from threading import RLock
from typing import Any, Dict, Iterable, List, Tuple

from config.settings import settings


BASE_DIR = Path(__file__).resolve().parent.parent


def _resolve_db_path() -> Path:
    raw_path = getattr(settings, "DATABASE_NAME", "./erp_dev.db") or "./erp_dev.db"
    path = Path(raw_path).expanduser()
    return path.resolve() if path.is_absolute() else (BASE_DIR / path).resolve()


def _encode_value(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value

    if isinstance(value, datetime):
        return {"__erp_type__": "datetime", "value": value.isoformat()}

    if isinstance(value, date):
        return {"__erp_type__": "date", "value": value.isoformat()}

    if isinstance(value, Enum):
        return {"__erp_type__": "enum", "value": value.value}

    if isinstance(value, dict):
        return {str(key): _encode_value(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set)):
        return {
            "__erp_type__": "list",
            "value": [_encode_value(item) for item in value],
        }

    if hasattr(value, "id") and hasattr(value, "__tablename__"):
        return {
            "__erp_type__": "model_ref",
            "table": getattr(value, "__tablename__", ""),
            "value": getattr(value, "id", None),
        }

    return str(value)


def _decode_value(value: Any) -> Any:
    if isinstance(value, list):
        return [_decode_value(item) for item in value]

    if isinstance(value, dict):
        value_type = value.get("__erp_type__")
        if value_type == "datetime":
            text = value.get("value")
            if text:
                text = text.replace("Z", "+00:00")
                return datetime.fromisoformat(text)
            return None
        if value_type == "date":
            text = value.get("value")
            return date.fromisoformat(text) if text else None
        if value_type == "enum":
            return value.get("value")
        if value_type == "list":
            return [_decode_value(item) for item in value.get("value", [])]
        if value_type == "model_ref":
            return value.get("value")
        return {str(key): _decode_value(item) for key, item in value.items()}

    return value


def serialize_payload(payload: Dict[str, Any]) -> str:
    return json.dumps({key: _encode_value(value) for key, value in payload.items()}, ensure_ascii=False)


def deserialize_payload(payload: str) -> Dict[str, Any]:
    raw = json.loads(payload or "{}")
    if not isinstance(raw, dict):
        return {}
    return {key: _decode_value(value) for key, value in raw.items()}


class LocalSQLiteStore:
    """Minimal SQLite store for BaseModel records."""

    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or _resolve_db_path()
        self._lock = RLock()
        self._initialized = False

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA busy_timeout=30000")
        return conn

    def ensure_ready(self) -> None:
        with self._lock:
            if self._initialized:
                return
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            with self._connect() as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS orm_records (
                        table_name TEXT NOT NULL,
                        record_id INTEGER NOT NULL,
                        payload TEXT NOT NULL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (table_name, record_id)
                    )
                    """
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_orm_records_table_name ON orm_records(table_name)"
                )
                conn.commit()
            self._initialized = True

    def load_table(self, table_name: str) -> List[Tuple[int, Dict[str, Any]]]:
        self.ensure_ready()
        with self._lock, self._connect() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT record_id, payload FROM orm_records WHERE table_name = ? ORDER BY record_id ASC",
                (table_name,),
            ).fetchall()
        return [(int(row["record_id"]), deserialize_payload(row["payload"])) for row in rows]

    def upsert(self, table_name: str, record_id: int, payload: Dict[str, Any]) -> None:
        self.ensure_ready()
        encoded_payload = serialize_payload(payload)
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO orm_records (table_name, record_id, payload, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(table_name, record_id)
                DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
                """,
                (table_name, int(record_id), encoded_payload),
            )
            conn.commit()

    def delete(self, table_name: str, record_id: int) -> None:
        self.ensure_ready()
        with self._lock, self._connect() as conn:
            conn.execute(
                "DELETE FROM orm_records WHERE table_name = ? AND record_id = ?",
                (table_name, int(record_id)),
            )
            conn.commit()

    def table_max_id(self, table_name: str) -> int:
        self.ensure_ready()
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT COALESCE(MAX(record_id), 0) AS max_id FROM orm_records WHERE table_name = ?",
                (table_name,),
            ).fetchone()
        return int(row[0] or 0)

    def table_exists(self, table_name: str) -> bool:
        self.ensure_ready()
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT 1 FROM orm_records WHERE table_name = ? LIMIT 1",
                (table_name,),
            ).fetchone()
        return row is not None
