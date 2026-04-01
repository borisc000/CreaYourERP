import sys
import unittest

sys.path.append(r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.ai.module_ai import AIModule
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User


class AIModuleTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "ai"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(AIModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, params=None, user=None):
        request = Request(
            path=path,
            method=method,
            params=params or {},
            data=data or {},
            headers={},
        )
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def test_ai_setup_and_execution_plan(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "ai.admin@acme.cl",
                "name": "AI Admin",
                "password": "securepass123",
                "company_name": "AI Company",
            },
        )
        self.assertEqual(register_res.status, 201)
        self.assertIn("ai", register_res.data["user"]["allowed_modules"])

        admin = User.search([("email", "=", "ai.admin@acme.cl")])[0]

        provider_res = await self.dispatch(
            "/ai/providers",
            method="POST",
            user=admin,
            data={
                "name": "OpenAI Core",
                "provider_kind": "openai",
                "default_model": "gpt-4.1-mini",
                "capabilities": ["chat", "tools"],
                "api_base_url": "https://api.openai.com/v1",
                "api_key": "sk-test-123456789",
                "available_models": ["gpt-4.1-mini", "gpt-4.1"],
                "is_default": True,
            },
        )
        self.assertEqual(provider_res.status, 201)

        prompt_res = await self.dispatch(
            "/ai/prompts",
            method="POST",
            user=admin,
            data={
                "name": "Resumen de incidente",
                "category": "seguridad",
                "system_prompt": "Eres un asesor SST.",
                "user_prompt": "Resume el incidente {{incidente}} para {{empresa}}.",
                "input_variables": ["incidente", "empresa"],
                "status": "active",
            },
        )
        self.assertEqual(prompt_res.status, 201)
        prompt_id = prompt_res.data["id"]

        agent_res = await self.dispatch(
            "/ai/agents",
            method="POST",
            user=admin,
            data={
                "name": "Agente SST",
                "role": "safety-analyst",
                "goal": "Analizar incidentes y proponer acciones",
                "instructions": "Responde en formato ejecutivo",
                "tool_policy": "manual",
                "memory_policy": "workflow",
            },
        )
        self.assertEqual(agent_res.status, 201)
        agent_id = agent_res.data["id"]

        preview_res = await self.dispatch(
            f"/ai/prompts/{prompt_id}/preview",
            method="POST",
            user=admin,
            data={"variables": {"incidente": "Caida menor", "empresa": "Acme"}},
        )
        self.assertEqual(preview_res.status, 200)
        self.assertIn("Caida menor", preview_res.data["rendered"]["user_prompt"])

        plan_res = await self.dispatch(
            "/ai/executions/plan",
            method="POST",
            user=admin,
            data={
                "prompt_id": prompt_id,
                "agent_id": agent_id,
                "variables": {"incidente": "Caida menor", "empresa": "Acme"},
            },
        )
        self.assertEqual(plan_res.status, 201)
        self.assertEqual(plan_res.data["execution"]["status"], "planned")
        self.assertEqual(plan_res.data["provider"]["name"], "OpenAI Core")
        self.assertIn("Acme", plan_res.data["rendered"]["user_prompt"])

        status_res = await self.dispatch("/ai/status", user=admin)
        self.assertEqual(status_res.status, 200)
        self.assertTrue(status_res.data["providers"]["configured"])
        self.assertEqual(status_res.data["prompts"]["active"], 1)
        self.assertEqual(status_res.data["agents"]["active"], 1)
        self.assertEqual(status_res.data["executions"]["total"], 1)


if __name__ == "__main__":
    unittest.main()
