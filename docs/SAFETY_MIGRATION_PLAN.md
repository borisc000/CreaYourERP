# Plan de Migración: Módulo Safety

> **Origen:** `YOUR_ERP_CORE/modules/safety` (Python/ORM propio)  
> **Destino:** Firebase (Firestore + Cloud Functions + React)  
> **Análisis basado en:** `module_safety.py` (8,193 líneas), `miper_engine.py` (662 líneas), `risk_calculation_service.py` (317 líneas)

---

## Modelos y Campos

### 1. SafetyServiceProfile
Perfil de servicio preventivo que define documentos, EPP, checklists y charlas obligatorias por tipo de servicio.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `name` | string | Sí | Nombre del perfil (ej: "Andamios", "Trabajo en Altura") |
| `service_type_id` | integer | No | Vinculación a tipo de servicio CRM |
| `risk_level` | string | No | `low`, `medium`, `high`, `critical` |
| `mandatory_documents` | JSON[] | No | Blueprints de documentos obligatorios |
| `mandatory_ppe` | string[] | No | Lista de EPP obligatorio |
| `mandatory_checklists` | string[] | No | Checklists obligatorios |
| `recommended_talks` | string[] | No | Charlas recomendadas |
| `active` | boolean | No | Activo/inactivo |
| `company_id` | integer | Sí | Tenant |

---

### 2. SafetyFolder
Carpeta de seguridad vinculada a una oportunidad/lead. Es el eje central del módulo.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `lead_id` | integer | Sí | Oportunidad CRM |
| `service_profile_id` | integer | No | Perfil de servicio aplicado |
| `procedure_id` | integer | No | Procedimiento principal (legacy) |
| `client_site_id` | integer | No | Instalación del cliente |
| `client_area_id` | integer | No | Área del cliente (legacy) |
| `procedure_ids` | integer[] | No | Procedimientos vinculados |
| `job_profile_ids` | integer[] | No | Perfiles de cargo |
| `client_area_ids` | integer[] | No | Áreas del cliente |
| `equipment_block_ids` | integer[] | No | Equipos/herramientas |
| `status` | string | No | `draft`, `ready`, `in_progress`, `closed` |
| `readiness_pct` | float | No | Porcentaje de alistamiento 0-100 |
| `traffic_light` | string | No | `red`, `yellow`, `green` |
| `planned_start_date` | string | No | Fecha de arranque planificada |
| `assigned_employee_ids` | integer[] | No | Personal asignado |
| `notes` | text | No | Notas generales |
| `miper_scope_notes` | text | No | Notas de alcance MIPER |
| `approver_user_id` | integer | No | Usuario que aprobó |
| `approved_at` | datetime | No | Fecha de aprobación |
| `company_id` | integer | Sí | Tenant |

---

### 3. SafetyFolderDocument
Documentos generados o adjuntos a una carpeta de seguridad.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `folder_id` | integer | Sí | Carpeta padre |
| `code` | string | Sí | Código único dentro de la carpeta |
| `title` | string | Sí | Título del documento |
| `document_type` | string | No | `procedure`, `diffusion`, `startup`, `record`, `other` |
| `status` | string | No | `draft`, `pending_review`, `approved`, `obsolete`, `expired` |
| `version` | integer | No | Versión |
| `is_critical` | boolean | No | Si es crítico para el readiness |
| `owner_user_id` | integer | No | Responsable |
| `due_date` | string | No | Fecha límite |
| `content` | text | No | Contenido/plantilla |
| `company_id` | integer | Sí | Tenant |

---

### 4. SafetyRiskMatrix
Matriz MIPER/IPER generada para una carpeta o de forma independiente.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `folder_id` | integer | No | Carpeta asociada |
| `code` | string | No | Código auto-generado (ej: `MIPER-YYYYMMDD`) |
| `title` | string | Sí | Título descriptivo |
| `status` | string | No | `draft`, `pending_review`, `approved`, `archived` |
| `version` | integer | No | Versión |
| `rows` | JSON[] | No | Filas de la matriz (denormalizado) |
| `generation_summary` | JSON | No | Metadata de generación automática |
| `reviewed_by` | integer | No | Revisor |
| `reviewed_at` | datetime | No | Fecha de revisión |
| `source_type` | string | No | `manual`, `procedure`, `process`, `template`, `blocks` |
| `source_id` | integer | No | ID de la fuente |
| `process_name` | string | No | Nombre del proceso/servicio |
| `work_center` | string | No | Centro de trabajo/faena |
| `elaboration_date` | string | No | Fecha de elaboración |
| `last_update_date` | string | No | Última actualización |
| `review_due_date` | string | No | Fecha de próxima revisión |
| `methodology_config_id` | integer | No | Configuración de metodología |
| `project_id` | integer | No | Proyecto asociado |
| `company_id` | integer | Sí | Tenant |

---

### 5. SafetyRiskMatrixRow
Fila individual de una matriz de riesgo. En Firebase se recomienda subcolección de `safetyRiskMatrices`.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `risk_matrix_id` | integer | Sí | Matriz padre |
| `source_block_id` | integer | No | Bloque de origen |
| `source_procedure_step_id` | integer | No | Paso de procedimiento origen |
| `activity_name` | string | No | Actividad |
| `task_name` | string | No | Tarea |
| `job_position` | string | No | Cargo |
| `specific_workplace` | string | No | Lugar específico |
| `worker_count` | integer | No | Cantidad de trabajadores |
| `routine_type` | string | No | Tipo de rutina |
| `hazard_name` | text | No | Peligro/factor |
| `risk_name` | text | No | Riesgo |
| `probable_damage` | text | No | Daño probable |
| `probability_value` | integer | No | Probabilidad (1, 2, 4) |
| `consequence_value` | integer | No | Consecuencia (1, 2, 4) |
| `risk_value` | integer | No | Valor de riesgo (VEP legacy) |
| `risk_level_label` | string | No | Etiqueta de nivel |
| `task_type_code` | string | No | `R`, `NR`, `E` |
| `exposed_people_value` | integer | No | PE (1-3) |
| `exposure_frequency_value` | integer | No | FE (1-3) |
| `occurrence_factor_value` | integer | No | FO (1-3) |
| `probability_score` | integer | No | P = PE+FE+FO |
| `severity_value` | integer | No | Severidad (1-4) |
| `residual_risk_value` | integer | No | VR = P x S |
| `residual_risk_label` | string | No | Clasificación residual |
| `current_engineering_controls` | text | No | Controles de ingeniería actuales |
| `current_admin_controls` | text | No | Controles administrativos actuales |
| `current_ppe_controls` | text | No | EPP actual |
| `proposed_elimination_controls` | string[] | No | Eliminación propuesta |
| `proposed_substitution_controls` | string[] | No | Sustitución propuesta |
| `proposed_engineering_controls` | string[] | No | Ingeniería propuesta |
| `proposed_admin_controls` | string[] | No | Administrativos propuestos |
| `proposed_ppe_controls` | string[] | No | EPP propuesto |
| `safety_management_plan` | text | No | Plan S&SO |
| `existing_controls` | text | No | Controles existentes |
| `required_controls` | JSON | No | Jerarquía de controles normalizada |
| `ppe_summary` | string[] | No | Resumen EPP |
| `protocols_summary` | string[] | No | Resumen protocolos |
| `legal_reference` | text | No | Referencia legal |
| `responsible` | string | No | Responsable |
| `observations` | text | No | Observaciones |
| `sequence` | integer | No | Orden |
| `origin_blocks` | string[] | No | Bloques de origen |
| `source_labels` | string[] | No | Etiquetas de fuente |
| `source_group` | string | No | Grupo de fuente |
| `source_title` | string | No | Título de fuente |
| `source_ref_id` | integer | No | Referencia de fuente |
| `severity_color` | string | No | Color del nivel |
| `approval_blocked` | boolean | No | Bloquea aprobación |
| `mitigation_required` | boolean | No | Requiere mitigación |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

### 6. SafetyRiskMethodology
Configuración de metodología de evaluación de riesgo.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `name` | string | Sí | Nombre de la metodología |
| `probability_schema_json` | JSON[] | No | Esquema de probabilidad |
| `consequence_schema_json` | JSON[] | No | Esquema de consecuencia |
| `risk_matrix_schema_json` | JSON[] | No | Esquema de matriz (rangos, colores, acciones) |
| `default_flag` | boolean | No | Es la metodología por defecto |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

### 7. SafetyPPEDelivery
Registro de entrega de EPP a trabajadores.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `folder_id` | integer | Sí | Carpeta |
| `employee_id` | integer | Sí | Trabajador |
| `delivery_date` | string | Sí | Fecha de entrega |
| `status` | string | No | `draft`, `delivered`, `replenishment` |
| `items` | string[] | No | Ítems entregados |
| `notes` | text | No | Notas |
| `company_id` | integer | Sí | Tenant |

---

### 8. SafetyTalk
Registro de charlas de seguridad.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `folder_id` | integer | Sí | Carpeta |
| `talk_date` | string | Sí | Fecha de la charla |
| `topic` | string | Sí | Tema |
| `speaker_user_id` | integer | No | Relator |
| `attendee_ids` | integer[] | No | Asistentes |
| `notes` | text | No | Notas |
| `company_id` | integer | Sí | Tenant |

---

### 9. SafetyChecklistRun
Ejecución de checklist de seguridad.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `folder_id` | integer | Sí | Carpeta |
| `checklist_name` | string | Sí | Nombre del checklist |
| `checklist_type` | string | No | Tipo |
| `executed_at` | string | Sí | Fecha de ejecución |
| `executed_by` | integer | No | Ejecutor |
| `result` | string | No | `pending`, `ok`, `critical` |
| `items` | string[] | No | Ítems verificados |
| `findings` | text | No | Hallazgos |
| `requires_action` | boolean | No | Requiere acción |
| `company_id` | integer | Sí | Tenant |

---

### 10. SafetyIRLRecord
Registro de Información de Riesgos Laborales (IRL).

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `folder_id` | integer | Sí | Carpeta |
| `employee_id` | integer | No | Trabajador |
| `title` | string | Sí | Título del IRL |
| `status` | string | No | `draft`, `issued`, `acknowledged` |
| `version` | integer | No | Versión |
| `worker_name` | string | No | Nombre del trabajador |
| `worker_identifier` | string | No | RUT/ID |
| `position_title` | string | No | Cargo |
| `place_name` | string | No | Lugar |
| `activity_name` | string | No | Actividad |
| `activity_period` | string | No | Período |
| `modality` | string | No | `Presencial` (default) |
| `duration_hours` | string | No | Duración (`08:00`) |
| `executor_name` | string | No | Ejecutor |
| `relator_background` | string | No | Formación del relator |
| `target_group` | text | No | Grupo objetivo |
| `workspace_features` | text | No | Características del lugar |
| `environmental_conditions` | text | No | Condiciones ambientales |
| `order_cleanliness` | text | No | Orden y aseo |
| `machines_tools` | text | No | Máquinas y herramientas |
| `service_functions` | string[] | No | Funciones del servicio |
| `risk_items` | JSON[] | No | Riesgos + medidas + métodos |
| `complement_materials` | JSON[] | No | Materiales complementarios |
| `observations` | text | No | Observaciones |
| `intro_text` | text | No | Texto introductorio |
| `theme_color` | string | No | Color del tema (`#0F4C81`) |
| `company_id` | integer | Sí | Tenant |

---

### 11. SafetyMasterRisk
Catálogo maestro de riesgos basado en ISP (Inspección de Seguridad Preventiva).

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `isp_code` | string | Sí | Código ISP (ej: `A3`, `P1`) |
| `family` | string | Sí | Familia (`SEGURIDAD`, `HIGIENICO`, `BIOLOGICO`, `MUSCULOESQUELETICO`, `PSICOSOCIAL`, `OTROS`) |
| `risk_name` | string | Sí | Nombre del riesgo |
| `official_definition` | text | No | Definición oficial |
| `protocol_codes` | string[] | No | Protocolos asociados |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

### 12. SafetyProtocol
Catálogo de protocolos MINSAL.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `code` | string | Sí | Código (ej: `PREXOR`, `TMERT`) |
| `name` | string | Sí | Nombre del protocolo |
| `authority` | string | No | Autoridad (`MINSAL`) |
| `description` | text | No | Descripción |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

### 13. SafetyPPEItem
Catálogo de elementos de protección personal.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `code` | string | Sí | Código (ej: `CASCO`, `ARNES`) |
| `name` | string | Sí | Nombre |
| `category` | string | No | Categoría (`cabeza`, `alturas`, `manos`, etc.) |
| `description` | text | No | Descripción |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

### 14. SafetyEquipmentBlock
Bloques de equipo/herramienta con riesgos y controles asociados.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `code` | string | Sí | Código único |
| `name` | string | Sí | Nombre |
| `description` | text | No | Descripción |
| `master_risk_ids` | integer[] | No | Riesgos maestros vinculados |
| `control_hierarchy` | JSON | No | Jerarquía de controles |
| `controls_summary` | text | No | Resumen de controles |
| `required_ppe` | string[] | No | EPP requerido |
| `protocol_codes` | string[] | No | Protocolos |
| `sensitivity_tags` | string[] | No | Etiquetas de sensibilidad |
| `legal_reference` | string | No | Referencia legal |
| `source_note` | text | No | Nota de origen |
| `probability` | integer | No | Probabilidad base (1, 2, 4) |
| `consequence` | integer | No | Consecuencia base (1, 2, 4) |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

### 15. SafetyClientSite
Instalaciones/faenas del cliente.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `customer_id` | integer | Sí | Cliente CRM |
| `name` | string | Sí | Nombre del sitio |
| `address` | text | No | Dirección |
| `comuna` | string | No | Comuna |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

### 16. SafetyClientArea
Áreas dentro de una instalación del cliente.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `site_id` | integer | Sí | Sitio padre |
| `parent_area_id` | integer | No | Área padre (jerarquía) |
| `name` | string | Sí | Nombre del área |
| `risk_notes` | text | No | Notas de riesgo |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

### 17. SafetyWorkerRestriction
Restricciones médicas o sensibilidades de trabajadores.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `employee_id` | integer | Sí | Trabajador |
| `title` | string | Sí | Título de la restricción |
| `restriction_type` | string | No | Tipo de restricción |
| `applies_to_tags` | string[] | No | Etiquetas a las que aplica |
| `severity` | string | No | `info`, `warning`, `blocking` |
| `details` | text | No | Detalles |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

### 18. SafetyGeneratorRule
Reglas para generación automática de filas de matriz.

| Campo | Tipo | Required | Descripción |
|-------|------|----------|-------------|
| `name` | string | Sí | Nombre de la regla |
| `scope_type` | string | Sí | `transversal`, `service_profile`, `customer`, `client_site`, `client_area` |
| `scope_ref_id` | integer | No | ID del scope (según tipo) |
| `process_name` | string | No | Proceso |
| `task_name` | string | No | Tarea |
| `position_name` | string | No | Cargo |
| `hazard_factor` | string | Sí | Factor de peligro |
| `master_risk_id` | integer | Sí | Riesgo maestro |
| `probability` | integer | No | Probabilidad (1, 2, 4) |
| `consequence` | integer | No | Consecuencia (1, 2, 4) |
| `controls_summary` | text | No | Resumen de controles |
| `control_hierarchy` | JSON | No | Jerarquía de controles |
| `required_ppe` | string[] | No | EPP |
| `protocol_codes` | string[] | No | Protocolos |
| `sensitivity_tags` | string[] | No | Etiquetas |
| `owner_name` | string | No | Responsable |
| `legal_reference` | string | No | Referencia legal |
| `source_note` | text | No | Nota |
| `trigger_config` | JSON | No | Configuración de disparadores (tags, procesos, criticidad) |
| `suggested_controls` | JSON | No | Controles sugeridos |
| `suggested_ppe` | string[] | No | EPP sugerido |
| `suggested_protocols` | string[] | No | Protocolos sugeridos |
| `required_fields` | string[] | No | Campos requeridos adicionales |
| `approval_policy` | JSON | No | Política de aprobación |
| `active` | boolean | No | Activo |
| `company_id` | integer | Sí | Tenant |

---

## Funciones Críticas

1. **`seed_default_profiles` / `seed_default_miper_catalog` / `seed_default_ppe_catalog` / `seed_default_risk_methodology`**  
   Inicializa catálogos base (riesgos ISP, protocolos MINSAL, EPP, perfiles de servicio, metodologías y reglas generadoras) cuando una empresa accede por primera vez al módulo.

2. **`_generate_matrix_for_folder`**  
   Función más compleja del módulo. Genera/actualiza la matriz MIPER de una carpeta integrando múltiples fuentes: procedimientos (`safety_procedures`), reglas generadoras (`generator_rules`), equipos/herramientas (`equipment_blocks`), perfiles de cargo (`job_profiles`), áreas/sectores del cliente (`reports` module) y filas fallback. Realiza merge por fingerprint, calcula VEP y MIPER compacto, ordena por prioridad y persiste filas individuales.

3. **`_generate_documents_for_folder`**  
   Genera documentos base de la carpeta a partir del perfil de servicio y procedimientos vinculados (procedimientos, difusiones, carpetas de arranque, registros).

4. **`_build_summary` / `_refresh_folder_metrics`**  
   Calcula el porcentaje de readiness (0-100%) y el semáforo (`red/yellow/green`) basado en: fecha de arranque, personal asignado, documentos críticos aprobados, matriz aprobada sin riesgos intolerables, EPP entregado y checklists conformes. Identifica bloqueadores críticos.

5. **`_build_irl_draft_payload` / `generate_irl_record`**  
   Genera un borrador de IRL (Información de Riesgos Laborales) a partir de la matriz MIPER de la carpeta, filtrando riesgos relevantes por cargo/lugar y armando ítems de riesgo con medidas preventivas y métodos de trabajo.

6. **`_build_miper_excel` / `_build_miper_pdf` / `_build_miper_pdf_compact`**  
   Exporta la matriz MIPER a Excel (formato extenso con portada, hojas de criterios, catálogo de peligros, control de cambios) o PDF (formato compacto A3 landscape con encabezado corporativo, glosa de evaluación y tabla consolidada).

7. **`_build_irl_pdf`**  
   Exporta un IRL a PDF en formato A4 con secciones: información de actividad, características del lugar, riesgos con medidas preventivas, funciones del servicio, y firma del participante.

8. **`bot_assistant_suggestions` / `_score_bot_rule`**  
   Asistente BOT que recibe contexto de un bloque de actividad (texto, tags, criticidad, recursos) y sugiere reglas preventivas aplicables con scoring basado en coincidencias de tags, procesos, criticidad y tipos de recurso.

9. **`_restriction_alerts_for_row`**  
   Valida restricciones médicas de los trabajadores asignados contra las etiquetas de sensibilidad de cada fila de riesgo, generando alertas que pueden bloquear la aprobación.

10. **`_shared_place_risk_rows_for_folder`**  
    Integra riesgos declarados en áreas y sectores del cliente desde el módulo `reports` (Áreas y Sectores de Faena) como filas adicionales en la matriz MIPER.

11. **`calculate_risk` / `calculate_compact_miper` / `calculate_vep`**  
    Servicios puros de cálculo: VEP = Probabilidad × Consecuencia (metodología legacy 1-2-4) y MIPER compacta: VR = (PE + FE + FO) × S con clasificación residual.

---

## Endpoints/API Expuestos

### Lookups y Catálogos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/safety/lookups` | Carga masiva de lookups (leads, empleados, clientes, perfiles, procedimientos, áreas, riesgos, protocolos, EPP, equipos, metodologías) |
| GET | `/safety/master-risks` | Listar riesgos maestros ISP |
| GET/POST | `/safety/ppe-catalog` | CRUD catálogo EPP |
| PUT/DELETE | `/safety/ppe-catalog/{id}` | CRUD catálogo EPP |
| GET/POST | `/safety/equipment-blocks` | CRUD bloques de equipo |
| PUT/DELETE | `/safety/equipment-blocks/{id}` | CRUD bloques de equipo |
| GET/POST | `/safety/generator-rules` | CRUD reglas generadoras |
| PUT/DELETE | `/safety/generator-rules/{id}` | CRUD reglas generadoras |
| GET/POST | `/safety/client-sites` | CRUD sitios del cliente |
| PUT/DELETE | `/safety/client-sites/{id}` | CRUD sitios del cliente |
| GET/POST | `/safety/client-areas` | CRUD áreas del cliente |
| PUT/DELETE | `/safety/client-areas/{id}` | CRUD áreas del cliente |
| GET/POST | `/safety/worker-restrictions` | CRUD restricciones de trabajadores |
| GET/POST | `/safety/service-profiles` | CRUD perfiles de servicio |
| PUT/DELETE | `/safety/service-profiles/{id}` | CRUD perfiles de servicio |

### Matrices de Riesgo
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/POST | `/safety/risk-matrices` | Listar / Crear matrices |
| POST | `/safety/risk-matrices/generate` | Generar matriz canónica desde procedimiento o bloques |
| GET/PUT | `/safety/risk-matrices/{id}` | Obtener / Actualizar matriz |
| GET | `/safety/risk-matrices/{id}/export/miper.xlsx` | Exportar Excel |
| GET | `/safety/risk-matrices/{id}/export/miper.pdf` | Exportar PDF |
| POST | `/safety/risk-matrices/{id}/rows` | Crear fila de matriz |
| PUT | `/safety/risk-matrices/{id}/rows/{row_id}` | Actualizar fila de matriz |

### Carpetas de Seguridad
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/POST | `/safety/folders` | Listar / Crear carpetas |
| GET | `/safety/folders/{id}` | Obtener carpeta con summary |
| PUT/DELETE | `/safety/folders/{id}` | Actualizar / Eliminar carpeta |
| GET | `/safety/folders/{id}/dossier` | Dossier completo (carpeta + documentos + matriz + IRL + EPP + charlas + checklists + lookups) |
| POST | `/safety/folders/{id}/generate-documents` | Regenerar documentos base |
| POST | `/safety/folders/{id}/generate-matrix` | Regenerar matriz MIPER |
| GET | `/safety/folders/{id}/export/miper.xlsx` | Exportar Excel desde carpeta |
| GET | `/safety/folders/{id}/export/miper.pdf` | Exportar PDF desde carpeta |
| GET/POST | `/safety/folders/{id}/documents` | CRUD documentos de carpeta |
| PUT/DELETE | `/safety/documents/{id}` | CRUD documentos de carpeta |
| GET/POST | `/safety/folders/{id}/irl-records` | Listar / Crear IRL |
| POST | `/safety/folders/{id}/irl-records/generate` | Generar IRL automáticamente |
| PUT/DELETE | `/safety/irl-records/{id}` | Actualizar / Eliminar IRL |
| GET | `/safety/irl-records/{id}/export/pdf` | Exportar IRL a PDF |
| GET/POST | `/safety/folders/{id}/ppe-deliveries` | CRUD entregas EPP |
| PUT/DELETE | `/safety/ppe-deliveries/{id}` | CRUD entregas EPP |
| GET/POST | `/safety/folders/{id}/talks` | CRUD charlas |
| PUT/DELETE | `/safety/talks/{id}` | CRUD charlas |
| GET/POST | `/safety/folders/{id}/checklists` | CRUD checklists |
| PUT/DELETE | `/safety/checklists/{id}` | CRUD checklists |
| PUT | `/safety/folders/{id}/risk-matrix` | Upsert matriz de riesgo desde carpeta |

### Asistente BOT
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/safety/bot-assistant/suggestions` | Sugerencias preventivas basadas en contexto de bloque de actividad |

---

## Relaciones entre Modelos

```
SafetyFolder
├── lead → Lead (CRM)
├── service_profile → SafetyServiceProfile
├── procedure(s) → SafetyProcedureTemplate (safety_procedures)
├── client_site → SafetyClientSite
├── client_area(s) → SafetyClientArea
├── job_profile(s) → JobProfile (job_profiles)
├── equipment_block(s) → SafetyEquipmentBlock
│   └── master_risk(s) → SafetyMasterRisk
├── documents → SafetyFolderDocument[]
├── risk_matrix → SafetyRiskMatrix
│   └── rows → SafetyRiskMatrixRow[]
│       └── master_risk → SafetyMasterRisk
├── ppe_deliveries → SafetyPPEDelivery[]
│   └── employee → EmployeeProfile (HR)
├── talks → SafetyTalk[]
├── checklists → SafetyChecklistRun[]
└── irl_records → SafetyIRLRecord[]
    └── employee → EmployeeProfile (HR)

SafetyGeneratorRule
└── master_risk → SafetyMasterRisk

SafetyClientArea
└── site → SafetyClientSite
    └── customer → Customer (CRM)

SafetyWorkerRestriction
└── employee → EmployeeProfile (HR)
```

---

## Plan de Migración

### Fase 1 — Core (Mínimo Viable)

**Objetivo:** Que un usuario pueda crear una carpeta de seguridad, generar una matriz MIPER básica, y ver el semáforo de readiness.

#### Modelos a migrar
- `safetyMasterRisks` — Catálogo ISP (seed por defecto)
- `safetyProtocols` — Protocolos MINSAL (seed por defecto)
- `safetyPPEItems` — Catálogo EPP (seed por defecto)
- `safetyRiskMethodologies` — Metodología MIPER/IPER 1-2-4 (seed por defecto)
- `safetyServiceProfiles` — Perfiles de servicio (seed por defecto)
- `safetyFolders` — Carpeta central
- `safetyFolderDocuments` — Documentos de carpeta
- `safetyRiskMatrices` — Matriz de riesgo
- `safetyRiskMatrixRows` → **subcolección** de `safetyRiskMatrices` (firestore)

#### Cloud Functions necesarias
1. `seedSafetyCatalogs` — Callable. Inicializa riesgos maestros, protocolos, EPP, metodología, perfiles y reglas generadoras transversales por `companyId`.
2. `createSafetyFolder` — HTTP/Callable. Crea carpeta, valida lead, asigna perfil/procedimiento por defecto, genera documentos base y matriz inicial.
3. `generateRiskMatrix` — Callable. Recalcula la matriz MIPER desde fuentes disponibles (reglas transversales + fallback), persiste filas y actualiza `generationSummary`.
4. `refreshFolderMetrics` — Trigger o Callable. Calcula `readinessPct` y `trafficLight` a partir de documentos, matriz, EPP y checklists.
5. `getSafetyLookups` — Callable. Devuelve todos los lookups en un solo payload (leads, empleados, clientes, perfiles, procedimientos, áreas, riesgos, protocolos, EPP, equipos, metodologías).
6. `updateSafetyFolder` — Callable. Actualiza campos de la carpeta con regeneración condicional de matriz/documentos.
7. `exportMatrixExcel` / `exportMatrixPDF` — Callable/HTTP. Genera archivos y devuelve signed URL de Cloud Storage.

#### Componentes React necesarios
- `SafetyFolderList` — Lista de carpetas con filtros (search, traffic_light, status)
- `SafetyFolderForm` — Crear/editar carpeta (selección de lead, perfil, sitio, áreas, personal)
- `SafetyFolderDetail` / `DossierView` — Vista del dossier con tabs: Documentos, Matriz, Resumen
- `RiskMatrixEditor` — Tabla editable de filas MIPER con cálculo inline de VEP/residual
- `DocumentList` — Listado de documentos de carpeta con estados y criticidad
- `SafetyLookupsProvider` — Contexto que carga lookups al ingresar al módulo

---

### Fase 2 — Operacional

**Objetivo:** Operar la carpeta completamente: registros de EPP, charlas, checklists, IRL, sitios/áreas y equipos.

#### Modelos a migrar
- `safetyClientSites` — Sitios del cliente
- `safetyClientAreas` — Áreas del cliente
- `safetyEquipmentBlocks` — Equipos/herramientas con riesgos
- `safetyPPEDeliveries` — Entregas de EPP
- `safetyTalks` — Charlas de seguridad
- `safetyChecklistRuns` — Checklists ejecutados
- `safetyIRLRecords` — Registros IRL

#### Cloud Functions necesarias
1. CRUD completo para sitios, áreas, equipos (admin-only).
2. `createPPEDelivery` / `updatePPEDelivery` — Registra entrega, valida empleado asignado, opcionalmente genera documentos vía integración con `document_center`.
3. `createSafetyTalk` / `updateSafetyTalk` — Registra charla con asistentes validados.
4. `createChecklistRun` — Registra ejecución de checklist.
5. `generateIRL` — Genera borrador de IRL desde matriz MIPER + empleado/cargo.
6. `updateIRL` / `exportIRLPDF` — Actualización y exportación a PDF.
7. `generateFolderDocuments` — Regenera documentos base cuando cambia el perfil o procedimientos.

#### Componentes React necesarios
- `ClientSiteManager` / `ClientAreaManager` — ABM de sitios y áreas
- `EquipmentBlockManager` — ABM de equipos con jerarquía de controles
- `PPEDeliveryForm` — Formulario de entrega de EPP con selección de empleado e ítems
- `SafetyTalkForm` — Registro de charla con asistentes
- `ChecklistRunForm` — Ejecución de checklist desde librería
- `IRLGenerator` — Generación y edición de IRL con vista previa
- `IRLPDFViewer` — Descarga/visualización de IRL en PDF

---

### Fase 3 — Avanzado

**Objetivo:** Generación automática inteligente, integraciones con otros módulos, asistente BOT y exportaciones complejas.

#### Modelos a migrar
- `safetyGeneratorRules` — Reglas generadoras con `triggerConfig` y `approvalPolicy`
- `safetyWorkerRestrictions` — Restricciones médicas de trabajadores

#### Cloud Functions necesarias
1. **Motor MIPER completo (`generateRiskMatrixAdvanced`)**  
   Integra múltiples fuentes en orden de prioridad:
   - Procedimientos (`safety_procedures` / `build_procedure_matrix_payload`)
   - Reglas generadoras (`generator_rules`) filtradas por `scope_type` y `scope_ref_id`
   - Áreas/sectores del cliente (`reports` module: `AreaFaena`, `SectorFaena`, `AreaRiskAssignment`, `SectorRiskAssignment`)
   - Equipos/herramientas (`equipment_blocks`) — match por código/nombre o selección explícita
   - Perfiles de cargo (`job_profiles` / `build_job_profile_matrix_rows`)
   - Fallback a filas por defecto del perfil de servicio
   - Merge por `rowFingerprint`, deduplicación preservando orden
   - Cálculo de MIPER compacto y VEP legacy
   - Aplicación de restricciones médicas (`restrictionAlerts`)
   - Ordenamiento por `sourceSort`, VEP descendente

2. **BOT Assistant (`botAssistantSuggestions`)**  
   Recibe payload de contexto de actividad, calcula scoring contra reglas activas usando `triggerConfig` (tags_any, process_contains_any, criticality_any, resource_types_any), devuelve top 8 sugerencias con controles sugeridos, PPE, protocolos y política de aprobación.

3. **Restricciones médicas (`checkWorkerRestrictions`)**  
   Valida trabajadores asignados contra filas de matriz según `appliesToTags` vs `sensitivityTags` + `protocolCodes` + `masterRiskCode`. Genera alertas por severidad (`info`, `warning`, `blocking`).

4. **Exportación avanzada**
   - `exportMatrixExcelExtensive` — Excel con hojas: Matriz IPER, Criterios, Catálogo de peligros, Control de modificaciones
   - `exportMatrixPDFCompact` — PDF A3 landscape con header corporativo, tabla consolidada, glosa de evaluación y firma
   - `exportIRLPDF` — PDF A4 con secciones normativas

5. **Integración `document_center`**  
   Cloud Function interna `_generateDeliveryDocuments` que invoca el módulo de documentos para emitir certificados de entrega de EPP.

6. **Legal Snapshot**  
   Calcula requisitos legales según dotación (`<=25`, `26-100`, `>100`) basado en `legal_requirements_for_headcount`.

#### Componentes React necesarios
- `GeneratorRuleEditor` — Editor visual de reglas con configuración de triggers y approval policy
- `WorkerRestrictionManager` — ABM de restricciones con selección de etiquetas
- `BOTAssistantPanel` — Panel lateral en editor de actividades que muestra sugerencias preventivas con scoring
- `RestrictionAlertBanner` — Banner en matriz/folder cuando hay alertas de restricciones médicas
- `ExportActions` — Botones de exportación Excel/PDF con loading y descarga
- `MatrixInsightsPanel` — Panel de insights: bloqueos, conteos por nivel, protocolos activos, trazabilidad de orígenes

---

## Notas Técnicas para Firebase

### Esquemas recomendados en Firestore
- Usar **root collections** para catálogos globales por tenant: `safetyMasterRisks`, `safetyProtocols`, `safetyPPEItems`, `safetyServiceProfiles`, `safetyRiskMethodologies`, `safetyGeneratorRules`, `safetyEquipmentBlocks`, `safetyClientSites`, `safetyClientAreas`, `safetyWorkerRestrictions`.
- Usar **subcolecciones** para datos anidados a carpeta: `safetyFolders/{id}/documents`, `safetyFolders/{id}/riskMatrices/{id}/rows`, `safetyFolders/{id}/ppeDeliveries`, `safetyFolders/{id}/talks`, `safetyFolders/{id}/checklists`, `safetyFolders/{id}/irlRecords`.
- El campo `companyId` debe indexarse en todas las colecciones para tenant isolation.
- `rows` de `safetyRiskMatrices` puede mantenerse denormalizado en el documento matriz para lecturas rápidas, y en subcolección `rows` para edición granular.

### Lógica pura a preservar
- `risk_calculation_service.py` es **side-effect free**. Migrar tal cual a TypeScript/Node en Cloud Functions.
- `miper_engine.py` contiene lógica de merge, fingerprint y blueprints. Es crítico para la generación de matrices.
- Las constantes `DEFAULT_MASTER_RISKS`, `DEFAULT_PROTOCOLS`, `DEFAULT_PPE_CATALOG`, `CHECKLIST_LIBRARY`, `TALK_LIBRARY` deben replicarse como config/seed en Firebase.

### Dependencias externas del módulo
- `crm` (Lead, Customer, ServiceType, ActivityLog)
- `hr` (EmployeeProfile)
- `safety_procedures` (SafetyProcedureTemplate)
- `job_profiles` (JobProfile)
- `reports` (AreaFaena, SectorFaena, AreaRiskAssignment, SectorRiskAssignment)
- `document_center` (generate_worker_documents_internal)
- `base` (User)

En la migración, estas dependencias deben exponerse como **Cloud Functions inter-módulo** o **Triggers pub/sub** para mantener desacoplamiento.
