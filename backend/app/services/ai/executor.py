import uuid
from datetime import date, datetime
from app.sqlite_db import get_db, get_config, merge_config


async def execute_tool(tool_name: str, tool_input: dict, uid: str) -> dict:
    if tool_name == "log_meal":
        return await _log_meal(tool_input)
    elif tool_name == "delete_meal":
        return await _delete_meal(tool_input)
    elif tool_name == "get_today_summary":
        return await _get_today_summary()
    elif tool_name == "get_weekly_summary":
        return await _get_weekly_summary()
    elif tool_name == "log_water":
        return await _log_water(tool_input)
    elif tool_name == "log_body_measurement":
        return await _log_body(tool_input)
    elif tool_name == "search_food":
        return await _search_food(tool_input)
    elif tool_name == "update_goals":
        return await _update_goals(tool_input)
    elif tool_name == "log_exercise":
        return await _log_exercise(tool_input)
    elif tool_name == "start_fast":
        return await _start_fast(tool_input)
    elif tool_name == "end_fast":
        return await _end_fast(tool_input)
    else:
        return {"error": f"Bilinmeyen tool: {tool_name}"}


async def _log_meal(inp: dict) -> dict:
    data = {
        "id": str(uuid.uuid4()),
        "date": str(date.today()),
        "meal_type": inp["meal_type"],
        "food_name": inp["food_name"],
        "food_id": None,
        "amount_g": inp["amount_g"],
        "calories": round(inp["calories"], 1),
        "protein": round(inp.get("protein", 0), 1),
        "carbs": round(inp.get("carbs", 0), 1),
        "fat": round(inp.get("fat", 0), 1),
        "fiber": round(inp.get("fiber", 0), 1),
        "created_at": datetime.utcnow().isoformat(),
    }
    db = get_db()
    db.execute(
        "INSERT INTO meals (id,date,meal_type,food_name,food_id,amount_g,calories,protein,carbs,fat,fiber,created_at)"
        " VALUES (:id,:date,:meal_type,:food_name,:food_id,:amount_g,:calories,:protein,:carbs,:fat,:fiber,:created_at)",
        data,
    )
    db.commit()
    return {
        "success": True,
        "id": data["id"],
        "food_name": data["food_name"],
        "meal_type": data["meal_type"],
        "amount_g": data["amount_g"],
        "calories": data["calories"],
        "protein": data["protein"],
        "carbs": data["carbs"],
        "fat": data["fat"],
    }


async def _delete_meal(inp: dict) -> dict:
    meal_id = str(inp["meal_id"])
    db = get_db()
    row = db.execute("SELECT food_name FROM meals WHERE id = ?", (meal_id,)).fetchone()
    if not row:
        return {"success": False, "error": "Kayıt bulunamadı"}
    name = row["food_name"]
    db.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
    db.commit()
    return {"success": True, "deleted": name}


async def _get_today_summary() -> dict:
    today = str(date.today())
    db = get_db()
    meals = [dict(r) for r in db.execute("SELECT * FROM meals WHERE date = ?", (today,)).fetchall()]
    water = [dict(r) for r in db.execute("SELECT * FROM water_intake WHERE date = ?", (today,)).fetchall()]
    goals = get_config("goals")

    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0}
    meal_list = []
    for m in meals:
        for k in totals:
            totals[k] += m.get(k, 0)
        meal_list.append({
            "id": m.get("id", ""),
            "meal_type": m.get("meal_type", ""),
            "food_name": m.get("food_name", ""),
            "amount_g": m.get("amount_g", 0),
            "calories": m.get("calories", 0),
            "protein": m.get("protein", 0),
        })

    water_ml = sum(w.get("amount_ml", 0) for w in water)
    return {
        "date": today,
        "totals": {k: round(v, 1) for k, v in totals.items()},
        "remaining_calories": round(goals.get("daily_calories", 2100) - totals["calories"], 1),
        "water_ml": water_ml,
        "meals": meal_list,
        "goals": {
            "calories": goals.get("daily_calories", 2100),
            "protein_g": goals.get("protein_g", 120),
            "carbs_g": goals.get("carbs_g", 240),
            "fat_g": goals.get("fat_g", 70),
            "water_ml": goals.get("water_ml", 2500),
        },
    }


async def _get_weekly_summary() -> dict:
    from datetime import timedelta
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    db = get_db()
    days = []
    for i in range(7):
        d = monday + timedelta(days=i)
        d_str = str(d)
        rows = db.execute("SELECT calories FROM meals WHERE date = ?", (d_str,)).fetchall()
        kcal = round(sum(r["calories"] or 0 for r in rows), 1)
        days.append({"date": d_str, "calories": kcal, "meal_count": len(rows)})
    return {"week_start": str(monday), "days": days}


async def _log_water(inp: dict) -> dict:
    today = str(date.today())
    data = {
        "id": str(uuid.uuid4()),
        "date": today,
        "amount_ml": inp["amount_ml"],
        "logged_at": datetime.utcnow().isoformat(),
    }
    db = get_db()
    db.execute(
        "INSERT INTO water_intake (id,date,amount_ml,logged_at) VALUES (:id,:date,:amount_ml,:logged_at)",
        data,
    )
    db.commit()
    total = db.execute("SELECT SUM(amount_ml) as t FROM water_intake WHERE date = ?", (today,)).fetchone()["t"] or 0
    goals = get_config("goals")
    return {
        "success": True,
        "added_ml": inp["amount_ml"],
        "total_today_ml": total,
        "target_ml": goals.get("water_ml", 2500),
    }


async def _log_body(inp: dict) -> dict:
    bmi = None
    if inp.get("weight_kg"):
        profile = get_config("profile")
        h_cm = profile.get("height_cm")
        if h_cm:
            h = h_cm / 100
            bmi = round(inp["weight_kg"] / (h * h), 1)

    data = {
        "id": str(uuid.uuid4()),
        "date": str(date.today()),
        "weight_kg": inp.get("weight_kg"),
        "waist_cm": inp.get("waist_cm"),
        "body_fat_pct": inp.get("body_fat_pct"),
        "hip_cm": None,
        "chest_cm": None,
        "note": inp.get("note"),
        "bmi": bmi,
        "logged_at": datetime.utcnow().isoformat(),
    }
    db = get_db()
    db.execute(
        "INSERT INTO body_measurements (id,date,weight_kg,body_fat_pct,waist_cm,hip_cm,chest_cm,bmi,note,logged_at)"
        " VALUES (:id,:date,:weight_kg,:body_fat_pct,:waist_cm,:hip_cm,:chest_cm,:bmi,:note,:logged_at)",
        data,
    )
    db.commit()
    return {"success": True, "bmi": bmi, **{k: v for k, v in inp.items() if v is not None}}


async def _search_food(inp: dict) -> dict:
    import os
    import json as _json
    data_path = os.path.join(os.path.dirname(__file__), "../../../data/foods_tr.json")
    with open(os.path.abspath(data_path), encoding="utf-8") as f:
        foods = _json.load(f)
    q = inp["query"].lower()
    results = [f for f in foods if q in f["name"].lower()][:5]
    if not results:
        return {"found": False, "query": inp["query"], "message": "Veritabanında bulunamadı, bilgini kullan."}
    return {"found": True, "results": results}


async def _update_goals(inp: dict) -> dict:
    updates = {k: v for k, v in inp.items() if v is not None}
    merge_config("goals", updates)
    return {"success": True, "updated": updates}


async def _log_exercise(inp: dict) -> dict:
    data = {
        "id": str(uuid.uuid4()),
        "date": str(date.today()),
        "exercise_name": inp["exercise_name"],
        "category": inp.get("category", "other"),
        "duration_min": inp["duration_min"],
        "calories_burned": round(inp.get("calories_burned", 0), 1),
        "logged_at": datetime.utcnow().isoformat(),
    }
    db = get_db()
    db.execute(
        "INSERT INTO exercise_logs (id,date,exercise_name,category,duration_min,calories_burned,logged_at)"
        " VALUES (:id,:date,:exercise_name,:category,:duration_min,:calories_burned,:logged_at)",
        data,
    )
    db.commit()
    return {
        "success": True,
        "id": data["id"],
        "exercise_name": data["exercise_name"],
        "category": data["category"],
        "duration_min": data["duration_min"],
        "calories_burned": data["calories_burned"],
    }


async def _start_fast(inp: dict) -> dict:
    db = get_db()
    existing = db.execute(
        "SELECT id FROM fasting_sessions WHERE status = 'active' LIMIT 1"
    ).fetchone()
    if existing:
        return {"success": False, "error": "Zaten aktif bir oruç var. Önce mevcut orucu bitir."}
    data = {
        "id": str(uuid.uuid4()),
        "protocol": inp["protocol"],
        "target_hours": inp["target_hours"],
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
    return {
        "success": True,
        "protocol": data["protocol"],
        "target_hours": data["target_hours"],
        "started_at": data["started_at"],
    }


async def _end_fast(inp: dict) -> dict:
    db = get_db()
    row = db.execute(
        "SELECT * FROM fasting_sessions WHERE status = 'active' LIMIT 1"
    ).fetchone()
    if not row:
        return {"success": False, "error": "Aktif oruç bulunamadı."}
    d = dict(row)
    now = datetime.utcnow()
    started = datetime.fromisoformat(d["started_at"]) if d.get("started_at") else now
    elapsed = round((now - started).total_seconds() / 3600, 2)
    db.execute(
        "UPDATE fasting_sessions SET status = ?, ended_at = ? WHERE id = ?",
        (inp["status"], now.isoformat(), d["id"]),
    )
    db.commit()
    return {
        "success": True,
        "status": inp["status"],
        "elapsed_hours": elapsed,
        "target_hours": d.get("target_hours"),
        "completed": elapsed >= (d.get("target_hours") or 0),
    }
