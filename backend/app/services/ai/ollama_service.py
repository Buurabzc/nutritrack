"""
Ollama servisi — model tool-calling destekliyorsa agentic döngü çalıştırır,
desteklemiyorsa düz sohbet moduna düşer (ve buna göre dürüst bir sistem promptu kullanır).
"""
import json
import os
import httpx
from app.services.ai.persona import get_system_prompt
from app.services.ai.tools import to_openai_tools
from app.services.ai.executor import execute_tool


async def _model_supports_tools(url: str, model: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{url}/api/tags")
        if r.status_code != 200:
            return False
        for m in r.json().get("models", []):
            if m.get("name") == model:
                caps = (m.get("details", {}) or {}).get("capabilities") or []
                return "tools" in caps
    except Exception:
        pass
    return False


async def chat_ollama(messages: list[dict], uid: str = "", context: dict | None = None) -> dict:
    from app.services.settings_service import get_user_setting
    url = (get_user_setting(uid, "OLLAMA_URL") if uid else None) or os.getenv("OLLAMA_URL", "http://localhost:11434")
    model = (get_user_setting(uid, "OLLAMA_MODEL") if uid else None) or os.getenv("OLLAMA_MODEL", "qwen3:8b")

    conversation = list(messages)
    if context and conversation:
        ctx_str = _build_context(context)
        last = conversation[-1]
        if last["role"] == "user":
            conversation[-1] = {"role": "user", "content": f"{ctx_str}\n\n{last['content']}"}

    use_tools = await _model_supports_tools(url, model)
    tool_calls_log: list = []

    for _ in range(5):
        ollama_msgs = [{"role": "system", "content": get_system_prompt(uid, tools_enabled=use_tools)}] + conversation
        payload = {"model": model, "messages": ollama_msgs, "stream": False}
        if use_tools:
            payload["tools"] = to_openai_tools()

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(f"{url}/api/chat", json=payload)
            data = resp.json()
        except Exception as e:
            return {"reply": f"Ollama bağlantı hatası: {e}", "provider": "ollama", "model": model, "tool_calls": tool_calls_log}

        if resp.status_code != 200:
            err_msg = data.get("error", str(data)) if isinstance(data, dict) else str(data)
            return {"reply": f"Ollama hatası: {err_msg}", "provider": "ollama", "model": model, "tool_calls": tool_calls_log}

        message = data.get("message", {})
        tool_calls = message.get("tool_calls")

        if not tool_calls:
            return {"reply": message.get("content", ""), "provider": "ollama", "model": model, "tool_calls": tool_calls_log}

        conversation.append(message)
        for call in tool_calls:
            fn = call.get("function", {})
            args = fn.get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            result = await execute_tool(fn.get("name", ""), args, uid)
            tool_calls_log.append({"tool": fn.get("name", ""), "input": args, "result": result})
            conversation.append({"role": "tool", "content": json.dumps(result, ensure_ascii=False)})

    return {"reply": "İşlemi tamamlayamadım.", "provider": "ollama", "model": model, "tool_calls": tool_calls_log}


def _build_context(context: dict) -> str:
    parts = []
    if s := context.get("daily_summary"):
        parts.append(
            f"[Bugün: {s.get('calories', 0):.0f}/{s.get('goal_calories', 2100):.0f} kcal, "
            f"protein {s.get('protein', 0):.0f}/{s.get('goal_protein', 120):.0f}g]"
        )
    if w := context.get("weight"):
        parts.append(f"[Ağırlık: {w} kg]")
    return " ".join(parts)
