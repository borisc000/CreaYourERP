# Gap Analysis: Módulo Cross Correspondence — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/cross_correspondence/module_cross_correspondence.py`  
> **Fuente Firebase:** `your-erp-firebase/functions/src/modules/crossCorrespondence/`, `web/src/modules/crossCorrespondence/`

## Resumen Ejecutivo

Cross Correspondence es el puente entre contratos, documentos y firma. En el legacy, operaba en memoria via EventBus (`contract.approved` → `correspondence.draft_created` → `correspondence.approved_for_signature`). El staging tiene CRUD básico pero **carece de modelo persistente `CorrespondenceDraft`, flujo de revisión por rol, idempotencia de listeners y firma externa real**.

---

## Paridad Lograda

| Capacidad Legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| CRUD correspondencia | ✅ Implementado | CRUD básico |
| Vinculación contrato | ⚠️ Parcial | Sin EventBus formal |
| Tracking de estado | ⚠️ Parcial | Estados simplificados |

---

## Brechas P0 — Crítico

### 1. Modelo Persistente `CorrespondenceDraft`

- **Legacy:** Creaba drafts en memoria via EventBus; no eran persistentes.
- **Staging:** No existe modelo de draft.
- **Brecha:** Si el sistema se reinicia durante el flujo, se pierde el estado intermedio. Se necesita un modelo persistente con estados: `draft → reviewed → approved_for_signature → sent → signed → archived`.

### 2. Firma Externa Real

- **Legacy:** Integrado con `signature` para firma de documentos de correspondencia.
- **Staging:** Stub. No implementado.
- **Brecha:** La correspondencia que requiere firma del cliente o tercero no puede completarse.

### 3. Idempotencia de Listeners

- **Legacy:** Los listeners en memoria no eran idempotentes; podían duplicar drafts.
- **Staging:** No hay listeners formales.
- **Brecha:** Falta garantía de que un evento `contract.approved` genere exactamente un draft de correspondencia.

---

## Brechas P1 — Alto

### 4. Flujo de Revisión por Rol

- **Legacy:** No tenía workflow de revisión formal.
- **Staging:** No tiene workflow.
- **Brecha:** Falta que un revisor legal/operacional apruebe la correspondencia antes de enviarla a firma.

### 5. Integración con Document Center

- **Legacy:** Generaba documentos via Document Center para adjuntar a la correspondencia.
- **Staging:** No integrado.
- **Brecha:** La correspondencia no puede generar ni anexar documentos formales automáticamente.

---

## Seguridad Pendiente

1. **Tenant:** La correspondencia vinculada a contratos debe validar `companyId` del contrato.
2. **Permisos:** Crear, revisar, aprobar y enviar a firma deben ser permisos separados.
3. **Auditoría:** Todo cambio de estado debe quedar registrado.

---

## Tests Pendientes

1. Aprobar contrato → draft de correspondencia creado automáticamente.
2. Mismo contrato aprobado dos veces → un solo draft (idempotente).
3. Revisor aprueba correspondencia → pasa a `approved_for_signature`.
4. Firmante externo firma → estado cambia a `signed`.
5. Usuario sin permiso de revisión intenta aprobar → denegado.

---

## Prioridad Recomendada

1. **P0:** Implementar modelo persistente `CorrespondenceDraft` con estados formales.
2. **P0:** Implementar firma externa real integrada con `signature`.
3. **P0:** Garantizar idempotencia en creación de drafts desde contratos.
4. **P1:** Implementar flujo de revisión por rol antes de firma.
5. **P1:** Integrar con Document Center para generación de anexos.

---

*Fin del informe.*
