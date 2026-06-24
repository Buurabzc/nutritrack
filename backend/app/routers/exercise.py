import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import date, datetime, timedelta
from typing import Optional
from app.dependencies import get_uid
from app.sqlite_db import get_db

router = APIRouter()


class ExerciseCreate(BaseModel):
    exercise_name: str
    category: str = "other"
    duration_min: float
    calories_burned: float = 0
    date: Optional[date] = None


@router.get("")
def get_exercises(target_date: Optional[date] = None, uid: str = Depends(get_uid)):
    d = str(target_date or date.today())
    db = get_db()
    rows = db.execute(
        "SELECT * FROM exercise_logs WHERE date = ? ORDER BY logged_at", (d,)
    ).fetchall()
    return [dict(r) for r in rows]


@router.get("/summary/today")
def today_summary(uid: str = Depends(get_uid)):
    today = str(date.today())
    db = get_db()
    entries = [dict(r) for r in db.execute(
        "SELECT * FROM exercise_logs WHERE date = ?", (today,)
    ).fetchall()]
    return {
        "date": today,
        "calories_burned": round(sum(e.get("calories_burned", 0) for e in entries), 1),
        "total_duration_min": round(sum(e.get("duration_min", 0) for e in entries), 1),
        "entry_count": len(entries),
    }


@router.get("/summary/weekly")
def weekly_summary(uid: str = Depends(get_uid)):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    db = get_db()
    rows = db.execute(
        "SELECT date, calories_burned, duration_min FROM exercise_logs WHERE date >= ? AND date <= ?",
        (str(monday), str(sunday)),
    ).fetchall()

    by_date: dict = {}
    for r in rows:
        d_str = r["date"]
        agg = by_date.setdefault(d_str, {"calories_burned": 0.0, "duration_min": 0.0, "entry_count": 0})
        agg["calories_burned"] += r["calories_burned"] or 0
        agg["duration_min"] += r["duration_min"] or 0
        agg["entry_count"] += 1

    days = []
    for i in range(7):
        d_str = str(monday + timedelta(days=i))
        agg = by_date.get(d_str, {"calories_burned": 0.0, "duration_min": 0.0, "entry_count": 0})
        days.append({
            "date": d_str,
            "calories_burned": round(agg["calories_burned"], 1),
            "total_duration_min": round(agg["duration_min"], 1),
            "entry_count": agg["entry_count"],
        })
    return days


@router.post("")
def add_exercise(ex: ExerciseCreate, uid: str = Depends(get_uid)):
    data = {
        "id": str(uuid.uuid4()),
        "exercise_name": ex.exercise_name,
        "category": ex.category,
        "duration_min": ex.duration_min,
        "calories_burned": round(ex.calories_burned, 1),
        "date": str(ex.date or date.today()),
        "logged_at": datetime.utcnow().isoformat(),
    }
    db = get_db()
    db.execute(
        "INSERT INTO exercise_logs (id,date,exercise_name,category,duration_min,calories_burned,logged_at)"
        " VALUES (:id,:date,:exercise_name,:category,:duration_min,:calories_burned,:logged_at)",
        data,
    )
    db.commit()
    return data


@router.delete("/{entry_id}")
def delete_exercise(entry_id: str, uid: str = Depends(get_uid)):
    db = get_db()
    db.execute("DELETE FROM exercise_logs WHERE id = ?", (entry_id,))
    db.commit()
    return {"ok": True}
