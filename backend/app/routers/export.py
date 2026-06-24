import json
from datetime import datetime
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from app.sqlite_db import get_db, get_config

router = APIRouter()

TABLES = [
    "meals",
    "water_intake",
    "exercise_logs",
    "body_measurements",
    "fasting_sessions",
    "meal_templates",
    "chat_sessions",
    "chat_messages",
]


@router.get("/export")
def export_data():
    db = get_db()
    data: dict = {
        "export_date": datetime.utcnow().isoformat(),
        "version": "1.0",
        "config": {
            "goals": get_config("goals"),
            "profile": get_config("profile"),
        },
    }
    for table in TABLES:
        rows = db.execute(f"SELECT * FROM {table}").fetchall()  # noqa: S608
        records = [dict(r) for r in rows]
        for r in records:
            for k, v in r.items():
                if isinstance(v, str):
                    try:
                        r[k] = json.loads(v)
                    except (json.JSONDecodeError, ValueError):
                        pass
        data[table] = records

    return JSONResponse(
        content=data,
        headers={"Content-Disposition": "attachment; filename=nutritrack-export.json"},
    )


@router.post("/import")
async def import_data(file: UploadFile = File(...)):
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return {"ok": False, "error": "Geçersiz JSON"}

    db = get_db()

    if config := data.get("config"):
        if goals := config.get("goals"):
            db.execute(
                "INSERT OR REPLACE INTO user_config (key, value) VALUES ('goals', ?)",
                (json.dumps(goals),),
            )
        if profile := config.get("profile"):
            db.execute(
                "INSERT OR REPLACE INTO user_config (key, value) VALUES ('profile', ?)",
                (json.dumps(profile),),
            )

    imported: dict = {}
    for table in TABLES:
        rows = data.get(table, [])
        if not rows:
            continue
        count = 0
        for row in rows:
            serialized = {
                k: (json.dumps(v) if isinstance(v, (list, dict)) else v)
                for k, v in row.items()
            }
            cols = ", ".join(serialized.keys())
            placeholders = ", ".join(f":{k}" for k in serialized.keys())
            try:
                db.execute(
                    f"INSERT OR REPLACE INTO {table} ({cols}) VALUES ({placeholders})",  # noqa: S608
                    serialized,
                )
                count += 1
            except Exception:
                pass
        imported[table] = count

    db.commit()
    return {"ok": True, "imported": imported}
