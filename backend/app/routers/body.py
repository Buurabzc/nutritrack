import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import date as Date, datetime
from typing import Optional
from app.dependencies import get_uid
from app.sqlite_db import get_db, get_config

router = APIRouter()


class BodyCreate(BaseModel):
    date: Optional[Date] = None
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    waist_cm: Optional[float] = None
    hip_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    note: Optional[str] = None


@router.get("")
def list_measurements(limit: int = 90, uid: str = Depends(get_uid)):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM body_measurements ORDER BY date LIMIT ?", (limit,)
    ).fetchall()
    return [dict(r) for r in rows]


@router.get("/latest")
def latest_measurement(uid: str = Depends(get_uid)):
    db = get_db()
    row = db.execute(
        "SELECT * FROM body_measurements ORDER BY date DESC LIMIT 1"
    ).fetchone()
    return dict(row) if row else None


@router.post("")
def add_measurement(body: BodyCreate, uid: str = Depends(get_uid)):
    bmi = None
    if body.weight_kg and body.weight_kg > 0:
        profile = get_config("profile")
        h_cm = profile.get("height_cm")
        if h_cm:
            h = h_cm / 100
            bmi = round(body.weight_kg / (h * h), 1)

    data = {
        "id": str(uuid.uuid4()),
        "date": str(body.date or Date.today()),
        "weight_kg": body.weight_kg,
        "body_fat_pct": body.body_fat_pct,
        "waist_cm": body.waist_cm,
        "hip_cm": body.hip_cm,
        "chest_cm": body.chest_cm,
        "bmi": bmi,
        "note": body.note,
        "logged_at": datetime.utcnow().isoformat(),
    }
    db = get_db()
    db.execute(
        "INSERT INTO body_measurements"
        " (id,date,weight_kg,body_fat_pct,waist_cm,hip_cm,chest_cm,bmi,note,logged_at)"
        " VALUES (:id,:date,:weight_kg,:body_fat_pct,:waist_cm,:hip_cm,:chest_cm,:bmi,:note,:logged_at)",
        data,
    )
    db.commit()
    return data


@router.delete("/{entry_id}")
def delete_measurement(entry_id: str, uid: str = Depends(get_uid)):
    db = get_db()
    db.execute("DELETE FROM body_measurements WHERE id = ?", (entry_id,))
    db.commit()
    return {"ok": True}
