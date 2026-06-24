from fastapi import APIRouter, Query
import json, os

router = APIRouter()

_foods = None

def get_foods():
    global _foods
    if _foods is None:
        data_path = os.path.join(os.path.dirname(__file__), "../../data/foods_tr.json")
        with open(os.path.abspath(data_path), encoding="utf-8") as f:
            _foods = json.load(f)
    return _foods

@router.get("")
def search_foods(
    q: str = Query("", description="Arama terimi"),
    category: str = Query("", description="Kategori filtresi"),
    limit: int = Query(20, le=50),
):
    foods = get_foods()
    results = foods

    if category:
        results = [f for f in results if f["category"] == category]

    if q:
        q_lower = q.lower()
        results = [
            f for f in results
            if q_lower in f["name"].lower() or q_lower in f.get("id", "").lower()
        ]

    return results[:limit]

@router.get("/categories")
def list_categories():
    foods = get_foods()
    cats = sorted(set(f["category"] for f in foods))
    labels = {
        "protein": "Protein", "sut": "Süt Ürünleri", "tahil": "Tahıl",
        "baklagil": "Baklagil", "sebze": "Sebze", "meyve": "Meyve",
        "kuruyemis": "Kuruyemiş", "yag": "Yağ", "corba": "Çorba",
        "hazir": "Hazır", "icecek": "İçecek", "diger": "Diğer",
        "atistirma": "Atıştırmalık",
    }
    return [{"id": c, "label": labels.get(c, c)} for c in cats]

@router.get("/{food_id}")
def get_food(food_id: str):
    foods = get_foods()
    for f in foods:
        if f["id"] == food_id:
            return f
    return None
