"""
Claude tool calling servisi.
Agentic loop: mesaj → tool_use → execute → tool_result → final yanıt
"""
import json
import os
from anthropic import AsyncAnthropic
from app.services.ai.tools import NUTRITRACK_TOOLS
from app.services.ai.executor import execute_tool
from app.services.ai.persona import get_system_prompt


async def chat_with_tools(messages: list[dict], uid: str, model: str | None = None) -> dict:
    from app.services.settings_service import get_user_setting
    api_key = get_user_setting(uid, "ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY")
    if not api_key:
        return {
            "reply": "Claude API key tanımlı değil. Ayarlar sayfasından ekleyebilirsiniz.",
            "provider": "claude",
            "model": "none",
            "tool_calls": [],
        }

    client = AsyncAnthropic(api_key=api_key)
    model = model or os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
    conversation = list(messages)
    tool_calls_log = []

    for _ in range(8):
        response = await client.messages.create(
            model=model,
            max_tokens=2048,
            system=get_system_prompt(uid),
            tools=NUTRITRACK_TOOLS,
            messages=conversation,
        )

        if response.stop_reason == "end_turn":
            text = "".join(b.text for b in response.content if b.type == "text")
            return {"reply": text, "provider": "claude", "model": model, "tool_calls": tool_calls_log}

        if response.stop_reason == "tool_use":
            conversation.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                result = await execute_tool(block.name, block.input, uid)
                tool_calls_log.append({"tool": block.name, "input": block.input, "result": result})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })
            conversation.append({"role": "user", "content": tool_results})
        else:
            text = "".join(b.text for b in response.content if hasattr(b, "text"))
            return {"reply": text or "Bir hata oluştu.", "provider": "claude", "model": model, "tool_calls": tool_calls_log}

    return {"reply": "İşlemi tamamlayamadım, çok fazla adım gerekti.", "provider": "claude", "model": model, "tool_calls": tool_calls_log}
