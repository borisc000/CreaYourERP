"""
MIPER generator helpers for the safety module.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from core.time_utils import utc_now_iso


DEFAULT_PROTOCOLS: List[Dict[str, str]] = [
    {
        "code": "PREXOR",
        "name": "Protocolo de Exposicion Ocupacional a Ruido",
        "authority": "MINSAL",
        "description": "Vigilancia ocupacional para trabajadores expuestos a ruido.",
    },
    {
        "code": "TMERT",
        "name": "Protocolo TMERT-EESS",
        "authority": "MINSAL",
        "description": "Vigilancia para factores de riesgo de trastornos musculoesqueleticos.",
    },
    {
        "code": "PSICOSOCIAL",
        "name": "Protocolo de Vigilancia de Riesgos Psicosociales",
        "authority": "MINSAL",
        "description": "Evaluacion y vigilancia de riesgos psicosociales en el trabajo.",
    },
    {
        "code": "SILICE",
        "name": "Protocolo de Exposicion a Silice",
        "authority": "MINSAL",
        "description": "Vigilancia del ambiente y de la salud por exposicion a silice.",
    },
    {
        "code": "UV_SOLAR",
        "name": "Guia Tecnica Radiacion UV de Origen Solar",
        "authority": "MINSAL",
        "description": "Control de trabajadores expuestos a radiacion UV de origen solar.",
    },
    {
        "code": "HIPOBARIA",
        "name": "Guia Tecnica de Hipobaria Intermitente Cronica",
        "authority": "MINSAL",
        "description": "Control de exposicion a gran altitud geograficamente relevante.",
    },
]


DEFAULT_MASTER_RISKS: List[Dict[str, Any]] = [
    {
        "isp_code": "A1",
        "family": "SEGURIDAD",
        "risk_name": "Caidas al mismo nivel",
        "official_definition": "Caida que se produce en el mismo plano de sustentacion.",
        "protocol_codes": [],
    },
    {
        "isp_code": "A2",
        "family": "SEGURIDAD",
        "risk_name": "Caidas a distinto nivel",
        "official_definition": "Caida a un plano inferior desde una altura no superior a 1,8 m.",
        "protocol_codes": [],
    },
    {
        "isp_code": "A3",
        "family": "SEGURIDAD",
        "risk_name": "Caidas de altura",
        "official_definition": "Caida a un plano inferior de sustentacion desde una altura superior a 1,8 m.",
        "protocol_codes": [],
    },
    {
        "isp_code": "B1",
        "family": "SEGURIDAD",
        "risk_name": "Atrapamiento",
        "official_definition": "Aprisionamiento del cuerpo por maquinas, objetos o equipos.",
        "protocol_codes": [],
    },
    {
        "isp_code": "B2",
        "family": "SEGURIDAD",
        "risk_name": "Caida de objetos",
        "official_definition": "Caida de materiales, herramientas o estructuras que golpean al cuerpo.",
        "protocol_codes": [],
    },
    {
        "isp_code": "B3",
        "family": "SEGURIDAD",
        "risk_name": "Cortes por objetos o herramientas",
        "official_definition": "Cortes o punzaciones generadas por objetos cortantes, punzantes o abrasivos.",
        "protocol_codes": [],
    },
    {
        "isp_code": "B4",
        "family": "SEGURIDAD",
        "risk_name": "Choque contra objetos",
        "official_definition": "Encuentro violento del cuerpo con objetos en movimiento o inmoviles.",
        "protocol_codes": [],
    },
    {
        "isp_code": "B5",
        "family": "SEGURIDAD",
        "risk_name": "Golpeado por o contra",
        "official_definition": "Impacto del cuerpo con equipos, estructuras, materiales o herramientas durante la tarea.",
        "protocol_codes": [],
    },
    {
        "isp_code": "B6",
        "family": "SEGURIDAD",
        "risk_name": "Proyeccion de particulas",
        "official_definition": "Exposicion a fragmentos, esquirlas o particulas proyectadas durante procesos operativos.",
        "protocol_codes": [],
    },
    {
        "isp_code": "F1",
        "family": "SEGURIDAD",
        "risk_name": "Contacto electrico directo baja tension",
        "official_definition": "Contacto con partes activas en tension menores a 1000 volts.",
        "protocol_codes": [],
    },
    {
        "isp_code": "F3",
        "family": "SEGURIDAD",
        "risk_name": "Contacto electrico indirecto baja tension",
        "official_definition": "Contacto con masas puestas accidentalmente en tension.",
        "protocol_codes": [],
    },
    {
        "isp_code": "I1",
        "family": "SEGURIDAD",
        "risk_name": "Atropellos o golpes con vehiculos",
        "official_definition": "Impacto entre un peaton y un vehiculo en movimiento.",
        "protocol_codes": [],
    },
    {
        "isp_code": "J",
        "family": "SEGURIDAD",
        "risk_name": "Incendios",
        "official_definition": "Conjunto de condiciones que pueden originar un fuego incontrolado.",
        "protocol_codes": [],
    },
    {
        "isp_code": "J2",
        "family": "SEGURIDAD",
        "risk_name": "Quemaduras",
        "official_definition": "Lesion por contacto con superficies calientes, fuego, vapor, electricidad o agentes quimicos.",
        "protocol_codes": [],
    },
    {
        "isp_code": "O1",
        "family": "HIGIENICO",
        "risk_name": "Exposicion a aerosoles solidos",
        "official_definition": "Permanencia en ambiente con particulas solidas en suspension como polvos, fibras o humos.",
        "protocol_codes": ["SILICE"],
    },
    {
        "isp_code": "O3",
        "family": "HIGIENICO",
        "risk_name": "Exposicion a gases y vapores",
        "official_definition": "Permanencia en ambiente con sustancias en estado gaseoso.",
        "protocol_codes": [],
    },
    {
        "isp_code": "O4",
        "family": "HIGIENICO",
        "risk_name": "Contacto con sustancias peligrosas",
        "official_definition": "Contacto dermico, ocular o inhalatorio con agentes quimicos peligrosos durante almacenamiento, mezcla, uso o limpieza.",
        "protocol_codes": [],
    },
    {
        "isp_code": "P1",
        "family": "HIGIENICO",
        "risk_name": "Exposicion a ruido",
        "official_definition": "Permanencia en ambiente con altos niveles de presion sonora.",
        "protocol_codes": ["PREXOR"],
    },
    {
        "isp_code": "P5",
        "family": "HIGIENICO",
        "risk_name": "Exposicion a radiaciones no ionizantes",
        "official_definition": "Permanencia en ambiente con radiaciones electromagneticas no ionizantes.",
        "protocol_codes": ["UV_SOLAR"],
    },
    {
        "isp_code": "P6",
        "family": "HIGIENICO",
        "risk_name": "Exposicion a calor",
        "official_definition": "Permanencia en ambiente con altas temperaturas.",
        "protocol_codes": [],
    },
    {
        "isp_code": "P7",
        "family": "HIGIENICO",
        "risk_name": "Exposicion a frio",
        "official_definition": "Permanencia en ambiente con bajas temperaturas.",
        "protocol_codes": [],
    },
    {
        "isp_code": "P9",
        "family": "HIGIENICO",
        "risk_name": "Exposicion a bajas presiones",
        "official_definition": "Permanencia en ambiente de trabajo a presiones inferiores a la atmosferica.",
        "protocol_codes": ["HIPOBARIA"],
    },
    {
        "isp_code": "Q2",
        "family": "BIOLOGICO",
        "risk_name": "Transmision biologica por inhalacion, dermal, oral y parenteral",
        "official_definition": "Exposicion a virus, bacterias o parasitos por distintas vias.",
        "protocol_codes": [],
    },
    {
        "isp_code": "R1",
        "family": "MUSCULOESQUELETICO",
        "risk_name": "Sobrecarga por manipulacion manual de cargas",
        "official_definition": "Trabajo que exige levantar, descender o transportar manualmente objetos de mas de 3 kilos.",
        "protocol_codes": ["TMERT"],
    },
    {
        "isp_code": "S1",
        "family": "MUSCULOESQUELETICO",
        "risk_name": "Sobrecarga por trabajo repetitivo de miembros superiores",
        "official_definition": "Tarea repetitiva de miembros superiores durante gran parte de la jornada.",
        "protocol_codes": ["TMERT"],
    },
    {
        "isp_code": "T1",
        "family": "MUSCULOESQUELETICO",
        "risk_name": "Sobrecarga postural por trabajo de pie",
        "official_definition": "Trabajo en posicion bipeda permanente con escasa alternancia postural.",
        "protocol_codes": ["TMERT"],
    },
    {
        "isp_code": "T2",
        "family": "MUSCULOESQUELETICO",
        "risk_name": "Sobrecarga postural por trabajo sentado",
        "official_definition": "Trabajo sentado mantenido por periodos prolongados.",
        "protocol_codes": ["TMERT"],
    },
    {
        "isp_code": "D1",
        "family": "PSICOSOCIAL",
        "risk_name": "Dimension carga de trabajo",
        "official_definition": "Exigencias de trabajo que tensionan la relacion entre tareas y tiempo disponible.",
        "protocol_codes": ["PSICOSOCIAL"],
    },
    {
        "isp_code": "D6",
        "family": "PSICOSOCIAL",
        "risk_name": "Dimension calidad del liderazgo",
        "official_definition": "Forma en que la jefatura planifica, resuelve conflictos y colabora.",
        "protocol_codes": ["PSICOSOCIAL"],
    },
    {
        "isp_code": "D12",
        "family": "PSICOSOCIAL",
        "risk_name": "Dimension violencia y acoso",
        "official_definition": "Exposicion a conductas intimidatorias, ofensivas o no deseadas.",
        "protocol_codes": ["PSICOSOCIAL"],
    },
    {
        "isp_code": "N",
        "family": "OTROS",
        "risk_name": "Otros riesgos",
        "official_definition": "Riesgos no descritos especificamente en otras familias.",
        "protocol_codes": [],
    },
]


def _now_iso() -> str:
    return utc_now_iso()


def dedupe_preserve_order(values: Iterable[Any]) -> List[Any]:
    result: List[Any] = []
    seen = set()
    for value in values:
        marker = value
        if isinstance(value, dict):
            marker = tuple(sorted(value.items()))
        elif isinstance(value, list):
            marker = tuple(value)
        if marker in seen:
            continue
        seen.add(marker)
        result.append(value)
    return result


def normalize_string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return dedupe_preserve_order([str(item).strip() for item in value if str(item).strip()])
    if isinstance(value, str):
        normalized = value.replace("\r", "\n").replace(",", "\n")
        return dedupe_preserve_order([part.strip() for part in normalized.split("\n") if part.strip()])
    return [str(value).strip()] if str(value).strip() else []


def normalize_control_hierarchy(value: Any) -> Dict[str, List[str]]:
    base = {
        "elimination": [],
        "engineering": [],
        "administrative": [],
        "ppe": [],
    }
    if isinstance(value, dict):
        for key in base.keys():
            base[key] = normalize_string_list(value.get(key))
    elif isinstance(value, str):
        base["administrative"] = normalize_string_list(value)
    return base


def summarize_controls(control_hierarchy: Dict[str, List[str]], fallback: str = "") -> str:
    labels = {
        "elimination": "Eliminacion",
        "engineering": "Ingenieria",
        "administrative": "Administrativos",
        "ppe": "EPP",
    }
    chunks: List[str] = []
    for key, label in labels.items():
        items = normalize_string_list(control_hierarchy.get(key))
        if items:
            chunks.append(f"{label}: " + "; ".join(items))
    if chunks:
        return " | ".join(chunks)
    return fallback or ""


def calculate_vep(probability: Any, consequence: Any) -> int:
    try:
        prob = int(probability or 0)
        cons = int(consequence or 0)
    except (TypeError, ValueError):
        return 0
    return prob * cons


def risk_level_from_vep(vep: int) -> str:
    if vep <= 2:
        return "Tolerable"
    if vep == 4:
        return "Moderado"
    if vep == 8:
        return "Importante"
    if vep >= 16:
        return "Intolerable"
    return "-"


def action_from_vep(vep: int) -> str:
    if vep <= 2:
        return "No se necesita mejorar la accion preventiva, manteniendo verificaciones periodicas."
    if vep == 4:
        return "Se deben hacer esfuerzos para reducir el riesgo dentro de un periodo definido."
    if vep == 8:
        return "No se debe comenzar ni continuar el trabajo hasta reducir el riesgo."
    if vep >= 16:
        return "No debe comenzar ni continuar el trabajo; si no se reduce, se debe prohibir."
    return ""


def legal_requirements_for_headcount(worker_count: int) -> List[str]:
    requirements = [
        "Mantener politica de SST, matriz IPER y programa preventivo actualizados.",
    ]
    if worker_count <= 25:
        requirements.append("Gestion simplificada con autoevaluacion y asistencia tecnica del OAL.")
        if worker_count >= 10:
            requirements.append("Corresponde delegado o delegada de SST cuando no aplique comite paritario.")
    if 25 < worker_count <= 100:
        requirements.append("Corresponde Comite Paritario de Higiene y Seguridad.")
    if worker_count > 100:
        requirements.append("Corresponde Departamento de Prevencion de Riesgos.")
    return requirements


def rule_blueprints(profile_id_by_name: Dict[str, int]) -> List[Dict[str, Any]]:
    andamios_id = profile_id_by_name.get("Andamios")
    altura_id = profile_id_by_name.get("Trabajo en Altura")
    general_id = profile_id_by_name.get("Servicio General")
    blueprints: List[Dict[str, Any]] = [
        {
            "name": "Transversal - Gestion documental y AST",
            "scope_type": "transversal",
            "scope_ref_id": None,
            "process_name": "Inicio de servicio",
            "task_name": "Revision documental y analisis seguro de trabajo",
            "position_name": "Linea de mando",
            "hazard_factor": "Gestion preventiva deficiente",
            "master_risk_code": "N",
            "probability": 2,
            "consequence": 2,
            "control_hierarchy": {
                "elimination": [],
                "engineering": [],
                "administrative": [
                    "Carpeta de arranque vigente",
                    "Revision de requisitos del cliente",
                    "AST previo al inicio",
                ],
                "ppe": [],
            },
            "required_ppe": [],
            "protocol_codes": [],
            "sensitivity_tags": ["documental", "induccion"],
            "owner_name": "Administrador de contrato",
            "legal_reference": "DS 44 art. 15 y gestion preventiva",
            "source_note": "Bloque transversal base para toda oportunidad.",
        },
        {
            "name": "Transversal - Caidas al mismo nivel",
            "scope_type": "transversal",
            "scope_ref_id": None,
            "process_name": "Operacion transversal",
            "task_name": "Desplazamiento peatonal en la faena",
            "position_name": "Todo el personal",
            "hazard_factor": "Superficies irregulares, derrames u obstaculos",
            "master_risk_code": "A1",
            "probability": 2,
            "consequence": 2,
            "control_hierarchy": {
                "elimination": ["Retiro de obstaculos y orden permanente"],
                "engineering": ["Demarcacion y mejoramiento de accesos"],
                "administrative": ["Inspeccion pre operacional y orden/limpieza"],
                "ppe": ["Calzado de seguridad antideslizante"],
            },
            "required_ppe": ["Calzado de seguridad"],
            "protocol_codes": [],
            "sensitivity_tags": ["movilidad", "equilibrio"],
            "owner_name": "Supervisor de terreno",
            "legal_reference": "DS 44 art. 9 y 12",
            "source_note": "Riesgo transversal aplicable a toda matriz.",
        },
        {
            "name": "Transversal - Transito interno y lineas de fuego",
            "scope_type": "transversal",
            "scope_ref_id": None,
            "process_name": "Operacion transversal",
            "task_name": "Ingreso, transito y maniobras internas",
            "position_name": "Todo el personal",
            "hazard_factor": "Convivencia peatones y vehiculos",
            "master_risk_code": "I1",
            "probability": 2,
            "consequence": 4,
            "control_hierarchy": {
                "elimination": [],
                "engineering": ["Segregacion de peatones y equipos"],
                "administrative": ["Plan de transito", "Charlas de lineas de fuego", "Uso de vigia"],
                "ppe": ["Chaleco reflectante"],
            },
            "required_ppe": ["Chaleco reflectante"],
            "protocol_codes": [],
            "sensitivity_tags": ["transito", "maquinaria"],
            "owner_name": "Supervisor de terreno",
            "legal_reference": "DS 44 gestion preventiva y emergencias",
            "source_note": "Control base para servicios con ingreso a instalaciones operativas.",
        },
    ]

    if andamios_id:
        blueprints.extend(
            [
                {
                    "name": "Andamios - Armado",
                    "scope_type": "service_profile",
                    "scope_ref_id": andamios_id,
                    "process_name": "Montaje de andamios",
                    "task_name": "Armado y habilitacion de andamio",
                    "position_name": "Andamiero",
                    "hazard_factor": "Trabajo en altura y montaje estructural",
                    "master_risk_code": "A3",
                    "probability": 4,
                    "consequence": 4,
                    "control_hierarchy": {
                        "elimination": ["Evitar trabajo en altura usando prefabricado en piso cuando aplique"],
                        "engineering": ["Andamio certificado, anclado, nivelado y con barandas completas"],
                        "administrative": ["PTS de andamios", "Permiso de trabajo", "Personal competente", "Plan de rescate"],
                        "ppe": ["Arnes de seguridad", "Casco con barbiquejo", "Linea de vida"],
                    },
                    "required_ppe": ["Arnes de seguridad", "Casco con barbiquejo", "Guantes", "Linea de vida"],
                    "protocol_codes": [],
                    "sensitivity_tags": ["altura", "vertigo", "embarazo"],
                    "owner_name": "Supervisor de andamios",
                    "legal_reference": "DS 44 art. 9, 12, 15",
                    "source_note": "Bloque de servicio para armado de andamios.",
                },
                {
                    "name": "Andamios - Caida de objetos",
                    "scope_type": "service_profile",
                    "scope_ref_id": andamios_id,
                    "process_name": "Montaje de andamios",
                    "task_name": "Izaje y manipulacion de piezas",
                    "position_name": "Andamiero",
                    "hazard_factor": "Proyeccion o caida de materiales y herramientas",
                    "master_risk_code": "B2",
                    "probability": 2,
                    "consequence": 4,
                    "control_hierarchy": {
                        "elimination": [],
                        "engineering": ["Rodapies, mallas y segregacion inferior"],
                        "administrative": ["Delimitacion de area", "Izaje controlado", "Uso de porta herramientas"],
                        "ppe": ["Casco con barbiquejo", "Lentes"],
                    },
                    "required_ppe": ["Casco con barbiquejo", "Lentes", "Guantes"],
                    "protocol_codes": [],
                    "sensitivity_tags": ["altura", "golpes"],
                    "owner_name": "Supervisor de andamios",
                    "legal_reference": "DS 44 art. 12",
                    "source_note": "Control de objetos en nivel inferior.",
                },
            ]
        )

    if altura_id:
        blueprints.extend(
            [
                {
                    "name": "Altura - Trabajo sobre estructura",
                    "scope_type": "service_profile",
                    "scope_ref_id": altura_id,
                    "process_name": "Ejecucion en altura",
                    "task_name": "Intervencion sobre estructura elevada",
                    "position_name": "Operador en altura",
                    "hazard_factor": "Trabajo sobre borde o superficie elevada",
                    "master_risk_code": "A3",
                    "probability": 4,
                    "consequence": 4,
                    "control_hierarchy": {
                        "elimination": ["Bajar la tarea a nivel piso cuando sea tecnicamente viable"],
                        "engineering": ["Proteccion colectiva, lineas de vida, puntos de anclaje certificados"],
                        "administrative": ["Permiso de trabajo en altura", "Checklist previo", "Rescate planificado"],
                        "ppe": ["Arnes de seguridad", "Casco con barbiquejo"],
                    },
                    "required_ppe": ["Arnes de seguridad", "Casco con barbiquejo", "Guantes"],
                    "protocol_codes": [],
                    "sensitivity_tags": ["altura", "vertigo", "embarazo"],
                    "owner_name": "Prevencionista",
                    "legal_reference": "DS 44 art. 9 y 12",
                    "source_note": "Bloque de servicio para tareas en altura.",
                },
                {
                    "name": "Altura - Contacto electrico",
                    "scope_type": "service_profile",
                    "scope_ref_id": altura_id,
                    "process_name": "Ejecucion en altura",
                    "task_name": "Trabajo cercano a redes o equipos energizados",
                    "position_name": "Operador en altura",
                    "hazard_factor": "Proximidad a instalaciones electricas",
                    "master_risk_code": "F1",
                    "probability": 2,
                    "consequence": 4,
                    "control_hierarchy": {
                        "elimination": ["Desenergizar o aislar la fuente cuando corresponda"],
                        "engineering": ["Barreras y distancias de seguridad"],
                        "administrative": ["Permiso electrico", "Bloqueo y etiquetado", "Vigilancia permanente"],
                        "ppe": ["Guantes adecuados al riesgo", "Casco dieléctrico"],
                    },
                    "required_ppe": ["Guantes", "Casco con barbiquejo"],
                    "protocol_codes": [],
                    "sensitivity_tags": ["electrico", "altura"],
                    "owner_name": "Supervisor electrico",
                    "legal_reference": "DS 44 art. 15",
                    "source_note": "Aplica cuando el trabajo se ejecuta cerca de energia.",
                },
            ]
        )

    if general_id:
        blueprints.extend(
            [
                {
                    "name": "General - Herramientas y golpes",
                    "scope_type": "service_profile",
                    "scope_ref_id": general_id,
                    "process_name": "Ejecucion general",
                    "task_name": "Uso de herramientas manuales y electricas",
                    "position_name": "Operario",
                    "hazard_factor": "Manipulacion de herramientas y piezas",
                    "master_risk_code": "B4",
                    "probability": 2,
                    "consequence": 2,
                    "control_hierarchy": {
                        "elimination": [],
                        "engineering": ["Herramientas en buen estado y protecciones instaladas"],
                        "administrative": ["Inspeccion de herramientas", "PTS general", "Orden del area"],
                        "ppe": ["Guantes", "Lentes"],
                    },
                    "required_ppe": ["Guantes", "Lentes", "Calzado de seguridad"],
                    "protocol_codes": [],
                    "sensitivity_tags": ["golpes", "manos"],
                    "owner_name": "Supervisor",
                    "legal_reference": "DS 44 art. 15",
                    "source_note": "Bloque general para servicios operativos.",
                },
                {
                    "name": "General - Exposicion a ruido",
                    "scope_type": "service_profile",
                    "scope_ref_id": general_id,
                    "process_name": "Ejecucion general",
                    "task_name": "Uso de herramientas y equipos ruidosos",
                    "position_name": "Operario",
                    "hazard_factor": "Presion sonora elevada",
                    "master_risk_code": "P1",
                    "probability": 2,
                    "consequence": 2,
                    "control_hierarchy": {
                        "elimination": ["Elegir equipos de menor emision sonora cuando sea posible"],
                        "engineering": ["Encapsulamiento o barreras acusticas"],
                        "administrative": ["Control de tiempos de exposicion", "Programa de mantencion"],
                        "ppe": ["Protector auditivo"],
                    },
                    "required_ppe": ["Protector auditivo"],
                    "protocol_codes": ["PREXOR"],
                    "sensitivity_tags": ["ruido", "auditivo"],
                    "owner_name": "Supervisor",
                    "legal_reference": "DS 44 y protocolo PREXOR",
                    "source_note": "Permite enrutamiento automatico a PREXOR.",
                },
                {
                    "name": "General - Manipulacion manual de cargas",
                    "scope_type": "service_profile",
                    "scope_ref_id": general_id,
                    "process_name": "Ejecucion general",
                    "task_name": "Movimiento manual de materiales",
                    "position_name": "Operario",
                    "hazard_factor": "Levantamiento y traslado manual de cargas",
                    "master_risk_code": "R1",
                    "probability": 2,
                    "consequence": 2,
                    "control_hierarchy": {
                        "elimination": ["Uso de ayudas mecanicas para evitar MMC"],
                        "engineering": ["Carros, tecles y elementos auxiliares"],
                        "administrative": ["Limite de peso, capacitacion y tecnica de levantamiento"],
                        "ppe": ["Guantes"],
                    },
                    "required_ppe": ["Guantes"],
                    "protocol_codes": ["TMERT"],
                    "sensitivity_tags": ["carga", "embarazo", "lumbalgia"],
                    "owner_name": "Supervisor",
                    "legal_reference": "DS 44 y TMERT",
                    "source_note": "Cruza con restricciones medicas y gestacion.",
                },
            ]
        )

    return blueprints


def build_row_fingerprint(row: Dict[str, Any]) -> str:
    tokens = [
        str(row.get("process_name") or "").strip().lower(),
        str(row.get("task_name") or "").strip().lower(),
        str(row.get("position_name") or "").strip().lower(),
        str(row.get("hazard_factor") or row.get("hazard") or "").strip().lower(),
        str(row.get("master_risk_code") or "").strip().lower(),
        str(row.get("place_name") or "").strip().lower(),
    ]
    return "|".join(tokens)


def merge_generated_rows(current: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(current)
    merged["origin_blocks"] = dedupe_preserve_order(list(current.get("origin_blocks") or []) + list(incoming.get("origin_blocks") or []))
    merged["origin_rule_ids"] = dedupe_preserve_order(list(current.get("origin_rule_ids") or []) + list(incoming.get("origin_rule_ids") or []))
    merged["source_labels"] = dedupe_preserve_order(list(current.get("source_labels") or []) + list(incoming.get("source_labels") or []))
    merged["required_ppe"] = dedupe_preserve_order(list(current.get("required_ppe") or []) + list(incoming.get("required_ppe") or []))
    merged["protocol_codes"] = dedupe_preserve_order(list(current.get("protocol_codes") or []) + list(incoming.get("protocol_codes") or []))
    merged["sensitivity_tags"] = dedupe_preserve_order(list(current.get("sensitivity_tags") or []) + list(incoming.get("sensitivity_tags") or []))
    merged["restriction_alerts"] = dedupe_preserve_order(list(current.get("restriction_alerts") or []) + list(incoming.get("restriction_alerts") or []))

    hierarchy = normalize_control_hierarchy(current.get("control_hierarchy"))
    incoming_hierarchy = normalize_control_hierarchy(incoming.get("control_hierarchy"))
    for key in hierarchy.keys():
        hierarchy[key] = dedupe_preserve_order(hierarchy[key] + incoming_hierarchy[key])
    merged["control_hierarchy"] = hierarchy
    merged["controls"] = summarize_controls(hierarchy, incoming.get("controls") or current.get("controls") or "")

    merged["probability"] = max(int(current.get("probability") or 0), int(incoming.get("probability") or 0))
    merged["consequence"] = max(int(current.get("consequence") or 0), int(incoming.get("consequence") or 0))
    merged["vep"] = calculate_vep(merged["probability"], merged["consequence"])
    merged["risk_level"] = risk_level_from_vep(merged["vep"])
    merged["action_required"] = action_from_vep(merged["vep"])
    merged["is_blocking"] = bool(merged["vep"] >= 16 or merged.get("restriction_alerts"))
    merged["generated_at"] = _now_iso()
    return merged
