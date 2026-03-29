# Report Flow Audit & Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el flujo completo de creación/visualización de reportes de terreno — selectores en modal, datos precargados desde oportunidad, tiposervicio en info card, PDF limpio con fondo blanco, fotos funcionales en PDF.

**Architecture:** Hub & Spoke (Report → Lead). Todos los campos del Report son STRING (no FK) para mantener historial inmutable. Los selectores en el modal leen catálogos en tiempo real y guardan el nombre textual — no el ID. El PDF se genera 100% client-side con jsPDF; las fotos se sirven estáticamente desde `/uploads/`.

**Tech Stack:** FastAPI + custom ORM (BaseModel/Column), Vanilla JS, jsPDF 2.5.1, Python 3.x

---

## Diagnóstico de Problemas Encontrados

### Críticos
1. **APR/Supervisor/ADM son `<input type="text">`** — sin selector de usuarios
2. **Mandante es `<input type="text">`** — sin selector de `crm_mandantes`, sin pre-fill desde lead
3. **`tiposervicio` falta en el payload de `submitNuevoReporte()`** — se guarda vacío siempre
4. **Fotos en PDF usan `photo.file_url` = `/reports/photos/{id}`** que requiere Bearer token, pero `loadImage()` usa `new Image()` sin headers → fotos no cargan en PDF
5. **Fondo gris/imagen `back1.jpg`** se pega en cada página del PDF

### Menores
6. **`tiposervicio` no aparece en info card** de `report_workspace.js`
7. **No existe endpoint de personal** accesible para roles no-admin (`/users` requiere company_admin+)
8. **No existe `GET /crm/mandantes?customer_id=X`** como endpoint explícito

### Ya Correcto
- Area y Sector ya son `<select>` con cascada correcta ✓
- Empresa se auto-carga desde `LD.dossier.customer.name` ✓
- Fotos en la workspace view usan `/${photo.file_path}` (estático) ✓
- Cierre de reporte y checkpoint validation funcionan ✓

---

## Mapa de Archivos

| Archivo | Acción | Descripción de cambio |
|---|---|---|
| `modules/crm/module_crm.py` | **Modificar** | Agregar `GET /crm/mandantes` filtrable por `customer_id` |
| `modules/reports/module_reports.py` | **Modificar** | Agregar `GET /reports/personnel` (lista usuarios empresa, sin restricción de rol admin) |
| `frontend/pages/crm_lead_detail.py` | **Modificar** | Convertir inputs a `<select>` en modal Nuevo Reporte; agregar campo tiposervicio |
| `frontend/static/js/crm_lead_detail.js` | **Modificar** | `openNuevoReporteModal()` carga users/mandantes/service-types y pre-fill desde lead; `submitNuevoReporte()` agrega tiposervicio al payload |
| `frontend/static/js/report_workspace.js` | **Modificar** | `renderInfoCard()` agrega tiposervicio; agregar bloque resumen visual |
| `frontend/static/js/report_pdf_generator.js` | **Modificar** | Eliminar `back1.jpg`; cambiar `photo.file_url` → `'/' + photo.file_path` |

---

## Task 1: Backend — Agregar endpoint `GET /crm/mandantes`

**Files:**
- Modify: `YOUR_ERP_CORE/modules/crm/module_crm.py`

Verificar si el endpoint ya existe. Si no, agregarlo.

- [ ] **Step 1: Buscar si el endpoint ya existe**

Buscar en `module_crm.py` la cadena `'/crm/mandantes'`. Si existe con método GET → saltar al Task 2.

- [ ] **Step 2: Agregar registro de ruta en `init_module()`**

En `module_crm.py`, dentro de `init_module()`, junto a los otros `register_route` de CRM, agregar:

```python
self.register_route('/crm/mandantes', self.list_mandantes, methods=['GET'], auth_required=True)
```

- [ ] **Step 3: Agregar método `list_mandantes`**

En la clase `CRMModule`, agregar el método (junto a los otros listados similares como `list_service_types`):

```python
async def list_mandantes(self, request: Request) -> Response:
    """GET /crm/mandantes?customer_id=X — Lista mandantes activos del cliente."""
    if not self.env.user:
        return Response.unauthorized("Authentication required")

    company_id  = self._company_id()
    customer_id = request.get_param('customer_id')

    filters = [('company_id', '=', company_id), ('active', '=', True)]
    if customer_id:
        filters.append(('customer_id', '=', int(customer_id)))

    mandantes = Mandante.search(filters)
    mandantes.sort(key=lambda m: (m.name or '').upper())

    return Response.ok({
        'count':   len(mandantes),
        'results': [
            {
                'id':       m.id,
                'name':     m.name or '',
                'position': m.position or '',
                'email':    m.email or '',
                'phone':    m.phone or '',
            }
            for m in mandantes
        ]
    })
```

> **Nota:** Si `Mandante` no tiene `active` column, omitir ese filtro. Verificar el modelo antes.

- [ ] **Step 4: Reiniciar servidor y verificar en consola del navegador**

```
GET /crm/mandantes?customer_id=1
# Esperado: {"success": true, "data": {"count": N, "results": [...]}}
```

---

## Task 2: Backend — Agregar endpoint `GET /reports/personnel`

**Files:**
- Modify: `YOUR_ERP_CORE/modules/reports/module_reports.py`

Este endpoint devuelve la lista de usuarios activos de la empresa para poblar los selectores APR/Supervisor/ADM. Es accesible para TODOS los roles (no solo admin).

- [ ] **Step 1: Agregar ruta en `init_module()` de ReportsModule**

En `modules/reports/module_reports.py`, dentro de `init_module()`:

```python
self.register_route('/reports/personnel', self.list_personnel, methods=['GET'], auth_required=True)
```

Ubicar junto a los otros `register_route` del módulo.

- [ ] **Step 2: Agregar método `list_personnel`**

```python
async def list_personnel(self, request: Request) -> Response:
    """GET /reports/personnel — Lista usuarios activos de la empresa para selectores."""
    if not self.env.user:
        return Response.unauthorized("Authentication required")

    from modules.base.module_base import User
    company_id = self._company_id()

    users = User.search([
        ('company_id', '=', company_id),
        ('is_active',  '=', True),
    ])
    users.sort(key=lambda u: (u.name or '').upper())

    return Response.ok({
        'count':   len(users),
        'results': [
            {
                'id':   u.id,
                'name': u.name or u.email or '',
            }
            for u in users
        ]
    })
```

> **Nota:** Verificar el import correcto de `User` — puede ser `from modules.base.module_base import User` o similar según la estructura del proyecto.

- [ ] **Step 3: Verificar en consola del navegador**

```
GET /reports/personnel
# Esperado: {"success": true, "data": {"count": N, "results": [{id, name}, ...]}}
```

---

## Task 3: Modal HTML — Convertir inputs a selects y agregar tiposervicio

**Files:**
- Modify: `YOUR_ERP_CORE/frontend/pages/crm_lead_detail.py`

Reemplazar los 4 `<input type="text">` del modal (APR, Supervisor, ADM, Mandante) por `<select>`, y agregar campo Tipo de Servicio.

- [ ] **Step 1: Reemplazar bloque de personal (APR, Supervisor, ADM, Mandante)**

Localizar el bloque en el modal `modal-nuevo-reporte`:

```html
<!-- Personal (grid 2 cols) -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem;">
    <div class="form-group">
        <label>APR (Prevencionista)</label>
        <input type="text" id="nr-apr" placeholder="Nombre APR"
               style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
    </div>
    <div class="form-group">
        <label>Supervisor</label>
        <input type="text" id="nr-supervisor" placeholder="Nombre Supervisor"
               style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
    </div>
    <div class="form-group">
        <label>ADM Contrato</label>
        <input type="text" id="nr-adm" placeholder="Nombre ADM"
               style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
    </div>
    <div class="form-group">
        <label>Mandante</label>
        <input type="text" id="nr-mandante" placeholder="Representante cliente"
               style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
    </div>
</div>
```

Reemplazar por:

```html
<!-- Personal (grid 2 cols) — selectores -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem;">
    <div class="form-group">
        <label>APR (Prevencionista)</label>
        <select id="nr-apr"
                style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
            <option value="">Cargando&hellip;</option>
        </select>
    </div>
    <div class="form-group">
        <label>Supervisor</label>
        <select id="nr-supervisor"
                style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
            <option value="">Cargando&hellip;</option>
        </select>
    </div>
    <div class="form-group">
        <label>ADM Contrato</label>
        <select id="nr-adm"
                style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
            <option value="">Cargando&hellip;</option>
        </select>
    </div>
    <div class="form-group">
        <label>Mandante</label>
        <select id="nr-mandante"
                style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
            <option value="">-- Sin mandante --</option>
        </select>
    </div>
</div>
<!-- Tipo de Servicio -->
<div class="form-group" style="margin-top:0.75rem;">
    <label>Tipo de Servicio</label>
    <select id="nr-tiposervicio"
            style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
        <option value="">-- Sin tipo de servicio --</option>
    </select>
</div>
```

---

## Task 4: Modal JS — Carga de selectores y pre-fill desde lead

**Files:**
- Modify: `YOUR_ERP_CORE/frontend/static/js/crm_lead_detail.js`

Cuatro cambios en este archivo:
1. Reescribir `openNuevoReporteModal()` para cargar personnel + mandantes + service types + pre-fill
2. Agregar `_loadPersonnelSelects()`, `_loadMandantesSelect()`, `_loadServiceTypesSelect()` helpers
3. Actualizar `submitNuevoReporte()` para leer los nuevos selects y enviar `tiposervicio`

- [ ] **Step 1: Reemplazar `openNuevoReporteModal()`**

Localizar la función y reemplazarla completa:

```javascript
async function openNuevoReporteModal() {
    // Reset form
    document.getElementById('nr-servicio').value = '';

    // Reset selects a estado de carga
    ['nr-apr', 'nr-supervisor', 'nr-adm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<option value="">Cargando…</option>';
    });
    document.getElementById('nr-mandante').innerHTML    = '<option value="">Cargando…</option>';
    document.getElementById('nr-tiposervicio').innerHTML = '<option value="">Cargando…</option>';
    document.getElementById('nr-sector').disabled   = true;
    document.getElementById('nr-sector').style.opacity = '0.6';
    document.getElementById('nr-sector').style.color   = '#94a3b8';
    document.getElementById('nr-sector').innerHTML  = '<option value="">-- Primero elige Área --</option>';
    document.getElementById('nr-area').innerHTML    = '<option value="">Cargando…</option>';

    document.getElementById('modal-nuevo-reporte').style.display = 'flex';

    const customerId = LD.lead ? LD.lead.customer_id : null;

    // Cargar en paralelo: áreas, personal, mandantes, service types
    await Promise.all([
        customerId ? loadAreasModal(customerId) : Promise.resolve(),
        _loadPersonnelSelects(),
        customerId ? _loadMandantesSelect(customerId) : Promise.resolve(),
        _loadServiceTypesSelect(),
    ]);

    // Pre-fill desde lead
    _prefillFromLead();

    setTimeout(() => document.getElementById('nr-servicio').focus(), 100);
}
```

- [ ] **Step 2: Agregar helper `_loadPersonnelSelects()`**

```javascript
async function _loadPersonnelSelects() {
    try {
        const res = await API.get('/reports/personnel');
        const users = (res && res.success) ? (res.data?.results || res.data || []) : [];
        const defaultOpt = '<option value="">-- Sin asignar --</option>';
        const opts = defaultOpt + users.map(u =>
            `<option value="${u.name}">${u.name}</option>`
        ).join('');
        ['nr-apr', 'nr-supervisor', 'nr-adm'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = opts;
        });
    } catch(e) {
        ['nr-apr', 'nr-supervisor', 'nr-adm'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<option value="">Error al cargar</option>';
        });
    }
}
```

- [ ] **Step 3: Agregar helper `_loadMandantesSelect(customerId)`**

```javascript
async function _loadMandantesSelect(customerId) {
    const sel = document.getElementById('nr-mandante');
    if (!sel) return;
    try {
        const res = await API.get(`/crm/mandantes?customer_id=${customerId}`);
        const mandantes = (res && res.success) ? (res.data?.results || res.data || []) : [];
        sel.innerHTML = '<option value="">-- Sin mandante --</option>' +
            mandantes.map(m =>
                `<option value="${m.name}">${m.name}${m.position ? ' — ' + m.position : ''}</option>`
            ).join('');
    } catch(e) {
        sel.innerHTML = '<option value="">Error al cargar</option>';
    }
}
```

- [ ] **Step 4: Agregar helper `_loadServiceTypesSelect()`**

```javascript
async function _loadServiceTypesSelect() {
    const sel = document.getElementById('nr-tiposervicio');
    if (!sel) return;
    try {
        const res = await API.get('/crm/service-types');
        const types = (res && res.success) ? (res.data?.results || res.data || []) : [];
        sel.innerHTML = '<option value="">-- Sin tipo de servicio --</option>' +
            types.map(t =>
                `<option value="${t.name}">${t.name}</option>`
            ).join('');
    } catch(e) {
        sel.innerHTML = '<option value="">Error al cargar</option>';
    }
}
```

- [ ] **Step 5: Agregar helper `_prefillFromLead()`**

```javascript
function _prefillFromLead() {
    const lead    = LD.lead;
    const dossier = LD.dossier;
    if (!lead) return;

    // Pre-fill Tipo de Servicio desde lead.service_type_id / dossier.service_type
    const svcName = dossier?.service_type?.name || '';
    if (svcName) {
        const svcSel = document.getElementById('nr-tiposervicio');
        if (svcSel) {
            // Intentar seleccionar por texto exacto
            Array.from(svcSel.options).forEach(opt => {
                if (opt.value === svcName) opt.selected = true;
            });
            // Si no encontró, agregar la opción
            if (!svcSel.value) {
                const opt = document.createElement('option');
                opt.value = svcName; opt.textContent = svcName; opt.selected = true;
                svcSel.appendChild(opt);
            }
        }
    }

    // Pre-fill Mandante desde dossier.mandante (o mandante_data)
    const mandanteName = dossier?.mandante?.name || dossier?.mandante_data?.name || '';
    if (mandanteName) {
        const mSel = document.getElementById('nr-mandante');
        if (mSel) {
            Array.from(mSel.options).forEach(opt => {
                if (opt.value === mandanteName) opt.selected = true;
            });
            if (!mSel.value) {
                const opt = document.createElement('option');
                opt.value = mandanteName; opt.textContent = mandanteName; opt.selected = true;
                mSel.appendChild(opt);
            }
        }
    }
}
```

- [ ] **Step 6: Actualizar `submitNuevoReporte()` — agregar tiposervicio y leer selects correctamente**

Localizar el bloque `const payload = {...}` dentro de `submitNuevoReporte()` y reemplazarlo:

```javascript
    const payload = {
        lead_id:       window._LEAD_ID,
        servicio:      servicio.toUpperCase(),
        apr:           document.getElementById('nr-apr').value.trim(),
        supervisor:    document.getElementById('nr-supervisor').value.trim(),
        adm:           document.getElementById('nr-adm').value.trim(),
        mandante:      document.getElementById('nr-mandante').value.trim(),
        area:          areaNombre,
        sector:        sectNombre,
        empresa:       customerName,
        tiposervicio:  document.getElementById('nr-tiposervicio').value.trim(),
    };
```

---

## Task 5: Report Workspace — Info card con tiposervicio y cuadro resumen

**Files:**
- Modify: `YOUR_ERP_CORE/frontend/static/js/report_workspace.js`

- [ ] **Step 1: Reemplazar `renderInfoCard()` completa**

Localizar la función y reemplazarla:

```javascript
function renderInfoCard(report) {
    const leadRef = report.lead_id
        ? `<a href="/app/crm/leads/${report.lead_id}"
              style="color:#3b82f6;text-decoration:none;font-weight:600;">
               🔗 Oportunidad #${report.lead_id}
           </a>`
        : '—';

    // Cuadro resumen de contexto del servicio
    const resumenHtml = `
        <div style="background:#172554;border:1px solid #1d4ed8;border-radius:10px;
                    padding:1rem 1.25rem;margin-bottom:1.25rem;">
            <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;
                        color:#60a5fa;font-weight:700;margin-bottom:0.6rem;">
                &#128203; Contexto del Servicio
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">
                ${summaryField('Tipo de Servicio', report.tiposervicio, '#a5b4fc')}
                ${summaryField('Mandante',         report.mandante,     '#a5b4fc')}
                ${summaryField('Área',             report.area,         '#93c5fd')}
                ${summaryField('Sector',           report.sector,       '#93c5fd')}
            </div>
        </div>`;

    document.getElementById('ws-info-card').innerHTML = `
        <!-- Oportunidad asociada -->
        <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;
                    padding:0.6rem 1rem;margin-bottom:1rem;font-size:0.85rem;color:#93c5fd;">
            <strong style="color:#bfdbfe;">Oportunidad asociada:</strong>&nbsp;${leadRef}
        </div>
        ${resumenHtml}
        <!-- Grid de datos operativos -->
        <h3 style="margin:0 0 0.75rem;color:#f1f5f9;font-size:0.82rem;text-transform:uppercase;
                   letter-spacing:0.05em;border-bottom:1px solid #334155;padding-bottom:0.5rem;">
            &#128203; Datos Operativos
        </h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.9rem;">
            ${infoField('Servicio',          report.servicio,  true)}
            ${infoField('Empresa / Faena',   report.empresa)}
            ${infoField('APR (Prevencionista)', report.apr)}
            ${infoField('Supervisor',        report.supervisor)}
            ${infoField('ADM Contrato',      report.adm)}
            ${infoField('Emisión',           report.emision ? report.emision.split('T')[0] : '—')}
        </div>
    `;
}

function summaryField(label, value, color) {
    const v = escHtml(value || '—');
    const isEmpty = !value || value === '—';
    return `
        <div>
            <div style="font-size:0.68rem;color:#60a5fa;text-transform:uppercase;
                        letter-spacing:0.04em;margin-bottom:0.15rem;">${label}</div>
            <div style="color:${isEmpty ? '#475569' : color};font-weight:${isEmpty ? '400' : '600'};
                        font-size:0.85rem;">${v}</div>
        </div>`;
}
```

> **Nota:** La función `infoField()` existente no cambia. `summaryField()` es nueva.

---

## Task 6: PDF Generator — Fondo blanco y fotos funcionales

**Files:**
- Modify: `YOUR_ERP_CORE/frontend/static/js/report_pdf_generator.js`

Dos cambios quirúrgicos:

**Cambio A:** Eliminar carga y uso de `back1.jpg`
**Cambio B:** Reemplazar `photo.file_url` por `'/' + photo.file_path` para servido estático sin auth

- [ ] **Step 1: Eliminar carga del background**

Localizar el bloque (líneas ~102-105):

```javascript
    const logoBase64 = await loadImage(logoUrl);
    const back1 = '/static/assets/back1.jpg'; // Fondo detectado en _referencia
    const backBase64 = await loadImage(back1);
```

Reemplazar por:

```javascript
    const logoBase64 = await loadImage(logoUrl);
    // Sin fondo: reporte con fondo blanco limpio
```

- [ ] **Step 2: Eliminar todos los `addImage(backBase64, ...)` del cuerpo del PDF**

Hay 2 instancias. La primera (en el bucle de checkpoints, al inicio del bloque):

```javascript
        if (backBase64) {
            doc.addImage(backBase64, 'JPEG', m, 60 + 4, 201, 190);
        }
```

Eliminar ese bloque completo (3 líneas). Repetir para la segunda instancia dentro del bucle de fotos:

```javascript
                if (backBase64) {
                    doc.addImage(backBase64, 'JPEG', m, 60 + 4, 201, 190);
                }
```

Eliminar ese bloque también.

- [ ] **Step 3: Corregir URL de fotos en PDF**

Localizar el bucle de fotos dentro de checkpoints:

```javascript
                const photoUrl = photo.file_url;
                const photoDataUrl = await loadImage(photoUrl);
```

Reemplazar por:

```javascript
                const photoUrl = photo.file_path ? ('/' + photo.file_path) : photo.file_url;
                const photoDataUrl = await loadImage(photoUrl);
```

- [ ] **Step 4: Corregir URL de thumbnails en resumen final**

Localizar en la sección de resumen:

```javascript
            const thumbUrl = await loadImage(check.photos[0].file_url);
```

Reemplazar por:

```javascript
            const ph0 = check.photos[0];
            const thumbUrl = await loadImage(ph0.file_path ? ('/' + ph0.file_path) : ph0.file_url);
```

---

## Task 7: Validación manual — Flujo completo

- [ ] **Step 1: Abrir una Oportunidad con cliente, mandante y tipo de servicio asignados**
    - Verificar que al abrir el modal "Nuevo Reporte de Terreno" los selectores APR/Supervisor/ADM estén poblados con usuarios
    - Verificar que el selector de Mandante está poblado con los mandantes del cliente
    - Verificar que Tipo de Servicio muestra opciones y pre-selecciona el del lead

- [ ] **Step 2: Crear un reporte nuevo**
    - Seleccionar APR, Supervisor, ADM
    - Seleccionar Mandante (verificar que pre-seleccionó el del lead)
    - Seleccionar Área → verificar que Sector se habilita y filtra
    - Seleccionar Sector
    - Confirmar Tipo de Servicio
    - Click "Crear Reporte"
    - Verificar que redirige al workspace

- [ ] **Step 3: En el workspace del reporte**
    - Verificar que el cuadro resumen muestra: Tipo de Servicio, Mandante, Área, Sector
    - Verificar que los datos operativos muestran APR, Supervisor, ADM, Empresa, Emisión
    - Verificar que todos los campos tienen valores (no "—" vacíos salvo los que genuinamente falten)

- [ ] **Step 4: Agregar al menos 2 checkpoints con fotos**
    - Primer checkpoint: debe forzar tipo INICIAL
    - Subir una foto en el segundo checkpoint

- [ ] **Step 5: Generar PDF**
    - Click "Generar y Descargar PDF"
    - Verificar: fondo blanco (sin imagen de fondo gris)
    - Verificar: cabecera con empresa, área, sector, tipo de servicio, estado
    - Verificar: fotos de checkpoints se cargan y se muestran en el PDF
    - Verificar: bloque de firmas tiene APR, Supervisor, ADM, Mandante

- [ ] **Step 6: Abrir una Oportunidad SIN cliente asignado**
    - Verificar que el modal maneja gracefully el caso sin customer_id (mensaje en selector de área)

---

## Riesgos y Deuda Técnica

| Riesgo | Severidad | Mitigación |
|---|---|---|
| `Mandante.active` puede no existir en el modelo | Baja | Verificar antes de agregar el filtro; omitirlo si falta |
| Import de `User` en `module_reports.py` puede requerir ruta exacta | Media | Verificar con `grep -r "class User" modules/` |
| Si `LD.dossier` usa `mandante_data` vs `mandante` como clave | Media | `_prefillFromLead()` ya maneja ambos: `dossier?.mandante?.name \|\| dossier?.mandante_data?.name` |
| Usuarios con rol `employee` no podrán ver lista de mandantes si `/crm/mandantes` requiere admin | Baja | El endpoint nuevo no tiene restricción de rol (solo auth_required) |
| Fotos muy grandes pueden hacer lento el PDF | Baja | El flujo actual ya limita 5MB por foto; aceptable |
| Si `file_path` está vacío en alguna foto antigua, fallback a `file_url` funciona | Baja | El fix en task 6 usa `photo.file_path ? ('/' + ph) : photo.file_url` |
