# Migración Módulo Signature (Firma Digital)

## Resumen

- **Estado:** ✅ **COMPLETADO**
- **Módulo original:** `signature` (Python FastAPI + ReportLab)
- **Nueva ubicación:** `web/src/modules/signature/` + `functions/src/modules/signature/signatureService.ts`

## Qué se migró

### Backend (Cloud Functions)

| Función | Descripción | Estado |
|---------|-------------|--------|
| `createSignatureRequest` | Crea solicitud de firma con token único | ✅ |
| `cancelSignatureRequest` | Cancela solicitud (solo creador) | ✅ |
| `signDocument` | Procesa firma vía token + genera PDF firmado | ✅ |
| `getSignatureRequest` | Obtiene detalle con posiciones | ✅ |
| `sendSignatureEmail` | Envía email con link de firma | ✅ |

### Frontend (React)

| Componente | Descripción | Estado |
|------------|-------------|--------|
| `SignatureCenter.tsx` | Centro de firmas - listado + creación | ✅ |
| `SignatureFormModal.tsx` | Modal de creación de solicitud | ✅ |
| `SignatureCanvas.tsx` | Canvas de firma digital (firmante externo) | ✅ |
| `PublicSignaturePage.tsx` | Página pública para firmar (vía token) | ✅ |

### Tipos TypeScript

- `SignatureRequest` - Modelo de solicitud
- `SignatureRequestSigner` - Modelo de firmante

## Arquitectura

```
┌─────────────────────┐     ┌─────────────────────────┐     ┌─────────────┐
│   SignatureCenter   │────▶│  createSignatureRequest │────▶│   Firestore │
│   (Admin)           │     │  Cloud Function         │     │   + Storage │
└─────────────────────┘     └─────────────────────────┘     └──────┬──────┘
                                                                   │
┌─────────────────────┐     ┌─────────────────────────┐            │
│  PublicSignaturePage│◀────│  signDocument           │◀───────────┘
│  (Firmante externo) │     │  Cloud Function         │
└─────────────────────┘     └─────────────────────────┘
```

## Flujo de firma

1. **Admin** crea solicitud desde `SignatureCenter` → selecciona documento + email del firmante
2. **Sistema** genera `accessToken` único y guarda en `signatureRequests`
3. **Admin** comparte link público con token al firmante
4. **Firmante** abre `PublicSignaturePage?token=xxx` → ve PDF → firma en canvas
5. **Sistema** valida token → embedde firma en PDF con `pdf-lib` → actualiza estado

## Decisiones técnicas

- **Tokens en vez de login:** El firmante externo no necesita cuenta. Solo usa el token único.
- **pdf-lib para firma visual:** Embedde imagen de firma en posición específica del PDF.
- **Sin DocuSign:** Solución propia. Integración DocuSign puede agregarse como provider adicional.
- **Multi-tenancy:** Todas las operaciones filtran por `companyId`.

## Datos demo

El seed crea automáticamente:
- 1 solicitud enviada (pendiente de firma)
- 1 solicitud firmada

## Próximos pasos sugeridos

1. Agregar envío automático de email con SendGrid
2. Implementar firma múltiple (más de un firmante)
3. Agregar integración DocuSign como provider alternativo
4. Crear auditoría completa con hash SHA-256 del PDF
