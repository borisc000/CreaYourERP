"""
Attendance module with auditable worker sign-offs.

Designed to support Chilean attendance-control traceability requirements:
- identifiable worker acceptance
- event timestamp in UTC plus local timezone context
- hash chain for audit review
- capture of IP / user agent / optional geolocation evidence

This implementation is oriented to legal traceability and audit readiness.
It is not a certified attendance provider by itself.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin
from core.time_utils import ensure_utc_datetime, utc_now
from modules.hr.module_hr import EmployeeProfile


ATTENDANCE_EVENT_TYPES = ("entry", "break_start", "break_end", "exit")
ATTENDANCE_RECORD_STATUSES = ("open", "closed", "needs_review")
DEFAULT_CHILE_TIMEZONE = "America/Santiago"
DEFAULT_DECLARATION_TEXT = (
    "Declaro que este registro de asistencia fue realizado por mi persona, "
    "que la informacion ingresada es veraz y que autorizo su resguardo para "
    "fines laborales, de fiscalizacion y auditoria."
)


def _safe_int(value: Any, default: Optional[int] = 0) -> Optional[int]:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
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


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _minutes_between(start: Optional[Any], end: Optional[Any]) -> int:
    start_dt = ensure_utc_datetime(start)
    end_dt = ensure_utc_datetime(end)
    if not start_dt or not end_dt:
        return 0
    delta = int((end_dt - start_dt).total_seconds() // 60)
    return max(0, delta)


def _tz_name(value: Any) -> str:
    text = str(value or DEFAULT_CHILE_TIMEZONE).strip() or DEFAULT_CHILE_TIMEZONE
    try:
        ZoneInfo(text)
        return text
    except Exception:
        return DEFAULT_CHILE_TIMEZONE


def _local_date_from_event(timestamp: datetime, timezone_name: str) -> str:
    try:
        local_dt = ensure_utc_datetime(timestamp).astimezone(ZoneInfo(_tz_name(timezone_name)))
        return local_dt.date().isoformat()
    except Exception:
        return ensure_utc_datetime(timestamp).date().isoformat()


def _hash_payload(payload: Dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class AttendancePolicy(BaseModel, AuditMixin):
    __tablename__ = "attendance_policies"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Policy Name")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    timezone = Column(ColumnType.STRING, default=DEFAULT_CHILE_TIMEZONE, label="Timezone")
    standard_entry_time = Column(ColumnType.STRING, default="09:00", label="Reference Entry Time")
    standard_daily_minutes = Column(ColumnType.INTEGER, default=540, label="Standard Daily Minutes")
    max_late_tolerance_minutes = Column(ColumnType.INTEGER, default=10, label="Late Tolerance")
    min_break_minutes = Column(ColumnType.INTEGER, default=30, label="Minimum Break Minutes")
    requires_geolocation = Column(ColumnType.BOOLEAN, default=False, label="Requires Geolocation")
    requires_device_info = Column(ColumnType.BOOLEAN, default=True, label="Requires Device Fingerprint")
    declaration_text = Column(ColumnType.TEXT, default=DEFAULT_DECLARATION_TEXT, label="Declaration Text")
    legal_basis = Column(
        ColumnType.TEXT,
        default="Registro orientado a control de asistencia, jornada y soporte de auditoria laboral en Chile.",
        label="Legal Basis",
    )
    retention_years = Column(ColumnType.INTEGER, default=5, label="Retention Years")
    is_active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def validate(self):
        super().validate()
        if not (self.name or "").strip():
            raise ValidationError("Policy name is required")
        if not (self.company_id or 0):
            raise ValidationError("Company is required")
        self.timezone = _tz_name(self.timezone)
        if _safe_int(self.standard_daily_minutes, 0) <= 0:
            raise ValidationError("Standard daily minutes must be greater than zero")
        if _safe_int(self.min_break_minutes, 0) < 0:
            raise ValidationError("Minimum break minutes cannot be negative")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name or "",
            "company_id": self.company_id,
            "timezone": self.timezone or DEFAULT_CHILE_TIMEZONE,
            "standard_entry_time": self.standard_entry_time or "09:00",
            "standard_daily_minutes": _safe_int(self.standard_daily_minutes, 540),
            "max_late_tolerance_minutes": _safe_int(self.max_late_tolerance_minutes, 10),
            "min_break_minutes": _safe_int(self.min_break_minutes, 30),
            "requires_geolocation": bool(self.requires_geolocation),
            "requires_device_info": bool(self.requires_device_info),
            "declaration_text": self.declaration_text or DEFAULT_DECLARATION_TEXT,
            "legal_basis": self.legal_basis or "",
            "retention_years": _safe_int(self.retention_years, 5),
            "is_active": bool(self.is_active),
        }


class AttendanceRecord(BaseModel, AuditMixin):
    __tablename__ = "attendance_records"
    __displayname__ = "session_date"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    user_id = Column(ColumnType.INTEGER, label="User")
    session_date = Column(ColumnType.STRING, required=True, label="Session Date")
    timezone = Column(ColumnType.STRING, default=DEFAULT_CHILE_TIMEZONE, label="Timezone")
    status = Column(ColumnType.STRING, default="open", label="Status")
    first_entry_at = Column(ColumnType.DATETIME, label="First Entry At")
    last_event_at = Column(ColumnType.DATETIME, label="Last Event At")
    closed_at = Column(ColumnType.DATETIME, label="Closed At")
    worked_minutes = Column(ColumnType.INTEGER, default=0, label="Worked Minutes")
    break_minutes = Column(ColumnType.INTEGER, default=0, label="Break Minutes")
    overtime_minutes = Column(ColumnType.INTEGER, default=0, label="Overtime Minutes")
    late_minutes = Column(ColumnType.INTEGER, default=0, label="Late Minutes")
    event_count = Column(ColumnType.INTEGER, default=0, label="Event Count")
    compliance_flags = Column(ColumnType.JSON, default=[], label="Compliance Flags")
    signature_chain_last_hash = Column(ColumnType.STRING, label="Last Event Hash")
    last_signature_name = Column(ColumnType.STRING, label="Last Signature Name")
    last_signature_rut = Column(ColumnType.STRING, label="Last Signature RUT")
    legal_summary = Column(ColumnType.JSON, default={}, label="Legal Summary")

    def validate(self):
        super().validate()
        if self.status not in ATTENDANCE_RECORD_STATUSES:
            raise ValidationError("Invalid attendance record status")

    def to_dict(self) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(_safe_int(self.employee_id))
        return {
            "id": self.id,
            "company_id": self.company_id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "user_id": self.user_id,
            "session_date": self.session_date or "",
            "timezone": self.timezone or DEFAULT_CHILE_TIMEZONE,
            "status": self.status or "open",
            "first_entry_at": _fmt_dt(self.first_entry_at),
            "last_event_at": _fmt_dt(self.last_event_at),
            "closed_at": _fmt_dt(self.closed_at),
            "worked_minutes": _safe_int(self.worked_minutes, 0),
            "break_minutes": _safe_int(self.break_minutes, 0),
            "overtime_minutes": _safe_int(self.overtime_minutes, 0),
            "late_minutes": _safe_int(self.late_minutes, 0),
            "event_count": _safe_int(self.event_count, 0),
            "compliance_flags": list(self.compliance_flags or []),
            "signature_chain_last_hash": self.signature_chain_last_hash,
            "last_signature_name": self.last_signature_name,
            "last_signature_rut": self.last_signature_rut,
            "legal_summary": dict(self.legal_summary or {}),
        }


class AttendanceEvent(BaseModel, AuditMixin):
    __tablename__ = "attendance_events"
    __displayname__ = "event_type"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    record_id = Column(ColumnType.INTEGER, required=True, label="Attendance Record")
    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    user_id = Column(ColumnType.INTEGER, label="User")
    event_type = Column(ColumnType.STRING, required=True, label="Event Type")
    event_at = Column(ColumnType.DATETIME, required=True, label="UTC Timestamp")
    event_local_date = Column(ColumnType.STRING, required=True, label="Local Date")
    event_local_time = Column(ColumnType.STRING, required=True, label="Local Time")
    timezone = Column(ColumnType.STRING, default=DEFAULT_CHILE_TIMEZONE, label="Timezone")
    timezone_offset_minutes = Column(ColumnType.INTEGER, default=0, label="Timezone Offset")
    ip_address = Column(ColumnType.STRING, label="IP Address")
    user_agent = Column(ColumnType.TEXT, label="User Agent")
    device_fingerprint = Column(ColumnType.STRING, label="Device Fingerprint")
    geo_latitude = Column(ColumnType.FLOAT, label="Geo Latitude")
    geo_longitude = Column(ColumnType.FLOAT, label="Geo Longitude")
    geo_accuracy_meters = Column(ColumnType.FLOAT, label="Geo Accuracy")
    signature_name = Column(ColumnType.STRING, required=True, label="Signer Name")
    signature_rut = Column(ColumnType.STRING, label="Signer RUT")
    signer_statement = Column(ColumnType.TEXT, label="Signer Statement")
    event_notes = Column(ColumnType.TEXT, label="Notes")
    evidence_payload = Column(ColumnType.JSON, default={}, label="Evidence Payload")
    payload_hash = Column(ColumnType.STRING, required=True, label="Payload Hash")
    previous_hash = Column(ColumnType.STRING, label="Previous Hash")
    chain_hash = Column(ColumnType.STRING, required=True, label="Chain Hash")

    def validate(self):
        super().validate()
        if self.event_type not in ATTENDANCE_EVENT_TYPES:
            raise ValidationError("Invalid attendance event type")
        if not (self.signature_name or "").strip():
            raise ValidationError("Signature name is required")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "record_id": self.record_id,
            "employee_id": self.employee_id,
            "user_id": self.user_id,
            "event_type": self.event_type,
            "event_at": _fmt_dt(self.event_at),
            "event_local_date": self.event_local_date,
            "event_local_time": self.event_local_time,
            "timezone": self.timezone or DEFAULT_CHILE_TIMEZONE,
            "timezone_offset_minutes": _safe_int(self.timezone_offset_minutes, 0),
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "device_fingerprint": self.device_fingerprint,
            "geo_latitude": self.geo_latitude,
            "geo_longitude": self.geo_longitude,
            "geo_accuracy_meters": self.geo_accuracy_meters,
            "signature_name": self.signature_name,
            "signature_rut": self.signature_rut,
            "signer_statement": self.signer_statement,
            "event_notes": self.event_notes,
            "evidence_payload": dict(self.evidence_payload or {}),
            "payload_hash": self.payload_hash,
            "previous_hash": self.previous_hash,
            "chain_hash": self.chain_hash,
        }


def seed_default_policy(company_id: int) -> AttendancePolicy:
    existing = AttendancePolicy.search([("company_id", "=", company_id)])
    if existing:
        active = [item for item in existing if item.is_active]
        return active[0] if active else existing[0]

    return AttendancePolicy.create(
        {
            "name": "Politica general de asistencia",
            "company_id": company_id,
            "timezone": DEFAULT_CHILE_TIMEZONE,
            "standard_entry_time": "09:00",
            "standard_daily_minutes": 540,
            "max_late_tolerance_minutes": 10,
            "min_break_minutes": 30,
            "requires_geolocation": False,
            "requires_device_info": True,
            "declaration_text": DEFAULT_DECLARATION_TEXT,
            "legal_basis": (
                "Registro interno orientado a respaldo de jornada, asistencia, "
                "aceptacion del trabajador y auditoria laboral en Chile."
            ),
            "retention_years": 5,
            "is_active": True,
        }
    )


class AttendanceModule(BaseModule):
    name = "Attendance"
    version = "1.0.0"
    author = "Your Company"
    description = "Attendance control with auditable worker sign-off"
    depends = ["base", "hr"]

    def init_module(self):
        self.register_model("attendance.policy", AttendancePolicy)
        self.register_model("attendance.record", AttendanceRecord)
        self.register_model("attendance.event", AttendanceEvent)

        self.register_route("/attendance/dashboard", self.get_dashboard, methods=["GET"], auth_required=True)
        self.register_route("/attendance/policy", self.get_policy, methods=["GET"], auth_required=True)
        self.register_route("/attendance/policy", self.update_policy, methods=["PUT"], auth_required=True)
        self.register_route("/attendance/employees", self.list_employees, methods=["GET"], auth_required=True)
        self.register_route("/attendance/records", self.list_records, methods=["GET"], auth_required=True)
        self.register_route("/attendance/records/{id}", self.get_record, methods=["GET"], auth_required=True)
        self.register_route("/attendance/records/punch", self.register_punch, methods=["POST"], auth_required=True)

        self.logger.info("Attendance module initialized")

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
        if allowed.intersection({"attendance", "hr", "payroll"}):
            return None
        return Response.forbidden("You do not have access to attendance control")

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        if self.env.user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Only administrators can configure attendance policies")
        return None

    def _active_policy(self) -> AttendancePolicy:
        company_id = self._company_id()
        return seed_default_policy(company_id)

    def _employee_or_404(self, employee_id: Any) -> Tuple[Optional[EmployeeProfile], Optional[Response]]:
        employee = EmployeeProfile.find_by_id(_safe_int(employee_id))
        if not employee or (
            self.env.user.role != "superadmin" and employee.company_id != self._company_id()
        ):
            return None, Response.not_found("Employee not found")
        return employee, None

    def _resolve_employee_for_request(self, payload: Dict[str, Any]) -> Tuple[Optional[EmployeeProfile], Optional[Response]]:
        user = self.env.user
        employee_id = _safe_int(payload.get("employee_id"), None)
        if user.role in ("superadmin", "company_admin") and employee_id:
            return self._employee_or_404(employee_id)

        if employee_id:
            employee, error = self._employee_or_404(employee_id)
            if error:
                return None, error
            if employee.user_id != user.id and user.role not in ("superadmin", "company_admin"):
                return None, Response.forbidden("You can only register your own attendance")
            return employee, None

        employees = EmployeeProfile.search(self._tenant_filter())
        own = next((item for item in employees if item.user_id == user.id), None)
        if own:
            return own, None

        own_by_email = next(
            (
                item
                for item in employees
                if (item.work_email or item.personal_email or "").strip().lower()
                == str(getattr(user, "email", "")).strip().lower()
            ),
            None,
        )
        if own_by_email:
            return own_by_email, None

        return None, Response.bad_request(
            "No employee profile is linked to the current user. Create the employee first in RRHH."
        )

    def _sorted_events_for_record(self, record_id: int) -> List[AttendanceEvent]:
        events = AttendanceEvent.search([("record_id", "=", record_id)])
        return sorted(events, key=lambda item: (_fmt_dt(item.event_at) or "", item.id or 0))

    def _find_open_record(self, employee_id: int, session_date: str) -> Optional[AttendanceRecord]:
        records = AttendanceRecord.search(
            [("employee_id", "=", employee_id), ("session_date", "=", session_date)]
        )
        ordered = sorted(records, key=lambda item: item.id or 0, reverse=True)
        return next((item for item in ordered if item.status == "open"), ordered[0] if ordered else None)

    def _build_evidence_payload(
        self,
        request: Request,
        payload: Dict[str, Any],
        event_at: datetime,
        employee: EmployeeProfile,
        policy: AttendancePolicy,
    ) -> Dict[str, Any]:
        headers = getattr(request, "headers", {}) or {}
        user = self.env.user
        device_fingerprint = str(payload.get("device_fingerprint") or "").strip()
        return {
            "captured_at_utc": ensure_utc_datetime(event_at).isoformat(),
            "captured_local_time": str(payload.get("device_local_time") or ""),
            "timezone": _tz_name(payload.get("timezone") or policy.timezone),
            "timezone_offset_minutes": _safe_int(payload.get("timezone_offset_minutes"), 0),
            "ip_address": str(headers.get("x-forwarded-for") or headers.get("x-real-ip") or request.ip_address or ""),
            "user_agent": str(headers.get("user-agent") or ""),
            "device_fingerprint": device_fingerprint,
            "geo_latitude": _safe_float(payload.get("geo_latitude")),
            "geo_longitude": _safe_float(payload.get("geo_longitude")),
            "geo_accuracy_meters": _safe_float(payload.get("geo_accuracy_meters")),
            "signature_name": str(payload.get("signature_name") or "").strip(),
            "signature_rut": str(payload.get("signature_rut") or "").strip(),
            "statement_accepted": _normalize_bool(payload.get("statement_accepted")),
            "statement_text": str(payload.get("statement_text") or policy.declaration_text or DEFAULT_DECLARATION_TEXT),
            "employee_id": employee.id,
            "employee_name": employee.full_name,
            "employee_code": employee.employee_code,
            "user_id": getattr(user, "id", None),
            "user_name": getattr(user, "name", None),
            "notes": str(payload.get("notes") or "").strip(),
            "legal_basis": policy.legal_basis,
        }

    def _recalculate_record(self, record: AttendanceRecord, policy: AttendancePolicy) -> AttendanceRecord:
        events = self._sorted_events_for_record(record.id)
        first_entry = next((item for item in events if item.event_type == "entry"), None)
        last_event = events[-1] if events else None
        break_open_at = None
        break_minutes = 0
        worked_minutes = 0
        flags: List[str] = []

        for index, event in enumerate(events):
            if event.event_type == "entry":
                next_pause = next((item for item in events[index + 1 :] if item.event_type in ("break_start", "exit")), None)
                if next_pause:
                    worked_minutes += _minutes_between(event.event_at, next_pause.event_at)
            elif event.event_type == "break_start":
                break_open_at = event.event_at
            elif event.event_type == "break_end":
                if break_open_at:
                    break_minutes += _minutes_between(break_open_at, event.event_at)
                    next_pause = next((item for item in events[index + 1 :] if item.event_type in ("break_start", "exit")), None)
                    if next_pause:
                        worked_minutes += _minutes_between(event.event_at, next_pause.event_at)
                    break_open_at = None

        if events:
            if events[-1].event_type == "entry":
                flags.append("open_shift_without_exit")
            if any(item.event_type == "break_start" for item in events) and break_open_at:
                flags.append("open_break_without_resume")
            if events[-1].event_type == "exit":
                record.status = "closed"
                record.closed_at = events[-1].event_at
            else:
                record.status = "open"
                record.closed_at = None
        else:
            record.status = "open"
            record.closed_at = None

        if break_minutes < _safe_int(policy.min_break_minutes, 30) and worked_minutes >= 300:
            flags.append("break_below_policy")

        late_minutes = 0
        if first_entry:
            try:
                tz = ZoneInfo(record.timezone or policy.timezone or DEFAULT_CHILE_TIMEZONE)
                local_entry = ensure_utc_datetime(first_entry.event_at).astimezone(tz)
                ref_hour, ref_minute = [int(part) for part in str(policy.standard_entry_time or "09:00").split(":", 1)]
                reference = local_entry.replace(hour=ref_hour, minute=ref_minute, second=0, microsecond=0)
                late_minutes = max(
                    0,
                    int((local_entry - reference).total_seconds() // 60) - _safe_int(policy.max_late_tolerance_minutes, 10),
                )
                if late_minutes > 0:
                    flags.append("late_arrival")
            except Exception:
                late_minutes = 0

        overtime_minutes = max(0, worked_minutes - _safe_int(policy.standard_daily_minutes, 540))
        legal_summary = {
            "declaration_last_text": record.legal_summary.get("declaration_last_text") if isinstance(record.legal_summary, dict) else None,
            "policy_timezone": policy.timezone,
            "retention_years": _safe_int(policy.retention_years, 5),
            "hash_chain_last_hash": record.signature_chain_last_hash,
            "audit_ready": True,
            "compliance_scope": "traceability",
        }

        record.first_entry_at = first_entry.event_at if first_entry else None
        record.last_event_at = last_event.event_at if last_event else None
        record.worked_minutes = worked_minutes
        record.break_minutes = break_minutes
        record.overtime_minutes = overtime_minutes
        record.late_minutes = late_minutes
        record.event_count = len(events)
        record.compliance_flags = sorted(set(flags))
        record.legal_summary = legal_summary
        record.save()
        return record

    async def get_policy(self, _: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        return Response.ok(self._active_policy().to_dict())

    async def update_policy(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        policy = self._active_policy()
        data = request.data or {}
        editable = {
            "name": "name",
            "timezone": "timezone",
            "standard_entry_time": "standard_entry_time",
            "standard_daily_minutes": "standard_daily_minutes",
            "max_late_tolerance_minutes": "max_late_tolerance_minutes",
            "min_break_minutes": "min_break_minutes",
            "requires_geolocation": "requires_geolocation",
            "requires_device_info": "requires_device_info",
            "declaration_text": "declaration_text",
            "legal_basis": "legal_basis",
            "retention_years": "retention_years",
        }
        for source_key, attr_name in editable.items():
            if source_key not in data:
                continue
            value = data.get(source_key)
            if source_key in {"standard_daily_minutes", "max_late_tolerance_minutes", "min_break_minutes", "retention_years"}:
                value = _safe_int(value, getattr(policy, attr_name))
            elif source_key in {"requires_geolocation", "requires_device_info"}:
                value = _normalize_bool(value, getattr(policy, attr_name))
            setattr(policy, attr_name, value)
        try:
            policy.save()
            return Response.ok(policy.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_employees(self, _: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        employees = EmployeeProfile.search(self._tenant_filter())
        results = [
            {
                "id": item.id,
                "employee_code": item.employee_code,
                "full_name": item.full_name,
                "status": item.status,
                "department_id": item.department_id,
                "position_title": item.position_title,
                "user_id": item.user_id,
            }
            for item in employees
            if item.status != "inactive"
        ]
        return Response.ok({"results": sorted(results, key=lambda item: (item.get("full_name") or "").lower())})

    async def list_records(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        records = AttendanceRecord.search(self._tenant_filter())
        date_filter = str(request.params.get("date") or "").strip() if getattr(request, "params", None) else ""
        employee_filter = _safe_int(request.params.get("employee_id"), None) if getattr(request, "params", None) else None
        if date_filter:
            records = [item for item in records if item.session_date == date_filter]
        if employee_filter:
            records = [item for item in records if item.employee_id == employee_filter]
        ordered = sorted(records, key=lambda item: (item.session_date or "", item.id or 0), reverse=True)
        return Response.ok({"results": [item.to_dict() for item in ordered[:120]]})

    async def get_record(self, _: Request, id: Any = None) -> Response:
        err = self._require_access()
        if err:
            return err
        record = AttendanceRecord.find_by_id(_safe_int(id))
        if not record or (self.env.user.role != "superadmin" and record.company_id != self._company_id()):
            return Response.not_found("Attendance record not found")
        events = [item.to_dict() for item in self._sorted_events_for_record(record.id)]
        return Response.ok({"record": record.to_dict(), "events": events})

    async def get_dashboard(self, _: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        policy = self._active_policy()
        records = AttendanceRecord.search(self._tenant_filter())
        events = AttendanceEvent.search(self._tenant_filter())
        employees = EmployeeProfile.search(self._tenant_filter())
        today_local = _local_date_from_event(utc_now(), policy.timezone)
        today_records = [item for item in records if item.session_date == today_local]
        active_records = [item for item in today_records if item.status == "open"]
        closed_records = [item for item in today_records if item.status == "closed"]
        late_records = [item for item in today_records if _safe_int(item.late_minutes, 0) > 0]
        current_employee = None
        current_record = None
        if self.env.user and self.env.user.role not in ("superadmin", "company_admin"):
            current_employee = next((item for item in employees if item.user_id == self.env.user.id), None)
            if current_employee:
                current_record = next(
                    (
                        item
                        for item in sorted(today_records, key=lambda row: row.id or 0, reverse=True)
                        if item.employee_id == current_employee.id
                    ),
                    None,
                )

        feed = sorted(
            [item for item in events if item.event_local_date == today_local],
            key=lambda item: (_fmt_dt(item.event_at) or "", item.id or 0),
            reverse=True,
        )[:12]

        return Response.ok(
            {
                "today": today_local,
                "stats": {
                    "registered_workers": len(today_records),
                    "active_shifts": len(active_records),
                    "closed_shifts": len(closed_records),
                    "late_arrivals": len(late_records),
                    "audit_events_today": len([item for item in events if item.event_local_date == today_local]),
                    "employees_total": len([item for item in employees if item.status != "inactive"]),
                },
                "current_employee": current_employee.to_dict() if current_employee else None,
                "current_record": current_record.to_dict() if current_record else None,
                "policy": policy.to_dict(),
                "recent_records": [item.to_dict() for item in sorted(today_records, key=lambda item: item.id or 0, reverse=True)[:8]],
                "audit_feed": [item.to_dict() for item in feed],
                "legal_notice": (
                    "Registro orientado a respaldo y trazabilidad de asistencia. "
                    "Su validez final depende de la operacion, evidencia capturada y cumplimiento normativo aplicable."
                ),
            }
        )

    async def register_punch(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        data = request.data or {}
        event_type = str(data.get("event_type") or "").strip()
        if event_type not in ATTENDANCE_EVENT_TYPES:
            return Response.bad_request("Invalid event type")
        if not _normalize_bool(data.get("statement_accepted")):
            return Response.bad_request("Worker declaration must be accepted before signing")
        signature_name = str(data.get("signature_name") or "").strip()
        if not signature_name:
            return Response.bad_request("Signature name is required")

        employee, employee_error = self._resolve_employee_for_request(data)
        if employee_error:
            return employee_error

        policy = self._active_policy()
        timezone_name = _tz_name(data.get("timezone") or policy.timezone)
        if policy.requires_geolocation and (
            _safe_float(data.get("geo_latitude")) is None or _safe_float(data.get("geo_longitude")) is None
        ):
            return Response.bad_request("This policy requires geolocation for attendance records")
        if policy.requires_device_info and not str(data.get("device_fingerprint") or "").strip():
            return Response.bad_request("This policy requires device information for attendance records")

        event_at = utc_now()
        device_local = _parse_iso_datetime(data.get("device_local_time"))
        local_dt = device_local
        if not local_dt:
            local_dt = ensure_utc_datetime(event_at).astimezone(ZoneInfo(timezone_name))
        session_date = str(data.get("session_date") or "")[:10] or local_dt.date().isoformat()

        record = self._find_open_record(employee.id, session_date)
        if event_type == "entry":
            if record and record.status == "open":
                return Response.bad_request("There is already an open attendance record for this worker today")
            if record and record.status == "closed":
                return Response.bad_request("Today's attendance record is already closed for this worker")
            record = AttendanceRecord.create(
                {
                    "company_id": employee.company_id,
                    "employee_id": employee.id,
                    "user_id": getattr(self.env.user, "id", None),
                    "session_date": session_date,
                    "timezone": timezone_name,
                    "status": "open",
                    "legal_summary": {},
                }
            )
        else:
            if not record:
                return Response.bad_request("No open attendance record exists for this worker on the selected date")
            if record.status != "open":
                return Response.bad_request("Attendance record is not open")

        existing_events = self._sorted_events_for_record(record.id)
        if existing_events:
            last_type = existing_events[-1].event_type
            invalid_transitions = {
                "entry": {"entry", "break_end"},
                "break_start": {"break_start", "exit"},
                "break_end": {"entry", "break_end", "exit"},
                "exit": {"break_start", "break_end", "exit"},
            }
            if event_type in invalid_transitions.get(last_type, set()):
                return Response.bad_request("Invalid attendance sequence for the selected event")
        elif event_type != "entry":
            return Response.bad_request("The first attendance event of the day must be an entry")

        evidence = self._build_evidence_payload(request, data, event_at, employee, policy)
        previous_hash = existing_events[-1].chain_hash if existing_events else ""
        payload_hash = _hash_payload(evidence)
        chain_hash = _hash_payload(
            {
                "record_id": record.id,
                "event_type": event_type,
                "event_at": ensure_utc_datetime(event_at).isoformat(),
                "payload_hash": payload_hash,
                "previous_hash": previous_hash,
            }
        )

        local_time_text = local_dt.time().replace(microsecond=0).isoformat()
        event = AttendanceEvent.create(
            {
                "company_id": employee.company_id,
                "record_id": record.id,
                "employee_id": employee.id,
                "user_id": getattr(self.env.user, "id", None),
                "event_type": event_type,
                "event_at": event_at,
                "event_local_date": session_date,
                "event_local_time": local_time_text,
                "timezone": timezone_name,
                "timezone_offset_minutes": _safe_int(data.get("timezone_offset_minutes"), 0),
                "ip_address": evidence.get("ip_address"),
                "user_agent": evidence.get("user_agent"),
                "device_fingerprint": evidence.get("device_fingerprint"),
                "geo_latitude": evidence.get("geo_latitude"),
                "geo_longitude": evidence.get("geo_longitude"),
                "geo_accuracy_meters": evidence.get("geo_accuracy_meters"),
                "signature_name": signature_name,
                "signature_rut": str(data.get("signature_rut") or "").strip(),
                "signer_statement": evidence.get("statement_text"),
                "event_notes": str(data.get("notes") or "").strip(),
                "evidence_payload": evidence,
                "payload_hash": payload_hash,
                "previous_hash": previous_hash,
                "chain_hash": chain_hash,
            }
        )

        record.signature_chain_last_hash = chain_hash
        record.last_signature_name = signature_name
        record.last_signature_rut = str(data.get("signature_rut") or "").strip()
        existing_legal = dict(record.legal_summary or {})
        existing_legal["declaration_last_text"] = evidence.get("statement_text")
        existing_legal["last_signed_at_utc"] = ensure_utc_datetime(event_at).isoformat()
        existing_legal["last_event_type"] = event_type
        existing_legal["worker_identification"] = {
            "signature_name": signature_name,
            "signature_rut": str(data.get("signature_rut") or "").strip(),
        }
        record.legal_summary = existing_legal
        record.save()
        record = self._recalculate_record(record, policy)

        return Response.created(
            {
                "message": "Attendance event registered successfully",
                "record": record.to_dict(),
                "event": event.to_dict(),
            }
        )
