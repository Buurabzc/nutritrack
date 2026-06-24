"""
Claude'a verilecek tool tanımları.
Her tool bir FastAPI endpoint'ine karşılık gelir.
"""

NUTRITRACK_TOOLS = [
    {
        "name": "log_meal",
        "description": (
            "Kullanıcının yediği bir besini günlüğe ekler. "
            "Kullanıcı 'yedim', 'içtim', 'kahvaltıda', 'öğle', 'akşam' gibi ifadeler kullandığında çağır. "
            "Besin adını, gramajını ve öğün tipini tespit et. "
            "Makroları kendi bilginle hesapla — 100g başına yaklaşık değerler yeterli."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "food_name": {"type": "string", "description": "Besin adı (Türkçe, açıklayıcı)"},
                "meal_type": {
                    "type": "string",
                    "enum": ["kahvalti", "ogle", "aksam", "atistirma"],
                    "description": "Öğün tipi"
                },
                "amount_g": {"type": "number", "description": "Miktar (gram). Belirtilmemişse mantıklı bir tahmin yap."},
                "calories": {"type": "number", "description": "Toplam kalori (kcal)"},
                "protein": {"type": "number", "description": "Protein (g)"},
                "carbs": {"type": "number", "description": "Karbonhidrat (g)"},
                "fat": {"type": "number", "description": "Yağ (g)"},
                "fiber": {"type": "number", "description": "Lif (g)", "default": 0},
            },
            "required": ["food_name", "meal_type", "amount_g", "calories", "protein", "carbs", "fat"],
        },
    },
    {
        "name": "delete_meal",
        "description": "Daha önce kaydedilen bir öğünü siler. Kullanıcı 'sil', 'çıkar', 'iptal et' dediğinde çağır.",
        "input_schema": {
            "type": "object",
            "properties": {
                "meal_id": {"type": "integer", "description": "Silinecek öğünün ID'si (get_today_summary'den alınabilir)"},
            },
            "required": ["meal_id"],
        },
    },
    {
        "name": "get_today_summary",
        "description": (
            "Bugünkü beslenme özetini getirir: toplam kalori, makrolar, su, öğün listesi ve hedefler. "
            "Kullanıcı 'bugün ne yedim', 'durumum nasıl', 'kalan kalori' gibi sorular sorduğunda çağır."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_weekly_summary",
        "description": "Bu haftaki günlük kalori değerlerini ve öğün sayılarını getirir.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "log_water",
        "description": "Su içimi kaydeder. 'Su içtim', 'bardak su', 'su' ifadelerinde çağır.",
        "input_schema": {
            "type": "object",
            "properties": {
                "amount_ml": {
                    "type": "integer",
                    "description": "Miktar (ml). Belirtilmemişse 250 kullan (1 bardak).",
                },
            },
            "required": ["amount_ml"],
        },
    },
    {
        "name": "log_body_measurement",
        "description": "Vücut ölçüsü kaydeder: ağırlık, bel, beden yağı vb.",
        "input_schema": {
            "type": "object",
            "properties": {
                "weight_kg": {"type": "number", "description": "Ağırlık (kg)"},
                "waist_cm": {"type": "number", "description": "Bel çevresi (cm)"},
                "body_fat_pct": {"type": "number", "description": "Vücut yağ yüzdesi"},
                "note": {"type": "string", "description": "Not"},
            },
            "required": [],
        },
    },
    {
        "name": "search_food",
        "description": "Besin veritabanında arama yapar ve kalori/makro bilgisi döndürür.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Aranacak besin adı"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "update_goals",
        "description": "Kullanıcının günlük kalori ve makro hedeflerini günceller.",
        "input_schema": {
            "type": "object",
            "properties": {
                "daily_calories": {"type": "integer"},
                "protein_g": {"type": "integer"},
                "carbs_g": {"type": "integer"},
                "fat_g": {"type": "integer"},
                "water_ml": {"type": "integer"},
            },
            "required": [],
        },
    },
    {
        "name": "log_exercise",
        "description": (
            "Egzersiz/antrenman kaydeder. "
            "'Koştum', 'spor yaptım', 'bisiklete bindim', 'yürüyüş yaptım', 'ağırlık çalıştım' gibi ifadelerde çağır. "
            "Kalori bilinmiyorsa yaygın değerleri tahmin et: yürüyüş ~4 kcal/dk, koşu ~10 kcal/dk, bisiklet ~7 kcal/dk, ağırlık ~5 kcal/dk."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "exercise_name": {"type": "string", "description": "Egzersiz adı (Türkçe, açıklayıcı)"},
                "category": {
                    "type": "string",
                    "enum": ["cardio", "strength", "sport", "other"],
                    "description": "Kategori: koşu/yürüyüş/bisiklet→cardio, ağırlık/dumbbell→strength, futbol/basketbol→sport",
                },
                "duration_min": {"type": "number", "description": "Süre (dakika)"},
                "calories_burned": {"type": "number", "description": "Yakılan kalori tahmini (kcal). Kullanıcı belirtmemişse süre ve türden tahmin et."},
            },
            "required": ["exercise_name", "duration_min", "calories_burned"],
        },
    },
    {
        "name": "start_fast",
        "description": (
            "Aralıklı oruç (intermittent fasting) başlatır. "
            "'16:8 orucumu başlat', 'oruç tutacağım', 'IF başlıyorum' gibi ifadelerde çağır. "
            "Protokol belirtilmemişse 16:8 kullan."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "protocol": {
                    "type": "string",
                    "enum": ["16:8", "18:6", "20:4", "24h", "custom"],
                    "description": "Oruç protokolü",
                },
                "target_hours": {
                    "type": "number",
                    "description": "Hedef oruç süresi (saat). Protokolden çıkar: 16:8→16, 18:6→18, 20:4→20, 24h→24.",
                },
            },
            "required": ["protocol", "target_hours"],
        },
    },
    {
        "name": "end_fast",
        "description": (
            "Aktif orucu tamamlar veya kırar. "
            "'Orucumu bitirdim', 'orucu tamamladım', 'orucu kırdım', 'yemek yedim' gibi ifadelerde çağır."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["completed", "broken"],
                    "description": "completed: başarıyla tamamlandı, broken: kırıldı/erken bırakıldı",
                },
            },
            "required": ["status"],
        },
    },
]


def to_openai_tools() -> list[dict]:
    """Anthropic input_schema formatını OpenAI function-calling formatına çevirir.
    OpenAI, DeepSeek ve Ollama'nın OpenAI-uyumlu /api/chat uçları için kullanılır."""
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            },
        }
        for t in NUTRITRACK_TOOLS
    ]


def to_gemini_tools() -> list[dict]:
    """Anthropic input_schema formatını Gemini functionDeclarations formatına çevirir."""
    def clean_schema(schema: dict) -> dict:
        cleaned = {k: v for k, v in schema.items() if k != "default"}
        if "properties" in cleaned:
            cleaned["properties"] = {k: clean_schema(v) for k, v in cleaned["properties"].items()}
        return cleaned

    return [{
        "functionDeclarations": [
            {
                "name": t["name"],
                "description": t["description"],
                "parameters": clean_schema(t["input_schema"]),
            }
            for t in NUTRITRACK_TOOLS
        ]
    }]
