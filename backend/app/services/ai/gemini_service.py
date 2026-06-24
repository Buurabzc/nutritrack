import asyncio
import os
import httpx
from app.services.ai.persona import get_system_prompt
from app.services.ai.tools import to_gemini_tools
from app.services.ai.executor import execute_tool


async def chat_gemini(messages: list[dict], model: str, uid: str = "", context: dict | None = None) -> dict:
    from app.services.settings_service import get_user_setting
    api_key = get_user_setting(uid, "GOOGLE_API_KEY", "GOOGLE_API_KEY") if uid else os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        return {"reply": "Google API key tanımlı değil. Ayarlar sayfasından ekleyebilirsiniz.", "provider": "gemini", "model": model, "tool_calls": []}

    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    if context and contents:
        ctx = _build_context(context)
        if ctx:
            last = contents[-1]
            if last["role"] == "user":
                contents[-1] = {"role": "user", "parts": [{"text": f"{ctx}\n\n{last['parts'][0]['text']}"}]}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    tool_calls_log: list = []

    for _ in range(5):
        payload = {
            "system_instruction": {"parts": [{"text": get_system_prompt(uid)}]},
            "contents": contents,
            "tools": to_gemini_tools(),
            "generationConfig": {"maxOutputTokens": 1024},
        }

        resp, data = None, {}
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.post(url, json=payload)
                data = resp.json()
                if resp.status_code not in (429, 503):
                    break
                await asyncio.sleep((attempt + 1) * 4)
            except Exception as e:
                return {"reply": f"Gemini bağlantı hatası: {e}", "provider": "gemini", "model": model, "tool_calls": tool_calls_log}

        if resp.status_code != 200:
            err = data.get("error", {})
            return {"reply": f"Gemini API hatası ({resp.status_code}): {err.get('message', str(data))}", "provider": "gemini", "model": model, "tool_calls": tool_calls_log}

        feedback = data.get("promptFeedback", {})
        if feedback.get("blockReason"):
            return {"reply": f"Gemini içeriği engelledi: {feedback['blockReason']}", "provider": "gemini", "model": model, "tool_calls": tool_calls_log}

        candidates = data.get("candidates", [])
        if not candidates:
            return {"reply": "Gemini yanıt üretemedi (boş candidates).", "provider": "gemini", "model": model, "tool_calls": tool_calls_log}

        candidate = candidates[0]
        finish = candidate.get("finishReason", "")
        if finish in ("SAFETY", "RECITATION", "OTHER"):
            return {"reply": f"Gemini yanıtı durdurdu: {finish}", "provider": "gemini", "model": model, "tool_calls": tool_calls_log}

        parts = candidate.get("content", {}).get("parts", [])
        function_calls = [p["functionCall"] for p in parts if "functionCall" in p]

        if not function_calls:
            text = "".join(p.get("text", "") for p in parts)
            return {"reply": text or "Boş yanıt.", "provider": "gemini", "model": model, "tool_calls": tool_calls_log}

        contents.append({"role": "model", "parts": parts})
        response_parts = []
        for fc in function_calls:
            fname = fc.get("name", "")
            fargs = fc.get("args", {}) or {}
            result = await execute_tool(fname, fargs, uid)
            tool_calls_log.append({"tool": fname, "input": fargs, "result": result})
            response_parts.append({
                "functionResponse": {"name": fname, "response": {"content": result}},
            })
        contents.append({"role": "function", "parts": response_parts})

    return {"reply": "İşlemi tamamlayamadım.", "provider": "gemini", "model": model, "tool_calls": tool_calls_log}


def _build_context(context: dict) -> str:
    parts = []
    if s := context.get("daily_summary"):
        parts.append(f"[Bugün: {s.get('calories', 0):.0f}/{s.get('goal_calories', 2100):.0f} kcal]")
    return " ".join(parts)
