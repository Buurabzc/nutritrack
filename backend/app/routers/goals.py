from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_uid
from app.sqlite_db import get_config, set_config, merge_config

router = APIRouter()

GOALS_DEFAULTS = {
    "daily_calories": 2100,
    "protein_g": 120,
    "carbs_g": 240,
    "fat_g": 70,
    "fiber_g": 30,
    "water_ml": 2500,
}


class GoalsUpdate(BaseModel):
    daily_calories: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    fat_g: Optional[int] = None
    fiber_g: Optional[int] = None
    water_ml: Optional[int] = None


class ProfileUpdate(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    current_weight_kg: Optional[float] = None
    target_weight_kg: Optional[float] = None
    goal_mode: Optional[str] = None
    activity_level: Optional[str] = None
    weekly_change_kg: Optional[float] = None


@router.get("")
def get_goals(uid: str = Depends(get_uid)):
    data = get_config("goals")
    return {**GOALS_DEFAULTS, **data}


@router.put("")
def update_goals(data: GoalsUpdate, uid: str = Depends(get_uid)):
    updates = data.model_dump(exclude_none=True)
    result = merge_config("goals", updates)
    return {**GOALS_DEFAULTS, **result}


@router.get("/profile")
def get_profile(uid: str = Depends(get_uid)):
    return get_config("profile")


@router.put("/profile")
def update_profile(data: ProfileUpdate, uid: str = Depends(get_uid)):
    profile = merge_config("profile", data.model_dump(exclude_none=True))

    w = profile.get("current_weight_kg")
    h = profile.get("height_cm")
    a = profile.get("age")
    g = profile.get("gender")
    if w and h and a and g:
        if g == "erkek":
            bmr = 10 * w + 6.25 * h - 5 * a + 5
        else:
            bmr = 10 * w + 6.25 * h - 5 * a - 161

        multipliers = {"sedanter": 1.2, "hafif": 1.375, "moderate": 1.55, "aktif": 1.725, "cok_aktif": 1.9}
        mult = multipliers.get(profile.get("activity_level", "moderate"), 1.55)
        profile["bmr"] = round(bmr, 0)
        profile["tdee"] = round(bmr * mult, 0)

        goal_mode = profile.get("goal_mode", "maintain")
        if goal_mode == "lose":
            profile["target_calories"] = int(profile["tdee"] - 500)
        elif goal_mode == "gain":
            profile["target_calories"] = int(profile["tdee"] + 300)
        else:
            profile["target_calories"] = int(profile["tdee"])

        set_config("profile", profile)

    return profile
