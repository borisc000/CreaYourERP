"""
Event Listeners para Signature Module
Conecta el flujo: Contract → Correspondencia → Firma
"""
from core.event_bus import EventBus
from modules.signature.repository import SignatureRequestRepository
from config.database import SessionLocal
from modules.signature.models.signature_request import SignatureRequest
from datetime import datetime


def _on_correspondence_approved_for_signature(data: dict):
    """Listener: crear solicitud de firma cuando correspondencia está lista"""
    db = SessionLocal()
    try:
        correspondence_id = data['correspondence_id']
        contract_id = data['contract_id']
        template_id = data.get('template_id')
        personalization_data = data.get('personalization_data', {})

        print(f"\n📝 [EVENT] Correspondencia {correspondence_id} lista para firma")
        print(f"   → Creando solicitud de firma para contrato {contract_id}...")

        # Crear solicitud de firma
        sig_req = SignatureRequestRepository.create(
            db,
            correspondence_id=correspondence_id,
            contract_id=contract_id,
            document_content=f"Contract #{contract_id}",  # En producción sería el HTML renderizado
            signature_positions={
                'employee_signature': {'x': 100, 'y': 700, 'page': 1, 'label': 'Firma Empleado'},
                'employer_signature': {'x': 400, 'y': 700, 'page': 1, 'label': 'Firma Empleador'}
            },
            requested_at=datetime.utcnow()
        )

        EventBus.emit('signature.request_created', {
            'signature_request_id': sig_req.id,
            'contract_id': contract_id,
            'correspondence_id': correspondence_id,
            'status': 'pending'
        })

        print(f"   ✅ Solicitud de firma #{sig_req.id} creada")
        print(f"   → Estado: {sig_req.status}")

    except Exception as e:
        print(f"   ✗ Error creando solicitud de firma: {e}")
    finally:
        db.close()


def _on_signature_completed(data: dict):
    """Listener: cuando firma se completa"""
    contract_id = data['contract_id']
    signature_request_id = data['signature_request_id']

    print(f"\n✅ [EVENT] Firma completada")
    print(f"   → Solicitud de firma #{signature_request_id} completada")
    print(f"   → Contrato #{contract_id} listo para activación")
    print(f"   → El contrato pasará a estado 'signed'")

    # Emitir evento para que otros módulos se entere (notificaciones, etc)
    EventBus.emit('contract.fully_signed', {
        'contract_id': contract_id,
        'signature_request_id': signature_request_id
    })


def _on_signature_rejected(data: dict):
    """Listener: cuando firma es rechazada"""
    contract_id = data['contract_id']
    reason = data.get('reason', 'No reason provided')

    print(f"\n❌ [EVENT] Firma rechazada")
    print(f"   → Contrato #{contract_id} rechazado")
    print(f"   → Razón: {reason}")
    print(f"   → El contrato vuelve a estado 'draft' para correcciones")

    # Emitir evento para notificaciones
    EventBus.emit('contract.signature_rejected', {
        'contract_id': contract_id,
        'reason': reason
    })


def _on_signature_request_created(data: dict):
    """Listener: cuando se crea una nueva solicitud de firma"""
    signature_request_id = data['signature_request_id']

    print(f"\n📋 [EVENT] Solicitud de firma creada")
    print(f"   → Solicitud #{signature_request_id} pendiente de firma")
    print(f"   → Enviando notificación al empleado...")


# Registrar listeners
EventBus.subscribe('correspondence.approved_for_signature', _on_correspondence_approved_for_signature)
EventBus.subscribe('signature.completed', _on_signature_completed)
EventBus.subscribe('signature.rejected', _on_signature_rejected)
EventBus.subscribe('signature.request_created', _on_signature_request_created)

print("[OK] Signature Module listeners registered")
