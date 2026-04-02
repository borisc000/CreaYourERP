"""
Accreditation Module
====================

Gestiona ordenes de servicio, asignacion de cuadrillas,
verificacion de acreditacion y generacion de documentos.

Depende de:
- base (empresas, requisitos, cursos)
- crm  (leads, customers)
- hr   (empleados, documentos de acreditacion)
"""

from core.YOUR_ERP_core_framework import BaseModule, Request, Response
from modules.accreditation.models import (
    ServiceOrder,
    CrewAssignment,
    AccreditationCheck,
    DocumentGenerationRequest,
)


class AccreditationModule(BaseModule):
    """Modulo de Acreditacion."""

    name = "Accreditation"
    version = "1.0.0"
    author = "Your Company"
    description = "Accreditation - service orders, crew assignments, checks and document generation"
    depends = ["base", "crm", "hr"]

    def init_module(self):
        self.register_model("accreditation.service_order", ServiceOrder)
        self.register_model("accreditation.crew_assignment", CrewAssignment)
        self.register_model("accreditation.check", AccreditationCheck)
        self.register_model("accreditation.doc_gen_request", DocumentGenerationRequest)

        # Placeholder routes - to be implemented in Sprint 1B
        self.register_route(
            "/accreditation/service-orders",
            self._placeholder,
            methods=["GET"],
            auth_required=True,
        )

    async def _placeholder(self, request: Request) -> Response:
        return Response(data={"message": "Accreditation module loaded"}, status=200)
