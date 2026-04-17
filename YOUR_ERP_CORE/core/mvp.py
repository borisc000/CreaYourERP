from __future__ import annotations

from typing import Iterable, Optional


MVP_DISABLED_MODULES = {
    "assets",
    "attendance",
    "payroll",
    "riohs",
    "google_workspace",
    "ai",
}

MVP_DISABLED_APP_PATHS = {
    "/app/activos": "assets",
    "/app/attendance": "attendance",
    "/app/payroll": "payroll",
    "/app/riohs": "riohs",
    "/app/riohs/download": "riohs",
    "/app/google-workspace": "google_workspace",
    "/app/ai": "ai",
}

MVP_DISABLED_API_PREFIXES = {
    "/assets": "assets",
    "/attendance": "attendance",
    "/payroll": "payroll",
    "/riohs": "riohs",
    "/google-workspace": "google_workspace",
    "/ai": "ai",
}

MVP_V2_MESSAGE = "Disponible en v2"

_MODULE_ALIASES = {
    "google-workspace": "google_workspace",
    "google workspace": "google_workspace",
    "riohs / rihs": "riohs",
    "rihs": "riohs",
}


def normalize_module_name(module_name: Optional[str]) -> str:
    value = str(module_name or "").strip().lower().replace("-", "_")
    return _MODULE_ALIASES.get(value, value)


def is_mvp_disabled_module(module_name: Optional[str]) -> bool:
    return normalize_module_name(module_name) in MVP_DISABLED_MODULES


def _match_prefixed_path(path: Optional[str], mapping: dict[str, str]) -> Optional[str]:
    normalized_path = "/" + str(path or "").lstrip("/")
    for prefix, module_name in mapping.items():
        if normalized_path == prefix or normalized_path.startswith(f"{prefix}/"):
            return module_name
    return None


def get_mvp_disabled_app_module(path: Optional[str]) -> Optional[str]:
    return _match_prefixed_path(path, MVP_DISABLED_APP_PATHS)


def get_mvp_disabled_api_module(path: Optional[str]) -> Optional[str]:
    return _match_prefixed_path(path, MVP_DISABLED_API_PREFIXES)


def filter_mvp_modules(modules: Iterable[str]) -> list[str]:
    filtered: list[str] = []
    seen: set[str] = set()
    for raw_name in modules or []:
        module_name = normalize_module_name(raw_name)
        if not module_name or module_name in seen or module_name in MVP_DISABLED_MODULES:
            continue
        seen.add(module_name)
        filtered.append(module_name)
    return filtered
