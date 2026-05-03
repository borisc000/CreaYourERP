def service_verification_page(public_token: str):
    content = f"""
<style>
#service-verification {{
    min-height: 100vh;
    background:
        radial-gradient(circle at top right, rgba(14, 165, 233, 0.18), transparent 24%),
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 28%),
        linear-gradient(180deg, #07111f 0%, #0b1220 42%, #0f172a 100%);
}}
.sv-shell {{
    max-width: 1180px;
    margin: 0 auto;
    padding: 2rem 1.25rem 3rem;
}}
.sv-hero, .sv-panel {{
    border-radius: 1.35rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.82));
    box-shadow: 0 18px 46px rgba(2, 6, 23, 0.24);
}}
.sv-hero {{
    padding: 1.5rem;
    margin-bottom: 1rem;
}}
.sv-grid {{
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(12, minmax(0, 1fr));
}}
.sv-panel {{
    grid-column: span 12;
    padding: 1.2rem;
}}
.sv-half {{
    grid-column: span 6;
}}
.sv-title {{
    margin: 0.25rem 0 0.55rem;
    color: #f8fafc;
    font-size: clamp(1.6rem, 3vw, 2.3rem);
}}
.sv-subtitle, .sv-muted {{
    color: #cbd5e1;
}}
.sv-kicker, .sv-label {{
    color: #7dd3fc;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.74rem;
    font-weight: 800;
}}
.sv-chip-row, .sv-actions {{
    display: flex;
    gap: 0.7rem;
    flex-wrap: wrap;
}}
.sv-chip, .sv-link {{
    display: inline-flex;
    align-items: center;
    padding: 0.45rem 0.8rem;
    border-radius: 999px;
    border: 1px solid rgba(96, 165, 250, 0.24);
    background: rgba(15, 23, 42, 0.64);
    color: #dbeafe;
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 700;
}}
.sv-stats, .sv-info-grid, .sv-list {{
    display: grid;
    gap: 0.85rem;
}}
.sv-stats, .sv-info-grid {{
    grid-template-columns: repeat(2, minmax(0, 1fr));
}}
.sv-card {{
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.12);
    background: rgba(10, 15, 29, 0.62);
    padding: 0.95rem 1rem;
}}
.sv-card strong {{
    display: block;
    margin-top: 0.4rem;
    color: #f8fafc;
}}
@media (max-width: 980px) {{
    .sv-half {{ grid-column: span 12; }}
    .sv-stats, .sv-info-grid {{ grid-template-columns: 1fr; }}
}}
</style>
<div id="service-verification" data-token="{public_token}">
    <div class="sv-shell">
        <section class="sv-hero">
            <div class="sv-kicker">Service Mirror</div>
            <h1 class="sv-title" id="sv-title">Verificando servicio…</h1>
            <p class="sv-subtitle" id="sv-subtitle">Copia digital de solo lectura del servicio, sus reportes, documentos y trazabilidad.</p>
            <div class="sv-chip-row">
                <span class="sv-chip">Solo lectura</span>
                <span class="sv-chip" id="sv-code">Preparando...</span>
            </div>
        </section>
        <div class="sv-grid">
            <section class="sv-panel">
                <div class="sv-stats" id="sv-stats"></div>
            </section>
            <section class="sv-panel sv-half">
                <div class="sv-kicker">Contexto</div>
                <div class="sv-info-grid" id="sv-context"></div>
            </section>
            <section class="sv-panel sv-half">
                <div class="sv-kicker">Empresa</div>
                <div class="sv-info-grid" id="sv-company"></div>
            </section>
            <section class="sv-panel">
                <div class="sv-kicker">Documentos</div>
                <div class="sv-list" id="sv-docs"></div>
            </section>
            <section class="sv-panel sv-half">
                <div class="sv-kicker">Reportes</div>
                <div class="sv-list" id="sv-reports"></div>
            </section>
            <section class="sv-panel sv-half">
                <div class="sv-kicker">Historial</div>
                <div class="sv-list" id="sv-activity"></div>
            </section>
        </div>
    </div>
</div>
<script>
(async function() {{
    const root = document.getElementById('service-verification');
    const token = root?.dataset?.token || '';
    const qs = (id) => document.getElementById(id);
    const card = (label, value) => `<div class="sv-card"><span class="sv-label">${{label}}</span><strong>${{value || '—'}}</strong></div>`;
    const safe = (value) => {{
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }};
    try {{
        const res = await fetch(`/crm/services/public/${{token}}`);
        const raw = await res.json();
        const data = raw.data || raw;
        if (!res.ok || raw.success === false) throw new Error((raw.errors || ['No fue posible cargar el servicio']).join(', '));

        const service = data.service || {{}};
        const company = data.company || {{}};
        const summary = data.summary || {{}};
        qs('sv-title').textContent = service.service_name || service.title || service.service_code || 'Servicio';
        qs('sv-subtitle').textContent = `${{safe(data.customer?.name || '')}} · ${{safe(data.service_type?.name || '')}}`;
        qs('sv-code').textContent = service.service_code || 'Servicio';
        qs('sv-stats').innerHTML = [
            card('Documentos', summary.documents_count || 0),
            card('Reportes', summary.reports_count || 0),
            card('Historial', summary.activity_count || 0),
            card('Estado operativo', service.operational_status || '—')
        ].join('');
        qs('sv-context').innerHTML = [
            card('Cliente', safe(data.customer?.name || '')),
            card('Mandante', safe(data.mandante?.name || '')),
            card('Faena', safe(service.empresa_faena || '')),
            card('APR', safe(service.apr_name || '')),
            card('Supervisor', safe(service.supervisor_name || '')),
            card('Administrador', safe(service.contract_admin_name || ''))
        ].join('');
        qs('sv-company').innerHTML = [
            card('Empresa', safe(company.legal_name || company.name || '')),
            card('RUT', safe(company.tax_id || '')),
            card('Correo', safe(company.email || '')),
            card('Teléfono', safe(company.phone || '')),
            card('Dirección', safe(company.address || '')),
            card('API pública', `<a class="sv-link" href="/crm/services/public/${{token}}" target="_blank" rel="noopener">Ver JSON</a>`)
        ].join('');
        qs('sv-docs').innerHTML = (data.documents || []).length ? (data.documents || []).map((doc) => `
            <div class="sv-card">
                <span class="sv-label">${{safe(doc.document_type || doc.category || 'general')}} · v${{doc.version || 1}}</span>
                <strong>${{safe(doc.filename || '')}}</strong>
                <div class="sv-actions" style="margin-top:0.75rem;">
                    <a class="sv-link" href="${{safe(doc.download_url || '#')}}" target="_blank" rel="noopener">Descargar</a>
                </div>
            </div>
        `).join('') : '<div class="sv-card"><strong>No hay documentos visibles.</strong></div>';
        qs('sv-reports').innerHTML = (data.reports || []).length ? (data.reports || []).map((report) => `
            <div class="sv-card">
                <span class="sv-label">${{safe(report.estado || 'ABIERTO')}}</span>
                <strong>${{safe(report.report_number || report.id || '')}} · ${{safe(report.servicio || '')}}</strong>
                <div class="sv-muted">${{safe(report.last_checkpoint_tipo || 'Sin hitos')}} · ${{safe(report.signature_status || 'sin firma')}}</div>
                <div class="sv-actions" style="margin-top:0.75rem;">
                    ${{report.mirror_url ? `<a class="sv-link" href="${{safe(report.mirror_url)}}" target="_blank" rel="noopener">Ver reporte</a>` : ''}}
                </div>
            </div>
        `).join('') : '<div class="sv-card"><strong>No hay reportes visibles.</strong></div>';
        qs('sv-activity').innerHTML = (data.activity || []).length ? (data.activity || []).map((item) => `
            <div class="sv-card">
                <span class="sv-label">${{safe(item.user_name || 'Sistema')}}</span>
                <strong>${{safe(item.action || '')}}</strong>
                <div class="sv-muted">${{safe(item.details || '')}}</div>
            </div>
        `).join('') : '<div class="sv-card"><strong>Sin actividad registrada.</strong></div>';
    }} catch (error) {{
        qs('sv-title').textContent = 'Servicio no disponible';
        qs('sv-subtitle').textContent = error.message || 'No fue posible verificar este servicio.';
        qs('sv-code').textContent = 'Error';
    }}
}})();
</script>
"""
    return content
