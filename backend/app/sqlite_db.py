import sqlite3
import os
import threading

_DB_PATH = os.getenv("DB_PATH", "./nutritrack.db")
_local = threading.local()


def get_db() -> sqlite3.Connection:
    if not hasattr(_local, "conn"):
        _local.conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA foreign_keys=ON")
        _init_schema(_local.conn)
    return _local.conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS meals (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            meal_type TEXT,
            food_name TEXT,
            food_id TEXT,
            amount_g REAL,
            calories REAL DEFAULT 0,
            protein REAL DEFAULT 0,
            carbs REAL DEFAULT 0,
            fat REAL DEFAULT 0,
            fiber REAL DEFAULT 0,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS water_intake (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            amount_ml INTEGER,
            logged_at TEXT
        );

        CREATE TABLE IF NOT EXISTS exercise_logs (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            exercise_name TEXT,
            category TEXT,
            duration_min REAL,
            calories_burned REAL DEFAULT 0,
            logged_at TEXT
        );

        CREATE TABLE IF NOT EXISTS body_measurements (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            weight_kg REAL,
            body_fat_pct REAL,
            waist_cm REAL,
            hip_cm REAL,
            chest_cm REAL,
            bmi REAL,
            note TEXT,
            logged_at TEXT
        );

        CREATE TABLE IF NOT EXISTS fasting_sessions (
            id TEXT PRIMARY KEY,
            protocol TEXT,
            target_hours REAL,
            started_at TEXT,
            ended_at TEXT,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS meal_templates (
            id TEXT PRIMARY KEY,
            name TEXT,
            items TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            provider TEXT,
            title TEXT,
            preview TEXT,
            message_count INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            role TEXT,
            content TEXT,
            provider TEXT,
            tool_calls TEXT,
            created_at TEXT,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        );

        CREATE TABLE IF NOT EXISTS user_config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)
    conn.commit()


def row_to_dict(row) -> dict:
    return dict(row) if row else {}


def get_config(key: str) -> dict:
    import json
    db = get_db()
    row = db.execute("SELECT value FROM user_config WHERE key = ?", (key,)).fetchone()
    if row and row["value"]:
        return json.loads(row["value"])
    return {}


def set_config(key: str, data: dict) -> None:
    import json
    db = get_db()
    db.execute(
        "INSERT OR REPLACE INTO user_config (key, value) VALUES (?, ?)",
        (key, json.dumps(data)),
    )
    db.commit()


def merge_config(key: str, updates: dict) -> dict:
    current = get_config(key)
    current.update(updates)
    set_config(key, current)
    return current
