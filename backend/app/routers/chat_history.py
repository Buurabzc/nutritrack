import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.dependencies import get_uid
from app.sqlite_db import get_db

router = APIRouter(prefix="/chat", tags=["chat"])


class MessageIn(BaseModel):
    role: str
    content: str
    provider: Optional[str] = None
    tool_calls: Optional[list] = None


class SessionCreate(BaseModel):
    provider: str = "claude"
    title: Optional[str] = None


@router.get("/sessions")
def list_sessions(limit: int = 50, uid: str = Depends(get_uid)):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT ?", (limit,)
    ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        result.append({
            "id": d["id"],
            "title": d.get("title"),
            "provider": d.get("provider", "claude"),
            "created_at": d.get("created_at", ""),
            "updated_at": d.get("updated_at", ""),
            "message_count": d.get("message_count", 0),
            "preview": (d.get("preview") or d.get("title") or "")[:80],
        })
    return result


@router.post("/sessions")
def create_session(body: SessionCreate, uid: str = Depends(get_uid)):
    now = datetime.utcnow().isoformat()
    data = {
        "id": str(uuid.uuid4()),
        "provider": body.provider,
        "title": body.title,
        "preview": None,
        "message_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    db = get_db()
    db.execute(
        "INSERT INTO chat_sessions (id,provider,title,preview,message_count,created_at,updated_at)"
        " VALUES (:id,:provider,:title,:preview,:message_count,:created_at,:updated_at)",
        data,
    )
    db.commit()
    return {"id": data["id"], "created_at": now}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, uid: str = Depends(get_uid)):
    db = get_db()
    if not db.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,)).fetchone():
        raise HTTPException(404, "Session bulunamadı")
    db.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
    db.commit()
    return {"ok": True}


@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: str, uid: str = Depends(get_uid)):
    db = get_db()
    if not db.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,)).fetchone():
        raise HTTPException(404, "Session bulunamadı")
    rows = db.execute(
        "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at", (session_id,)
    ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        result.append({
            "id": d["id"],
            "role": d.get("role"),
            "content": d.get("content"),
            "provider": d.get("provider"),
            "tool_calls": json.loads(d.get("tool_calls") or "[]"),
            "created_at": d.get("created_at", ""),
        })
    return result


@router.post("/sessions/{session_id}/messages")
def add_message(session_id: str, msg: MessageIn, uid: str = Depends(get_uid)):
    db = get_db()
    session_row = db.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
    if not session_row:
        raise HTTPException(404, "Session bulunamadı")
    session = dict(session_row)

    now = datetime.utcnow().isoformat()
    msg_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO chat_messages (id,session_id,role,content,provider,tool_calls,created_at)"
        " VALUES (?,?,?,?,?,?,?)",
        (msg_id, session_id, msg.role, msg.content, msg.provider,
         json.dumps(msg.tool_calls or []), now),
    )

    updates: dict = {"updated_at": now, "message_count": session.get("message_count", 0) + 1}
    if not session.get("title") and msg.role == "user":
        updates["title"] = msg.content[:60]
        updates["preview"] = msg.content[:80]

    db.execute(
        "UPDATE chat_sessions SET updated_at=:updated_at, message_count=:message_count"
        + (", title=:title, preview=:preview" if "title" in updates else "")
        + " WHERE id=:id",
        {**updates, "id": session_id},
    )
    db.commit()
    return {"id": msg_id}


@router.post("/sessions/{session_id}/messages/bulk")
def add_messages_bulk(session_id: str, messages: list[MessageIn], uid: str = Depends(get_uid)):
    db = get_db()
    session_row = db.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
    if not session_row:
        raise HTTPException(404, "Session bulunamadı")
    session = dict(session_row)

    now = datetime.utcnow().isoformat()
    for msg in messages:
        db.execute(
            "INSERT INTO chat_messages (id,session_id,role,content,provider,tool_calls,created_at)"
            " VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), session_id, msg.role, msg.content, msg.provider,
             json.dumps(msg.tool_calls or []), now),
        )

    updates: dict = {
        "updated_at": now,
        "message_count": session.get("message_count", 0) + len(messages),
    }
    if not session.get("title") and messages:
        first_user = next((m for m in messages if m.role == "user"), None)
        if first_user:
            updates["title"] = first_user.content[:60]

    set_clause = "updated_at=:updated_at, message_count=:message_count"
    if "title" in updates:
        set_clause += ", title=:title"
    db.execute(f"UPDATE chat_sessions SET {set_clause} WHERE id=:id", {**updates, "id": session_id})
    db.commit()
    return {"ok": True, "count": len(messages)}
