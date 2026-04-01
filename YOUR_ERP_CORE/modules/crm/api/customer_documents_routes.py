# modules/crm/api/customer_documents_routes.py
"""
API Routes - Documentos de Cliente
"""
from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime

router = APIRouter(
    prefix="/api/crm/customers",
    tags=["crm-customer-documents"]
)

# Storage en memoria
_customer_documents = {}

@router.get("/{customer_id}/documents")
async def list_customer_documents(customer_id: int):
    """Listar documentos de cliente"""
    if customer_id not in _customer_documents:
        return []
    return _customer_documents[customer_id]

@router.post("/{customer_id}/documents")
async def add_customer_document(
    customer_id: int,
    document_data: dict
):
    """Agregar documento a cliente"""
    if customer_id not in _customer_documents:
        _customer_documents[customer_id] = []

    document = {
        'id': len(_customer_documents[customer_id]) + 1,
        'name': document_data.get('name'),
        'requirement_id': document_data.get('requirement_id'),
        'file_url': document_data.get('file_url'),
        'uploaded_at': datetime.now().isoformat(),
        'status': 'pending'  # pending, approved, rejected
    }

    _customer_documents[customer_id].append(document)
    return document

@router.put("/{customer_id}/documents/{document_id}/approve")
async def approve_document(customer_id: int, document_id: int):
    """Aprobar documento del cliente"""
    if customer_id in _customer_documents:
        for doc in _customer_documents[customer_id]:
            if doc['id'] == document_id:
                doc['status'] = 'approved'
                doc['approved_at'] = datetime.now().isoformat()
                return doc

    raise HTTPException(status_code=404, detail="Documento no encontrado")

@router.delete("/{customer_id}/documents/{document_id}")
async def remove_document(customer_id: int, document_id: int):
    """Remover documento del cliente"""
    if customer_id in _customer_documents:
        _customer_documents[customer_id] = [
            d for d in _customer_documents[customer_id]
            if d['id'] != document_id
        ]
        return {"status": "deleted"}

    raise HTTPException(status_code=404, detail="Documento no encontrado")

@router.get("/{customer_id}/documents/required")
async def get_required_documents(customer_id: int):
    """Obtener documentos requeridos para este cliente"""
    # En producción: buscar de config empresa
    return [
        {
            'id': 1,
            'name': 'Certificado de Antecedentes',
            'requirement_id': 1,
            'status': 'pending'
        },
        {
            'id': 2,
            'name': 'Examen Médico',
            'requirement_id': 2,
            'status': 'pending'
        }
    ]
