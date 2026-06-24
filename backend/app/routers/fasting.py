import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from app.dependencies import get_uid
from app.sqlite_db import get_db

router = APIRouter()


class FastingStart(BaseModel):
    protocol: str
    target_hours: float


class FastingEnd(BaseModel):
    status: str  # "completed" | "broken"


def _serialize(row: dict) -> dict:
    started_at = row.get("started_at")
    ended_at = row.get("ended_at")
    elapsed = None
    if started_at:
        start_dt = datetime.fromisoformat(started_at)
        end_dt = datetime.fromisoformat(ended_at) if ended_at else datetime.utcnow()
        elapsed = round((end_dt - start_dt).total_seconds() / 3600, 2)
    return {
        "id": row.get("id"),
        "protocol": row.get("protocol"),
        "target_hours": row.get("target_hours"),
        "started_at": started_at,
        "ended_at": ended_at,
        "status": row.get("status"),
        "elapsed_hours": elapsed,
    }


@router.get("/active")
def get_active(uid: str = Depends(get_uid)):
    db = get_db()
    row = db.execute(
        "SELECT * FROM fasting_sessions WHERE status = 'active' LIMIT 1"
    ).fetchone()
    return _serialize(dict(row)) if row else None


@router.post("")
def start_fasting(body: FastingStart, uid: str = Depends(get_uid)):
    db = get_db()
    existing = db.execute(
        "SELECT id FROM fasting_sessions WHERE status = 'active' LIMIT 1"
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Zaten aktif bir oruç var")
    data = {
        "id": str(uuid.uuid4()),
        "protocol": body.protocol,
        "target_hours": body.target_hours,
        "started_at": datetime.utcnow().isoformat(),
        "ended_at": None,
        "status": "active",
    }
    db.execute(
        "INSERT INTO fasting_sessions (id,protocol,target_hours,started_at,ended_at,status)"
        " VALUES (:id,:protocol,:target_hours,:started_at,:ended_at,:status)",
        data,
    )
    db.commit()
    return _serialize(data)


@router.put("/active")
def end_fasting(body: FastingEnd, uid: str = Depends(get_uid)):
    if body.status not in ("completed", "broken"):
        raise HTTPException(status_code=400, detail="Geçersiz durum")
    db = get_db()
    row = db.execute(
        "SELECT * FROM fasting_sessions WHERE status = 'active' LIMIT 1"
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Aktif oruç bulunamadı")
    now = datetime.utcnow().isoformat()
    db.execute(
        "UPDATE fasting_sessions SET status = ?, ended_at = ? WHERE id = ?",
        (body.status, now, row["id"]),
    )
    db.commit()
    return _serialize({**dict(row), "status": body.status, "ended_at": now})


@router.get("/history")
def fasting_history(limit: int = 30, uid: str = Depends(get_uid)):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM fasting_sessions WHERE status IN ('completed','broken')"
        " ORDER BY started_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [_serialize(dict(r)) for r in rows]
