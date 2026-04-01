import sys
import unittest
import base64
import io
import zipfile
import importlib.util
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qsl
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as reportlab_canvas

sys.path.append(r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.crm.module_crm import CRMModule
from modules.document_center.module_document_center import DocumentCenterModule
from modules.hr.module_hr import HRModule, Department, EmployeeProfile, EmployeeContract
from modules.payroll.module_payroll import PayrollModule, PayrollProfile
from modules.recruitment.module_recruitment import RecruitmentModule, JobApplication
from modules.signature.module_signature import SignatureModule, SignatureRequest


class TalentFlowTest(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _minimal_docx_base64(text: str) -> str:
        buffer = io.BytesIO()
        xml_text = escape(text)
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
    <w:p><w:r><w:t>{xml_text}</w:t></w:r></w:p>
  </w:body>
</w:document>""",
            )
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    @staticmethod
    def _signature_png_data_url() -> str:
        return (
            "data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFAAH"
            "/gmW0WQAAAABJRU5ErkJggg=="
        )

    @staticmethod
    def _minimal_pdf_base64(text: str = "Documento") -> str:
        buffer = io.BytesIO()
        pdf = reportlab_canvas.Canvas(buffer, pagesize=A4)
        pdf.drawString(72, 760, text)
        pdf.save()
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "signature", "document_center", "crm", "hr", "payroll", "recruitment"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(SignatureModule)
        self.framework.register_module_class(DocumentCenterModule)
        self.framework.register_module_class(CRMModule)
        self.framework.register_module_class(HRModule)
        self.framework.register_module_class(PayrollModule)
        self.framework.register_module_class(RecruitmentModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None, params=None):
        raw_path, _, query_string = path.partition("?")
        query_params = dict(parse_qsl(query_string))
        if params:
            query_params.update(params)
        request = Request(path=raw_path, method=method, params=query_params, data=data or {}, headers={})
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
                "national_id": "12.345.678-5",
                "birth_date": "1994-04-10",
                "address": "Av. Siempre Viva 123",
                "commune": "Santiago",
                "city": "Santiago",
                "region": "Metropolitana",
                "health_system": "fonasa",
                "afp_code": "uno",
                "emergency_contact_name": "Mario Candidato",
                "emergency_contact_phone": "+56988887777",
                "criminal_record_status": "clear",
                "courses": ["Trabajo en altura", "Induccion minera"],
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
                "proposed_salary": 1550000,
                "projected_start_date": "2026-04-01",
                "contract_type": "indefinite",
                "work_schedule": "Lun a Vie 08:30-18:00",
                "shift_pattern": "5x2",
                "work_location": "Santiago Centro",
                "assigned_customer": "Cliente Interno",
                "assigned_service": "Soporte RRHH",
                "required_documents": ["Cedula vigente", "Antecedentes"],
                "required_courses": ["Trabajo en altura"],
            },
        )
        self.assertEqual(app_res.status, 201)
        application_id = app_res.data["id"]

        interview_res = await self.dispatch(
            "/recruitment/interviews",
            method="POST",
            user=admin,
            data={
                "application_id": application_id,
                "interview_type": "technical",
                "scheduled_at": "2026-03-30T10:30",
                "result": "passed",
                "duration_minutes": 75,
                "overall_score": 94,
                "technical_score": 95,
                "communication_score": 88,
                "safety_score": 90,
                "cultural_score": 92,
                "recommendation": "strong_yes",
                "pending_documents": ["Cedula vigente"],
            },
        )
        self.assertEqual(interview_res.status, 201)
        self.assertEqual(interview_res.data["overall_score"], 94)

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
        self.assertEqual(PayrollProfile.count([("company_id", "=", admin.company_id)]), 1)

        application = JobApplication.find_by_id(application_id)
        self.assertEqual(application.status, "hired")
        self.assertIsNotNone(application.hired_employee_id)

        employee = EmployeeProfile.find_by_id(application.hired_employee_id)
        self.assertEqual(employee.national_id, "12345678-5")
        self.assertEqual(employee.health_system, "fonasa")
        self.assertEqual(employee.afp_code, "uno")
        self.assertEqual(employee.city, "Santiago")
        self.assertEqual(employee.criminal_record_status, "clear")
        self.assertIn("Trabajo en altura", employee.courses or [])

        payroll_profile = PayrollProfile.search([("employee_id", "=", employee.id)])[0]
        self.assertEqual(payroll_profile.national_id, "12345678-5")
        self.assertEqual(payroll_profile.afp_code, "uno")
        self.assertEqual(payroll_profile.health_system, "fonasa")

        hr_stats = await self.dispatch("/hr/stats", user=admin)
        self.assertEqual(hr_stats.status, 200)
        self.assertEqual(hr_stats.data["employees_total"], 1)
        self.assertEqual(hr_stats.data["contracts_active"], 1)

    async def test_accreditation_matrix_combines_global_and_customer_specific_requirements(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "accreditation.admin@example.com",
                "name": "Accreditation Admin",
                "password": "securepass123",
                "company_name": "Accreditation Corp",
            },
        )
        self.assertEqual(register_res.status, 201)

        admin = User.search([("email", "=", "accreditation.admin@example.com")])[0]
        department = Department.search([("company_id", "=", admin.company_id)])[0]

        employee_res = await self.dispatch(
            "/hr/employees",
            method="POST",
            user=admin,
            data={
                "full_name": "Carlos Operador",
                "department_id": department.id,
                "position_title": "Operador Planta",
                "work_email": "carlos.operador@example.com",
                "status": "active",
                "hire_date": "2026-03-01",
                "create_user_account": False,
            },
        )
        self.assertEqual(employee_res.status, 201)
        employee_id = employee_res.data["employee"]["id"]

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={
                "name": "Minera Norte",
                "tax_id": "76.123.456-7",
            },
        )
        self.assertEqual(customer_res.status, 201)
        customer_id = customer_res.data["id"]

        requirement_res = await self.dispatch(
            "/hr/accreditation/requirements",
            method="POST",
            user=admin,
            data={
                "name": "Credencial interna Minera Norte",
                "code": "CRED_MINERA_NORTE",
                "category": "client_specific",
                "customer_id": customer_id,
                "tracks_expiration": True,
                "warning_days": 10,
            },
        )
        self.assertEqual(requirement_res.status, 201)
        specific_requirement_id = requirement_res.data["id"]

        requirements_res = await self.dispatch(
            f"/hr/accreditation/requirements?customer_id={customer_id}",
            user=admin,
        )
        self.assertEqual(requirements_res.status, 200)
        requirements = requirements_res.data["results"]
        requirements_by_code = {item["code"]: item for item in requirements}
        self.assertIn("DOC_ID", requirements_by_code)
        self.assertIn("EXAMEN_PREOCUPACIONAL", requirements_by_code)
        self.assertEqual(requirements_by_code["CRED_MINERA_NORTE"]["id"], specific_requirement_id)

        today = datetime.now().date()
        expiring_date = (today + timedelta(days=7)).isoformat()
        expired_date = (today - timedelta(days=1)).isoformat()
        valid_date = (today + timedelta(days=45)).isoformat()

        doc_id_res = await self.dispatch(
            "/hr/accreditation/documents",
            method="POST",
            user=admin,
            data={
                "employee_id": employee_id,
                "requirement_id": requirements_by_code["DOC_ID"]["id"],
                "document_name": "Cedula Carlos Operador",
                "expires_on": expiring_date,
                "verification_status": "approved",
            },
        )
        self.assertIn(doc_id_res.status, (200, 201))

        medical_res = await self.dispatch(
            "/hr/accreditation/documents",
            method="POST",
            user=admin,
            data={
                "employee_id": employee_id,
                "requirement_id": requirements_by_code["EXAMEN_PREOCUPACIONAL"]["id"],
                "document_name": "Examen preocupacional",
                "expires_on": expired_date,
                "verification_status": "approved",
            },
        )
        self.assertIn(medical_res.status, (200, 201))

        specific_res = await self.dispatch(
            "/hr/accreditation/documents",
            method="POST",
            user=admin,
            data={
                "employee_id": employee_id,
                "requirement_id": specific_requirement_id,
                "document_name": "Credencial interna",
                "expires_on": valid_date,
                "verification_status": "approved",
            },
        )
        self.assertIn(specific_res.status, (200, 201))

        matrix_res = await self.dispatch(
            f"/hr/accreditation/matrix?customer_id={customer_id}",
            user=admin,
        )
        self.assertEqual(matrix_res.status, 200)
        self.assertEqual(matrix_res.data["summary"]["employees_total"], 1)
        self.assertEqual(matrix_res.data["summary"]["requirements_total"], 6)
        self.assertEqual(matrix_res.data["summary"]["expiring_documents"], 1)
        self.assertEqual(matrix_res.data["summary"]["expired_documents"], 1)
        self.assertEqual(matrix_res.data["summary"]["valid_documents"], 1)
        self.assertGreaterEqual(matrix_res.data["summary"]["missing_documents"], 3)
        self.assertEqual(matrix_res.data["summary"]["non_compliant"], 1)

        row = matrix_res.data["rows"][0]
        self.assertEqual(row["overall_status"], "non_compliant")
        self.assertEqual(row["counts"]["expiring"], 1)
        self.assertEqual(row["counts"]["expired"], 1)
        self.assertEqual(row["counts"]["valid"], 1)

        detail_res = await self.dispatch(
            f"/hr/accreditation/employees/{employee_id}?customer_id={customer_id}",
            user=admin,
        )
        self.assertEqual(detail_res.status, 200)
        detail_codes = {
            item["requirement"]["code"]: item["status"]
            for item in detail_res.data["items"]
        }
        self.assertEqual(detail_codes["DOC_ID"], "expiring")
        self.assertEqual(detail_codes["EXAMEN_PREOCUPACIONAL"], "expired")
        self.assertEqual(detail_codes["CRED_MINERA_NORTE"], "valid")

    async def test_document_center_generates_documents_and_connects_signature_flow(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "docs.admin@example.com",
                "name": "Docs Admin",
                "password": "securepass123",
                "company_name": "Docs Corp",
            },
        )
        self.assertEqual(register_res.status, 201)
        admin = User.search([("email", "=", "docs.admin@example.com")])[0]

        template_res = await self.dispatch(
            "/document-center/templates",
            method="POST",
            user=admin,
            data={
                "name": "Contrato Plazo Fijo",
                "document_type": "contract_fixed_term",
                "category": "rrhh",
                "target_module": "hr",
                "requires_signature": True,
                "filename_pattern": "Contrato_<<nombre>>",
                "original_filename": "contrato_plazo_fijo.docx",
                "template_data": self._minimal_docx_base64("Contrato para <<nombre>> con RUT <<rut>>"),
            },
        )
        self.assertEqual(template_res.status, 201)
        template_id = template_res.data["id"]
        self.assertIn("nombre", template_res.data["placeholder_keys"])
        self.assertIn("rut", template_res.data["placeholder_keys"])

        preview_res = await self.dispatch(
            "/document-center/data-sources/preview",
            method="POST",
            user=admin,
            data={
                "template_id": template_id,
                "source_type": "manual_json",
                "rows": [
                    {"nombre": "Ana Trabajadora", "rut": "11.111.111-1", "email": "ana.trabajadora@example.com"},
                    {"nombre": "Luis Operador", "rut": "22.222.222-2", "email": "luis.operador@example.com"},
                ],
            },
        )
        self.assertEqual(preview_res.status, 200)
        self.assertEqual(preview_res.data["row_count"], 2)
        self.assertEqual(preview_res.data["mapping"]["nombre"], "nombre")

        batch_res = await self.dispatch(
            "/document-center/batches/generate",
            method="POST",
            user=admin,
            data={
                "template_id": template_id,
                "source_type": "manual_json",
                "batch_name": "Contratos marzo",
                "target_module": "hr",
                "recipient_email_column": "email",
                "recipient_name_column": "nombre",
                "row_key_column": "rut",
                "rows": [
                    {"nombre": "Ana Trabajadora", "rut": "11.111.111-1", "email": "ana.trabajadora@example.com"},
                    {"nombre": "Luis Operador", "rut": "22.222.222-2", "email": "luis.operador@example.com"},
                ],
                "mapping": {"nombre": "nombre", "rut": "rut"},
            },
        )
        self.assertEqual(batch_res.status, 201)
        self.assertEqual(batch_res.data["summary"]["rows_succeeded"], 2)
        first_document_id = batch_res.data["generated_document_ids"][0]

        documents_res = await self.dispatch("/document-center/generated", user=admin)
        self.assertEqual(documents_res.status, 200)
        self.assertEqual(documents_res.data["count"], 2)

        document_detail_res = await self.dispatch(
            f"/document-center/generated/{first_document_id}",
            user=admin,
        )
        self.assertEqual(document_detail_res.status, 200)
        self.assertEqual(document_detail_res.data["status"], "ready_for_review")

        docx_res = await self.dispatch(
            f"/document-center/generated/{first_document_id}/content?format=docx",
            user=admin,
        )
        self.assertEqual(docx_res.status, 200)
        self.assertTrue(docx_res.data["data"])

        approve_res = await self.dispatch(
            f"/document-center/generated/{first_document_id}/approve",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(approve_res.status, 200)
        self.assertEqual(approve_res.data["status"], "approved")

        layout_res = await self.dispatch(
            f"/document-center/generated/{first_document_id}/signature-layout",
            method="POST",
            user=admin,
            data={
                "signature_positions": [
                    {"page": 0, "x": 220, "y": 640, "width": 180, "height": 72, "required": True}
                ]
            },
        )
        self.assertEqual(layout_res.status, 200)
        self.assertTrue(layout_res.data["signature_positions"])

        send_res = await self.dispatch(
            f"/document-center/generated/{first_document_id}/send-signature",
            method="POST",
            user=admin,
            data={"layout_confirmed": True},
        )
        self.assertEqual(send_res.status, 200)
        self.assertEqual(send_res.data["status"], "signature_pending")
        signature_request_id = send_res.data["signature_request"]["id"]
        token = send_res.data["signature_request"]["access_token"]

        signature_detail_res = await self.dispatch(
            f"/signature/requests/{signature_request_id}",
            user=admin,
        )
        self.assertEqual(signature_detail_res.status, 200)
        self.assertEqual(signature_detail_res.data["status"], "sent")
        self.assertGreaterEqual(len(signature_detail_res.data["pdf_layout"]), 1)
        self.assertGreaterEqual(len(signature_detail_res.data["signature_positions"]), 1)
        self.assertTrue(signature_detail_res.data["layout_confirmed"])

        view_res = await self.dispatch(f"/signature/{token}")
        self.assertEqual(view_res.status, 200)
        self.assertGreaterEqual(len(view_res.data["pdf_layout"]), 1)

        signature_after_view = SignatureRequest.find_by_id(signature_request_id)
        self.assertEqual(signature_after_view.status, "viewed")

        sign_res = await self.dispatch(
            f"/signature/{token}/sign",
            method="POST",
            data={
                "signature_image": self._signature_png_data_url(),
                "signer_email": "ana.trabajadora@example.com",
            },
        )
        self.assertEqual(sign_res.status, 200)
        self.assertTrue(sign_res.data["signed_document_hash"])
        self.assertTrue(sign_res.data["digital_key_fingerprint"])
        self.assertIn("backup_email", sign_res.data["delivery_status"])

        signed_doc_res = await self.dispatch(
            f"/document-center/generated/{first_document_id}",
            user=admin,
        )
        self.assertEqual(signed_doc_res.status, 200)
        self.assertEqual(signed_doc_res.data["status"], "signed")
        self.assertTrue(signed_doc_res.data["signature_request"]["signed_document_hash"])
        self.assertTrue(signed_doc_res.data["signature_request"]["digital_key_fingerprint"])

        close_res = await self.dispatch(
            f"/document-center/generated/{first_document_id}/close",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(close_res.status, 200)
        self.assertEqual(close_res.data["status"], "closed")

        history_res = await self.dispatch(
            f"/document-center/generated/{first_document_id}/history",
            user=admin,
        )
        self.assertEqual(history_res.status, 200)
        history_events = [item["event"] for item in history_res.data["results"]]
        self.assertIn("generated", history_events)
        self.assertIn("approved", history_events)
        self.assertIn("signature_requested", history_events)
        self.assertIn("closed", history_events)

    async def test_manual_pdf_signature_requires_visual_layout_confirmation(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "signature.admin@example.com",
                "name": "Signature Admin",
                "password": "securepass123",
                "company_name": "Signature Corp",
            },
        )
        self.assertEqual(register_res.status, 201)
        admin = User.search([("email", "=", "signature.admin@example.com")])[0]

        create_res = await self.dispatch(
            "/signature/requests",
            method="POST",
            user=admin,
            data={
                "name": "Anexo Manual",
                "request_to_email": "firmante@example.com",
                "document_name": "anexo_manual.pdf",
                "document_data": self._minimal_pdf_base64("Anexo manual"),
                "source_module": "manual",
                "auto_send": False,
            },
        )
        self.assertEqual(create_res.status, 201)
        request_id = create_res.data["id"]
        self.assertFalse(create_res.data["layout_confirmed"])
        self.assertTrue(create_res.data["requires_layout_confirmation"])

        send_without_layout_res = await self.dispatch(
            f"/signature/requests/{request_id}/send",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(send_without_layout_res.status, 400)

        layout_res = await self.dispatch(
            f"/signature/requests/{request_id}/layout",
            method="POST",
            user=admin,
            data={
                "signature_positions": [
                    {"page": 0, "x": 250, "y": 640, "width": 170, "height": 68, "required": True}
                ]
            },
        )
        self.assertEqual(layout_res.status, 200)
        self.assertTrue(layout_res.data["layout_confirmed"])

        send_res = await self.dispatch(
            f"/signature/requests/{request_id}/send",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(send_res.status, 200)

    async def test_payroll_generates_liquidation_documents_and_signature_flow(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "payroll.admin@example.com",
                "name": "Payroll Admin",
                "password": "securepass123",
                "company_name": "Payroll Corp",
            },
        )
        self.assertEqual(register_res.status, 201)
        admin = User.search([("email", "=", "payroll.admin@example.com")])[0]
        self.assertIn("payroll", admin.allowed_modules)

        department = Department.search([("company_id", "=", admin.company_id)])[0]
        employee_res = await self.dispatch(
            "/hr/employees",
            method="POST",
            user=admin,
            data={
                "full_name": "Claudia Operaciones",
                "department_id": department.id,
                "position_title": "Jefa de Turno",
                "work_email": "claudia.operaciones@example.com",
                "status": "active",
                "hire_date": "2026-01-15",
                "base_salary": 1200000,
                "create_user_account": False,
            },
        )
        self.assertEqual(employee_res.status, 201)
        employee_id = employee_res.data["employee"]["id"]

        contract_res = await self.dispatch(
            "/hr/contracts",
            method="POST",
            user=admin,
            data={
                "employee_id": employee_id,
                "contract_type": "indefinite",
                "status": "active",
                "start_date": "2026-01-15",
                "salary_amount": 1200000,
                "work_schedule": "44 horas semanales",
            },
        )
        self.assertEqual(contract_res.status, 201)
        contract_id = contract_res.data["id"]

        lookups_res = await self.dispatch("/payroll/lookups", user=admin)
        self.assertEqual(lookups_res.status, 200)
        self.assertGreaterEqual(len(lookups_res.data["templates"]), 1)
        self.assertGreater(lookups_res.data["current_legal_reference"]["minimum_wage"], 0)

        profile_res = await self.dispatch(
            "/payroll/profiles",
            method="POST",
            user=admin,
            data={
                "employee_id": employee_id,
                "contract_id": contract_id,
                "national_id": "12.345.678-9",
                "afp_code": "uno",
                "health_system": "fonasa",
                "legal_gratification_mode": "article_50_monthly",
                "weekly_hours": 44,
                "require_signature": True,
                "payroll_enabled": True,
            },
        )
        self.assertEqual(profile_res.status, 201)

        period_res = await self.dispatch(
            "/payroll/periods",
            method="POST",
            user=admin,
            data={
                "year": 2026,
                "month": 3,
                "payment_date": "2026-03-31",
            },
        )
        self.assertEqual(period_res.status, 201)
        period_id = period_res.data["id"]

        calculate_res = await self.dispatch(
            f"/payroll/periods/{period_id}/calculate",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(calculate_res.status, 200)
        self.assertEqual(calculate_res.data["summary"]["created"], 1)

        settlements_res = await self.dispatch(f"/payroll/settlements?period_id={period_id}", user=admin)
        self.assertEqual(settlements_res.status, 200)
        self.assertEqual(settlements_res.data["count"], 1)
        settlement_id = settlements_res.data["results"][0]["id"]
        self.assertEqual(settlements_res.data["results"][0]["status"], "calculated")

        approve_res = await self.dispatch(
            f"/payroll/settlements/{settlement_id}/approve",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(approve_res.status, 200)
        self.assertEqual(approve_res.data["status"], "approved")

        docx_res = await self.dispatch(
            f"/payroll/settlements/{settlement_id}/document?format=docx",
            user=admin,
        )
        self.assertEqual(docx_res.status, 200)
        self.assertTrue(docx_res.data["data"])

        send_res = await self.dispatch(
            f"/payroll/settlements/{settlement_id}/send-signature",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(send_res.status, 200)
        self.assertEqual(send_res.data["status"], "signature_pending")
        token = send_res.data["signature_request"]["access_token"]

        signature_view_res = await self.dispatch(f"/signature/{token}")
        self.assertEqual(signature_view_res.status, 200)
        sign_res = await self.dispatch(
            f"/signature/{token}/sign",
            method="POST",
            data={
                "signature_image": self._signature_png_data_url(),
                "signer_email": "claudia.operaciones@example.com",
            },
        )
        self.assertEqual(sign_res.status, 200)
        self.assertTrue(sign_res.data["signed_document_hash"])
        self.assertTrue(sign_res.data["digital_key_fingerprint"])

        signed_settlement_res = await self.dispatch(f"/payroll/settlements/{settlement_id}", user=admin)
        self.assertEqual(signed_settlement_res.status, 200)
        self.assertEqual(signed_settlement_res.data["status"], "signed")
        self.assertGreater(len(signed_settlement_res.data["accounting_lines"]), 0)

        close_res = await self.dispatch(
            f"/payroll/settlements/{settlement_id}/close",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(close_res.status, 200)
        self.assertEqual(close_res.data["status"], "closed")

        history_res = await self.dispatch(
            f"/payroll/settlements/{settlement_id}/history",
            user=admin,
        )
        self.assertEqual(history_res.status, 200)
        history_events = [item["event"] for item in history_res.data["results"]]
        self.assertIn("generated", history_events)
        self.assertIn("approved", history_events)
        self.assertIn("signature_requested", history_events)
        self.assertIn("closed", history_events)

    async def test_root_bootstrap_exposes_extended_frontend_routes(self):
        root_main = Path(r"C:\Users\PC\Desktop\nuevo erp\main.py")
        spec = importlib.util.spec_from_file_location("root_bootstrap_test_main", root_main)
        module = importlib.util.module_from_spec(spec)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        spec.loader.exec_module(module)

        available_paths = {route.path for route in module.app.routes}
        self.assertIn("/app/accreditation", available_paths)
        self.assertIn("/app/cross-correspondence", available_paths)
        self.assertIn("/app/payroll", available_paths)
        self.assertIn("/app/signature-center", available_paths)


if __name__ == "__main__":
    unittest.main()
