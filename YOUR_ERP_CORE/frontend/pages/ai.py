from frontend.pages.layout import base_layout


def ai_page():
    content = """
<div id="ai-root">
    <section class="ai-hero">
        <div class="ai-hero__content">
            <span class="ai-kicker">Integracion inteligente</span>
            <h1>IA, LLMs y agentes</h1>
            <p>Gestiona proveedores, prompts, agentes y planes de ejecucion para dejar el ERP listo para automatizaciones futuras.</p>
            <div class="ai-action-row">
                <button class="btn btn-primary" onclick="refreshAIWorkspace()">Actualizar panel</button>
                <button class="btn btn-secondary" onclick="scrollToAISection('ai-provider-form-card')">Nuevo proveedor</button>
                <button class="btn btn-ghost" onclick="scrollToAISection('ai-planner-card')">Planificar ejecucion</button>
            </div>
        </div>
        <div class="ai-hero__panel">
            <div class="ai-mini-card"><span>Proveedores activos</span><strong id="ai-metric-providers">0</strong><small id="ai-metric-providers-sub">Sin conexiones listas</small></div>
            <div class="ai-mini-card"><span>Prompts activos</span><strong id="ai-metric-prompts">0</strong><small id="ai-metric-prompts-sub">Plantillas listas para usar</small></div>
            <div class="ai-mini-card"><span>Agentes activos</span><strong id="ai-metric-agents">0</strong><small id="ai-metric-agents-sub">Orquestadores configurados</small></div>
            <div class="ai-mini-card"><span>Ejecuciones</span><strong id="ai-metric-executions">0</strong><small id="ai-metric-executions-sub">Planificadas o simuladas</small></div>
        </div>
    </section>

    <div class="ai-grid">
        <section class="card ai-card">
            <div class="ai-section-head">
                <div>
                    <div class="ai-section-kicker">Estado general</div>
                    <h3>Preparacion de la capa de IA</h3>
                    <p>Resumen del stack disponible para conectar OpenAI, Anthropic, Ollama u otros proveedores.</p>
                </div>
            </div>
            <div id="ai-status-board" class="ai-status-board"><div class="empty empty-compact">Cargando estado...</div></div>
        </section>

        <section class="card ai-card" id="ai-provider-form-card">
            <div class="ai-section-head">
                <div>
                    <div class="ai-section-kicker">Proveedores</div>
                    <h3>Registrar proveedor LLM</h3>
                    <p>Deja lista la conexion, modelos y capacidades, aunque la llamada real se active mas adelante.</p>
                </div>
            </div>
            <form class="ai-form" onsubmit="saveAIProvider(event)">
                <div class="form-row">
                    <div class="form-group"><label>Nombre</label><input id="ai-provider-name" placeholder="OpenAI Produccion" required></div>
                    <div class="form-group">
                        <label>Tipo</label>
                        <select id="ai-provider-kind">
                            <option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google</option><option value="azure_openai">Azure OpenAI</option><option value="openrouter">OpenRouter</option><option value="ollama">Ollama</option><option value="custom">Custom</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Modelo por defecto</label><input id="ai-provider-model" placeholder="gpt-4.1-mini"></div>
                    <div class="form-group"><label>Capacidades</label><input id="ai-provider-capabilities" placeholder="chat,tools,vision"></div>
                </div>
                <div class="form-group"><label>Base URL</label><input id="ai-provider-url" placeholder="https://api.openai.com/v1"></div>
                <div class="form-row">
                    <div class="form-group"><label>API Key</label><input id="ai-provider-key" placeholder="sk-..." type="password"></div>
                    <div class="form-group"><label>Catalogo de modelos</label><input id="ai-provider-models" placeholder="gpt-4.1-mini,gpt-4.1,gpt-4o-mini"></div>
                </div>
                <div class="ai-check-row">
                    <label><input type="checkbox" id="ai-provider-active" checked> Activo</label>
                    <label><input type="checkbox" id="ai-provider-default"> Proveedor por defecto</label>
                </div>
                <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar proveedor</button></div>
            </form>
        </section>
    </div>

    <div class="ai-grid">
        <section class="card ai-card">
            <div class="ai-section-head"><div><div class="ai-section-kicker">Registro</div><h3>Proveedores configurados</h3><p>Base preparada para multi-proveedor, failover y separacion por tenant.</p></div></div>
            <div id="ai-provider-list" class="ai-list"><div class="empty empty-compact">Sin proveedores cargados todavia.</div></div>
        </section>

        <section class="card ai-card">
            <div class="ai-section-head"><div><div class="ai-section-kicker">Prompts</div><h3>Plantillas reutilizables</h3><p>Versiona instrucciones y variables para documentos, soporte, ventas, RRHH u operaciones.</p></div></div>
            <form class="ai-form" onsubmit="saveAIPrompt(event)">
                <div class="form-row">
                    <div class="form-group"><label>Nombre</label><input id="ai-prompt-name" placeholder="Resumen de incidente" required></div>
                    <div class="form-group"><label>Categoria</label><input id="ai-prompt-category" placeholder="seguridad"></div>
                </div>
                <div class="form-group"><label>Variables</label><input id="ai-prompt-vars" placeholder="empresa,faena,incidente,acciones"></div>
                <div class="form-group"><label>Prompt de sistema</label><textarea id="ai-prompt-system" rows="4" placeholder="Eres un analista SST del ERP."></textarea></div>
                <div class="form-group"><label>Prompt de usuario</label><textarea id="ai-prompt-user" rows="5" placeholder="Resume el incidente {{incidente}} y propone acciones para {{empresa}}."></textarea></div>
                <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar prompt</button></div>
            </form>
            <div id="ai-prompt-list" class="ai-list"><div class="empty empty-compact">Sin prompts cargados todavia.</div></div>
        </section>
    </div>

    <div class="ai-grid">
        <section class="card ai-card">
            <div class="ai-section-head"><div><div class="ai-section-kicker">Agentes</div><h3>Definiciones de agentes</h3><p>Deja configurados roles, memoria y politicas de herramientas para futuras automatizaciones.</p></div></div>
            <form class="ai-form" onsubmit="saveAIAgent(event)">
                <div class="form-row">
                    <div class="form-group"><label>Nombre</label><input id="ai-agent-name" placeholder="Agente documental" required></div>
                    <div class="form-group"><label>Rol</label><input id="ai-agent-role" placeholder="document-analyst"></div>
                </div>
                <div class="form-group"><label>Objetivo</label><textarea id="ai-agent-goal" rows="3" placeholder="Clasificar documentos, detectar faltantes y sugerir acciones."></textarea></div>
                <div class="form-row">
                    <div class="form-group"><label>Politica de herramientas</label><select id="ai-agent-tools"><option value="manual">manual</option><option value="approved">approved</option><option value="auto">auto</option><option value="none">none</option></select></div>
                    <div class="form-group"><label>Memoria</label><select id="ai-agent-memory"><option value="session">session</option><option value="workflow">workflow</option><option value="company">company</option><option value="none">none</option></select></div>
                </div>
                <div class="form-group"><label>Instrucciones</label><textarea id="ai-agent-instructions" rows="4" placeholder="Prioriza trazabilidad, seguridad y respuesta estructurada."></textarea></div>
                <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar agente</button></div>
            </form>
            <div id="ai-agent-list" class="ai-list"><div class="empty empty-compact">Sin agentes definidos todavia.</div></div>
        </section>

        <section class="card ai-card" id="ai-planner-card">
            <div class="ai-section-head"><div><div class="ai-section-kicker">Planner</div><h3>Planificar ejecucion</h3><p>Simula una corrida con proveedor, prompt y agente para dejar trazabilidad y preparar la integracion real.</p></div></div>
            <form class="ai-form" onsubmit="planAIExecution(event)">
                <div class="form-row">
                    <div class="form-group"><label>Proveedor</label><select id="ai-plan-provider"></select></div>
                    <div class="form-group"><label>Prompt</label><select id="ai-plan-prompt"></select></div>
                </div>
                <div class="form-group"><label>Agente</label><select id="ai-plan-agent"></select></div>
                <div class="form-group"><label>Variables JSON</label><textarea id="ai-plan-variables" rows="6" placeholder='{"empresa":"Constructora Demo","incidente":"Caida sin lesion","acciones":"Bloqueo de area"}'></textarea></div>
                <div class="form-actions"><button class="btn btn-primary" type="submit">Generar plan</button></div>
            </form>
            <pre id="ai-plan-output" class="ai-pretty-output">Esperando simulacion...</pre>
        </section>
    </div>

    <section class="card ai-card">
        <div class="ai-section-head"><div><div class="ai-section-kicker">Auditoria</div><h3>Ultimas ejecuciones</h3><p>Registro base para depurar, medir adopcion y conectar observabilidad despues.</p></div></div>
        <div id="ai-execution-list" class="ai-list"><div class="empty empty-compact">Sin ejecuciones todavia.</div></div>
    </section>
</div>

<style>
#ai-root { display:grid; gap:1.5rem; }
.ai-hero { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(300px,1fr); gap:1.2rem; border-radius:28px; padding:1.75rem; border:1px solid rgba(148,163,184,0.18); background:radial-gradient(circle at top left, rgba(14,165,233,0.22), transparent 30%), radial-gradient(circle at bottom right, rgba(249,115,22,0.16), transparent 32%), linear-gradient(135deg, #07111d 0%, #0f172a 42%, #111827 100%); }
.ai-kicker, .ai-section-kicker { color:#93c5fd; text-transform:uppercase; letter-spacing:0.08em; font-size:0.74rem; font-weight:700; }
.ai-hero__content h1, .ai-section-head h3 { color:#f8fafc; margin:0.45rem 0 0; }
.ai-hero__content p, .ai-section-head p { color:#cbd5e1; line-height:1.7; }
.ai-action-row { display:flex; flex-wrap:wrap; gap:0.75rem; margin-top:1.25rem; }
.ai-hero__panel { display:grid; gap:0.8rem; grid-template-columns:repeat(2, minmax(0,1fr)); }
.ai-mini-card, .ai-status-item, .ai-record { border-radius:18px; border:1px solid rgba(71,85,105,0.65); background:rgba(15,23,42,0.72); padding:1rem; }
.ai-mini-card span, .ai-record__meta, .ai-status-pill { color:#94a3b8; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; }
.ai-mini-card strong { display:block; font-size:1.8rem; color:#f8fafc; margin-top:0.2rem; }
.ai-mini-card small { color:#cbd5e1; display:block; margin-top:0.35rem; line-height:1.5; }
.ai-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:1.5rem; }
.ai-card { display:grid; gap:1rem; }
.ai-form { display:grid; gap:0.85rem; }
.ai-check-row { display:flex; flex-wrap:wrap; gap:1rem; color:#cbd5e1; }
.ai-list, .ai-status-board { display:grid; gap:0.85rem; }
.ai-status-board { grid-template-columns:repeat(2, minmax(0,1fr)); }
.ai-record h4, .ai-status-item h4 { margin:0; color:#f8fafc; }
.ai-record p, .ai-status-item p { margin:0.4rem 0 0; color:#cbd5e1; line-height:1.6; }
.ai-record__row { display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-top:0.7rem; }
.ai-status-pill { display:inline-flex; align-items:center; padding:0.3rem 0.6rem; border-radius:999px; background:rgba(30,41,59,0.9); border:1px solid rgba(71,85,105,0.8); }
.ai-status-pill.ok { color:#86efac; border-color:#166534; background:#052e16; }
.ai-status-pill.warn { color:#fde68a; border-color:#a16207; background:#422006; }
.ai-pretty-output { margin:0; padding:1rem; background:#020617; border:1px solid #1e293b; border-radius:14px; color:#cbd5e1; overflow:auto; min-height:220px; white-space:pre-wrap; word-break:break-word; }
@media (max-width: 980px) { .ai-grid, .ai-hero, .ai-status-board { grid-template-columns:1fr; } .ai-hero__panel { grid-template-columns:1fr 1fr; } }
@media (max-width: 640px) { .ai-hero__panel { grid-template-columns:1fr; } }
</style>
"""
    return base_layout("IA y Agentes", "ai", content, scripts=["ai.js"])
