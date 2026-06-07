# Gap Analysis: Signature - Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/signature/module_signature.py`  
> **Estado:** Brecha Crítica (P1)

## Resumen Ejecutivo

El módulo de Firma (Signature) en el ERP Legacy en Python es altamente maduro, permitiendo no solo la solicitud de firmas sino la definición del *layout* de las mismas (coordenadas X, Y en el PDF final) y un portal anónimo público y seguro para terceros. En Firebase (Staging), esta funcionalidad aún está en etapas tempranas.

## 1. Brechas de Funcionalidad

### 1.1 Posicionamiento de Firma (Layout)
- **Legacy:** Permite especificar en qué página y en qué coordenadas exactas (ej. `{ page: 1, x: 100, y: 700 }`) debe estamparse visualmente la firma y/o el sello criptográfico en el PDF final.
- **Staging:** El frontend carece del "Signature Layout Designer" (donde el usuario arrastra la caja de firma sobre una previsualización del PDF).

### 1.2 Flujo Público (Anónimo / External)
- **Legacy:** Genera un token seguro que se envía por correo al tercero. El tercero accede a un link público (sin login), previsualiza el PDF y puede dibujar su firma o usar OTP.
- **Staging:** No se ha implementado la ruta no autenticada para los firmantes externos. Actualmente, la seguridad de Firestore bloquea las escrituras anónimas sin las Callable Functions correspondientes.

### 1.3 Sellado Criptográfico
- **Legacy:** Inserta la imagen base64 de la firma y puede sellar el PDF para evitar adulteraciones posteriores.
- **Staging:** En Cloud Functions, la manipulación de PDFs aún está en la v1 usando `pdf-lib`. Falta la implementación estandarizada que agregue la imagen dibujada al PDF, modifique el documento en Cloud Storage y envíe los certificados por correo.

## 2. Recomendaciones de Implementación

1. **Desarrollar el Viewport React:** Crear un componente `SignaturePad` integrado con `react-pdf` para elegir visualmente las cajas de firma.
2. **Crear Funciones Públicas:** Desplegar una Firebase Cloud Function (`publicSignDocument`) que valide el token y procese la firma sin requerir Firebase Auth del usuario final.
3. **Firmado en Backend:** Integrar la imagen al PDF en un Cloud Function y asegurar que el log de auditoría se selle inmutablemente.
