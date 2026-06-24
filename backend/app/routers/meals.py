import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import date, datetime, timedelta
from typing import Optional
from app.dependencies import get_uid
from app.sqlite_db import get_db

router = APIRouter()


class MealCreate(BaseModel):
    date: Optional[date] = None
    meal_type: str
    food_name: str
    food_id: Optional[str] = None
    amount_g: float
    calories: float
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fiber: float = 0


class WaterCreate(BaseModel):
    date: Optional[date] = None
    amount_ml: int


@router.get("")
def get_meals(target_date: Optional[date] = None, uid: str = Depends(get_uid)):
    d = str(target_date or date.today())
    db = get_db()
    rows = db.execute(
        "SELECT * FROM meals WHERE date = ? ORDER BY created_at",
        (d,),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("")
def add_meal(meal: MealCreate, uid: str = Depends(get_uid)):
    data = {
        "id": str(uuid.uuid4()),
        "date": str(meal.date or date.today()),
        "meal_type": meal.meal_type,
        "food_name": meal.food_name,
        "food_id": meal.food_id,
        "amount_g": meal.amount_g,
        "calories": round(meal.calories, 1),
        "protein": round(meal.protein, 1),
        "carbs": round(meal.carbs, 1),
        "fat": round(meal.fat, 1),
        "fiber": round(meal.fiber, 1),
        "created_at": datetime.utcnow().isoformat(),
    }
    db = get_db()
    db.execute(
        "INSERT INTO meals (id,date,meal_type,food_name,food_id,amount_g,calories,protein,carbs,fat,fiber,created_at)"
        " VALUES (:id,:date,:meal_type,:food_name,:food_id,:amount_g,:calories,:protein,:carbs,:fat,:fiber,:created_at)",
        data,
    )
    db.commit()
    return data


@router.delete("/{meal_id}")
def delete_meal(meal_id: str, uid: str = Depends(get_uid)):
    db = get_db()
    db.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
    db.commit()
    return {"ok": True}


@router.get("/summary/today")
def today_summary(uid: str = Depends(get_uid)):
    from app.sqlite_db import get_config
    today = str(date.today())
    db = get_db()

    meals = [dict(r) for r in db.execute("SELECT * FROM meals WHERE date = ?", (today,)).fetchall()]
    water = [dict(r) for r in db.execute("SELECT * FROM water_intake WHERE date = ?", (today,)).fetchall()]
    exercises = [dict(r) for r in db.execute("SELECT * FROM exercise_logs WHERE date = ?", (today,)).fetchall()]
    goals = get_config("goals")

    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0}
    for m in meals:
        for k in totals:
            totals[k] += m.get(k, 0)

    water_ml = sum(w.get("amount_ml", 0) for w in water)
    calories_burned = round(sum(e.get("calories_burned", 0) for e in exercises), 1)

    by_type: dict = {}
    type_first_time: dict = {}
    for m in sorted(meals, key=lambda x: x.get("created_at", "")):
        mt = m.get("meal_type", "")
        by_type.setdefault(mt, []).append({
            "id": m.get("id", ""),
            "food_name": m.get("food_name", ""),
            "amount_g": m.get("amount_g", 0),
            "calories": m.get("calories", 0),
            "protein": m.get("protein", 0),
            "carbs": m.get("carbs", 0),
            "fat": m.get("fat", 0),
        })
        if mt not in type_first_time and m.get("created_at"):
            try:
                type_first_time[mt] = m["created_at"][11:16]
            except Exception:
                pass

    return {
        "date": today,
        "totals": {k: round(v, 1) for k, v in totals.items()},
        "calories_burned": calories_burned,
        "water_ml": water_ml,
        "meals_by_type": by_type,
        "meal_times": type_first_time,
        "goals": {
            "calories": goals.get("daily_calories", 2100),
            "protein_g": goals.get("protein_g", 120),
            "carbs_g": goals.get("carbs_g", 240),
            "fat_g": goals.get("fat_g", 70),
            "fiber_g": goals.get("fiber_g", 30),
            "water_ml": goals.get("water_ml", 2500),
        },
    }


@router.get("/summary/weekly")
def weekly_summary(uid: str = Depends(get_uid)):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    db = get_db()
    rows = db.execute(
        "SELECT date, calories FROM meals WHERE date >= ? AND date <= ?",
        (str(monday), str(sunday)),
    ).fetchall()

    by_date: dict = {}
    for r in rows:
        d_str = r["date"]
        agg = by_date.setdefault(d_str, {"calories": 0.0, "meal_count": 0})
        agg["calories"] += r["calories"] or 0
        agg["meal_count"] += 1

    days = []
    for i in range(7):
        d_str = str(monday + timedelta(days=i))
        agg = by_date.get(d_str, {"calories": 0.0, "meal_count": 0})
        days.append({"date": d_str, "calories": round(agg["calories"], 1), "meal_count": agg["meal_count"]})
    return days


@router.get("/streak")
def get_streak(uid: str = Depends(get_uid)):
    db = get_db()
    rows = db.execute(
        "SELECT DISTINCT date FROM meals ORDER BY date DESC LIMIT 400"
    ).fetchall()
    meal_dates = [r["date"] for r in rows]
    streak, d = 0, date.today()
    for date_str in meal_dates:
        if date_str == str(d):
            streak += 1
            d -= timedelta(days=1)
        elif date_str < str(d):
            break
    return {"streak": streak}


@router.post("/water")
def log_water(w: WaterCreate, uid: str = Depends(get_uid)):
    data = {
        "id": str(uuid.uuid4()),
        "date": str(w.date or date.today()),
        "amount_ml": w.amount_ml,
        "logged_at": datetime.utcnow().isoformat(),
    }
    db = get_db()
    db.execute(
        "INSERT INTO water_intake (id,date,amount_ml,logged_at) VALUES (:id,:date,:amount_ml,:logged_at)",
        data,
    )
    db.commit()
    return data


@router.get("/water/today")
def water_today(uid: str = Depends(get_uid)):
    today = str(date.today())
    db = get_db()
    entries = [dict(r) for r in db.execute(
        "SELECT * FROM water_intake WHERE date = ?", (today,)
    ).fetchall()]
    total = sum(e.get("amount_ml", 0) for e in entries)
    return {"date": today, "total_ml": total, "entries": entries}
