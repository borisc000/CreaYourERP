"""
Payroll / remuneraciones module for Chilean payroll operations.
"""

from __future__ import annotations

import base64
import calendar
import io
import zipfile
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple
from xml.sax.saxutils import escape

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now_iso, utc_today
from modules.document_center.module_document_center import (
    DOCX_MIME,
    PDF_MIME,
    DocumentTemplate,
    _build_pdf,
    _extract_docx_preview_and_keys,
    _merge_docx,
)
from modules.hr.module_hr import EmployeeContract, EmployeeProfile
from modules.signature.module_signature import SignatureLog, SignatureRequest


AFP_CODES = ("capital", "cuprum", "habitat", "modelo", "planvital", "provida", "uno")
HEALTH_SYSTEMS = ("fonasa", "isapre")
LEGAL_GRATIFICATION_MODES = ("none", "article_50_monthly", "manual")
FAMILY_ALLOWANCE_SECTIONS = ("none", "A", "B", "C")
PERIOD_STATUSES = ("draft", "calculated", "approved", "closed")
SETTLEMENT_STATUSES = (
    "draft",
    "calculated",
    "approved",
    "signature_pending",
    "signed",
    "closed",
    "error",
)
SETTLEMENT_EVENTS = (
    "generated",
    "recalculated",
    "approved",
    "signature_requested",
    "signed",
    "closed",
    "viewed",
    "download_docx",
    "download_pdf",
)
SUPPORTED_CONTRACT_TYPES = ("indefinite", "fixed_term")

PESO = Decimal("1")
ZERO = Decimal("0")


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _parse_date(value: Any) -> Optional[date]:
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except Exception:
        return None


def _safe_int(value: Any, default: Optional[int] = 0) -> Optional[int]:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on", "si")


def _decimal(value: Any, default: str = "0") -> Decimal:
    try:
        if value in (None, ""):
            return Decimal(default)
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def _amount(value: Any) -> Decimal:
    return _decimal(value).quantize(PESO, rounding=ROUND_HALF_UP)


def _amount_int(value: Any) -> int:
    return int(_amount(value))


def _pct_value(value: Decimal) -> str:
    return f"{(value * Decimal('100')).quantize(Decimal('0.01'))}%"


def _clp(value: Any) -> str:
    integer = _amount_int(value)
    return f"$ {integer:,.0f}".replace(",", ".")


def _month_range(year: int, month: int) -> Tuple[date, date]:
    start = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    return start, date(year, month, last_day)


def _slug_token(value: Any) -> str:
    raw = "".join(ch if str(ch).isalnum() else "_" for ch in str(value or "").strip())
    cleaned = "_".join(filter(None, raw.split("_")))
    return cleaned[:80] or "documento"


def _b64encode(raw_bytes: bytes) -> str:
    return base64.b64encode(raw_bytes).decode("utf-8")


def _b64decode(raw_data: str) -> bytes:
    if not raw_data:
        return b""
    return base64.b64decode(raw_data.encode("utf-8"))


def _default_liquidation_template_bytes() -> bytes:
    template_text = """
LIQUIDACION DE REMUNERACIONES
Empresa: <<company_name>>
RUT Empresa: <<company_tax_id>>
Trabajador: <<employee_name>>
RUT Trabajador: <<employee_rut>>
Codigo interno: <<employee_code>>
Cargo: <<position_title>>
Periodo: <<period_label>>
Fecha de pago: <<payment_date>>
AFP: <<afp_label>>
Salud: <<health_label>>
Centro de costo: <<cost_center>>

Haberes imponibles:
<<earnings_lines>>

Haberes no imponibles:
<<non_taxable_lines>>

Descuentos legales y otros descuentos:
<<deductions_lines>>

Aportes empleador:
<<employer_lines>>

Totales:
Total haberes: <<total_earnings>>
Total descuentos: <<total_deductions>>
Liquido a pagar: <<net_pay>>
Costo empresa: <<employer_cost>>

Detalle contable:
<<accounting_lines>>

Observaciones:
<<warnings_lines>>

Firma trabajador: _________________________________
Firma empresa: ___________________________________
"""
    buffer = io.BytesIO()
    xml_body = "".join(
        f"<w:p><w:r><w:t>{escape(line)}</w:t></w:r></w:p>"
        for line in template_text.strip().splitlines()
    )
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr(
            "[Content_Types].xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>""",
        )
        zip_file.writestr(
            "_rels/.rels",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""",
        )
        zip_file.writestr(
            "word/document.xml",
            f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {xml_body}
  </w:body>
</w:document>""",
        )
    return buffer.getvalue()


DEFAULT_PAYROLL_PARAMETERS: List[Dict[str, Any]] = [
    {
        "code": "MINIMUM_WAGE",
        "name": "Ingreso minimo mensual",
        "category": "legal_reference",
        "value_numeric": 539000,
        "effective_from": "2026-01-01",
        "source_label": "Direccion del Trabajo - Ingreso minimo",
        "source_url": "https://www.dt.gob.cl/portal/1628/w3-article-60141.html",
        "notes": "Valor general informado por DT a contar del 1 de enero de 2026.",
    },
    {
        "code": "UTM_VALUE",
        "name": "UTM de referencia",
        "category": "tax",
        "value_numeric": 69889,
        "effective_from": "2026-03-01",
        "source_label": "SII - UTM marzo 2026",
        "source_url": "https://www.sii.cl/valores_y_fechas/utm/utm2026.htm",
        "notes": "UTM de marzo 2026 para impuesto unico.",
    },
    {
        "code": "UF_REFERENCE",
        "name": "UF de referencia previsional",
        "category": "social_security",
        "value_numeric": 39790.63,
        "effective_from": "2026-03-01",
        "source_label": "SII - UF valores y fechas",
        "source_url": "https://www.sii.cl/valores_y_fechas/uf/uf2026.htm",
        "notes": "Referencia para topes imponibles. Debe actualizarse mensualmente segun UF aplicable al periodo.",
    },
    {
        "code": "PREVISIONAL_CAP_UF",
        "name": "Tope imponible previsional (UF)",
        "category": "social_security",
        "value_numeric": 90.0,
        "effective_from": "2026-02-01",
        "source_label": "Direccion del Trabajo - Topes imponibles 2026",
        "source_url": "https://dt.gob.cl/portal/1628/w3-article-118076.html",
        "notes": "Tope imponible para AFP, salud y SIS vigente desde febrero de 2026.",
    },
    {
        "code": "AFC_CAP_UF",
        "name": "Tope imponible seguro de cesantia (UF)",
        "category": "social_security",
        "value_numeric": 135.2,
        "effective_from": "2026-02-01",
        "source_label": "Direccion del Trabajo - Topes imponibles 2026",
        "source_url": "https://dt.gob.cl/portal/1628/w3-article-118076.html",
        "notes": "Tope imponible para seguro de cesantia vigente desde febrero de 2026.",
    },
    {
        "code": "PENSION_EMPLOYEE_RATE",
        "name": "Cotizacion obligatoria AFP trabajador",
        "category": "social_security",
        "value_numeric": 0.10,
        "effective_from": "2025-01-01",
        "source_label": "ChileAtiende - Cotizaciones obligatorias",
        "source_url": "https://www.chileatiende.gob.cl/fichas/3311-cotizaciones-previsionales",
        "notes": "Cotizacion legal obligatoria del trabajador dependiente.",
    },
    {
        "code": "HEALTH_RATE",
        "name": "Cotizacion legal salud",
        "category": "social_security",
        "value_numeric": 0.07,
        "effective_from": "2025-01-01",
        "source_label": "ChileAtiende - Cotizaciones obligatorias",
        "source_url": "https://www.chileatiende.gob.cl/fichas/3311-cotizaciones-previsionales",
        "notes": "Cotizacion minima legal para salud.",
    },
]


DEFAULT_TAX_BRACKETS = [
    {"lower_utm": 0.0, "upper_utm": 13.5, "factor": 0.0, "rebate_utm": 0.0},
    {"lower_utm": 13.5, "upper_utm": 30.0, "factor": 0.04, "rebate_utm": 0.54},
    {"lower_utm": 30.0, "upper_utm": 50.0, "factor": 0.08, "rebate_utm": 1.74},
    {"lower_utm": 50.0, "upper_utm": 70.0, "factor": 0.135, "rebate_utm": 4.49},
    {"lower_utm": 70.0, "upper_utm": 90.0, "factor": 0.23, "rebate_utm": 11.14},
    {"lower_utm": 90.0, "upper_utm": 120.0, "factor": 0.304, "rebate_utm": 17.80},
    {"lower_utm": 120.0, "upper_utm": 310.0, "factor": 0.35, "rebate_utm": 23.32},
    {"lower_utm": 310.0, "upper_utm": None, "factor": 0.40, "rebate_utm": 38.82},
]


DEFAULT_PAYROLL_PARAMETERS.extend(
    [
        {
            "code": "AFC_EMPLOYEE_INDEFINITE_RATE",
            "name": "AFC trabajador contrato indefinido",
            "category": "social_security",
            "value_numeric": 0.006,
            "effective_from": "2025-01-01",
            "source_label": "AFC Chile - Tasas cotizacion",
            "source_url": "https://www.afc.cl/afiliados/cotizacion/",
            "notes": "Cotizacion del trabajador con contrato indefinido.",
        },
        {
            "code": "AFC_EMPLOYER_INDEFINITE_RATE",
            "name": "AFC empleador contrato indefinido",
            "category": "social_security",
            "value_numeric": 0.024,
            "effective_from": "2025-01-01",
            "source_label": "AFC Chile - Tasas cotizacion",
            "source_url": "https://www.afc.cl/afiliados/cotizacion/",
            "notes": "Cotizacion del empleador con contrato indefinido.",
        },
        {
            "code": "AFC_EMPLOYER_FIXED_RATE",
            "name": "AFC empleador contrato plazo fijo",
            "category": "social_security",
            "value_numeric": 0.03,
            "effective_from": "2025-01-01",
            "source_label": "AFC Chile - Tasas cotizacion",
            "source_url": "https://www.afc.cl/afiliados/cotizacion/",
            "notes": "Cotizacion del empleador con contrato a plazo fijo, obra o faena.",
        },
        {
            "code": "SIS_EMPLOYER_RATE",
            "name": "Seguro invalidez y sobrevivencia (empleador)",
            "category": "social_security",
            "value_numeric": 0.0154,
            "effective_from": "2026-01-01",
            "source_label": "Superintendencia de Pensiones - SIS 2026",
            "source_url": "https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9897.html",
            "notes": "Tasa SIS publicada por Superintendencia de Pensiones para 2026.",
        },
        {
            "code": "PENSION_REFORM_EMPLOYER_RATE",
            "name": "Cotizacion empleador reforma previsional",
            "category": "social_security",
            "value_numeric": 0.01,
            "effective_from": "2025-08-01",
            "source_label": "Superintendencia de Pensiones - Reforma previsional",
            "source_url": "https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9897.html",
            "notes": "Aporte adicional inicial del empleador segun Ley 21.735.",
        },
        {
            "code": "PENSION_REFORM_ACCOUNT_RATE",
            "name": "Parte a cuenta individual de la cotizacion empleador",
            "category": "social_security",
            "value_numeric": 0.001,
            "effective_from": "2025-08-01",
            "source_label": "Superintendencia de Pensiones - Reforma previsional",
            "source_url": "https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9897.html",
            "notes": "Distribucion referencial del 1% inicial: cuenta individual.",
        },
        {
            "code": "PENSION_REFORM_SOLIDARITY_RATE",
            "name": "Parte al seguro social de la cotizacion empleador",
            "category": "social_security",
            "value_numeric": 0.009,
            "effective_from": "2025-08-01",
            "source_label": "Superintendencia de Pensiones - Reforma previsional",
            "source_url": "https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9897.html",
            "notes": "Distribucion referencial del 1% inicial: seguro social.",
        },
        {
            "code": "ACCIDENT_BASE_RATE",
            "name": "Cotizacion base ley 16.744 + SANNA",
            "category": "social_security",
            "value_numeric": 0.0093,
            "effective_from": "2025-01-01",
            "source_label": "Instituto de Seguridad Laboral",
            "source_url": "https://www.isl.gob.cl/tramites/tasa-de-cotizacion-adicional/",
            "notes": "Tasa base referencial: 0,90% ley 16.744 + 0,03% ley SANNA.",
        },
        {
            "code": "GRATIFICATION_RATE",
            "name": "Gratificacion legal articulo 50",
            "category": "legal_reference",
            "value_numeric": 0.25,
            "effective_from": "2025-01-01",
            "source_label": "Codigo del Trabajo - Articulo 50",
            "source_url": "https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-145446.html",
            "notes": "25% de las remuneraciones devengadas con tope legal.",
        },
        {
            "code": "GRATIFICATION_CAP_MULTIPLIER",
            "name": "Tope anual gratificacion legal en IMM",
            "category": "legal_reference",
            "value_numeric": 4.75,
            "effective_from": "2025-01-01",
            "source_label": "Codigo del Trabajo - Articulo 50",
            "source_url": "https://www.dt.gob.cl/legislacion/1624/w3-propertyvalue-145446.html",
            "notes": "Tope anual expresado en ingresos minimos mensuales.",
        },
        {
            "code": "OVERTIME_FACTOR_44H",
            "name": "Factor hora extra jornada 44 horas",
            "category": "legal_reference",
            "value_numeric": 0.0079545,
            "effective_from": "2025-01-01",
            "source_label": "Direccion del Trabajo - Valor hora extraordinaria",
            "source_url": "https://www.dt.gob.cl/portal/1628/w3-article-99141.html",
            "notes": "Factor oficial publicado por DT para jornada semanal de 44 horas.",
        },
        {
            "code": "FAMILY_ALLOWANCE_A",
            "name": "Asignacion familiar tramo A",
            "category": "benefits",
            "value_numeric": 22007,
            "effective_from": "2026-01-01",
            "source_label": "Direccion del Trabajo - Asignacion familiar",
            "source_url": "https://www.dt.gob.cl/portal/1628/w3-article-60140.html",
            "notes": "Monto por carga tramo A.",
        },
        {
            "code": "FAMILY_ALLOWANCE_B",
            "name": "Asignacion familiar tramo B",
            "category": "benefits",
            "value_numeric": 13505,
            "effective_from": "2026-01-01",
            "source_label": "Direccion del Trabajo - Asignacion familiar",
            "source_url": "https://www.dt.gob.cl/portal/1628/w3-article-60140.html",
            "notes": "Monto por carga tramo B.",
        },
        {
            "code": "FAMILY_ALLOWANCE_C",
            "name": "Asignacion familiar tramo C",
            "category": "benefits",
            "value_numeric": 4267,
            "effective_from": "2026-01-01",
            "source_label": "Direccion del Trabajo - Asignacion familiar",
            "source_url": "https://www.dt.gob.cl/portal/1628/w3-article-60140.html",
            "notes": "Monto por carga tramo C.",
        },
        {
            "code": "FAMILY_ALLOWANCE_LIMIT_A",
            "name": "Tope renta tramo A",
            "category": "benefits",
            "value_numeric": 631976,
            "effective_from": "2026-01-01",
            "source_label": "Direccion del Trabajo - Asignacion familiar",
            "source_url": "https://www.dt.gob.cl/portal/1628/w3-article-60140.html",
            "notes": "Limite superior renta promedio tramo A.",
        },
        {
            "code": "FAMILY_ALLOWANCE_LIMIT_B",
            "name": "Tope renta tramo B",
            "category": "benefits",
            "value_numeric": 923608,
            "effective_from": "2026-01-01",
            "source_label": "Direccion del Trabajo - Asignacion familiar",
            "source_url": "https://www.dt.gob.cl/portal/1628/w3-article-60140.html",
            "notes": "Limite superior renta promedio tramo B.",
        },
        {
            "code": "FAMILY_ALLOWANCE_LIMIT_C",
            "name": "Tope renta tramo C",
            "category": "benefits",
            "value_numeric": 1440400,
            "effective_from": "2026-01-01",
            "source_label": "Direccion del Trabajo - Asignacion familiar",
            "source_url": "https://www.dt.gob.cl/portal/1628/w3-article-60140.html",
            "notes": "Limite superior renta promedio tramo C.",
        },
        {
            "code": "AFP_COMMISSION_CAPITAL",
            "name": "Comision AFP Capital",
            "category": "afp",
            "value_numeric": 0.0144,
            "effective_from": "2026-01-01",
            "source_label": "Superintendencia de Pensiones - Comisiones AFP",
            "source_url": "https://www.spensiones.cl/apps/centroestadisticas/cuadrosCCAF/getComisionAFP.php",
            "notes": "Cotizacion adicional administradora Capital.",
        },
        {
            "code": "AFP_COMMISSION_CUPRUM",
            "name": "Comision AFP Cuprum",
            "category": "afp",
            "value_numeric": 0.0144,
            "effective_from": "2026-01-01",
            "source_label": "Superintendencia de Pensiones - Comisiones AFP",
            "source_url": "https://www.spensiones.cl/apps/centroestadisticas/cuadrosCCAF/getComisionAFP.php",
            "notes": "Cotizacion adicional administradora Cuprum.",
        },
        {
            "code": "AFP_COMMISSION_HABITAT",
            "name": "Comision AFP Habitat",
            "category": "afp",
            "value_numeric": 0.0127,
            "effective_from": "2026-01-01",
            "source_label": "Superintendencia de Pensiones - Comisiones AFP",
            "source_url": "https://www.spensiones.cl/apps/centroestadisticas/cuadrosCCAF/getComisionAFP.php",
            "notes": "Cotizacion adicional administradora Habitat.",
        },
        {
            "code": "AFP_COMMISSION_MODELO",
            "name": "Comision AFP Modelo",
            "category": "afp",
            "value_numeric": 0.0058,
            "effective_from": "2026-01-01",
            "source_label": "Superintendencia de Pensiones - Comisiones AFP",
            "source_url": "https://www.spensiones.cl/apps/centroestadisticas/cuadrosCCAF/getComisionAFP.php",
            "notes": "Cotizacion adicional administradora Modelo.",
        },
        {
            "code": "AFP_COMMISSION_PLANVITAL",
            "name": "Comision AFP PlanVital",
            "category": "afp",
            "value_numeric": 0.0116,
            "effective_from": "2026-01-01",
            "source_label": "Superintendencia de Pensiones - Comisiones AFP",
            "source_url": "https://www.spensiones.cl/apps/centroestadisticas/cuadrosCCAF/getComisionAFP.php",
            "notes": "Cotizacion adicional administradora PlanVital.",
        },
        {
            "code": "AFP_COMMISSION_PROVIDA",
            "name": "Comision AFP ProVida",
            "category": "afp",
            "value_numeric": 0.0145,
            "effective_from": "2026-01-01",
            "source_label": "Superintendencia de Pensiones - Comisiones AFP",
            "source_url": "https://www.spensiones.cl/apps/centroestadisticas/cuadrosCCAF/getComisionAFP.php",
            "notes": "Cotizacion adicional administradora ProVida.",
        },
        {
            "code": "AFP_COMMISSION_UNO",
            "name": "Comision AFP Uno",
            "category": "afp",
            "value_numeric": 0.0046,
            "effective_from": "2026-01-01",
            "source_label": "Superintendencia de Pensiones - Comisiones AFP",
            "source_url": "https://www.spensiones.cl/apps/centroestadisticas/cuadrosCCAF/getComisionAFP.php",
            "notes": "Cotizacion adicional administradora Uno.",
        },
    ]
)


def seed_default_payroll_parameters(company_id: int):
    for item in DEFAULT_PAYROLL_PARAMETERS:
        existing = PayrollLegalParameter.search(
            [
                ("company_id", "=", company_id),
                ("code", "=", item["code"]),
                ("effective_from", "=", item["effective_from"]),
            ]
        )
        if existing:
            continue
        PayrollLegalParameter.create({**item, "company_id": company_id})


def seed_default_tax_brackets(company_id: int):
    for index, item in enumerate(DEFAULT_TAX_BRACKETS, start=1):
        existing = PayrollTaxBracket.search(
            [
                ("company_id", "=", company_id),
                ("effective_from", "=", "2026-01-01"),
                ("order_index", "=", index),
            ]
        )
        if existing:
            continue
        PayrollTaxBracket.create(
            {
                "company_id": company_id,
                "effective_from": "2026-01-01",
                "order_index": index,
                **item,
                "source_label": "SII - Impuesto unico segunda categoria",
                "source_url": "https://www.sii.cl/valores_y_fechas/impuesto_2da_categoria/impuesto2026.htm",
            }
        )


def seed_default_payroll_template(company_id: int):
    existing = DocumentTemplate.search(
        [
            ("company_id", "=", company_id),
            ("document_type", "=", "payroll_liquidation"),
            ("target_module", "=", "payroll"),
        ]
    )
    if existing:
        return

    template_bytes = _default_liquidation_template_bytes()
    placeholder_keys, preview_text = _extract_docx_preview_and_keys(template_bytes)
    DocumentTemplate.create(
        {
            "name": "Liquidacion de remuneraciones estandar",
            "description": "Plantilla base para liquidaciones mensuales editables desde Word.",
            "category": "rrhh",
            "document_type": "payroll_liquidation",
            "target_module": "payroll",
            "status": "active",
            "company_id": company_id,
            "requires_signature": True,
            "filename_pattern": "Liquidacion_<<period_label_safe>>_<<employee_name_safe>>",
            "original_filename": "liquidacion_remuneraciones_estandar.docx",
            "template_mime": DOCX_MIME,
            "template_data": _b64encode(template_bytes),
            "placeholder_keys": placeholder_keys,
            "preview_text": preview_text,
            "tags": ["payroll", "remuneraciones", "rrhh"],
        }
    )


class PayrollLegalParameter(BaseModel, AuditMixin):
    __tablename__ = "payroll_legal_parameters"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    code = Column(ColumnType.STRING, required=True, label="Code")
    name = Column(ColumnType.STRING, required=True, label="Name")
    category = Column(ColumnType.STRING, default="general", label="Category")
    value_numeric = Column(ColumnType.FLOAT, label="Numeric Value")
    value_text = Column(ColumnType.STRING, label="Text Value")
    effective_from = Column(ColumnType.STRING, required=True, label="Effective From")
    effective_to = Column(ColumnType.STRING, label="Effective To")
    source_label = Column(ColumnType.STRING, label="Source Label")
    source_url = Column(ColumnType.STRING, label="Source URL")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        if not (self.code or "").strip():
            raise ValidationError("Parameter code is required")
        if not _parse_date(self.effective_from):
            raise ValidationError("effective_from must use YYYY-MM-DD format")
        if self.effective_to and not _parse_date(self.effective_to):
            raise ValidationError("effective_to must use YYYY-MM-DD format")
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError("effective_to must be after effective_from")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "code": self.code or "",
            "name": self.name or "",
            "category": self.category or "general",
            "value_numeric": self.value_numeric,
            "value_text": self.value_text or "",
            "effective_from": self.effective_from or "",
            "effective_to": self.effective_to or "",
            "source_label": self.source_label or "",
            "source_url": self.source_url or "",
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class PayrollTaxBracket(BaseModel, AuditMixin):
    __tablename__ = "payroll_tax_brackets"
    __displayname__ = "order_index"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    effective_from = Column(ColumnType.STRING, required=True, label="Effective From")
    effective_to = Column(ColumnType.STRING, label="Effective To")
    order_index = Column(ColumnType.INTEGER, required=True, label="Order")
    lower_utm = Column(ColumnType.FLOAT, default=0.0, label="Lower UTM")
    upper_utm = Column(ColumnType.FLOAT, label="Upper UTM")
    factor = Column(ColumnType.FLOAT, default=0.0, label="Factor")
    rebate_utm = Column(ColumnType.FLOAT, default=0.0, label="Rebate UTM")
    source_label = Column(ColumnType.STRING, label="Source Label")
    source_url = Column(ColumnType.STRING, label="Source URL")

    def validate(self):
        super().validate()
        if not _parse_date(self.effective_from):
            raise ValidationError("effective_from must use YYYY-MM-DD format")
        if self.effective_to and not _parse_date(self.effective_to):
            raise ValidationError("effective_to must use YYYY-MM-DD format")
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError("effective_to must be after effective_from")
        if _safe_float(self.factor) < 0:
            raise ValidationError("factor cannot be negative")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "effective_from": self.effective_from or "",
            "effective_to": self.effective_to or "",
            "order_index": self.order_index or 0,
            "lower_utm": self.lower_utm or 0.0,
            "upper_utm": self.upper_utm,
            "factor": self.factor or 0.0,
            "rebate_utm": self.rebate_utm or 0.0,
            "source_label": self.source_label or "",
            "source_url": self.source_url or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class PayrollProfile(BaseModel, AuditMixin):
    __tablename__ = "payroll_profiles"
    __displayname__ = "employee_id"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    contract_id = Column(ColumnType.INTEGER, label="Contract")
    national_id = Column(ColumnType.STRING, label="RUT")
    afp_code = Column(ColumnType.STRING, default="uno", label="AFP")
    health_system = Column(ColumnType.STRING, default="fonasa", label="Health")
    health_plan_clp = Column(ColumnType.FLOAT, default=0.0, label="Health Plan")
    legal_gratification_mode = Column(
        ColumnType.STRING,
        default="article_50_monthly",
        label="Legal Gratification Mode",
    )
    manual_gratification_amount = Column(ColumnType.FLOAT, default=0.0, label="Manual Gratification")
    family_allowance_section = Column(ColumnType.STRING, default="none", label="Family Allowance Section")
    family_allowance_charges = Column(ColumnType.INTEGER, default=0, label="Family Allowance Charges")
    recurring_taxable_bonus = Column(ColumnType.FLOAT, default=0.0, label="Recurring Taxable Bonus")
    recurring_non_taxable_allowance = Column(
        ColumnType.FLOAT, default=0.0, label="Recurring Non Taxable Allowance"
    )
    recurring_other_deduction = Column(ColumnType.FLOAT, default=0.0, label="Recurring Other Deduction")
    loan_deduction = Column(ColumnType.FLOAT, default=0.0, label="Loan Deduction")
    advance_deduction = Column(ColumnType.FLOAT, default=0.0, label="Advance Deduction")
    weekly_hours = Column(ColumnType.FLOAT, default=44.0, label="Weekly Hours")
    accident_rate = Column(ColumnType.FLOAT, default=0.0093, label="Accident Rate")
    cost_center = Column(ColumnType.STRING, label="Cost Center")
    payroll_enabled = Column(ColumnType.BOOLEAN, default=True, label="Payroll Enabled")
    require_signature = Column(ColumnType.BOOLEAN, default=True, label="Requires Signature")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        if self.afp_code not in AFP_CODES:
            raise ValidationError(f"AFP must be one of: {', '.join(AFP_CODES)}")
        if self.health_system not in HEALTH_SYSTEMS:
            raise ValidationError(f"Health system must be one of: {', '.join(HEALTH_SYSTEMS)}")
        if self.legal_gratification_mode not in LEGAL_GRATIFICATION_MODES:
            raise ValidationError(
                "legal_gratification_mode must be one of: "
                + ", ".join(LEGAL_GRATIFICATION_MODES)
            )
        if self.family_allowance_section not in FAMILY_ALLOWANCE_SECTIONS:
            raise ValidationError(
                "family_allowance_section must be one of: "
                + ", ".join(FAMILY_ALLOWANCE_SECTIONS)
            )

    def to_dict(self) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        contract = EmployeeContract.find_by_id(self.contract_id) if self.contract_id else None
        return {
            "id": self.id,
            "company_id": self.company_id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "position_title": employee.position_title if employee else None,
            "contract_id": self.contract_id,
            "contract_type": contract.contract_type if contract else None,
            "national_id": self.national_id or "",
            "afp_code": self.afp_code or "uno",
            "health_system": self.health_system or "fonasa",
            "health_plan_clp": self.health_plan_clp or 0.0,
            "legal_gratification_mode": self.legal_gratification_mode or "article_50_monthly",
            "manual_gratification_amount": self.manual_gratification_amount or 0.0,
            "family_allowance_section": self.family_allowance_section or "none",
            "family_allowance_charges": self.family_allowance_charges or 0,
            "recurring_taxable_bonus": self.recurring_taxable_bonus or 0.0,
            "recurring_non_taxable_allowance": self.recurring_non_taxable_allowance or 0.0,
            "recurring_other_deduction": self.recurring_other_deduction or 0.0,
            "loan_deduction": self.loan_deduction or 0.0,
            "advance_deduction": self.advance_deduction or 0.0,
            "weekly_hours": self.weekly_hours or 44.0,
            "accident_rate": self.accident_rate or 0.0093,
            "cost_center": self.cost_center or "",
            "payroll_enabled": bool(self.payroll_enabled),
            "require_signature": bool(self.require_signature),
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class PayrollPeriod(BaseModel, AuditMixin):
    __tablename__ = "payroll_periods"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    name = Column(ColumnType.STRING, required=True, label="Name")
    year = Column(ColumnType.INTEGER, required=True, label="Year")
    month = Column(ColumnType.INTEGER, required=True, label="Month")
    start_date = Column(ColumnType.STRING, required=True, label="Start Date")
    end_date = Column(ColumnType.STRING, required=True, label="End Date")
    payment_date = Column(ColumnType.STRING, required=True, label="Payment Date")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    template_id = Column(ColumnType.INTEGER, label="Template")
    notes = Column(ColumnType.TEXT, label="Notes")

    def before_create(self):
        if not self.start_date or not self.end_date:
            start, end = _month_range(_safe_int(self.year), _safe_int(self.month))
            self.start_date = self.start_date or start.isoformat()
            self.end_date = self.end_date or end.isoformat()
        if not self.payment_date:
            self.payment_date = self.end_date

    def validate(self):
        super().validate()
        if self.status not in PERIOD_STATUSES:
            raise ValidationError(f"status must be one of: {', '.join(PERIOD_STATUSES)}")
        if _safe_int(self.month) not in range(1, 13):
            raise ValidationError("month must be between 1 and 12")
        if not _parse_date(self.start_date) or not _parse_date(self.end_date):
            raise ValidationError("start_date and end_date must use YYYY-MM-DD")
        if self.end_date < self.start_date:
            raise ValidationError("end_date must be after start_date")

    def to_dict(self) -> Dict[str, Any]:
        template = DocumentTemplate.find_by_id(self.template_id) if self.template_id else None
        return {
            "id": self.id,
            "company_id": self.company_id,
            "name": self.name or "",
            "year": self.year or 0,
            "month": self.month or 0,
            "start_date": self.start_date or "",
            "end_date": self.end_date or "",
            "payment_date": self.payment_date or "",
            "status": self.status or "draft",
            "template_id": self.template_id,
            "template_name": template.name if template else None,
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class PayrollSettlement(BaseModel, AuditMixin):
    __tablename__ = "payroll_settlements"
    __displayname__ = "employee_id"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    period_id = Column(ColumnType.INTEGER, required=True, label="Period")
    template_id = Column(ColumnType.INTEGER, label="Template")
    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    contract_id = Column(ColumnType.INTEGER, required=True, label="Contract")
    payroll_profile_id = Column(ColumnType.INTEGER, required=True, label="Payroll Profile")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    worked_days = Column(ColumnType.FLOAT, default=30.0, label="Worked Days")
    overtime_hours = Column(ColumnType.FLOAT, default=0.0, label="Overtime Hours")
    taxable_bonus = Column(ColumnType.FLOAT, default=0.0, label="Taxable Bonus")
    non_taxable_allowances = Column(ColumnType.FLOAT, default=0.0, label="Non Taxable Allowances")
    other_deductions = Column(ColumnType.FLOAT, default=0.0, label="Other Deductions")
    loan_deduction = Column(ColumnType.FLOAT, default=0.0, label="Loan Deduction")
    advance_deduction = Column(ColumnType.FLOAT, default=0.0, label="Advance Deduction")
    manual_gratification_amount = Column(ColumnType.FLOAT, default=0.0, label="Manual Gratification")
    base_salary = Column(ColumnType.FLOAT, default=0.0, label="Base Salary")
    taxable_income = Column(ColumnType.FLOAT, default=0.0, label="Taxable Income")
    non_taxable_income = Column(ColumnType.FLOAT, default=0.0, label="Non Taxable Income")
    total_earnings = Column(ColumnType.FLOAT, default=0.0, label="Total Earnings")
    total_deductions = Column(ColumnType.FLOAT, default=0.0, label="Total Deductions")
    net_pay = Column(ColumnType.FLOAT, default=0.0, label="Net Pay")
    tax_base = Column(ColumnType.FLOAT, default=0.0, label="Tax Base")
    tax_amount = Column(ColumnType.FLOAT, default=0.0, label="Tax Amount")
    legal_gratification_amount = Column(ColumnType.FLOAT, default=0.0, label="Legal Gratification")
    family_allowance_amount = Column(ColumnType.FLOAT, default=0.0, label="Family Allowance")
    pension_amount = Column(ColumnType.FLOAT, default=0.0, label="Pension")
    afp_commission_amount = Column(ColumnType.FLOAT, default=0.0, label="AFP Commission")
    health_amount = Column(ColumnType.FLOAT, default=0.0, label="Health")
    afc_employee_amount = Column(ColumnType.FLOAT, default=0.0, label="AFC Employee")
    employer_afc_amount = Column(ColumnType.FLOAT, default=0.0, label="AFC Employer")
    employer_sis_amount = Column(ColumnType.FLOAT, default=0.0, label="SIS Employer")
    employer_accident_amount = Column(ColumnType.FLOAT, default=0.0, label="Accident Employer")
    employer_pension_reform_amount = Column(ColumnType.FLOAT, default=0.0, label="Reform Employer")
    employer_total = Column(ColumnType.FLOAT, default=0.0, label="Employer Total")
    employer_cost = Column(ColumnType.FLOAT, default=0.0, label="Employer Cost")
    line_items = Column(ColumnType.JSON, default=[], label="Line Items")
    accounting_lines = Column(ColumnType.JSON, default=[], label="Accounting Lines")
    warnings = Column(ColumnType.JSON, default=[], label="Warnings")
    calculation_snapshot = Column(ColumnType.JSON, default={}, label="Snapshot")
    document_name = Column(ColumnType.STRING, label="Document Name")
    docx_data = Column(ColumnType.TEXT, label="DOCX")
    pdf_data = Column(ColumnType.TEXT, label="PDF")
    signature_request_id = Column(ColumnType.INTEGER, label="Signature Request")
    requires_signature = Column(ColumnType.BOOLEAN, default=True, label="Requires Signature")
    approved_by = Column(ColumnType.INTEGER, label="Approved By")
    approved_at = Column(ColumnType.STRING, label="Approved At")
    signed_at = Column(ColumnType.STRING, label="Signed At")
    closed_at = Column(ColumnType.STRING, label="Closed At")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        if self.status not in SETTLEMENT_STATUSES:
            raise ValidationError("Invalid settlement status")

    def to_dict(self, include_content: bool = False) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        contract = EmployeeContract.find_by_id(self.contract_id) if self.contract_id else None
        period = PayrollPeriod.find_by_id(self.period_id) if self.period_id else None
        profile = PayrollProfile.find_by_id(self.payroll_profile_id) if self.payroll_profile_id else None
        template = DocumentTemplate.find_by_id(self.template_id) if self.template_id else None
        signature_request = SignatureRequest.find_by_id(self.signature_request_id) if self.signature_request_id else None
        data = {
            "id": self.id,
            "company_id": self.company_id,
            "period_id": self.period_id,
            "period_name": period.name if period else None,
            "template_id": self.template_id,
            "template_name": template.name if template else None,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "contract_id": self.contract_id,
            "contract_type": contract.contract_type if contract else None,
            "payroll_profile_id": self.payroll_profile_id,
            "afp_code": profile.afp_code if profile else None,
            "health_system": profile.health_system if profile else None,
            "status": self.status or "draft",
            "worked_days": self.worked_days or 0.0,
            "overtime_hours": self.overtime_hours or 0.0,
            "taxable_bonus": self.taxable_bonus or 0.0,
            "non_taxable_allowances": self.non_taxable_allowances or 0.0,
            "other_deductions": self.other_deductions or 0.0,
            "loan_deduction": self.loan_deduction or 0.0,
            "advance_deduction": self.advance_deduction or 0.0,
            "manual_gratification_amount": self.manual_gratification_amount or 0.0,
            "base_salary": self.base_salary or 0.0,
            "taxable_income": self.taxable_income or 0.0,
            "non_taxable_income": self.non_taxable_income or 0.0,
            "total_earnings": self.total_earnings or 0.0,
            "total_deductions": self.total_deductions or 0.0,
            "net_pay": self.net_pay or 0.0,
            "tax_base": self.tax_base or 0.0,
            "tax_amount": self.tax_amount or 0.0,
            "legal_gratification_amount": self.legal_gratification_amount or 0.0,
            "family_allowance_amount": self.family_allowance_amount or 0.0,
            "pension_amount": self.pension_amount or 0.0,
            "afp_commission_amount": self.afp_commission_amount or 0.0,
            "health_amount": self.health_amount or 0.0,
            "afc_employee_amount": self.afc_employee_amount or 0.0,
            "employer_afc_amount": self.employer_afc_amount or 0.0,
            "employer_sis_amount": self.employer_sis_amount or 0.0,
            "employer_accident_amount": self.employer_accident_amount or 0.0,
            "employer_pension_reform_amount": self.employer_pension_reform_amount or 0.0,
            "employer_total": self.employer_total or 0.0,
            "employer_cost": self.employer_cost or 0.0,
            "line_items": self.line_items or [],
            "accounting_lines": self.accounting_lines or [],
            "warnings": self.warnings or [],
            "calculation_snapshot": self.calculation_snapshot or {},
            "document_name": self.document_name or "",
            "signature_request_id": self.signature_request_id,
            "signature_public_url": signature_request.to_dict().get("public_url") if signature_request else None,
            "requires_signature": bool(self.requires_signature),
            "approved_by": self.approved_by,
            "approved_at": self.approved_at or "",
            "signed_at": self.signed_at or "",
            "closed_at": self.closed_at or "",
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }
        if include_content:
            data["docx_data"] = self.docx_data
            data["pdf_data"] = self.pdf_data
        return data


class PayrollEventLog(BaseModel, AuditMixin):
    __tablename__ = "payroll_event_logs"
    __displayname__ = "event"

    settlement_id = Column(ColumnType.INTEGER, required=True, label="Settlement")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    event = Column(ColumnType.STRING, required=True, label="Event")
    user_id = Column(ColumnType.INTEGER, label="User")
    notes = Column(ColumnType.TEXT, label="Notes")
    metadata = Column(ColumnType.JSON, default={}, label="Metadata")

    def validate(self):
        super().validate()
        if self.event not in SETTLEMENT_EVENTS:
            raise ValidationError("Invalid payroll event")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "settlement_id": self.settlement_id,
            "company_id": self.company_id,
            "event": self.event or "",
            "user_id": self.user_id,
            "notes": self.notes or "",
            "metadata": self.metadata or {},
            "created_at": _fmt_dt(self._data.get("created_at")),
        }


class PayrollModule(BaseModule):
    name = "payroll"
    version = "1.0.0"
    author = "Your Company"
    description = "Payroll, legal parameters, settlements and signature-ready liquidations"
    depends = ["base", "hr", "document_center", "signature"]

    def init_module(self):
        self.register_model("payroll.legal_parameter", PayrollLegalParameter)
        self.register_model("payroll.tax_bracket", PayrollTaxBracket)
        self.register_model("payroll.profile", PayrollProfile)
        self.register_model("payroll.period", PayrollPeriod)
        self.register_model("payroll.settlement", PayrollSettlement)
        self.register_model("payroll.event", PayrollEventLog)

        self.register_route("/payroll/stats", self.get_stats, methods=["GET"], auth_required=True)
        self.register_route("/payroll/lookups", self.get_lookups, methods=["GET"], auth_required=True)
        self.register_route("/payroll/legal-parameters", self.list_legal_parameters, methods=["GET"], auth_required=True)
        self.register_route("/payroll/legal-parameters", self.create_legal_parameter, methods=["POST"], auth_required=True)
        self.register_route("/payroll/legal-parameters/{id}", self.update_legal_parameter, methods=["PUT"], auth_required=True)
        self.register_route("/payroll/legal-parameters/{id}", self.delete_legal_parameter, methods=["DELETE"], auth_required=True)
        self.register_route("/payroll/tax-brackets", self.list_tax_brackets, methods=["GET"], auth_required=True)
        self.register_route("/payroll/tax-brackets", self.create_tax_bracket, methods=["POST"], auth_required=True)
        self.register_route("/payroll/tax-brackets/{id}", self.update_tax_bracket, methods=["PUT"], auth_required=True)
        self.register_route("/payroll/tax-brackets/{id}", self.delete_tax_bracket, methods=["DELETE"], auth_required=True)
        self.register_route("/payroll/profiles", self.list_profiles, methods=["GET"], auth_required=True)
        self.register_route("/payroll/profiles", self.create_profile, methods=["POST"], auth_required=True)
        self.register_route("/payroll/profiles/{id}", self.update_profile, methods=["PUT"], auth_required=True)
        self.register_route("/payroll/profiles/{id}", self.delete_profile, methods=["DELETE"], auth_required=True)
        self.register_route("/payroll/periods", self.list_periods, methods=["GET"], auth_required=True)
        self.register_route("/payroll/periods", self.create_period, methods=["POST"], auth_required=True)
        self.register_route("/payroll/periods/{id}", self.get_period, methods=["GET"], auth_required=True)
        self.register_route("/payroll/periods/{id}", self.update_period, methods=["PUT"], auth_required=True)
        self.register_route("/payroll/periods/{id}", self.delete_period, methods=["DELETE"], auth_required=True)
        self.register_route("/payroll/periods/{id}/calculate", self.calculate_period, methods=["POST"], auth_required=True)
        self.register_route("/payroll/periods/{id}/approve", self.approve_period, methods=["POST"], auth_required=True)
        self.register_route("/payroll/periods/{id}/close", self.close_period, methods=["POST"], auth_required=True)
        self.register_route("/payroll/settlements", self.list_settlements, methods=["GET"], auth_required=True)
        self.register_route("/payroll/settlements/{id}", self.get_settlement, methods=["GET"], auth_required=True)
        self.register_route("/payroll/settlements/{id}", self.update_settlement, methods=["PUT"], auth_required=True)
        self.register_route("/payroll/settlements/{id}/approve", self.approve_settlement, methods=["POST"], auth_required=True)
        self.register_route("/payroll/settlements/{id}/document", self.get_settlement_document, methods=["GET"], auth_required=True)
        self.register_route("/payroll/settlements/{id}/send-signature", self.send_settlement_signature, methods=["POST"], auth_required=True)
        self.register_route("/payroll/settlements/{id}/close", self.close_settlement, methods=["POST"], auth_required=True)
        self.register_route("/payroll/settlements/{id}/history", self.get_settlement_history, methods=["GET"], auth_required=True)

        self.logger.info("Payroll module initialized")

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
        allowed = set(user.allowed_modules or [])
        if allowed.intersection({"payroll", "hr"}):
            return None
        return Response.forbidden("You do not have access to remuneraciones")

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        if self.env.user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Only administrators can manage remuneraciones")
        return None

    def _ensure_seeded(self):
        company_id = self._company_id()
        if not company_id:
            return
        seed_default_payroll_parameters(company_id)
        seed_default_tax_brackets(company_id)
        seed_default_payroll_template(company_id)

    def _legal_parameter_or_404(
        self, parameter_id: Any
    ) -> Tuple[Optional[PayrollLegalParameter], Optional[Response]]:
        parameter = PayrollLegalParameter.find_by_id(_safe_int(parameter_id))
        if not parameter or (
            self.env.user.role != "superadmin" and parameter.company_id != self._company_id()
        ):
            return None, Response.not_found("Legal parameter not found")
        return parameter, None

    def _tax_bracket_or_404(
        self, bracket_id: Any
    ) -> Tuple[Optional[PayrollTaxBracket], Optional[Response]]:
        bracket = PayrollTaxBracket.find_by_id(_safe_int(bracket_id))
        if not bracket or (
            self.env.user.role != "superadmin" and bracket.company_id != self._company_id()
        ):
            return None, Response.not_found("Tax bracket not found")
        return bracket, None

    def _profile_or_404(self, profile_id: Any) -> Tuple[Optional[PayrollProfile], Optional[Response]]:
        profile = PayrollProfile.find_by_id(_safe_int(profile_id))
        if not profile or (
            self.env.user.role != "superadmin" and profile.company_id != self._company_id()
        ):
            return None, Response.not_found("Payroll profile not found")
        return profile, None

    def _period_or_404(self, period_id: Any) -> Tuple[Optional[PayrollPeriod], Optional[Response]]:
        period = PayrollPeriod.find_by_id(_safe_int(period_id))
        if not period or (
            self.env.user.role != "superadmin" and period.company_id != self._company_id()
        ):
            return None, Response.not_found("Payroll period not found")
        return period, None

    def _settlement_or_404(
        self, settlement_id: Any
    ) -> Tuple[Optional[PayrollSettlement], Optional[Response]]:
        settlement = PayrollSettlement.find_by_id(_safe_int(settlement_id))
        if not settlement or (
            self.env.user.role != "superadmin" and settlement.company_id != self._company_id()
        ):
            return None, Response.not_found("Payroll settlement not found")
        return settlement, None

    def _resolve_company(self):
        try:
            from modules.base.module_base import Company

            return Company.find_by_id(self._company_id())
        except Exception:
            return None

    def _resolve_template(self, company_id: int, template_id: Optional[int]) -> Tuple[Optional[DocumentTemplate], bytes]:
        template = None
        if template_id:
            template = DocumentTemplate.find_by_id(template_id)
            if template and template.company_id != company_id and self.env.user.role != "superadmin":
                template = None
            if template and (template.target_module or "") != "payroll":
                template = None
        if not template:
            templates = DocumentTemplate.search(
                [
                    ("company_id", "=", company_id),
                    ("document_type", "=", "payroll_liquidation"),
                    ("target_module", "=", "payroll"),
                ]
            )
            templates = [item for item in templates if (item.status or "") != "archived"]
            templates.sort(key=lambda item: ((item.status or "") != "active", item.id or 0))
            template = templates[0] if templates else None
        if template and template.template_data:
            return template, _b64decode(template.template_data)
        return None, _default_liquidation_template_bytes()

    def _effective_parameters(self, on_date: Optional[date] = None) -> Dict[str, PayrollLegalParameter]:
        on_date = on_date or utc_today()
        params = PayrollLegalParameter.search(self._tenant_filter())
        current: Dict[str, PayrollLegalParameter] = {}
        for item in params:
            start = _parse_date(item.effective_from)
            end = _parse_date(item.effective_to)
            if not start or start > on_date:
                continue
            if end and end < on_date:
                continue
            chosen = current.get(item.code)
            if not chosen or (_parse_date(chosen.effective_from) or date.min) < start:
                current[item.code] = item
        return current

    def _effective_tax_brackets(self, on_date: Optional[date] = None) -> List[PayrollTaxBracket]:
        on_date = on_date or utc_today()
        brackets = PayrollTaxBracket.search(self._tenant_filter())
        current: Dict[int, PayrollTaxBracket] = {}
        for item in brackets:
            start = _parse_date(item.effective_from)
            end = _parse_date(item.effective_to)
            if not start or start > on_date:
                continue
            if end and end < on_date:
                continue
            chosen = current.get(item.order_index or 0)
            if not chosen or (_parse_date(chosen.effective_from) or date.min) < start:
                current[item.order_index or 0] = item
        return [current[index] for index in sorted(current)]

    def _parameter_value(
        self, param_map: Dict[str, PayrollLegalParameter], code: str, default: Decimal = ZERO
    ) -> Decimal:
        item = param_map.get(code)
        if not item:
            return default
        return _decimal(item.value_numeric if item.value_numeric is not None else item.value_text)

    def _active_contract_for_period(
        self, employee_id: int, period: PayrollPeriod, preferred_contract_id: Optional[int] = None
    ) -> Optional[EmployeeContract]:
        contracts = EmployeeContract.search([("company_id", "=", self._company_id()), ("employee_id", "=", employee_id)])
        start = _parse_date(period.start_date)
        end = _parse_date(period.end_date)
        active: List[EmployeeContract] = []
        for contract in contracts:
            contract_start = _parse_date(contract.start_date)
            contract_end = _parse_date(contract.end_date)
            if not contract_start or not start or not end:
                continue
            if contract_end and contract_end < start:
                continue
            if contract_start > end:
                continue
            if preferred_contract_id and contract.id == preferred_contract_id:
                active.insert(0, contract)
            elif (contract.status or "") in ("active", "draft"):
                active.append(contract)
        active.sort(key=lambda item: (item.id or 0), reverse=True)
        return active[0] if active else None

    def _overlap_days(self, period: PayrollPeriod, contract: EmployeeContract) -> int:
        period_start = _parse_date(period.start_date)
        period_end = _parse_date(period.end_date)
        contract_start = _parse_date(contract.start_date)
        contract_end = _parse_date(contract.end_date) or period_end
        if not period_start or not period_end or not contract_start:
            return 30
        overlap_start = max(period_start, contract_start)
        overlap_end = min(period_end, contract_end or period_end)
        days = (overlap_end - overlap_start).days + 1
        return max(0, min(30, days))

    def _compute_tax(
        self, tax_base: Decimal, utm_value: Decimal, brackets: List[PayrollTaxBracket]
    ) -> Tuple[Decimal, Optional[PayrollTaxBracket]]:
        if tax_base <= ZERO or utm_value <= ZERO:
            return ZERO, brackets[0] if brackets else None
        taxable_utm = tax_base / utm_value
        selected = None
        for bracket in brackets:
            lower = _decimal(bracket.lower_utm)
            upper = _decimal(bracket.upper_utm) if bracket.upper_utm is not None else None
            if taxable_utm >= lower and (upper is None or taxable_utm < upper):
                selected = bracket
                break
        if not selected and brackets:
            selected = brackets[-1]
        if not selected:
            return ZERO, None
        factor = _decimal(selected.factor)
        rebate_clp = utm_value * _decimal(selected.rebate_utm)
        tax = (tax_base * factor) - rebate_clp
        return _amount(max(tax, ZERO)), selected

    def _line(self, kind: str, label: str, amount: Decimal, taxable: bool = False) -> Dict[str, Any]:
        return {
            "kind": kind,
            "label": label,
            "amount": _amount_int(amount),
            "taxable": taxable,
            "formatted_amount": _clp(amount),
        }

    def _account_line(self, account_code: str, account_name: str, debit: Decimal, credit: Decimal) -> Dict[str, Any]:
        return {
            "account_code": account_code,
            "account_name": account_name,
            "debit": _amount_int(debit),
            "credit": _amount_int(credit),
            "debit_formatted": _clp(debit),
            "credit_formatted": _clp(credit),
        }

    def _build_merge_data(
        self,
        company: Any,
        employee: EmployeeProfile,
        contract: EmployeeContract,
        profile: PayrollProfile,
        period: PayrollPeriod,
        settlement: PayrollSettlement,
    ) -> Dict[str, Any]:
        line_items = settlement.line_items or []
        earnings_lines = [
            f"- {item['label']}: {item['formatted_amount']}"
            for item in line_items
            if item.get("kind") == "earning" and item.get("amount", 0) > 0
        ] or ["- Sin haberes imponibles"]
        non_taxable_lines = [
            f"- {item['label']}: {item['formatted_amount']}"
            for item in line_items
            if item.get("kind") == "non_taxable" and item.get("amount", 0) > 0
        ] or ["- Sin haberes no imponibles"]
        deduction_lines = [
            f"- {item['label']}: {item['formatted_amount']}"
            for item in line_items
            if item.get("kind") == "deduction" and item.get("amount", 0) > 0
        ] or ["- Sin descuentos"]
        employer_lines = [
            f"- {item['label']}: {item['formatted_amount']}"
            for item in line_items
            if item.get("kind") == "employer" and item.get("amount", 0) > 0
        ] or ["- Sin aportes patronales"]
        accounting_lines = [
            f"- {item['account_code']} {item['account_name']} | Debe {item['debit_formatted']} | Haber {item['credit_formatted']}"
            for item in (settlement.accounting_lines or [])
        ] or ["- Sin asiento contable"]

        warnings = settlement.warnings or []
        health_label = "Fonasa 7%" if profile.health_system == "fonasa" else f"Isapre { _clp(profile.health_plan_clp or 0) }"
        return {
            "company_name": getattr(company, "legal_name", None) or getattr(company, "name", None) or "Empresa",
            "company_tax_id": getattr(company, "tax_id", None) or "-",
            "employee_name": employee.full_name or "",
            "employee_name_safe": _slug_token(employee.full_name or employee.employee_code),
            "employee_code": employee.employee_code or "",
            "employee_rut": profile.national_id or "-",
            "position_title": employee.position_title or "",
            "period_label": f"{period.year}-{int(period.month):02d}",
            "period_label_safe": f"{period.year}_{int(period.month):02d}",
            "payment_date": period.payment_date or "",
            "afp_label": (profile.afp_code or "").upper(),
            "health_label": health_label,
            "cost_center": profile.cost_center or "-",
            "worked_days": str(_amount_int(settlement.worked_days or 0)),
            "overtime_hours": str(_amount_int(settlement.overtime_hours or 0)),
            "base_salary": _clp(settlement.base_salary),
            "taxable_income": _clp(settlement.taxable_income),
            "non_taxable_income": _clp(settlement.non_taxable_income),
            "total_earnings": _clp(settlement.total_earnings),
            "total_deductions": _clp(settlement.total_deductions),
            "net_pay": _clp(settlement.net_pay),
            "tax_amount": _clp(settlement.tax_amount),
            "tax_base": _clp(settlement.tax_base),
            "employer_cost": _clp(settlement.employer_cost),
            "earnings_lines": "\n".join(earnings_lines),
            "non_taxable_lines": "\n".join(non_taxable_lines),
            "deductions_lines": "\n".join(deduction_lines),
            "employer_lines": "\n".join(employer_lines),
            "accounting_lines": "\n".join(accounting_lines),
            "warnings_lines": "\n".join(f"- {item}" for item in warnings) if warnings else "- Sin observaciones",
            "signature_required": "SI" if settlement.requires_signature else "NO",
            "contract_type": contract.contract_type or "",
        }

    def _generate_documents(
        self,
        period: PayrollPeriod,
        employee: EmployeeProfile,
        contract: EmployeeContract,
        profile: PayrollProfile,
        settlement: PayrollSettlement,
    ) -> Tuple[str, str, str]:
        company = self._resolve_company()
        template, template_bytes = self._resolve_template(self._company_id(), settlement.template_id or period.template_id)
        merge_data = self._build_merge_data(company, employee, contract, profile, period, settlement)
        merged_docx, preview_text = _merge_docx(template_bytes, merge_data)
        title = (
            template.filename_pattern if template else "Liquidacion_<<period_label_safe>>_<<employee_name_safe>>"
        )
        for key, value in merge_data.items():
            title = title.replace(f"<<{key}>>", str(value))
        title = title or f"Liquidacion_{period.year}_{period.month:02d}_{employee.employee_code or employee.id}"
        pdf_bytes = _build_pdf(
            title,
            merged_docx,
            preview_text,
            extra_lines=[
                f"Periodo: {period.year}-{int(period.month):02d}",
                f"Trabajador: {employee.full_name}",
                f"Documento generado por modulo remuneraciones",
            ],
        )
        return title, _b64encode(merged_docx), _b64encode(pdf_bytes)

    def _update_period_status(self, period: PayrollPeriod):
        settlements = PayrollSettlement.search([("period_id", "=", period.id)])
        if not settlements:
            period.status = "draft"
            period.save()
            return
        statuses = {item.status for item in settlements}
        if statuses == {"closed"}:
            period.status = "closed"
        elif statuses.issubset({"approved", "signature_pending", "signed", "closed"}):
            period.status = "approved"
        elif statuses.intersection({"calculated", "approved", "signature_pending", "signed", "closed"}):
            period.status = "calculated"
        else:
            period.status = "draft"
        period.save()

    def _refresh_signature_state(self, settlement: PayrollSettlement):
        if not settlement.signature_request_id:
            return
        signature_request = SignatureRequest.find_by_id(settlement.signature_request_id)
        if not signature_request:
            return
        if signature_request.status == "signed" and settlement.status not in ("signed", "closed"):
            settlement.status = "signed"
            settlement.signed_at = (
            signature_request.signed_at.isoformat() if signature_request.signed_at else utc_now_iso()
            )
            settlement.save()
            self._log_event(settlement, "signed", notes="Firma completada desde modulo de firmas")
        elif signature_request.status in ("sent", "viewed") and settlement.status not in ("signed", "closed"):
            settlement.status = "signature_pending"
            settlement.save()
        period = PayrollPeriod.find_by_id(settlement.period_id)
        if period:
            self._update_period_status(period)

    def _log_event(
        self,
        settlement: PayrollSettlement,
        event: str,
        notes: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        PayrollEventLog.create(
            {
                "settlement_id": settlement.id,
                "company_id": settlement.company_id,
                "event": event,
                "user_id": self.env.user.id if self.env.user else None,
                "notes": notes,
                "metadata": metadata or {},
            }
        )

    def _calculate_profile_settlement(
        self,
        period: PayrollPeriod,
        profile: PayrollProfile,
        existing: Optional[PayrollSettlement] = None,
        overrides: Optional[Dict[str, Any]] = None,
        template_id: Optional[int] = None,
    ) -> PayrollSettlement:
        employee = EmployeeProfile.find_by_id(profile.employee_id)
        if not employee:
            raise ValidationError("Employee linked to payroll profile no longer exists")

        contract = self._active_contract_for_period(profile.employee_id, period, preferred_contract_id=profile.contract_id)
        if not contract:
            raise ValidationError(f"No active contract found for {employee.full_name} in selected period")
        if contract.contract_type not in SUPPORTED_CONTRACT_TYPES:
            raise ValidationError(
                f"Contract type {contract.contract_type} is not supported for payroll liquidation"
            )

        params = self._effective_parameters(_parse_date(period.payment_date) or _parse_date(period.end_date))
        brackets = self._effective_tax_brackets(_parse_date(period.payment_date) or _parse_date(period.end_date))
        required_codes = [
            "MINIMUM_WAGE",
            "UTM_VALUE",
            "UF_REFERENCE",
            "PREVISIONAL_CAP_UF",
            "AFC_CAP_UF",
            "PENSION_EMPLOYEE_RATE",
            "HEALTH_RATE",
            "AFC_EMPLOYEE_INDEFINITE_RATE",
            "AFC_EMPLOYER_INDEFINITE_RATE",
            "AFC_EMPLOYER_FIXED_RATE",
            "SIS_EMPLOYER_RATE",
            "PENSION_REFORM_EMPLOYER_RATE",
            "PENSION_REFORM_ACCOUNT_RATE",
            "PENSION_REFORM_SOLIDARITY_RATE",
            "ACCIDENT_BASE_RATE",
            "GRATIFICATION_RATE",
            "GRATIFICATION_CAP_MULTIPLIER",
            "OVERTIME_FACTOR_44H",
            f"AFP_COMMISSION_{(profile.afp_code or '').upper()}",
        ]
        missing = [code for code in required_codes if code not in params]
        if missing:
            raise ValidationError(
                "Missing legal parameters for calculation: " + ", ".join(sorted(set(missing)))
            )

        values = {
            "worked_days": existing.worked_days if existing else self._overlap_days(period, contract),
            "overtime_hours": existing.overtime_hours if existing else 0.0,
            "taxable_bonus": existing.taxable_bonus if existing else 0.0,
            "non_taxable_allowances": existing.non_taxable_allowances if existing else 0.0,
            "other_deductions": existing.other_deductions if existing else profile.recurring_other_deduction or 0.0,
            "loan_deduction": existing.loan_deduction if existing else profile.loan_deduction or 0.0,
            "advance_deduction": existing.advance_deduction if existing else profile.advance_deduction or 0.0,
            "manual_gratification_amount": existing.manual_gratification_amount if existing else profile.manual_gratification_amount or 0.0,
            "notes": existing.notes if existing else "",
        }
        for key, value in (overrides or {}).items():
            if key in values:
                values[key] = value

        worked_days = max(Decimal("0"), min(Decimal("30"), _decimal(values["worked_days"])))
        overtime_hours = max(ZERO, _decimal(values["overtime_hours"]))
        taxable_bonus = max(ZERO, _decimal(values["taxable_bonus"]))
        non_taxable_allowances = max(ZERO, _decimal(values["non_taxable_allowances"]))
        other_deductions = max(ZERO, _decimal(values["other_deductions"]))
        loan_deduction = max(ZERO, _decimal(values["loan_deduction"]))
        advance_deduction = max(ZERO, _decimal(values["advance_deduction"]))
        manual_gratification_amount = max(ZERO, _decimal(values["manual_gratification_amount"]))

        minimum_wage = self._parameter_value(params, "MINIMUM_WAGE")
        utm_value = self._parameter_value(params, "UTM_VALUE")
        uf_reference = self._parameter_value(params, "UF_REFERENCE")
        prevision_cap = self._parameter_value(params, "PREVISIONAL_CAP_UF") * uf_reference
        cesantia_cap = self._parameter_value(params, "AFC_CAP_UF") * uf_reference
        pension_rate = self._parameter_value(params, "PENSION_EMPLOYEE_RATE")
        health_rate = self._parameter_value(params, "HEALTH_RATE")
        employee_afc_indefinite_rate = self._parameter_value(params, "AFC_EMPLOYEE_INDEFINITE_RATE")
        employer_afc_indefinite_rate = self._parameter_value(params, "AFC_EMPLOYER_INDEFINITE_RATE")
        employer_afc_fixed_rate = self._parameter_value(params, "AFC_EMPLOYER_FIXED_RATE")
        sis_rate = self._parameter_value(params, "SIS_EMPLOYER_RATE")
        pension_reform_rate = self._parameter_value(params, "PENSION_REFORM_EMPLOYER_RATE")
        pension_reform_account_rate = self._parameter_value(params, "PENSION_REFORM_ACCOUNT_RATE")
        pension_reform_solidarity_rate = self._parameter_value(params, "PENSION_REFORM_SOLIDARITY_RATE")
        default_accident_rate = self._parameter_value(params, "ACCIDENT_BASE_RATE")
        gratification_rate = self._parameter_value(params, "GRATIFICATION_RATE")
        gratification_cap_multiplier = self._parameter_value(params, "GRATIFICATION_CAP_MULTIPLIER")
        overtime_factor_44h = self._parameter_value(params, "OVERTIME_FACTOR_44H")
        afp_commission_rate = self._parameter_value(params, f"AFP_COMMISSION_{(profile.afp_code or '').upper()}")

        family_allowance_amount = ZERO
        if profile.family_allowance_section in ("A", "B", "C") and _safe_int(profile.family_allowance_charges, 0):
            family_allowance_amount = (
                self._parameter_value(params, f"FAMILY_ALLOWANCE_{profile.family_allowance_section}")
                * Decimal(str(_safe_int(profile.family_allowance_charges, 0)))
            )

        base_salary = _decimal(contract.salary_amount or employee.base_salary or 0)
        prorated_salary = _amount(base_salary * worked_days / Decimal("30"))
        weekly_hours = max(Decimal("1"), _decimal(profile.weekly_hours or 44))
        minimum_reference = minimum_wage if weekly_hours >= Decimal("44") else minimum_wage * weekly_hours / Decimal("44")
        overtime_reference_base = max(base_salary, minimum_reference)
        if weekly_hours == Decimal("44"):
            overtime_amount = _amount(overtime_reference_base * overtime_factor_44h * overtime_hours)
        else:
            ordinary_hour_value = ((overtime_reference_base / Decimal("30")) * Decimal("28")) / (weekly_hours * Decimal("4"))
            overtime_amount = _amount(ordinary_hour_value * Decimal("1.5") * overtime_hours)

        recurring_taxable_bonus = _decimal(profile.recurring_taxable_bonus or 0)
        recurring_non_taxable = _decimal(profile.recurring_non_taxable_allowance or 0)
        gratification_base = prorated_salary + overtime_amount + taxable_bonus + recurring_taxable_bonus
        if profile.legal_gratification_mode == "article_50_monthly":
            monthly_cap = (minimum_wage * gratification_cap_multiplier / Decimal("12")) * (worked_days / Decimal("30"))
            legal_gratification = _amount(min(gratification_base * gratification_rate, monthly_cap))
        elif profile.legal_gratification_mode == "manual":
            legal_gratification = _amount(manual_gratification_amount)
        else:
            legal_gratification = ZERO

        taxable_income = _amount(gratification_base + legal_gratification)
        non_taxable_income = _amount(non_taxable_allowances + recurring_non_taxable + family_allowance_amount)

        pension_base = min(taxable_income, prevision_cap)
        cesantia_base = min(taxable_income, cesantia_cap)
        pension_amount = _amount(pension_base * pension_rate)
        afp_commission_amount = _amount(pension_base * afp_commission_rate)
        legal_health_amount = _amount(pension_base * health_rate)
        if profile.health_system == "isapre":
            health_amount = _amount(max(legal_health_amount, _decimal(profile.health_plan_clp or 0)))
        else:
            health_amount = legal_health_amount

        afc_employee_amount = ZERO
        employer_afc_amount = ZERO
        if contract.contract_type == "indefinite":
            afc_employee_amount = _amount(cesantia_base * employee_afc_indefinite_rate)
            employer_afc_amount = _amount(cesantia_base * employer_afc_indefinite_rate)
        elif contract.contract_type == "fixed_term":
            employer_afc_amount = _amount(cesantia_base * employer_afc_fixed_rate)

        tax_base = _amount(
            max(
                taxable_income - pension_amount - afp_commission_amount - health_amount - afc_employee_amount,
                ZERO,
            )
        )
        tax_amount, selected_bracket = self._compute_tax(tax_base, utm_value, brackets)
        total_deductions = _amount(
            pension_amount
            + afp_commission_amount
            + health_amount
            + afc_employee_amount
            + tax_amount
            + other_deductions
            + loan_deduction
            + advance_deduction
        )
        total_earnings = _amount(taxable_income + non_taxable_income)
        net_pay = _amount(total_earnings - total_deductions)

        accident_rate = _decimal(profile.accident_rate or default_accident_rate)
        employer_sis_amount = _amount(pension_base * sis_rate)
        employer_accident_amount = _amount(pension_base * accident_rate)
        employer_pension_reform_amount = _amount(pension_base * pension_reform_rate)
        employer_total = _amount(
            employer_afc_amount + employer_sis_amount + employer_accident_amount + employer_pension_reform_amount
        )
        employer_cost = _amount(total_earnings + employer_total)

        warnings: List[str] = []
        if worked_days < Decimal("30"):
            warnings.append("Trabajador con mes parcial o contrato con vigencia parcial en el periodo.")
        if base_salary < minimum_wage and weekly_hours >= Decimal("44"):
            warnings.append("La renta base esta por debajo del ingreso minimo mensual vigente.")
        if not (profile.national_id or "").strip():
            warnings.append("Falta registrar el RUT del trabajador en el perfil previsional.")
        if other_deductions > ZERO or loan_deduction > ZERO or advance_deduction > ZERO:
            warnings.append(
                "Revisar respaldo legal/pactado de descuentos adicionales segun articulo 58 del Codigo del Trabajo."
            )
        if net_pay < ZERO:
            warnings.append("El liquido a pagar resulto negativo. Revisar descuentos manuales y anticipos.")
        if profile.family_allowance_section != "none" and not _safe_int(profile.family_allowance_charges, 0):
            warnings.append("El tramo de asignacion familiar esta informado sin cargas registradas.")

        line_items = [
            self._line("earning", "Sueldo base proporcional", prorated_salary, taxable=True),
            self._line("earning", "Horas extraordinarias", overtime_amount, taxable=True),
            self._line("earning", "Bonos imponibles", taxable_bonus + recurring_taxable_bonus, taxable=True),
            self._line("earning", "Gratificacion legal", legal_gratification, taxable=True),
            self._line("non_taxable", "Haberes no imponibles", non_taxable_allowances + recurring_non_taxable),
            self._line("non_taxable", "Asignacion familiar", family_allowance_amount),
            self._line("deduction", "AFP 10%", pension_amount),
            self._line("deduction", f"Comision AFP {(profile.afp_code or '').upper()}", afp_commission_amount),
            self._line("deduction", "Salud", health_amount),
            self._line("deduction", "Seguro cesantia trabajador", afc_employee_amount),
            self._line("deduction", "Impuesto unico segunda categoria", tax_amount),
            self._line("deduction", "Otros descuentos", other_deductions),
            self._line("deduction", "Prestamos", loan_deduction),
            self._line("deduction", "Anticipos", advance_deduction),
            self._line("employer", "Seguro cesantia empleador", employer_afc_amount),
            self._line("employer", "SIS", employer_sis_amount),
            self._line("employer", "Ley 16.744 + SANNA", employer_accident_amount),
            self._line("employer", "Cotizacion reforma previsional", employer_pension_reform_amount),
        ]

        reform_account_amount = _amount(pension_base * pension_reform_account_rate)
        reform_solidarity_amount = _amount(pension_base * pension_reform_solidarity_rate)
        accounting_lines = [
            self._account_line("510100", "Gasto remuneraciones", total_earnings, ZERO),
            self._account_line("510200", "Gasto cargas patronales", employer_total, ZERO),
            self._account_line("210100", "Por pagar liquidos trabajadores", ZERO, net_pay),
            self._account_line("210110", "Por pagar AFP y comisiones", ZERO, pension_amount + afp_commission_amount),
            self._account_line("210120", "Por pagar salud", ZERO, health_amount),
            self._account_line("210130", "Por pagar AFC", ZERO, afc_employee_amount + employer_afc_amount),
            self._account_line("210140", "Por pagar impuesto unico", ZERO, tax_amount),
            self._account_line("210150", "Por pagar descuentos y prestamos", ZERO, other_deductions + loan_deduction + advance_deduction),
            self._account_line("210160", "Por pagar SIS", ZERO, employer_sis_amount),
            self._account_line("210170", "Por pagar ley 16.744", ZERO, employer_accident_amount),
            self._account_line("210180", "Por pagar reforma previsional cuenta individual", ZERO, reform_account_amount),
            self._account_line("210181", "Por pagar reforma previsional seguro social", ZERO, reform_solidarity_amount),
        ]

        snapshot = {
            "utm_value": float(utm_value),
            "uf_reference": float(uf_reference),
            "minimum_wage": float(minimum_wage),
            "previsional_cap_clp": float(prevision_cap),
            "cesantia_cap_clp": float(cesantia_cap),
            "rates": {
                "pension": float(pension_rate),
                "afp_commission": float(afp_commission_rate),
                "health": float(health_rate),
                "afc_employee_indefinite": float(employee_afc_indefinite_rate),
                "afc_employer_indefinite": float(employer_afc_indefinite_rate),
                "afc_employer_fixed": float(employer_afc_fixed_rate),
                "sis": float(sis_rate),
                "pension_reform": float(pension_reform_rate),
                "accident": float(accident_rate),
            },
            "tax_bracket": selected_bracket.to_dict() if selected_bracket else None,
            "legal_sources": {
                code: {
                    "source_label": params[code].source_label,
                    "source_url": params[code].source_url,
                    "effective_from": params[code].effective_from,
                }
                for code in required_codes
                if code in params
            },
        }

        settlement = existing or PayrollSettlement.create(
            {
                "company_id": self._company_id(),
                "period_id": period.id,
                "employee_id": employee.id,
                "contract_id": contract.id,
                "payroll_profile_id": profile.id,
                "template_id": template_id or period.template_id,
                "requires_signature": _normalize_bool(profile.require_signature, True),
            }
        )
        settlement.template_id = template_id or period.template_id
        settlement.contract_id = contract.id
        settlement.worked_days = float(worked_days)
        settlement.overtime_hours = float(overtime_hours)
        settlement.taxable_bonus = _amount_int(taxable_bonus)
        settlement.non_taxable_allowances = _amount_int(non_taxable_allowances)
        settlement.other_deductions = _amount_int(other_deductions)
        settlement.loan_deduction = _amount_int(loan_deduction)
        settlement.advance_deduction = _amount_int(advance_deduction)
        settlement.manual_gratification_amount = _amount_int(manual_gratification_amount)
        settlement.base_salary = _amount_int(base_salary)
        settlement.taxable_income = _amount_int(taxable_income)
        settlement.non_taxable_income = _amount_int(non_taxable_income)
        settlement.total_earnings = _amount_int(total_earnings)
        settlement.total_deductions = _amount_int(total_deductions)
        settlement.net_pay = _amount_int(net_pay)
        settlement.tax_base = _amount_int(tax_base)
        settlement.tax_amount = _amount_int(tax_amount)
        settlement.legal_gratification_amount = _amount_int(legal_gratification)
        settlement.family_allowance_amount = _amount_int(family_allowance_amount)
        settlement.pension_amount = _amount_int(pension_amount)
        settlement.afp_commission_amount = _amount_int(afp_commission_amount)
        settlement.health_amount = _amount_int(health_amount)
        settlement.afc_employee_amount = _amount_int(afc_employee_amount)
        settlement.employer_afc_amount = _amount_int(employer_afc_amount)
        settlement.employer_sis_amount = _amount_int(employer_sis_amount)
        settlement.employer_accident_amount = _amount_int(employer_accident_amount)
        settlement.employer_pension_reform_amount = _amount_int(employer_pension_reform_amount)
        settlement.employer_total = _amount_int(employer_total)
        settlement.employer_cost = _amount_int(employer_cost)
        settlement.line_items = [item for item in line_items if item["amount"] != 0]
        settlement.accounting_lines = [item for item in accounting_lines if item["debit"] or item["credit"]]
        settlement.warnings = warnings
        settlement.calculation_snapshot = snapshot
        settlement.requires_signature = _normalize_bool(profile.require_signature, True)
        settlement.notes = values.get("notes", "") or settlement.notes or ""

        title, docx_data, pdf_data = self._generate_documents(period, employee, contract, profile, settlement)
        settlement.document_name = f"{_slug_token(title)}.pdf"
        settlement.docx_data = docx_data
        settlement.pdf_data = pdf_data
        if settlement.status not in ("signed", "closed"):
            settlement.status = "calculated"
            settlement.approved_by = None
            settlement.approved_at = ""
            settlement.signed_at = settlement.signed_at or ""
        settlement.save()
        return settlement

    async def get_stats(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seeded()

        profiles = PayrollProfile.search(self._tenant_filter())
        periods = PayrollPeriod.search(self._tenant_filter())
        settlements = PayrollSettlement.search(self._tenant_filter())
        for item in settlements:
            self._refresh_signature_state(item)

        today = utc_today()
        current_periods = [
            item for item in periods if _safe_int(item.year) == today.year and _safe_int(item.month) == today.month
        ]
        current_period_id = current_periods[0].id if current_periods else None
        current_settlements = [
            item for item in settlements if current_period_id and item.period_id == current_period_id
        ]
        return Response.ok(
            {
                "profiles_total": len(profiles),
                "profiles_enabled": len([item for item in profiles if item.payroll_enabled]),
                "periods_total": len(periods),
                "periods_open": len([item for item in periods if item.status != "closed"]),
                "settlements_total": len(settlements),
                "pending_signature": len(
                    [item for item in settlements if item.status == "signature_pending"]
                ),
                "signed_settlements": len([item for item in settlements if item.status == "signed"]),
                "closed_settlements": len([item for item in settlements if item.status == "closed"]),
                "current_period_id": current_period_id,
                "current_period_net_total": sum(_safe_float(item.net_pay) for item in current_settlements),
                "current_period_cost_total": sum(_safe_float(item.employer_cost) for item in current_settlements),
            }
        )

    async def get_lookups(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seeded()

        employees = EmployeeProfile.search([("company_id", "=", self._company_id())])
        contracts = EmployeeContract.search([("company_id", "=", self._company_id())])
        templates = DocumentTemplate.search(
            [
                ("company_id", "=", self._company_id()),
                ("target_module", "=", "payroll"),
            ]
        )
        current_params = self._effective_parameters()
        current_brackets = self._effective_tax_brackets()
        return Response.ok(
            {
                "employees": [item.to_dict() for item in employees if item.status != "inactive"],
                "contracts": [item.to_dict() for item in contracts if item.contract_type in SUPPORTED_CONTRACT_TYPES],
                "templates": [item.to_dict() for item in templates if (item.status or "") != "archived"],
                "afp_options": [{"value": code, "label": code.upper()} for code in AFP_CODES],
                "health_options": [
                    {"value": "fonasa", "label": "Fonasa"},
                    {"value": "isapre", "label": "Isapre"},
                ],
                "gratification_modes": [
                    {"value": "article_50_monthly", "label": "Articulo 50 mensual"},
                    {"value": "manual", "label": "Manual"},
                    {"value": "none", "label": "Sin gratificacion"},
                ],
                "family_allowance_sections": [
                    {"value": "none", "label": "Sin asignacion"},
                    {"value": "A", "label": "Tramo A"},
                    {"value": "B", "label": "Tramo B"},
                    {"value": "C", "label": "Tramo C"},
                ],
                "current_legal_reference": {
                    "minimum_wage": _safe_float(current_params.get("MINIMUM_WAGE").value_numeric if current_params.get("MINIMUM_WAGE") else 0),
                    "utm_value": _safe_float(current_params.get("UTM_VALUE").value_numeric if current_params.get("UTM_VALUE") else 0),
                    "uf_reference": _safe_float(current_params.get("UF_REFERENCE").value_numeric if current_params.get("UF_REFERENCE") else 0),
                    "previsional_cap_uf": _safe_float(current_params.get("PREVISIONAL_CAP_UF").value_numeric if current_params.get("PREVISIONAL_CAP_UF") else 0),
                    "afc_cap_uf": _safe_float(current_params.get("AFC_CAP_UF").value_numeric if current_params.get("AFC_CAP_UF") else 0),
                    "family_allowance_a": _safe_float(current_params.get("FAMILY_ALLOWANCE_A").value_numeric if current_params.get("FAMILY_ALLOWANCE_A") else 0),
                    "family_allowance_b": _safe_float(current_params.get("FAMILY_ALLOWANCE_B").value_numeric if current_params.get("FAMILY_ALLOWANCE_B") else 0),
                    "family_allowance_c": _safe_float(current_params.get("FAMILY_ALLOWANCE_C").value_numeric if current_params.get("FAMILY_ALLOWANCE_C") else 0),
                    "pension_reform_rate": _safe_float(current_params.get("PENSION_REFORM_EMPLOYER_RATE").value_numeric if current_params.get("PENSION_REFORM_EMPLOYER_RATE") else 0),
                },
                "tax_brackets": [item.to_dict() for item in current_brackets],
            }
        )

    async def list_legal_parameters(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seeded()
        current_only = _normalize_bool(request.get_param("current_only"), True)
        params = PayrollLegalParameter.search(self._tenant_filter())
        if current_only:
            param_map = self._effective_parameters(_parse_date(request.get_param("as_of")) or utc_today())
            params = list(param_map.values())
        params.sort(key=lambda item: ((item.category or "").lower(), (item.name or "").lower()))
        return Response.ok({"count": len(params), "results": [item.to_dict() for item in params]})

    async def create_legal_parameter(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        data = request.data or {}
        try:
            parameter = PayrollLegalParameter.create(
                {
                    "company_id": self._company_id(),
                    "code": (data.get("code") or "").strip().upper(),
                    "name": data.get("name") or data.get("code"),
                    "category": data.get("category") or "general",
                    "value_numeric": _safe_float(data.get("value_numeric"), 0.0),
                    "value_text": data.get("value_text"),
                    "effective_from": data.get("effective_from") or utc_today().isoformat(),
                    "effective_to": data.get("effective_to"),
                    "source_label": data.get("source_label"),
                    "source_url": data.get("source_url"),
                    "notes": data.get("notes"),
                }
            )
            return Response.created(parameter.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_legal_parameter(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        parameter, error = self._legal_parameter_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field_name in ("code", "name", "category", "value_text", "effective_from", "effective_to", "source_label", "source_url", "notes"):
            if field_name in data:
                setattr(parameter, field_name, data.get(field_name))
        if "value_numeric" in data:
            parameter.value_numeric = _safe_float(data.get("value_numeric"), 0.0)
        try:
            parameter.save()
            return Response.ok(parameter.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_legal_parameter(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        parameter, error = self._legal_parameter_or_404(request.params.get("id"))
        if error:
            return error
        parameter.delete()
        return Response.ok({"message": "Legal parameter deleted"})

    async def list_tax_brackets(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seeded()
        current_only = _normalize_bool(request.get_param("current_only"), True)
        brackets = PayrollTaxBracket.search(self._tenant_filter())
        if current_only:
            brackets = self._effective_tax_brackets(_parse_date(request.get_param("as_of")) or utc_today())
        brackets.sort(key=lambda item: (item.order_index or 0, item.id or 0))
        return Response.ok({"count": len(brackets), "results": [item.to_dict() for item in brackets]})

    async def create_tax_bracket(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        data = request.data or {}
        try:
            bracket = PayrollTaxBracket.create(
                {
                    "company_id": self._company_id(),
                    "effective_from": data.get("effective_from") or utc_today().isoformat(),
                    "effective_to": data.get("effective_to"),
                    "order_index": _safe_int(data.get("order_index"), 1),
                    "lower_utm": _safe_float(data.get("lower_utm"), 0.0),
                    "upper_utm": _safe_float(data.get("upper_utm"), None),
                    "factor": _safe_float(data.get("factor"), 0.0),
                    "rebate_utm": _safe_float(data.get("rebate_utm"), 0.0),
                    "source_label": data.get("source_label"),
                    "source_url": data.get("source_url"),
                }
            )
            return Response.created(bracket.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_tax_bracket(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        bracket, error = self._tax_bracket_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field_name in ("effective_from", "effective_to", "source_label", "source_url"):
            if field_name in data:
                setattr(bracket, field_name, data.get(field_name))
        for field_name in ("order_index", "lower_utm", "upper_utm", "factor", "rebate_utm"):
            if field_name in data:
                setattr(bracket, field_name, data.get(field_name))
        try:
            bracket.save()
            return Response.ok(bracket.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_tax_bracket(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        bracket, error = self._tax_bracket_or_404(request.params.get("id"))
        if error:
            return error
        bracket.delete()
        return Response.ok({"message": "Tax bracket deleted"})

    async def list_profiles(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seeded()
        profiles = PayrollProfile.search(self._tenant_filter())
        employee_id = _safe_int(request.get_param("employee_id"), None)
        if employee_id:
            profiles = [item for item in profiles if item.employee_id == employee_id]
        profiles.sort(
            key=lambda item: (
                (EmployeeProfile.find_by_id(item.employee_id).full_name.lower() if EmployeeProfile.find_by_id(item.employee_id) else ""),
                item.id or 0,
            )
        )
        return Response.ok({"count": len(profiles), "results": [item.to_dict() for item in profiles]})

    async def create_profile(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        data = request.data or {}
        employee_id = _safe_int(data.get("employee_id"), None)
        employee = EmployeeProfile.find_by_id(employee_id)
        if not employee or (
            self.env.user.role != "superadmin" and employee.company_id != self._company_id()
        ):
            return Response.bad_request("Employee is not available for payroll profile")
        try:
            profile = PayrollProfile.create(
                {
                    "company_id": self._company_id(),
                    "employee_id": employee_id,
                    "contract_id": _safe_int(data.get("contract_id"), None),
                    "national_id": data.get("national_id") or getattr(employee, "national_id", None),
                    "afp_code": (
                        data.get("afp_code")
                        or getattr(employee, "afp_code", None)
                        or "uno"
                    ).strip().lower(),
                    "health_system": (
                        data.get("health_system")
                        or getattr(employee, "health_system", None)
                        or "fonasa"
                    ).strip().lower(),
                    "health_plan_clp": _safe_float(data.get("health_plan_clp"), 0.0),
                    "legal_gratification_mode": data.get("legal_gratification_mode") or "article_50_monthly",
                    "manual_gratification_amount": _safe_float(data.get("manual_gratification_amount"), 0.0),
                    "family_allowance_section": data.get("family_allowance_section") or "none",
                    "family_allowance_charges": _safe_int(data.get("family_allowance_charges"), 0),
                    "recurring_taxable_bonus": _safe_float(data.get("recurring_taxable_bonus"), 0.0),
                    "recurring_non_taxable_allowance": _safe_float(data.get("recurring_non_taxable_allowance"), 0.0),
                    "recurring_other_deduction": _safe_float(data.get("recurring_other_deduction"), 0.0),
                    "loan_deduction": _safe_float(data.get("loan_deduction"), 0.0),
                    "advance_deduction": _safe_float(data.get("advance_deduction"), 0.0),
                    "weekly_hours": _safe_float(data.get("weekly_hours"), 44.0),
                    "accident_rate": _safe_float(data.get("accident_rate"), 0.0093),
                    "cost_center": data.get("cost_center"),
                    "payroll_enabled": _normalize_bool(data.get("payroll_enabled"), True),
                    "require_signature": _normalize_bool(data.get("require_signature"), True),
                    "notes": data.get("notes"),
                }
            )
            return Response.created(profile.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_profile(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field_name in (
            "contract_id",
            "national_id",
            "afp_code",
            "health_system",
            "legal_gratification_mode",
            "family_allowance_section",
            "cost_center",
            "notes",
        ):
            if field_name in data:
                setattr(profile, field_name, data.get(field_name))
        for field_name in (
            "health_plan_clp",
            "manual_gratification_amount",
            "family_allowance_charges",
            "recurring_taxable_bonus",
            "recurring_non_taxable_allowance",
            "recurring_other_deduction",
            "loan_deduction",
            "advance_deduction",
            "weekly_hours",
            "accident_rate",
        ):
            if field_name in data:
                setattr(profile, field_name, data.get(field_name))
        if "payroll_enabled" in data:
            profile.payroll_enabled = _normalize_bool(data.get("payroll_enabled"), True)
        if "require_signature" in data:
            profile.require_signature = _normalize_bool(data.get("require_signature"), True)
        try:
            profile.save()
            return Response.ok(profile.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_profile(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        settlements = PayrollSettlement.search([("payroll_profile_id", "=", profile.id)])
        if settlements:
            return Response.bad_request("Cannot delete a payroll profile with generated settlements")
        profile.delete()
        return Response.ok({"message": "Payroll profile deleted"})

    async def list_periods(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seeded()
        periods = PayrollPeriod.search(self._tenant_filter())
        periods.sort(key=lambda item: (_safe_int(item.year), _safe_int(item.month), item.id or 0), reverse=True)
        return Response.ok({"count": len(periods), "results": [item.to_dict() for item in periods]})

    async def create_period(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        self._ensure_seeded()
        data = request.data or {}
        year = _safe_int(data.get("year"), utc_today().year)
        month = _safe_int(data.get("month"), utc_today().month)
        if PayrollPeriod.search([("company_id", "=", self._company_id()), ("year", "=", year), ("month", "=", month)]):
            return Response.bad_request("A payroll period already exists for that month")
        start, end = _month_range(year, month)
        try:
            period = PayrollPeriod.create(
                {
                    "company_id": self._company_id(),
                    "name": data.get("name") or f"Nomina {year}-{month:02d}",
                    "year": year,
                    "month": month,
                    "start_date": data.get("start_date") or start.isoformat(),
                    "end_date": data.get("end_date") or end.isoformat(),
                    "payment_date": data.get("payment_date") or end.isoformat(),
                    "status": data.get("status") or "draft",
                    "template_id": _safe_int(data.get("template_id"), None),
                    "notes": data.get("notes"),
                }
            )
            return Response.created(period.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_period(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        period, error = self._period_or_404(request.params.get("id"))
        if error:
            return error
        settlements = PayrollSettlement.search([("period_id", "=", period.id)])
        for settlement in settlements:
            self._refresh_signature_state(settlement)
        accounting_summary = {
            "net_total": sum(_safe_float(item.net_pay) for item in settlements),
            "earnings_total": sum(_safe_float(item.total_earnings) for item in settlements),
            "deductions_total": sum(_safe_float(item.total_deductions) for item in settlements),
            "employer_total": sum(_safe_float(item.employer_total) for item in settlements),
            "employer_cost_total": sum(_safe_float(item.employer_cost) for item in settlements),
        }
        return Response.ok(
            {
                **period.to_dict(),
                "settlements": [item.to_dict() for item in settlements],
                "accounting_summary": accounting_summary,
            }
        )

    async def update_period(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        period, error = self._period_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field_name in ("name", "start_date", "end_date", "payment_date", "notes"):
            if field_name in data:
                setattr(period, field_name, data.get(field_name))
        if "template_id" in data:
            period.template_id = _safe_int(data.get("template_id"), None)
        try:
            period.save()
            return Response.ok(period.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_period(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        period, error = self._period_or_404(request.params.get("id"))
        if error:
            return error
        settlements = PayrollSettlement.search([("period_id", "=", period.id)])
        if settlements:
            return Response.bad_request("Cannot delete a period with settlements")
        period.delete()
        return Response.ok({"message": "Payroll period deleted"})

    async def calculate_period(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        period, error = self._period_or_404(request.params.get("id"))
        if error:
            return error

        template_id = _safe_int((request.data or {}).get("template_id"), period.template_id)
        employee_ids = request.get_data("employee_ids", []) or []
        employee_ids = {_safe_int(item, None) for item in employee_ids if _safe_int(item, None)}
        profiles = [item for item in PayrollProfile.search(self._tenant_filter()) if item.payroll_enabled]
        if employee_ids:
            profiles = [item for item in profiles if item.employee_id in employee_ids]
        if not profiles:
            return Response.bad_request("No payroll-enabled profiles found for the selected period")

        created = 0
        updated = 0
        skipped: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []
        settlements: List[PayrollSettlement] = []
        for profile in profiles:
            existing_items = PayrollSettlement.search(
                [("period_id", "=", period.id), ("employee_id", "=", profile.employee_id)]
            )
            existing = existing_items[0] if existing_items else None
            if existing and existing.status in ("signature_pending", "signed", "closed"):
                employee = EmployeeProfile.find_by_id(profile.employee_id)
                skipped.append(
                    {
                        "employee_id": profile.employee_id,
                        "employee_name": employee.full_name if employee else None,
                        "reason": f"Settlement is already in status {existing.status}",
                    }
                )
                continue
            try:
                settlement = self._calculate_profile_settlement(
                    period,
                    profile,
                    existing=existing,
                    template_id=template_id,
                )
                settlements.append(settlement)
                if existing:
                    updated += 1
                    self._log_event(settlement, "recalculated", notes="Settlement recalculated")
                else:
                    created += 1
                    self._log_event(settlement, "generated", notes="Settlement generated from payroll period")
            except ValidationError as exc:
                employee = EmployeeProfile.find_by_id(profile.employee_id)
                errors.append(
                    {
                        "employee_id": profile.employee_id,
                        "employee_name": employee.full_name if employee else None,
                        "error": str(exc),
                    }
                )

        self._update_period_status(period)
        return Response.ok(
            {
                "period": period.to_dict(),
                "summary": {
                    "profiles_processed": len(profiles),
                    "created": created,
                    "updated": updated,
                    "skipped": len(skipped),
                    "errors": len(errors),
                },
                "settlements": [item.to_dict() for item in settlements],
                "skipped": skipped,
                "errors": errors,
            }
        )

    async def approve_period(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        period, error = self._period_or_404(request.params.get("id"))
        if error:
            return error
        settlements = PayrollSettlement.search([("period_id", "=", period.id)])
        if not settlements:
            return Response.bad_request("This period does not contain settlements")
        for settlement in settlements:
            self._refresh_signature_state(settlement)
            if settlement.status == "calculated":
                settlement.status = "approved"
                settlement.approved_by = self.env.user.id if self.env.user else None
                settlement.approved_at = utc_now_iso()
                settlement.save()
                self._log_event(settlement, "approved", notes="Settlement approved from period action")
        self._update_period_status(period)
        return Response.ok(period.to_dict())

    async def close_period(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        period, error = self._period_or_404(request.params.get("id"))
        if error:
            return error
        settlements = PayrollSettlement.search([("period_id", "=", period.id)])
        if not settlements:
            return Response.bad_request("This period does not contain settlements")
        open_items = [item for item in settlements if item.status != "closed"]
        if open_items:
            return Response.bad_request("All settlements must be closed before closing the period")
        period.status = "closed"
        period.save()
        return Response.ok(period.to_dict())

    async def list_settlements(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        settlements = PayrollSettlement.search(self._tenant_filter())
        period_id = _safe_int(request.get_param("period_id"), None)
        status = request.get_param("status")
        search = (request.get_param("search") or "").strip().lower()
        if period_id:
            settlements = [item for item in settlements if item.period_id == period_id]
        for item in settlements:
            self._refresh_signature_state(item)
        if status:
            settlements = [item for item in settlements if (item.status or "") == status]
        if search:
            settlements = [
                item
                for item in settlements
                if search in ((item.to_dict().get("employee_name") or "").lower())
                or search in ((item.to_dict().get("employee_code") or "").lower())
                or search in ((item.document_name or "").lower())
            ]
        settlements.sort(key=lambda item: (item.period_id or 0, item.employee_id or 0), reverse=True)
        return Response.ok({"count": len(settlements), "results": [item.to_dict() for item in settlements]})

    async def get_settlement(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        settlement, error = self._settlement_or_404(request.params.get("id"))
        if error:
            return error
        self._refresh_signature_state(settlement)
        self._log_event(settlement, "viewed", notes="Viewed settlement detail")
        history = PayrollEventLog.search([("settlement_id", "=", settlement.id)])
        history.sort(key=lambda item: (item.id or 0))
        return Response.ok({**settlement.to_dict(), "history": [item.to_dict() for item in history]})

    async def update_settlement(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        settlement, error = self._settlement_or_404(request.params.get("id"))
        if error:
            return error
        if settlement.status in ("signature_pending", "signed", "closed"):
            return Response.bad_request("Settlement can no longer be recalculated in its current status")
        period = PayrollPeriod.find_by_id(settlement.period_id)
        profile = PayrollProfile.find_by_id(settlement.payroll_profile_id)
        if not period or not profile:
            return Response.bad_request("Settlement is missing period or payroll profile context")
        try:
            updated = self._calculate_profile_settlement(
                period,
                profile,
                existing=settlement,
                overrides=request.data or {},
                template_id=_safe_int((request.data or {}).get("template_id"), settlement.template_id or period.template_id),
            )
            self._log_event(updated, "recalculated", notes="Settlement inputs updated and recalculated")
            self._update_period_status(period)
            return Response.ok(updated.to_dict())
        except ValidationError as exc:
            settlement.status = "error"
            settlement.save()
            return Response.bad_request(str(exc))

    async def approve_settlement(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        settlement, error = self._settlement_or_404(request.params.get("id"))
        if error:
            return error
        self._refresh_signature_state(settlement)
        if settlement.status not in ("calculated", "approved"):
            return Response.bad_request("Settlement must be calculated before approval")
        settlement.status = "approved"
        settlement.approved_by = self.env.user.id if self.env.user else None
        settlement.approved_at = utc_now_iso()
        settlement.save()
        self._log_event(settlement, "approved", notes="Settlement approved for release")
        period = PayrollPeriod.find_by_id(settlement.period_id)
        if period:
            self._update_period_status(period)
        return Response.ok(settlement.to_dict())

    async def get_settlement_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        settlement, error = self._settlement_or_404(request.params.get("id"))
        if error:
            return error
        self._refresh_signature_state(settlement)
        fmt = (request.get_param("format") or "pdf").strip().lower()
        if fmt not in ("pdf", "docx"):
            return Response.bad_request("format must be pdf or docx")
        data_value = settlement.pdf_data if fmt == "pdf" else settlement.docx_data
        if not data_value:
            return Response.not_found("Document content is not available")
        self._log_event(settlement, f"download_{fmt}", notes=f"Downloaded {fmt.upper()} version")
        return Response.ok(
            {
                "id": settlement.id,
                "format": fmt,
                "mime_type": PDF_MIME if fmt == "pdf" else DOCX_MIME,
                "file_name": settlement.document_name if fmt == "pdf" else settlement.document_name.replace(".pdf", ".docx"),
                "data": data_value,
            }
        )

    async def send_settlement_signature(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        settlement, error = self._settlement_or_404(request.params.get("id"))
        if error:
            return error
        self._refresh_signature_state(settlement)
        if not settlement.requires_signature:
            return Response.bad_request("This settlement is configured without signature requirement")
        if settlement.status not in ("approved", "calculated"):
            return Response.bad_request("Settlement must be approved or calculated before sending to signature")
        if settlement.signature_request_id and settlement.status in ("signature_pending", "signed", "closed"):
            return Response.bad_request("A signature workflow already exists for this settlement")
        employee = EmployeeProfile.find_by_id(settlement.employee_id)
        recipient_email = (employee.work_email or employee.personal_email) if employee else None
        if not recipient_email:
            return Response.bad_request("Employee must have a work or personal email to request signature")

        if settlement.status == "calculated":
            settlement.status = "approved"
            settlement.approved_by = self.env.user.id if self.env.user else None
            settlement.approved_at = utc_now_iso()

        sig_request = SignatureRequest.create(
            {
                "name": f"Liquidacion {employee.full_name if employee else settlement.employee_id} {settlement.period_id}",
                "description": "Liquidacion de remuneraciones emitida desde RRHH / Remuneraciones.",
                "request_from": self.env.user.id if self.env.user else None,
                "request_to_email": recipient_email,
                "document_name": settlement.document_name or f"liquidacion_{settlement.id}.pdf",
                "document_data": settlement.pdf_data,
                "signature_positions": [],
                "company_id": settlement.company_id,
                "source_module": "payroll",
                "source_model": "payroll.settlement",
                "source_record_id": settlement.id,
            }
        )
        sig_request.send_request()
        SignatureLog.create(
            {
                "signature_request_id": sig_request.id,
                "event": "created",
                "ip_address": request.remote_addr,
                "notes": "Created from payroll settlement",
            }
        )
        SignatureLog.create(
            {
                "signature_request_id": sig_request.id,
                "event": "sent",
                "ip_address": request.remote_addr,
                "notes": "Sent from payroll settlement",
            }
        )
        settlement.signature_request_id = sig_request.id
        settlement.status = "signature_pending"
        settlement.save()
        self._log_event(settlement, "signature_requested", notes="Signature request sent to employee")
        period = PayrollPeriod.find_by_id(settlement.period_id)
        if period:
            self._update_period_status(period)
        return Response.ok(
            {
                **settlement.to_dict(),
                "signature_request": sig_request.to_dict(include_sensitive=True),
            }
        )

    async def close_settlement(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        settlement, error = self._settlement_or_404(request.params.get("id"))
        if error:
            return error
        self._refresh_signature_state(settlement)
        if settlement.requires_signature and settlement.status not in ("signed", "closed"):
            return Response.bad_request("Signed settlements can only be closed after signature is completed")
        if not settlement.requires_signature and settlement.status not in ("approved", "closed", "signed"):
            return Response.bad_request("Settlement must be approved before closure")
        settlement.status = "closed"
        settlement.closed_at = utc_now_iso()
        settlement.save()
        self._log_event(settlement, "closed", notes="Settlement closed in payroll")
        period = PayrollPeriod.find_by_id(settlement.period_id)
        if period:
            self._update_period_status(period)
        return Response.ok(settlement.to_dict())

    async def get_settlement_history(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        settlement, error = self._settlement_or_404(request.params.get("id"))
        if error:
            return error
        history = PayrollEventLog.search([("settlement_id", "=", settlement.id)])
        history.sort(key=lambda item: (item.id or 0))
        return Response.ok({"count": len(history), "results": [item.to_dict() for item in history]})
