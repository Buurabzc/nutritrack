from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_uid
from app.services.ai.claude_service import chat_with_tools
from app.services.ai.ollama_service import chat_ollama
from app.services.ai.openai_service import chat_openai
from app.services.ai.gemini_service import chat_gemini
from app.services.ai.deepseek_service import chat_deepseek

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    provider: str = "claude"
    model: Optional[str] = None
    include_context: bool = True


class ChatResponse(BaseModel):
    reply: str
    provider: str
    model: str
    tool_calls: list = []


def _build_messages(history: list[dict], message: str) -> list[dict]:
    msgs = []
    for h in history:
        if h.get("role") in ("user", "assistant"):
            msgs.append({"role": h["role"], "content": h["content"]})
    msgs.append({"role": "user", "content": message})
    return msgs


def _get_daily_context(uid: str) -> dict:
    from datetime import date
    from app.sqlite_db import get_db, get_config

    today = str(date.today())
    db = get_db()
    meals = [dict(r) for r in db.execute("SELECT * FROM meals WHERE date = ?", (today,)).fetchall()]
    goals = get_config("goals")
    body_row = db.execute("SELECT weight_kg FROM body_measurements ORDER BY date DESC LIMIT 1").fetchone()
    weight = body_row["weight_kg"] if body_row else None

    totals = {"calories": 0.0, "protein": 0.0}
    for m in meals:
        totals["calories"] += m.get("calories", 0)
        totals["protein"] += m.get("protein", 0)

    return {
        "daily_summary": {
            **totals,
            "goal_calories": goals.get("daily_calories", 2100),
            "goal_protein": goals.get("protein_g", 120),
        },
        "weight": weight,
    }


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, uid: str = Depends(get_uid)):
    messages = _build_messages(req.history, req.message)
    context = _get_daily_context(uid) if req.include_context else {}
    model = req.model or ""

    if req.provider == "claude":
        result = await chat_with_tools(messages, uid, model=model or None)
    elif req.provider == "ollama":
        result = await chat_ollama(messages, uid, context)
    elif req.provider == "openai":
        import os
        result = await chat_openai(messages, model or os.getenv("OPENAI_MODEL", "gpt-4o"), uid, context)
    elif req.provider == "gemini":
        import os
        result = await chat_gemini(messages, model or os.getenv("GEMINI_MODEL", "gemini-2.0-flash"), uid, context)
    elif req.provider == "deepseek":
        import os
        result = await chat_deepseek(messages, model or os.getenv("DEEPSEEK_MODEL", "deepseek-chat"), uid, context)
    else:
        result = {"reply": f"Bilinmeyen provider: {req.provider}", "provider": req.provider, "model": "", "tool_calls": []}

    return ChatResponse(
        reply=result["reply"],
        provider=result["provider"],
        model=result.get("model", ""),
        tool_calls=result.get("tool_calls", []),
    )


@router.get("/providers")
async def list_providers(uid: str = Depends(get_uid)):
    import httpx, os
    from app.services.settings_service import get_user_setting

    def get_key(key: str) -> str:
        return get_user_setting(uid, key, key)

    providers = []

    claude_key = get_key("ANTHROPIC_API_KEY")
    providers.append({
        "id": "claude",
        "label": "Claude (Anthropic)",
        "available": bool(claude_key),
        "supports_tools": True,
        "offline": False,
        "models": {
            "claude-opus-4-8":           "Claude Opus 4.8",
            "claude-sonnet-4-6":         "Claude Sonnet 4.6",
            "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
        },
        "default_model": "claude-sonnet-4-6",
    })

    openai_key = get_key("OPENAI_API_KEY")
    openai_models: dict[str, str] = {}
    openai_tools = False
    if openai_key:
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {openai_key}"})
            if r.status_code == 200:
                CHAT_PREFIXES = ("gpt-4", "gpt-3.5", "o1", "o3", "o4")
                SKIP = ("instruct", "embedding", "whisper", "tts", "dall", "babbage", "davinci", "curie", "ada")
                for m in sorted(r.json().get("data", []), key=lambda x: x["id"]):
                    mid = m["id"]
                    if any(mid.startswith(p) for p in CHAT_PREFIXES) and not any(s in mid for s in SKIP):
                        openai_models[mid] = mid
                openai_tools = any(mid.startswith("gpt-") for mid in openai_models)
        except Exception:
            pass
    if not openai_models:
        openai_models = {"gpt-4o": "gpt-4o", "gpt-4o-mini": "gpt-4o-mini"}

    providers.append({
        "id": "openai",
        "label": "OpenAI",
        "available": bool(openai_key),
        "supports_tools": openai_tools,
        "offline": False,
        "models": openai_models,
        "default_model": next(iter(m for m in openai_models if "gpt-4o" in m), next(iter(openai_models))),
    })

    google_key = get_key("GOOGLE_API_KEY")
    gemini_models: dict[str, str] = {}
    gemini_tools = False
    if google_key:
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={google_key}")
            if r.status_code == 200:
                for m in r.json().get("models", []):
                    mid = m.get("name", "").replace("models/", "")
                    if "generateContent" not in m.get("supportedGenerationMethods", []):
                        continue
                    if any(x in mid for x in ("embedding", "aqa", "vision")):
                        continue
                    label = m.get("displayName", mid)
                    gemini_models[mid] = label
                    if any(v in mid for v in ("1.5", "2.", "flash", "pro")):
                        gemini_tools = True
        except Exception:
            pass
    if not gemini_models:
        gemini_models = {"gemini-1.5-flash": "Gemini 1.5 Flash", "gemini-1.5-pro": "Gemini 1.5 Pro"}

    providers.append({
        "id": "gemini",
        "label": "Gemini (Google)",
        "available": bool(google_key),
        "supports_tools": gemini_tools,
        "offline": False,
        "models": gemini_models,
        "default_model": next((m for m in gemini_models if "flash" in m), next(iter(gemini_models))),
    })

    deepseek_key = get_key("DEEPSEEK_API_KEY")
    deepseek_models: dict[str, str] = {}
    deepseek_tools = False
    if deepseek_key:
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get("https://api.deepseek.com/v1/models", headers={"Authorization": f"Bearer {deepseek_key}"})
            if r.status_code == 200:
                for m in r.json().get("data", []):
                    mid = m["id"]
                    deepseek_models[mid] = mid
                    if "chat" in mid:
                        deepseek_tools = True
        except Exception:
            pass
    if not deepseek_models:
        deepseek_models = {"deepseek-chat": "deepseek-chat", "deepseek-reasoner": "deepseek-reasoner"}

    providers.append({
        "id": "deepseek",
        "label": "DeepSeek",
        "available": bool(deepseek_key),
        "supports_tools": deepseek_tools,
        "offline": False,
        "models": deepseek_models,
        "default_model": next((m for m in deepseek_models if "chat" in m), next(iter(deepseek_models))),
    })

    ollama_url = get_key("OLLAMA_URL") or "http://localhost:11434"
    ollama_default = get_key("OLLAMA_MODEL") or "llama3.2"
    ollama_ok = False
    ollama_models: dict[str, str] = {}
    ollama_tools = False
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{ollama_url}/api/tags")
        if r.status_code == 200:
            ollama_ok = True
            for m in r.json().get("models", []):
                mid = m["name"]
                details = m.get("details", {})
                ollama_models[mid] = mid
                if details.get("capabilities") and "tools" in details["capabilities"]:
                    ollama_tools = True
    except Exception:
        pass

    providers.append({
        "id": "ollama",
        "label": "Ollama (Yerel)",
        "available": ollama_ok,
        "supports_tools": ollama_tools,
        "offline": True,
        "models": ollama_models or {ollama_default: ollama_default},
        "default_model": ollama_default,
    })

    return providers


@router.get("/syncthing/status")
def syncthing_status(uid: str = Depends(get_uid)):
    import httpx, os
    from app.services.settings_service import get_user_setting
    url = get_user_setting(uid, "SYNCTHING_URL") or os.getenv("SYNCTHING_URL", "http://localhost:8384")
    api_key = get_user_setting(uid, "SYNCTHING_API_KEY") or os.getenv("SYNCTHING_API_KEY", "")
    try:
        headers = {"X-API-Key": api_key} if api_key else {}
        r = httpx.get(f"{url}/rest/system/ping", headers=headers, timeout=2)
        if r.status_code == 200:
            conn_r = httpx.get(f"{url}/rest/system/connections", headers=headers, timeout=2)
            connected = conn_r.status_code == 200
            return {"running": True, "connected": connected}
    except Exception:
        pass
    return {"running": False, "connected": False}
