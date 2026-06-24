import json
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
from app.dependencies import get_uid
from app.sqlite_db import get_db, get_config, merge_config

router = APIRouter(prefix="/settings", tags=["settings"])

KNOWN_KEYS = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY",
    "DEEPSEEK_API_KEY",
    "SYNCTHING_URL",
    "SYNCTHING_API_KEY",
    "OLLAMA_URL",
    "OLLAMA_MODEL",
    "AI_PERSONA",
]


def _mask(value: str) -> str:
    if not value or len(value) < 8:
        return "••••••••" if value else ""
    return value[:4] + "•" * (len(value) - 8) + value[-4:]


def _get_setting_value(uid: str, key: str) -> str:
    env_val = os.getenv(key, "")
    if env_val:
        return env_val
    settings = get_config("settings")
    return settings.get(key, "")


@router.get("")
def get_settings(uid: str = Depends(get_uid)):
    result = {}
    for key in KNOWN_KEYS:
        val = _get_setting_value(uid, key)
        env_has = bool(os.getenv(key))
        result[key] = {
            "masked": _mask(val),
            "has_value": bool(val),
            "source": "env" if env_has else ("db" if val else "none"),
        }
    return result


class SettingItem(BaseModel):
    key: str
    value: str


@router.put("")
def save_setting(item: SettingItem, uid: str = Depends(get_uid)):
    if item.key not in KNOWN_KEYS:
        raise HTTPException(400, f"Unknown setting key: {item.key}")
    merge_config("settings", {item.key: item.value})
    return {"ok": True, "key": item.key}


class BulkSettings(BaseModel):
    settings: dict[str, str]


@router.put("/bulk")
def save_bulk(body: BulkSettings, uid: str = Depends(get_uid)):
    valid = {k: v for k, v in body.settings.items() if k in KNOWN_KEYS}
    if valid:
        merge_config("settings", valid)
    return {"ok": True, "saved": list(valid.keys())}


@router.post("/test/{provider}")
async def test_provider(provider: str, uid: str = Depends(get_uid)):
    def get_key(key: str) -> str:
        return _get_setting_value(uid, key)

    if provider == "claude":
        key = get_key("ANTHROPIC_API_KEY")
        if not key:
            return {"ok": False, "error": "API key yok"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={"model": "claude-haiku-4-5-20251001", "max_tokens": 10, "messages": [{"role": "user", "content": "hi"}]},
                )
            return {"ok": r.status_code == 200, "status": r.status_code}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif provider == "openai":
        key = get_key("OPENAI_API_KEY")
        if not key:
            return {"ok": False, "error": "API key yok"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {key}"})
            return {"ok": r.status_code == 200, "status": r.status_code}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif provider == "gemini":
        key = get_key("GOOGLE_API_KEY")
        if not key:
            return {"ok": False, "error": "API key yok"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
            return {"ok": r.status_code == 200, "status": r.status_code}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif provider == "deepseek":
        key = get_key("DEEPSEEK_API_KEY")
        if not key:
            return {"ok": False, "error": "API key yok"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get("https://api.deepseek.com/models", headers={"Authorization": f"Bearer {key}"})
            return {"ok": r.status_code == 200, "status": r.status_code}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif provider == "ollama":
        url = get_key("OLLAMA_URL") or "http://localhost:11434"
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{url}/api/tags")
            data = r.json() if r.status_code == 200 else {}
            return {"ok": r.status_code == 200, "models": [m["name"] for m in data.get("models", [])]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif provider == "syncthing":
        url = get_key("SYNCTHING_URL") or "http://127.0.0.1:8384"
        api_key = get_key("SYNCTHING_API_KEY")
        try:
            headers = {"X-API-Key": api_key} if api_key else {}
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{url}/rest/system/ping", headers=headers)
            return {"ok": r.status_code == 200}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    return {"ok": False, "error": f"Bilinmeyen provider: {provider}"}


@router.get("/personas")
def list_personas(uid: str = Depends(get_uid)):
    from app.services.ai.persona import PERSONAS
    current = _get_setting_value(uid, "AI_PERSONA") or "coach"
    return {"current": current, "personas": PERSONAS}


class DeleteDataRequest(BaseModel):
    targets: list[str]


@router.delete("/data")
def delete_user_data(req: DeleteDataRequest, uid: str = Depends(get_uid)):
    db = get_db()
    deleted = {}
    if "meals" in req.targets:
        cur = db.execute("DELETE FROM meals")
        deleted["meals"] = cur.rowcount
        cur2 = db.execute("DELETE FROM water_intake")
        deleted["water"] = cur2.rowcount
    if "body" in req.targets:
        cur = db.execute("DELETE FROM body_measurements")
        deleted["body"] = cur.rowcount
    if "chat" in req.targets:
        cur = db.execute("DELETE FROM chat_sessions")
        deleted["chat_sessions"] = cur.rowcount
        db.execute("DELETE FROM chat_messages")
    db.commit()
    return {"deleted": deleted}
