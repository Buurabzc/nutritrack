#!/bin/bash
# NutriTrack — backend + frontend birlikte başlat

PROJ="$(cd "$(dirname "$0")" && pwd)"

echo "🟢 Backend başlatılıyor..."
cd "$PROJ/backend"
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0 &
BACKEND_PID=$!

echo "🟢 Frontend başlatılıyor..."
cd "$PROJ/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ NutriTrack çalışıyor"
echo "   Uygulama : http://localhost:5173"
echo "   API docs  : http://localhost:8000/docs"
echo ""
echo "Durdurmak için Ctrl+C"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Durduruldu.'" INT
wait
