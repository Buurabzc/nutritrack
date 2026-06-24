from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

from app.routers import foods, meals, body, goals, ai_chat, settings, chat_history, exercise, templates, fasting, export

app = FastAPI(title="NutriTrack API", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(foods.router,         prefix="/api/foods",    tags=["foods"])
app.include_router(meals.router,         prefix="/api/meals",    tags=["meals"])
app.include_router(body.router,          prefix="/api/body",     tags=["body"])
app.include_router(goals.router,         prefix="/api/goals",    tags=["goals"])
app.include_router(ai_chat.router,       prefix="/api/ai",       tags=["ai"])
app.include_router(settings.router,      prefix="/api",          tags=["settings"])
app.include_router(chat_history.router,  prefix="/api",          tags=["chat"])
app.include_router(exercise.router,      prefix="/api/exercise", tags=["exercise"])
app.include_router(templates.router,     prefix="/api/templates",tags=["templates"])
app.include_router(fasting.router,       prefix="/api/fasting",  tags=["fasting"])
app.include_router(export.router,        prefix="/api",          tags=["export"])


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "4.0.0"}
