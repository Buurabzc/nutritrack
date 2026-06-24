import os


def get_setting(key: str, fallback_env: str = "") -> str:
    return os.getenv(fallback_env or key, "")


def get_user_setting(uid: str, key: str, fallback_env: str = "") -> str:
    env_val = os.getenv(fallback_env or key, "")
    if env_val:
        return env_val
    try:
        from app.sqlite_db import get_config
        settings = get_config("settings")
        val = settings.get(key, "")
        if val:
            return val
    except Exception:
        pass
    return ""


def get_setting_db(key: str, fallback_env: str, uid: str = "") -> str:
    if uid:
        return get_user_setting(uid, key, fallback_env)
    return get_setting(key, fallback_env)
