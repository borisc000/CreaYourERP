"""
MAIN - Inicialización del Framework
====================================

Ejemplo de cómo inicializar el framework con FastAPI.

Este archivo muestra:
1. Configuración del framework
2. Registro de módulos
3. Integración con FastAPI
4. Manejo de requests
"""

import asyncio
import logging
from typing import Dict, Any
from fastapi import FastAPI, Request as FastAPIRequest, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Importar framework
from YOUR_ERP_core_framework import (
    CoreFramework, Request, Response, ModuleNotFoundError
)
from module_base import BaseModule
from module_signature import SignatureModule


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

# Config del framework
ERP_CONFIG = {
    'database_url': 'sqlite:///./your_erp.db',
    'debug': True,
    'secret_key': 'your-secret-key-here',
    'modules_to_load': ['Base', 'Signature'],
}

# Setup de logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


# ============================================================================
# INICIALIZAR FRAMEWORK
# ============================================================================

def init_framework() -> CoreFramework:
    """Inicializar el framework central"""
    logger.info("Initializing ERP Framework...")
    
    # Crear framework
    framework = CoreFramework(ERP_CONFIG)
    
    # Registrar módulos
    framework.register_module_class(BaseModule)
    framework.register_module_class(SignatureModule)
    
    # Inicializar
    framework.initialize()
    
    logger.info("Framework initialized successfully")
    return framework


# ============================================================================
# FASTAPI APP
# ============================================================================

# Inicializar framework una sola vez
erp_framework = init_framework()

# Crear app FastAPI
app = FastAPI(
    title="YOUR ERP",
    description="Open source ERP platform",
    version="1.0.0"
)

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# CONVERTIR FASTAPI REQUEST A REQUEST UNIVERSAL
# ============================================================================

async def convert_fastapi_request(fastapi_request: FastAPIRequest) -> Request:
    """
    Convertir FastAPI Request a nuestro Request universal.
    
    Esto permite que el framework sea agnóstico del framework web.
    """
    # Obtener body o archivos
    body_data = {}
    files_data = {}
    if fastapi_request.method in ['POST', 'PUT', 'PATCH']:
        content_type = fastapi_request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            try:
                form = await fastapi_request.form()
                for key, val in form.items():
                    if hasattr(val, "filename"):
                        files_data[key] = val
                    else:
                        body_data[key] = val
            except:
                pass
        else:
            try:
                body_data = await fastapi_request.json()
            except:
                pass
    
    # Crear nuestro Request
    request = Request(
        path=fastapi_request.url.path,
        method=fastapi_request.method,
        params=dict(fastapi_request.query_params),
        data=body_data,
        files=files_data,
        headers=dict(fastapi_request.headers),
        remote_addr=fastapi_request.client.host if fastapi_request.client else "unknown",
        user_agent=fastapi_request.headers.get('user-agent', ''),
    )
    
    # Obtener usuario del header Authorization (si existe token)
    auth_header = fastapi_request.headers.get('authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        # TODO: Aquí irá la búsqueda de usuario por token
        # Por ahora es un placeholder
    
    return request


# ============================================================================
# RUTAS CATCH-ALL
# ============================================================================

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def catch_all(fastapi_request: FastAPIRequest, path: str):
    """
    Ruta catch-all que distribuye a los módulos.
    
    Todas las requests pasan por aquí y se distribuyen a los módulos
    correspondientes según la ruta.
    """
    try:
        # Convertir a request universal
        request = await convert_fastapi_request(fastapi_request)
        request.path = f"/{path}"
        
        # Distribuir mediante el framework
        response = await erp_framework.dispatch_request(request)
        
        if getattr(response, 'is_file', False) and getattr(response, 'file_path', ''):
            from fastapi.responses import FileResponse
            return FileResponse(response.file_path, headers=response.headers)
        
        # Convertir response a JSON de FastAPI
        return JSONResponse(
            status_code=response.status,
            content=response.to_dict(),
            headers=response.headers
        )
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "status": 500,
                "errors": ["Internal server error"],
                "success": False
            }
        )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "framework": "YOUR_ERP",
        "debug": ERP_CONFIG['debug'],
        "modules_loaded": list(erp_framework.module_registry.get_all_loaded().keys())
    }


# ============================================================================
# PUNTO DE ENTRADA
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    print("""
    ╔═══════════════════════════════════════════╗
    ║         YOUR ERP - Framework Core         ║
    ║         Starting Development Server       ║
    ╚═══════════════════════════════════════════╝
    """)
    
    print(f"📦 Modules loaded: {list(erp_framework.module_registry.get_all_loaded().keys())}")
    print(f"🔧 Debug mode: {ERP_CONFIG['debug']}")
    print(f"📍 Server running at: http://localhost:8000")
    print(f"📚 API docs at: http://localhost:8000/docs")
    
    # Iniciar servidor
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )


# ============================================================================
# EJEMPLO DE CLIENTES PARA TESTING
# ============================================================================

"""
EJEMPLO DE USO CON REQUESTS:

import requests
import json

BASE_URL = "http://localhost:8000"

# 1. REGISTRAR USUARIO
response = requests.post(
    f"{BASE_URL}/auth/register",
    json={
        "email": "user@example.com",
        "name": "John Doe",
        "password": "secure_password_123"
    }
)
print("Register:", response.json())

# 2. LOGIN
response = requests.post(
    f"{BASE_URL}/auth/login",
    json={
        "email": "user@example.com",
        "password": "secure_password_123"
    }
)
data = response.json()['data']
token = data['token']
print("Login token:", token)

# 3. CREAR SOLICITUD DE FIRMA
headers = {'Authorization': f'Bearer {token}'}

with open('document.pdf', 'rb') as f:
    import base64
    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

response = requests.post(
    f"{BASE_URL}/signature/requests",
    headers=headers,
    json={
        "name": "Contract to sign",
        "description": "Employment agreement",
        "request_to_email": "recipient@example.com",
        "document_name": "contract.pdf",
        "document_data": pdf_base64,
        "signature_positions": [
            {
                "page": 0,
                "x": 100,
                "y": 500,
                "width": 150,
                "height": 75
            }
        ]
    }
)
print("Create request:", response.json())
access_token = response.json()['data']['access_token']

# 4. ENVIAR SOLICITUD
request_id = response.json()['data']['id']
response = requests.post(
    f"{BASE_URL}/signature/requests/{request_id}/send",
    headers=headers
)
print("Send request:", response.json())

# 5. VER SOLICITUD (link público)
response = requests.get(
    f"{BASE_URL}/signature/{access_token}"
)
print("View request:", response.json())

# 6. FIRMAR DOCUMENTO (link público)
# Aquí el usuario dibujaría su firma en el frontend
# y enviaría como imagen base64

with open('signature.png', 'rb') as f:
    import base64
    signature_base64 = base64.b64encode(f.read()).decode('utf-8')

response = requests.post(
    f"{BASE_URL}/signature/{access_token}/sign",
    json={
        "signature_image": signature_base64,
        "signer_email": "recipient@example.com"
    }
)
print("Sign document:", response.json())

# 7. VER SOLICITUDES (protegido)
response = requests.get(
    f"{BASE_URL}/signature/requests",
    headers=headers
)
print("My requests:", response.json())
"""
