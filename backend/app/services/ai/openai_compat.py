"""
OpenAI Chat Completions formatını kullanan sağlayıcılar (OpenAI, DeepSeek) için
ortak agentic tool-calling döngüsü: mesaj → tool_calls → execute → tool sonucu → final yanıt.
"""
import json
import httpx
from app.services.ai.tools import to_openai_tools
from app.services.ai.executor import execute_tool


async def run_tool_loop(
    *, url: str, headers: dict, model: str, messages: list[dict],
    uid: str, max_tokens: int = 1024, max_turns: int = 5,
) -> dict:
    conversation = list(messages)
    tool_calls_log: list = []

    for _ in range(max_turns):
        payload = {
            "model": model,
            "messages": conversation,
            "max_tokens": max_tokens,
            "tools": to_openai_tools(),
        }
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(url, headers=headers, json=payload)
            data = resp.json()
        except Exception as e:
            return {"reply": f"Bağlantı hatası: {e}", "tool_calls": tool_calls_log}

        if resp.status_code != 200:
            err = data.get("error", {})
            msg = err.get("message", str(data)) if isinstance(err, dict) else str(data)
            return {"reply": f"API hatası: {msg}", "tool_calls": tool_calls_log}

        message = data["choices"][0]["message"]
        tool_calls = message.get("tool_calls")

        if not tool_calls:
            return {"reply": message.get("content") or "", "tool_calls": tool_calls_log}

        conversation.append(message)
        for call in tool_calls:
            fn = call["function"]
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            result = await execute_tool(fn["name"], args, uid)
            tool_calls_log.append({"tool": fn["name"], "input": args, "result": result})
            conversation.append({
                "role": "tool",
                "tool_call_id": call.get("id", fn["name"]),
                "content": json.dumps(result, ensure_ascii=False),
            })

    return {"reply": "İşlemi tamamlayamadım, çok fazla adım gerekti.", "tool_calls": tool_calls_log}
