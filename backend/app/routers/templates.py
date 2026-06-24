import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
from app.dependencies import get_uid
from app.sqlite_db import get_db

router = APIRouter()


class TemplateItemIn(BaseModel):
    food_name: str
    amount_g: float
    calories: float
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fiber: float = 0
    meal_type: str


class TemplateCreate(BaseModel):
    name: str
    items: list[TemplateItemIn]


class ApplyOptions(BaseModel):
    target_date: Optional[date] = None


@router.get("")
def list_templates(uid: str = Depends(get_uid)):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM meal_templates ORDER BY created_at DESC"
    ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["items"] = json.loads(d["items"] or "[]")
        result.append(d)
    return result


@router.post("")
def create_template(body: TemplateCreate, uid: str = Depends(get_uid)):
    items = [
        {
            "food_name": item.food_name,
            "amount_g": item.amount_g,
            "calories": round(item.calories, 1),
            "protein": round(item.protein, 1),
            "carbs": round(item.carbs, 1),
            "fat": round(item.fat, 1),
            "fiber": round(item.fiber, 1),
            "meal_type": item.meal_type,
        }
        for item in body.items
    ]
    data = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "items": json.dumps(items),
        "created_at": datetime.utcnow().isoformat(),
    }
    db = get_db()
    db.execute(
        "INSERT INTO meal_templates (id,name,items,created_at) VALUES (:id,:name,:items,:created_at)",
        data,
    )
    db.commit()
    return {"id": data["id"], "name": data["name"], "items": items, "created_at": data["created_at"]}


@router.delete("/{template_id}")
def delete_template(template_id: str, uid: str = Depends(get_uid)):
    db = get_db()
    row = db.execute("SELECT id FROM meal_templates WHERE id = ?", (template_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    db.execute("DELETE FROM meal_templates WHERE id = ?", (template_id,))
    db.commit()
    return {"ok": True}


@router.post("/{template_id}/apply")
def apply_template(template_id: str, opts: ApplyOptions = ApplyOptions(), uid: str = Depends(get_uid)):
    db = get_db()
    row = db.execute("SELECT * FROM meal_templates WHERE id = ?", (template_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    items = json.loads(row["items"] or "[]")
    d = str(opts.target_date or date.today())
    now = datetime.utcnow().isoformat()
    for item in items:
        db.execute(
            "INSERT INTO meals (id,date,meal_type,food_name,amount_g,calories,protein,carbs,fat,fiber,created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                str(uuid.uuid4()), d,
                item.get("meal_type", ""),
                item.get("food_name", ""),
                item.get("amount_g", 0),
                item.get("calories", 0),
                item.get("protein", 0),
                item.get("carbs", 0),
                item.get("fat", 0),
                item.get("fiber", 0),
                now,
            ),
        )
    db.commit()
    return {"ok": True, "added": len(items)}
