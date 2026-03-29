"""
HR module.
"""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin


DEFAULT_DEPARTMENTS = [
    {"name": "Administracion", "code": "ADM"},
    {"name": "Comercial", "code": "COM"},
    {"name": "Operaciones", "code": "OPS"},
    {"name": "Recursos Humanos", "code": "RRHH"},
    {"name": "Tecnologia", "code": "TI"},
]

EMPLOYEE_STATUSES = ("draft", "onboarding", "active", "leave", "inactive")
CONTRACT_TYPES = ("indefinite", "fixed_term", "internship", "services")
CONTRACT_STATUSES = ("draft", "active", "expired", "terminated")
LEAVE_TYPES = ("vacation", "sick", "administrative", "unpaid", "parental")
LEAVE_STATUSES = ("pending", "approved", "rejected", "cancelled")


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        return value().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value if value not in (None, "") else default)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: Optional[int] = 0) -> Optional[int]:
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


def _days_between(start_date: str, end_date: str) -> float:
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        delta = (end - start).days + 1
        return float(delta if delta > 0 else 0)
    except Exception:
        return 0.0


def _resolve_user_name(user_id: Optional[int]) -> Optional[str]:
    if not user_id:
        return None
    try:
        from modules.base.module_base import User

        user = User.find_by_id(int(user_id))
        return user.name if user else None
    except Exception:
        return None


def provision_user_account(
    company_id: int,
    full_name: str,
    email: Optional[str],
    create_requested: bool = True,
    allowed_modules: Optional[List[str]] = None,
) -> Tuple[Optional[Any], Optional[str], Optional[str]]:
    if not create_requested or not email:
        return None, None, None

    from modules.base.module_base import User

    existing = User.search([("email", "=", email)])
    if existing:
        user = existing[0]
        if user.company_id != company_id:
            return None, None, "Email already belongs to a user in another company"
        return user, None, None

    temp_password = f"Temp{secrets.token_hex(4)}!"
    tmp_user = User()
    tmp_user.set_password(temp_password)

    user = User.create(
        {
            "email": email,
            "name": full_name,
            "company_id": company_id,
            "password_hash": tmp_user.password_hash,
            "role": "employee",
            "is_admin": False,
            "allowed_modules": allowed_modules or [],
        }
    )
    return user, temp_password, None


class Department(BaseModel, AuditMixin):
    __tablename__ = "hr_departments"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Name")
    code = Column(ColumnType.STRING, required=True, label="Code")
    manager_user_id = Column(ColumnType.INTEGER, label="Manager User")
    is_active = Column(ColumnType.BOOLEAN, default=True, label="Active")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not (self.name or "").strip():
            raise ValidationError("Department name is required")
        if not (self.code or "").strip():
            raise ValidationError("Department code is required")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name or "",
            "code": self.code or "",
            "manager_user_id": self.manager_user_id,
            "manager_name": _resolve_user_name(self.manager_user_id),
            "is_active": bool(self.is_active),
            "company_id": self.company_id,
        }


class EmployeeProfile(BaseModel, AuditMixin):
    __tablename__ = "hr_employees"
    __displayname__ = "full_name"

    employee_code = Column(ColumnType.STRING, label="Employee Code")
    full_name = Column(ColumnType.STRING, required=True, label="Full Name")
    user_id = Column(ColumnType.INTEGER, label="User")
    department_id = Column(ColumnType.INTEGER, label="Department")
    manager_user_id = Column(ColumnType.INTEGER, label="Manager")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    application_id = Column(ColumnType.INTEGER, label="Recruitment Application")
    candidate_id = Column(ColumnType.INTEGER, label="Candidate")
    position_title = Column(ColumnType.STRING, label="Position Title")
    work_email = Column(ColumnType.STRING, label="Work Email")
    personal_email = Column(ColumnType.STRING, label="Personal Email")
    phone = Column(ColumnType.STRING, label="Phone")
    address = Column(ColumnType.TEXT, label="Address")
    emergency_contact_name = Column(ColumnType.STRING, label="Emergency Contact")
    emergency_contact_phone = Column(ColumnType.STRING, label="Emergency Phone")
    status = Column(ColumnType.STRING, default="onboarding", label="Status")
    hire_date = Column(ColumnType.STRING, label="Hire Date")
    base_salary = Column(ColumnType.FLOAT, default=0.0, label="Base Salary")
    notes = Column(ColumnType.TEXT, label="Notes")

    def before_create(self):
        if not self.employee_code and self.company_id:
            prefix = f"EMP-{int(self.company_id):02d}-"
            next_seq = 1
            for employee in EmployeeProfile.search([("company_id", "=", self.company_id)]):
                code = employee.employee_code or ""
                if code.startswith(prefix):
                    try:
                        next_seq = max(next_seq, int(code.split("-")[-1]) + 1)
                    except Exception:
                        continue
            self.employee_code = f"{prefix}{next_seq:04d}"

        if not self.work_email and self.personal_email:
            self.work_email = self.personal_email

    def validate(self):
        super().validate()
        if not (self.full_name or "").strip():
            raise ValidationError("Employee full name is required")
        if self.status not in EMPLOYEE_STATUSES:
            raise ValidationError(
                f"Employee status must be one of: {', '.join(EMPLOYEE_STATUSES)}"
            )

    def to_dict(self) -> Dict[str, Any]:
        department = Department.find_by_id(self.department_id) if self.department_id else None
        return {
            "id": self.id,
            "employee_code": self.employee_code or "",
            "full_name": self.full_name or "",
            "user_id": self.user_id,
            "department_id": self.department_id,
            "department_name": department.name if department else None,
            "manager_user_id": self.manager_user_id,
            "manager_name": _resolve_user_name(self.manager_user_id),
            "company_id": self.company_id,
            "application_id": self.application_id,
            "candidate_id": self.candidate_id,
            "position_title": self.position_title or "",
            "work_email": self.work_email or "",
            "personal_email": self.personal_email or "",
            "phone": self.phone or "",
            "address": self.address or "",
            "emergency_contact_name": self.emergency_contact_name or "",
            "emergency_contact_phone": self.emergency_contact_phone or "",
            "status": self.status or "onboarding",
            "hire_date": self.hire_date or "",
            "base_salary": self.base_salary or 0.0,
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class EmployeeContract(BaseModel, AuditMixin):
    __tablename__ = "hr_contracts"
    __displayname__ = "contract_type"

    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    contract_type = Column(ColumnType.STRING, required=True, label="Contract Type")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    start_date = Column(ColumnType.STRING, required=True, label="Start Date")
    end_date = Column(ColumnType.STRING, label="End Date")
    salary_amount = Column(ColumnType.FLOAT, default=0.0, label="Salary Amount")
    work_schedule = Column(ColumnType.STRING, label="Work Schedule")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        if self.contract_type not in CONTRACT_TYPES:
            raise ValidationError(
                f"Contract type must be one of: {', '.join(CONTRACT_TYPES)}"
            )
        if self.status not in CONTRACT_STATUSES:
            raise ValidationError(
                f"Contract status must be one of: {', '.join(CONTRACT_STATUSES)}"
            )
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError("Contract end date must be after start date")

    def to_dict(self) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "company_id": self.company_id,
            "contract_type": self.contract_type or "",
            "status": self.status or "draft",
            "start_date": self.start_date or "",
            "end_date": self.end_date or "",
            "salary_amount": self.salary_amount or 0.0,
            "work_schedule": self.work_schedule or "",
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class TimeOffRequest(BaseModel, AuditMixin):
    __tablename__ = "hr_time_off_requests"
    __displayname__ = "leave_type"

    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    leave_type = Column(ColumnType.STRING, required=True, label="Leave Type")
    status = Column(ColumnType.STRING, default="pending", label="Status")
    start_date = Column(ColumnType.STRING, required=True, label="Start Date")
    end_date = Column(ColumnType.STRING, required=True, label="End Date")
    days_requested = Column(ColumnType.FLOAT, default=0.0, label="Days Requested")
    reason = Column(ColumnType.TEXT, label="Reason")
    approved_by = Column(ColumnType.INTEGER, label="Approved By")

    def before_create(self):
        if not self.days_requested and self.start_date and self.end_date:
            self.days_requested = _days_between(self.start_date, self.end_date)

    def validate(self):
        super().validate()
        if self.leave_type not in LEAVE_TYPES:
            raise ValidationError(f"Leave type must be one of: {', '.join(LEAVE_TYPES)}")
        if self.status not in LEAVE_STATUSES:
            raise ValidationError(
                f"Leave status must be one of: {', '.join(LEAVE_STATUSES)}"
            )
        if self.end_date < self.start_date:
            raise ValidationError("Leave end date must be after start date")

    def to_dict(self) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "company_id": self.company_id,
            "leave_type": self.leave_type or "",
            "status": self.status or "pending",
            "start_date": self.start_date or "",
            "end_date": self.end_date or "",
            "days_requested": self.days_requested or 0.0,
            "reason": self.reason or "",
            "approved_by": self.approved_by,
            "approved_by_name": _resolve_user_name(self.approved_by),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


def seed_default_departments(company_id: int) -> List[Department]:
    existing = Department.search([("company_id", "=", company_id)])
    if existing:
        return existing

    departments = []
    for item in DEFAULT_DEPARTMENTS:
        department = Department.create(
            {
                "name": item["name"],
                "code": item["code"],
                "company_id": company_id,
                "is_active": True,
            }
        )
        departments.append(department)
    return departments


class HRModule(BaseModule):
    name = "HR"
    version = "1.0.0"
    author = "Your Company"
    description = "Human Resources - employees, contracts and leave"
    depends = ["base"]

    def init_module(self):
        self.register_model("hr.department", Department)
        self.register_model("hr.employee", EmployeeProfile)
        self.register_model("hr.contract", EmployeeContract)
        self.register_model("hr.time_off_request", TimeOffRequest)

        self.register_route("/hr/stats", self.get_stats, methods=["GET"], auth_required=True)

        self.register_route("/hr/departments", self.list_departments, methods=["GET"], auth_required=True)
        self.register_route("/hr/departments", self.create_department, methods=["POST"], auth_required=True)
        self.register_route("/hr/departments/{id}", self.update_department, methods=["PUT"], auth_required=True)
        self.register_route("/hr/departments/{id}", self.delete_department, methods=["DELETE"], auth_required=True)

        self.register_route("/hr/employees", self.list_employees, methods=["GET"], auth_required=True)
        self.register_route("/hr/employees", self.create_employee, methods=["POST"], auth_required=True)
        self.register_route("/hr/employees/{id}", self.get_employee, methods=["GET"], auth_required=True)
        self.register_route("/hr/employees/{id}", self.update_employee, methods=["PUT"], auth_required=True)
        self.register_route("/hr/employees/{id}", self.delete_employee, methods=["DELETE"], auth_required=True)

        self.register_route("/hr/contracts", self.list_contracts, methods=["GET"], auth_required=True)
        self.register_route("/hr/contracts", self.create_contract, methods=["POST"], auth_required=True)
        self.register_route("/hr/contracts/{id}", self.update_contract, methods=["PUT"], auth_required=True)
        self.register_route("/hr/contracts/{id}", self.delete_contract, methods=["DELETE"], auth_required=True)

        self.register_route("/hr/leaves", self.list_leaves, methods=["GET"], auth_required=True)
        self.register_route("/hr/leaves", self.create_leave, methods=["POST"], auth_required=True)
        self.register_route("/hr/leaves/{id}", self.update_leave, methods=["PUT"], auth_required=True)
        self.register_route("/hr/leaves/{id}", self.delete_leave, methods=["DELETE"], auth_required=True)

        self.logger.info("HR module initialized")

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
        if "hr" not in (user.allowed_modules or []):
            return Response.forbidden("You do not have access to HR")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        user = self.env.user
        if user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Only administrators can perform this action")
        return None

    def _ensure_default_departments(self):
        company_id = self._company_id()
        if company_id and not Department.search([("company_id", "=", company_id)]):
            seed_default_departments(company_id)

    def _department_or_404(self, department_id: Any) -> Tuple[Optional[Department], Optional[Response]]:
        department = Department.find_by_id(_safe_int(department_id))
        if not department or (
            self.env.user.role != "superadmin" and department.company_id != self._company_id()
        ):
            return None, Response.not_found("Department not found")
        return department, None

    def _employee_or_404(self, employee_id: Any) -> Tuple[Optional[EmployeeProfile], Optional[Response]]:
        employee = EmployeeProfile.find_by_id(_safe_int(employee_id))
        if not employee or (
            self.env.user.role != "superadmin" and employee.company_id != self._company_id()
        ):
            return None, Response.not_found("Employee not found")
        return employee, None

    def _contract_or_404(self, contract_id: Any) -> Tuple[Optional[EmployeeContract], Optional[Response]]:
        contract = EmployeeContract.find_by_id(_safe_int(contract_id))
        if not contract or (
            self.env.user.role != "superadmin" and contract.company_id != self._company_id()
        ):
            return None, Response.not_found("Contract not found")
        return contract, None

    def _leave_or_404(self, leave_id: Any) -> Tuple[Optional[TimeOffRequest], Optional[Response]]:
        leave = TimeOffRequest.find_by_id(_safe_int(leave_id))
        if not leave or (
            self.env.user.role != "superadmin" and leave.company_id != self._company_id()
        ):
            return None, Response.not_found("Leave request not found")
        return leave, None

    async def list_departments(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        self._ensure_default_departments()
        departments = Department.search(self._tenant_filter())
        departments.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))
        return Response.ok({"count": len(departments), "results": [item.to_dict() for item in departments]})

    async def create_department(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        try:
            department = Department.create(
                {
                    "name": request.get_data("name"),
                    "code": request.get_data("code"),
                    "manager_user_id": request.get_data("manager_user_id"),
                    "is_active": _normalize_bool(request.get_data("is_active"), True),
                    "company_id": self._company_id(),
                }
            )
            return Response.created(department.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_department(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        department, error = self._department_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        if "name" in data:
            department.name = data["name"]
        if "code" in data:
            department.code = data["code"]
        if "manager_user_id" in data:
            department.manager_user_id = _safe_int(data["manager_user_id"], None)
        if "is_active" in data:
            department.is_active = _normalize_bool(data["is_active"], True)

        try:
            department.save()
            return Response.ok(department.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_department(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        department, error = self._department_or_404(request.params.get("id"))
        if error:
            return error

        employees = EmployeeProfile.search([("department_id", "=", department.id)])
        if employees:
            return Response.bad_request(
                f"Cannot delete department '{department.name}' because it still has employees"
            )

        department.delete()
        return Response.ok({"message": f"Department '{department.name}' deleted"})

    async def list_employees(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        search = (request.get_param("search", "") or "").strip().lower()
        status = request.get_param("status")
        department_id = request.get_param("department_id")

        employees = EmployeeProfile.search(self._tenant_filter())
        if status:
            employees = [item for item in employees if (item.status or "") == status]
        if department_id:
            dep_id = _safe_int(department_id)
            employees = [item for item in employees if item.department_id == dep_id]
        if search:
            employees = [
                item
                for item in employees
                if search in (item.full_name or "").lower()
                or search in (item.employee_code or "").lower()
                or search in (item.work_email or "").lower()
            ]

        employees.sort(key=lambda item: ((item.full_name or "").lower(), item.id or 0))
        return Response.ok({"count": len(employees), "results": [item.to_dict() for item in employees]})

    async def get_employee(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        employee, error = self._employee_or_404(request.params.get("id"))
        if error:
            return error

        contracts = EmployeeContract.search([("employee_id", "=", employee.id)])
        leaves = TimeOffRequest.search([("employee_id", "=", employee.id)])

        return Response.ok(
            {
                **employee.to_dict(),
                "contracts": [item.to_dict() for item in contracts],
                "leave_requests": [item.to_dict() for item in leaves],
            }
        )

    async def create_employee(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        department_id = _safe_int(data.get("department_id"), None)
        if department_id:
            _, error = self._department_or_404(department_id)
            if error:
                return error

        create_user_account = _normalize_bool(data.get("create_user_account"), True)
        allowed_modules = data.get("allowed_modules") or []
        user, temp_password, warning = provision_user_account(
            self._company_id(),
            data.get("full_name") or data.get("name") or "",
            data.get("work_email") or data.get("email"),
            create_requested=create_user_account,
            allowed_modules=allowed_modules,
        )

        try:
            employee = EmployeeProfile.create(
                {
                    "full_name": data.get("full_name") or data.get("name"),
                    "user_id": user.id if user else None,
                    "department_id": department_id,
                    "manager_user_id": _safe_int(data.get("manager_user_id"), None),
                    "company_id": self._company_id(),
                    "application_id": _safe_int(data.get("application_id"), None),
                    "candidate_id": _safe_int(data.get("candidate_id"), None),
                    "position_title": data.get("position_title"),
                    "work_email": data.get("work_email") or data.get("email"),
                    "personal_email": data.get("personal_email"),
                    "phone": data.get("phone"),
                    "address": data.get("address"),
                    "emergency_contact_name": data.get("emergency_contact_name"),
                    "emergency_contact_phone": data.get("emergency_contact_phone"),
                    "status": data.get("status") or ("active" if data.get("hire_date") else "onboarding"),
                    "hire_date": data.get("hire_date"),
                    "base_salary": _safe_float(data.get("base_salary"), 0.0),
                    "notes": data.get("notes"),
                }
            )

            contract = None
            if data.get("contract_type") and data.get("start_date"):
                contract = EmployeeContract.create(
                    {
                        "employee_id": employee.id,
                        "company_id": self._company_id(),
                        "contract_type": data.get("contract_type"),
                        "status": data.get("contract_status") or "draft",
                        "start_date": data.get("start_date"),
                        "end_date": data.get("end_date"),
                        "salary_amount": _safe_float(data.get("salary_amount"), employee.base_salary),
                        "work_schedule": data.get("work_schedule"),
                        "notes": data.get("contract_notes") or "",
                    }
                )

            response = {"employee": employee.to_dict()}
            if contract:
                response["contract"] = contract.to_dict()
            if temp_password:
                response["temp_password"] = temp_password
            if warning:
                response["warning"] = warning
            return Response.created(response)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_employee(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        employee, error = self._employee_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        if "department_id" in data and data.get("department_id"):
            _, dep_error = self._department_or_404(data.get("department_id"))
            if dep_error:
                return dep_error

        editable_fields = {
            "full_name": "full_name",
            "department_id": "department_id",
            "manager_user_id": "manager_user_id",
            "position_title": "position_title",
            "work_email": "work_email",
            "personal_email": "personal_email",
            "phone": "phone",
            "address": "address",
            "emergency_contact_name": "emergency_contact_name",
            "emergency_contact_phone": "emergency_contact_phone",
            "status": "status",
            "hire_date": "hire_date",
            "base_salary": "base_salary",
            "notes": "notes",
        }
        for incoming, field_name in editable_fields.items():
            if incoming in data:
                value = data[incoming]
                if incoming in ("department_id", "manager_user_id"):
                    value = _safe_int(value, None)
                if incoming == "base_salary":
                    value = _safe_float(value, 0.0)
                setattr(employee, field_name, value)

        warning = None
        temp_password = None
        if _normalize_bool(data.get("create_user_account"), False) and not employee.user_id:
            user, temp_password, warning = provision_user_account(
                employee.company_id,
                employee.full_name,
                data.get("work_email") or employee.work_email,
                create_requested=True,
                allowed_modules=data.get("allowed_modules") or [],
            )
            if user:
                employee.user_id = user.id

        try:
            employee.save()
            response = {"employee": employee.to_dict()}
            if temp_password:
                response["temp_password"] = temp_password
            if warning:
                response["warning"] = warning
            return Response.ok(response)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_employee(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        employee, error = self._employee_or_404(request.params.get("id"))
        if error:
            return error

        contracts = EmployeeContract.search([("employee_id", "=", employee.id)])
        leaves = TimeOffRequest.search([("employee_id", "=", employee.id)])
        if contracts or leaves:
            return Response.bad_request(
                "Cannot delete employee with contracts or leave requests linked"
            )

        employee.delete()
        return Response.ok({"message": f"Employee '{employee.full_name}' deleted"})

    async def list_contracts(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        status = request.get_param("status")
        contracts = EmployeeContract.search(self._tenant_filter())
        if status:
            contracts = [item for item in contracts if (item.status or "") == status]
        contracts.sort(key=lambda item: (item.start_date or "", item.id or 0), reverse=True)
        return Response.ok({"count": len(contracts), "results": [item.to_dict() for item in contracts]})

    async def create_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        employee, error = self._employee_or_404(data.get("employee_id"))
        if error:
            return error

        try:
            contract = EmployeeContract.create(
                {
                    "employee_id": employee.id,
                    "company_id": employee.company_id,
                    "contract_type": data.get("contract_type"),
                    "status": data.get("status") or "draft",
                    "start_date": data.get("start_date"),
                    "end_date": data.get("end_date"),
                    "salary_amount": _safe_float(data.get("salary_amount"), employee.base_salary),
                    "work_schedule": data.get("work_schedule"),
                    "notes": data.get("notes"),
                }
            )

            if contract.status == "active":
                employee.status = "active"
                if not employee.hire_date:
                    employee.hire_date = contract.start_date
                if contract.salary_amount:
                    employee.base_salary = contract.salary_amount
                employee.save()

            return Response.created(contract.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        contract, error = self._contract_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        editable = {
            "contract_type": "contract_type",
            "status": "status",
            "start_date": "start_date",
            "end_date": "end_date",
            "salary_amount": "salary_amount",
            "work_schedule": "work_schedule",
            "notes": "notes",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming == "salary_amount":
                    value = _safe_float(value, 0.0)
                setattr(contract, field_name, value)

        try:
            contract.save()
            employee = EmployeeProfile.find_by_id(contract.employee_id)
            if employee:
                if contract.status == "active":
                    employee.status = "active"
                    if contract.salary_amount:
                        employee.base_salary = contract.salary_amount
                elif contract.status == "terminated":
                    employee.status = "inactive"
                employee.save()
            return Response.ok(contract.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_contract(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        contract, error = self._contract_or_404(request.params.get("id"))
        if error:
            return error
        if contract.status == "active":
            return Response.bad_request("Cannot delete an active contract")
        contract.delete()
        return Response.ok({"message": "Contract deleted"})

    async def list_leaves(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        status = request.get_param("status")
        leave_type = request.get_param("leave_type")

        leaves = TimeOffRequest.search(self._tenant_filter())
        if status:
            leaves = [item for item in leaves if (item.status or "") == status]
        if leave_type:
            leaves = [item for item in leaves if (item.leave_type or "") == leave_type]

        leaves.sort(key=lambda item: (item.start_date or "", item.id or 0), reverse=True)
        return Response.ok({"count": len(leaves), "results": [item.to_dict() for item in leaves]})

    async def create_leave(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        employee, error = self._employee_or_404(data.get("employee_id"))
        if error:
            return error

        try:
            leave = TimeOffRequest.create(
                {
                    "employee_id": employee.id,
                    "company_id": employee.company_id,
                    "leave_type": data.get("leave_type"),
                    "status": data.get("status") or "pending",
                    "start_date": data.get("start_date"),
                    "end_date": data.get("end_date"),
                    "days_requested": _safe_float(data.get("days_requested"), 0.0),
                    "reason": data.get("reason"),
                    "approved_by": self.env.user.id if data.get("status") == "approved" else None,
                }
            )

            if leave.status == "approved":
                employee.status = "leave"
                employee.save()

            return Response.created(leave.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_leave(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        leave, error = self._leave_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        editable = {
            "leave_type": "leave_type",
            "status": "status",
            "start_date": "start_date",
            "end_date": "end_date",
            "days_requested": "days_requested",
            "reason": "reason",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming == "days_requested":
                    value = _safe_float(value, 0.0)
                setattr(leave, field_name, value)

        if leave.status == "approved":
            leave.approved_by = self.env.user.id

        try:
            leave.save()
            employee = EmployeeProfile.find_by_id(leave.employee_id)
            if employee and leave.status == "approved":
                employee.status = "leave"
                employee.save()
            return Response.ok(leave.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_leave(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        leave, error = self._leave_or_404(request.params.get("id"))
        if error:
            return error
        if leave.status == "approved":
            return Response.bad_request("Cannot delete an approved leave request")
        leave.delete()
        return Response.ok({"message": "Leave request deleted"})

    async def get_stats(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        employees = EmployeeProfile.search(self._tenant_filter())
        contracts = EmployeeContract.search(self._tenant_filter())
        leaves = TimeOffRequest.search(self._tenant_filter())
        departments = Department.search(self._tenant_filter())

        active_employees = [item for item in employees if item.status == "active"]
        onboarding = [item for item in employees if item.status == "onboarding"]
        active_contracts = [item for item in contracts if item.status == "active"]
        pending_leaves = [item for item in leaves if item.status == "pending"]

        return Response.ok(
            {
                "employees_total": len(employees),
                "employees_active": len(active_employees),
                "employees_onboarding": len(onboarding),
                "contracts_active": len(active_contracts),
                "leave_pending": len(pending_leaves),
                "departments_total": len(departments),
            }
        )
