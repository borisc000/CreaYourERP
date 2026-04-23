"""
Safety activity blocks catalog.

Each activity block is a reusable operational unit with one or more
hazard/risk rows linked to the shared Safety master-risk catalog.
"""

from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now_iso
from modules.safety.miper_engine import (
    action_from_vep,
    build_row_fingerprint,
    calculate_vep,
    dedupe_preserve_order,
    normalize_control_hierarchy,
    normalize_string_list,
    risk_level_from_vep,
    summarize_controls,
)
from modules.safety.risk_calculation_service import (
    calculate_compact_miper,
    calculate_risk,
    methodology_payload,
    normalize_task_type_code,
)


ACTIVITY_BLOCK_TYPES = (
    "generic",
    "specialty",
    "custom",
    "transversal",
    "critical",
    "company_custom",
    "project_custom",
)
BOT_ORIGIN_SCOPES = ("global", "company", "project", "client")
BOT_ROUTINE_TYPES = ("routine", "non_routine")
BOT_CRITICALITIES = ("low", "medium", "high", "critical")
BOT_STATUSES = ("draft", "active", "archived")
BOT_TYPE_LABELS = {
    "generic": "Global transversal",
    "transversal": "Global transversal",
    "specialty": "Global especialidad",
    "critical": "Critico",
    "custom": "Personalizado",
    "company_custom": "Personalizado empresa",
    "project_custom": "Personalizado proyecto/faena",
}
DEFAULT_ACTIVITY_BLOCKS: List[Dict[str, Any]] = [
    {
        "block": {
            "code": "ACT-GEN-CONDUCCION",
            "name": "Conduccion y maniobras vehiculares",
            "description": "Desplazamiento y maniobras en vehiculo liviano o de apoyo dentro o fuera de faena.",
            "block_type": "generic",
            "default_process_name": "Movilizacion y traslado",
            "default_task_name": "Conduccion y maniobras vehiculares",
            "default_position_name": "Conductor / personal autorizado",
            "default_owner_name": "Supervisor de terreno",
        },
        "hazards": [
            {
                "hazard_factor": "Interaccion con otros vehiculos o peatones",
                "master_risk_code": "I1",
                "probability": 2,
                "consequence": 4,
                "control_hierarchy": {
                    "engineering": ["Segregacion de rutas y senalizacion vial"],
                    "administrative": ["Licencia vigente", "Plan de transito", "Respetar velocidad maxima"],
                    "ppe": ["Chaleco reflectante"],
                },
                "required_ppe": ["Chaleco reflectante", "Calzado de seguridad"],
                "legal_reference": "Reglamento interno y plan de transito",
                "source_note": "Actividad generica de conduccion.",
            },
            {
                "hazard_factor": "Fatiga o perdida de atencion durante la conduccion",
                "master_risk_code": "D1",
                "probability": 2,
                "consequence": 2,
                "control_hierarchy": {
                    "administrative": ["Planificar pausas", "No conducir bajo fatiga o medicamentos incompatibles"],
                },
                "source_note": "Control preventivo para fatiga operacional.",
            },
        ],
    },
    {
        "block": {
            "code": "ACT-GEN-TRANSITO-PEATONAL",
            "name": "Transito peatonal en faena",
            "description": "Desplazamiento del personal por accesos, plataformas, patios y zonas operativas.",
            "block_type": "generic",
            "default_process_name": "Operacion transversal",
            "default_task_name": "Transito peatonal en faena",
            "default_position_name": "Todo el personal",
            "default_owner_name": "Supervisor de terreno",
        },
        "hazards": [
            {
                "hazard_factor": "Superficies irregulares, derrames u obstaculos",
                "master_risk_code": "A1",
                "probability": 2,
                "consequence": 2,
                "control_hierarchy": {
                    "elimination": ["Retiro de obstaculos y orden permanente"],
                    "engineering": ["Demarcacion de rutas peatonales"],
                    "administrative": ["Inspeccion visual previa", "Mantener tres puntos de apoyo cuando aplique"],
                    "ppe": ["Calzado de seguridad"],
                },
                "required_ppe": ["Calzado de seguridad", "Casco"],
                "legal_reference": "DS 44 gestion de condiciones de trabajo",
                "source_note": "Bloque generico de transito peatonal.",
            },
            {
                "hazard_factor": "Convivencia con vehiculos o equipos moviles",
                "master_risk_code": "I1",
                "probability": 2,
                "consequence": 4,
                "control_hierarchy": {
                    "engineering": ["Separacion fisica de rutas peatonales y equipos"],
                    "administrative": ["Contacto visual con operador", "Respetar zonas segregadas"],
                    "ppe": ["Chaleco reflectante"],
                },
                "required_ppe": ["Chaleco reflectante", "Casco"],
                "source_note": "Bloque generico para lineas de fuego en desplazamiento.",
            },
        ],
    },
    {
        "block": {
            "code": "ACT-GEN-MMC",
            "name": "Manejo manual de cargas",
            "description": "Levantamiento, traslado, posicionamiento y descarga manual de materiales o componentes.",
            "block_type": "generic",
            "default_process_name": "Manipulacion de materiales",
            "default_task_name": "Manejo manual de cargas",
            "default_position_name": "Personal operativo",
            "default_owner_name": "Supervisor de terreno",
        },
        "hazards": [
            {
                "hazard_factor": "Esfuerzo fisico por levantamiento o transporte de cargas",
                "master_risk_code": "R1",
                "probability": 2,
                "consequence": 2,
                "protocol_codes": ["TMERT"],
                "control_hierarchy": {
                    "elimination": ["Reducir pesos unitarios o dividir carga"],
                    "engineering": ["Usar carros, tecles o ayudas mecanicas"],
                    "administrative": ["Tecnica de levantamiento", "Trabajo en equipo", "Limites de peso"],
                    "ppe": ["Guantes de seguridad"],
                },
                "required_ppe": ["Guantes de seguridad", "Calzado de seguridad"],
                "source_note": "Bloque generico de MMC.",
            },
            {
                "hazard_factor": "Posturas forzadas durante manipulacion de materiales",
                "master_risk_code": "T1",
                "probability": 2,
                "consequence": 2,
                "protocol_codes": ["TMERT"],
                "control_hierarchy": {
                    "administrative": ["Rotacion de tareas", "Pausas activas", "Ajustar altura de trabajo"],
                },
                "source_note": "Apoya control musculo esqueletico.",
            },
        ],
    },
    {
        "block": {
            "code": "ACT-GEN-HERRAMIENTAS",
            "name": "Uso de herramientas manuales y electricas",
            "description": "Seleccion, inspeccion y uso de herramientas manuales, electricas o de apoyo menor.",
            "block_type": "generic",
            "default_process_name": "Ejecucion operativa",
            "default_task_name": "Uso de herramientas manuales y electricas",
            "default_position_name": "Personal operativo",
            "default_owner_name": "Supervisor de terreno",
        },
        "hazards": [
            {
                "hazard_factor": "Contacto con superficies cortantes o puntos de atrapamiento",
                "master_risk_code": "B3",
                "probability": 2,
                "consequence": 2,
                "control_hierarchy": {
                    "engineering": ["Herramientas con protecciones instaladas"],
                    "administrative": ["Inspeccion previa", "Retiro de herramientas defectuosas"],
                    "ppe": ["Guantes", "Lentes de seguridad"],
                },
                "required_ppe": ["Guantes", "Lentes de seguridad"],
                "source_note": "Bloque generico de herramientas.",
            },
            {
                "hazard_factor": "Proyeccion de particulas al cortar, perforar o esmerilar",
                "master_risk_code": "B6",
                "probability": 2,
                "consequence": 2,
                "control_hierarchy": {
                    "engineering": ["Usar guardas y pantallas"],
                    "administrative": ["Mantener distancia de seguridad y posicion corporal fuera de linea de fuego"],
                    "ppe": ["Proteccion facial o lentes"],
                },
                "required_ppe": ["Lentes de seguridad", "Protector facial"],
                "source_note": "Control de particulas proyectadas.",
            },
        ],
    },
    {
        "block": {
            "code": "ACT-ESP-TRABAJO-ALTURA",
            "name": "Trabajo en altura",
            "description": "Ejecucion de tareas sobre plataformas, estructuras o puntos elevados con potencial de caida.",
            "block_type": "specialty",
            "default_process_name": "Trabajo en altura",
            "default_task_name": "Intervencion sobre superficie o estructura elevada",
            "default_position_name": "Operador en altura",
            "default_owner_name": "Prevencionista / supervisor",
        },
        "hazards": [
            {
                "hazard_factor": "Exposicion a borde abierto o superficie elevada",
                "master_risk_code": "A3",
                "probability": 4,
                "consequence": 4,
                "control_hierarchy": {
                    "elimination": ["Ejecutar a nivel piso cuando sea tecnicamente posible"],
                    "engineering": ["Puntos de anclaje certificados", "Lineas de vida", "Barandas o protecciones colectivas"],
                    "administrative": ["Permiso de trabajo", "Plan de rescate", "Checklist preuso"],
                    "ppe": ["Arnes de seguridad", "Casco con barbiquejo"],
                },
                "required_ppe": ["Arnes de seguridad", "Casco con barbiquejo", "Guantes"],
                "sensitivity_tags": ["altura", "vertigo", "embarazo"],
                "legal_reference": "DS 44 controles preventivos criticos",
                "source_note": "Bloque de especialidad trabajo en altura.",
            },
            {
                "hazard_factor": "Caida de herramientas o materiales a niveles inferiores",
                "master_risk_code": "B2",
                "probability": 2,
                "consequence": 4,
                "control_hierarchy": {
                    "engineering": ["Rodapies, mallas o contencion de bordes"],
                    "administrative": ["Segregar zona inferior", "Asegurar herramientas con piolas"],
                    "ppe": ["Casco con barbiquejo"],
                },
                "required_ppe": ["Casco con barbiquejo"],
                "source_note": "Riesgo critico para terceros bajo el punto de trabajo.",
            },
        ],
    },
    {
        "block": {
            "code": "ACT-ESP-ANDAMIOS",
            "name": "Montaje, uso y desarme de andamios",
            "description": "Armado, inspeccion, habilitacion, uso seguro y desmontaje de andamios.",
            "block_type": "specialty",
            "default_process_name": "Montaje y desmontaje de andamios",
            "default_task_name": "Montaje, uso y desarme de andamios",
            "default_position_name": "Andamiero",
            "default_owner_name": "Supervisor de andamios",
        },
        "hazards": [
            {
                "hazard_factor": "Inestabilidad estructural, nivelacion deficiente o armado fuera de secuencia",
                "master_risk_code": "A3",
                "probability": 4,
                "consequence": 4,
                "control_hierarchy": {
                    "engineering": ["Andamio certificado, nivelado, anclado y con barandas completas"],
                    "administrative": ["Armado por personal competente", "Revision de secuencia y tarjeta de andamio"],
                    "ppe": ["Arnes de seguridad", "Casco con barbiquejo"],
                },
                "required_ppe": ["Arnes de seguridad", "Casco con barbiquejo", "Guantes"],
                "legal_reference": "PTS andamios y plan de inspeccion",
                "source_note": "Bloque especifico de montaje de andamios.",
            },
            {
                "hazard_factor": "Atrapamiento o golpes durante manipulacion de cuerpos, diagonales y plataformas",
                "master_risk_code": "B1",
                "probability": 2,
                "consequence": 2,
                "control_hierarchy": {
                    "engineering": ["Uso de elementos compatibles y en buen estado"],
                    "administrative": ["Coordinacion de maniobras y comunicacion clara durante montaje/desarme"],
                    "ppe": ["Guantes", "Casco"],
                },
                "required_ppe": ["Guantes", "Casco", "Calzado de seguridad"],
                "source_note": "Control de atrapamientos en manipulacion de piezas.",
            },
        ],
    },
]


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on", "si")


def _slugify(value: Any) -> str:
    text = _clean_str(value).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def _normalize_choice(value: Any, allowed: Tuple[str, ...], default: str) -> str:
    text = _clean_str(value, default)
    return text if text in allowed else default


def _json_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _bot_seed(
    code: str,
    name: str,
    *,
    process: str,
    task: str,
    block_type: str = "transversal",
    criticality: str = "medium",
    tags: Optional[List[str]] = None,
    risk_code: str = "A1",
    hazard: str = "Condicion operacional no controlada",
    controls: Optional[Dict[str, List[str]]] = None,
    ppe: Optional[List[str]] = None,
    protocols: Optional[List[str]] = None,
) -> Dict[str, Any]:
    hierarchy = controls or {
        "administrative": ["Aplicar AST/ART, charla previa y supervision directa"],
        "ppe": ppe or ["Casco", "Calzado de seguridad"],
    }
    return {
        "block": {
            "code": code,
            "name": name,
            "description": f"BOT reutilizable para {name.lower()}.",
            "block_type": block_type,
            "origin_scope": "global",
            "default_process_name": process,
            "default_task_name": task,
            "default_position_name": "Personal operativo",
            "default_owner_name": "Supervisor de terreno",
            "base_process": process,
            "base_activity": name,
            "base_task": task,
            "objective": f"Ejecutar {name.lower()} con trazabilidad operacional y preventiva.",
            "context": "Bloque base parametrizable por empresa, cliente, proyecto o faena.",
            "routine_type": "routine",
            "criticality": criticality,
            "status": "active",
            "tags": tags or [],
        },
        "hazards": [
            {
                "hazard_factor": hazard,
                "master_risk_code": risk_code,
                "probability": 2 if criticality != "critical" else 4,
                "consequence": 4 if criticality in ("high", "critical") else 2,
                "control_hierarchy": hierarchy,
                "required_ppe": ppe or ["Casco", "Calzado de seguridad"],
                "protocol_codes": protocols or [],
                "sensitivity_tags": tags or [],
                "source_note": "Seed BOT operacional preventivo.",
            }
        ],
    }


DEFAULT_ACTIVITY_BLOCKS.extend(
    [
        _bot_seed(
            "BOT-TR-INGRESO-AREA",
            "Ingreso al area de trabajo",
            process="Operacion transversal",
            task="Ingreso controlado al area",
            tags=["transversal", "ingreso", "control_acceso"],
            risk_code="A1",
            hazard="Acceso a area sin reconocer condiciones del entorno",
        ),
        _bot_seed(
            "BOT-TR-REVISION-DOC",
            "Revision documental y autorizacion",
            process="Inicio de actividad",
            task="Verificar permisos, AST/ART y documentos aplicables",
            tags=["transversal", "documental", "autorizacion"],
            risk_code="N",
            hazard="Inicio de trabajo sin autorizacion o documentos vigentes",
        ),
        _bot_seed(
            "BOT-TR-CHARLA-AST",
            "Charla de seguridad y AST",
            process="Inicio de actividad",
            task="Difundir riesgos, controles y roles",
            tags=["transversal", "ast", "difusion"],
            risk_code="N",
            hazard="Personal sin entendimiento comun de riesgos y controles",
        ),
        _bot_seed(
            "BOT-TR-SENALIZACION",
            "Delimitacion y senalizacion",
            process="Preparacion del area",
            task="Delimitar y senalizar zona de trabajo",
            tags=["transversal", "segregacion"],
            risk_code="I1",
            hazard="Ingreso de terceros o interferencia con equipos moviles",
            controls={
                "engineering": ["Barreras fisicas, conos, cadenas o cinta de segregacion"],
                "administrative": ["Definir radio de seguridad y mantener control de acceso"],
                "ppe": ["Chaleco reflectante", "Casco"],
            },
            ppe=["Chaleco reflectante", "Casco", "Calzado de seguridad"],
        ),
        _bot_seed(
            "BOT-TR-INSPECCION-HERRAMIENTAS",
            "Inspeccion de herramientas y equipos",
            process="Preparacion del trabajo",
            task="Inspeccionar herramientas, equipos y extensiones",
            tags=["transversal", "herramienta_electrica", "preuso"],
            risk_code="F1",
            hazard="Uso de herramienta o equipo defectuoso",
            controls={
                "elimination": ["Retirar de servicio herramientas defectuosas"],
                "engineering": ["Protecciones y aislacion en buen estado"],
                "administrative": ["Checklist preuso y verificacion electrica"],
                "ppe": ["Lentes de seguridad", "Guantes"],
            },
            ppe=["Lentes de seguridad", "Guantes", "Calzado de seguridad"],
        ),
        _bot_seed(
            "BOT-TR-EPP",
            "Uso y verificacion de EPP",
            process="Preparacion del trabajo",
            task="Verificar EPP requerido y estado de uso",
            tags=["transversal", "epp"],
            risk_code="B5",
            hazard="Exposicion por EPP ausente, incorrecto o deteriorado",
        ),
        _bot_seed(
            "BOT-TR-ORDEN-LIMPIEZA",
            "Orden y limpieza del area",
            process="Control operacional",
            task="Mantener area libre de obstaculos y residuos",
            tags=["transversal", "housekeeping"],
            risk_code="A1",
            hazard="Tropiezos, caidas o interferencias por desorden",
        ),
        _bot_seed(
            "BOT-TR-COORDINACION",
            "Coordinacion con supervisor",
            process="Control operacional",
            task="Coordinar interferencias, permisos y avances",
            tags=["transversal", "supervision"],
            risk_code="N",
            hazard="Falta de coordinacion ante cambios o interferencias",
        ),
        _bot_seed(
            "BOT-TR-CIERRE",
            "Cierre de actividad",
            process="Cierre operacional",
            task="Liberar area, retirar segregacion y cerrar permisos",
            tags=["transversal", "cierre"],
            risk_code="A1",
            hazard="Condiciones remanentes no controladas al finalizar",
        ),
        _bot_seed(
            "BOT-TR-REPORTE-DESVIACIONES",
            "Reporte de incidentes o desviaciones",
            process="Gestion preventiva",
            task="Reportar desviaciones, incidentes y oportunidades de mejora",
            tags=["transversal", "reporte", "incidente"],
            risk_code="N",
            hazard="Desviaciones sin cierre ni aprendizaje preventivo",
        ),
        _bot_seed("BOT-AND-INSPECCION-COMPONENTES", "Inspeccion de componentes de andamio", process="Andamios", task="Inspeccionar componentes", block_type="specialty", criticality="high", tags=["andamios"], risk_code="B5", hazard="Componentes danados o incompatibles"),
        _bot_seed("BOT-AND-TRASLADO-PIEZAS", "Traslado de piezas de andamio", process="Andamios", task="Trasladar piezas", block_type="specialty", criticality="medium", tags=["andamios", "carga"], risk_code="R1", hazard="Sobreesfuerzo o golpes por manipulacion de piezas"),
        _bot_seed("BOT-AND-PREPARACION-BASE", "Preparacion y nivelacion de base", process="Andamios", task="Preparar base", block_type="specialty", criticality="high", tags=["andamios", "base"], risk_code="A3", hazard="Base inestable o desnivelada"),
        _bot_seed("BOT-AND-BASES-REGULABLES", "Instalacion de bases regulables", process="Andamios", task="Instalar bases regulables", block_type="specialty", criticality="high", tags=["andamios"], risk_code="A3", hazard="Apoyo deficiente o perdida de estabilidad"),
        _bot_seed("BOT-AND-MARCOS-CUERPOS", "Montaje de marcos y cuerpos", process="Andamios", task="Montar marcos y cuerpos", block_type="specialty", criticality="critical", tags=["andamios", "altura"], risk_code="A3", hazard="Caida durante montaje de estructura"),
        _bot_seed("BOT-AND-DIAGONALES", "Instalacion de diagonales", process="Andamios", task="Instalar diagonales", block_type="specialty", criticality="high", tags=["andamios"], risk_code="A3", hazard="Perdida de rigidez estructural"),
        _bot_seed("BOT-AND-PLATAFORMAS", "Instalacion de plataformas", process="Andamios", task="Instalar plataformas", block_type="specialty", criticality="critical", tags=["andamios", "altura"], risk_code="A3", hazard="Caida por plataforma incompleta o mal instalada"),
        _bot_seed("BOT-AND-BARANDAS-RODAPIE", "Instalacion de barandas y rodapies", process="Andamios", task="Instalar protecciones colectivas", block_type="specialty", criticality="critical", tags=["andamios", "altura"], risk_code="A3", hazard="Borde abierto o caida de objetos"),
        _bot_seed("BOT-AND-HABILITACION", "Inspeccion y habilitacion del andamio", process="Andamios", task="Inspeccionar y habilitar", block_type="specialty", criticality="critical", tags=["andamios", "inspeccion"], risk_code="A3", hazard="Uso de andamio sin aprobacion tecnica"),
        _bot_seed("BOT-AND-USO-SEGURO", "Uso seguro de andamio", process="Andamios", task="Usar andamio habilitado", block_type="specialty", criticality="critical", tags=["andamios", "altura"], risk_code="A3", hazard="Caida de altura durante uso de plataforma"),
        _bot_seed("BOT-AND-MODIFICACION", "Modificacion de andamio", process="Andamios", task="Modificar andamio autorizado", block_type="specialty", criticality="critical", tags=["andamios", "cambio"], risk_code="A3", hazard="Alteracion no controlada de estructura"),
        _bot_seed("BOT-AND-DESARME", "Desarme secuencial de andamio", process="Andamios", task="Desarmar por secuencia", block_type="specialty", criticality="critical", tags=["andamios", "altura"], risk_code="A3", hazard="Caida o colapso por desarme fuera de secuencia"),
        _bot_seed("BOT-AND-ACOPIO-RETIRO", "Acopio y retiro de componentes", process="Andamios", task="Acopiar y retirar componentes", block_type="specialty", criticality="medium", tags=["andamios", "orden"], risk_code="B2", hazard="Caida de objetos o golpes por acopio deficiente"),
        _bot_seed("BOT-ALT-AUTORIZACION", "Verificacion de autorizacion para trabajo en altura", process="Trabajo en altura", task="Verificar autorizacion", block_type="critical", criticality="critical", tags=["altura", "autorizacion"], risk_code="A3", hazard="Trabajo en altura sin autorizacion o aptitud validada", ppe=["Arnes de seguridad", "Casco con barbiquejo"]),
        _bot_seed("BOT-ALT-SPDC", "Revision de sistema personal de detencion de caidas", process="Trabajo en altura", task="Revisar SPDC", block_type="critical", criticality="critical", tags=["altura", "spdc"], risk_code="A3", hazard="Sistema anticaidas incompleto o deteriorado", ppe=["Arnes de seguridad", "Casco con barbiquejo"]),
        _bot_seed("BOT-ALT-ACCESO-SEGURO", "Acceso seguro a plataforma o estructura", process="Trabajo en altura", task="Acceder de forma segura", block_type="critical", criticality="critical", tags=["altura", "acceso"], risk_code="A3", hazard="Caida durante acceso o transito vertical", ppe=["Arnes de seguridad", "Casco con barbiquejo"]),
        _bot_seed("BOT-ALT-EJECUCION", "Ejecucion de tarea en altura", process="Trabajo en altura", task="Ejecutar tarea en altura", block_type="critical", criticality="critical", tags=["altura"], risk_code="A3", hazard="Caida de altura durante la ejecucion", ppe=["Arnes de seguridad", "Casco con barbiquejo"]),
        _bot_seed("BOT-ALT-ASEGURAMIENTO-HERR", "Aseguramiento de herramientas y materiales", process="Trabajo en altura", task="Asegurar herramientas y materiales", block_type="critical", criticality="high", tags=["altura", "caida_objetos"], risk_code="B2", hazard="Caida de herramientas o materiales a distinto nivel", ppe=["Casco con barbiquejo", "Guantes"]),
        _bot_seed("BOT-ALT-BORDE-ABERTURA", "Trabajo en borde o abertura", process="Trabajo en altura", task="Controlar borde o abertura", block_type="critical", criticality="critical", tags=["altura", "borde"], risk_code="A3", hazard="Exposicion directa a borde abierto o abertura", ppe=["Arnes de seguridad", "Casco con barbiquejo"]),
        _bot_seed("BOT-ALT-DESCENSO", "Descenso controlado", process="Trabajo en altura", task="Descender de forma controlada", block_type="critical", criticality="critical", tags=["altura", "descenso"], risk_code="A3", hazard="Caida durante descenso o retiro de sistema", ppe=["Arnes de seguridad", "Casco con barbiquejo"]),
        _bot_seed("BOT-ALT-CIERRE", "Cierre y liberacion del area de altura", process="Trabajo en altura", task="Cerrar y liberar area", block_type="critical", criticality="high", tags=["altura", "cierre"], risk_code="B2", hazard="Objetos o condiciones remanentes en altura", ppe=["Casco con barbiquejo", "Guantes"]),
    ]
)


ASEO_OFFICE_MIPER_ROWS: List[Dict[str, Any]] = [
    {
        "activity": "Aseo Industrial",
        "task": "Limpieza",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Equipos sin mantenciones y con desperfectos electricos",
        "risk_context": "Contacto con electricidad",
        "current_admin": "Difusion ODI, atencion al transito y a las condiciones del entorno. Revisar equipos antes de utilizar.",
        "current_ppe": "Calzado de seguridad, guantes de nitrilo o latex, lentes de seguridad.",
        "pe": 1,
        "fe": 2,
        "fo": 1,
        "severity": 2,
        "plan": "Mantener inspeccion preuso y retirar equipos defectuosos.",
    },
    {
        "activity": "Aseo Industrial",
        "task": "Limpieza",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Contacto con agentes quimicos",
        "risk_context": "Contacto con sustancias quimicas",
        "current_admin": "Difusion ODI y HDS de productos quimicos. Uso de productos diluidos segun indicacion del fabricante.",
        "current_ppe": "Calzado de seguridad, guantes de nitrilo o latex, lentes de seguridad.",
        "pe": 1,
        "fe": 1,
        "fo": 1,
        "severity": 2,
        "plan": "Verificar HDS, rotulado y almacenamiento compatible.",
    },
    {
        "activity": "Aseo Industrial",
        "task": "Traslado y manejo de residuos domiciliarios",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Almacenamiento incorrecto, agentes quimicos y manejo de material cortopunzante",
        "risk_context": "Contacto con objeto cortante/punzante, exposicion a riesgos biologicos y manejo manual de carga",
        "current_admin": "Trasladar residuos en bolsa cerrada, no compactar con manos, segregar objetos cortopunzantes y respetar tecnica de levantamiento.",
        "current_ppe": "Guantes de nitrilo o latex, calzado de seguridad, lentes de seguridad.",
        "pe": 1,
        "fe": 2,
        "fo": 1,
        "severity": 2,
        "plan": "Reforzar segregacion y reporte de residuos peligrosos o cortopunzantes.",
    },
    {
        "activity": "Aseo Industrial",
        "task": "Traslado y manejo de residuos domiciliarios",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Pisos fuera de estandar, superficies irregulares y desplazamiento con residuos",
        "risk_context": "Caidas al mismo nivel",
        "current_admin": "Mantener rutas despejadas, transitar atento a desniveles y retirar derrames de forma inmediata.",
        "current_ppe": "Calzado de seguridad antideslizante.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 1,
        "plan": "Mantener control de orden y limpieza de rutas.",
    },
    {
        "activity": "Aseo Industrial",
        "task": "Mantencion y aseo",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Operacion o mantencion de equipos energizados",
        "risk_context": "Contacto con electricidad y golpeado por o contra objetos",
        "current_admin": "No intervenir equipos energizados, informar anomalias y bloquear uso de equipos defectuosos.",
        "current_ppe": "Calzado de seguridad, guantes, lentes de seguridad.",
        "pe": 1,
        "fe": 2,
        "fo": 1,
        "severity": 2,
        "plan": "Validar mantenciones e inspeccion electrica periodica.",
    },
    {
        "activity": "Retiro de Basuras Domiciliarias",
        "task": "Retiro de residuos",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Manejo manual de carga",
        "risk_context": "Exposicion a manejo manual de carga",
        "current_admin": "Evaluar peso, usar tecnica de levantamiento, solicitar apoyo y evitar sobreesfuerzo.",
        "current_ppe": "Guantes, calzado de seguridad.",
        "pe": 1,
        "fe": 2,
        "fo": 1,
        "severity": 2,
        "plan": "Capacitar en MMC y controlar peso maximo por bolsa/contenedor.",
    },
    {
        "activity": "Retiro de Basuras Domiciliarias",
        "task": "Retiro de residuos",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Iluminacion insuficiente",
        "risk_context": "Caidas al mismo nivel",
        "current_admin": "Transitar por rutas iluminadas y reportar luminarias defectuosas.",
        "current_ppe": "Calzado de seguridad.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 1,
        "plan": "Corregir iluminacion y senalizar zonas deficientes.",
    },
    {
        "activity": "Retiro de Basuras Domiciliarias",
        "task": "Retiro de residuos",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Espacio reducido",
        "risk_context": "Caidas al mismo nivel y golpeado contra objetos",
        "current_admin": "Mantener pasillos despejados, evitar maniobras forzadas y controlar puntos de atrapamiento.",
        "current_ppe": "Calzado de seguridad, guantes.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 1,
        "plan": "Revisar layout de bodegas y zonas de residuos.",
    },
    {
        "activity": "Retiro de Basuras Domiciliarias",
        "task": "Retiro de residuos",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Movimiento repetitivo",
        "risk_context": "Exposicion a movimientos repetitivos y golpeado contra objetos",
        "current_admin": "Aplicar pausas, alternar tareas y reportar molestias musculoesqueleticas.",
        "current_ppe": "Guantes, calzado de seguridad.",
        "pe": 1,
        "fe": 2,
        "fo": 1,
        "severity": 2,
        "plan": "Evaluar TMERT si la tarea se vuelve sostenida.",
    },
    {
        "activity": "Retiro de Basuras Domiciliarias",
        "task": "Retiro de residuos",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Falta de orden y aseo",
        "risk_context": "Golpeado por objeto y caidas al mismo nivel",
        "current_admin": "Mantener sector limpio, controlar apilamiento y retirar obstaculos.",
        "current_ppe": "Calzado de seguridad, guantes.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 1,
        "plan": "Implementar checklist de orden y limpieza.",
    },
    {
        "activity": "Servicio de Estafeta",
        "task": "Retiro y entrega de documentos",
        "position": "Estafeta",
        "hazard_factor": "Actividades administrativas en terreno",
        "risk_context": "Caidas a mismo y distinto nivel, golpeado por o contra objetos",
        "current_admin": "Transitar por rutas autorizadas, usar pasamanos y mantener atencion a escaleras, pisos y puertas.",
        "current_ppe": "Calzado cerrado de seguridad cuando aplique.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 1,
        "plan": "Mantener induccion de rutas seguras y control de terceros.",
    },
    {
        "activity": "Servicio de Estafeta",
        "task": "Retiro de correspondencia",
        "position": "Estafeta",
        "hazard_factor": "Pisos desnivelados y transito en exterior",
        "risk_context": "Caida a distinto nivel, atropello y exposicion a radiacion no ionizante",
        "current_admin": "Cruzar por pasos habilitados, respetar transito, usar rutas seguras y evitar exposicion prolongada al sol.",
        "current_ppe": "Calzado cerrado, proteccion solar segun exposicion.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 1,
        "plan": "Controlar rutas externas y horarios de mayor exposicion.",
    },
    {
        "activity": "Servicio de Estafeta",
        "task": "Apoyo almacenamiento y bodegas",
        "position": "Estafeta / apoyo bodega",
        "hazard_factor": "Falta de orden y aseo, manejo manual de carga",
        "risk_context": "Caidas al mismo nivel, golpeado por o contra objetos y exposicion a manejo manual de carga",
        "current_admin": "Ordenar materiales, mantener pasillos despejados, usar tecnica de levantamiento y solicitar apoyo.",
        "current_ppe": "Guantes, calzado de seguridad.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 1,
        "plan": "Mantener estiba segura y control de peso.",
    },
    {
        "activity": "Servicio de Estafeta",
        "task": "Apoyo almacenamiento y bodegas",
        "position": "Estafeta / conductor",
        "hazard_factor": "Conduccion de vehiculo",
        "risk_context": "Atropello o colision",
        "current_admin": "Conduccion defensiva, respetar velocidad, inspeccion visual del vehiculo y uso de cinturon.",
        "current_ppe": "Chaleco reflectante en zonas de transito.",
        "pe": 1,
        "fe": 2,
        "fo": 1,
        "severity": 3,
        "plan": "Validar licencia, autorizacion interna y plan de ruta.",
    },
    {
        "activity": "Limpieza Manual",
        "task": "Transporte y preparacion de materiales",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Manejo manual de carga y sobreesfuerzo",
        "risk_context": "Exposicion a manejo manual de carga",
        "current_admin": "Distribuir cargas, usar carros cuando existan y evitar posturas forzadas.",
        "current_ppe": "Guantes, calzado de seguridad.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 1,
        "plan": "Mantener carros disponibles y capacitar en MMC.",
    },
    {
        "activity": "Limpieza Manual",
        "task": "Manipulacion de sustancias peligrosas",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Riesgos con sustancias peligrosas",
        "risk_context": "Exposicion a sustancias peligrosas y alergias",
        "current_engineering": "Productos quimicos menos agresivos cuando sea tecnicamente posible.",
        "current_admin": "HDS disponible, rotulado, dilucion autorizada, no mezclar productos incompatibles.",
        "current_ppe": "Guantes de nitrilo o latex, lentes de seguridad, respirador si HDS lo exige.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 2,
        "plan": "Mantener inventario quimico, HDS y sustitucion cuando aplique.",
    },
    {
        "activity": "Limpieza Manual",
        "task": "Prelavado, lavado y secado",
        "position": "Auxiliar de Aseo",
        "hazard_factor": "Manejo de objetos cortopunzantes",
        "risk_context": "Contacto con objetos cortopunzantes",
        "current_admin": "Inspeccionar visualmente antes de manipular, no introducir manos en bolsas o recipientes sin ver contenido.",
        "current_ppe": "Guantes, calzado de seguridad, lentes de seguridad.",
        "pe": 1,
        "fe": 3,
        "fo": 1,
        "severity": 2,
        "plan": "Reportar y segregar cortopunzantes encontrados.",
    },
]


def _aseo_office_risk_code(row: Dict[str, Any]) -> str:
    text = f"{row.get('hazard_factor') or ''} {row.get('risk_context') or ''}".lower()
    if any(token in text for token in ("electric", "energiz")):
        return "F1"
    if any(token in text for token in ("sustancia", "quimic", "alerg")):
        return "O4"
    if any(token in text for token in ("cortopunz", "cortante", "punzante")):
        return "B3"
    if "biologic" in text:
        return "Q2"
    if any(token in text for token in ("manual de carga", "sobreesfuerzo", "mmc")):
        return "R1"
    if "repetitivo" in text:
        return "S1"
    if any(token in text for token in ("atropello", "colision", "vehiculo")):
        return "I1"
    if any(token in text for token in ("distinto nivel", "diferente nivel")):
        return "A2"
    if "caida" in text or "caidas" in text:
        return "A1"
    if any(token in text for token in ("golpeado", "golpe")):
        return "B5"
    return "N"


def _split_seed_items(value: str) -> List[str]:
    normalized = str(value or "").replace(".", ",").replace(";", ",")
    items = [item.strip() for item in normalized.split(",") if item.strip()]
    return dedupe_preserve_order(items)


def _build_aseo_office_bot_blueprints() -> List[Dict[str, Any]]:
    grouped: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
    for row in ASEO_OFFICE_MIPER_ROWS:
        key = (
            _clean_str(row.get("activity")),
            _clean_str(row.get("task")),
            _clean_str(row.get("position")),
        )
        grouped.setdefault(key, []).append(row)

    blueprints: List[Dict[str, Any]] = []
    for index, ((activity, task, position), rows) in enumerate(grouped.items(), start=1):
        hazards: List[Dict[str, Any]] = []
        for order, row in enumerate(rows, start=1):
            controls = {
                "engineering": _split_seed_items(row.get("current_engineering", "")),
                "administrative": _split_seed_items(row.get("current_admin", "")),
                "ppe": _split_seed_items(row.get("current_ppe", "")),
            }
            hazards.append(
                {
                    "hazard_factor": row.get("hazard_factor") or "",
                    "master_risk_code": _aseo_office_risk_code(row),
                    "risk_description_contextual": row.get("risk_context") or "",
                    "probable_damage_contextual": row.get("risk_context") or "",
                    "probability": 2,
                    "consequence": 4 if (_safe_int(row.get("severity"), 2) or 2) >= 3 else 2,
                    "task_type_code": "R",
                    "exposed_people_value": row.get("pe") or 1,
                    "exposure_frequency_value": row.get("fe") or 2,
                    "occurrence_factor_value": row.get("fo") or 1,
                    "severity_value": row.get("severity") or 2,
                    "current_engineering_controls": row.get("current_engineering") or "",
                    "current_admin_controls": row.get("current_admin") or "",
                    "current_ppe_controls": row.get("current_ppe") or "",
                    "proposed_elimination_controls": [],
                    "proposed_substitution_controls": [],
                    "proposed_engineering_controls": controls.get("engineering") or [],
                    "proposed_admin_controls": controls.get("administrative") or [],
                    "proposed_ppe_controls": controls.get("ppe") or [],
                    "safety_management_plan": row.get("plan") or "",
                    "controls_summary": summarize_controls(controls, ""),
                    "control_hierarchy": controls,
                    "required_ppe": controls.get("ppe") or [],
                    "protocol_codes": ["MMC"] if _aseo_office_risk_code(row) == "R1" else [],
                    "sensitivity_tags": ["aseo", "oficinas", "miper_compacta"],
                    "source_note": "Seed interno desde matriz MIPER aseo/oficinas.",
                    "display_order": order * 10,
                }
            )
        blueprints.append(
            {
                "block": {
                    "code": f"BOT-AO-{index:03d}",
                    "name": task or activity or f"Aseo/oficinas {index}",
                    "description": f"BOT semilla para {activity} - {task}.",
                    "block_type": "specialty",
                    "origin_scope": "global",
                    "default_process_name": activity,
                    "default_task_name": task,
                    "default_position_name": position or "Personal operativo",
                    "default_owner_name": "Supervisor de aseo",
                    "base_process": activity,
                    "base_activity": activity,
                    "base_task": task,
                    "objective": f"Ejecutar {task.lower()} controlando peligros de aseo, oficina y servicios generales.",
                    "context": "Seed preventivo basado en matriz compacta PE+FE+FO x S para servicios de aseo y oficinas.",
                    "routine_type": "routine",
                    "criticality": "medium",
                    "status": "active",
                    "tags": ["aseo", "oficinas", "miper_compacta"],
                },
                "hazards": hazards,
            }
        )
    return blueprints


DEFAULT_ACTIVITY_BLOCKS.extend(_build_aseo_office_bot_blueprints())


def _risk_by_id_map(company_id: Optional[int]) -> Dict[int, Any]:
    if not company_id:
        return {}
    try:
        from modules.safety.module_safety import SafetyMasterRisk, seed_default_miper_catalog

        seed_default_miper_catalog(company_id)
        return {
            risk.id: risk
            for risk in SafetyMasterRisk.search([("company_id", "=", company_id)])
            if risk.id and risk.active
        }
    except Exception:
        return {}


def _risk_by_code_map(company_id: Optional[int]) -> Dict[str, Any]:
    return {
        _clean_str(getattr(risk, "isp_code", "")).upper(): risk
        for risk in _risk_by_id_map(company_id).values()
        if _clean_str(getattr(risk, "isp_code", ""))
    }


class SafetyActivityBlock(BaseModel, AuditMixin):
    """Reusable operational activity block."""

    __tablename__ = "safety_activity_blocks"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    code = Column(ColumnType.STRING, required=True, label="Code")
    name = Column(ColumnType.STRING, required=True, label="Name")
    description = Column(ColumnType.TEXT, label="Description")
    block_type = Column(ColumnType.STRING, default="generic", label="Block Type")
    slug = Column(ColumnType.STRING, label="Slug")
    origin_scope = Column(ColumnType.STRING, default="global", label="Origin Scope")
    default_process_name = Column(ColumnType.STRING, label="Default Process")
    default_task_name = Column(ColumnType.STRING, label="Default Task")
    default_position_name = Column(ColumnType.STRING, label="Default Position")
    default_owner_name = Column(ColumnType.STRING, label="Default Owner")
    base_process = Column(ColumnType.STRING, label="Base Process")
    base_subprocess = Column(ColumnType.STRING, label="Base Subprocess")
    base_activity = Column(ColumnType.STRING, label="Base Activity")
    base_task = Column(ColumnType.STRING, label="Base Task")
    objective = Column(ColumnType.TEXT, label="Objective")
    context = Column(ColumnType.TEXT, label="Operational Context")
    job_role_id = Column(ColumnType.INTEGER, label="Job Role")
    suggested_responsible_id = Column(ColumnType.INTEGER, label="Suggested Responsible")
    routine_type = Column(ColumnType.STRING, default="routine", label="Routine Type")
    criticality = Column(ColumnType.STRING, default="medium", label="Criticality")
    status = Column(ColumnType.STRING, default="active", label="Status")
    project_id = Column(ColumnType.INTEGER, label="Project")
    version = Column(ColumnType.INTEGER, default=1, label="Version")
    archived_at = Column(ColumnType.STRING, label="Archived At")
    parent_block_id = Column(ColumnType.INTEGER, label="Parent Block")
    inheritance_mode = Column(ColumnType.STRING, default="copied", label="Inheritance Mode")
    tags = Column(ColumnType.JSON, default=[], label="Tags")
    conditions_previous = Column(ColumnType.JSON, default=[], label="Previous Conditions")
    conditions_close = Column(ColumnType.JSON, default=[], label="Close Conditions")
    resources_summary = Column(ColumnType.JSON, default=[], label="Resources")
    tools_summary = Column(ColumnType.JSON, default=[], label="Tools")
    materials_summary = Column(ColumnType.JSON, default=[], label="Materials")
    notes_internal = Column(ColumnType.TEXT, label="Internal Notes")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.code = _clean_str(self.code).upper()
        self.block_type = _clean_str(self.block_type, "generic")
        self.slug = _slugify(self.slug or self.name or self.code)
        self.origin_scope = _normalize_choice(self.origin_scope, BOT_ORIGIN_SCOPES, "global")
        self.base_process = _clean_str(self.base_process) or _clean_str(self.default_process_name)
        self.base_task = _clean_str(self.base_task) or _clean_str(self.default_task_name)
        self.base_activity = _clean_str(self.base_activity) or _clean_str(self.name)
        self.routine_type = _normalize_choice(self.routine_type, BOT_ROUTINE_TYPES, "routine")
        self.criticality = _normalize_choice(self.criticality, BOT_CRITICALITIES, "medium")
        self.status = _normalize_choice(self.status, BOT_STATUSES, "active")
        self.version = _safe_int(self.version, 1) or 1
        self.tags = normalize_string_list(self.tags)
        self.conditions_previous = normalize_string_list(self.conditions_previous)
        self.conditions_close = normalize_string_list(self.conditions_close)
        self.resources_summary = normalize_string_list(self.resources_summary)
        self.tools_summary = normalize_string_list(self.tools_summary)
        self.materials_summary = normalize_string_list(self.materials_summary)

    def before_save(self):
        self.before_create()
        if self.status == "archived" and not _clean_str(self.archived_at):
            self.archived_at = utc_now_iso()
        if self.status != "archived":
            self.archived_at = ""

    def validate(self):
        super().validate()
        if not _clean_str(self.code):
            raise ValidationError("Activity block code is required")
        if not _clean_str(self.name):
            raise ValidationError("Activity block name is required")
        if _clean_str(self.block_type, "generic") not in ACTIVITY_BLOCK_TYPES:
            raise ValidationError(
                "block_type must be one of: " + ", ".join(ACTIVITY_BLOCK_TYPES)
            )

        duplicates = SafetyActivityBlock.search(
            [("company_id", "=", self.company_id), ("code", "=", _clean_str(self.code).upper())]
        )
        for candidate in duplicates:
            if candidate.id != self.id and candidate.active:
                raise ValidationError("Another activity block already uses this code")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "code": self.code or "",
            "name": self.name or "",
            "description": self.description or "",
            "block_type": self.block_type or "generic",
            "block_type_label": BOT_TYPE_LABELS.get(self.block_type or "generic", self.block_type or "generic"),
            "slug": self.slug or _slugify(self.name or self.code),
            "origin_scope": self.origin_scope or "global",
            "default_process_name": self.default_process_name or "",
            "default_task_name": self.default_task_name or "",
            "default_position_name": self.default_position_name or "",
            "default_owner_name": self.default_owner_name or "",
            "base_process": self.base_process or self.default_process_name or "",
            "base_subprocess": self.base_subprocess or "",
            "base_activity": self.base_activity or self.name or "",
            "base_task": self.base_task or self.default_task_name or "",
            "objective": self.objective or "",
            "context": self.context or "",
            "job_role_id": self.job_role_id,
            "suggested_responsible_id": self.suggested_responsible_id,
            "routine_type": self.routine_type or "routine",
            "criticality": self.criticality or "medium",
            "status": self.status or ("active" if self.active else "archived"),
            "project_id": self.project_id,
            "version": _safe_int(self.version, 1) or 1,
            "archived_at": self.archived_at or "",
            "parent_block_id": self.parent_block_id,
            "inheritance_mode": self.inheritance_mode or "copied",
            "tags": normalize_string_list(self.tags),
            "conditions_previous": normalize_string_list(self.conditions_previous),
            "conditions_close": normalize_string_list(self.conditions_close),
            "resources_summary": normalize_string_list(self.resources_summary),
            "tools_summary": normalize_string_list(self.tools_summary),
            "materials_summary": normalize_string_list(self.materials_summary),
            "notes_internal": self.notes_internal or "",
            "active": bool(self.active),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyActivityResource(BaseModel, AuditMixin):
    """Tool, equipment, material or document required by a BOT."""

    __tablename__ = "safety_activity_resources"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    block_id = Column(ColumnType.INTEGER, required=True, label="Block")
    resource_type = Column(ColumnType.STRING, default="tool", label="Resource Type")
    name = Column(ColumnType.STRING, required=True, label="Name")
    description = Column(ColumnType.TEXT, label="Description")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.resource_type = _clean_str(self.resource_type, "tool")

    def before_save(self):
        self.before_create()

    def validate(self):
        super().validate()
        if self.resource_type not in ("tool", "equipment", "material", "document"):
            raise ValidationError("resource_type must be tool, equipment, material or document")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "block_id": self.block_id,
            "resource_type": self.resource_type or "tool",
            "name": self.name or "",
            "description": self.description or "",
            "active": bool(self.active),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyHazardMaster(BaseModel, AuditMixin):
    """Reusable hazard catalog entry."""

    __tablename__ = "safety_hazard_master"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    code = Column(ColumnType.STRING, required=True, label="Code")
    category = Column(ColumnType.STRING, label="Category")
    factor_type = Column(ColumnType.STRING, label="Factor Type")
    name = Column(ColumnType.STRING, required=True, label="Name")
    description = Column(ColumnType.TEXT, label="Description")
    default_legal_reference = Column(ColumnType.TEXT, label="Legal Reference")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.code = _clean_str(self.code).upper()

    def before_save(self):
        self.before_create()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "code": self.code or "",
            "category": self.category or "",
            "factor_type": self.factor_type or "",
            "name": self.name or "",
            "description": self.description or "",
            "default_legal_reference": self.default_legal_reference or "",
            "active": bool(self.active),
        }


class SafetyRiskMaster(BaseModel, AuditMixin):
    """Reusable risk catalog entry linked to a hazard master."""

    __tablename__ = "safety_risk_master"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    code = Column(ColumnType.STRING, required=True, label="Code")
    hazard_master_id = Column(ColumnType.INTEGER, label="Hazard Master")
    legacy_master_risk_id = Column(ColumnType.INTEGER, label="Legacy Master Risk")
    name = Column(ColumnType.STRING, required=True, label="Name")
    probable_damage = Column(ColumnType.TEXT, label="Probable Damage")
    default_consequence_level = Column(ColumnType.INTEGER, default=2, label="Default Consequence")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.code = _clean_str(self.code).upper()

    def before_save(self):
        self.before_create()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "code": self.code or "",
            "hazard_master_id": self.hazard_master_id,
            "legacy_master_risk_id": self.legacy_master_risk_id,
            "name": self.name or "",
            "probable_damage": self.probable_damage or "",
            "default_consequence_level": _safe_int(self.default_consequence_level, 2) or 2,
            "active": bool(self.active),
        }


class SafetyTag(BaseModel, AuditMixin):
    __tablename__ = "safety_tags"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    name = Column(ColumnType.STRING, required=True, label="Name")
    group = Column(ColumnType.STRING, label="Group")
    color = Column(ColumnType.STRING, label="Color")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.name = _clean_str(self.name).lower()

    def before_save(self):
        self.before_create()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "name": self.name or "",
            "group": self.group or "",
            "color": self.color or "",
            "active": bool(self.active),
        }


class SafetyTaggable(BaseModel, AuditMixin):
    __tablename__ = "safety_taggables"
    __displayname__ = "entity_type"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    tag_id = Column(ColumnType.INTEGER, required=True, label="Tag")
    entity_type = Column(ColumnType.STRING, required=True, label="Entity Type")
    entity_id = Column(ColumnType.INTEGER, required=True, label="Entity")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "tag_id": self.tag_id,
            "entity_type": self.entity_type or "",
            "entity_id": self.entity_id,
            "active": bool(self.active),
        }


class SafetyBlockVersion(BaseModel, AuditMixin):
    __tablename__ = "safety_block_versions"
    __displayname__ = "block_code"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    block_id = Column(ColumnType.INTEGER, required=True, label="Block")
    block_code = Column(ColumnType.STRING, label="Block Code")
    version = Column(ColumnType.INTEGER, default=1, label="Version")
    snapshot = Column(ColumnType.JSON, default={}, label="Snapshot")
    change_note = Column(ColumnType.TEXT, label="Change Note")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.snapshot = _json_dict(self.snapshot)
        self.version = _safe_int(self.version, 1) or 1

    def before_save(self):
        self.before_create()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "block_id": self.block_id,
            "block_code": self.block_code or "",
            "version": _safe_int(self.version, 1) or 1,
            "snapshot": _json_dict(self.snapshot),
            "change_note": self.change_note or "",
            "active": bool(self.active),
            "created_at": _fmt_dt(self._data.get("created_at")),
        }


class SafetyActivityHazard(BaseModel, AuditMixin):
    """Hazard/risk association for an activity block."""

    __tablename__ = "safety_activity_hazards"
    __displayname__ = "hazard_factor"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    activity_block_id = Column(ColumnType.INTEGER, required=True, label="Activity Block")
    hazard_factor = Column(ColumnType.STRING, required=True, label="Hazard")
    master_risk_id = Column(ColumnType.INTEGER, required=True, label="Master Risk")
    hazard_master_id = Column(ColumnType.INTEGER, label="Hazard Master")
    risk_master_id = Column(ColumnType.INTEGER, label="Risk Master")
    hazard_description_contextual = Column(ColumnType.TEXT, label="Contextual Hazard")
    risk_description_contextual = Column(ColumnType.TEXT, label="Contextual Risk")
    probable_damage_contextual = Column(ColumnType.TEXT, label="Probable Damage")
    probability = Column(ColumnType.INTEGER, default=2, label="Probability")
    consequence = Column(ColumnType.INTEGER, default=2, label="Consequence")
    risk_level_value = Column(ColumnType.INTEGER, label="Risk Value")
    risk_level_label = Column(ColumnType.STRING, label="Risk Level")
    task_type_code = Column(ColumnType.STRING, default="R", label="Task Type")
    exposed_people_value = Column(ColumnType.INTEGER, default=1, label="Exposed People")
    exposure_frequency_value = Column(ColumnType.INTEGER, default=1, label="Exposure Frequency")
    occurrence_factor_value = Column(ColumnType.INTEGER, default=1, label="Occurrence Factor")
    probability_score = Column(ColumnType.INTEGER, label="MIPER Probability")
    severity_value = Column(ColumnType.INTEGER, default=2, label="Severity")
    residual_risk_value = Column(ColumnType.INTEGER, label="Residual Risk")
    residual_risk_label = Column(ColumnType.STRING, label="Residual Risk Label")
    current_engineering_controls = Column(ColumnType.TEXT, label="Current Engineering Controls")
    current_admin_controls = Column(ColumnType.TEXT, label="Current Admin Controls")
    current_ppe_controls = Column(ColumnType.TEXT, label="Current PPE Controls")
    proposed_elimination_controls = Column(ColumnType.JSON, default=[], label="Proposed Elimination")
    proposed_substitution_controls = Column(ColumnType.JSON, default=[], label="Proposed Substitution")
    proposed_engineering_controls = Column(ColumnType.JSON, default=[], label="Proposed Engineering")
    proposed_admin_controls = Column(ColumnType.JSON, default=[], label="Proposed Admin")
    proposed_ppe_controls = Column(ColumnType.JSON, default=[], label="Proposed PPE")
    safety_management_plan = Column(ColumnType.TEXT, label="S&SO Plan")
    controls_summary = Column(ColumnType.TEXT, label="Controls")
    control_hierarchy = Column(ColumnType.JSON, default={}, label="Control Hierarchy")
    substitution_controls = Column(ColumnType.JSON, default=[], label="Substitution Controls")
    required_ppe = Column(ColumnType.JSON, default=[], label="Required PPE")
    protocol_codes = Column(ColumnType.JSON, default=[], label="Protocols")
    sensitivity_tags = Column(ColumnType.JSON, default=[], label="Sensitivity Tags")
    legal_reference = Column(ColumnType.STRING, label="Legal Reference")
    source_note = Column(ColumnType.TEXT, label="Source Note")
    display_order = Column(ColumnType.INTEGER, default=10, label="Order")
    approval_blocked = Column(ColumnType.BOOLEAN, default=False, label="Approval Blocked")
    mitigation_required = Column(ColumnType.BOOLEAN, default=False, label="Mitigation Required")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.required_ppe = normalize_string_list(self.required_ppe)
        self.protocol_codes = normalize_string_list(self.protocol_codes)
        self.sensitivity_tags = normalize_string_list(self.sensitivity_tags)
        self.control_hierarchy = normalize_control_hierarchy(self.control_hierarchy)
        substitution = normalize_string_list(self.substitution_controls)
        if substitution:
            self.control_hierarchy["substitution"] = dedupe_preserve_order(
                self.control_hierarchy.get("substitution", []) + substitution
            )
        self.substitution_controls = self.control_hierarchy.get("substitution", [])
        risk_result = calculate_risk(self.probability, self.consequence)
        self.risk_level_value = risk_result["risk_level_value"]
        self.risk_level_label = risk_result["risk_level_label"]
        self.approval_blocked = risk_result["approval_blocked"]
        self.mitigation_required = risk_result["mitigation_required"]
        self.task_type_code = normalize_task_type_code(self.task_type_code)
        self.proposed_elimination_controls = normalize_string_list(
            self.proposed_elimination_controls or self.control_hierarchy.get("elimination")
        )
        self.proposed_substitution_controls = normalize_string_list(
            self.proposed_substitution_controls or self.control_hierarchy.get("substitution")
        )
        self.proposed_engineering_controls = normalize_string_list(
            self.proposed_engineering_controls or self.control_hierarchy.get("engineering")
        )
        self.proposed_admin_controls = normalize_string_list(
            self.proposed_admin_controls or self.control_hierarchy.get("administrative")
        )
        self.proposed_ppe_controls = normalize_string_list(
            self.proposed_ppe_controls or self.control_hierarchy.get("ppe")
        )
        compact = calculate_compact_miper(
            self.exposed_people_value,
            self.exposure_frequency_value,
            self.occurrence_factor_value,
            self.severity_value or self.consequence,
        )
        self.exposed_people_value = compact["exposed_people_value"]
        self.exposure_frequency_value = compact["exposure_frequency_value"]
        self.occurrence_factor_value = compact["occurrence_factor_value"]
        self.probability_score = compact["probability_score"]
        self.severity_value = compact["severity_value"]
        self.residual_risk_value = compact["residual_risk_value"]
        self.residual_risk_label = compact["residual_risk_label"]

    def before_save(self):
        self.before_create()
        self.controls_summary = _clean_str(self.controls_summary) or summarize_controls(
            self.control_hierarchy,
            "",
        )

    def validate(self):
        super().validate()
        if not self.activity_block_id:
            raise ValidationError("activity_block_id is required")
        if not _clean_str(self.hazard_factor):
            raise ValidationError("hazard_factor is required")
        if not self.master_risk_id:
            raise ValidationError("master_risk_id is required")
        if _safe_int(self.probability, 0) not in (1, 2, 4):
            raise ValidationError("probability must be one of 1, 2 or 4")
        if _safe_int(self.consequence, 0) not in (1, 2, 4):
            raise ValidationError("consequence must be one of 1, 2 or 4")
        if normalize_task_type_code(self.task_type_code) not in ("R", "NR", "E"):
            raise ValidationError("task_type_code must be R, NR or E")

        block = SafetyActivityBlock.find_by_id(self.activity_block_id)
        if not block or block.company_id != self.company_id:
            raise ValidationError("Activity block was not found")

    def to_dict(self) -> Dict[str, Any]:
        risk = _risk_by_id_map(self.company_id).get(self.master_risk_id)
        probability = _safe_int(self.probability, 2) or 2
        consequence = _safe_int(self.consequence, 2) or 2
        vep = calculate_vep(probability, consequence)
        risk_result = calculate_risk(probability, consequence)
        compact = calculate_compact_miper(
            self.exposed_people_value,
            self.exposure_frequency_value,
            self.occurrence_factor_value,
            self.severity_value or consequence,
        )
        control_hierarchy = normalize_control_hierarchy(self.control_hierarchy)
        risk_master = SafetyRiskMaster.find_by_id(self.risk_master_id) if self.risk_master_id else None
        hazard_master = SafetyHazardMaster.find_by_id(self.hazard_master_id) if self.hazard_master_id else None
        return {
            "id": self.id,
            "company_id": self.company_id,
            "activity_block_id": self.activity_block_id,
            "hazard_factor": self.hazard_factor or "",
            "master_risk_id": self.master_risk_id,
            "hazard_master_id": self.hazard_master_id,
            "risk_master_id": self.risk_master_id,
            "hazard_master_code": hazard_master.code if hazard_master else "",
            "risk_master_code": risk_master.code if risk_master else "",
            "master_risk_code": risk.isp_code if risk else "",
            "master_risk_name": risk.risk_name if risk else "",
            "risk_family": risk.family if risk else "",
            "hazard_description_contextual": self.hazard_description_contextual or self.hazard_factor or "",
            "risk_description_contextual": self.risk_description_contextual or (risk.risk_name if risk else ""),
            "probable_damage_contextual": self.probable_damage_contextual
            or (risk_master.probable_damage if risk_master else ""),
            "probability": probability,
            "consequence": consequence,
            "probability_value": probability,
            "consequence_value": consequence,
            "vep": vep,
            "risk_value": risk_result["risk_level_value"],
            "risk_level": risk_result["risk_level_label"],
            "risk_level_value": risk_result["risk_level_value"],
            "risk_level_label": risk_result["risk_level_label"],
            "severity_color": risk_result["severity_color"],
            "task_type_code": normalize_task_type_code(self.task_type_code),
            **compact,
            "action_required": risk_result["action_required"],
            "approval_blocked": risk_result["approval_blocked"],
            "mitigation_required": risk_result["mitigation_required"],
            "controls_summary": self.controls_summary or summarize_controls(
                control_hierarchy,
                "",
            ),
            "control_hierarchy": control_hierarchy,
            "current_engineering_controls": self.current_engineering_controls or "",
            "current_admin_controls": self.current_admin_controls or "",
            "current_ppe_controls": self.current_ppe_controls or "",
            "proposed_elimination_controls": normalize_string_list(self.proposed_elimination_controls),
            "proposed_substitution_controls": normalize_string_list(self.proposed_substitution_controls),
            "proposed_engineering_controls": normalize_string_list(self.proposed_engineering_controls),
            "proposed_admin_controls": normalize_string_list(self.proposed_admin_controls),
            "proposed_ppe_controls": normalize_string_list(self.proposed_ppe_controls),
            "safety_management_plan": self.safety_management_plan or "",
            "substitution_controls": normalize_string_list(control_hierarchy.get("substitution")),
            "required_ppe": normalize_string_list(self.required_ppe),
            "protocol_codes": normalize_string_list(self.protocol_codes),
            "sensitivity_tags": normalize_string_list(self.sensitivity_tags),
            "legal_reference": self.legal_reference or "",
            "source_note": self.source_note or "",
            "display_order": _safe_int(self.display_order, 10) or 10,
            "active": bool(self.active),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


def activity_block_row_from_hazard(
    activity_block: SafetyActivityBlock,
    hazard: SafetyActivityHazard,
    *,
    step_title: str = "",
    process_name: str = "",
    task_name: str = "",
    position_name: str = "",
    owner_name: str = "",
    place_name: str = "",
    source_labels: Optional[List[str]] = None,
    origin_blocks: Optional[List[str]] = None,
) -> Dict[str, Any]:
    risk = _risk_by_id_map(activity_block.company_id).get(hazard.master_risk_id)
    control_hierarchy = normalize_control_hierarchy(hazard.control_hierarchy)
    probability = _safe_int(hazard.probability, 2) or 2
    consequence = _safe_int(hazard.consequence, 2) or 2
    risk_result = calculate_risk(probability, consequence)
    compact = calculate_compact_miper(
        hazard.exposed_people_value,
        hazard.exposure_frequency_value or (2 if (activity_block.routine_type or "routine") == "routine" else 1),
        hazard.occurrence_factor_value,
        hazard.severity_value or consequence,
    )
    task_type_code = normalize_task_type_code(hazard.task_type_code, activity_block.routine_type or "routine")
    row = {
        "process_name": _clean_str(process_name)
        or activity_block.base_process
        or activity_block.default_process_name
        or activity_block.name
        or "Proceso operacional",
        "task_name": _clean_str(task_name)
        or _clean_str(step_title)
        or activity_block.base_task
        or activity_block.default_task_name
        or activity_block.name
        or "Actividad operacional",
        "activity": _clean_str(task_name)
        or _clean_str(step_title)
        or activity_block.base_task
        or activity_block.default_task_name
        or activity_block.name
        or "Actividad operacional",
        "position_name": _clean_str(position_name)
        or activity_block.default_position_name
        or "Personal expuesto",
        "place_name": _clean_str(place_name),
        "hazard": hazard.hazard_factor or "",
        "hazard_factor": hazard.hazard_factor or "",
        "hazard_name": hazard.hazard_description_contextual or hazard.hazard_factor or "",
        "risk": risk.risk_name if risk else "",
        "risk_name": risk.risk_name if risk else "",
        "probable_damage": hazard.probable_damage_contextual or "",
        "task_type_code": task_type_code,
        **compact,
        "master_risk_id": risk.id if risk else hazard.master_risk_id,
        "master_risk_code": risk.isp_code if risk else "",
        "risk_family": risk.family if risk else "",
        "controls": hazard.controls_summary or summarize_controls(control_hierarchy, ""),
        "control_hierarchy": control_hierarchy,
        "current_engineering_controls": hazard.current_engineering_controls or "",
        "current_admin_controls": hazard.current_admin_controls or "",
        "current_ppe_controls": hazard.current_ppe_controls or "",
        "proposed_elimination_controls": normalize_string_list(
            hazard.proposed_elimination_controls or control_hierarchy.get("elimination")
        ),
        "proposed_substitution_controls": normalize_string_list(
            hazard.proposed_substitution_controls or control_hierarchy.get("substitution")
        ),
        "proposed_engineering_controls": normalize_string_list(
            hazard.proposed_engineering_controls or control_hierarchy.get("engineering")
        ),
        "proposed_admin_controls": normalize_string_list(
            hazard.proposed_admin_controls or control_hierarchy.get("administrative")
        ),
        "proposed_ppe_controls": normalize_string_list(
            hazard.proposed_ppe_controls or control_hierarchy.get("ppe")
        ),
        "safety_management_plan": hazard.safety_management_plan or "",
        "required_ppe": normalize_string_list(hazard.required_ppe),
        "protocol_codes": dedupe_preserve_order(
            normalize_string_list(hazard.protocol_codes)
            + normalize_string_list(getattr(risk, "protocol_codes", []) if risk else [])
        ),
        "owner_name": _clean_str(owner_name)
        or activity_block.default_owner_name
        or "Supervisor de terreno",
        "probability": probability,
        "consequence": consequence,
        "probability_value": probability,
        "consequence_value": consequence,
        "routine_type": activity_block.routine_type or "routine",
        "origin_blocks": origin_blocks
        or [activity_block.block_type or "activity_block", activity_block.code or activity_block.name or ""],
        "origin_rule_ids": [hazard.id] if hazard.id else [],
        "source_labels": dedupe_preserve_order(
            (source_labels or []) + [activity_block.name or activity_block.code or ""]
        ),
        "sensitivity_tags": normalize_string_list(hazard.sensitivity_tags),
        "restriction_alerts": [],
        "legal_reference": hazard.legal_reference or "",
        "source_note": hazard.source_note or activity_block.description or "",
        "generated_at": utc_now_iso(),
        "approval_blocked": risk_result["approval_blocked"],
        "mitigation_required": risk_result["mitigation_required"],
        "severity_color": risk_result["severity_color"],
        "is_blocking": risk_result["approval_blocked"],
    }
    row["vep"] = risk_result["risk_level_value"]
    row["risk_value"] = risk_result["risk_level_value"]
    row["risk_level_value"] = risk_result["risk_level_value"]
    row["risk_level"] = risk_result["risk_level_label"]
    row["risk_level_label"] = risk_result["risk_level_label"]
    row["action_required"] = risk_result["action_required"]
    row["row_fingerprint"] = build_row_fingerprint(row)
    return row


def build_activity_block_matrix_rows(
    activity_block_id: Any,
    *,
    process_name: str = "",
    task_name: str = "",
    position_name: str = "",
    owner_name: str = "",
    place_name: str = "",
    source_labels: Optional[List[str]] = None,
    origin_blocks: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    block = SafetyActivityBlock.find_by_id(_safe_int(activity_block_id))
    if not block or not block.active:
        return []
    hazards = SafetyActivityHazard.search([("activity_block_id", "=", block.id)])
    hazards = [hazard for hazard in hazards if hazard.active]
    hazards.sort(key=lambda item: (_safe_int(item.display_order, 10) or 10, item.id or 0))
    return [
        activity_block_row_from_hazard(
            block,
            hazard,
            process_name=process_name,
            task_name=task_name,
            position_name=position_name,
            owner_name=owner_name,
            place_name=place_name,
            source_labels=source_labels,
            origin_blocks=origin_blocks,
        )
        for hazard in hazards
    ]


def _activity_block_scope_meta(activity_block_id: Any) -> Dict[str, Any]:
    block_id = _safe_int(activity_block_id, None)
    if not block_id:
        return {"catalog_scope": "global", "linked_profiles_count": 0}
    try:
        from modules.job_profiles.module_job_profiles import JobProfileActivityLink
    except Exception:
        return {"catalog_scope": "global", "linked_profiles_count": 0}
    links = [
        item
        for item in JobProfileActivityLink.search([("activity_block_id", "=", block_id)])
        if item.active
    ]
    profile_ids = {
        _safe_int(item.job_profile_id, None)
        for item in links
        if _safe_int(item.job_profile_id, None)
    }
    catalog_scope = "profile_specific" if any((item.link_type or "global") == "profile_specific" for item in links) else "global"
    return {"catalog_scope": catalog_scope, "linked_profiles_count": len(profile_ids)}


def seed_default_activity_blocks(company_id: Optional[int]) -> Dict[str, int]:
    if not company_id:
        return {"blocks_created": 0, "hazards_created": 0}

    risk_by_code = _risk_by_code_map(company_id)
    existing_blocks = {
        _clean_str(block.code).upper(): block
        for block in SafetyActivityBlock.search([("company_id", "=", company_id)])
        if _clean_str(block.code)
    }
    existing_hazard_keys = {
        (
            _safe_int(hazard.activity_block_id, 0) or 0,
            _clean_str(hazard.hazard_factor).lower(),
            _safe_int(hazard.master_risk_id, 0) or 0,
        )
        for hazard in SafetyActivityHazard.search([("company_id", "=", company_id)])
    }

    blocks_created = 0
    hazards_created = 0
    for blueprint in DEFAULT_ACTIVITY_BLOCKS:
        block_payload = dict(blueprint.get("block") or {})
        code = _clean_str(block_payload.get("code")).upper()
        if not code:
            continue
        block = existing_blocks.get(code)
        if not block:
            block = SafetyActivityBlock.create(
                {
                    **block_payload,
                    "code": code,
                    "company_id": company_id,
                    "active": True,
                }
            )
            existing_blocks[code] = block
            blocks_created += 1
        else:
            changed = False
            for field in (
                "origin_scope",
                "base_process",
                "base_subprocess",
                "base_activity",
                "base_task",
                "objective",
                "context",
                "routine_type",
                "criticality",
                "status",
                "tags",
            ):
                if field in block_payload and not block._data.get(field):
                    setattr(block, field, block_payload.get(field))
                    changed = True
            if changed:
                block.save()

        for order, hazard_payload in enumerate(blueprint.get("hazards") or [], start=1):
            risk_code = _clean_str(hazard_payload.get("master_risk_code")).upper()
            risk = risk_by_code.get(risk_code)
            hazard_factor = _clean_str(hazard_payload.get("hazard_factor"))
            if not risk or not hazard_factor:
                continue
            hazard_key = (block.id or 0, hazard_factor.lower(), risk.id or 0)
            if hazard_key in existing_hazard_keys:
                continue
            SafetyActivityHazard.create(
                {
                    "company_id": company_id,
                    "activity_block_id": block.id,
                    "hazard_factor": hazard_factor,
                    "master_risk_id": risk.id,
                    "probability": _safe_int(hazard_payload.get("probability"), 2) or 2,
                    "consequence": _safe_int(hazard_payload.get("consequence"), 2) or 2,
                    "hazard_description_contextual": hazard_payload.get("hazard_description_contextual") or "",
                    "risk_description_contextual": hazard_payload.get("risk_description_contextual") or "",
                    "probable_damage_contextual": hazard_payload.get("probable_damage_contextual") or "",
                    "task_type_code": hazard_payload.get("task_type_code") or "R",
                    "exposed_people_value": _safe_int(hazard_payload.get("exposed_people_value"), 1) or 1,
                    "exposure_frequency_value": _safe_int(hazard_payload.get("exposure_frequency_value"), 1) or 1,
                    "occurrence_factor_value": _safe_int(hazard_payload.get("occurrence_factor_value"), 1) or 1,
                    "severity_value": _safe_int(
                        hazard_payload.get("severity_value") or hazard_payload.get("consequence"),
                        2,
                    )
                    or 2,
                    "current_engineering_controls": hazard_payload.get("current_engineering_controls") or "",
                    "current_admin_controls": hazard_payload.get("current_admin_controls") or "",
                    "current_ppe_controls": hazard_payload.get("current_ppe_controls") or "",
                    "proposed_elimination_controls": hazard_payload.get("proposed_elimination_controls") or [],
                    "proposed_substitution_controls": hazard_payload.get("proposed_substitution_controls") or [],
                    "proposed_engineering_controls": hazard_payload.get("proposed_engineering_controls") or [],
                    "proposed_admin_controls": hazard_payload.get("proposed_admin_controls") or [],
                    "proposed_ppe_controls": hazard_payload.get("proposed_ppe_controls") or [],
                    "safety_management_plan": hazard_payload.get("safety_management_plan") or "",
                    "controls_summary": hazard_payload.get("controls_summary") or summarize_controls(
                        normalize_control_hierarchy(hazard_payload.get("control_hierarchy")),
                        "",
                    ),
                    "control_hierarchy": hazard_payload.get("control_hierarchy") or {},
                    "required_ppe": hazard_payload.get("required_ppe") or [],
                    "protocol_codes": hazard_payload.get("protocol_codes") or [],
                    "sensitivity_tags": hazard_payload.get("sensitivity_tags") or [],
                    "legal_reference": hazard_payload.get("legal_reference") or "",
                    "source_note": hazard_payload.get("source_note") or "",
                    "display_order": order,
                    "active": True,
                }
            )
            existing_hazard_keys.add(hazard_key)
            hazards_created += 1

    return {"blocks_created": blocks_created, "hazards_created": hazards_created}


def seed_preventive_master_catalog(company_id: Optional[int]) -> Dict[str, int]:
    if not company_id:
        return {"hazard_masters_created": 0, "risk_masters_created": 0, "links_backfilled": 0}

    risks = list(_risk_by_id_map(company_id).values())
    existing_hazards = {
        _clean_str(item.code).upper(): item
        for item in SafetyHazardMaster.search([("company_id", "=", company_id)])
        if _clean_str(item.code)
    }
    existing_risks = {
        _clean_str(item.code).upper(): item
        for item in SafetyRiskMaster.search([("company_id", "=", company_id)])
        if _clean_str(item.code)
    }
    hazard_masters_created = 0
    risk_masters_created = 0
    risk_master_by_legacy_id: Dict[int, SafetyRiskMaster] = {}

    for legacy in risks:
        hazard_code = f"HZ-{_clean_str(getattr(legacy, 'isp_code', '')).upper()}"
        hazard = existing_hazards.get(hazard_code)
        if not hazard:
            hazard = SafetyHazardMaster.create(
                {
                    "company_id": company_id,
                    "code": hazard_code,
                    "category": getattr(legacy, "family", "") or "GENERAL",
                    "factor_type": "operational",
                    "name": getattr(legacy, "risk_name", "") or hazard_code,
                    "description": getattr(legacy, "official_definition", "") or "",
                    "default_legal_reference": "",
                    "active": True,
                }
            )
            existing_hazards[hazard_code] = hazard
            hazard_masters_created += 1

        risk_code = _clean_str(getattr(legacy, "isp_code", "")).upper()
        risk_master = existing_risks.get(risk_code)
        if not risk_master:
            risk_master = SafetyRiskMaster.create(
                {
                    "company_id": company_id,
                    "code": risk_code,
                    "hazard_master_id": hazard.id,
                    "legacy_master_risk_id": legacy.id,
                    "name": getattr(legacy, "risk_name", "") or risk_code,
                    "probable_damage": getattr(legacy, "official_definition", "") or "",
                    "default_consequence_level": 2,
                    "active": True,
                }
            )
            existing_risks[risk_code] = risk_master
            risk_masters_created += 1
        elif not risk_master.hazard_master_id or not risk_master.legacy_master_risk_id:
            risk_master.hazard_master_id = risk_master.hazard_master_id or hazard.id
            risk_master.legacy_master_risk_id = risk_master.legacy_master_risk_id or legacy.id
            risk_master.save()
        if legacy.id:
            risk_master_by_legacy_id[legacy.id] = risk_master

    links_backfilled = 0
    for hazard_link in SafetyActivityHazard.search([("company_id", "=", company_id)]):
        risk_master = risk_master_by_legacy_id.get(_safe_int(hazard_link.master_risk_id, 0) or 0)
        if not risk_master:
            continue
        changed = False
        if not hazard_link.risk_master_id:
            hazard_link.risk_master_id = risk_master.id
            changed = True
        if not hazard_link.hazard_master_id:
            hazard_link.hazard_master_id = risk_master.hazard_master_id
            changed = True
        if not hazard_link.probable_damage_contextual:
            hazard_link.probable_damage_contextual = risk_master.probable_damage
            changed = True
        if changed:
            hazard_link.save()
            links_backfilled += 1

    return {
        "hazard_masters_created": hazard_masters_created,
        "risk_masters_created": risk_masters_created,
        "links_backfilled": links_backfilled,
    }


def seed_bot_domain_catalog(company_id: Optional[int]) -> Dict[str, int]:
    summary = seed_default_activity_blocks(company_id)
    master_summary = seed_preventive_master_catalog(company_id)
    summary.update(master_summary)
    return summary


class SafetyActivitiesModule(BaseModule):
    """Safety activity block catalog APIs."""

    name = "safety_activities"
    version = "1.0.0"
    author = "Your Company"
    description = "Catalogo de actividades preventivas reutilizables por bloques"
    depends = ["base", "safety"]

    def init_module(self):
        self.register_model("safety.activity_block", SafetyActivityBlock)
        self.register_model("safety.activity_hazard", SafetyActivityHazard)
        self.register_model("safety.activity_resource", SafetyActivityResource)
        self.register_model("safety.hazard_master", SafetyHazardMaster)
        self.register_model("safety.risk_master", SafetyRiskMaster)
        self.register_model("safety.tag", SafetyTag)
        self.register_model("safety.taggable", SafetyTaggable)
        self.register_model("safety.block_version", SafetyBlockVersion)

        self.register_route("/safety-activities/lookups", self.get_lookups, methods=["GET"], auth_required=True)
        self.register_route("/safety-activities/blocks", self.list_blocks, methods=["GET"], auth_required=True)
        self.register_route("/safety-activities/blocks", self.create_block, methods=["POST"], auth_required=True)
        self.register_route("/safety-activities/blocks/{id}", self.get_block, methods=["GET"], auth_required=True)
        self.register_route("/safety-activities/blocks/{id}", self.update_block, methods=["PUT"], auth_required=True)
        self.register_route("/safety-activities/blocks/{id}", self.delete_block, methods=["DELETE"], auth_required=True)
        self.register_route("/safety-activities/blocks/{id}/hazards", self.create_hazard, methods=["POST"], auth_required=True)
        self.register_route("/safety-activities/hazards/{id}", self.update_hazard, methods=["PUT"], auth_required=True)
        self.register_route("/safety-activities/hazards/{id}", self.delete_hazard, methods=["DELETE"], auth_required=True)
        self.register_route("/safety/bots", self.list_blocks, methods=["GET"], auth_required=True)
        self.register_route("/safety/bots", self.create_block, methods=["POST"], auth_required=True)
        self.register_route("/safety/bots/{id}", self.get_block, methods=["GET"], auth_required=True)
        self.register_route("/safety/bots/{id}", self.update_block, methods=["PUT"], auth_required=True)
        self.register_route("/safety/bots/{id}", self.delete_block, methods=["DELETE"], auth_required=True)
        self.register_route("/safety/bots/{id}/risks", self.create_hazard, methods=["POST"], auth_required=True)
        self.register_route("/safety/bots/{id}/resources", self.list_resources, methods=["GET"], auth_required=True)
        self.register_route("/safety/bots/{id}/resources", self.create_resource, methods=["POST"], auth_required=True)
        self.register_route("/safety/bots/{id}/duplicate", self.duplicate_block, methods=["POST"], auth_required=True)
        self.register_route("/safety/bots/{id}/archive", self.archive_block, methods=["POST"], auth_required=True)

        self.logger.info("Safety activities module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _tenant_filter(self) -> List[tuple]:
        user = self.env.user
        if user and user.role == "superadmin":
            return []
        return [("company_id", "=", self._company_id())]

    def _require_access(self) -> Optional[Response]:
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        if user.role in ("superadmin", "company_admin"):
            return None
        if "safety" not in (user.allowed_modules or []):
            return Response.forbidden("No tienes acceso a Actividades de Prevencion")
        return None

    def _ensure_seed(self) -> None:
        company_id = self._company_id()
        if company_id:
            seed_bot_domain_catalog(company_id)

    def _block_or_404(self, block_id: Any) -> Tuple[Optional[SafetyActivityBlock], Optional[Response]]:
        block = SafetyActivityBlock.find_by_id(_safe_int(block_id))
        if not block or (
            self.env.user.role != "superadmin" and block.company_id != self._company_id()
        ):
            return None, Response.not_found("Activity block not found")
        return block, None

    def _hazard_or_404(
        self,
        hazard_id: Any,
    ) -> Tuple[Optional[SafetyActivityHazard], Optional[Response]]:
        hazard = SafetyActivityHazard.find_by_id(_safe_int(hazard_id))
        if not hazard or (
            self.env.user.role != "superadmin" and hazard.company_id != self._company_id()
        ):
            return None, Response.not_found("Activity hazard not found")
        return hazard, None

    def _risk_or_error(self, risk_id: Any) -> Tuple[Optional[Any], Optional[Response]]:
        parsed_id = _safe_int(risk_id)
        if not parsed_id:
            return None, Response.bad_request("master_risk_id is required")
        risk = _risk_by_id_map(self._company_id()).get(parsed_id)
        if not risk:
            return None, Response.not_found("Master risk not found")
        return risk, None

    def _hazards_for_block(self, block_id: int) -> List[SafetyActivityHazard]:
        hazards = SafetyActivityHazard.search([("activity_block_id", "=", block_id)])
        hazards = [hazard for hazard in hazards if hazard.active]
        hazards.sort(key=lambda item: (_safe_int(item.display_order, 10) or 10, item.id or 0))
        return hazards

    def _block_payload(self, block: SafetyActivityBlock) -> Dict[str, Any]:
        hazards = [hazard.to_dict() for hazard in self._hazards_for_block(block.id)]
        resources = [
            item.to_dict()
            for item in SafetyActivityResource.search([("block_id", "=", block.id)])
            if item.active
        ]
        payload = block.to_dict()
        payload.update(_activity_block_scope_meta(block.id))
        payload["hazards"] = hazards
        payload["risks"] = hazards
        payload["resources"] = resources
        payload["hazard_count"] = len(hazards)
        payload["risk_count"] = len(hazards)
        payload["required_ppe"] = dedupe_preserve_order(
            [item for hazard in hazards for item in normalize_string_list(hazard.get("required_ppe"))]
        )
        payload["protocol_codes"] = dedupe_preserve_order(
            [item for hazard in hazards for item in normalize_string_list(hazard.get("protocol_codes"))]
        )
        payload["highest_risk_level_value"] = max(
            [_safe_int(hazard.get("risk_level_value"), 0) or 0 for hazard in hazards] or [0]
        )
        payload["approval_blocked"] = any(bool(hazard.get("approval_blocked")) for hazard in hazards)
        payload["mitigation_required"] = any(bool(hazard.get("mitigation_required")) for hazard in hazards)
        payload["master_risk_codes"] = dedupe_preserve_order(
            [
                _clean_str(hazard.get("master_risk_code")).upper()
                for hazard in hazards
                if _clean_str(hazard.get("master_risk_code"))
            ]
        )
        return payload

    async def get_lookups(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        risk_items = [risk.to_dict() for risk in _risk_by_id_map(self._company_id()).values()]
        risk_items.sort(key=lambda item: (item.get("isp_code") or "", item.get("risk_name") or ""))
        protocols: List[Dict[str, Any]] = []
        ppe_catalog: List[Dict[str, Any]] = []
        try:
            from modules.safety.module_safety import SafetyPPEItem, SafetyProtocol, seed_default_ppe_catalog

            seed_default_ppe_catalog(self._company_id())
            protocols = [item.to_dict() for item in SafetyProtocol.search(self._tenant_filter()) if item.active]
            protocols.sort(key=lambda item: ((item.get("code") or "").lower(), (item.get("name") or "").lower()))
            ppe_catalog = [item.to_dict() for item in SafetyPPEItem.search(self._tenant_filter()) if item.active]
            ppe_catalog.sort(key=lambda item: ((item.get("category") or "").lower(), (item.get("name") or "").lower()))
        except Exception:
            protocols = []
            ppe_catalog = []
        return Response.ok(
            {
                "block_types": [
                    {"code": item, "label": BOT_TYPE_LABELS.get(item, item.title())}
                    for item in ACTIVITY_BLOCK_TYPES
                ],
                "origin_scopes": [{"code": item, "label": item.title()} for item in BOT_ORIGIN_SCOPES],
                "routine_types": [
                    {"code": "routine", "label": "Rutinaria"},
                    {"code": "non_routine", "label": "No rutinaria"},
                ],
                "criticalities": [{"code": item, "label": item.title()} for item in BOT_CRITICALITIES],
                "statuses": [{"code": item, "label": item.title()} for item in BOT_STATUSES],
                "risk_methodology": methodology_payload(),
                "master_risks": risk_items,
                "hazard_masters": [
                    item.to_dict()
                    for item in SafetyHazardMaster.search(self._tenant_filter())
                    if item.active
                ],
                "risk_masters": [
                    item.to_dict()
                    for item in SafetyRiskMaster.search(self._tenant_filter())
                    if item.active
                ],
                "protocols": protocols,
                "ppe_catalog": ppe_catalog,
            }
        )

    async def list_blocks(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        search = _clean_str(request.get_param("search")).lower()
        block_type = _clean_str(request.get_param("block_type"))
        catalog_scope = _clean_str(request.get_param("catalog_scope"))
        status = _clean_str(request.get_param("status"))
        criticality = _clean_str(request.get_param("criticality"))
        routine_type = _clean_str(request.get_param("routine_type"))
        tag = _clean_str(request.get_param("tag")).lower()
        ppe = _clean_str(request.get_param("ppe")).lower()
        protocol = _clean_str(request.get_param("protocol")).upper()
        risk = _clean_str(request.get_param("risk")).upper()
        process = _clean_str(request.get_param("process")).lower()
        include_inactive = _normalize_bool(request.get_param("include_inactive"), False)

        blocks = SafetyActivityBlock.search(self._tenant_filter())
        if not include_inactive:
            blocks = [block for block in blocks if block.active]
        blocks.sort(key=lambda item: ((item.block_type or "").lower(), (item.name or "").lower(), item.id or 0))
        payloads = [self._block_payload(block) for block in blocks]

        if block_type:
            payloads = [item for item in payloads if item.get("block_type") == block_type]
        if catalog_scope:
            payloads = [item for item in payloads if item.get("catalog_scope") == catalog_scope]
        if status:
            payloads = [item for item in payloads if item.get("status") == status]
        if criticality:
            payloads = [item for item in payloads if item.get("criticality") == criticality]
        if routine_type:
            payloads = [item for item in payloads if item.get("routine_type") == routine_type]
        if tag:
            payloads = [
                item
                for item in payloads
                if tag in [str(value).lower() for value in item.get("tags") or []]
            ]
        if ppe:
            payloads = [
                item
                for item in payloads
                if any(ppe in str(value).lower() for value in item.get("required_ppe") or [])
            ]
        if protocol:
            payloads = [
                item
                for item in payloads
                if protocol in [str(value).upper() for value in item.get("protocol_codes") or []]
            ]
        if risk:
            payloads = [
                item
                for item in payloads
                if risk in [str(value).upper() for value in item.get("master_risk_codes") or []]
            ]
        if process:
            payloads = [
                item
                for item in payloads
                if process in " ".join(
                    [
                        item.get("base_process") or "",
                        item.get("default_process_name") or "",
                        item.get("base_subprocess") or "",
                    ]
                ).lower()
            ]
        if search:
            payloads = [
                item
                for item in payloads
                if search
                in " ".join(
                    [
                        item.get("code") or "",
                        item.get("name") or "",
                        item.get("description") or "",
                        item.get("objective") or "",
                        item.get("context") or "",
                        item.get("base_process") or "",
                        item.get("base_subprocess") or "",
                        item.get("base_activity") or "",
                        item.get("base_task") or "",
                        item.get("default_process_name") or "",
                        item.get("default_task_name") or "",
                        " ".join(item.get("tags") or []),
                        " ".join(item.get("required_ppe") or []),
                        " ".join(item.get("protocol_codes") or []),
                        " ".join(item.get("master_risk_codes") or []),
                    ]
                ).lower()
            ]

        return Response.ok({"count": len(payloads), "results": payloads})

    async def get_block(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        block, error = self._block_or_404(request.params.get("id"))
        if error:
            return error
        return Response.ok(self._block_payload(block))

    async def create_block(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        data = request.data or {}
        block_type = data.get("block_type") or data.get("type") or "custom"
        try:
            block = SafetyActivityBlock.create(
                {
                    "company_id": self._company_id(),
                    "code": data.get("code") or "",
                    "name": data.get("name") or "",
                    "description": data.get("description") or "",
                    "block_type": block_type,
                    "origin_scope": data.get("origin_scope") or "company",
                    "default_process_name": data.get("default_process_name") or data.get("base_process") or "",
                    "default_task_name": data.get("default_task_name") or data.get("base_task") or "",
                    "default_position_name": data.get("default_position_name") or data.get("job_position") or "",
                    "default_owner_name": data.get("default_owner_name") or data.get("responsible") or "",
                    "base_process": data.get("base_process") or data.get("default_process_name") or "",
                    "base_subprocess": data.get("base_subprocess") or "",
                    "base_activity": data.get("base_activity") or data.get("name") or "",
                    "base_task": data.get("base_task") or data.get("default_task_name") or "",
                    "objective": data.get("objective") or "",
                    "context": data.get("context") or data.get("operational_context") or "",
                    "job_role_id": _safe_int(data.get("job_role_id")),
                    "suggested_responsible_id": _safe_int(data.get("suggested_responsible_id")),
                    "routine_type": data.get("routine_type") or "routine",
                    "criticality": data.get("criticality") or "medium",
                    "status": data.get("status") or "active",
                    "project_id": _safe_int(data.get("project_id")),
                    "version": _safe_int(data.get("version"), 1) or 1,
                    "parent_block_id": _safe_int(data.get("parent_block_id")),
                    "inheritance_mode": data.get("inheritance_mode") or "copied",
                    "tags": data.get("tags") or [],
                    "conditions_previous": data.get("conditions_previous") or [],
                    "conditions_close": data.get("conditions_close") or [],
                    "resources_summary": data.get("resources_summary") or [],
                    "tools_summary": data.get("tools_summary") or [],
                    "materials_summary": data.get("materials_summary") or [],
                    "notes_internal": data.get("notes_internal") or "",
                    "active": _normalize_bool(data.get("active"), True),
                }
            )
            return Response.created(self._block_payload(block))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_block(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        block, error = self._block_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field in (
            "code",
            "name",
            "description",
            "block_type",
            "origin_scope",
            "default_process_name",
            "default_task_name",
            "default_position_name",
            "default_owner_name",
            "base_process",
            "base_subprocess",
            "base_activity",
            "base_task",
            "objective",
            "context",
            "job_role_id",
            "suggested_responsible_id",
            "routine_type",
            "criticality",
            "status",
            "project_id",
            "version",
            "parent_block_id",
            "inheritance_mode",
            "tags",
            "conditions_previous",
            "conditions_close",
            "resources_summary",
            "tools_summary",
            "materials_summary",
            "notes_internal",
        ):
            if field in data:
                setattr(block, field, data.get(field))
        if "type" in data and "block_type" not in data:
            block.block_type = data.get("type")
        if "active" in data:
            block.active = _normalize_bool(data.get("active"), True)
        if block.status == "archived":
            block.active = False
        elif "status" in data:
            block.active = block.status != "archived"
        try:
            block.save()
            SafetyBlockVersion.create(
                {
                    "company_id": block.company_id,
                    "block_id": block.id,
                    "block_code": block.code,
                    "version": _safe_int(block.version, 1) or 1,
                    "snapshot": self._block_payload(block),
                    "change_note": data.get("change_note") or "Actualizacion BOT",
                    "active": True,
                }
            )
            return Response.ok(self._block_payload(block))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_block(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        block, error = self._block_or_404(request.params.get("id"))
        if error:
            return error
        block.active = False
        block.status = "archived"
        block.archived_at = utc_now_iso()
        block.save()
        for hazard in self._hazards_for_block(block.id):
            hazard.active = False
            hazard.save()
        return Response.ok({"message": "Activity block archived", "block": self._block_payload(block)})

    async def archive_block(self, request: Request) -> Response:
        return await self.delete_block(request)

    async def duplicate_block(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        block, error = self._block_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        requested_code = _clean_str(data.get("code")).upper()
        base_code = requested_code or f"{block.code}-COPY"
        existing_codes = {
            _clean_str(item.code).upper()
            for item in SafetyActivityBlock.search([("company_id", "=", block.company_id)])
        }
        code = base_code
        index = 2
        while code in existing_codes:
            code = f"{base_code}-{index}"
            index += 1

        payload = block.to_dict()
        payload.update(
            {
                "company_id": block.company_id,
                "code": code,
                "name": data.get("name") or f"{block.name} (copia)",
                "block_type": data.get("block_type") or "custom",
                "origin_scope": data.get("origin_scope") or "company",
                "parent_block_id": block.id,
                "inheritance_mode": data.get("inheritance_mode") or "copied",
                "version": 1,
                "status": "draft",
                "active": True,
            }
        )
        for key in ("id", "created_at", "updated_at", "hazards", "risks", "resources"):
            payload.pop(key, None)

        try:
            new_block = SafetyActivityBlock.create(payload)
            for resource in [
                item for item in SafetyActivityResource.search([("block_id", "=", block.id)]) if item.active
            ]:
                SafetyActivityResource.create(
                    {
                        "company_id": new_block.company_id,
                        "block_id": new_block.id,
                        "resource_type": resource.resource_type,
                        "name": resource.name,
                        "description": resource.description,
                        "active": True,
                    }
                )
            for hazard in self._hazards_for_block(block.id):
                hazard_payload = hazard.to_dict()
                SafetyActivityHazard.create(
                    {
                        "company_id": new_block.company_id,
                        "activity_block_id": new_block.id,
                        "hazard_factor": hazard_payload.get("hazard_factor") or "",
                        "master_risk_id": hazard_payload.get("master_risk_id"),
                        "hazard_master_id": hazard_payload.get("hazard_master_id"),
                        "risk_master_id": hazard_payload.get("risk_master_id"),
                        "hazard_description_contextual": hazard_payload.get("hazard_description_contextual") or "",
                        "risk_description_contextual": hazard_payload.get("risk_description_contextual") or "",
                        "probable_damage_contextual": hazard_payload.get("probable_damage_contextual") or "",
                        "probability": hazard_payload.get("probability_value") or 2,
                        "consequence": hazard_payload.get("consequence_value") or 2,
                        "task_type_code": hazard_payload.get("task_type_code") or "R",
                        "exposed_people_value": hazard_payload.get("exposed_people_value") or 1,
                        "exposure_frequency_value": hazard_payload.get("exposure_frequency_value") or 1,
                        "occurrence_factor_value": hazard_payload.get("occurrence_factor_value") or 1,
                        "severity_value": hazard_payload.get("severity_value") or hazard_payload.get("consequence_value") or 2,
                        "current_engineering_controls": hazard_payload.get("current_engineering_controls") or "",
                        "current_admin_controls": hazard_payload.get("current_admin_controls") or "",
                        "current_ppe_controls": hazard_payload.get("current_ppe_controls") or "",
                        "proposed_elimination_controls": hazard_payload.get("proposed_elimination_controls") or [],
                        "proposed_substitution_controls": hazard_payload.get("proposed_substitution_controls") or [],
                        "proposed_engineering_controls": hazard_payload.get("proposed_engineering_controls") or [],
                        "proposed_admin_controls": hazard_payload.get("proposed_admin_controls") or [],
                        "proposed_ppe_controls": hazard_payload.get("proposed_ppe_controls") or [],
                        "safety_management_plan": hazard_payload.get("safety_management_plan") or "",
                        "controls_summary": hazard_payload.get("controls_summary") or "",
                        "control_hierarchy": hazard_payload.get("control_hierarchy") or {},
                        "substitution_controls": hazard_payload.get("substitution_controls") or [],
                        "required_ppe": hazard_payload.get("required_ppe") or [],
                        "protocol_codes": hazard_payload.get("protocol_codes") or [],
                        "sensitivity_tags": hazard_payload.get("sensitivity_tags") or [],
                        "legal_reference": hazard_payload.get("legal_reference") or "",
                        "source_note": f"Duplicado desde {block.code}",
                        "display_order": hazard_payload.get("display_order") or 10,
                        "active": True,
                    }
                )
            SafetyBlockVersion.create(
                {
                    "company_id": new_block.company_id,
                    "block_id": new_block.id,
                    "block_code": new_block.code,
                    "version": 1,
                    "snapshot": self._block_payload(new_block),
                    "change_note": f"Duplicado desde {block.code}",
                    "active": True,
                }
            )
            return Response.created(self._block_payload(new_block))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_resources(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        block, error = self._block_or_404(request.params.get("id"))
        if error:
            return error
        resources = [
            item.to_dict()
            for item in SafetyActivityResource.search([("block_id", "=", block.id)])
            if item.active
        ]
        resources.sort(key=lambda item: (item.get("resource_type") or "", item.get("name") or ""))
        return Response.ok({"count": len(resources), "results": resources})

    async def create_resource(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        block, error = self._block_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        try:
            resource = SafetyActivityResource.create(
                {
                    "company_id": block.company_id,
                    "block_id": block.id,
                    "resource_type": data.get("resource_type") or "tool",
                    "name": data.get("name") or "",
                    "description": data.get("description") or "",
                    "active": _normalize_bool(data.get("active"), True),
                }
            )
            return Response.created({"resource": resource.to_dict(), "block": self._block_payload(block)})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def create_hazard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        block, error = self._block_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        risk, risk_error = self._risk_or_error(data.get("master_risk_id"))
        if risk_error:
            return risk_error
        risk_master = None
        if risk:
            matches = SafetyRiskMaster.search(
                [
                    ("company_id", "=", block.company_id),
                    ("legacy_master_risk_id", "=", risk.id),
                ],
                limit=1,
            )
            risk_master = matches[0] if matches else None
        try:
            hazard = SafetyActivityHazard.create(
                {
                    "company_id": block.company_id,
                    "activity_block_id": block.id,
                    "hazard_factor": data.get("hazard_factor") or data.get("hazard") or "",
                    "master_risk_id": _safe_int(data.get("master_risk_id")),
                    "hazard_master_id": _safe_int(data.get("hazard_master_id"))
                    or (risk_master.hazard_master_id if risk_master else None),
                    "risk_master_id": _safe_int(data.get("risk_master_id"))
                    or (risk_master.id if risk_master else None),
                    "hazard_description_contextual": data.get("hazard_description_contextual")
                    or data.get("hazard_context")
                    or "",
                    "risk_description_contextual": data.get("risk_description_contextual")
                    or data.get("risk_context")
                    or "",
                    "probable_damage_contextual": data.get("probable_damage_contextual")
                    or data.get("probable_damage")
                    or "",
                    "probability": _safe_int(data.get("probability"), 2) or 2,
                    "consequence": _safe_int(data.get("consequence"), 2) or 2,
                    "task_type_code": data.get("task_type_code") or data.get("task_type") or "R",
                    "exposed_people_value": _safe_int(data.get("exposed_people_value") or data.get("pe"), 1) or 1,
                    "exposure_frequency_value": _safe_int(data.get("exposure_frequency_value") or data.get("fe"), 1) or 1,
                    "occurrence_factor_value": _safe_int(data.get("occurrence_factor_value") or data.get("fo"), 1) or 1,
                    "severity_value": _safe_int(data.get("severity_value") or data.get("severity") or data.get("consequence"), 2) or 2,
                    "current_engineering_controls": data.get("current_engineering_controls") or "",
                    "current_admin_controls": data.get("current_admin_controls") or "",
                    "current_ppe_controls": data.get("current_ppe_controls") or "",
                    "proposed_elimination_controls": data.get("proposed_elimination_controls") or [],
                    "proposed_substitution_controls": data.get("proposed_substitution_controls") or [],
                    "proposed_engineering_controls": data.get("proposed_engineering_controls") or [],
                    "proposed_admin_controls": data.get("proposed_admin_controls") or [],
                    "proposed_ppe_controls": data.get("proposed_ppe_controls") or [],
                    "safety_management_plan": data.get("safety_management_plan") or "",
                    "controls_summary": data.get("controls_summary") or "",
                    "control_hierarchy": data.get("control_hierarchy") or {},
                    "substitution_controls": data.get("substitution_controls") or [],
                    "required_ppe": data.get("required_ppe") or [],
                    "protocol_codes": data.get("protocol_codes") or [],
                    "sensitivity_tags": data.get("sensitivity_tags") or [],
                    "legal_reference": data.get("legal_reference") or "",
                    "source_note": data.get("source_note") or "",
                    "display_order": _safe_int(data.get("display_order"), 10) or 10,
                    "active": _normalize_bool(data.get("active"), True),
                }
            )
            return Response.created({"hazard": hazard.to_dict(), "block": self._block_payload(block)})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_hazard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        hazard, error = self._hazard_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        if "master_risk_id" in data:
            _, risk_error = self._risk_or_error(data.get("master_risk_id"))
            if risk_error:
                return risk_error
            hazard.master_risk_id = _safe_int(data.get("master_risk_id"))
        for field in (
            "hazard_factor",
            "hazard_master_id",
            "risk_master_id",
            "hazard_description_contextual",
            "risk_description_contextual",
            "probable_damage_contextual",
            "task_type_code",
            "current_engineering_controls",
            "current_admin_controls",
            "current_ppe_controls",
            "proposed_elimination_controls",
            "proposed_substitution_controls",
            "proposed_engineering_controls",
            "proposed_admin_controls",
            "proposed_ppe_controls",
            "safety_management_plan",
            "controls_summary",
            "control_hierarchy",
            "substitution_controls",
            "required_ppe",
            "protocol_codes",
            "sensitivity_tags",
            "legal_reference",
            "source_note",
        ):
            if field in data:
                setattr(hazard, field, data.get(field))
        if "hazard" in data:
            hazard.hazard_factor = data.get("hazard") or ""
        if "probability" in data:
            hazard.probability = _safe_int(data.get("probability"), 2) or 2
        if "consequence" in data:
            hazard.consequence = _safe_int(data.get("consequence"), 2) or 2
        if "exposed_people_value" in data or "pe" in data:
            hazard.exposed_people_value = _safe_int(data.get("exposed_people_value") or data.get("pe"), 1) or 1
        if "exposure_frequency_value" in data or "fe" in data:
            hazard.exposure_frequency_value = _safe_int(data.get("exposure_frequency_value") or data.get("fe"), 1) or 1
        if "occurrence_factor_value" in data or "fo" in data:
            hazard.occurrence_factor_value = _safe_int(data.get("occurrence_factor_value") or data.get("fo"), 1) or 1
        if "severity_value" in data or "severity" in data:
            hazard.severity_value = _safe_int(data.get("severity_value") or data.get("severity"), 2) or 2
        if "display_order" in data:
            hazard.display_order = _safe_int(data.get("display_order"), 10) or 10
        if "active" in data:
            hazard.active = _normalize_bool(data.get("active"), True)
        try:
            hazard.save()
            block = SafetyActivityBlock.find_by_id(hazard.activity_block_id)
            return Response.ok(
                {"hazard": hazard.to_dict(), "block": self._block_payload(block)}
                if block
                else {"hazard": hazard.to_dict()}
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_hazard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        hazard, error = self._hazard_or_404(request.params.get("id"))
        if error:
            return error
        hazard.active = False
        hazard.save()
        block = SafetyActivityBlock.find_by_id(hazard.activity_block_id)
        return Response.ok(
            {
                "message": "Activity hazard archived",
                "block": self._block_payload(block) if block else None,
            }
        )
