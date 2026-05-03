"""
Listeners del modulo Reports.
Sincronizan eventos de firma con Report y ServiceMirror.
"""

import os

from core.event_bus import EventBus

from modules.crm.module_crm import Document, Service, _document_is_publicly_visible
from modules.reports.module_reports import APP_ROOT, Report
from modules.signature.module_signature import SignatureRequest, b64decode_bytes


_LISTENERS_READY = False


def _signed_reports_dir(report_id: int) -> str:
    return os.path.join(APP_ROOT, 'uploads', 'reports_signed', str(report_id))


def _persist_signed_report_pdf(report: Report, signature_request: SignatureRequest) -> str:
    output_dir = _signed_reports_dir(report.id)
    os.makedirs(output_dir, exist_ok=True)
    file_name = f"reporte_{report.id}_firmado.pdf"
    file_path = os.path.join(output_dir, file_name)
    payload = b64decode_bytes(signature_request.signed_document or signature_request.document_data or '')
    with open(file_path, 'wb') as handle:
        handle.write(payload or b'')
    return file_path


def _upsert_signed_report_document(report: Report, signature_request: SignatureRequest) -> None:
    service = Service.find_by_id(report.service_id) if getattr(report, 'service_id', None) else None
    existing = Document.search([
        ('service_id', '=', report.service_id),
        ('company_id', '=', report.company_id),
    ]) if getattr(report, 'service_id', None) else []
    relevant = [
        item for item in existing
        if (getattr(item, 'document_type', None) or item.category or '') == 'reporte_firmado'
    ]
    for item in relevant:
        if bool(getattr(item, 'is_current', True)):
            item.is_current = False
            item.save()

    file_path = _persist_signed_report_pdf(report, signature_request)
    parent = relevant[0] if relevant else None
    version = max([int(getattr(item, 'version', 1) or 1) for item in relevant], default=0) + 1
    Document.create({
        'filename': os.path.basename(file_path),
        'file_path': file_path,
        'mime_type': 'application/pdf',
        'model_name': 'Service' if service else 'Lead',
        'record_id': service.id if service else report.lead_id,
        'company_id': report.company_id,
        'uploaded_by': getattr(signature_request, 'request_from', None) or 0,
        'category': 'signed_report',
        'service_id': getattr(service, 'id', None),
        'document_type': 'reporte_firmado',
        'version': version,
        'is_current': True,
        'parent_document_id': parent.id if parent else None,
        'signature_request_id': signature_request.id,
        'signed_at': getattr(signature_request, 'signed_at', None),
        'metadata_json': {
            'publish_to_mirror': True,
            'source_module': 'reports',
            'source_record_id': report.id,
            'integrity_payload': {
                'signed_document_hash': (signature_request.integrity_payload or {}).get('signed_document_hash') or getattr(signature_request, 'signed_document_hash', None),
                'digital_key_fingerprint': (signature_request.integrity_payload or {}).get('digital_key_fingerprint') or getattr(signature_request, 'digital_key_fingerprint', None),
                'signature_hash': (signature_request.integrity_payload or {}).get('signature_hash') or getattr(signature_request, 'signature_hash', None),
            },
            'is_public': True,
        },
    })


def _on_signature_completed(data):
    signature_request_id = data.get('signature_request_id')
    if not signature_request_id:
        return

    signature_request = SignatureRequest.find_by_id(signature_request_id)
    if not signature_request:
        return
    if str(getattr(signature_request, 'source_module', '') or '').strip().lower() != 'reports':
        return
    if str(getattr(signature_request, 'source_model', '') or '').strip() != 'Report':
        return

    report = Report.find_by_id(getattr(signature_request, 'source_record_id', None))
    if not report:
        return

    report.signature_request_id = signature_request.id
    report.signature_status = getattr(signature_request, 'status', None) or 'signed'
    report.signed_at = getattr(signature_request, 'signed_at', None)
    report.save()

    if signature_request.signed_document or signature_request.document_data:
        _upsert_signed_report_document(report, signature_request)


def setup_reports_listeners() -> None:
    global _LISTENERS_READY
    subscribers = EventBus._subscribers.get('signature.completed', [])
    if _LISTENERS_READY and _on_signature_completed in subscribers:
        return

    if _on_signature_completed not in subscribers:
        EventBus.subscribe('signature.completed', _on_signature_completed)
    _LISTENERS_READY = True
