# GUÍA DE MIGRACIÓN: Python ERP → Firebase (TypeScript/React)

## La verdad sin filtro

**Sí, hay que reescribir.** Pero no todo. Hay código que se traduce casi línea por línea, y hay código que hay que tirar y hacer de nuevo.

## ¿Qué se SALVA? (Reutilizable)

| Componente Python | Estado | Notas |
|-------------------|--------|-------|
| **Lógica de cálculo** (totales de cotización, fórmulas HH) | ✅ Se traduce directo a TS | Es matemática pura |
| **Validaciones de negocio** (estados permitidos, reglas) | ✅ Se traduce directo a TS | Ej: `role must be in CREW_ROLES` |
| **Flujos de estado** (draft → sent → accepted) | ✅ Se traduce a TS | Máquinas de estado |
| **Estructura de modelos** (campos, tipos, defaults) | ⚠️ Se adapta a Firestore | Mismo schema, diferente sintaxis |
| **Frontend HTML actual** | ❌ Se reescribe en React | Los templates Jinja/HTML no sirven |
| **ORM custom** (BaseModel, save(), search()) | ❌ Se elimina | Firestore lo reemplaza |
| **Routing de FastAPI** | ❌ Se elimina | Firebase Functions + React Router |
| **SQLite local** | ❌ Se elimina | Firestore lo reemplaza |

## Analogía simple

Tu ERP Python actual es como una casa construida con **cartón y duct tape** (el ORM JSON-blob). Tiene **muebles increíbles** (la lógica de negocio: cotizaciones HH, acreditaciones, cuadrillas).

Lo que estamos haciendo:
1. **Construir una casa nueva** con cimientos de hormigón (Firebase)
2. **Traer los muebles** de la casa vieja (traducir la lógica de negocio)
3. **Tirar el cartón** (el ORM custom, el routing, los templates)

## El esfuerzo real

| Módulo | Líneas Python | Estado Firebase | Esfuerzo estimado | Notas |
|--------|--------------|-----------------|-------------------|-------|
| Base (Users, Companies) | ~500 | ✅ Completo | Bajo | Scaffold inicial |
| CRM (Customers, Leads) | ~800 | ✅ Completo | Medio | Relaciones simples |
| Quotes (Cotizaciones) | ~1.900 | ✅ Completo | Alto | Cálculos HH, numeración automática |
| Accreditation | ~1.200 | ✅ Completo | Alto | Checks de cuadrilla, matriz |
| HR (Empleados, Contratos) | ~1.500 | ✅ Completo | Medio | CRUD + workflows |
| Safety | ~9.169 | ✅ Completo | **Alto** | MIPER, IRL, EPP, charlas, checklists, exportación |
| Document Center | ~3.500 | ✅ Completo | Alto | Templates, generación PDF, ciclo de vida |
| Signature | ~1.600 | 🔄 Pendiente | Medio | Reemplazar por DocuSign/firma digital |
| Billing | ~600 | 🔄 Pendiente | Bajo | Stripe, plan limits ya parcial |

**Total estimado original:** 2-3 semanas
**Progreso actual:** ~75% de los módulos core migrados

## Estrategia recomendada: Módulo por módulo

NO hagas la migración de todo de una vez. Hazla **módulo por módulo**, empezando por el más simple.

**Orden recomendado (actualizado con progreso):**
1. ✅ Base (Users, Companies) - Ya está en el scaffold
2. ✅ CRM (Customers, Mandantes) - Para aprender el patrón
3. ✅ Quotes - El más importante para ventas
4. ✅ HR - Empleados
5. ✅ Accreditation - La joya de la corona
6. ✅ Safety - Prevención de riesgos (módulo más grande)
7. ✅ Document Center - Centro documental transversal
8. 🔄 Signature - Firma digital
9. 🔄 Billing - Stripe, facturación
10. ❌ Inventory, Rentals, Payroll, etc. - Futuro

Cada módulo sigue este patrón:
1. Traducir modelo Python → interfaz TypeScript
2. Crear Cloud Function para lógica compleja (si aplica)
3. Crear componentes React (lista + formulario)
4. Conectar con hook `useFirestore`
5. Probar

## ¿Tu socio puede seguir haciendo vibe-coding?

**Sí, pero con un cambio de herramienta.**

Antes usaba IA para generar Python + FastAPI + HTML. Ahora usará IA para generar:
- **TypeScript** (Cloud Functions)
- **React + Tailwind** (frontend)
- **Firebase SDK** (lectura/escritura de datos)

El prompt cambia de:
> "Crea un endpoint en FastAPI para crear cotizaciones"

A:
> "Crea un componente React con formulario para crear cotizaciones, usando useFirestore hook para guardar en Firestore"

La lógica de negocio es **exactamente la misma**. Solo cambia el lenguaje y la forma de guardar/leer datos.
