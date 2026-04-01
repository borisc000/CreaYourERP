"""
AI module.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now


PROVIDER_KINDS = ("openai", "anthropic", "google", "azure_openai", "openrouter", "ollama", "custom")
PROMPT_STATUSES = ("draft", "active", "archived")
EXECUTION_STATUSES = ("planned", "simulated", "completed", "failed")
AGENT_TOOL_POLICIES = ("none", "manual", "approved", "auto")
AGENT_MEMORY_POLICIES = ("none", "session", "company", "workflow")
DEFAULT_PROVIDER_CAPABILITIES = {
    "chat",
    "vision",
    "embeddings",
    "transcription",
    "agents",
    "tools",
    "moderation",
}


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _clean_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _clean_slug(value: Any, fallback: str = "") -> str:
    source = _clean_text(value, fallback).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", source).strip("-")
    return slug or _clean_text(fallback).lower().replace(" ", "-")


def _to_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value in (None, ""):
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "si", "on"}


def _to_int(value: Any, default: int = 0) -> int:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_list(value: Any) -> List[str]:
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = str(value or "").split(",")

    result: List[str] = []
    seen = set()
    for item in raw_items:
        text = _clean_text(item)
        if not text:
            continue
        normalized = text.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        result.append(text)
    return result


def _resolve_placeholder(context: Dict[str, Any], path: str) -> Any:
    current: Any = context
    for chunk in path.split("."):
        if isinstance(current, dict):
            current = current.get(chunk)
        else:
            return None
    return current


def _render_template(template: str, variables: Dict[str, Any]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1).strip()
        value = _resolve_placeholder(variables, key)
        return "" if value is None else str(value)

    return re.sub(r"{{\s*([^{}]+)\s*}}", repl, str(template or ""))


class AIProvider(BaseModel, AuditMixin):
    __tablename__ = "ai_providers"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    name = Column(ColumnType.STRING, required=True, label="Name")
    slug = Column(ColumnType.STRING, required=True, label="Slug")
    provider_kind = Column(ColumnType.STRING, required=True, label="Provider Type")
    api_base_url = Column(ColumnType.STRING, label="Base URL")
    api_key = Column(ColumnType.STRING, label="API Key")
    auth_type = Column(ColumnType.STRING, default="bearer", label="Auth Type")
    default_model = Column(ColumnType.STRING, label="Default Model")
    available_models = Column(ColumnType.JSON, default=[], label="Available Models")
    capabilities = Column(ColumnType.JSON, default=["chat"], label="Capabilities")
    timeout_seconds = Column(ColumnType.INTEGER, default=60, label="Timeout")
    is_active = Column(ColumnType.BOOLEAN, default=True, label="Active")
    is_default = Column(ColumnType.BOOLEAN, default=False, label="Default")
    settings_json = Column(ColumnType.JSON, default={}, label="Settings")
    last_test_status = Column(ColumnType.STRING, default="pending", label="Last Test")
    last_test_error = Column(ColumnType.TEXT, label="Last Test Error")
    last_tested_at = Column(ColumnType.DATETIME, label="Last Tested At")

    def validate(self):
        super().validate()
        self.name = _clean_text(self.name)
        self.slug = _clean_slug(self.slug, self.name)
        self.provider_kind = _clean_text(self.provider_kind).lower()
        self.api_base_url = _clean_text(self.api_base_url)
        self.auth_type = _clean_text(self.auth_type, "bearer").lower()
        self.default_model = _clean_text(self.default_model)
        self.timeout_seconds = max(_to_int(self.timeout_seconds, 60), 1)
        self.available_models = _to_list(self.available_models)
        self.capabilities = _to_list(self.capabilities or ["chat"])

        if not self.name:
            raise ValidationError("Provider name is required")
        if self.provider_kind not in PROVIDER_KINDS:
            raise ValidationError(f"Provider type must be one of: {', '.join(PROVIDER_KINDS)}")
        if not self.capabilities:
            raise ValidationError("At least one capability is required")
        invalid_capabilities = [
            capability for capability in self.capabilities
            if capability.lower() not in DEFAULT_PROVIDER_CAPABILITIES
        ]
        if invalid_capabilities:
            raise ValidationError(
                f"Unsupported capabilities: {', '.join(invalid_capabilities)}"
            )

        duplicates = AIProvider.search(
            [("company_id", "=", self.company_id), ("slug", "=", self.slug)]
        )
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Another provider already uses this slug")

    @staticmethod
    def mask_secret(secret: Any) -> str:
        value = str(secret or "")
        if not value:
            return ""
        if len(value) <= 6:
            return "*" * len(value)
        return f"{value[:3]}{'*' * (len(value) - 6)}{value[-3:]}"

    def to_dict(self, include_secret: bool = False) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "name": self.name or "",
            "slug": self.slug or "",
            "provider_kind": self.provider_kind or "",
            "api_base_url": self.api_base_url or "",
            "api_key": self.api_key if include_secret else self.mask_secret(self.api_key),
            "auth_type": self.auth_type or "bearer",
            "default_model": self.default_model or "",
            "available_models": list(self.available_models or []),
            "capabilities": list(self.capabilities or []),
            "timeout_seconds": _to_int(self.timeout_seconds, 60),
            "is_active": bool(self.is_active),
            "is_default": bool(self.is_default),
            "settings_json": self.settings_json if isinstance(self.settings_json, dict) else {},
            "last_test_status": self.last_test_status or "pending",
            "last_test_error": self.last_test_error or "",
            "last_tested_at": _fmt_dt(self.last_tested_at),
        }


class AIPromptTemplate(BaseModel, AuditMixin):
    __tablename__ = "ai_prompt_templates"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    name = Column(ColumnType.STRING, required=True, label="Name")
    slug = Column(ColumnType.STRING, required=True, label="Slug")
    category = Column(ColumnType.STRING, default="general", label="Category")
    description = Column(ColumnType.TEXT, label="Description")
    system_prompt = Column(ColumnType.TEXT, label="System Prompt")
    user_prompt = Column(ColumnType.TEXT, label="User Prompt")
    input_variables = Column(ColumnType.JSON, default=[], label="Input Variables")
    tags = Column(ColumnType.JSON, default=[], label="Tags")
    preferred_provider = Column(ColumnType.STRING, label="Preferred Provider")
    preferred_model = Column(ColumnType.STRING, label="Preferred Model")
    temperature = Column(ColumnType.FLOAT, default=0.2, label="Temperature")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    version = Column(ColumnType.STRING, default="1.0.0", label="Version")

    def validate(self):
        super().validate()
        self.name = _clean_text(self.name)
        self.slug = _clean_slug(self.slug, self.name)
        self.category = _clean_text(self.category, "general").lower()
        self.input_variables = _to_list(self.input_variables)
        self.tags = _to_list(self.tags)
        self.preferred_provider = _clean_text(self.preferred_provider).lower()
        self.preferred_model = _clean_text(self.preferred_model)
        self.status = _clean_text(self.status, "draft").lower()
        self.version = _clean_text(self.version, "1.0.0")
        self.temperature = min(max(_to_float(self.temperature, 0.2), 0.0), 2.0)

        if not self.name:
            raise ValidationError("Prompt name is required")
        if self.status not in PROMPT_STATUSES:
            raise ValidationError(f"Prompt status must be one of: {', '.join(PROMPT_STATUSES)}")

        duplicates = AIPromptTemplate.search(
            [("company_id", "=", self.company_id), ("slug", "=", self.slug)]
        )
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Another prompt already uses this slug")

    def render(self, variables: Dict[str, Any]) -> Dict[str, str]:
        return {
            "system_prompt": _render_template(self.system_prompt or "", variables),
            "user_prompt": _render_template(self.user_prompt or "", variables),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "name": self.name or "",
            "slug": self.slug or "",
            "category": self.category or "general",
            "description": self.description or "",
            "system_prompt": self.system_prompt or "",
            "user_prompt": self.user_prompt or "",
            "input_variables": list(self.input_variables or []),
            "tags": list(self.tags or []),
            "preferred_provider": self.preferred_provider or "",
            "preferred_model": self.preferred_model or "",
            "temperature": _to_float(self.temperature, 0.2),
            "status": self.status or "draft",
            "version": self.version or "1.0.0",
            "updated_at": _fmt_dt(self.updated_at),
        }


class AIAgent(BaseModel, AuditMixin):
    __tablename__ = "ai_agents"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    name = Column(ColumnType.STRING, required=True, label="Name")
    slug = Column(ColumnType.STRING, required=True, label="Slug")
    description = Column(ColumnType.TEXT, label="Description")
    role = Column(ColumnType.STRING, default="assistant", label="Role")
    goal = Column(ColumnType.TEXT, label="Goal")
    instructions = Column(ColumnType.TEXT, label="Instructions")
    provider_id = Column(ColumnType.INTEGER, label="Provider")
    model_name = Column(ColumnType.STRING, label="Model")
    capabilities = Column(ColumnType.JSON, default=["chat"], label="Capabilities")
    tool_policy = Column(ColumnType.STRING, default="manual", label="Tool Policy")
    memory_policy = Column(ColumnType.STRING, default="session", label="Memory Policy")
    max_iterations = Column(ColumnType.INTEGER, default=6, label="Max Iterations")
    is_active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def validate(self):
        super().validate()
        self.name = _clean_text(self.name)
        self.slug = _clean_slug(self.slug, self.name)
        self.role = _clean_text(self.role, "assistant").lower()
        self.model_name = _clean_text(self.model_name)
        self.capabilities = _to_list(self.capabilities or ["chat"])
        self.tool_policy = _clean_text(self.tool_policy, "manual").lower()
        self.memory_policy = _clean_text(self.memory_policy, "session").lower()
        self.max_iterations = max(_to_int(self.max_iterations, 6), 1)

        if not self.name:
            raise ValidationError("Agent name is required")
        if self.tool_policy not in AGENT_TOOL_POLICIES:
            raise ValidationError(
                f"Tool policy must be one of: {', '.join(AGENT_TOOL_POLICIES)}"
            )
        if self.memory_policy not in AGENT_MEMORY_POLICIES:
            raise ValidationError(
                f"Memory policy must be one of: {', '.join(AGENT_MEMORY_POLICIES)}"
            )

        duplicates = AIAgent.search(
            [("company_id", "=", self.company_id), ("slug", "=", self.slug)]
        )
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Another agent already uses this slug")

    def to_dict(self) -> Dict[str, Any]:
        provider = AIProvider.find_by_id(self.provider_id) if self.provider_id else None
        return {
            "id": self.id,
            "company_id": self.company_id,
            "name": self.name or "",
            "slug": self.slug or "",
            "description": self.description or "",
            "role": self.role or "assistant",
            "goal": self.goal or "",
            "instructions": self.instructions or "",
            "provider_id": self.provider_id,
            "provider_name": provider.name if provider else "",
            "model_name": self.model_name or "",
            "capabilities": list(self.capabilities or []),
            "tool_policy": self.tool_policy or "manual",
            "memory_policy": self.memory_policy or "session",
            "max_iterations": _to_int(self.max_iterations, 6),
            "is_active": bool(self.is_active),
            "updated_at": _fmt_dt(self.updated_at),
        }


class AIExecution(BaseModel, AuditMixin):
    __tablename__ = "ai_executions"
    __displayname__ = "execution_type"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    execution_type = Column(ColumnType.STRING, required=True, label="Execution Type")
    status = Column(ColumnType.STRING, default="planned", label="Status")
    provider_id = Column(ColumnType.INTEGER, label="Provider")
    prompt_id = Column(ColumnType.INTEGER, label="Prompt")
    agent_id = Column(ColumnType.INTEGER, label="Agent")
    requested_model = Column(ColumnType.STRING, label="Requested Model")
    input_payload = Column(ColumnType.JSON, default={}, label="Input Payload")
    rendered_system_prompt = Column(ColumnType.TEXT, label="Rendered System Prompt")
    rendered_user_prompt = Column(ColumnType.TEXT, label="Rendered User Prompt")
    plan_summary = Column(ColumnType.TEXT, label="Plan Summary")
    planned_tools = Column(ColumnType.JSON, default=[], label="Planned Tools")
    result_preview = Column(ColumnType.TEXT, label="Result Preview")
    error_message = Column(ColumnType.TEXT, label="Error Message")
    executed_by = Column(ColumnType.INTEGER, label="Executed By")
    executed_at = Column(ColumnType.DATETIME, default=utc_now, label="Executed At")

    def validate(self):
        super().validate()
        self.execution_type = _clean_text(self.execution_type, "playground").lower()
        self.status = _clean_text(self.status, "planned").lower()
        self.requested_model = _clean_text(self.requested_model)
        self.planned_tools = _to_list(self.planned_tools)
        if self.status not in EXECUTION_STATUSES:
            raise ValidationError(f"Execution status must be one of: {', '.join(EXECUTION_STATUSES)}")

    def to_dict(self) -> Dict[str, Any]:
        provider = AIProvider.find_by_id(self.provider_id) if self.provider_id else None
        prompt = AIPromptTemplate.find_by_id(self.prompt_id) if self.prompt_id else None
        agent = AIAgent.find_by_id(self.agent_id) if self.agent_id else None
        return {
            "id": self.id,
            "company_id": self.company_id,
            "execution_type": self.execution_type or "",
            "status": self.status or "planned",
            "provider_id": self.provider_id,
            "provider_name": provider.name if provider else "",
            "prompt_id": self.prompt_id,
            "prompt_name": prompt.name if prompt else "",
            "agent_id": self.agent_id,
            "agent_name": agent.name if agent else "",
            "requested_model": self.requested_model or "",
            "input_payload": self.input_payload if isinstance(self.input_payload, dict) else {},
            "rendered_system_prompt": self.rendered_system_prompt or "",
            "rendered_user_prompt": self.rendered_user_prompt or "",
            "plan_summary": self.plan_summary or "",
            "planned_tools": list(self.planned_tools or []),
            "result_preview": self.result_preview or "",
            "error_message": self.error_message or "",
            "executed_by": self.executed_by,
            "executed_at": _fmt_dt(self.executed_at),
            "created_at": _fmt_dt(self.created_at),
        }


class AIModule(BaseModule):
    name = "AI"
    version = "1.0.0"
    author = "Your Company"
    description = "LLM, AI providers, prompts and agents orchestration"
    depends = ["base"]

    def init_module(self):
        self.register_model("ai.provider", AIProvider)
        self.register_model("ai.prompt", AIPromptTemplate)
        self.register_model("ai.agent", AIAgent)
        self.register_model("ai.execution", AIExecution)

        self.register_route("/ai/status", self.get_status, methods=["GET"], auth_required=True)
        self.register_route("/ai/providers", self.list_providers, methods=["GET"], auth_required=True)
        self.register_route("/ai/providers", self.create_provider, methods=["POST"], auth_required=True)
        self.register_route("/ai/providers/{id}", self.update_provider, methods=["PUT"], auth_required=True)
        self.register_route("/ai/prompts", self.list_prompts, methods=["GET"], auth_required=True)
        self.register_route("/ai/prompts", self.create_prompt, methods=["POST"], auth_required=True)
        self.register_route("/ai/prompts/{id}", self.update_prompt, methods=["PUT"], auth_required=True)
        self.register_route("/ai/agents", self.list_agents, methods=["GET"], auth_required=True)
        self.register_route("/ai/agents", self.create_agent, methods=["POST"], auth_required=True)
        self.register_route("/ai/agents/{id}", self.update_agent, methods=["PUT"], auth_required=True)
        self.register_route("/ai/executions", self.list_executions, methods=["GET"], auth_required=True)
        self.register_route("/ai/executions/plan", self.plan_execution, methods=["POST"], auth_required=True)
        self.register_route("/ai/prompts/{id}/preview", self.preview_prompt, methods=["POST"], auth_required=True)

        self.logger.info("AI module initialized")

    def _require_ai_access(self, admin_only: bool = False) -> Optional[Response]:
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        if user.role in ("superadmin", "company_admin"):
            return None
        if admin_only:
            return Response.forbidden("Only administrators can manage AI settings")
        allowed = set(user.allowed_modules or [])
        if allowed.intersection({"ai", "settings"}):
            return None
        return Response.forbidden("You do not have access to the AI module")

    def _company_id(self, request: Request) -> int:
        user = self.env.user
        if user and user.company_id:
            return user.company_id
        return request.company_id

    def _apply_default_provider(self, company_id: int, provider_id: int):
        for provider in AIProvider.search([("company_id", "=", company_id)]):
            should_be_default = provider.id == provider_id
            if bool(provider.is_default) != should_be_default:
                provider.is_default = should_be_default
                provider.save()

    def _resolve_provider(self, request: Request, payload: Dict[str, Any]) -> Optional[AIProvider]:
        provider_id = payload.get("provider_id") or request.get_data("provider_id") or request.get_param("provider_id")
        company_id = self._company_id(request)

        if provider_id:
            provider = AIProvider.find_by_id(int(provider_id))
            if not provider or provider.company_id != company_id:
                raise ValidationError("Provider not found")
            if not provider.is_active:
                raise ValidationError("Provider is inactive")
            return provider

        providers = AIProvider.search([("company_id", "=", company_id)])
        default_providers = [
            provider for provider in providers if bool(provider.is_active) and bool(provider.is_default)
        ]
        if default_providers:
            return default_providers[0]

        active_providers = [provider for provider in providers if bool(provider.is_active)]
        if active_providers:
            return active_providers[0]
        return None

    def _provider_summary(self, company_id: int) -> Dict[str, Any]:
        providers = AIProvider.search([("company_id", "=", company_id)])
        active = [provider for provider in providers if bool(provider.is_active)]
        default_provider = next((provider for provider in active if bool(provider.is_default)), None)
        capabilities = sorted(
            {
                capability.lower()
                for provider in active
                for capability in list(provider.capabilities or [])
            }
        )
        return {
            "configured": bool(active),
            "total": len(providers),
            "active": len(active),
            "default_provider": default_provider.to_dict() if default_provider else None,
            "capabilities": capabilities,
        }

    def _build_plan_summary(
        self,
        *,
        provider: Optional[AIProvider],
        prompt: Optional[AIPromptTemplate],
        agent: Optional[AIAgent],
        rendered: Dict[str, str],
        variables: Dict[str, Any],
    ) -> str:
        parts = []
        if provider:
            parts.append(f"Proveedor: {provider.name} ({provider.provider_kind})")
        else:
            parts.append("Proveedor: pendiente de configurar")
        if prompt:
            parts.append(f"Prompt: {prompt.name} v{prompt.version}")
        if agent:
            parts.append(f"Agente: {agent.name} ({agent.role})")
        if rendered.get("system_prompt"):
            parts.append("Incluye instrucciones de sistema")
        if rendered.get("user_prompt"):
            parts.append("Incluye mensaje de usuario renderizado")
        if variables:
            parts.append(f"Variables recibidas: {', '.join(sorted(variables.keys()))}")
        return " | ".join(parts)

    async def get_status(self, request: Request) -> Response:
        access_error = self._require_ai_access()
        if access_error:
            return access_error

        company_id = self._company_id(request)
        providers = AIProvider.search([("company_id", "=", company_id)])
        prompts = AIPromptTemplate.search([("company_id", "=", company_id)])
        agents = AIAgent.search([("company_id", "=", company_id)])
        executions = AIExecution.search([("company_id", "=", company_id)])

        provider_summary = self._provider_summary(company_id)
        active_prompts = [prompt for prompt in prompts if (prompt.status or "draft") == "active"]
        active_agents = [agent for agent in agents if bool(agent.is_active)]
        latest_executions = sorted(
            executions,
            key=lambda execution: _fmt_dt(execution.executed_at) or "",
            reverse=True,
        )[:5]

        return Response.ok(
            {
                "providers": provider_summary,
                "prompts": {
                    "total": len(prompts),
                    "active": len(active_prompts),
                    "categories": sorted({prompt.category or "general" for prompt in prompts}),
                },
                "agents": {
                    "total": len(agents),
                    "active": len(active_agents),
                    "tool_policies": sorted({agent.tool_policy or "manual" for agent in agents}),
                },
                "executions": {
                    "total": len(executions),
                    "recent": [execution.to_dict() for execution in latest_executions],
                },
                "future_ready": {
                    "provider_switching": True,
                    "prompt_versioning": True,
                    "agent_registry": True,
                    "execution_audit_log": True,
                    "external_calls_enabled": False,
                },
            }
        )

    async def list_providers(self, request: Request) -> Response:
        access_error = self._require_ai_access()
        if access_error:
            return access_error
        company_id = self._company_id(request)
        providers = AIProvider.search([("company_id", "=", company_id)])
        providers = sorted(providers, key=lambda provider: provider.name or "")
        return Response.ok(
            {
                "count": len(providers),
                "results": [provider.to_dict() for provider in providers],
                "supported_provider_kinds": list(PROVIDER_KINDS),
            }
        )

    async def create_provider(self, request: Request) -> Response:
        access_error = self._require_ai_access(admin_only=True)
        if access_error:
            return access_error

        provider = AIProvider.create(
            {
                "company_id": self._company_id(request),
                "name": request.get_data("name"),
                "slug": request.get_data("slug") or _clean_slug(request.get_data("name")),
                "provider_kind": request.get_data("provider_kind"),
                "api_base_url": request.get_data("api_base_url"),
                "api_key": request.get_data("api_key"),
                "auth_type": request.get_data("auth_type", "bearer"),
                "default_model": request.get_data("default_model"),
                "available_models": request.get_data("available_models", []),
                "capabilities": request.get_data("capabilities", ["chat"]),
                "timeout_seconds": request.get_data("timeout_seconds", 60),
                "is_active": _to_bool(request.get_data("is_active"), True),
                "is_default": _to_bool(request.get_data("is_default"), False),
                "settings_json": request.get_data("settings_json", {}),
                "last_test_status": "not_tested",
            }
        )
        provider.save()

        if provider.is_default:
            self._apply_default_provider(provider.company_id, provider.id)

        return Response.created(provider.to_dict())

    async def update_provider(self, request: Request) -> Response:
        access_error = self._require_ai_access(admin_only=True)
        if access_error:
            return access_error

        provider = AIProvider.find_by_id(int(request.get_param("id")))
        if not provider or provider.company_id != self._company_id(request):
            return Response.bad_request("Provider not found")

        for field_name in (
            "name",
            "slug",
            "provider_kind",
            "api_base_url",
            "api_key",
            "auth_type",
            "default_model",
            "available_models",
            "capabilities",
            "timeout_seconds",
            "settings_json",
        ):
            if field_name in request.data:
                setattr(provider, field_name, request.get_data(field_name))

        if "is_active" in request.data:
            provider.is_active = _to_bool(request.get_data("is_active"))
        if "is_default" in request.data:
            provider.is_default = _to_bool(request.get_data("is_default"))

        provider.last_test_status = request.get_data("last_test_status", provider.last_test_status)
        provider.last_test_error = request.get_data("last_test_error", provider.last_test_error)
        if "last_tested_at" in request.data:
            provider.last_tested_at = request.get_data("last_tested_at")
        provider.save()

        if provider.is_default:
            self._apply_default_provider(provider.company_id, provider.id)

        return Response.ok(provider.to_dict())

    async def list_prompts(self, request: Request) -> Response:
        access_error = self._require_ai_access()
        if access_error:
            return access_error
        company_id = self._company_id(request)
        prompts = AIPromptTemplate.search([("company_id", "=", company_id)])
        prompts = sorted(prompts, key=lambda prompt: prompt.name or "")
        return Response.ok(
            {
                "count": len(prompts),
                "results": [prompt.to_dict() for prompt in prompts],
                "supported_statuses": list(PROMPT_STATUSES),
            }
        )

    async def create_prompt(self, request: Request) -> Response:
        access_error = self._require_ai_access(admin_only=True)
        if access_error:
            return access_error

        prompt = AIPromptTemplate.create(
            {
                "company_id": self._company_id(request),
                "name": request.get_data("name"),
                "slug": request.get_data("slug") or _clean_slug(request.get_data("name")),
                "category": request.get_data("category", "general"),
                "description": request.get_data("description"),
                "system_prompt": request.get_data("system_prompt"),
                "user_prompt": request.get_data("user_prompt"),
                "input_variables": request.get_data("input_variables", []),
                "tags": request.get_data("tags", []),
                "preferred_provider": request.get_data("preferred_provider"),
                "preferred_model": request.get_data("preferred_model"),
                "temperature": request.get_data("temperature", 0.2),
                "status": request.get_data("status", "draft"),
                "version": request.get_data("version", "1.0.0"),
            }
        )
        prompt.save()
        return Response.created(prompt.to_dict())

    async def update_prompt(self, request: Request) -> Response:
        access_error = self._require_ai_access(admin_only=True)
        if access_error:
            return access_error

        prompt = AIPromptTemplate.find_by_id(int(request.get_param("id")))
        if not prompt or prompt.company_id != self._company_id(request):
            return Response.bad_request("Prompt not found")

        for field_name in (
            "name",
            "slug",
            "category",
            "description",
            "system_prompt",
            "user_prompt",
            "input_variables",
            "tags",
            "preferred_provider",
            "preferred_model",
            "temperature",
            "status",
            "version",
        ):
            if field_name in request.data:
                setattr(prompt, field_name, request.get_data(field_name))

        prompt.save()
        return Response.ok(prompt.to_dict())

    async def preview_prompt(self, request: Request) -> Response:
        access_error = self._require_ai_access()
        if access_error:
            return access_error

        prompt = AIPromptTemplate.find_by_id(int(request.get_param("id")))
        if not prompt or prompt.company_id != self._company_id(request):
            return Response.bad_request("Prompt not found")

        variables = request.get_data("variables", {})
        if not isinstance(variables, dict):
            return Response.bad_request("Variables must be a JSON object")

        return Response.ok(
            {
                "prompt": prompt.to_dict(),
                "rendered": prompt.render(variables),
            }
        )

    async def list_agents(self, request: Request) -> Response:
        access_error = self._require_ai_access()
        if access_error:
            return access_error
        company_id = self._company_id(request)
        agents = AIAgent.search([("company_id", "=", company_id)])
        agents = sorted(agents, key=lambda agent: agent.name or "")
        return Response.ok(
            {
                "count": len(agents),
                "results": [agent.to_dict() for agent in agents],
                "supported_tool_policies": list(AGENT_TOOL_POLICIES),
                "supported_memory_policies": list(AGENT_MEMORY_POLICIES),
            }
        )

    async def create_agent(self, request: Request) -> Response:
        access_error = self._require_ai_access(admin_only=True)
        if access_error:
            return access_error

        agent = AIAgent.create(
            {
                "company_id": self._company_id(request),
                "name": request.get_data("name"),
                "slug": request.get_data("slug") or _clean_slug(request.get_data("name")),
                "description": request.get_data("description"),
                "role": request.get_data("role", "assistant"),
                "goal": request.get_data("goal"),
                "instructions": request.get_data("instructions"),
                "provider_id": request.get_data("provider_id"),
                "model_name": request.get_data("model_name"),
                "capabilities": request.get_data("capabilities", ["chat"]),
                "tool_policy": request.get_data("tool_policy", "manual"),
                "memory_policy": request.get_data("memory_policy", "session"),
                "max_iterations": request.get_data("max_iterations", 6),
                "is_active": _to_bool(request.get_data("is_active"), True),
            }
        )
        agent.save()
        return Response.created(agent.to_dict())

    async def update_agent(self, request: Request) -> Response:
        access_error = self._require_ai_access(admin_only=True)
        if access_error:
            return access_error

        agent = AIAgent.find_by_id(int(request.get_param("id")))
        if not agent or agent.company_id != self._company_id(request):
            return Response.bad_request("Agent not found")

        for field_name in (
            "name",
            "slug",
            "description",
            "role",
            "goal",
            "instructions",
            "provider_id",
            "model_name",
            "capabilities",
            "tool_policy",
            "memory_policy",
            "max_iterations",
        ):
            if field_name in request.data:
                setattr(agent, field_name, request.get_data(field_name))

        if "is_active" in request.data:
            agent.is_active = _to_bool(request.get_data("is_active"))

        agent.save()
        return Response.ok(agent.to_dict())

    async def list_executions(self, request: Request) -> Response:
        access_error = self._require_ai_access()
        if access_error:
            return access_error
        company_id = self._company_id(request)
        executions = AIExecution.search([("company_id", "=", company_id)])
        executions = sorted(
            executions,
            key=lambda execution: _fmt_dt(execution.executed_at) or "",
            reverse=True,
        )
        return Response.ok(
            {
                "count": len(executions),
                "results": [execution.to_dict() for execution in executions[:50]],
            }
        )

    async def plan_execution(self, request: Request) -> Response:
        access_error = self._require_ai_access()
        if access_error:
            return access_error

        company_id = self._company_id(request)
        variables = request.get_data("variables", {})
        if variables is None:
            variables = {}
        if not isinstance(variables, dict):
            return Response.bad_request("Variables must be a JSON object")

        prompt = None
        prompt_id = request.get_data("prompt_id")
        if prompt_id:
            prompt = AIPromptTemplate.find_by_id(int(prompt_id))
            if not prompt or prompt.company_id != company_id:
                return Response.bad_request("Prompt not found")

        agent = None
        agent_id = request.get_data("agent_id")
        if agent_id:
            agent = AIAgent.find_by_id(int(agent_id))
            if not agent or agent.company_id != company_id:
                return Response.bad_request("Agent not found")

        try:
            provider = self._resolve_provider(request, request.data)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

        rendered = prompt.render(variables) if prompt else {
            "system_prompt": _render_template(request.get_data("system_prompt", ""), variables),
            "user_prompt": _render_template(request.get_data("user_prompt", ""), variables),
        }
        requested_model = _clean_text(
            request.get_data("model_name")
            or (agent.model_name if agent else "")
            or (prompt.preferred_model if prompt else "")
            or (provider.default_model if provider else "")
        )
        planned_tools = request.get_data("planned_tools")
        if planned_tools in (None, ""):
            planned_tools = list(agent.capabilities or []) if agent else ["chat"]
        planned_tools = _to_list(planned_tools)
        plan_summary = self._build_plan_summary(
            provider=provider,
            prompt=prompt,
            agent=agent,
            rendered=rendered,
            variables=variables,
        )

        execution = AIExecution.create(
            {
                "company_id": company_id,
                "execution_type": request.get_data("execution_type", "playground"),
                "status": "planned" if provider else "simulated",
                "provider_id": provider.id if provider else None,
                "prompt_id": prompt.id if prompt else None,
                "agent_id": agent.id if agent else None,
                "requested_model": requested_model,
                "input_payload": variables,
                "rendered_system_prompt": rendered.get("system_prompt", ""),
                "rendered_user_prompt": rendered.get("user_prompt", ""),
                "plan_summary": plan_summary,
                "planned_tools": planned_tools,
                "result_preview": (
                    "Integracion externa pendiente. Esta ejecucion deja plan, contexto y auditoria listos."
                ),
                "executed_by": self.env.user.id if self.env.user else None,
                "executed_at": utc_now(),
            }
        )
        execution.save()

        return Response.created(
            {
                "execution": execution.to_dict(),
                "rendered": rendered,
                "provider": provider.to_dict() if provider else None,
                "agent": agent.to_dict() if agent else None,
                "prompt": prompt.to_dict() if prompt else None,
                "next_step": (
                    "Conectar el adaptador real del proveedor para reemplazar la simulacion."
                    if provider
                    else "Configurar un proveedor activo para habilitar llamadas reales."
                ),
            }
        )
