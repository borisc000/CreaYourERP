"""
Event listeners for the Accreditation module.
Wires the complete pipeline:
  crew.member_assigned   -> compute check
  accreditation.generation_requested -> generate document via Correspondencia Cruzada
  accreditation.document_generated   -> route to signature if needed
  signature.completed    -> update accreditation status, recompute check
  crew.member_removed    -> deactivate check
"""

from core.event_bus import EventBus
from modules.accreditation.models import (
    ServiceOrder,
    CrewAssignment,
    AccreditationCheck,
    DocumentGenerationRequest,
)
from modules.accreditation.service import AccreditationService
import logging

logger = logging.getLogger(__name__)


def setup_accreditation_listeners():
    """Register all accreditation event listeners. Call in main.py startup."""

    # ------------------------------------------------------------------
    # 1. crew.member_assigned
    # ------------------------------------------------------------------
    def on_crew_member_assigned(data):
        """
        When employee is added to a crew, compute their accreditation check.
        Payload: {service_order_id, employee_id, company_id}
        """
        logger.info(f"Crew member assigned: {data}")
        service_order_id = data.get("service_order_id")
        employee_id = data.get("employee_id")
        company_id = data.get("company_id")

        if not (service_order_id and employee_id and company_id):
            logger.warning("Incomplete crew.member_assigned payload, skipping")
            return

        try:
            check = AccreditationService.compute_check(
                service_order_id, employee_id, company_id
            )
            overall_status = (
                check.get("overall_status", "non_compliant")
                if isinstance(check, dict)
                else getattr(check, "overall_status", "non_compliant")
            )
            EventBus.emit("accreditation.check_computed", {
                "service_order_id": service_order_id,
                "employee_id": employee_id,
                "overall_status": overall_status,
                "company_id": company_id,
            })
        except Exception as e:
            logger.error(f"Error computing check on crew assignment: {e}")

    # ------------------------------------------------------------------
    # 2. crew.member_removed
    # ------------------------------------------------------------------
    def on_crew_member_removed(data):
        """
        When employee is removed from crew, deactivate their check.
        Payload: {service_order_id, employee_id, company_id}
        """
        logger.info(f"Crew member removed: {data}")
        service_order_id = data.get("service_order_id")
        employee_id = data.get("employee_id")

        if not (service_order_id and employee_id):
            return

        checks = AccreditationCheck.search([
            ("service_order_id", "=", service_order_id),
            ("employee_id", "=", employee_id),
        ])
        for check in checks:
            check.overall_status = "removed"
            check.save()

    # ------------------------------------------------------------------
    # 3. accreditation.generation_requested
    # ------------------------------------------------------------------
    def on_generation_requested(data):
        """
        When document generation is requested for a gap:
        1. Load DocumentGenerationRequest
        2. Load template from Document Center (Correspondencia Cruzada)
        3. Build personalization data from employee + service order
        4. Generate the document
        5. If template requires signature, route to signature module
        6. Update request status

        Payload: {doc_gen_request_id, service_order_id, employee_id,
                  requirement_id, template_id, company_id}
        """
        logger.info(f"Document generation requested: {data}")

        doc_gen_request_id = data.get("doc_gen_request_id")
        service_order_id = data.get("service_order_id")
        employee_id = data.get("employee_id")
        template_id = data.get("template_id")
        company_id = data.get("company_id")

        if not doc_gen_request_id:
            logger.error("No doc_gen_request_id in event data")
            return

        gen_request = DocumentGenerationRequest.find_by_id(doc_gen_request_id)
        if not gen_request:
            logger.error(f"DocumentGenerationRequest {doc_gen_request_id} not found")
            return

        try:
            # Update status to generating
            gen_request.status = "generating"
            gen_request.save()

            # Build personalization data
            service_order_id = service_order_id or gen_request.service_order_id
            employee_id = employee_id or gen_request.employee_id
            company_id = company_id or gen_request.company_id
            template_id = template_id or gen_request.template_id

            personalization = AccreditationService.build_personalization_data(
                employee_id, service_order_id, company_id
            )
            gen_request.personalization_data = personalization
            gen_request.save()

            # Load the Document Center template
            from modules.document_center.module_document_center import (
                DocumentTemplate,
                GeneratedDocument,
            )

            template = DocumentTemplate.find_by_id(template_id)
            if not template:
                gen_request.status = "failed"
                gen_request.error_message = (
                    f"Template {template_id} not found in Correspondencia Cruzada"
                )
                gen_request.save()
                logger.error(f"Template {template_id} not found")
                return

            # Render template content with Jinja2 if available
            template_content = getattr(template, "template_data", "") or ""
            document_content = ""
            if template_content:
                try:
                    from core.template_processor import TemplateProcessor

                    rendered = TemplateProcessor.render_template(
                        template_content, personalization
                    )
                    document_content = rendered.get(
                        "rendered_content", template_content
                    )
                except Exception:
                    document_content = template_content

            if not document_content:
                document_content = (
                    f"Generated document for requirement (template {template_id})"
                )

            # Create GeneratedDocument in Document Center
            generated_doc = GeneratedDocument.create({
                "batch_id": 0,
                "template_id": template_id,
                "company_id": company_id,
                "name": f"Accreditation doc - employee {employee_id}",
                "output_filename": f"accreditation_{employee_id}_{template_id}.docx",
                "employee_id": employee_id,
                "source_module": "accreditation",
                "source_record_id": doc_gen_request_id,
                "target_module": "hr",
                "merge_payload": personalization,
                "docx_data": document_content,
                "status": "generated",
                "requires_signature": bool(
                    getattr(template, "requires_signature", False)
                ),
            })

            gen_request.generated_document_id = (
                generated_doc.id if generated_doc else None
            )
            gen_request.status = "generated"
            gen_request.save()

            logger.info(
                f"Document generated: {generated_doc.id if generated_doc else 'N/A'}"
            )

            requires_signature = bool(
                getattr(template, "requires_signature", False)
            )

            EventBus.emit("accreditation.document_generated", {
                "doc_gen_request_id": doc_gen_request_id,
                "generated_document_id": (
                    generated_doc.id if generated_doc else None
                ),
                "template_id": template_id,
                "employee_id": employee_id,
                "service_order_id": service_order_id,
                "company_id": company_id,
                "requires_signature": requires_signature,
            })

        except Exception as e:
            logger.error(f"Error generating document: {e}")
            gen_request = DocumentGenerationRequest.find_by_id(doc_gen_request_id)
            if gen_request:
                gen_request.status = "failed"
                gen_request.error_message = str(e)
                gen_request.save()

    # ------------------------------------------------------------------
    # 4. accreditation.document_generated
    # ------------------------------------------------------------------
    def on_document_generated(data):
        """
        After document is generated:
        - If it requires signature -> emit 'correspondence.approved_for_signature'
        - Otherwise -> auto-register in accreditation and recompute check

        Payload: {doc_gen_request_id, generated_document_id, requires_signature, ...}
        """
        logger.info(f"Document generated event: {data}")

        doc_gen_request_id = data.get("doc_gen_request_id")
        requires_signature = data.get("requires_signature", False)

        gen_request = DocumentGenerationRequest.find_by_id(doc_gen_request_id)
        if not gen_request:
            return

        if requires_signature:
            # Route to signature module via existing event
            gen_request.status = "signature_pending"
            gen_request.save()

            EventBus.emit("correspondence.approved_for_signature", {
                "correspondence_id": doc_gen_request_id,
                "contract_id": None,
                "document_content": (
                    f"Accreditation document (gen request {doc_gen_request_id})"
                ),
                "template_id": data.get("template_id"),
                "employee_id": data.get("employee_id"),
                "service_order_id": data.get("service_order_id"),
                "company_id": data.get("company_id"),
                "source": "accreditation",
            })
            logger.info(
                f"Document sent to signature module: {doc_gen_request_id}"
            )
        else:
            # No signature needed - auto-register in accreditation
            _auto_register_accreditation(gen_request, data)

    # ------------------------------------------------------------------
    # 5. signature.completed
    # ------------------------------------------------------------------
    def on_signature_completed(data):
        """
        When a signature is completed, check if it belongs to an accreditation
        DocumentGenerationRequest. If so: update status, register document,
        recompute check.

        Payload: {signature_request_id, correspondence_id, contract_id, ...}
        """
        logger.info(f"Signature completed event: {data}")

        correspondence_id = data.get("correspondence_id")
        if not correspondence_id:
            return

        # Try to find matching DocumentGenerationRequest in signature_pending state
        gen_requests = DocumentGenerationRequest.search([
            ("id", "=", correspondence_id),
            ("status", "=", "signature_pending"),
        ])

        if not gen_requests:
            # Not an accreditation signature, ignore
            return

        gen_request = gen_requests[0]

        signature_request_id = data.get("signature_request_id")
        if signature_request_id:
            gen_request.signature_request_id = signature_request_id

        # Register in accreditation
        _auto_register_accreditation(gen_request, {
            "employee_id": gen_request.employee_id,
            "service_order_id": gen_request.service_order_id,
            "company_id": gen_request.company_id,
        })

    # ------------------------------------------------------------------
    # Helper
    # ------------------------------------------------------------------
    def _auto_register_accreditation(gen_request, data):
        """
        Register the generated document as an EmployeeAccreditationDocument
        and recompute the accreditation check.
        """
        from modules.hr.module_hr import (
            EmployeeAccreditationDocument,
            AccreditationRequirement,
        )

        employee_id = data.get("employee_id") or gen_request.employee_id
        company_id = data.get("company_id") or gen_request.company_id
        service_order_id = (
            data.get("service_order_id") or gen_request.service_order_id
        )
        requirement_id = gen_request.requirement_id

        # Resolve requirement name for document_name field
        req = AccreditationRequirement.find_by_id(requirement_id)
        doc_name = (
            f"Accreditation - {req.name}"
            if req
            else f"Accreditation - Req #{requirement_id}"
        )

        accred_doc = EmployeeAccreditationDocument.create({
            "employee_id": employee_id,
            "requirement_id": requirement_id,
            "company_id": company_id,
            "document_name": doc_name,
            "document_url": (
                f"/documents/generated/{gen_request.generated_document_id}"
            ),
            "verification_status": "approved",
            "notes": (
                f"Auto-generated from accreditation check "
                f"(service order {service_order_id})"
            ),
            "source_module": "accreditation",
        })

        # Update generation request
        gen_request.status = "signed"
        gen_request.accreditation_document_id = (
            accred_doc.id if accred_doc else None
        )
        gen_request.save()

        logger.info(
            f"Accreditation document registered: "
            f"{accred_doc.id if accred_doc else 'N/A'}"
        )

        # Recompute accreditation check
        try:
            check = AccreditationService.compute_check(
                service_order_id, employee_id, company_id
            )
            overall_status = (
                check.get("overall_status", "non_compliant")
                if isinstance(check, dict)
                else getattr(check, "overall_status", "non_compliant")
            )

            EventBus.emit("accreditation.check_updated", {
                "service_order_id": service_order_id,
                "employee_id": employee_id,
                "overall_status": overall_status,
                "company_id": company_id,
            })
        except Exception as e:
            logger.error(f"Error recomputing check after registration: {e}")

    # ------------------------------------------------------------------
    # Register all listeners
    # ------------------------------------------------------------------
    EventBus.subscribe("crew.member_assigned", on_crew_member_assigned)
    EventBus.subscribe("crew.member_removed", on_crew_member_removed)
    EventBus.subscribe(
        "accreditation.generation_requested", on_generation_requested
    )
    EventBus.subscribe(
        "accreditation.document_generated", on_document_generated
    )
    EventBus.subscribe("signature.completed", on_signature_completed)

    logger.info("Accreditation event listeners registered")
