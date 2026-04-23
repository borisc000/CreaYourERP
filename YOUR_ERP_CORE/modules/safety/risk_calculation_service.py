"""
Central risk calculation service for MIPER/IPER flows.

The ERP currently persists records as JSON payloads, so this service is kept
pure and side-effect free. Models, generators and UI endpoints can call it
without coupling themselves to one table shape.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


CONTROL_HIERARCHY_KEYS = (
    "elimination",
    "substitution",
    "engineering",
    "administrative",
    "ppe",
)

CONTROL_HIERARCHY_LABELS = {
    "elimination": "Eliminacion",
    "substitution": "Sustitucion",
    "engineering": "Ingenieria",
    "administrative": "Administrativos",
    "ppe": "EPP",
}

DEFAULT_RISK_METHODOLOGY: Dict[str, Any] = {
    "name": "MIPER/IPER 1-2-4",
    "probability_schema": [
        {"value": 1, "label": "Baja", "description": "Evento poco probable o controlado."},
        {"value": 2, "label": "Media", "description": "Evento posible bajo condiciones habituales."},
        {"value": 4, "label": "Alta", "description": "Evento probable o con controles insuficientes."},
    ],
    "consequence_schema": [
        {"value": 1, "label": "Leve", "description": "Lesion menor o dano bajo."},
        {"value": 2, "label": "Seria", "description": "Lesion con tiempo perdido o dano relevante."},
        {"value": 4, "label": "Grave", "description": "Fatalidad, incapacidad grave o dano mayor."},
    ],
    "risk_matrix_schema": [
        {
            "min": 0,
            "max": 2,
            "label": "Tolerable",
            "color": "#22c55e",
            "approval_blocked": False,
            "mitigation_required": False,
            "action_required": "Mantener controles y verificaciones periodicas.",
        },
        {
            "min": 3,
            "max": 4,
            "label": "Moderado",
            "color": "#facc15",
            "approval_blocked": False,
            "mitigation_required": False,
            "action_required": "Definir mejoras preventivas dentro de un periodo controlado.",
        },
        {
            "min": 5,
            "max": 8,
            "label": "Importante",
            "color": "#fb923c",
            "approval_blocked": False,
            "mitigation_required": True,
            "action_required": "Registrar controles adicionales o justificacion antes de aprobar.",
        },
        {
            "min": 9,
            "max": 999,
            "label": "Intolerable",
            "color": "#ef4444",
            "approval_blocked": True,
            "mitigation_required": True,
            "action_required": "No comenzar ni continuar hasta reducir el riesgo.",
        },
    ],
    "default_flag": True,
}

COMPACT_MIPER_METHODOLOGY: Dict[str, Any] = {
    "name": "MIPER compacta PE+FE+FO x S",
    "task_type_schema": [
        {"code": "R", "label": "Rutinaria"},
        {"code": "NR", "label": "No rutinaria"},
        {"code": "E", "label": "Emergencia"},
    ],
    "exposed_people_schema": [
        {"value": 1, "label": "Bajo", "description": "De 1 a 4 personas expuestas."},
        {"value": 2, "label": "Medio", "description": "De 5 a 12 personas expuestas."},
        {"value": 3, "label": "Alto", "description": "Mas de 12 personas expuestas."},
    ],
    "exposure_frequency_schema": [
        {"value": 1, "label": "Ocasional", "description": "Al menos 1 vez al mes."},
        {"value": 2, "label": "Frecuente", "description": "Al menos 1 vez a la semana."},
        {"value": 3, "label": "Permanente", "description": "Al menos 1 vez al dia."},
    ],
    "occurrence_factor_schema": [
        {"value": 1, "label": "Bajo", "description": "Sin ocurrencia en el area/localidad durante 1 ano."},
        {"value": 2, "label": "Medio", "description": "Ocurrencia 1 a 3 veces en 2 anos."},
        {"value": 3, "label": "Alto", "description": "Ocurrencia 4 o mas veces en 2 anos."},
    ],
    "severity_schema": [
        {"value": 1, "label": "Ligeramente danino", "description": "Primeros auxilios menores o lesion leve."},
        {"value": 2, "label": "Danino", "description": "Lesion con tratamiento medico o tiempo perdido."},
        {"value": 3, "label": "Muy danino", "description": "Lesion grave, fractura compleja o incapacidad temporal mayor."},
        {"value": 4, "label": "Extremadamente danino", "description": "Fatalidad, incapacidad permanente o dano mayor."},
    ],
    "residual_risk_schema": [
        {
            "min": 1,
            "max": 9,
            "label": "Aceptable",
            "color": "#a3e635",
            "approval_blocked": False,
            "mitigation_required": False,
            "action_required": "Mantener controles y registro del riesgo.",
        },
        {
            "min": 10,
            "max": 18,
            "label": "Moderado",
            "color": "#fde68a",
            "approval_blocked": False,
            "mitigation_required": False,
            "action_required": "Implementar resguardos dentro de un plazo definido.",
        },
        {
            "min": 19,
            "max": 27,
            "label": "Importante",
            "color": "#fdba74",
            "approval_blocked": False,
            "mitigation_required": True,
            "action_required": "Definir plan de control y responsable antes de aprobar.",
        },
        {
            "min": 28,
            "max": 999,
            "label": "No aceptable",
            "color": "#fca5a5",
            "approval_blocked": True,
            "mitigation_required": True,
            "action_required": "No realizar hasta reducir el riesgo y aprobar plan de accion.",
        },
    ],
    "default_flag": True,
}


def normalize_string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, tuple) or isinstance(value, set):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        items: List[str] = []
        for raw in value.replace("\r", "\n").replace(",", "\n").split("\n"):
            item = raw.strip()
            if item:
                items.append(item)
        return items
    text = str(value).strip()
    return [text] if text else []


def normalize_control_hierarchy(value: Any) -> Dict[str, List[str]]:
    hierarchy = {key: [] for key in CONTROL_HIERARCHY_KEYS}
    if isinstance(value, dict):
        for key in CONTROL_HIERARCHY_KEYS:
            hierarchy[key] = normalize_string_list(value.get(key))
        return hierarchy
    if isinstance(value, str):
        hierarchy["administrative"] = normalize_string_list(value)
    return hierarchy


def summarize_controls(control_hierarchy: Dict[str, Any], fallback: str = "") -> str:
    hierarchy = normalize_control_hierarchy(control_hierarchy)
    chunks: List[str] = []
    for key in CONTROL_HIERARCHY_KEYS:
        items = normalize_string_list(hierarchy.get(key))
        if items:
            chunks.append(f"{CONTROL_HIERARCHY_LABELS[key]}: " + "; ".join(items))
    return " | ".join(chunks) if chunks else (fallback or "")


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def calculate_vep(probability: Any, consequence: Any) -> int:
    return _safe_int(probability, 0) * _safe_int(consequence, 0)


def _schema_for_value(value: int, methodology: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    config = methodology or DEFAULT_RISK_METHODOLOGY
    schema = config.get("risk_matrix_schema") or DEFAULT_RISK_METHODOLOGY["risk_matrix_schema"]
    for item in schema:
        if value >= _safe_int(item.get("min"), 0) and value <= _safe_int(item.get("max"), 999):
            return dict(item)
    return {
        "label": "-",
        "color": "#94a3b8",
        "approval_blocked": False,
        "mitigation_required": False,
        "action_required": "",
    }


def risk_level_from_vep(vep: Any, methodology: Optional[Dict[str, Any]] = None) -> str:
    return str(_schema_for_value(_safe_int(vep, 0), methodology).get("label") or "-")


def action_from_vep(vep: Any, methodology: Optional[Dict[str, Any]] = None) -> str:
    return str(_schema_for_value(_safe_int(vep, 0), methodology).get("action_required") or "")


def calculate_risk(
    probability: Any,
    consequence: Any,
    methodology: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    probability_value = _safe_int(probability, 0)
    consequence_value = _safe_int(consequence, 0)
    risk_value = calculate_vep(probability_value, consequence_value)
    schema = _schema_for_value(risk_value, methodology)
    return {
        "probability_value": probability_value,
        "consequence_value": consequence_value,
        "risk_level_value": risk_value,
        "risk_value": risk_value,
        "risk_level_label": schema.get("label") or "-",
        "risk_level": schema.get("label") or "-",
        "severity_color": schema.get("color") or "#94a3b8",
        "action_required": schema.get("action_required") or "",
        "approval_blocked": bool(schema.get("approval_blocked")),
        "mitigation_required": bool(schema.get("mitigation_required")),
    }


def _compact_schema_for_value(value: int) -> Dict[str, Any]:
    for item in COMPACT_MIPER_METHODOLOGY["residual_risk_schema"]:
        if value >= _safe_int(item.get("min"), 1) and value <= _safe_int(item.get("max"), 999):
            return dict(item)
    return {
        "label": "-",
        "color": "#e5e7eb",
        "approval_blocked": False,
        "mitigation_required": False,
        "action_required": "",
    }


def classify_compact_miper(value: Any) -> Dict[str, Any]:
    return _compact_schema_for_value(_safe_int(value, 0))


def normalize_task_type_code(value: Any, routine_type: str = "") -> str:
    raw = str(value or "").strip().upper()
    if raw in ("R", "NR", "E"):
        return raw
    routine = str(routine_type or "").strip().lower()
    if routine in ("non_routine", "no_rutinaria", "nr"):
        return "NR"
    if routine in ("emergency", "emergencia", "e"):
        return "E"
    return "R"


def calculate_compact_miper(
    exposed_people: Any = 1,
    exposure_frequency: Any = 1,
    occurrence_factor: Any = 1,
    severity: Any = 2,
) -> Dict[str, Any]:
    pe = max(1, _safe_int(exposed_people, 1))
    fe = max(1, _safe_int(exposure_frequency, 1))
    fo = max(1, _safe_int(occurrence_factor, 1))
    sev = max(1, _safe_int(severity, 2))
    probability_score = pe + fe + fo
    residual_risk_value = probability_score * sev
    schema = classify_compact_miper(residual_risk_value)
    return {
        "exposed_people_value": pe,
        "exposure_frequency_value": fe,
        "occurrence_factor_value": fo,
        "probability_score": probability_score,
        "severity_value": sev,
        "residual_risk_value": residual_risk_value,
        "residual_risk_label": schema.get("label") or "-",
        "residual_risk_color": schema.get("color") or "#e5e7eb",
        "compact_action_required": schema.get("action_required") or "",
        "compact_approval_blocked": bool(schema.get("approval_blocked")),
        "compact_mitigation_required": bool(schema.get("mitigation_required")),
    }


def compact_miper_methodology_payload() -> Dict[str, Any]:
    return dict(COMPACT_MIPER_METHODOLOGY)


def methodology_payload(methodology: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    payload = dict(methodology or DEFAULT_RISK_METHODOLOGY)
    payload.setdefault("control_hierarchy_keys", list(CONTROL_HIERARCHY_KEYS))
    payload.setdefault("control_hierarchy_labels", dict(CONTROL_HIERARCHY_LABELS))
    payload.setdefault("compact_miper", compact_miper_methodology_payload())
    return payload
