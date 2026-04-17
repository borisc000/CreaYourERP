"""
Simple task/activity management module.

Tracks who created the task, when it was created, which worker owns it,
the due date, and the expected deliverable.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now, utc_strftime, utc_today


TASK_STATUSES: Dict[str, str] = {
    "pending": "Pendiente",
    "in_progress": "En progreso",
    "done": "Entregada",
    "blocked": "Bloqueada",
}

ACTIVE_ASSIGNABLE_EMPLOYEE_STATUSES = {"draft", "onboarding", "active", "leave"}


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


def _sort_dt_value(value: Any) -> str:
    formatted = _fmt_dt(value)
    return formatted or ""


def _sort_date_value(value: Any) -> str:
    parsed = _parse_date(value)
    return parsed.isoformat() if parsed else _clean_str(value)


def _resolve_user_name(user_id: Optional[int]) -> str:
    if not user_id:
        return ""
    try:
        from modules.base.module_base import User

        user = User.find_by_id(int(user_id))
        return user.name if user else ""
    except Exception:
        return ""


def _resolve_employee_payload(employee_id: Optional[int]) -> Dict[str, Any]:
    if not employee_id:
        return {
            "assigned_employee_id": None,
            "assigned_employee_name": "",
            "assigned_employee_code": "",
            "assigned_employee_position": "",
            "assigned_employee_status": "",
        }

    try:
        from modules.hr.module_hr import EmployeeProfile

        employee = EmployeeProfile.find_by_id(int(employee_id))
        if not employee:
            raise ValueError("employee-not-found")
        return {
            "assigned_employee_id": employee.id,
            "assigned_employee_name": employee.full_name or "",
            "assigned_employee_code": employee.employee_code or "",
            "assigned_employee_position": employee.position_title or "",
            "assigned_employee_status": employee.status or "",
        }
    except Exception:
        return {
            "assigned_employee_id": employee_id,
            "assigned_employee_name": "",
            "assigned_employee_code": "",
            "assigned_employee_position": "",
            "assigned_employee_status": "",
        }


class TaskActivity(BaseModel, AuditMixin):
    """Task/activity assigned to a worker."""

    __tablename__ = "task_activities"
    __displayname__ = "title"

    task_code = Column(ColumnType.STRING, required=True, label="Task Code")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    title = Column(ColumnType.STRING, required=True, label="Title")
    description = Column(ColumnType.TEXT, label="Description")
    deliverable = Column(ColumnType.TEXT, required=True, label="Deliverable")
    assigned_employee_id = Column(ColumnType.INTEGER, required=True, label="Assigned Worker")
    created_by_user_id = Column(ColumnType.INTEGER, label="Created By User")
    delivery_date = Column(ColumnType.STRING, required=True, label="Delivery Date")
    status = Column(ColumnType.STRING, default="pending", label="Status")
    completed_at = Column(ColumnType.DATETIME, label="Completed At")

    def before_create(self):
        if not _clean_str(self.task_code):
            self.task_code = utc_strftime("TSK-%Y%m%d-%H%M%S")

    def validate(self):
        super().validate()

        self.task_code = _clean_str(self.task_code).upper()
        self.title = _clean_str(self.title)
        self.description = _clean_str(self.description)
        self.deliverable = _clean_str(self.deliverable)
        self.assigned_employee_id = _safe_int(self.assigned_employee_id)
        self.created_by_user_id = _safe_int(self.created_by_user_id)
        self.delivery_date = _clean_str(self.delivery_date)
        self.status = _clean_str(self.status, "pending")

        parsed_due = _parse_date(self.delivery_date)
        if parsed_due:
            self.delivery_date = parsed_due.isoformat()

        if not self.task_code:
            raise ValidationError("Task code is required")
        if not self.title:
            raise ValidationError("Task title is required")
        if not self.deliverable:
            raise ValidationError("Deliverable is required")
        if not self.assigned_employee_id:
            raise ValidationError("Assigned worker is required")
        if not parsed_due:
            raise ValidationError("Delivery date must use YYYY-MM-DD format")
        if self.status not in TASK_STATUSES:
            raise ValidationError(
                "Task status must be one of: " + ", ".join(TASK_STATUSES.keys())
            )

        try:
            from modules.hr.module_hr import EmployeeProfile

            employee = EmployeeProfile.find_by_id(self.assigned_employee_id)
        except Exception:
            employee = None

        if not employee:
            raise ValidationError("Assigned worker was not found")
        if self.company_id and employee.company_id != self.company_id:
            raise ValidationError("Assigned worker belongs to another company")

        duplicates = TaskActivity.search(
            [("company_id", "=", self.company_id), ("task_code", "=", self.task_code)]
        )
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Another task already uses this code")

    def to_dict(self) -> Dict[str, Any]:
        employee_payload = _resolve_employee_payload(self.assigned_employee_id)
        due_date = _parse_date(self.delivery_date)
        today = utc_today()
        is_done = _clean_str(self.status) == "done"
        is_overdue = bool(due_date and due_date < today and not is_done)
        due_in_days = (due_date - today).days if due_date else None

        return {
            "id": self.id,
            "task_code": self.task_code or "",
            "company_id": self.company_id,
            "title": self.title or "",
            "description": self.description or "",
            "deliverable": self.deliverable or "",
            "assigned_employee_id": self.assigned_employee_id,
            **employee_payload,
            "created_by_user_id": self.created_by_user_id,
            "created_by_user_name": _resolve_user_name(self.created_by_user_id),
            "delivery_date": self.delivery_date or "",
            "status": self.status or "pending",
            "status_label": TASK_STATUSES.get(self.status or "pending", self.status or ""),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
            "completed_at": _fmt_dt(self.completed_at),
            "is_overdue": is_overdue,
            "due_in_days": due_in_days,
        }


class TasksModule(BaseModule):
    """Workflow module for simple task/activity assignments."""

    name = "Tasks"
    version = "1.0.0"
    author = "Your Company"
    description = "Gestion simple de tareas y actividades asignadas a trabajadores"
    depends = ["base", "hr"]

    def init_module(self):
        self.register_model("tasks.activity", TaskActivity)

        self.register_route("/tasks/dashboard", self.get_dashboard, methods=["GET"], auth_required=True)
        self.register_route(
            "/tasks/reference-data",
            self.get_reference_data,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route("/tasks/activities", self.list_activities, methods=["GET"], auth_required=True)
        self.register_route("/tasks/activities", self.create_activity, methods=["POST"], auth_required=True)
        self.register_route(
            "/tasks/activities/{id}",
            self.get_activity,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/tasks/activities/{id}",
            self.update_activity,
            methods=["PUT"],
            auth_required=True,
        )
        self.register_route(
            "/tasks/activities/{id}",
            self.delete_activity,
            methods=["DELETE"],
            auth_required=True,
        )

        self.logger.info("Tasks module initialized")

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
        allowed_modules = set(user.allowed_modules or [])
        return bool({"tasks", "hr"} & allowed_modules)

    def _require_access(self) -> Optional[Response]:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._user_has_access():
            return Response.forbidden("No tienes acceso al modulo de Tareas")
        return None

    def _employee_or_error(
        self,
        employee_id: Any,
        *,
        allow_inactive: bool = False,
    ) -> Tuple[Optional[Any], Optional[Response]]:
        parsed_id = _safe_int(employee_id)
        if not parsed_id:
            return None, Response.bad_request("Debes seleccionar un trabajador asignado")

        try:
            from modules.hr.module_hr import EmployeeProfile

            employee = EmployeeProfile.find_by_id(parsed_id)
        except Exception:
            employee = None

        if not employee:
            return None, Response.not_found("Trabajador no encontrado")

        user = self.env.user
        if user and user.role != "superadmin" and employee.company_id != self._company_id():
            return None, Response.not_found("Trabajador no encontrado")

        if (
            not allow_inactive
            and _clean_str(employee.status, "active") not in ACTIVE_ASSIGNABLE_EMPLOYEE_STATUSES
        ):
            return None, Response.bad_request("El trabajador seleccionado no esta habilitado para nuevas tareas")

        return employee, None

    def _task_or_error(self, task_id: Any) -> Tuple[Optional[TaskActivity], Optional[Response]]:
        parsed_id = _safe_int(task_id)
        if not parsed_id:
            return None, Response.not_found("Tarea no encontrada")

        task = TaskActivity.find_by_id(parsed_id)
        if not task:
            return None, Response.not_found("Tarea no encontrada")

        user = self.env.user
        if user and user.role != "superadmin" and task.company_id != self._company_id():
            return None, Response.not_found("Tarea no encontrada")

        return task, None

    def _sorted_tasks(self) -> List[TaskActivity]:
        tasks = TaskActivity.search(self._tenant_filter())
        tasks.sort(
            key=lambda task: (
                0 if task.status != "done" and _parse_date(task.delivery_date) and _parse_date(task.delivery_date) < utc_today() else 1,
                0 if task.status == "pending" else 1 if task.status == "in_progress" else 2 if task.status == "blocked" else 3,
                _sort_date_value(task.delivery_date),
                _sort_dt_value(task._data.get("created_at")),
                task.id or 0,
            )
        )
        return tasks

    def _employee_options(self) -> List[Dict[str, Any]]:
        try:
            from modules.hr.module_hr import Department, EmployeeProfile

            employees = EmployeeProfile.search(self._tenant_filter())
            employees.sort(
                key=lambda employee: (
                    0 if _clean_str(employee.status, "active") in ACTIVE_ASSIGNABLE_EMPLOYEE_STATUSES else 1,
                    (employee.full_name or "").lower(),
                    employee.id or 0,
                )
            )
            payload: List[Dict[str, Any]] = []
            for employee in employees:
                department = Department.find_by_id(employee.department_id) if employee.department_id else None
                payload.append(
                    {
                        "id": employee.id,
                        "full_name": employee.full_name or "",
                        "employee_code": employee.employee_code or "",
                        "position_title": employee.position_title or "",
                        "department_name": department.name if department else "",
                        "status": employee.status or "",
                        "is_assignable": _clean_str(employee.status, "active")
                        in ACTIVE_ASSIGNABLE_EMPLOYEE_STATUSES,
                    }
                )
            return payload
        except Exception:
            return []

    def _build_stats(self, tasks: List[TaskActivity]) -> Dict[str, Any]:
        today = utc_today()
        stats = {
            "tasks_total": len(tasks),
            "pending_total": 0,
            "in_progress_total": 0,
            "done_total": 0,
            "blocked_total": 0,
            "overdue_total": 0,
            "due_today_total": 0,
            "due_week_total": 0,
        }

        for task in tasks:
            status = _clean_str(task.status, "pending")
            if status == "pending":
                stats["pending_total"] += 1
            elif status == "in_progress":
                stats["in_progress_total"] += 1
            elif status == "done":
                stats["done_total"] += 1
            elif status == "blocked":
                stats["blocked_total"] += 1

            due_date = _parse_date(task.delivery_date)
            if not due_date or status == "done":
                continue
            days_until = (due_date - today).days
            if due_date < today:
                stats["overdue_total"] += 1
            if days_until == 0:
                stats["due_today_total"] += 1
            if 0 <= days_until <= 7:
                stats["due_week_total"] += 1

        return stats

    def _normalize_payload(
        self,
        data: Dict[str, Any],
        *,
        existing: Optional[TaskActivity],
        employee: Any,
    ) -> Dict[str, Any]:
        status = data.get("status") if "status" in data else getattr(existing, "status", "pending")
        status = _clean_str(status, "pending")

        completed_at = getattr(existing, "completed_at", None)
        if status == "done" and not completed_at:
            completed_at = utc_now()
        if status != "done":
            completed_at = None

        company_id = employee.company_id or self._company_id() or getattr(existing, "company_id", None)

        return {
            "task_code": data.get("task_code") if "task_code" in data else getattr(existing, "task_code", None),
            "company_id": company_id,
            "title": data.get("title") if "title" in data else getattr(existing, "title", None),
            "description": data.get("description")
            if "description" in data
            else getattr(existing, "description", None),
            "deliverable": data.get("deliverable")
            if "deliverable" in data
            else getattr(existing, "deliverable", None),
            "assigned_employee_id": employee.id,
            "created_by_user_id": (
                getattr(existing, "created_by_user_id", None)
                or (self.env.user.id if self.env.user else None)
            ),
            "delivery_date": data.get("delivery_date")
            if "delivery_date" in data
            else getattr(existing, "delivery_date", None),
            "status": status,
            "completed_at": completed_at,
        }

    async def get_dashboard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        tasks = self._sorted_tasks()
        return Response.ok(
            {
                "stats": self._build_stats(tasks),
                "recent_tasks": [task.to_dict() for task in tasks[:10]],
                "workers": self._employee_options(),
            }
        )

    async def get_reference_data(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        return Response.ok(
            {
                "statuses": [
                    {"code": code, "label": label}
                    for code, label in TASK_STATUSES.items()
                ],
                "employees": self._employee_options(),
            }
        )

    async def list_activities(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        search = _clean_str(request.get_param("search")).lower()
        status = _clean_str(request.get_param("status"))
        employee_id = _safe_int(request.get_param("employee_id"))
        limit = _safe_int(request.get_param("limit"), 200) or 200

        rows = [task.to_dict() for task in self._sorted_tasks()]
        if status:
            rows = [row for row in rows if row["status"] == status]
        if employee_id:
            rows = [
                row
                for row in rows
                if _safe_int(row.get("assigned_employee_id")) == employee_id
            ]
        if search:
            rows = [
                row
                for row in rows
                if search in (row.get("task_code") or "").lower()
                or search in (row.get("title") or "").lower()
                or search in (row.get("description") or "").lower()
                or search in (row.get("deliverable") or "").lower()
                or search in (row.get("assigned_employee_name") or "").lower()
                or search in (row.get("assigned_employee_code") or "").lower()
                or search in (row.get("created_by_user_name") or "").lower()
            ]

        return Response.ok({"count": len(rows), "results": rows[:limit]})

    async def create_activity(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        employee, employee_error = self._employee_or_error(data.get("assigned_employee_id"))
        if employee_error:
            return employee_error

        payload = self._normalize_payload(data, existing=None, employee=employee)

        try:
            task = TaskActivity.create(payload)
            return Response.created(task.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_activity(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        task, task_error = self._task_or_error(request.params.get("id"))
        if task_error:
            return task_error

        return Response.ok(task.to_dict())

    async def update_activity(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        task, task_error = self._task_or_error(request.params.get("id"))
        if task_error:
            return task_error

        data = request.data or {}
        if "assigned_employee_id" in data:
            next_employee_id = _safe_int(data.get("assigned_employee_id"))
            employee, employee_error = self._employee_or_error(
                next_employee_id,
                allow_inactive=next_employee_id == task.assigned_employee_id,
            )
        else:
            employee, employee_error = self._employee_or_error(
                task.assigned_employee_id,
                allow_inactive=True,
            )
        if employee_error:
            return employee_error

        payload = self._normalize_payload(data, existing=task, employee=employee)
        if task.company_id and employee.company_id and task.company_id != employee.company_id:
            return Response.bad_request("No puedes reasignar una tarea a otra empresa")

        for field_name, value in payload.items():
            setattr(task, field_name, value)

        try:
            task.save()
            return Response.ok(task.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_activity(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        task, task_error = self._task_or_error(request.params.get("id"))
        if task_error:
            return task_error

        task_code = task.task_code or f"Tarea {task.id}"
        task.delete()
        return Response.ok({"message": f"{task_code} eliminada"})
