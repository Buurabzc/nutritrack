import os
from app.services.ai.persona import get_system_prompt
from app.services.ai.openai_compat import run_tool_loop


async def chat_openai(messages: list[dict], model: str, uid: str = "", context: dict | None = None) -> dict:
    from app.services.settings_service import get_user_setting
    api_key = get_user_setting(uid, "OPENAI_API_KEY", "OPENAI_API_KEY") if uid else os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return {"reply": "OpenAI API key tanımlı değil. Ayarlar sayfasından ekleyebilirsiniz.", "provider": "openai", "model": model, "tool_calls": []}

    oai_messages = [{"role": "system", "content": get_system_prompt(uid)}]
    oai_messages += _with_context(messages, context)

    result = await run_tool_loop(
        url="https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        model=model, messages=oai_messages, uid=uid,
    )
    return {"reply": result["reply"], "provider": "openai", "model": model, "tool_calls": result["tool_calls"]}


def _with_context(messages: list[dict], context: dict | None) -> list[dict]:
    if not context:
        return list(messages)
    ctx = _build_context(context)
    if not ctx or not messages:
        return list(messages)
    msgs = list(messages)
    last = msgs[-1]
    if last["role"] == "user":
        msgs[-1] = {"role": "user", "content": f"{ctx}\n\n{last['content']}"}
    return msgs


def _build_context(context: dict) -> str:
    parts = []
    if s := context.get("daily_summary"):
        parts.append(f"[Bugün: {s.get('calories', 0):.0f}/{s.get('goal_calories', 2100):.0f} kcal]")
    return " ".join(parts)
