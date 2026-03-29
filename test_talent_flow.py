import sys
import unittest

sys.path.append(r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.hr.module_hr import HRModule, Department, EmployeeProfile, EmployeeContract
from modules.recruitment.module_recruitment import RecruitmentModule, JobApplication


class TalentFlowTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "hr", "recruitment"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(HRModule)
        self.framework.register_module_class(RecruitmentModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None):
        request = Request(path=path, method=method, params={}, data=data or {}, headers={})
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def test_hiring_pipeline_creates_hr_employee_and_contract(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "talent.admin@example.com",
                "name": "Talent Admin",
                "password": "securepass123",
                "company_name": "Talent Corp",
            },
        )
        self.assertEqual(register_res.status, 201)
        self.assertIn("recruitment", register_res.data["user"]["allowed_modules"])
        self.assertIn("hr", register_res.data["user"]["allowed_modules"])

        admin = User.search([("email", "=", "talent.admin@example.com")])[0]
        departments = Department.search([("company_id", "=", admin.company_id)])
        self.assertGreaterEqual(len(departments), 1)

        job_res = await self.dispatch(
            "/recruitment/jobs",
            method="POST",
            user=admin,
            data={
                "title": "Analista RRHH",
                "department_id": departments[0].id,
                "status": "published",
                "employment_type": "full_time",
                "work_mode": "hybrid",
                "openings_count": 1,
                "salary_min": 1200000,
                "salary_max": 1600000,
            },
        )
        self.assertEqual(job_res.status, 201)
        job_id = job_res.data["id"]

        candidate_res = await self.dispatch(
            "/recruitment/candidates",
            method="POST",
            user=admin,
            data={
                "full_name": "Paula Candidato",
                "email": "paula.candidato@example.com",
                "phone": "+56912345678",
                "current_position": "Analista",
                "expected_salary": 1500000,
                "source": "LinkedIn",
            },
        )
        self.assertEqual(candidate_res.status, 201)
        candidate_id = candidate_res.data["id"]

        stages_res = await self.dispatch("/recruitment/stages", user=admin)
        self.assertEqual(stages_res.status, 200)
        first_stage_id = stages_res.data["results"][0]["id"]

        app_res = await self.dispatch(
            "/recruitment/applications",
            method="POST",
            user=admin,
            data={
                "job_id": job_id,
                "candidate_id": candidate_id,
                "stage_id": first_stage_id,
                "status": "active",
                "score": 92,
            },
        )
        self.assertEqual(app_res.status, 201)
        application_id = app_res.data["id"]

        hire_res = await self.dispatch(
            f"/recruitment/applications/{application_id}/hire",
            method="POST",
            user=admin,
            data={
                "department_id": departments[0].id,
                "hire_date": "2026-04-01",
                "salary_amount": 1550000,
                "contract_type": "indefinite",
            },
        )
        self.assertEqual(hire_res.status, 201)
        self.assertEqual(EmployeeProfile.count([("company_id", "=", admin.company_id)]), 1)
        self.assertEqual(EmployeeContract.count([("company_id", "=", admin.company_id)]), 1)

        application = JobApplication.find_by_id(application_id)
        self.assertEqual(application.status, "hired")
        self.assertIsNotNone(application.hired_employee_id)

        hr_stats = await self.dispatch("/hr/stats", user=admin)
        self.assertEqual(hr_stats.status, 200)
        self.assertEqual(hr_stats.data["employees_total"], 1)
        self.assertEqual(hr_stats.data["contracts_active"], 1)


if __name__ == "__main__":
    unittest.main()
