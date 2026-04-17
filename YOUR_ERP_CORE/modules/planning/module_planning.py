"""
Financial planning and budget control module.

This module works as the FP&A / treasury layer of the ERP:
- Annual budget versions by scenario
- Monthly inflow/outflow lines by source, category and opportunity
- Consolidated plan vs actual vs committed vs projected cash flow
- Project-level margin view combining CRM, Billing and Expenses
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now, utc_strftime


MONTHS: List[Tuple[str, str]] = [
    ("01", "Ene"),
    ("02", "Feb"),
    ("03", "Mar"),
    ("04", "Abr"),
    ("05", "May"),
    ("06", "Jun"),
    ("07", "Jul"),
    ("08", "Ago"),
    ("09", "Sep"),
    ("10", "Oct"),
    ("11", "Nov"),
    ("12", "Dic"),
]

BUDGET_SCENARIOS: Dict[str, str] = {
    "base": "Presupuesto base",
    "forecast": "Forecast / Reforecast",
    "optimistic": "Escenario optimista",
    "conservative": "Escenario conservador",
}

BUDGET_STATUSES: Dict[str, str] = {
    "draft": "Borrador",
    "active": "Activo",
    "closed": "Cerrado",
}

FLOW_TYPES: Dict[str, str] = {
    "inflow": "Entrada",
    "outflow": "Salida",
}

ORIGIN_TYPES: Dict[str, str] = {
    "crm_pipeline": "Pipeline CRM",
    "billing_collections": "Facturacion / cobranza",
    "project_expenses": "Egresos de oportunidad",
    "opex": "Gasto operacional",
    "payroll": "Remuneraciones",
    "capex": "Inversiones / CAPEX",
    "financing": "Financiamiento / aportes",
    "manual": "Carga manual",
}

DEFAULT_INFLOW_CATEGORY = "Ingresos operacionales"
DEFAULT_OUTFLOW_CATEGORY = "Egresos operacionales"


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


def _safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _round_money(value: Any) -> float:
    return round(_safe_float(value), 0)


def _parse_date(value: Any, fallback: Optional[date] = None) -> Optional[date]:
    if value in (None, ""):
        return fallback
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = _clean_str(value)
    if not text:
        return fallback
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        try:
            return datetime.fromisoformat(text.replace("Z", "")).date()
        except ValueError:
            return fallback


def _month_key(value: Any, fallback_month: str = "01") -> str:
    parsed = _parse_date(value)
    if parsed:
        return f"{parsed.month:02d}"
    candidate = _clean_str(value)
    if len(candidate) >= 7 and candidate[5:7].isdigit():
        month = candidate[5:7]
        if month in dict(MONTHS):
            return month
    return fallback_month if fallback_month in dict(MONTHS) else "01"


def _year_from_date(value: Any, fallback: Optional[int] = None) -> Optional[int]:
    parsed = _parse_date(value)
    if parsed:
        return parsed.year
    candidate = _clean_str(value)
    if len(candidate) >= 4 and candidate[:4].isdigit():
        return int(candidate[:4])
    return fallback


def _normalize_month(value: Any, default: str) -> str:
    parsed = _safe_int(value)
    if parsed is None:
        return default
    month = f"{max(1, min(12, parsed)):02d}"
    return month if month in dict(MONTHS) else default


def _normalize_month_amounts(value: Any) -> Dict[str, float]:
    payload = value if isinstance(value, dict) else {}
    result: Dict[str, float] = {}
    for month, _label in MONTHS:
        result[month] = max(_round_money(payload.get(month, 0.0)), 0.0)
    return result


def _spread_amount_over_months(total_amount: Any, start_month: Any, end_month: Any) -> Dict[str, float]:
    total = max(_round_money(total_amount), 0.0)
    first = _safe_int(_normalize_month(start_month, "01"), 1) or 1
    last = _safe_int(_normalize_month(end_month, "12"), 12) or 12
    if last < first:
        first, last = last, first

    span = max((last - first) + 1, 1)
    base_value = _round_money(total / span)
    amounts = {month: 0.0 for month, _label in MONTHS}
    allocated = 0.0
    for month_number in range(first, last + 1):
        key = f"{month_number:02d}"
        value = base_value
        if month_number == last:
            value = max(_round_money(total - allocated), 0.0)
        amounts[key] = value
        allocated += value
    return _normalize_month_amounts(amounts)


def _line_annual_total(month_amounts: Any) -> float:
    amounts = _normalize_month_amounts(month_amounts)
    return _round_money(sum(amounts.values()))


def _line_forecast_source(plan_amounts: Any, forecast_amounts: Any) -> Dict[str, float]:
    normalized_forecast = _normalize_month_amounts(forecast_amounts)
    if any(amount > 0 for amount in normalized_forecast.values()):
        return normalized_forecast
    return _normalize_month_amounts(plan_amounts)


def _resolve_lead_context(lead_id: Optional[int]) -> Dict[str, Any]:
    if not lead_id:
        return {
            "lead_id": None,
            "lead_title": "",
            "project_code": "",
            "customer_name": "",
            "lead_probability": 0,
            "expected_revenue": 0.0,
        }

    try:
        from modules.crm.module_crm import Customer, Lead

        lead = Lead.find_by_id(int(lead_id))
        if not lead:
            return {
                "lead_id": lead_id,
                "lead_title": "",
                "project_code": "",
                "customer_name": "",
                "lead_probability": 0,
                "expected_revenue": 0.0,
            }

        customer = Customer.find_by_id(lead.customer_id) if lead.customer_id else None
        return {
            "lead_id": lead.id,
            "lead_title": lead.title or "",
            "project_code": getattr(lead, "project_code", "") or "",
            "customer_name": customer.name if customer else "",
            "lead_probability": _safe_int(getattr(lead, "probability", 0), 0) or 0,
            "expected_revenue": _round_money(getattr(lead, "expected_revenue", 0.0)),
        }
    except Exception:
        return {
            "lead_id": lead_id,
            "lead_title": "",
            "project_code": "",
            "customer_name": "",
            "lead_probability": 0,
            "expected_revenue": 0.0,
        }


class PlanningBudget(BaseModel, AuditMixin):
    __tablename__ = "planning_budgets"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Budget Name")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    year = Column(ColumnType.INTEGER, required=True, label="Year")
    scenario_type = Column(ColumnType.STRING, default="base", label="Scenario")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    opening_cash = Column(ColumnType.FLOAT, default=0.0, label="Opening Cash")
    notes = Column(ColumnType.TEXT, label="Notes")
    created_by_user_id = Column(ColumnType.INTEGER, label="Created By")

    def before_create(self):
        if not _clean_str(self.name):
            self.name = utc_strftime("Presupuesto %Y")
        if not _safe_int(self.year):
            self.year = utc_now().year

    def validate(self):
        super().validate()
        self.name = _clean_str(self.name)
        self.year = _safe_int(self.year, utc_now().year) or utc_now().year
        self.scenario_type = _clean_str(self.scenario_type, "base")
        self.status = _clean_str(self.status, "draft")
        self.notes = _clean_str(self.notes)
        self.created_by_user_id = _safe_int(self.created_by_user_id)
        self.opening_cash = _round_money(self.opening_cash)

        if not self.name:
            raise ValidationError("Budget name is required")
        if self.year < 2000 or self.year > 2100:
            raise ValidationError("Budget year must be between 2000 and 2100")
        if self.scenario_type not in BUDGET_SCENARIOS:
            raise ValidationError(
                f"Scenario must be one of: {', '.join(BUDGET_SCENARIOS.keys())}"
            )
        if self.status not in BUDGET_STATUSES:
            raise ValidationError(
                f"Status must be one of: {', '.join(BUDGET_STATUSES.keys())}"
            )

        duplicates = PlanningBudget.search(
            [
                ("company_id", "=", self.company_id),
                ("year", "=", self.year),
                ("name", "=", self.name),
            ]
        )
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Another budget with the same name already exists for this year")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name or "",
            "company_id": self.company_id,
            "year": _safe_int(self.year, utc_now().year) or utc_now().year,
            "scenario_type": self.scenario_type or "base",
            "scenario_label": BUDGET_SCENARIOS.get(self.scenario_type or "base", self.scenario_type or "base"),
            "status": self.status or "draft",
            "status_label": BUDGET_STATUSES.get(self.status or "draft", self.status or "draft"),
            "opening_cash": _round_money(self.opening_cash),
            "notes": self.notes or "",
            "created_by_user_id": self.created_by_user_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
            "is_editable": (self.status or "draft") != "closed",
        }


class PlanningBudgetLine(BaseModel, AuditMixin):
    __tablename__ = "planning_budget_lines"
    __displayname__ = "line_name"

    budget_id = Column(ColumnType.INTEGER, required=True, label="Budget")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    line_type = Column(ColumnType.STRING, default="outflow", label="Flow Type")
    origin_type = Column(ColumnType.STRING, default="manual", label="Origin Type")
    line_name = Column(ColumnType.STRING, required=True, label="Line Name")
    category = Column(ColumnType.STRING, default=DEFAULT_OUTFLOW_CATEGORY, label="Category")
    cost_center = Column(ColumnType.STRING, label="Cost Center")
    lead_id = Column(ColumnType.INTEGER, label="Opportunity")
    month_start = Column(ColumnType.STRING, default="01", label="Start Month")
    month_end = Column(ColumnType.STRING, default="12", label="End Month")
    planned_amounts = Column(ColumnType.JSON, default={}, label="Planned Monthly Amounts")
    forecast_amounts = Column(ColumnType.JSON, default={}, label="Forecast Monthly Amounts")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        self.line_type = _clean_str(self.line_type, "outflow")
        self.origin_type = _clean_str(self.origin_type, "manual")
        self.line_name = _clean_str(self.line_name)
        self.category = _clean_str(
            self.category,
            DEFAULT_INFLOW_CATEGORY if self.line_type == "inflow" else DEFAULT_OUTFLOW_CATEGORY,
        )
        self.cost_center = _clean_str(self.cost_center)
        self.month_start = _normalize_month(self.month_start, "01")
        self.month_end = _normalize_month(self.month_end, "12")
        self.planned_amounts = _normalize_month_amounts(self.planned_amounts)
        self.forecast_amounts = _normalize_month_amounts(self.forecast_amounts)
        self.notes = _clean_str(self.notes)
        self.lead_id = _safe_int(self.lead_id)

        if self.line_type not in FLOW_TYPES:
            raise ValidationError(f"Flow type must be one of: {', '.join(FLOW_TYPES.keys())}")
        if self.origin_type not in ORIGIN_TYPES:
            raise ValidationError(
                f"Origin type must be one of: {', '.join(ORIGIN_TYPES.keys())}"
            )
        if not self.line_name:
            raise ValidationError("Line name is required")
        if _line_annual_total(self.planned_amounts) <= 0 and _line_annual_total(self.forecast_amounts) <= 0:
            raise ValidationError("At least one monthly planned or forecast amount must be greater than zero")

    def to_dict(self) -> Dict[str, Any]:
        lead_context = _resolve_lead_context(self.lead_id)
        planned_amounts = _normalize_month_amounts(self.planned_amounts)
        forecast_amounts = _line_forecast_source(self.planned_amounts, self.forecast_amounts)
        return {
            "id": self.id,
            "budget_id": self.budget_id,
            "company_id": self.company_id,
            "line_type": self.line_type or "outflow",
            "line_type_label": FLOW_TYPES.get(self.line_type or "outflow", self.line_type or "outflow"),
            "origin_type": self.origin_type or "manual",
            "origin_type_label": ORIGIN_TYPES.get(self.origin_type or "manual", self.origin_type or "manual"),
            "line_name": self.line_name or "",
            "category": self.category or "",
            "cost_center": self.cost_center or "",
            "lead_id": self.lead_id,
            "lead_title": lead_context["lead_title"],
            "project_code": lead_context["project_code"],
            "customer_name": lead_context["customer_name"],
            "month_start": self.month_start or "01",
            "month_end": self.month_end or "12",
            "planned_amounts": planned_amounts,
            "forecast_amounts": forecast_amounts,
            "annual_planned_total": _line_annual_total(planned_amounts),
            "annual_forecast_total": _line_annual_total(forecast_amounts),
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class PlanningModule(BaseModule):
    name = "Planning"
    version = "1.0.0"
    author = "Your Company"
    description = "Annual planning, budget control and projected cash flow"
    depends = ["base", "crm", "billing", "expenses"]

    def init_module(self):
        self.register_model("planning.budget", PlanningBudget)
        self.register_model("planning.budget_line", PlanningBudgetLine)

        self.register_route("/planning/reference-data", self.get_reference_data, methods=["GET"], auth_required=True)
        self.register_route("/planning/dashboard", self.get_dashboard, methods=["GET"], auth_required=True)

        self.register_route("/planning/budgets", self.list_budgets, methods=["GET"], auth_required=True)
        self.register_route("/planning/budgets", self.create_budget, methods=["POST"], auth_required=True)
        self.register_route(
            "/planning/budgets/{id}/lines",
            self.create_budget_line,
            methods=["POST"],
            auth_required=True,
        )
        self.register_route("/planning/budgets/{id}", self.get_budget, methods=["GET"], auth_required=True)
        self.register_route("/planning/budgets/{id}", self.update_budget, methods=["PUT"], auth_required=True)
        self.register_route("/planning/budgets/{id}", self.delete_budget, methods=["DELETE"], auth_required=True)
        self.register_route("/planning/lines/{id}", self.update_budget_line, methods=["PUT"], auth_required=True)
        self.register_route("/planning/lines/{id}", self.delete_budget_line, methods=["DELETE"], auth_required=True)

        self.logger.info("Planning module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _tenant_filter(self) -> List[Tuple[str, str, Any]]:
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
        return bool({"finance", "billing", "expenses", "planning"} & allowed)

    def _require_access(self) -> Optional[Response]:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._user_has_access():
            return Response.forbidden("No tienes acceso al modulo de Planificacion y Presupuestos")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        if self.env.user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Solo administradores pueden modificar o eliminar presupuestos")
        return None

    def _budgets(self, year: Optional[int] = None) -> List[PlanningBudget]:
        domain = self._tenant_filter()
        if year:
            domain.append(("year", "=", year))
        rows = PlanningBudget.search(domain)
        rows.sort(
            key=lambda row: (
                _safe_int(row.year, 0) or 0,
                1 if _clean_str(row.status) == "active" else 0,
                row.id or 0,
            ),
            reverse=True,
        )
        return rows

    def _budget_lines(self, budget_id: int) -> List[PlanningBudgetLine]:
        rows = PlanningBudgetLine.search(
            [*self._tenant_filter(), ("budget_id", "=", budget_id)]
        )
        rows.sort(key=lambda row: (row.line_type or "", row.origin_type or "", row.id or 0))
        return rows

    def _budget_or_404(self, budget_id: Any) -> Tuple[Optional[PlanningBudget], Optional[Response]]:
        parsed_id = _safe_int(budget_id)
        if not parsed_id:
            return None, Response.not_found("Presupuesto no encontrado")
        budget = PlanningBudget.find_by_id(parsed_id)
        if not budget:
            return None, Response.not_found("Presupuesto no encontrado")
        if self.env.user and self.env.user.role != "superadmin" and budget.company_id != self._company_id():
            return None, Response.not_found("Presupuesto no encontrado")
        return budget, None

    def _line_or_404(self, line_id: Any) -> Tuple[Optional[PlanningBudgetLine], Optional[Response]]:
        parsed_id = _safe_int(line_id)
        if not parsed_id:
            return None, Response.not_found("Linea presupuestaria no encontrada")
        line = PlanningBudgetLine.find_by_id(parsed_id)
        if not line:
            return None, Response.not_found("Linea presupuestaria no encontrada")
        if self.env.user and self.env.user.role != "superadmin" and line.company_id != self._company_id():
            return None, Response.not_found("Linea presupuestaria no encontrada")
        return line, None

    def _set_only_one_active_budget(self, current_budget: PlanningBudget) -> None:
        if _clean_str(current_budget.status) != "active":
            return
        for budget in PlanningBudget.search(
            [
                ("company_id", "=", current_budget.company_id),
                ("year", "=", current_budget.year),
                ("status", "=", "active"),
            ]
        ):
            if budget.id == current_budget.id:
                continue
            budget.status = "draft"
            budget.save()

    def _build_reference_data(self) -> Dict[str, Any]:
        leads: List[Dict[str, Any]] = []
        categories = {
            DEFAULT_INFLOW_CATEGORY,
            DEFAULT_OUTFLOW_CATEGORY,
            "Ingresos por proyecto",
            "Gastos de subcontrato",
            "Materiales e insumos",
            "Combustible y traslados",
            "Gastos administrativos",
            "Remuneraciones",
            "Inversiones",
        }
        cost_centers = {"General", "Operaciones", "Administracion", "Terreno", "Proyectos"}

        try:
            from modules.crm.module_crm import Lead

            lead_rows = Lead.search(self._tenant_filter())
            lead_rows.sort(key=lambda row: row.id or 0, reverse=True)
            leads = [_resolve_lead_context(row.id) for row in lead_rows[:250]]
            for row in leads:
                if row["project_code"]:
                    cost_centers.add(row["project_code"])
        except Exception:
            leads = []

        try:
            from modules.expenses.module_expenses import DEFAULT_EXPENSE_CATEGORIES, ExpenseRecord

            categories.update(DEFAULT_EXPENSE_CATEGORIES)
            for expense in ExpenseRecord.search(self._tenant_filter()):
                if _clean_str(expense.category):
                    categories.add(_clean_str(expense.category))
        except Exception:
            pass

        return {
            "months": [{"code": code, "label": label} for code, label in MONTHS],
            "scenario_types": [
                {"code": code, "label": label}
                for code, label in BUDGET_SCENARIOS.items()
            ],
            "statuses": [
                {"code": code, "label": label}
                for code, label in BUDGET_STATUSES.items()
            ],
            "flow_types": [
                {"code": code, "label": label}
                for code, label in FLOW_TYPES.items()
            ],
            "origin_types": [
                {"code": code, "label": label}
                for code, label in ORIGIN_TYPES.items()
            ],
            "categories": sorted(categories),
            "cost_centers": sorted(cost_centers),
            "leads": leads,
        }

    def _ensure_project_bucket(
        self,
        buckets: Dict[str, Dict[str, Any]],
        lead_id: Optional[int],
        fallback_title: str = "",
    ) -> Dict[str, Any]:
        key = f"lead:{lead_id}" if lead_id else f"general:{fallback_title or 'empresa'}"
        if key not in buckets:
            lead_context = _resolve_lead_context(lead_id)
            buckets[key] = {
                "bucket_key": key,
                "lead_id": lead_context["lead_id"],
                "project_code": lead_context["project_code"],
                "lead_title": lead_context["lead_title"] or fallback_title or "Bolson general",
                "customer_name": lead_context["customer_name"],
                "planned_inflow": 0.0,
                "planned_outflow": 0.0,
                "forecast_inflow": 0.0,
                "forecast_outflow": 0.0,
                "pipeline_weighted": 0.0,
                "billed_total": 0.0,
                "collected_total": 0.0,
                "expenses_total": 0.0,
                "pending_collections": 0.0,
                "margin_plan": 0.0,
                "margin_real": 0.0,
                "margin_booked": 0.0,
                "expense_count": 0,
            }
        return buckets[key]

    def _ensure_origin_bucket(
        self,
        buckets: Dict[str, Dict[str, Any]],
        origin_type: str,
    ) -> Dict[str, Any]:
        origin_code = _clean_str(origin_type, "manual")
        bucket = buckets.setdefault(
            origin_code,
            {
                "origin_type": origin_code,
                "origin_label": ORIGIN_TYPES.get(origin_code, origin_code),
                "plan_inflow": 0.0,
                "plan_outflow": 0.0,
                "forecast_inflow": 0.0,
                "forecast_outflow": 0.0,
                "actual_inflow": 0.0,
                "actual_outflow": 0.0,
                "committed_inflow": 0.0,
                "pipeline_inflow": 0.0,
            },
        )
        return bucket

    def _line_payload_from_request(
        self,
        data: Dict[str, Any],
        existing_line: Optional[PlanningBudgetLine] = None,
    ) -> Dict[str, Any]:
        line_type = _clean_str(
            data.get("line_type"),
            getattr(existing_line, "line_type", "outflow") if existing_line else "outflow",
        )
        origin_type = _clean_str(
            data.get("origin_type"),
            getattr(existing_line, "origin_type", "manual") if existing_line else "manual",
        )
        line_name = _clean_str(
            data.get("line_name"),
            getattr(existing_line, "line_name", "") if existing_line else "",
        )
        category = _clean_str(
            data.get("category"),
            getattr(existing_line, "category", "") if existing_line else "",
        )
        cost_center = _clean_str(
            data.get("cost_center"),
            getattr(existing_line, "cost_center", "") if existing_line else "",
        )
        lead_id = _safe_int(
            data.get("lead_id"),
            getattr(existing_line, "lead_id", None) if existing_line else None,
        )
        month_start = _normalize_month(
            data.get("month_start"),
            getattr(existing_line, "month_start", "01") if existing_line else "01",
        )
        month_end = _normalize_month(
            data.get("month_end"),
            getattr(existing_line, "month_end", "12") if existing_line else "12",
        )
        notes = _clean_str(
            data.get("notes"),
            getattr(existing_line, "notes", "") if existing_line else "",
        )

        if isinstance(data.get("planned_amounts"), dict):
            planned_amounts = _normalize_month_amounts(data.get("planned_amounts"))
        else:
            planned_amounts = _spread_amount_over_months(
                data.get("annual_planned_total"),
                month_start,
                month_end,
            )

        if isinstance(data.get("forecast_amounts"), dict):
            forecast_amounts = _normalize_month_amounts(data.get("forecast_amounts"))
        elif "annual_forecast_total" in data and data.get("annual_forecast_total") not in (None, ""):
            forecast_amounts = _spread_amount_over_months(
                data.get("annual_forecast_total"),
                month_start,
                month_end,
            )
        else:
            forecast_amounts = _normalize_month_amounts(
                getattr(existing_line, "forecast_amounts", {}) if existing_line else {}
            )

        return {
            "line_type": line_type,
            "origin_type": origin_type,
            "line_name": line_name,
            "category": category,
            "cost_center": cost_center,
            "lead_id": lead_id,
            "month_start": month_start,
            "month_end": month_end,
            "planned_amounts": planned_amounts,
            "forecast_amounts": forecast_amounts,
            "notes": notes,
        }

    def _build_budget_payload(self, budget: PlanningBudget) -> Dict[str, Any]:
        lines = [line.to_dict() for line in self._budget_lines(budget.id)]
        payload = budget.to_dict()
        payload["lines"] = lines
        payload["annual_plan_inflow"] = _round_money(
            sum(line["annual_planned_total"] for line in lines if line["line_type"] == "inflow")
        )
        payload["annual_plan_outflow"] = _round_money(
            sum(line["annual_planned_total"] for line in lines if line["line_type"] == "outflow")
        )
        payload["annual_forecast_inflow"] = _round_money(
            sum(line["annual_forecast_total"] for line in lines if line["line_type"] == "inflow")
        )
        payload["annual_forecast_outflow"] = _round_money(
            sum(line["annual_forecast_total"] for line in lines if line["line_type"] == "outflow")
        )
        payload["lines_count"] = len(lines)
        return payload

    def _collect_quote_to_lead_map(self) -> Dict[int, int]:
        quote_to_lead: Dict[int, int] = {}
        try:
            from modules.quotes.module_quotes import Quote

            for quote in Quote.search(self._tenant_filter()):
                if quote.id and quote.lead_id:
                    quote_to_lead[quote.id] = quote.lead_id
        except Exception:
            quote_to_lead = {}
        return quote_to_lead

    def _empty_month_rows(self) -> Dict[str, Dict[str, Any]]:
        return {
            code: {
                "month": code,
                "label": label,
                "plan_inflow": 0.0,
                "plan_outflow": 0.0,
                "forecast_inflow": 0.0,
                "forecast_outflow": 0.0,
                "actual_inflow": 0.0,
                "actual_outflow": 0.0,
                "committed_inflow": 0.0,
                "pipeline_inflow": 0.0,
                "projected_inflow": 0.0,
                "projected_outflow": 0.0,
                "plan_net": 0.0,
                "actual_net": 0.0,
                "projected_net": 0.0,
                "plan_balance": 0.0,
                "actual_balance": 0.0,
                "projected_balance": 0.0,
            }
            for code, label in MONTHS
        }

    def _apply_budget_lines(
        self,
        budget_lines: List[PlanningBudgetLine],
        monthly_rows: Dict[str, Dict[str, Any]],
        project_buckets: Dict[str, Dict[str, Any]],
        origin_buckets: Dict[str, Dict[str, Any]],
    ) -> None:
        for line in budget_lines:
            payload = line.to_dict()
            project_bucket = self._ensure_project_bucket(
                project_buckets,
                payload.get("lead_id"),
                payload.get("cost_center") or payload.get("line_name"),
            )
            origin_bucket = self._ensure_origin_bucket(origin_buckets, payload.get("origin_type"))
            planned_amounts = _normalize_month_amounts(payload.get("planned_amounts"))
            forecast_amounts = _normalize_month_amounts(payload.get("forecast_amounts"))

            for month, _label in MONTHS:
                plan_value = _round_money(planned_amounts.get(month, 0.0))
                forecast_value = _round_money(forecast_amounts.get(month, 0.0))
                row = monthly_rows[month]
                if payload.get("line_type") == "inflow":
                    row["plan_inflow"] += plan_value
                    row["forecast_inflow"] += forecast_value
                    project_bucket["planned_inflow"] += plan_value
                    project_bucket["forecast_inflow"] += forecast_value
                    origin_bucket["plan_inflow"] += plan_value
                    origin_bucket["forecast_inflow"] += forecast_value
                else:
                    row["plan_outflow"] += plan_value
                    row["forecast_outflow"] += forecast_value
                    project_bucket["planned_outflow"] += plan_value
                    project_bucket["forecast_outflow"] += forecast_value
                    origin_bucket["plan_outflow"] += plan_value
                    origin_bucket["forecast_outflow"] += forecast_value

    def _collect_execution_sources(
        self,
        year: int,
        monthly_rows: Dict[str, Dict[str, Any]],
        project_buckets: Dict[str, Dict[str, Any]],
        origin_buckets: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        stats = {
            "expenses_records_total": 0,
            "billing_documents_total": 0,
            "payment_events_total": 0,
            "pipeline_open_total": 0,
            "overdue_documents_total": 0,
            "overdue_amount_total": 0.0,
        }

        quote_to_lead = self._collect_quote_to_lead_map()
        docs_by_id: Dict[int, Any] = {}

        try:
            from modules.expenses.module_expenses import ExpenseRecord

            for expense in ExpenseRecord.search(self._tenant_filter()):
                if _year_from_date(expense.expense_date) != year:
                    continue
                month = _month_key(expense.expense_date)
                amount = _round_money(expense.total_amount)
                monthly_rows[month]["actual_outflow"] += amount
                stats["expenses_records_total"] += 1

                project_bucket = self._ensure_project_bucket(
                    project_buckets,
                    _safe_int(expense.lead_id),
                    _clean_str(expense.category, "Gasto general"),
                )
                project_bucket["expenses_total"] += amount
                project_bucket["expense_count"] += 1

                origin_type = "project_expenses" if expense.lead_id else "opex"
                origin_bucket = self._ensure_origin_bucket(origin_buckets, origin_type)
                origin_bucket["actual_outflow"] += amount
        except Exception as exc:
            self.logger.warning("Planning expense aggregation failed: %s", exc)

        try:
            from modules.billing.module_billing import BillingDocument, BillingEvent, DOCUMENT_TYPES

            documents = BillingDocument.search(self._tenant_filter())
            docs_by_id = {document.id: document for document in documents if document.id}

            for document in documents:
                stats["billing_documents_total"] += 1
                lead_id = quote_to_lead.get(_safe_int(document.source_quote_id) or 0)
                project_bucket = self._ensure_project_bucket(
                    project_buckets,
                    lead_id,
                    _clean_str(document.customer_name, "Facturacion manual"),
                )

                doc_meta = DOCUMENT_TYPES.get(document.document_type or "33", DOCUMENT_TYPES["33"])
                supports_payment = bool(doc_meta.get("supports_payment"))
                sign = -1 if _clean_str(document.document_type) == "61" else 1
                status = _clean_str(document.status, "draft")
                sii_status = _clean_str(document.sii_status, "not_sent")
                payment_status = _clean_str(document.payment_status, "pending")

                if status not in ("draft", "rejected", "cancelled") and _year_from_date(document.issue_date) == year:
                    billed_amount = _round_money(sign * _safe_float(document.total_amount))
                    if billed_amount > 0:
                        project_bucket["billed_total"] += billed_amount

                if (
                    supports_payment
                    and status not in ("draft", "rejected", "cancelled")
                    and sii_status == "accepted"
                    and _safe_float(document.balance_due) > 0
                    and _year_from_date(document.due_date) == year
                ):
                    month = _month_key(document.due_date)
                    pending_amount = _round_money(document.balance_due)
                    monthly_rows[month]["committed_inflow"] += pending_amount
                    project_bucket["pending_collections"] += pending_amount
                    self._ensure_origin_bucket(origin_buckets, "billing_collections")["committed_inflow"] += pending_amount

                if payment_status == "overdue" and _safe_float(document.balance_due) > 0:
                    stats["overdue_documents_total"] += 1
                    stats["overdue_amount_total"] += _round_money(document.balance_due)

            for event in BillingEvent.search(self._tenant_filter()):
                if _clean_str(event.event_type) != "payment_registered":
                    continue
                stats["payment_events_total"] += 1
                event_payload = event.payload if isinstance(event.payload, dict) else {}
                event_date = event_payload.get("payment_date") or event.occurred_at
                if _year_from_date(event_date) != year:
                    continue
                month = _month_key(event_date)
                amount = _round_money(event_payload.get("amount"))
                if amount <= 0:
                    continue
                monthly_rows[month]["actual_inflow"] += amount
                self._ensure_origin_bucket(origin_buckets, "billing_collections")["actual_inflow"] += amount

                document = docs_by_id.get(_safe_int(event.document_id) or 0)
                lead_id = quote_to_lead.get(_safe_int(document.source_quote_id) or 0) if document else None
                project_bucket = self._ensure_project_bucket(
                    project_buckets,
                    lead_id,
                    _clean_str(getattr(document, "customer_name", ""), "Cobranza manual"),
                )
                project_bucket["collected_total"] += amount
        except Exception as exc:
            self.logger.warning("Planning billing aggregation failed: %s", exc)

        try:
            from modules.crm.module_crm import Lead

            for lead in Lead.search(self._tenant_filter()):
                if _clean_str(lead.status, "open") != "open":
                    continue
                lead_year = _year_from_date(
                    getattr(lead, "quote_deadline", None)
                    or getattr(lead, "visit_date", None)
                    or lead._data.get("created_at"),
                    fallback=year,
                )
                if lead_year != year:
                    continue
                weighted_amount = _round_money(
                    _safe_float(getattr(lead, "expected_revenue", 0.0))
                    * ((_safe_int(getattr(lead, "probability", 0), 0) or 0) / 100)
                )
                if weighted_amount <= 0:
                    continue

                month = _month_key(
                    getattr(lead, "quote_deadline", None)
                    or getattr(lead, "visit_date", None)
                    or lead._data.get("created_at"),
                    fallback_month="12",
                )
                monthly_rows[month]["pipeline_inflow"] += weighted_amount
                stats["pipeline_open_total"] += 1

                project_bucket = self._ensure_project_bucket(project_buckets, lead.id, lead.title or "Oportunidad")
                project_bucket["pipeline_weighted"] += weighted_amount
                self._ensure_origin_bucket(origin_buckets, "crm_pipeline")["pipeline_inflow"] += weighted_amount
        except Exception as exc:
            self.logger.warning("Planning CRM aggregation failed: %s", exc)

        stats["overdue_amount_total"] = _round_money(stats["overdue_amount_total"])
        return stats

    def _finalize_monthly_projection(
        self,
        monthly_rows: Dict[str, Dict[str, Any]],
        opening_cash: float,
        year: int,
    ) -> List[Dict[str, Any]]:
        plan_balance = _round_money(opening_cash)
        actual_balance = _round_money(opening_cash)
        projected_balance = _round_money(opening_cash)
        today = utc_now().date()
        current_month = today.month if today.year == year else 0 if year < today.year else 13

        rows: List[Dict[str, Any]] = []
        for month, _label in MONTHS:
            row = monthly_rows[month]
            month_number = _safe_int(month, 1) or 1

            row["plan_inflow"] = _round_money(row["plan_inflow"])
            row["plan_outflow"] = _round_money(row["plan_outflow"])
            row["forecast_inflow"] = _round_money(row["forecast_inflow"])
            row["forecast_outflow"] = _round_money(row["forecast_outflow"])
            row["actual_inflow"] = _round_money(row["actual_inflow"])
            row["actual_outflow"] = _round_money(row["actual_outflow"])
            row["committed_inflow"] = _round_money(row["committed_inflow"])
            row["pipeline_inflow"] = _round_money(row["pipeline_inflow"])

            if month_number < current_month:
                row["projected_inflow"] = row["actual_inflow"]
                row["projected_outflow"] = row["actual_outflow"]
            elif month_number == current_month:
                row["projected_inflow"] = _round_money(
                    row["actual_inflow"] + row["committed_inflow"] + row["pipeline_inflow"]
                )
                row["projected_outflow"] = _round_money(
                    row["actual_outflow"] + max(row["forecast_outflow"] - row["actual_outflow"], 0.0)
                )
            else:
                row["projected_inflow"] = _round_money(
                    row["forecast_inflow"] + row["committed_inflow"] + row["pipeline_inflow"]
                )
                row["projected_outflow"] = row["forecast_outflow"]

            row["plan_net"] = _round_money(row["plan_inflow"] - row["plan_outflow"])
            row["actual_net"] = _round_money(row["actual_inflow"] - row["actual_outflow"])
            row["projected_net"] = _round_money(row["projected_inflow"] - row["projected_outflow"])

            plan_balance = _round_money(plan_balance + row["plan_net"])
            actual_balance = _round_money(actual_balance + row["actual_net"])
            projected_balance = _round_money(projected_balance + row["projected_net"])

            row["plan_balance"] = plan_balance
            row["actual_balance"] = actual_balance
            row["projected_balance"] = projected_balance
            row["execution_gap"] = _round_money(row["actual_net"] - row["plan_net"])
            rows.append(row)

        return rows

    def _finalize_project_rows(self, project_buckets: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for row in project_buckets.values():
            row["planned_inflow"] = _round_money(row["planned_inflow"])
            row["planned_outflow"] = _round_money(row["planned_outflow"])
            row["forecast_inflow"] = _round_money(row["forecast_inflow"])
            row["forecast_outflow"] = _round_money(row["forecast_outflow"])
            row["pipeline_weighted"] = _round_money(row["pipeline_weighted"])
            row["billed_total"] = _round_money(row["billed_total"])
            row["collected_total"] = _round_money(row["collected_total"])
            row["expenses_total"] = _round_money(row["expenses_total"])
            row["pending_collections"] = _round_money(row["pending_collections"])
            row["margin_plan"] = _round_money(row["planned_inflow"] - row["planned_outflow"])
            row["margin_real"] = _round_money(row["collected_total"] - row["expenses_total"])
            row["margin_booked"] = _round_money(row["billed_total"] - row["expenses_total"])
            row["expense_ratio"] = round(
                (row["expenses_total"] / row["planned_outflow"]) * 100,
                1,
            ) if row["planned_outflow"] > 0 else 0.0
            row["collection_ratio"] = round(
                (row["collected_total"] / row["billed_total"]) * 100,
                1,
            ) if row["billed_total"] > 0 else 0.0
            if (
                row["lead_id"]
                or row["planned_inflow"]
                or row["planned_outflow"]
                or row["expenses_total"]
                or row["billed_total"]
                or row["pipeline_weighted"]
            ):
                results.append(row)

        results.sort(
            key=lambda item: (
                -(
                    _safe_float(item["expenses_total"])
                    + _safe_float(item["pipeline_weighted"])
                    + _safe_float(item["billed_total"])
                ),
                (item["project_code"] or item["lead_title"] or "").lower(),
            )
        )
        return results

    def _finalize_origin_rows(self, origin_buckets: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = list(origin_buckets.values())
        for row in results:
            for key in (
                "plan_inflow",
                "plan_outflow",
                "forecast_inflow",
                "forecast_outflow",
                "actual_inflow",
                "actual_outflow",
                "committed_inflow",
                "pipeline_inflow",
            ):
                row[key] = _round_money(row.get(key, 0.0))
            row["net_plan"] = _round_money(row["plan_inflow"] - row["plan_outflow"])
            row["net_real"] = _round_money(row["actual_inflow"] - row["actual_outflow"])
            row["future_support"] = _round_money(row["committed_inflow"] + row["pipeline_inflow"])
        results.sort(
            key=lambda item: -abs(
                _safe_float(item["net_plan"])
                + _safe_float(item["net_real"])
                + _safe_float(item["future_support"])
            )
        )
        return results

    def _build_alerts(
        self,
        monthly_rows: List[Dict[str, Any]],
        project_rows: List[Dict[str, Any]],
        source_stats: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        alerts: List[Dict[str, Any]] = []
        for row in monthly_rows:
            if row["plan_outflow"] > 0 and row["actual_outflow"] > row["plan_outflow"] * 1.1:
                alerts.append(
                    {
                        "level": "high",
                        "title": f"Sobre-ejecucion de egresos en {row['label']}",
                        "detail": f"Real {int(row['actual_outflow']):,} vs plan {int(row['plan_outflow']):,}.",
                    }
                )
            if row["projected_balance"] < 0:
                alerts.append(
                    {
                        "level": "critical",
                        "title": f"Caja proyectada negativa en {row['label']}",
                        "detail": f"Saldo proyectado {int(row['projected_balance']):,}. Revisa cobranzas, egresos o financiamiento.",
                    }
                )

        if source_stats.get("overdue_documents_total", 0) > 0:
            alerts.insert(
                0,
                {
                    "level": "high",
                    "title": "Cobranzas vencidas",
                    "detail": (
                        f"{source_stats['overdue_documents_total']} documento(s) vencido(s) "
                        f"por ${int(_round_money(source_stats.get('overdue_amount_total', 0.0))):,}."
                    ),
                },
            )

        for project in project_rows:
            if project["planned_outflow"] > 0 and project["expenses_total"] > project["planned_outflow"] * 1.15:
                alerts.append(
                    {
                        "level": "medium",
                        "title": f"Proyecto sobre presupuesto: {project['project_code'] or project['lead_title']}",
                        "detail": f"Egresos {int(project['expenses_total']):,} vs plan {int(project['planned_outflow']):,}.",
                    }
                )
            if project["margin_booked"] < 0 and project["expenses_total"] > 0:
                alerts.append(
                    {
                        "level": "medium",
                        "title": f"Margen negativo en {project['project_code'] or project['lead_title']}",
                        "detail": f"Facturado {int(project['billed_total']):,}, egresos {int(project['expenses_total']):,}.",
                    }
                )

        if not alerts:
            alerts.append(
                {
                    "level": "low",
                    "title": "Sin alertas criticas",
                    "detail": "El flujo proyectado y la ejecucion presupuestaria no muestran riesgos inmediatos.",
                }
            )
        return alerts[:12]

    def _build_dashboard_payload(self, year: int, budget: Optional[PlanningBudget]) -> Dict[str, Any]:
        monthly_rows = self._empty_month_rows()
        project_buckets: Dict[str, Dict[str, Any]] = {}
        origin_buckets: Dict[str, Dict[str, Any]] = {}
        budget_lines = self._budget_lines(budget.id) if budget else []
        self._apply_budget_lines(budget_lines, monthly_rows, project_buckets, origin_buckets)
        source_stats = self._collect_execution_sources(year, monthly_rows, project_buckets, origin_buckets)

        opening_cash = _round_money(budget.opening_cash if budget else 0.0)
        monthly_payload = self._finalize_monthly_projection(monthly_rows, opening_cash, year)
        project_rows = self._finalize_project_rows(project_buckets)
        origin_rows = self._finalize_origin_rows(origin_buckets)
        alerts = self._build_alerts(monthly_payload, project_rows, source_stats)
        budgets = [self._build_budget_payload(row) for row in self._budgets(year)]

        stats = {
            "budget_count": len(budgets),
            "opening_cash": opening_cash,
            "plan_inflow_total": _round_money(sum(row["plan_inflow"] for row in monthly_payload)),
            "plan_outflow_total": _round_money(sum(row["plan_outflow"] for row in monthly_payload)),
            "forecast_inflow_total": _round_money(sum(row["forecast_inflow"] for row in monthly_payload)),
            "forecast_outflow_total": _round_money(sum(row["forecast_outflow"] for row in monthly_payload)),
            "actual_inflow_total": _round_money(sum(row["actual_inflow"] for row in monthly_payload)),
            "actual_outflow_total": _round_money(sum(row["actual_outflow"] for row in monthly_payload)),
            "committed_inflow_total": _round_money(sum(row["committed_inflow"] for row in monthly_payload)),
            "pipeline_inflow_total": _round_money(sum(row["pipeline_inflow"] for row in monthly_payload)),
            "projected_close_balance": monthly_payload[-1]["projected_balance"] if monthly_payload else opening_cash,
            "minimum_projected_balance": min(
                [opening_cash, *[row["projected_balance"] for row in monthly_payload]]
            ) if monthly_payload else opening_cash,
            "projects_total": len(project_rows),
            "lines_total": len(budget_lines),
            **source_stats,
        }
        stats["plan_margin_total"] = _round_money(stats["plan_inflow_total"] - stats["plan_outflow_total"])
        stats["actual_margin_total"] = _round_money(stats["actual_inflow_total"] - stats["actual_outflow_total"])
        stats["projected_support_total"] = _round_money(
            stats["committed_inflow_total"] + stats["pipeline_inflow_total"]
        )

        return {
            "year": year,
            "selected_budget": self._build_budget_payload(budget) if budget else None,
            "budgets": budgets,
            "stats": stats,
            "monthly_rows": monthly_payload,
            "project_rows": project_rows[:80],
            "origin_rows": origin_rows,
            "alerts": alerts,
            "budget_lines": [line.to_dict() for line in budget_lines],
            "reference_data": self._build_reference_data(),
        }

    async def get_reference_data(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        return Response.ok(self._build_reference_data())

    async def list_budgets(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        year = _safe_int(request.get_param("year"))
        rows = [self._build_budget_payload(budget) for budget in self._budgets(year)]
        return Response.ok({"count": len(rows), "results": rows})

    async def create_budget(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        data = request.data or {}
        payload = {
            "name": data.get("name"),
            "company_id": self._company_id(),
            "year": _safe_int(data.get("year"), utc_now().year),
            "scenario_type": _clean_str(data.get("scenario_type"), "base"),
            "status": _clean_str(data.get("status"), "draft"),
            "opening_cash": _safe_float(data.get("opening_cash"), 0.0),
            "notes": data.get("notes"),
            "created_by_user_id": request.user_id,
        }

        try:
            budget = PlanningBudget.create(payload)
            self._set_only_one_active_budget(budget)
            return Response.created(self._build_budget_payload(budget))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_budget(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        budget, error = self._budget_or_404(request.params.get("id"))
        if error:
            return error
        return Response.ok(self._build_budget_payload(budget))

    async def update_budget(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        budget, error = self._budget_or_404(request.params.get("id"))
        if error:
            return error
        if _clean_str(budget.status) == "closed":
            return Response.bad_request("No puedes editar un presupuesto cerrado")

        data = request.data or {}
        budget.name = _clean_str(data.get("name"), budget.name)
        budget.year = _safe_int(data.get("year"), budget.year) or budget.year
        budget.scenario_type = _clean_str(data.get("scenario_type"), budget.scenario_type)
        budget.status = _clean_str(data.get("status"), budget.status)
        budget.opening_cash = _safe_float(data.get("opening_cash"), budget.opening_cash)
        budget.notes = _clean_str(data.get("notes"), budget.notes)

        try:
            budget.validate()
            budget.save()
            self._set_only_one_active_budget(budget)
            return Response.ok(self._build_budget_payload(budget))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_budget(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        budget, error = self._budget_or_404(request.params.get("id"))
        if error:
            return error
        if _clean_str(budget.status) == "active":
            return Response.bad_request(
                "No elimines un presupuesto activo. Cambialo a borrador o activa otra version primero."
            )

        budget_name = budget.name
        for line in self._budget_lines(budget.id):
            line.delete()
        budget.delete()
        return Response.ok({"message": f"Presupuesto '{budget_name}' eliminado"})

    async def create_budget_line(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        budget, error = self._budget_or_404(request.params.get("id"))
        if error:
            return error
        if _clean_str(budget.status) == "closed":
            return Response.bad_request("No puedes modificar lineas de un presupuesto cerrado")

        payload = self._line_payload_from_request(request.data or {}, existing_line=None)
        payload["budget_id"] = budget.id
        payload["company_id"] = budget.company_id

        try:
            line = PlanningBudgetLine.create(payload)
            return Response.created(line.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_budget_line(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        line, error = self._line_or_404(request.params.get("id"))
        if error:
            return error
        budget, budget_error = self._budget_or_404(line.budget_id)
        if budget_error:
            return budget_error
        if _clean_str(budget.status) == "closed":
            return Response.bad_request("No puedes modificar lineas de un presupuesto cerrado")

        payload = self._line_payload_from_request(request.data or {}, existing_line=line)
        for key, value in payload.items():
            setattr(line, key, value)

        try:
            line.validate()
            line.save()
            return Response.ok(line.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_budget_line(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        line, error = self._line_or_404(request.params.get("id"))
        if error:
            return error
        budget, budget_error = self._budget_or_404(line.budget_id)
        if budget_error:
            return budget_error
        if _clean_str(budget.status) == "closed":
            return Response.bad_request("No puedes modificar lineas de un presupuesto cerrado")

        line.delete()
        return Response.ok({"message": "Linea presupuestaria eliminada"})

    async def get_dashboard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        year = _safe_int(request.get_param("year"), utc_now().year) or utc_now().year
        budget_id = _safe_int(request.get_param("budget_id"))
        selected_budget: Optional[PlanningBudget] = None

        if budget_id:
            selected_budget, error = self._budget_or_404(budget_id)
            if error:
                return error
        else:
            year_budgets = self._budgets(year)
            selected_budget = next((budget for budget in year_budgets if budget.status == "active"), None)
            if not selected_budget and year_budgets:
                selected_budget = year_budgets[0]

        return Response.ok(self._build_dashboard_payload(year, selected_budget))
