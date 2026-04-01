from frontend.pages.layout import base_layout


def riohs_page():
    content = """
    <div class="page-header">
        <h1>📋 Generador de Reglamento Interno</h1>
        <p class="text-muted">RIOHS / RIHS · Formato ACHS 2026 · DS N°44 · Ley 16.744</p>
    </div>

    <!-- LISTA DE REGLAMENTOS -->
    <div id="view-list">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
            <div>
                <span id="stats-count" style="color:#64748b;font-size:0.9rem"></span>
            </div>
            <button class="btn btn-primary" onclick="showWizard()">+ Nuevo Reglamento</button>
        </div>
        <div id="reglamentos-list" class="riohs-grid"></div>
        <div id="list-empty" class="empty-state" style="display:none">
            <div style="font-size:3rem">📋</div>
            <h3>Sin reglamentos aún</h3>
            <p>Crea tu primer reglamento personalizado basado en el formato oficial ACHS 2026</p>
            <button class="btn btn-primary" onclick="showWizard()">+ Crear mi Reglamento</button>
        </div>
    </div>

    <!-- WIZARD OVERLAY -->
    <div id="wizard-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;overflow-y:auto">
        <div class="wizard-container">

            <!-- Header wizard -->
            <div class="wizard-header">
                <div>
                    <h2 id="wizard-title">Nuevo Reglamento Interno</h2>
                    <p id="wizard-subtitle" class="text-muted"></p>
                </div>
                <button onclick="closeWizard()" style="background:none;border:none;color:#94a3b8;font-size:1.5rem;cursor:pointer">✕</button>
            </div>

            <!-- Progress bar -->
            <div class="wizard-progress">
                <div class="progress-track">
                    <div id="progress-bar" style="height:4px;background:#3b82f6;border-radius:2px;transition:width 0.3s;width:12.5%"></div>
                </div>
                <div id="step-indicators" class="step-indicators"></div>
            </div>

            <!-- Pasos -->
            <div id="wizard-steps">

                <!-- PASO 1: Datos de la empresa -->
                <div class="wizard-step" id="step-1">
                    <div class="step-intro">
                        <span class="step-icon">🏢</span>
                        <h3>Datos de la Empresa</h3>
                        <p>Identificación legal y operacional</p>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group required">
                            <label>Razón Social</label>
                            <input type="text" id="empresa_nombre" placeholder="Constructora Pedro S.A." />
                        </div>
                        <div class="form-group required">
                            <label>RUT Empresa</label>
                            <input type="text" id="empresa_rut" placeholder="76.543.210-K" />
                        </div>
                        <div class="form-group required">
                            <label>Giro / Actividad Económica</label>
                            <input type="text" id="empresa_giro" placeholder="Construcción y obras civiles" />
                        </div>
                        <div class="form-group required">
                            <label>Organismo Administrador del Seguro (Ley 16.744)</label>
                            <select id="organismo_admin">
                                <option value="ACHS">ACHS – Asociación Chilena de Seguridad</option>
                                <option value="Mutual de Seguridad">Mutual de Seguridad CChC</option>
                                <option value="IST">IST – Instituto de Seguridad del Trabajo</option>
                                <option value="INS">INS – Instituto Nacional de Seguridad</option>
                            </select>
                        </div>
                        <div class="form-group required">
                            <label>Dirección</label>
                            <input type="text" id="empresa_direccion" placeholder="Av. Providencia 1234" />
                        </div>
                        <div class="form-group required">
                            <label>Ciudad</label>
                            <input type="text" id="empresa_ciudad" placeholder="Santiago" />
                        </div>
                        <div class="form-group required">
                            <label>Región</label>
                            <select id="empresa_region">
                                <option>Región Metropolitana</option>
                                <option>Región de Valparaíso</option>
                                <option>Región del Biobío</option>
                                <option>Región de La Araucanía</option>
                                <option>Región de Antofagasta</option>
                                <option>Región de Coquimbo</option>
                                <option>Región de O'Higgins</option>
                                <option>Región del Maule</option>
                                <option>Región de Los Lagos</option>
                                <option>Región de Los Ríos</option>
                                <option>Región de Tarapacá</option>
                                <option>Región de Atacama</option>
                                <option>Región de Aysén</option>
                                <option>Región de Magallanes</option>
                                <option>Región de Arica y Parinacota</option>
                                <option>Región de Ñuble</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Teléfono</label>
                            <input type="text" id="empresa_telefono" placeholder="+56 2 2345 6789" />
                        </div>
                        <div class="form-group">
                            <label>Email corporativo</label>
                            <input type="email" id="empresa_email" placeholder="contacto@empresa.cl" />
                        </div>
                        <div class="form-group required">
                            <label>Fecha de vigencia del reglamento</label>
                            <input type="date" id="fecha_vigencia" />
                        </div>
                    </div>
                </div>

                <!-- PASO 2: Estructura y tipo -->
                <div class="wizard-step" id="step-2" style="display:none">
                    <div class="step-intro">
                        <span class="step-icon">👥</span>
                        <h3>Estructura Organizacional</h3>
                        <p>Define el tipo de reglamento según tus trabajadores</p>
                    </div>

                    <div class="type-selector">
                        <div class="type-card" id="type-rihs" onclick="selectType('RIHS')">
                            <div class="type-icon">📄</div>
                            <h4>RIHS</h4>
                            <p class="text-muted">Reglamento de Higiene y Seguridad</p>
                            <p><strong>Menos de 10 trabajadores</strong></p>
                            <p style="font-size:0.8rem;color:#64748b">Art. 67° Ley 16.744 · Obligatorio para todos</p>
                        </div>
                        <div class="type-card" id="type-riohs" onclick="selectType('RIOHS')">
                            <div class="type-icon">📑</div>
                            <h4>RIOHS</h4>
                            <p class="text-muted">Reglamento de Orden, Higiene y Seguridad</p>
                            <p><strong>10 o más trabajadores</strong></p>
                            <p style="font-size:0.8rem;color:#64748b">Art. 153° Código del Trabajo · Incluye normas de orden</p>
                        </div>
                    </div>

                    <div class="form-grid-2" style="margin-top:1.5rem">
                        <div class="form-group required">
                            <label>N° de Trabajadores</label>
                            <input type="number" id="num_trabajadores" min="1" placeholder="25" onchange="autoSelectType(this.value)" />
                        </div>
                        <div class="form-group required">
                            <label>Nombre Responsable SST</label>
                            <input type="text" id="responsable_sst_nombre" placeholder="María González" />
                        </div>
                        <div class="form-group">
                            <label>Cargo Responsable SST</label>
                            <input type="text" id="responsable_sst_cargo" placeholder="Prevencionista de Riesgos" />
                        </div>
                        <div class="form-group">
                            <label>Email Responsable SST</label>
                            <input type="email" id="responsable_sst_email" placeholder="sst@empresa.cl" />
                        </div>
                    </div>

                    <div class="checks-row" style="margin-top:1rem">
                        <label class="check-label">
                            <input type="checkbox" id="tiene_comite_paritario" />
                            <span>Comité Paritario de H&S <small>(requerido si ≥25 trabajadores)</small></span>
                        </label>
                        <label class="check-label">
                            <input type="checkbox" id="tiene_delegado_sst" />
                            <span>Delegado SST</span>
                        </label>
                        <label class="check-label">
                            <input type="checkbox" id="tiene_dpto_prevencion" />
                            <span>Departamento de Prevención <small>(requerido si ≥100 trabajadores)</small></span>
                        </label>
                    </div>
                </div>

                <!-- PASO 3: Jornada -->
                <div class="wizard-step" id="step-3" style="display:none">
                    <div class="step-intro">
                        <span class="step-icon">🕐</span>
                        <h3>Jornada de Trabajo</h3>
                        <p>Horarios, turnos y modalidades</p>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group required">
                            <label>Horas semanales <small>(máx. 44 hrs – Ley 21.561)</small></label>
                            <input type="number" id="jornada_horas_semanales" min="1" max="44" value="44" />
                        </div>
                        <div class="form-group required">
                            <label>Días laborales</label>
                            <select id="jornada_dias">
                                <option>Lunes a Viernes</option>
                                <option>Lunes a Sábado</option>
                                <option>Turnos rotativos</option>
                                <option>Lunes a Domingo (turnos)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Hora de inicio</label>
                            <input type="time" id="jornada_hora_inicio" value="08:00" />
                        </div>
                        <div class="form-group">
                            <label>Hora de término</label>
                            <input type="time" id="jornada_hora_fin" value="17:00" />
                        </div>
                    </div>

                    <div class="checks-row">
                        <label class="check-label">
                            <input type="checkbox" id="tiene_turnos" onchange="toggleTurnos()" />
                            <span>La empresa opera con sistema de turnos (Anexo N°1)</span>
                        </label>
                        <label class="check-label">
                            <input type="checkbox" id="tiene_teletrabajo" />
                            <span>Aplica modalidad de teletrabajo / trabajo a distancia</span>
                        </label>
                    </div>

                    <div id="turnos-section" style="display:none;margin-top:1rem">
                        <div class="form-group">
                            <label>Descripción detallada de turnos (se incluirá en Anexo N°1)</label>
                            <textarea id="descripcion_turnos" rows="4"
                                placeholder="Ej: Turno A: Lunes-Viernes 06:00-14:00&#10;Turno B: Lunes-Viernes 14:00-22:00&#10;Turno C: Lunes-Viernes 22:00-06:00"></textarea>
                        </div>
                    </div>
                </div>

                <!-- PASO 4: Remuneraciones -->
                <div class="wizard-step" id="step-4" style="display:none">
                    <div class="step-intro">
                        <span class="step-icon">💰</span>
                        <h3>Remuneraciones</h3>
                        <p>Período, método de pago y estructura de cargos</p>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-group required">
                            <label>Período de pago</label>
                            <select id="remuneracion_periodo">
                                <option value="mensual">Mensual</option>
                                <option value="quincenal">Quincenal</option>
                                <option value="semanal">Semanal</option>
                            </select>
                        </div>
                        <div class="form-group required">
                            <label>Día de pago del mes</label>
                            <input type="number" id="remuneracion_dia" min="1" max="31" value="30" />
                        </div>
                        <div class="form-group required">
                            <label>Método de pago</label>
                            <select id="remuneracion_metodo">
                                <option value="depósito bancario">Depósito bancario</option>
                                <option value="cheque">Cheque nominativo</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="transferencia electrónica">Transferencia electrónica</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Cargos y escalas de remuneración (Anexo N°2 – opcional)</label>
                        <textarea id="escalas_cargos" rows="4"
                            placeholder="Ej: Cargo: Operario General – Sueldo base: $500.000&#10;Cargo: Supervisor – Sueldo base: $900.000&#10;(Dejar en blanco si se maneja individualmente por contrato)"></textarea>
                    </div>
                </div>

                <!-- PASO 5: Riesgos -->
                <div class="wizard-step" id="step-5" style="display:none">
                    <div class="step-intro">
                        <span class="step-icon">⚠️</span>
                        <h3>Identificación de Riesgos</h3>
                        <p>MIPER – Matriz de Identificación de Peligros y Evaluación de Riesgos</p>
                    </div>

                    <div class="risk-categories">
                        <div class="risk-category">
                            <h4>🔊 Riesgos Físicos</h4>
                            <div class="tag-options" id="opts-fisicos">
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_fisicos','Ruido')">Ruido</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_fisicos','Vibraciones')">Vibraciones</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_fisicos','Temperatura extrema')">Temperatura extrema</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_fisicos','Radiación UV')">Radiación UV</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_fisicos','Iluminación deficiente')">Iluminación deficiente</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_fisicos','Electricidad')">Electricidad</span>
                            </div>
                            <input type="hidden" id="riesgos_fisicos" value="[]" />
                        </div>

                        <div class="risk-category">
                            <h4>🧪 Riesgos Químicos</h4>
                            <div class="tag-options" id="opts-quimicos">
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_quimicos','Polvo en suspensión')">Polvo en suspensión</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_quimicos','Humos metálicos')">Humos metálicos</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_quimicos','Solventes orgánicos')">Solventes orgánicos</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_quimicos','Gases tóxicos')">Gases tóxicos</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_quimicos','Sustancias corrosivas')">Sustancias corrosivas</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_quimicos','Cemento/Cal')">Cemento/Cal</span>
                            </div>
                            <input type="hidden" id="riesgos_quimicos" value="[]" />
                        </div>

                        <div class="risk-category">
                            <h4>🦠 Riesgos Biológicos</h4>
                            <div class="tag-options" id="opts-biologicos">
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_biologicos','Contacto con aguas servidas')">Aguas servidas</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_biologicos','Exposición a animales')">Exposición a animales</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_biologicos','Virus respiratorios')">Virus respiratorios</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_biologicos','Hanta virus')">Hanta virus</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_biologicos','Hepatitis B')">Hepatitis B</span>
                            </div>
                            <input type="hidden" id="riesgos_biologicos" value="[]" />
                        </div>

                        <div class="risk-category">
                            <h4>🦴 Riesgos Ergonómicos</h4>
                            <div class="tag-options" id="opts-ergonomicos">
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_ergonomicos','Manejo manual de cargas')">Manejo manual de cargas</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_ergonomicos','Posturas forzadas')">Posturas forzadas</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_ergonomicos','Movimientos repetitivos')">Movimientos repetitivos</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_ergonomicos','Trabajo en pantallas')">Trabajo en pantallas</span>
                            </div>
                            <input type="hidden" id="riesgos_ergonomicos" value="[]" />
                        </div>

                        <div class="risk-category">
                            <h4>🧠 Riesgos Psicosociales</h4>
                            <div class="tag-options" id="opts-psicosociales">
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_psicosociales','Estrés laboral')">Estrés laboral</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_psicosociales','Trabajo nocturno')">Trabajo nocturno</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_psicosociales','Carga mental alta')">Carga mental alta</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_psicosociales','Atención al público')">Atención al público</span>
                                <span class="risk-tag" onclick="toggleTag(this,'riesgos_psicosociales','Trabajo aislado')">Trabajo aislado</span>
                            </div>
                            <input type="hidden" id="riesgos_psicosociales" value="[]" />
                        </div>
                    </div>
                </div>

                <!-- PASO 6: EPP y actividades -->
                <div class="wizard-step" id="step-6" style="display:none">
                    <div class="step-intro">
                        <span class="step-icon">🦺</span>
                        <h3>EPP y Actividades Especiales</h3>
                        <p>Elementos de Protección Personal y riesgos específicos</p>
                    </div>

                    <h4 style="margin-bottom:0.5rem">Elementos de Protección Personal obligatorios</h4>
                    <div class="tag-options" id="opts-epp">
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Casco de seguridad')">🪖 Casco</span>
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Zapatos de seguridad')">👟 Zapatos de seguridad</span>
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Guantes de trabajo')">🧤 Guantes</span>
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Lentes de seguridad')">🥽 Lentes</span>
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Chaleco reflectante')">🦺 Chaleco reflectante</span>
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Protector auditivo')">🎧 Protector auditivo</span>
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Mascarilla respiratoria')">😷 Mascarilla</span>
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Arnés de seguridad')">🔗 Arnés</span>
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Ropa de trabajo')">👔 Ropa de trabajo</span>
                        <span class="risk-tag" onclick="toggleTag(this,'epp_requeridos','Protector solar factor 30+')">☀️ Protector solar</span>
                    </div>
                    <input type="hidden" id="epp_requeridos" value="[]" />

                    <h4 style="margin:1.5rem 0 0.5rem">Vacunas requeridas según exposición</h4>
                    <div class="tag-options" id="opts-vacunas">
                        <span class="risk-tag" onclick="toggleTag(this,'vacunas_requeridas','Hepatitis B')">Hepatitis B</span>
                        <span class="risk-tag" onclick="toggleTag(this,'vacunas_requeridas','Tétanos')">Tétanos</span>
                        <span class="risk-tag" onclick="toggleTag(this,'vacunas_requeridas','Rabia (post-exposición)')">Rabia</span>
                        <span class="risk-tag" onclick="toggleTag(this,'vacunas_requeridas','Influenza (anual)')">Influenza</span>
                        <span class="risk-tag" onclick="toggleTag(this,'vacunas_requeridas','COVID-19')">COVID-19</span>
                    </div>
                    <input type="hidden" id="vacunas_requeridas" value="[]" />

                    <h4 style="margin:1.5rem 0 0.5rem">Actividades de alto riesgo en la empresa</h4>
                    <div class="checks-grid">
                        <label class="check-label"><input type="checkbox" id="trabaja_alturas" /> <span>Trabajos en altura física (≥1.8m)</span></label>
                        <label class="check-label"><input type="checkbox" id="trabaja_electricidad" /> <span>Trabajos eléctricos</span></label>
                        <label class="check-label"><input type="checkbox" id="trabaja_quimicos" /> <span>Manejo de sustancias peligrosas</span></label>
                        <label class="check-label"><input type="checkbox" id="trabaja_maquinaria" /> <span>Operación de maquinaria pesada</span></label>
                        <label class="check-label"><input type="checkbox" id="trabaja_espacios_confinados" /> <span>Espacios confinados</span></label>
                        <label class="check-label"><input type="checkbox" id="trabaja_con_publico" /> <span>Atención directa al público</span></label>
                    </div>
                </div>

                <!-- PASO 7: Sanciones y reclamos -->
                <div class="wizard-step" id="step-7" style="display:none">
                    <div class="step-intro">
                        <span class="step-icon">⚖️</span>
                        <h3>Sanciones y Canal de Reclamos</h3>
                        <p>Escala de multas y procedimientos internos</p>
                    </div>
                    <div class="info-box">
                        <strong>Marco legal:</strong> Las multas no pueden exceder el 25% de la remuneración diaria (Art. 67° Ley 16.744 y Art. 154 N°10 Código del Trabajo). Los fondos van al SERNAC o a capacitación.
                    </div>
                    <div class="form-grid-2" style="margin-top:1rem">
                        <div class="form-group">
                            <label>Multa mínima (% remuneración diaria)</label>
                            <input type="number" id="multa_min_pct" min="1" max="25" value="1" />
                        </div>
                        <div class="form-group">
                            <label>Multa máxima (% remuneración diaria)</label>
                            <input type="number" id="multa_max_pct" min="1" max="25" value="25" />
                        </div>
                        <div class="form-group required">
                            <label>Email canal de denuncias y reclamos</label>
                            <input type="email" id="reclamos_email" placeholder="reclamos@empresa.cl" />
                        </div>
                        <div class="form-group">
                            <label>Plazo de respuesta a reclamos (días hábiles)</label>
                            <input type="number" id="reclamos_plazo" min="1" max="30" value="10" />
                        </div>
                    </div>
                </div>

                <!-- PASO 8: Revisión y generación -->
                <div class="wizard-step" id="step-8" style="display:none">
                    <div class="step-intro">
                        <span class="step-icon">✅</span>
                        <h3>Revisión Final y Generación</h3>
                        <p>Confirma los datos antes de generar el reglamento</p>
                    </div>
                    <div id="review-summary" class="review-card"></div>

                    <div class="info-box" style="margin-top:1rem;background:#0f4c2a22;border-color:#10b981">
                        <strong>📋 ¿Qué se genera?</strong> Un documento Word (.docx) con todos los títulos, capítulos y artículos del RIOHS/RIHS, personalizado con tus datos, listo para entregar a los trabajadores y presentar ante la autoridad.
                    </div>
                    <p id="save-error" style="color:#ef4444;display:none"></p>
                </div>

            </div><!-- end wizard-steps -->

            <!-- Navegación wizard -->
            <div class="wizard-nav">
                <button id="btn-prev" class="btn btn-ghost" onclick="prevStep()" style="display:none">← Anterior</button>
                <div style="display:flex;gap:0.5rem;align-items:center">
                    <span id="step-label" style="color:#64748b;font-size:0.85rem"></span>
                </div>
                <div style="display:flex;gap:0.75rem">
                    <button id="btn-save-draft" class="btn btn-ghost" onclick="saveDraft()">Guardar borrador</button>
                    <button id="btn-next" class="btn btn-primary" onclick="nextStep()">Continuar →</button>
                    <button id="btn-generate" class="btn btn-success" onclick="generateDoc()" style="display:none">📄 Generar DOCX</button>
                </div>
            </div>

        </div><!-- end wizard-container -->
    </div><!-- end wizard-overlay -->

    <!-- VISTA DETALLE (descarga) -->
    <div id="view-detail" style="display:none">
        <button class="btn btn-ghost" onclick="showList()" style="margin-bottom:1rem">← Volver a lista</button>
        <div id="detail-content"></div>
    </div>
    """
    return base_layout("Reglamento Interno RIOHS", "riohs", content, scripts=["riohs.js"])
