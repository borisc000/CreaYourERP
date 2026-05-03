"""
Modulo de facturacion simulada.

Permite modelar el flujo de facturacion previo a una integracion real con SII:
- Emision de documentos ficticios
- Simulacion de envio y respuesta SII
- Envio al cliente
- Seguimiento de cobranza y pagos
- Timeline operativo para mejorar la gestion
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now


DOCUMENT_TYPES: Dict[str, Dict[str, Any]] = {
    "33": {
        "label": "Factura afecta",
        "prefix": "FEL",
        "default_tax_rate": 19.0,
        "supports_payment": True,
        "sign": 1,
    },
    "34": {
        "label": "Factura exenta",
        "prefix": "FEX",
        "default_tax_rate": 0.0,
        "supports_payment": True,
        "sign": 1,
    },
    "61": {
        "label": "Nota de credito",
        "prefix": "NC",
        "default_tax_rate": 19.0,
        "supports_payment": False,
        "sign": -1,
    },
    "56": {
        "label": "Nota de debito",
        "prefix": "ND",
        "default_tax_rate": 19.0,
        "supports_payment": True,
        "sign": 1,
    },
}

REFERENCE_REQUIRED_TYPES = {"61", "56"}

DEFAULT_CORRECTION_MODE = {
    "61": "amount_decrease",
    "56": "amount_increase",
}

CORRECTION_MODES: Dict[str, Dict[str, Any]] = {
    "annulment": {
        "label": "Anulacion total",
        "document_types": ["61"],
    },
    "amount_decrease": {
        "label": "Disminucion de monto",
        "document_types": ["61"],
    },
    "amount_increase": {
        "label": "Aumento de monto",
        "document_types": ["56"],
    },
    "text_adjustment": {
        "label": "Correccion de texto o glosa",
        "document_types": ["61", "56"],
    },
    "reference_fix": {
        "label": "Correccion de referencia",
        "document_types": ["61", "56"],
    },
    "service_extension": {
        "label": "Recargo o servicio adicional",
        "document_types": ["56"],
    },
}

DOCUMENT_STATUS_LABELS = {
    "draft": "Borrador",
    "simulated_queued": "En cola SII",
    "issued": "Emitida",
    "collecting": "En cobranza",
    "observed": "Observada",
    "rejected": "Rechazada",
    "partially_paid": "Pago parcial",
    "paid": "Pagada",
    "overdue": "Vencida",
    "cancelled": "Anulada",
}

SII_STATUS_LABELS = {
    "not_sent": "Sin enviar",
    "queued": "En cola",
    "accepted": "Aceptada",
    "observed": "Observada",
    "rejected": "Rechazada",
}

PAYMENT_STATUS_LABELS = {
    "pending": "Pendiente",
    "partial": "Pago parcial",
    "paid": "Pagada",
    "overdue": "Vencida",
    "not_applicable": "No aplica",
}

DELIVERY_STATUS_LABELS = {
    "pending": "Pendiente",
    "sent": "Enviada",
    "opened": "Abierta",
}

SIMULATION_PROFILES: Dict[str, Dict[str, str]] = {
    "auto_accept": {
        "label": "Aceptacion directa",
        "description": "Simula una validacion limpia y aprobacion inmediata en SII.",
    },
    "observed_then_accept": {
        "label": "Observada y luego aceptada",
        "description": "Primero genera observacion y luego acepta el documento al reenviar.",
    },
    "reject_invalid_tax_id": {
        "label": "Rechazo por RUT",
        "description": "Rechaza si el RUT luce invalido; sirve para entrenar correcciones previas.",
    },
    "delayed_acceptance": {
        "label": "Aceptacion con demora",
        "description": "Aprobacion simulada con mensaje de recepcion diferida.",
    },
}

PAYMENT_METHODS = ["Transferencia", "Deposito", "Cheque", "Webpay", "Efectivo"]


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _pick_str(*values: Any, default: str = "") -> str:
    for value in values:
        text = _clean_str(value)
        if text:
            return text
    return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _round_money(value: Any) -> float:
    return round(_safe_float(value), 0)


def _parse_date(value: Any, fallback: Optional[date] = None) -> Optional[date]:
    if value in (None, ""):
        return fallback
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return fallback
    try:
        return datetime.fromisoformat(text.replace("Z", "")).date()
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return fallback


def _iso_date(value: Any, fallback: Optional[date] = None) -> str:
    parsed = _parse_date(value, fallback=fallback or date.today())
    return (parsed or date.today()).isoformat()


def _sort_date_key(value: Any) -> str:
    parsed = _parse_date(value)
    if parsed:
        return parsed.isoformat()
    return _clean_str(value)


def _sort_dt_key(value: Any) -> str:
    if value is None:
        return ""
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time()).isoformat()
    return str(value)


def _looks_like_chilean_rut(value: Any) -> bool:
    text = _clean_str(value).upper().replace(".", "").replace(" ", "")
    if "-" not in text:
        return False
    body, verifier = text.split("-", 1)
    if not body.isdigit():
        return False
    if len(body) < 7 or len(body) > 8:
        return False
    return len(verifier) == 1 and verifier.isalnum()


def _user_display_name(user: Any) -> str:
    if not user:
        return "Sistema"
    return _clean_str(getattr(user, "name", None), _clean_str(getattr(user, "email", None), "Sistema"))


class BillingDocument(BaseModel, AuditMixin):
    __tablename__ = "billing_documents"
    __displayname__ = "document_number"

    document_number = Column(ColumnType.STRING, required=True, label="Numero interno")
    sii_folio = Column(ColumnType.STRING, required=True, label="Folio simulado")
    document_type = Column(ColumnType.STRING, required=True, label="Tipo DTE")
    company_id = Column(ColumnType.INTEGER, required=True, label="Empresa")

    customer_id = Column(ColumnType.INTEGER, label="Cliente")
    customer_name = Column(ColumnType.STRING, required=True, label="Cliente")
    customer_tax_id = Column(ColumnType.STRING, label="RUT")
    customer_email = Column(ColumnType.STRING, label="Email")
    customer_contact_name = Column(ColumnType.STRING, label="Contacto")

    source_quote_id = Column(ColumnType.INTEGER, label="Cotizacion origen")
    source_reference = Column(ColumnType.STRING, label="Referencia origen")
    created_from = Column(ColumnType.STRING, default="manual", label="Origen")
    reference_document_id = Column(ColumnType.INTEGER, label="Documento referenciado")
    reference_document_number = Column(ColumnType.STRING, label="Numero documento referenciado")
    reference_document_type = Column(ColumnType.STRING, label="Tipo documento referenciado")
    correction_mode = Column(ColumnType.STRING, label="Modo correccion")
    correction_reason = Column(ColumnType.TEXT, label="Motivo correccion")

    issue_date = Column(ColumnType.STRING, required=True, label="Fecha emision")
    due_date = Column(ColumnType.STRING, required=True, label="Fecha vencimiento")
    payment_terms = Column(ColumnType.STRING, label="Condiciones de pago")
    currency = Column(ColumnType.STRING, default="CLP", label="Moneda")

    status = Column(ColumnType.STRING, default="draft", label="Estado")
    sii_status = Column(ColumnType.STRING, default="not_sent", label="Estado SII")
    payment_status = Column(ColumnType.STRING, default="pending", label="Estado pago")
    delivery_status = Column(ColumnType.STRING, default="pending", label="Estado envio")

    simulation_profile = Column(ColumnType.STRING, default="auto_accept", label="Perfil simulacion")
    simulation_attempts = Column(ColumnType.INTEGER, default=0, label="Intentos simulacion")
    last_sii_message = Column(ColumnType.STRING, label="Ultimo mensaje SII")
    last_sii_sync_at = Column(ColumnType.DATETIME, label="Ultima sincronizacion SII")

    tax_rate = Column(ColumnType.FLOAT, default=19.0, label="Tasa impuesto")
    subtotal_amount = Column(ColumnType.FLOAT, default=0.0, label="Subtotal")
    tax_amount = Column(ColumnType.FLOAT, default=0.0, label="Impuesto")
    total_amount = Column(ColumnType.FLOAT, default=0.0, label="Total")
    paid_amount = Column(ColumnType.FLOAT, default=0.0, label="Pagado")
    balance_due = Column(ColumnType.FLOAT, default=0.0, label="Saldo")

    customer_message = Column(ColumnType.TEXT, label="Mensaje cliente")
    internal_notes = Column(ColumnType.TEXT, label="Notas internas")

    sent_to_customer_at = Column(ColumnType.DATETIME, label="Enviado al cliente")
    paid_at = Column(ColumnType.DATETIME, label="Fecha pago completo")

    def validate(self):
        super().validate()

        self.document_number = _clean_str(self.document_number)
        self.sii_folio = _clean_str(self.sii_folio)
        self.document_type = _clean_str(self.document_type, "33")
        self.customer_name = _clean_str(self.customer_name)
        self.customer_tax_id = _clean_str(self.customer_tax_id)
        self.customer_email = _clean_str(self.customer_email)
        self.customer_contact_name = _clean_str(self.customer_contact_name)
        self.source_reference = _clean_str(self.source_reference)
        self.created_from = _clean_str(self.created_from, "manual")
        self.reference_document_number = _clean_str(self.reference_document_number)
        self.reference_document_type = _clean_str(self.reference_document_type)
        self.correction_mode = _clean_str(self.correction_mode)
        self.correction_reason = _clean_str(self.correction_reason)
        self.payment_terms = _clean_str(self.payment_terms)
        self.currency = _clean_str(self.currency, "CLP")
        self.status = _clean_str(self.status, "draft")
        self.sii_status = _clean_str(self.sii_status, "not_sent")
        self.payment_status = _clean_str(self.payment_status, "pending")
        self.delivery_status = _clean_str(self.delivery_status, "pending")
        self.simulation_profile = _clean_str(self.simulation_profile, "auto_accept")
        self.issue_date = _iso_date(self.issue_date)
        self.due_date = _iso_date(self.due_date)

        if self.document_type not in DOCUMENT_TYPES:
            raise ValidationError("Tipo de documento no soportado para la simulacion")
        if not self.document_number:
            raise ValidationError("Numero de documento requerido")
        if not self.sii_folio:
            raise ValidationError("Folio simulado requerido")
        if not self.customer_name:
            raise ValidationError("Debes indicar el nombre del cliente")
        if self.simulation_profile not in SIMULATION_PROFILES:
            raise ValidationError("Perfil de simulacion invalido")
        if self.correction_mode and self.correction_mode not in CORRECTION_MODES:
            raise ValidationError("Modo de correccion invalido")
        if self.document_type in REFERENCE_REQUIRED_TYPES and not self.reference_document_number:
            raise ValidationError("Las notas y correcciones deben vincular un documento de referencia")

        duplicates = BillingDocument.search(
            [("company_id", "=", self.company_id), ("document_number", "=", self.document_number)]
        )
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Ya existe un documento con ese numero interno")

    def to_dict(self) -> Dict[str, Any]:
        meta = DOCUMENT_TYPES.get(self.document_type, DOCUMENT_TYPES["33"])
        supports_payment = bool(meta.get("supports_payment"))
        reference_meta = DOCUMENT_TYPES.get(self.reference_document_type, {})
        correction_meta = CORRECTION_MODES.get(self.correction_mode, {})
        due = _parse_date(self.due_date)
        today = date.today()

        overdue_days = 0
        if due and due < today and _safe_float(self.balance_due) > 0 and supports_payment:
            overdue_days = max((today - due).days, 0)

        risk_level = "low"
        if self.status in ("rejected", "overdue"):
            risk_level = "high"
        elif self.status in ("observed", "partially_paid", "simulated_queued"):
            risk_level = "medium"

        return {
            "id": self.id,
            "document_number": self.document_number or "",
            "sii_folio": self.sii_folio or "",
            "document_type": self.document_type or "33",
            "document_type_label": meta.get("label", "Documento"),
            "company_id": self.company_id,
            "customer_id": self.customer_id,
            "customer_name": self.customer_name or "",
            "customer_tax_id": self.customer_tax_id or "",
            "customer_email": self.customer_email or "",
            "customer_contact_name": self.customer_contact_name or "",
            "source_quote_id": self.source_quote_id,
            "source_reference": self.source_reference or "",
            "created_from": self.created_from or "manual",
            "reference_document_id": self.reference_document_id,
            "reference_document_number": self.reference_document_number or "",
            "reference_document_type": self.reference_document_type or "",
            "reference_document_type_label": reference_meta.get("label", self.reference_document_type or ""),
            "correction_mode": self.correction_mode or "",
            "correction_mode_label": correction_meta.get("label", self.correction_mode or ""),
            "correction_reason": self.correction_reason or "",
            "issue_date": self.issue_date or "",
            "due_date": self.due_date or "",
            "payment_terms": self.payment_terms or "",
            "currency": self.currency or "CLP",
            "status": self.status or "draft",
            "status_label": DOCUMENT_STATUS_LABELS.get(self.status or "draft", self.status or "draft"),
            "sii_status": self.sii_status or "not_sent",
            "sii_status_label": SII_STATUS_LABELS.get(self.sii_status or "not_sent", self.sii_status or "not_sent"),
            "payment_status": self.payment_status or "pending",
            "payment_status_label": PAYMENT_STATUS_LABELS.get(
                self.payment_status or "pending",
                self.payment_status or "pending",
            ),
            "delivery_status": self.delivery_status or "pending",
            "delivery_status_label": DELIVERY_STATUS_LABELS.get(
                self.delivery_status or "pending",
                self.delivery_status or "pending",
            ),
            "simulation_profile": self.simulation_profile or "auto_accept",
            "simulation_profile_label": SIMULATION_PROFILES.get(
                self.simulation_profile or "auto_accept",
                SIMULATION_PROFILES["auto_accept"],
            )["label"],
            "simulation_attempts": _safe_int(self.simulation_attempts, 0) or 0,
            "last_sii_message": self.last_sii_message or "",
            "last_sii_sync_at": _fmt_dt(self.last_sii_sync_at),
            "tax_rate": _safe_float(self.tax_rate),
            "subtotal_amount": _round_money(self.subtotal_amount),
            "tax_amount": _round_money(self.tax_amount),
            "total_amount": _round_money(self.total_amount),
            "paid_amount": _round_money(self.paid_amount),
            "balance_due": _round_money(self.balance_due),
            "customer_message": self.customer_message or "",
            "internal_notes": self.internal_notes or "",
            "sent_to_customer_at": _fmt_dt(self.sent_to_customer_at),
            "paid_at": _fmt_dt(self.paid_at),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
            "is_credit_note": meta.get("sign", 1) < 0,
            "has_reference": bool(self.reference_document_number),
            "supports_payment": supports_payment,
            "is_overdue": overdue_days > 0,
            "overdue_days": overdue_days,
            "risk_level": risk_level,
            "can_edit": self.status in ("draft", "observed", "rejected"),
            "can_delete": self.status in ("draft", "observed", "rejected", "cancelled"),
            "can_simulate_sii": self.status in ("draft", "observed", "rejected"),
            "can_send_customer": self.sii_status == "accepted" and self.delivery_status == "pending",
            "can_register_payment": supports_payment
            and self.sii_status == "accepted"
            and _safe_float(self.balance_due) > 0,
        }


class BillingLine(BaseModel):
    __tablename__ = "billing_lines"
    __displayname__ = "description"

    document_id = Column(ColumnType.INTEGER, required=True, label="Documento")
    company_id = Column(ColumnType.INTEGER, required=True, label="Empresa")
    description = Column(ColumnType.STRING, required=True, label="Descripcion")
    quantity = Column(ColumnType.FLOAT, default=1.0, label="Cantidad")
    unit_price = Column(ColumnType.FLOAT, default=0.0, label="Precio unitario")
    discount_pct = Column(ColumnType.FLOAT, default=0.0, label="Descuento")
    is_exempt = Column(ColumnType.BOOLEAN, default=False, label="Exenta")
    line_total = Column(ColumnType.FLOAT, default=0.0, label="Total linea")

    def validate(self):
        super().validate()
        self.description = _clean_str(self.description)
        self.quantity = max(_safe_float(self.quantity, 1.0), 0.0)
        self.unit_price = max(_safe_float(self.unit_price, 0.0), 0.0)
        self.discount_pct = min(max(_safe_float(self.discount_pct, 0.0), 0.0), 99.0)

        if not self.description:
            raise ValidationError("Cada linea debe tener descripcion")
        if self.quantity <= 0:
            raise ValidationError("La cantidad debe ser mayor que cero")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "document_id": self.document_id,
            "company_id": self.company_id,
            "description": self.description or "",
            "quantity": _safe_float(self.quantity, 1.0),
            "unit_price": _round_money(self.unit_price),
            "discount_pct": _safe_float(self.discount_pct, 0.0),
            "is_exempt": bool(self.is_exempt),
            "line_total": _round_money(self.line_total),
        }


class BillingEvent(BaseModel, AuditMixin):
    __tablename__ = "billing_events"
    __displayname__ = "title"

    document_id = Column(ColumnType.INTEGER, required=True, label="Documento")
    company_id = Column(ColumnType.INTEGER, required=True, label="Empresa")
    event_type = Column(ColumnType.STRING, required=True, label="Tipo evento")
    title = Column(ColumnType.STRING, required=True, label="Titulo")
    detail = Column(ColumnType.TEXT, label="Detalle")
    actor_name = Column(ColumnType.STRING, label="Actor")
    payload = Column(ColumnType.JSON, default={}, label="Payload")
    occurred_at = Column(ColumnType.DATETIME, default=utc_now, label="Fecha evento")

    def validate(self):
        super().validate()
        self.event_type = _clean_str(self.event_type)
        self.title = _clean_str(self.title)
        self.detail = _clean_str(self.detail)
        self.actor_name = _clean_str(self.actor_name, "Sistema")
        if not self.event_type:
            raise ValidationError("Tipo de evento requerido")
        if not self.title:
            raise ValidationError("Titulo de evento requerido")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "document_id": self.document_id,
            "company_id": self.company_id,
            "event_type": self.event_type or "",
            "title": self.title or "",
            "detail": self.detail or "",
            "actor_name": self.actor_name or "Sistema",
            "payload": self.payload if isinstance(self.payload, dict) else {},
            "occurred_at": _fmt_dt(self.occurred_at),
            "created_at": _fmt_dt(self._data.get("created_at")),
        }


class BillingModule(BaseModule):
    name = "Billing"
    version = "1.0.0"
    author = "Your Company"
    description = "Facturacion ficticia y simulacion de experiencia previa a SII"
    depends = ["base", "crm", "quotes"]

    def init_module(self):
        self.register_model("billing.document", BillingDocument)
        self.register_model("billing.line", BillingLine)
        self.register_model("billing.event", BillingEvent)

        self.register_route("/billing/dashboard", self.get_dashboard, methods=["GET"], auth_required=True)
        self.register_route("/billing/reference-data", self.get_reference_data, methods=["GET"], auth_required=True)
        self.register_route("/billing/demo-seed", self.seed_demo_workspace, methods=["POST"], auth_required=True)

        self.register_route("/billing/documents", self.list_documents, methods=["GET"], auth_required=True)
        self.register_route("/billing/documents", self.create_document, methods=["POST"], auth_required=True)
        self.register_route("/billing/documents/{id}", self.get_document, methods=["GET"], auth_required=True)
        self.register_route("/billing/documents/{id}/preview-data", self.get_document_preview_data, methods=["GET"], auth_required=True)
        self.register_route("/billing/documents/{id}", self.update_document, methods=["PUT"], auth_required=True)
        self.register_route("/billing/documents/{id}", self.delete_document, methods=["DELETE"], auth_required=True)
        self.register_route("/billing/documents/{id}/simulate-sii", self.simulate_sii, methods=["POST"], auth_required=True)
        self.register_route("/billing/documents/{id}/send-customer", self.send_customer_copy, methods=["POST"], auth_required=True)
        self.register_route("/billing/documents/{id}/register-payment", self.register_payment, methods=["POST"], auth_required=True)
        self.register_route("/billing/documents/{id}/duplicate", self.duplicate_document, methods=["POST"], auth_required=True)

        self.logger.info("Billing simulation module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _tenant_filter(self) -> List[tuple]:
        user = self.env.user
        if user and user.role == "superadmin":
            return []
        return [("company_id", "=", self._company_id())]

    def _user_has_access(self) -> bool:
        user = self.env.user
        if not user:
            return False
        if user.role in ("superadmin", "company_admin"):
            return True
        allowed = set(user.allowed_modules or [])
        return bool({"finance", "billing"} & allowed)

    def _require_access(self) -> Optional[Response]:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._user_has_access():
            return Response.forbidden("No tienes acceso al modulo de Facturacion")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        if self.env.user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Solo administradores pueden eliminar o anular documentos")
        return None

    def _get_documents(self) -> List[BillingDocument]:
        rows = BillingDocument.search(self._tenant_filter())
        for row in rows:
            self._refresh_document_state(row, persist=True)
        rows.sort(key=lambda doc: (_sort_date_key(doc.issue_date), doc.id or 0), reverse=True)
        return rows

    def _get_events(self, document_id: Optional[int] = None) -> List[BillingEvent]:
        domain = list(self._tenant_filter())
        if document_id:
            domain.append(("document_id", "=", document_id))
        rows = BillingEvent.search(domain)
        rows.sort(key=lambda event: (_sort_dt_key(event.occurred_at), event.id or 0), reverse=True)
        return rows

    def _lines_for_document(self, document_id: int) -> List[BillingLine]:
        lines = BillingLine.search([("document_id", "=", document_id)])
        lines.sort(key=lambda line: line.id or 0)
        return lines

    def _document_or_404(self, document_id: Any) -> Tuple[Optional[BillingDocument], Optional[Response]]:
        document = BillingDocument.find_by_id(_safe_int(document_id))
        if not document:
            return None, Response.not_found("Documento no encontrado")
        user = self.env.user
        if user.role != "superadmin" and document.company_id != self._company_id():
            return None, Response.not_found("Documento no encontrado")
        self._refresh_document_state(document, persist=True)
        return document, None

    def _status_for_document(self, document: BillingDocument) -> str:
        if document.status == "cancelled":
            return "cancelled"
        if document.sii_status == "queued":
            return "simulated_queued"
        if document.sii_status == "observed":
            return "observed"
        if document.sii_status == "rejected":
            return "rejected"
        if document.sii_status != "accepted":
            return "draft"

        if document.payment_status == "paid":
            return "paid"
        if document.payment_status == "overdue":
            return "overdue"
        if document.payment_status == "partial":
            return "partially_paid"
        if document.delivery_status in ("sent", "opened") and DOCUMENT_TYPES.get(document.document_type, {}).get("supports_payment"):
            return "collecting"
        return "issued"

    def _refresh_document_state(self, document: BillingDocument, persist: bool = False) -> None:
        meta = DOCUMENT_TYPES.get(document.document_type, DOCUMENT_TYPES["33"])
        supports_payment = bool(meta.get("supports_payment"))
        changed = False

        if document.document_type == "34" and _safe_float(document.tax_rate) != 0.0:
            document.tax_rate = 0.0
            changed = True

        total_amount = _round_money(document.total_amount)
        if supports_payment:
            paid_amount = min(max(_round_money(document.paid_amount), 0.0), max(total_amount, 0.0))
            balance_due = max(_round_money(total_amount - paid_amount), 0.0)

            payment_status = "pending"
            if balance_due <= 0:
                payment_status = "paid"
                if not document.paid_at:
                    document.paid_at = utc_now()
                    changed = True
            elif paid_amount > 0:
                payment_status = "partial"

            due = _parse_date(document.due_date)
            if due and due < date.today() and balance_due > 0 and paid_amount <= 0:
                payment_status = "overdue"

            if _round_money(document.paid_amount) != paid_amount:
                document.paid_amount = paid_amount
                changed = True
            if _round_money(document.balance_due) != balance_due:
                document.balance_due = balance_due
                changed = True
            if document.payment_status != payment_status:
                document.payment_status = payment_status
                changed = True
        else:
            if _round_money(document.paid_amount) != 0.0:
                document.paid_amount = 0.0
                changed = True
            if _round_money(document.balance_due) != 0.0:
                document.balance_due = 0.0
                changed = True
            if document.payment_status != "not_applicable":
                document.payment_status = "not_applicable"
                changed = True

        status = self._status_for_document(document)
        if document.status != status:
            document.status = status
            changed = True

        if persist and changed:
            document.save()

    def _build_document_number(self, document_type: str) -> str:
        prefix = DOCUMENT_TYPES.get(document_type, DOCUMENT_TYPES["33"])["prefix"]
        docs = BillingDocument.search(
            [("company_id", "=", self._company_id()), ("document_type", "=", document_type)]
        )
        seq = len(docs) + 1
        return f"{prefix}-{seq:04d}"

    def _build_sii_folio(self, document_type: str) -> str:
        type_offset = {"33": 1100, "34": 2100, "56": 5600, "61": 6100}.get(document_type, 9000)
        docs = BillingDocument.search(
            [("company_id", "=", self._company_id()), ("document_type", "=", document_type)]
        )
        return str(type_offset + len(docs) + 1)

    def _load_customer(self, customer_id: Optional[int]) -> Any:
        if not customer_id:
            return None
        try:
            from modules.crm.module_crm import Customer

            customer = Customer.find_by_id(int(customer_id))
            if not customer:
                return None
            if self.env.user.role != "superadmin" and customer.company_id != self._company_id():
                return None
            return customer
        except Exception:
            return None

    def _load_quote(self, quote_id: Optional[int]) -> Tuple[Any, List[Any]]:
        if not quote_id:
            return None, []
        try:
            from modules.quotes.module_quotes import Quote, QuoteLine

            quote = Quote.find_by_id(int(quote_id))
            if not quote:
                return None, []
            if self.env.user.role != "superadmin" and quote.company_id != self._company_id():
                return None, []
            lines = QuoteLine.search([("quote_id", "=", quote.id)])
            lines.sort(key=lambda line: line.id or 0)
            return quote, lines
        except Exception:
            return None, []

    def _load_reference_document(self, document_id: Optional[int]) -> Optional[BillingDocument]:
        if not document_id:
            return None
        document = BillingDocument.find_by_id(int(document_id))
        if not document:
            return None
        user = self.env.user
        if user and user.role != "superadmin" and document.company_id != self._company_id():
            return None
        return document

    def _resolve_reference_context(
        self,
        payload: Dict[str, Any],
        document_type: str,
        current_document: Optional[BillingDocument] = None,
    ) -> Tuple[Optional[BillingDocument], Dict[str, Any]]:
        reference_document_id = _safe_int(
            payload.get("reference_document_id"),
            getattr(current_document, "reference_document_id", None),
        )
        reference_document = self._load_reference_document(reference_document_id)
        correction_mode = _clean_str(payload.get("correction_mode"), DEFAULT_CORRECTION_MODE.get(document_type, ""))
        correction_reason = _clean_str(payload.get("correction_reason"))

        if reference_document and getattr(current_document, "id", None) and reference_document.id == current_document.id:
            raise ValidationError("El documento no puede referenciarse a si mismo")

        if document_type in REFERENCE_REQUIRED_TYPES:
            if not reference_document:
                raise ValidationError("Debes seleccionar el documento que sera corregido")
            if correction_mode not in CORRECTION_MODES:
                raise ValidationError("Selecciona un tipo de correccion valido")
            allowed_types = CORRECTION_MODES[correction_mode].get("document_types", [])
            if document_type not in allowed_types:
                raise ValidationError("Ese tipo de correccion no aplica para el documento seleccionado")
            if not correction_reason:
                raise ValidationError("Debes registrar el motivo operacional de la correccion")
        else:
            correction_mode = ""
            correction_reason = ""
            reference_document = None

        return reference_document, {
            "reference_document_id": reference_document.id if reference_document else None,
            "reference_document_number": reference_document.document_number if reference_document else "",
            "reference_document_type": reference_document.document_type if reference_document else "",
            "correction_mode": correction_mode,
            "correction_reason": correction_reason,
        }

    def _normalize_lines(self, payload: Dict[str, Any], document_type: str) -> Tuple[List[Dict[str, Any]], Dict[str, float]]:
        source_quote_id = _safe_int(payload.get("source_quote_id"))
        incoming_lines = payload.get("lines")
        if (not incoming_lines or not isinstance(incoming_lines, list)) and source_quote_id:
            quote, quote_lines = self._load_quote(source_quote_id)
            if quote and quote_lines:
                incoming_lines = [
                    {
                        "description": quote_line.description,
                        "quantity": quote_line.quantity,
                        "unit_price": quote_line.unit_price,
                        "discount_pct": 0,
                        "is_exempt": document_type == "34",
                    }
                    for quote_line in quote_lines
                ]

        if not incoming_lines or not isinstance(incoming_lines, list):
            raise ValidationError("Debes ingresar al menos una linea de detalle")

        sign = DOCUMENT_TYPES.get(document_type, DOCUMENT_TYPES["33"]).get("sign", 1)
        base_tax_rate = DOCUMENT_TYPES.get(document_type, DOCUMENT_TYPES["33"]).get("default_tax_rate", 19.0)
        requested_tax_rate = _safe_float(payload.get("tax_rate"), base_tax_rate)
        tax_rate = 0.0 if document_type == "34" else max(requested_tax_rate, 0.0)

        normalized: List[Dict[str, Any]] = []
        taxable_base = 0.0
        subtotal_signed = 0.0

        for index, raw_line in enumerate(incoming_lines, start=1):
            description = _clean_str((raw_line or {}).get("description"))
            quantity = max(_safe_float((raw_line or {}).get("quantity"), 1.0), 0.0)
            unit_price = max(_safe_float((raw_line or {}).get("unit_price"), 0.0), 0.0)
            discount_pct = min(max(_safe_float((raw_line or {}).get("discount_pct"), 0.0), 0.0), 99.0)
            is_exempt = bool((raw_line or {}).get("is_exempt")) or document_type == "34"

            if not description:
                raise ValidationError(f"Linea {index}: descripcion requerida")
            if quantity <= 0:
                raise ValidationError(f"Linea {index}: la cantidad debe ser mayor a cero")

            line_base_total = _round_money(quantity * unit_price * (1 - (discount_pct / 100)))
            line_total = _round_money(sign * line_base_total)
            subtotal_signed += line_total
            if not is_exempt:
                taxable_base += line_base_total

            normalized.append(
                {
                    "description": description,
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "discount_pct": discount_pct,
                    "is_exempt": is_exempt,
                    "line_total": line_total,
                }
            )

        tax_amount = _round_money(sign * _round_money(taxable_base * (tax_rate / 100)))
        total_amount = _round_money(subtotal_signed + tax_amount)

        return normalized, {
            "tax_rate": tax_rate,
            "subtotal_amount": _round_money(subtotal_signed),
            "tax_amount": tax_amount,
            "total_amount": total_amount,
        }

    def _resolve_customer_snapshot(
        self,
        payload: Dict[str, Any],
        reference_document: Optional[BillingDocument] = None,
    ) -> Dict[str, Any]:
        customer_id = _safe_int(payload.get("customer_id"))
        source_quote_id = _safe_int(payload.get("source_quote_id"))
        customer = self._load_customer(customer_id)
        quote, _quote_lines = self._load_quote(source_quote_id)

        if quote and not customer and quote.customer_id:
            customer = self._load_customer(quote.customer_id)
            if customer:
                customer_id = customer.id
        if reference_document and not customer and reference_document.customer_id:
            customer = self._load_customer(reference_document.customer_id)
            customer_id = reference_document.customer_id

        customer_name = _pick_str(
            payload.get("customer_name"),
            getattr(customer, "name", ""),
            getattr(reference_document, "customer_name", ""),
        )
        customer_tax_id = _pick_str(
            payload.get("customer_tax_id"),
            getattr(customer, "tax_id", ""),
            getattr(reference_document, "customer_tax_id", ""),
        )
        customer_email = _pick_str(
            payload.get("customer_email"),
            getattr(customer, "email", ""),
            getattr(reference_document, "customer_email", ""),
        )
        customer_contact_name = _pick_str(
            payload.get("customer_contact_name"),
            getattr(customer, "contact_name", ""),
            getattr(reference_document, "customer_contact_name", ""),
        )
        payment_terms = _pick_str(
            payload.get("payment_terms"),
            getattr(customer, "payment_terms", ""),
            getattr(reference_document, "payment_terms", ""),
        )

        if quote and not customer_name:
            customer_name = f"Cliente cotizacion {quote.quote_number}"

        if not customer_name:
            raise ValidationError("Debes indicar un cliente o completar el nombre del receptor")

        return {
            "customer_id": customer_id,
            "customer_name": customer_name,
            "customer_tax_id": customer_tax_id,
            "customer_email": customer_email,
            "customer_contact_name": customer_contact_name,
            "payment_terms": payment_terms,
            "source_quote_id": quote.id if quote else source_quote_id,
            "source_reference": _pick_str(
                quote.quote_number if quote else "",
                payload.get("source_reference"),
                getattr(reference_document, "document_number", ""),
            ),
            "created_from": "quote" if quote else "manual",
        }

    def _write_document_lines(self, document: BillingDocument, lines_data: List[Dict[str, Any]]) -> None:
        existing = self._lines_for_document(document.id)
        for line in existing:
            line.delete()
        for line_data in lines_data:
            BillingLine.create(
                {
                    "document_id": document.id,
                    "company_id": document.company_id,
                    "description": line_data["description"],
                    "quantity": line_data["quantity"],
                    "unit_price": line_data["unit_price"],
                    "discount_pct": line_data["discount_pct"],
                    "is_exempt": line_data["is_exempt"],
                    "line_total": line_data["line_total"],
                }
            )

    def _log_event(
        self,
        document: BillingDocument,
        event_type: str,
        title: str,
        detail: str,
        payload: Optional[Dict[str, Any]] = None,
        actor_name: Optional[str] = None,
    ) -> BillingEvent:
        return BillingEvent.create(
            {
                "document_id": document.id,
                "company_id": document.company_id,
                "event_type": event_type,
                "title": title,
                "detail": detail,
                "payload": payload or {},
                "actor_name": actor_name or _user_display_name(self.env.user),
            }
        )

    def _build_document_payload(self, document: BillingDocument, include_timeline: bool = False) -> Dict[str, Any]:
        self._refresh_document_state(document, persist=True)
        payload = document.to_dict()
        payload["lines"] = [line.to_dict() for line in self._lines_for_document(document.id)]
        if include_timeline:
            payload["timeline"] = [event.to_dict() for event in self._get_events(document.id)]
        return payload

    def _company_snapshot(self, company_id: Optional[int]) -> Dict[str, Any]:
        if not company_id:
            return {}
        try:
            from modules.base.module_base import Company

            company = Company.find_by_id(company_id)
        except Exception:
            company = None

        if not company:
            return {}

        return {
            "id": company.id,
            "name": company.name or "",
            "legal_name": company.legal_name or company.name or "",
            "email": getattr(company, "email", "") or "",
            "phone": company.phone or "",
            "address": company.address or "",
            "tax_id": company.tax_id or "",
            "logo_url": company.logo_url or "",
            "bank_name": company.bank_name or "",
            "account_type": company.account_type or "",
            "account_number": company.account_number or "",
            "default_terms": company.default_terms or "",
        }

    def _build_preview_payload(self, document: BillingDocument) -> Dict[str, Any]:
        payload = self._build_document_payload(document, include_timeline=True)
        reference_document = self._load_reference_document(document.reference_document_id)
        customer_slug = "_".join((document.customer_name or "Cliente").split())[:30] or "cliente"
        filename_base = f"{document.document_number or 'documento'}_{customer_slug}"
        return {
            "document": payload,
            "company": self._company_snapshot(document.company_id),
            "reference_document": reference_document.to_dict() if reference_document else None,
            "print_filename": f"{filename_base}.pdf",
            "print_title": f"{payload['document_type_label']} {document.document_number}",
            "watermark": "Simulacion interna previa a SII",
        }

    def _create_or_update_document(
        self,
        payload: Dict[str, Any],
        document: Optional[BillingDocument] = None,
    ) -> BillingDocument:
        document_type = _clean_str(payload.get("document_type"), getattr(document, "document_type", "33"))
        if document_type not in DOCUMENT_TYPES:
            raise ValidationError("Tipo de documento no soportado")

        reference_document, reference_snapshot = self._resolve_reference_context(
            payload,
            document_type,
            current_document=document,
        )
        customer_snapshot = self._resolve_customer_snapshot(payload, reference_document=reference_document)
        if not DOCUMENT_TYPES[document_type]["supports_payment"] and not customer_snapshot["payment_terms"]:
            customer_snapshot["payment_terms"] = "No aplica"
        lines_data, totals = self._normalize_lines(payload, document_type)

        issue_date = _iso_date(payload.get("issue_date"), fallback=date.today())
        due_date_input = payload.get("due_date")
        default_due = _parse_date(issue_date, fallback=date.today()) or date.today()
        due_date = _iso_date(
            due_date_input,
            fallback=default_due
            if not DOCUMENT_TYPES[document_type]["supports_payment"]
            else default_due + timedelta(days=30),
        )

        if document is None:
            document = BillingDocument.create(
                {
                    "document_number": self._build_document_number(document_type),
                    "sii_folio": self._build_sii_folio(document_type),
                    "document_type": document_type,
                    "company_id": self._company_id(),
                    **customer_snapshot,
                    **reference_snapshot,
                    "issue_date": issue_date,
                    "due_date": due_date,
                    "currency": _clean_str(payload.get("currency"), "CLP"),
                    "simulation_profile": _clean_str(payload.get("simulation_profile"), "auto_accept"),
                    "tax_rate": totals["tax_rate"],
                    "subtotal_amount": totals["subtotal_amount"],
                    "tax_amount": totals["tax_amount"],
                    "total_amount": totals["total_amount"],
                    "paid_amount": 0.0,
                    "balance_due": max(totals["total_amount"], 0.0)
                    if DOCUMENT_TYPES[document_type]["supports_payment"]
                    else 0.0,
                    "customer_message": _clean_str(payload.get("customer_message")),
                    "internal_notes": _clean_str(payload.get("internal_notes")),
                    "status": "draft",
                    "sii_status": "not_sent",
                    "payment_status": "pending"
                    if DOCUMENT_TYPES[document_type]["supports_payment"]
                    else "not_applicable",
                    "delivery_status": "pending",
                }
            )
        else:
            document.document_type = document_type
            document.customer_id = customer_snapshot["customer_id"]
            document.customer_name = customer_snapshot["customer_name"]
            document.customer_tax_id = customer_snapshot["customer_tax_id"]
            document.customer_email = customer_snapshot["customer_email"]
            document.customer_contact_name = customer_snapshot["customer_contact_name"]
            document.payment_terms = customer_snapshot["payment_terms"]
            document.source_quote_id = customer_snapshot["source_quote_id"]
            document.source_reference = customer_snapshot["source_reference"]
            document.created_from = customer_snapshot["created_from"]
            document.reference_document_id = reference_snapshot["reference_document_id"]
            document.reference_document_number = reference_snapshot["reference_document_number"]
            document.reference_document_type = reference_snapshot["reference_document_type"]
            document.correction_mode = reference_snapshot["correction_mode"]
            document.correction_reason = reference_snapshot["correction_reason"]
            document.issue_date = issue_date
            document.due_date = due_date
            document.currency = _clean_str(payload.get("currency"), document.currency or "CLP")
            document.simulation_profile = _clean_str(
                payload.get("simulation_profile"),
                document.simulation_profile or "auto_accept",
            )
            document.tax_rate = totals["tax_rate"]
            document.subtotal_amount = totals["subtotal_amount"]
            document.tax_amount = totals["tax_amount"]
            document.total_amount = totals["total_amount"]
            if not DOCUMENT_TYPES[document_type]["supports_payment"]:
                document.paid_amount = 0.0
                document.balance_due = 0.0
            else:
                document.balance_due = max(_round_money(document.total_amount - document.paid_amount), 0.0)
            document.customer_message = _clean_str(payload.get("customer_message"))
            document.internal_notes = _clean_str(payload.get("internal_notes"))
            document.validate()
            document.save()

        self._write_document_lines(document, lines_data)
        self._refresh_document_state(document, persist=True)
        return document

    def _apply_sii_simulation(self, document: BillingDocument) -> Dict[str, Any]:
        if document.status == "cancelled":
            raise ValidationError("No puedes enviar un documento anulado a la simulacion SII")

        profile = document.simulation_profile or "auto_accept"
        document.simulation_attempts = (_safe_int(document.simulation_attempts, 0) or 0) + 1
        document.sii_status = "queued"
        document.last_sii_sync_at = utc_now()
        document.last_sii_message = "Documento recepcionado por la cola de simulacion."
        document.save()

        trace = [
            self._log_event(
                document,
                "sii_queued",
                "Documento en cola SII",
                f"{document.document_number} quedo en cola de simulacion para {DOCUMENT_TYPES[document.document_type]['label'].lower()}.",
                {"attempt": document.simulation_attempts},
            ).to_dict()
        ]

        if profile == "observed_then_accept":
            if document.simulation_attempts == 1:
                document.sii_status = "observed"
                document.last_sii_message = "Observacion simulada: revisa glosa o respaldo previo al reenvio."
                outcome_title = "Documento observado"
            else:
                document.sii_status = "accepted"
                document.last_sii_message = "Observacion resuelta en el reenvio. Documento aceptado."
                outcome_title = "Documento aceptado"
        elif profile == "reject_invalid_tax_id":
            if not _looks_like_chilean_rut(document.customer_tax_id):
                document.sii_status = "rejected"
                document.last_sii_message = "Rechazo simulado: RUT receptor invalido o incompleto."
                outcome_title = "Documento rechazado"
            else:
                document.sii_status = "accepted"
                document.last_sii_message = "RUT validado correctamente en la simulacion."
                outcome_title = "Documento aceptado"
        elif profile == "delayed_acceptance":
            document.sii_status = "accepted"
            document.last_sii_message = "Aceptacion simulada con demora de recepcion."
            outcome_title = "Documento aceptado"
        else:
            document.sii_status = "accepted"
            document.last_sii_message = "Aceptacion automatica de la simulacion."
            outcome_title = "Documento aceptado"

        self._refresh_document_state(document, persist=False)
        document.save()

        trace.append(
            self._log_event(
                document,
                f"sii_{document.sii_status}",
                outcome_title,
                document.last_sii_message or "",
                {
                    "attempt": document.simulation_attempts,
                    "profile": profile,
                    "sii_status": document.sii_status,
                },
            ).to_dict()
        )
        return {
            "document": self._build_document_payload(document, include_timeline=True),
            "trace": trace,
        }

    def _send_customer_document(self, document: BillingDocument) -> BillingDocument:
        if document.sii_status != "accepted":
            raise ValidationError("Solo puedes enviar al cliente documentos aceptados por la simulacion SII")
        document.delivery_status = "sent"
        document.sent_to_customer_at = utc_now()
        self._refresh_document_state(document, persist=False)
        document.save()
        destination = document.customer_email or "correo pendiente de configurar"
        self._log_event(
            document,
            "customer_sent",
            "Documento enviado al cliente",
            f"Se simulo envio del documento a {destination}.",
            {"destination": destination},
        )
        return document

    def _register_payment(
        self,
        document: BillingDocument,
        amount: float,
        payment_method: str,
        reference: str,
        notes: str,
        payment_date: str,
    ) -> BillingDocument:
        if DOCUMENT_TYPES.get(document.document_type, DOCUMENT_TYPES["33"]).get("supports_payment") is False:
            raise ValidationError("Las notas de credito no requieren cobranza en este simulador")
        if document.sii_status != "accepted":
            raise ValidationError("Solo puedes registrar pagos sobre documentos aceptados")
        if amount <= 0:
            raise ValidationError("El monto del pago debe ser mayor que cero")

        amount_to_apply = min(_round_money(amount), max(_round_money(document.balance_due), 0.0))
        if amount_to_apply <= 0:
            raise ValidationError("El documento ya no tiene saldo pendiente")

        document.paid_amount = _round_money(document.paid_amount + amount_to_apply)
        self._refresh_document_state(document, persist=False)
        if document.payment_status == "paid":
            document.paid_at = utc_now()
        document.save()

        self._log_event(
            document,
            "payment_registered",
            "Pago registrado",
            f"Se registro un abono de ${int(amount_to_apply):,} via {payment_method or 'medio no indicado'}.",
            {
                "amount": amount_to_apply,
                "payment_method": payment_method,
                "reference": reference,
                "notes": notes,
                "payment_date": payment_date,
            },
        )
        return document

    def _seed_demo_documents(self) -> Dict[str, Any]:
        if BillingDocument.search(self._tenant_filter()):
            return {"seeded": False, "count": 0, "message": "El workspace ya tiene documentos"}

        actor_name = _user_display_name(self.env.user)
        created: List[BillingDocument] = []

        demo_payloads = [
            {
                "document_type": "33",
                "customer_name": "Constructora Andina SpA",
                "customer_tax_id": "76.123.456-7",
                "customer_email": "pagos@constructoraandina.cl",
                "payment_terms": "30 dias",
                "issue_date": (date.today() - timedelta(days=3)).isoformat(),
                "due_date": (date.today() + timedelta(days=27)).isoformat(),
                "simulation_profile": "auto_accept",
                "customer_message": "Servicio mensual de mantencion preventiva.",
                "internal_notes": "Escenario demo: documento aceptado pendiente de pago.",
                "lines": [
                    {"description": "Servicio de mantencion preventiva", "quantity": 1, "unit_price": 850000},
                    {"description": "Movilizacion cuadrilla", "quantity": 1, "unit_price": 120000},
                ],
                "after": ["simulate", "send"],
            },
            {
                "document_type": "33",
                "customer_name": "Minera Cordillera Ltda",
                "customer_tax_id": "77.222.333-4",
                "customer_email": "ap@mineracordillera.cl",
                "payment_terms": "15 dias",
                "issue_date": (date.today() - timedelta(days=28)).isoformat(),
                "due_date": (date.today() - timedelta(days=7)).isoformat(),
                "simulation_profile": "delayed_acceptance",
                "internal_notes": "Escenario demo: documento vencido para priorizar cobranza.",
                "lines": [
                    {"description": "Inspeccion tecnica en terreno", "quantity": 2, "unit_price": 290000},
                    {"description": "Informe ejecutivo", "quantity": 1, "unit_price": 180000},
                ],
                "after": ["simulate", "send"],
            },
            {
                "document_type": "33",
                "customer_name": "Servicios Pacifico S.A.",
                "customer_tax_id": "761234567",
                "customer_email": "tesoreria@pacifico.cl",
                "payment_terms": "30 dias",
                "issue_date": date.today().isoformat(),
                "due_date": (date.today() + timedelta(days=30)).isoformat(),
                "simulation_profile": "reject_invalid_tax_id",
                "internal_notes": "Escenario demo: rechazo por datos del receptor.",
                "lines": [
                    {"description": "Plan de continuidad operacional", "quantity": 1, "unit_price": 640000},
                ],
                "after": ["simulate"],
            },
            {
                "document_type": "33",
                "customer_name": "Operaciones del Sur SpA",
                "customer_tax_id": "78.555.444-1",
                "customer_email": "control@operacionesdelsur.cl",
                "payment_terms": "7 dias",
                "issue_date": (date.today() - timedelta(days=10)).isoformat(),
                "due_date": (date.today() - timedelta(days=2)).isoformat(),
                "simulation_profile": "auto_accept",
                "internal_notes": "Escenario demo: documento completamente pagado.",
                "lines": [
                    {"description": "Visita tecnica correctiva", "quantity": 1, "unit_price": 420000},
                    {"description": "Horas adicionales", "quantity": 6, "unit_price": 28000},
                ],
                "after": ["simulate", "send", "payment_full"],
            },
            {
                "document_type": "61",
                "customer_name": "Constructora Andina SpA",
                "customer_tax_id": "76.123.456-7",
                "customer_email": "pagos@constructoraandina.cl",
                "payment_terms": "N/A",
                "issue_date": date.today().isoformat(),
                "due_date": date.today().isoformat(),
                "simulation_profile": "auto_accept",
                "internal_notes": "Escenario demo: nota de credito por ajuste comercial.",
                "reference_index": 0,
                "correction_mode": "amount_decrease",
                "correction_reason": "Descuento comercial posterior a la emision.",
                "lines": [
                    {"description": "Descuento comercial acordado", "quantity": 1, "unit_price": 95000},
                ],
                "after": ["simulate", "send"],
            },
            {
                "document_type": "56",
                "customer_name": "Constructora Andina SpA",
                "customer_tax_id": "76.123.456-7",
                "customer_email": "pagos@constructoraandina.cl",
                "payment_terms": "7 dias",
                "issue_date": date.today().isoformat(),
                "due_date": (date.today() + timedelta(days=7)).isoformat(),
                "simulation_profile": "auto_accept",
                "internal_notes": "Escenario demo: nota de debito por trabajo adicional.",
                "reference_index": 0,
                "correction_mode": "service_extension",
                "correction_reason": "Horas adicionales fuera de alcance inicial.",
                "lines": [
                    {"description": "Horas extra en terreno", "quantity": 3, "unit_price": 45000},
                ],
                "after": ["simulate", "send"],
            },
        ]

        for demo in demo_payloads:
            reference_index = demo.get("reference_index")
            if isinstance(reference_index, int) and 0 <= reference_index < len(created):
                demo = {**demo, "reference_document_id": created[reference_index].id}
            document = self._create_or_update_document(demo, document=None)
            self._log_event(
                document,
                "document_created",
                "Documento creado",
                f"{DOCUMENT_TYPES[document.document_type]['label']} demo creada para {document.customer_name}.",
                actor_name=actor_name,
            )

            for action in demo.get("after", []):
                if action == "simulate":
                    self._apply_sii_simulation(document)
                elif action == "send":
                    if document.sii_status == "accepted":
                        self._send_customer_document(document)
                elif action == "payment_full":
                    if document.sii_status == "accepted":
                        self._register_payment(
                            document,
                            amount=max(_round_money(document.balance_due), 0.0),
                            payment_method="Transferencia",
                            reference=f"PAGO-DEMO-{document.id}",
                            notes="Pago total de escenario demo.",
                            payment_date=date.today().isoformat(),
                        )
            created.append(document)

        return {
            "seeded": True,
            "count": len(created),
            "documents": [self._build_document_payload(document) for document in created],
            "message": "Escenario demo cargado correctamente",
        }

    def _build_dashboard(self, documents: List[BillingDocument]) -> Dict[str, Any]:
        stats = {
            "documents_total": len(documents),
            "draft_total": 0,
            "issued_total": 0,
            "observed_total": 0,
            "rejected_total": 0,
            "paid_total": 0,
            "overdue_total": 0,
            "acceptance_rate": 0.0,
            "issued_month_total": 0.0,
            "collected_month_total": 0.0,
            "outstanding_total": 0.0,
            "overdue_amount_total": 0.0,
        }

        today = date.today()
        current_month = today.strftime("%Y-%m")
        recent_events = self._get_events()
        accepted_counter = 0
        sent_to_sii_counter = 0

        for document in documents:
            self._refresh_document_state(document, persist=True)
            payload = document.to_dict()
            status = payload["status"]
            if status == "draft":
                stats["draft_total"] += 1
            if status in ("issued", "collecting", "partially_paid", "paid", "overdue"):
                stats["issued_total"] += 1
            if status == "observed":
                stats["observed_total"] += 1
            if status == "rejected":
                stats["rejected_total"] += 1
            if status == "paid":
                stats["paid_total"] += 1
            if status == "overdue":
                stats["overdue_total"] += 1

            if payload["sii_status"] != "not_sent":
                sent_to_sii_counter += 1
            if payload["sii_status"] == "accepted":
                accepted_counter += 1

            if str(payload["issue_date"]).startswith(current_month) and payload["total_amount"] > 0:
                stats["issued_month_total"] += _safe_float(payload["total_amount"])
            if payload["balance_due"] > 0:
                stats["outstanding_total"] += _safe_float(payload["balance_due"])
            if payload["payment_status"] == "overdue":
                stats["overdue_amount_total"] += _safe_float(payload["balance_due"])

        for event in recent_events:
            if event.event_type != "payment_registered":
                continue
            event_date = _fmt_dt(event.occurred_at) or ""
            if event_date.startswith(current_month):
                stats["collected_month_total"] += _safe_float((event.payload or {}).get("amount"))

        if sent_to_sii_counter:
            stats["acceptance_rate"] = round((accepted_counter / sent_to_sii_counter) * 100, 1)

        queue_board = [
            {"key": "draft", "label": "Borradores", "count": stats["draft_total"]},
            {"key": "issued", "label": "Emitidas", "count": stats["issued_total"]},
            {"key": "observed", "label": "Observadas", "count": stats["observed_total"]},
            {"key": "rejected", "label": "Rechazadas", "count": stats["rejected_total"]},
            {"key": "overdue", "label": "Vencidas", "count": stats["overdue_total"]},
            {"key": "paid", "label": "Pagadas", "count": stats["paid_total"]},
        ]

        due_soon = [
            document.to_dict()
            for document in documents
            if document.to_dict()["supports_payment"]
            and document.to_dict()["payment_status"] in ("pending", "partial", "overdue")
        ]
        due_soon.sort(
            key=lambda row: (
                0 if row["payment_status"] == "overdue" else 1,
                _sort_date_key(row["due_date"]),
                -(row["balance_due"] or 0),
            )
        )

        customer_risk: Dict[str, Dict[str, Any]] = {}
        for row in due_soon:
            key = row["customer_name"] or "Sin cliente"
            bucket = customer_risk.setdefault(
                key,
                {
                    "customer_name": key,
                    "documents": 0,
                    "pending_amount": 0.0,
                    "overdue_amount": 0.0,
                },
            )
            bucket["documents"] += 1
            bucket["pending_amount"] += _safe_float(row["balance_due"])
            if row["payment_status"] == "overdue":
                bucket["overdue_amount"] += _safe_float(row["balance_due"])

        customer_radar = list(customer_risk.values())
        customer_radar.sort(
            key=lambda row: (-row["overdue_amount"], -row["pending_amount"], row["customer_name"].lower())
        )
        for row in customer_radar:
            row["pending_amount"] = _round_money(row["pending_amount"])
            row["overdue_amount"] = _round_money(row["overdue_amount"])

        return {
            "stats": {
                key: _round_money(value) if key.endswith("_total") or key.endswith("_amount_total") else value
                for key, value in stats.items()
            },
            "queue_board": queue_board,
            "recent_documents": [document.to_dict() for document in documents[:8]],
            "recent_events": [event.to_dict() for event in recent_events[:10]],
            "due_soon": due_soon[:6],
            "customer_radar": customer_radar[:5],
        }

    async def get_dashboard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        return Response.ok(self._build_dashboard(self._get_documents()))

    async def get_reference_data(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        customers: List[Dict[str, Any]] = []
        try:
            from modules.crm.module_crm import Customer

            rows = Customer.search(self._tenant_filter())
            rows.sort(key=lambda customer: ((customer.name or "").lower(), customer.id or 0))
            customers = [
                {
                    "id": customer.id,
                    "name": customer.name or "",
                    "tax_id": customer.tax_id or "",
                    "email": customer.email or "",
                    "contact_name": customer.contact_name or "",
                    "payment_terms": customer.payment_terms or "",
                }
                for customer in rows[:50]
            ]
        except Exception:
            customers = []

        quotes: List[Dict[str, Any]] = []
        try:
            from modules.quotes.module_quotes import Quote
            from modules.crm.module_crm import Lead

            rows = Quote.search(self._tenant_filter())
            rows.sort(key=lambda quote: (quote.id or 0), reverse=True)
            for quote in rows[:40]:
                lead = Lead.find_by_id(quote.lead_id) if quote.lead_id else None
                quote_label = quote.to_dict().get("status_label", quote.status or "draft")
                quotes.append(
                    {
                        "id": quote.id,
                        "quote_number": quote.quote_number or "",
                        "customer_id": quote.customer_id,
                        "status": quote.status or "draft",
                        "status_label": quote_label,
                        "lead_title": lead.title if lead else "",
                        "gross_total": _round_money(getattr(quote, "gross_total", 0.0)),
                    }
                )
        except Exception:
            quotes = []

        billing_documents = [document.to_dict() for document in self._get_documents()]
        billing_documents.sort(
            key=lambda row: (
                0 if row["sii_status"] == "accepted" else 1,
                -(row["id"] or 0),
            )
        )

        return Response.ok(
            {
                "customers": customers,
                "quotes": quotes,
                "billing_documents": [
                    {
                        "id": row["id"],
                        "document_number": row["document_number"],
                        "document_type": row["document_type"],
                        "document_type_label": row["document_type_label"],
                        "customer_name": row["customer_name"],
                        "issue_date": row["issue_date"],
                        "total_amount": row["total_amount"],
                        "status": row["status"],
                        "sii_status": row["sii_status"],
                        "reference_document_id": row["reference_document_id"],
                    }
                    for row in billing_documents[:120]
                ],
                "document_types": [
                    {
                        "code": code,
                        "label": meta["label"],
                        "default_tax_rate": meta["default_tax_rate"],
                        "supports_payment": meta["supports_payment"],
                        "sign": meta["sign"],
                    }
                    for code, meta in DOCUMENT_TYPES.items()
                ],
                "correction_modes": [
                    {
                        "code": code,
                        "label": meta["label"],
                        "document_types": meta.get("document_types", []),
                    }
                    for code, meta in CORRECTION_MODES.items()
                ],
                "simulation_profiles": [
                    {
                        "code": code,
                        "label": meta["label"],
                        "description": meta["description"],
                    }
                    for code, meta in SIMULATION_PROFILES.items()
                ],
                "payment_methods": PAYMENT_METHODS,
            }
        )

    async def seed_demo_workspace(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        result = self._seed_demo_documents()
        if not result["seeded"]:
            return Response.bad_request(result["message"])
        return Response.created(result)

    async def list_documents(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        search = _clean_str(request.get_param("search")).lower()
        status = _clean_str(request.get_param("status"))
        payment_status = _clean_str(request.get_param("payment_status"))
        sii_status = _clean_str(request.get_param("sii_status"))
        document_type = _clean_str(request.get_param("document_type"))
        limit = _safe_int(request.get_param("limit"), 120) or 120

        results = [document.to_dict() for document in self._get_documents()]
        if search:
            results = [
                row
                for row in results
                if search in (row["document_number"] or "").lower()
                or search in (row["customer_name"] or "").lower()
                or search in (row["customer_tax_id"] or "").lower()
                or search in (row["source_reference"] or "").lower()
                or search in (row["reference_document_number"] or "").lower()
                or search in (row["correction_reason"] or "").lower()
            ]
        if status:
            results = [row for row in results if row["status"] == status]
        if payment_status:
            results = [row for row in results if row["payment_status"] == payment_status]
        if sii_status:
            results = [row for row in results if row["sii_status"] == sii_status]
        if document_type:
            results = [row for row in results if row["document_type"] == document_type]

        return Response.ok({"count": len(results), "results": results[:limit]})

    async def create_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        try:
            document = self._create_or_update_document(request.data or {}, document=None)
            self._log_event(
                document,
                "document_created",
                "Documento creado",
                f"{DOCUMENT_TYPES[document.document_type]['label']} creada para {document.customer_name} por ${int(document.total_amount):,}.",
            )
            return Response.created(self._build_document_payload(document, include_timeline=True))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error
        return Response.ok(self._build_document_payload(document, include_timeline=True))

    async def get_document_preview_data(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error
        return Response.ok(self._build_preview_payload(document))

    async def update_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error
        if document.status not in ("draft", "observed", "rejected"):
            return Response.bad_request("Solo puedes editar documentos en borrador, observados o rechazados")

        try:
            document = self._create_or_update_document(request.data or {}, document=document)
            self._log_event(
                document,
                "document_updated",
                "Documento actualizado",
                f"Se ajusto el detalle del documento {document.document_number}.",
            )
            return Response.ok(self._build_document_payload(document, include_timeline=True))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_document(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error
        if document.status not in ("draft", "observed", "rejected", "cancelled"):
            return Response.bad_request("Solo puedes eliminar documentos que aun no esten emitidos")

        lines = self._lines_for_document(document.id)
        events = self._get_events(document.id)
        for line in lines:
            line.delete()
        for event in events:
            event.delete()
        document.delete()
        return Response.ok({"message": f"Documento {document.document_number} eliminado"})

    async def simulate_sii(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error
        if document.status not in ("draft", "observed", "rejected"):
            return Response.bad_request("Este documento ya no necesita simulacion SII")

        try:
            result = self._apply_sii_simulation(document)
            return Response.ok(result)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def send_customer_copy(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error

        try:
            document = self._send_customer_document(document)
            return Response.ok(self._build_document_payload(document, include_timeline=True))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def register_payment(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error

        try:
            document = self._register_payment(
                document,
                amount=_safe_float(request.get_data("amount"), 0.0),
                payment_method=_clean_str(request.get_data("payment_method")),
                reference=_clean_str(request.get_data("reference")),
                notes=_clean_str(request.get_data("notes")),
                payment_date=_iso_date(request.get_data("payment_date"), fallback=date.today()),
            )
            return Response.ok(self._build_document_payload(document, include_timeline=True))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def duplicate_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error

        lines = [line.to_dict() for line in self._lines_for_document(document.id)]
        payload = {
            "document_type": document.document_type,
            "customer_id": document.customer_id,
            "customer_name": document.customer_name,
            "customer_tax_id": document.customer_tax_id,
            "customer_email": document.customer_email,
            "customer_contact_name": document.customer_contact_name,
            "source_quote_id": document.source_quote_id,
            "payment_terms": document.payment_terms,
            "currency": document.currency,
            "simulation_profile": document.simulation_profile,
            "reference_document_id": document.reference_document_id,
            "correction_mode": document.correction_mode,
            "correction_reason": document.correction_reason,
            "customer_message": document.customer_message,
            "internal_notes": f"Copia de {document.document_number}",
            "lines": lines,
            "issue_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
        }

        try:
            duplicate = self._create_or_update_document(payload, document=None)
            self._log_event(
                duplicate,
                "document_duplicated",
                "Documento duplicado",
                f"Duplicado desde {document.document_number}.",
            )
            return Response.created(self._build_document_payload(duplicate, include_timeline=True))
        except ValidationError as exc:
            return Response.bad_request(str(exc))
