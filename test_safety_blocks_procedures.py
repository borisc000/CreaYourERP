import sys
import unittest
from io import BytesIO
from uuid import uuid4

sys.path.insert(0, r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from openpyxl import load_workbook

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.crm.module_crm import CRMModule, Customer, Lead
from modules.hr.module_hr import HRModule
from modules.reports.module_reports import (
    AreaFaena,
    ReportsModule,
    SectorFaena,
    SectorRiskAssignment,
)
from modules.safety.module_safety import (
    SafetyClientArea,
    SafetyClientSite,
    SafetyMasterRisk,
    SafetyModule,
)
from modules.safety.risk_calculation_service import calculate_compact_miper
from modules.safety_activities.module_safety_activities import SafetyActivitiesModule
from modules.safety_procedures.module_safety_procedures import (
    SafetyProceduresModule,
    build_procedure_pdf_content,
)


class SafetyBlocksProceduresTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": [
                    "base",
                    "crm",
                    "reports",
                    "hr",
                    "safety",
                    "safety_activities",
                    "safety_procedures",
                ],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(CRMModule)
        self.framework.register_module_class(ReportsModule)
        self.framework.register_module_class(HRModule)
        self.framework.register_module_class(SafetyModule)
        self.framework.register_module_class(SafetyActivitiesModule)
        self.framework.register_module_class(SafetyProceduresModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None):
        request = Request(path=path, method=method, params={}, data=data or {}, headers={})
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def _create_admin(self):
        email = f"safety.admin.{uuid4().hex[:10]}@example.com"
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": email,
                "name": "Safety Admin",
                "password": "securepass123",
                "company_name": "Andamios Demo Spa",
            },
        )
        self.assertEqual(register_res.status, 201)
        admin = User.search([("email", "=", email)])[0]
        self.assertIn("safety", admin.allowed_modules or [])
        return admin

    async def test_seeded_blocks_and_procedures_generate_matrix_and_pts(self):
        admin = await self._create_admin()

        blocks_res = await self.dispatch("/safety-activities/blocks", user=admin)
        self.assertEqual(blocks_res.status, 200)
        blocks = blocks_res.data["results"]
        self.assertGreaterEqual(len(blocks), 6)
        self.assertTrue(
            any(block["code"] == "ACT-GEN-TRANSITO-PEATONAL" for block in blocks)
        )
        self.assertTrue(
            any(block["code"] == "ACT-ESP-ANDAMIOS" and block["hazard_count"] >= 1 for block in blocks)
        )

        procedures_res = await self.dispatch("/safety-procedures/procedures", user=admin)
        self.assertEqual(procedures_res.status, 200)
        procedures = procedures_res.data["results"]
        procedure = next(
            item for item in procedures if item["procedure_code"] == "PT-A-01-02"
        )
        self.assertGreaterEqual(procedure["step_count"], 6)

        preview_res = await self.dispatch(
            f"/safety-procedures/procedures/{procedure['id']}/matrix-preview",
            user=admin,
        )
        self.assertEqual(preview_res.status, 200)
        preview_rows = preview_res.data["rows"]
        self.assertGreater(len(preview_rows), 0)
        self.assertTrue(
            any("procedure" in (row.get("origin_blocks") or []) for row in preview_rows)
        )

        document_template_res = await self.dispatch(
            f"/safety-procedures/procedures/{procedure['id']}/document-template",
            user=admin,
        )
        self.assertEqual(document_template_res.status, 200)
        doc_payload = document_template_res.data["document"]
        self.assertIn("9. SECUENCIA OPERATIVA", doc_payload["content"])
        self.assertIn("24. RAZON DE CAMBIO - DISTRIBUCION", doc_payload["content"])

        procedure_pdf = build_procedure_pdf_content(
            procedure["id"],
            company_id=admin.company_id,
        )
        self.assertTrue(procedure_pdf)
        self.assertTrue(procedure_pdf.startswith(b"%PDF"))

        customer = Customer.create(
            {
                "company_id": admin.company_id,
                "name": "Minera Norte",
                "tax_id": "76.111.111-1",
            }
        )
        lead = Lead.create(
            {
                "company_id": admin.company_id,
                "title": "Montaje de andamios TK-01",
                "customer_id": customer.id,
                "status": "open",
                "priority": "high",
                "probability": 70,
            }
        )
        safety_site = SafetyClientSite.create(
            {
                "company_id": admin.company_id,
                "customer_id": customer.id,
                "name": "Planta Norte",
                "address": "Ruta 1",
            }
        )
        safety_area = SafetyClientArea.create(
            {
                "company_id": admin.company_id,
                "site_id": safety_site.id,
                "name": "Torre Norte",
                "risk_notes": "Area con trabajos en altura",
            }
        )
        report_area = AreaFaena.create(
            {
                "company_id": admin.company_id,
                "customer_id": customer.id,
                "nombre": "Torre Norte",
                "active": True,
            }
        )
        sector = SectorFaena.create(
            {
                "company_id": admin.company_id,
                "area_id": report_area.id,
                "nombre": "Plataforma superior",
                "active": True,
            }
        )
        height_risk = [
            risk
            for risk in SafetyMasterRisk.search([("company_id", "=", admin.company_id)])
            if risk.isp_code == "A3"
        ][0]
        SectorRiskAssignment.create(
            {
                "company_id": admin.company_id,
                "sector_id": sector.id,
                "master_risk_id": height_risk.id,
                "active": True,
            }
        )

        folder_res = await self.dispatch(
            "/safety/folders",
            method="POST",
            user=admin,
            data={
                "lead_id": lead.id,
                "procedure_id": procedure["id"],
                "client_site_id": safety_site.id,
                "client_area_id": safety_area.id,
                "planned_start_date": "2026-04-10",
            },
        )
        self.assertEqual(folder_res.status, 201)
        folder_id = folder_res.data["id"]
        self.assertEqual(folder_res.data["procedure_id"], procedure["id"])
        self.assertEqual(folder_res.data["procedure_code"], "PT-A-01-02")

        generate_res = await self.dispatch(
            f"/safety/folders/{folder_id}/generate-matrix",
            method="POST",
            user=admin,
        )
        self.assertEqual(generate_res.status, 200)
        matrix_rows = generate_res.data["risk_matrix"]["rows"]
        self.assertTrue(
            any("procedure" in (row.get("origin_blocks") or []) for row in matrix_rows)
        )
        self.assertTrue(
            any("shared_place" in (row.get("origin_blocks") or []) for row in matrix_rows)
        )
        self.assertEqual(
            generate_res.data["generation_summary"]["procedure_code"],
            "PT-A-01-02",
        )
        self.assertIn(
            "Torre Norte",
            generate_res.data["generation_summary"]["shared_place_summary"]["matched_areas"],
        )

        dossier_res = await self.dispatch(f"/safety/folders/{folder_id}/dossier", user=admin)
        self.assertEqual(dossier_res.status, 200)
        document_codes = [doc["code"] for doc in dossier_res.data["documents"]]
        self.assertIn("pts_pt-a-01-02", document_codes)
        procedure_doc = next(
            doc for doc in dossier_res.data["documents"] if doc["code"] == "pts_pt-a-01-02"
        )
        self.assertIn("9. SECUENCIA OPERATIVA", procedure_doc["content"])

        xlsx_export = await self.dispatch(f"/safety/folders/{folder_id}/export/miper.xlsx", user=admin)
        self.assertEqual(
            xlsx_export.media_type,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        xlsx_body = b""
        async for chunk in xlsx_export.body_iterator:
            xlsx_body += chunk
        self.assertTrue(xlsx_body.startswith(b"PK"))
        workbook = load_workbook(BytesIO(xlsx_body), read_only=False)
        sheet = workbook["Matriz IPER"]
        self.assertEqual(sheet["A5"].value, "N")
        self.assertEqual(sheet["B5"].value, "Actividad")
        self.assertIsNotNone(sheet["A6"].value)
        self.assertEqual(sheet["A5"].font.color.rgb, "00FFFFFF")

        pdf_export = await self.dispatch(f"/safety/folders/{folder_id}/export/miper.pdf", user=admin)
        self.assertEqual(pdf_export.media_type, "application/pdf")
        pdf_body = b""
        async for chunk in pdf_export.body_iterator:
            pdf_body += chunk
        self.assertTrue(pdf_body.startswith(b"%PDF"))

    async def test_bot_aliases_snapshots_and_canonical_miper(self):
        admin = await self._create_admin()

        lookups_res = await self.dispatch("/safety-activities/lookups", user=admin)
        self.assertEqual(lookups_res.status, 200)
        self.assertIn("substitution", lookups_res.data["risk_methodology"]["control_hierarchy_keys"])
        self.assertIn("compact_miper", lookups_res.data["risk_methodology"])
        compact_low = calculate_compact_miper(1, 2, 1, 2)
        self.assertEqual(compact_low["probability_score"], 4)
        self.assertEqual(compact_low["residual_risk_value"], 8)
        self.assertEqual(compact_low["residual_risk_label"], "Aceptable")
        compact_high = calculate_compact_miper(3, 3, 3, 4)
        self.assertEqual(compact_high["probability_score"], 9)
        self.assertEqual(compact_high["residual_risk_value"], 36)
        self.assertEqual(compact_high["residual_risk_label"], "No aceptable")

        bots_res = await self.dispatch("/safety/bots", user=admin)
        self.assertEqual(bots_res.status, 200)
        bots = bots_res.data["results"]
        self.assertGreaterEqual(len(bots), 30)
        self.assertTrue(any(bot["code"] == "BOT-ALT-SPDC" for bot in bots))
        aseo_bot = next(bot for bot in bots if bot["code"] == "BOT-AO-001")
        self.assertGreaterEqual(aseo_bot["hazard_count"], 1)
        aseo_hazard = aseo_bot["hazards"][0]
        self.assertIn("exposed_people_value", aseo_hazard)
        self.assertIn("probability_score", aseo_hazard)
        self.assertIn("residual_risk_value", aseo_hazard)
        self.assertIn("residual_risk_label", aseo_hazard)
        source_bot = next(bot for bot in bots if bot["hazard_count"] > 0)

        suggestions_res = await self.dispatch(
            "/safety/bot-assistant/suggestions",
            method="POST",
            user=admin,
            data={
                "name": "Ejecucion de trabajo en altura sobre andamio",
                "default_process_name": "Montaje de andamios",
                "default_task_name": "Trabajo en altura",
                "criticality": "critical",
                "tags": ["altura", "andamios"],
            },
        )
        self.assertEqual(suggestions_res.status, 200)
        suggestions = suggestions_res.data["results"]
        self.assertGreaterEqual(len(suggestions), 2)
        self.assertTrue(any("altura" in " ".join(item.get("reasons") or []).lower() for item in suggestions))
        self.assertTrue(any(item.get("hazard", {}).get("master_risk_id") for item in suggestions))

        duplicate_res = await self.dispatch(
            f"/safety/bots/{source_bot['id']}/duplicate",
            method="POST",
            user=admin,
            data={"code": f"BOT-COPY-{uuid4().hex[:6]}", "name": "BOT copia test"},
        )
        self.assertEqual(duplicate_res.status, 201)
        duplicated = duplicate_res.data
        self.assertEqual(duplicated["parent_block_id"], source_bot["id"])
        self.assertGreaterEqual(duplicated["hazard_count"], source_bot["hazard_count"])

        first_risk = lookups_res.data["master_risks"][0]
        hazard_res = await self.dispatch(
            f"/safety/bots/{duplicated['id']}/risks",
            method="POST",
            user=admin,
            data={
                "master_risk_id": first_risk["id"],
                "hazard_factor": "Prueba de sustitucion",
                "probability": 4,
                "consequence": 4,
                "control_hierarchy": {
                    "substitution": ["Sustituir metodo por alternativa mecanizada"],
                    "administrative": ["Permiso y supervision"],
                },
            },
        )
        self.assertEqual(hazard_res.status, 201)
        hazard = hazard_res.data["hazard"]
        self.assertEqual(hazard["risk_level_label"], "Intolerable")
        self.assertTrue(hazard["approval_blocked"])
        self.assertIn("Sustituir metodo", " ".join(hazard["control_hierarchy"]["substitution"]))
        self.assertIn("residual_risk_value", hazard)

        empty_bot_res = await self.dispatch(
            "/safety/bots",
            method="POST",
            user=admin,
            data={
                "code": f"BOT-MULTI-{uuid4().hex[:6]}",
                "name": "BOT con multiples peligros",
                "block_type": "custom",
                "default_process_name": "QA preventivo",
                "default_task_name": "Validar multiples riesgos",
            },
        )
        self.assertEqual(empty_bot_res.status, 201)
        multi_bot = empty_bot_res.data
        created_hazard_ids = []
        for idx, risk in enumerate(lookups_res.data["master_risks"][:3], start=1):
            add_res = await self.dispatch(
                f"/safety/bots/{multi_bot['id']}/risks",
                method="POST",
                user=admin,
                data={
                    "master_risk_id": risk["id"],
                    "hazard_factor": f"Peligro multiple {idx}",
                    "probability": 2,
                    "consequence": 2,
                    "display_order": idx * 10,
                    "control_hierarchy": {
                        "administrative": [f"Control administrativo {idx}"],
                    },
                },
            )
            self.assertEqual(add_res.status, 201)
            created_hazard_ids.append(add_res.data["hazard"]["id"])

        blocks_after_multi_res = await self.dispatch("/safety-activities/blocks", user=admin)
        self.assertEqual(blocks_after_multi_res.status, 200)
        multi_after_create = next(
            item for item in blocks_after_multi_res.data["results"] if item["id"] == multi_bot["id"]
        )
        self.assertEqual(multi_after_create["hazard_count"], 3)
        self.assertEqual(len(multi_after_create["hazards"]), 3)

        update_second_res = await self.dispatch(
            f"/safety-activities/hazards/{created_hazard_ids[1]}",
            method="PUT",
            user=admin,
            data={
                "hazard_factor": "Peligro multiple 2 editado",
                "controls_summary": "Control editado sin afectar otros peligros",
            },
        )
        self.assertEqual(update_second_res.status, 200)
        self.assertEqual(update_second_res.data["block"]["hazard_count"], 3)
        names_after_update = [item["hazard_factor"] for item in update_second_res.data["block"]["hazards"]]
        self.assertIn("Peligro multiple 1", names_after_update)
        self.assertIn("Peligro multiple 2 editado", names_after_update)
        self.assertIn("Peligro multiple 3", names_after_update)

        archive_first_res = await self.dispatch(
            f"/safety-activities/hazards/{created_hazard_ids[0]}",
            method="DELETE",
            user=admin,
        )
        self.assertEqual(archive_first_res.status, 200)
        self.assertEqual(archive_first_res.data["block"]["hazard_count"], 2)
        remaining_names = [item["hazard_factor"] for item in archive_first_res.data["block"]["hazards"]]
        self.assertNotIn("Peligro multiple 1", remaining_names)
        self.assertIn("Peligro multiple 2 editado", remaining_names)
        self.assertIn("Peligro multiple 3", remaining_names)

        procedures_res = await self.dispatch("/safety-procedures/procedures", user=admin)
        self.assertEqual(procedures_res.status, 200)
        procedure = next(
            item for item in procedures_res.data["results"] if item["procedure_code"] == "PT-A-01-02"
        )
        approve_res = await self.dispatch(
            f"/safety-procedures/procedures/{procedure['id']}/approve",
            method="POST",
            user=admin,
        )
        self.assertEqual(approve_res.status, 200)
        approved = approve_res.data["procedure"]
        self.assertEqual(approved["status"], "approved")
        self.assertTrue(any(step.get("block_snapshot") for step in approved["steps"]))

        miper_res = await self.dispatch(
            "/safety/risk-matrices/generate",
            method="POST",
            user=admin,
            data={
                "source_type": "procedure",
                "procedure_id": procedure["id"],
                "work_center": "Plataforma de prueba",
            },
        )
        self.assertEqual(miper_res.status, 201)
        matrix = miper_res.data
        self.assertGreater(matrix["row_count"], 0)
        self.assertTrue(any("procedure" in (row.get("origin_blocks") or []) for row in matrix["rows"]))
        self.assertIn(matrix["status"], ("draft", "pending_review", "approved"))
        self.assertTrue(
            all(
                key in matrix["rows"][0]
                for key in (
                    "task_type_code",
                    "exposed_people_value",
                    "exposure_frequency_value",
                    "occurrence_factor_value",
                    "probability_score",
                    "severity_value",
                    "residual_risk_value",
                    "residual_risk_label",
                )
            )
        )
        direct_pdf_export = await self.dispatch(
            f"/safety/risk-matrices/{matrix['id']}/export/miper.pdf",
            user=admin,
        )
        self.assertEqual(direct_pdf_export.media_type, "application/pdf")
        direct_pdf_body = b""
        async for chunk in direct_pdf_export.body_iterator:
            direct_pdf_body += chunk
        self.assertTrue(direct_pdf_body.startswith(b"%PDF"))

        aseo_matrix_res = await self.dispatch(
            "/safety/risk-matrices/generate",
            method="POST",
            user=admin,
            data={
                "source_type": "blocks",
                "block_ids": [aseo_bot["id"]],
                "work_center": "Oficinas centrales",
            },
        )
        self.assertEqual(aseo_matrix_res.status, 201)
        aseo_rows = aseo_matrix_res.data["rows"]
        self.assertGreaterEqual(len(aseo_rows), 1)
        self.assertTrue(any(row.get("task_type_code") == "R" for row in aseo_rows))
        self.assertTrue(any(row.get("residual_risk_label") == "Aceptable" for row in aseo_rows))


if __name__ == "__main__":
    unittest.main()
