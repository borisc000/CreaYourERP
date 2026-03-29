# Modulo de Prevencion y Seguridad para Contratistas

## Objetivo

Crear un modulo que convierta cada oportunidad o servicio en una carpeta operativa controlada, capaz de:

- generar documentacion base segun tipo de servicio y exigencia del cliente
- asegurar que ningun servicio salga a terreno sin matriz, procedimiento, EPP y registros minimos
- dejar evidencia trazable de cumplimiento diario
- ordenar la operacion para auditorias, arranques, renovaciones y cierres de servicio

La idea correcta no es "guardar papeles", sino controlar la preparacion, la ejecucion y la evidencia de seguridad de cada trabajo.

---

## Vista de negocio: problema real del contratista

Desde la mirada de una empresa contratista, los dolores mas comunes son:

- cada mandante pide casi los mismos documentos, pero con formatos y detalles distintos
- los procedimientos y matrices se hacen de nuevo en cada servicio, aunque el riesgo base ya exista
- la carpeta de arranque depende de personas y WhatsApp, no de un sistema
- se pierde tiempo buscando firmas de EPP, charlas, difusiones y checklists
- la jefatura no sabe si un servicio esta realmente listo para movilizarse
- en auditorias o incidentes cuesta demostrar cumplimiento con evidencia ordenada

Por eso el modulo debe resolver dos cosas a la vez:

1. Estandarizar la documentacion.
2. Controlar el cumplimiento real en terreno.

---

## Propuesta de valor

El modulo debe venderse como un sistema de "alistamiento y control HSE por servicio", no solo como gestor documental.

Valor practico para la empresa:

- reduce tiempos de arranque de faena
- baja el riesgo de salir con documentos incompletos o vencidos
- reutiliza inteligencia documental por tipo de servicio
- deja trazabilidad por trabajador, servicio, cliente y fecha
- facilita auditorias internas, del mandante y de mutualidades
- mejora la coordinacion entre comercial, operaciones, prevencion y supervision

---

## Concepto central: carpeta de arranque por oportunidad

La oportunidad del CRM debe ser el eje del modulo.

Cuando un lead pasa a una etapa como `Aceptada (Won)` o `En Ejecucion`, el sistema debe poder crear una **carpeta de arranque** asociada a ese trabajo.

Esa carpeta debe agrupar 5 capas:

### 1. Antecedentes de empresa

- datos legales de la contratista
- documentos corporativos base
- certificados generales
- politicas y reglamentos vigentes

### 2. Antecedentes del servicio

- tipo de servicio
- cliente y mandante
- ubicacion o faena
- alcance del trabajo
- matriz de riesgo especifica
- procedimiento de trabajo seguro
- permisos y anexos operativos

### 3. Antecedentes del personal

- personal asignado
- inducciones y charlas recibidas
- entrega de EPP
- aptitudes o competencias requeridas
- vencimientos de cursos, examenes o licencias

### 4. Control diario de ejecucion

- charla diaria
- AST o ART si aplica
- checklist de equipos o condiciones
- difusiones de seguridad
- observaciones y acciones correctivas

### 5. Cierre y respaldo

- evidencias finales
- checklists de termino
- cierre de observaciones
- dossier o carpeta historica del servicio

---

## Enfoque funcional recomendado

### 1. Catalogos maestros

Antes de emitir documentos, el sistema debe tener catalogos reutilizables:

- tipos de servicio
- familias de riesgo
- peligros y controles frecuentes
- plantillas de matriz de riesgo
- plantillas de procedimientos de trabajo
- catalogo de EPP
- plantillas de charlas diarias
- plantillas de checklists
- plantillas de difusiones
- requisitos documentales por cliente

Esto permite que "andamios", "trabajo en altura", "mantenimiento electrico" o "espacios confinados" no empiecen desde cero cada vez.

### 2. Paquetes documentales por tipo de servicio

Cada tipo de servicio debe tener un paquete base de documentos obligatorios.

Ejemplo para `Andamios`:

- matriz de riesgo base
- procedimiento de armado y desarme
- checklist de inspeccion diaria de andamios
- checklist de arnes y linea de vida
- entrega de EPP para altura
- charla diaria sugerida
- difusion de procedimiento y control de caida de objetos

Luego ese paquete se ajusta por:

- cliente
- area o faena
- condiciones especiales
- equipos utilizados
- personal asignado

### 3. Semaforo de alistamiento

Cada carpeta de arranque debe tener un estado visible:

- `Rojo`: faltan documentos o firmas criticas
- `Amarillo`: documentacion creada pero con pendientes
- `Verde`: carpeta lista para ejecutar

El sistema debe mostrar el porcentaje de cumplimiento por carpeta, por servicio y por cliente.

### 4. Evidencia, version y trazabilidad

Cada documento debe tener control minimo de:

- version
- fecha de emision
- responsable de elaboracion
- responsable de revision o aprobacion
- vigencia
- estado
- relacion con oportunidad y tipo de servicio

Estados sugeridos:

- `draft`
- `pending_review`
- `approved`
- `obsolete`
- `expired`

---

## Alcance documental del modulo

### A. Matriz de riesgo

Debe permitir:

- usar matrices base por tipo de servicio
- clonar y adaptar por oportunidad
- definir actividad, peligro, riesgo, control existente y control adicional
- asignar responsable
- marcar si el riesgo queda aceptable o requiere accion

Campos utiles:

- servicio
- etapa de trabajo
- actividad
- peligro
- consecuencia
- probabilidad
- severidad
- nivel de riesgo
- controles ingenieriles
- controles administrativos
- EPP requerido
- responsable
- observaciones

### B. Procedimientos de trabajo seguro

No debe ser solo un PDF suelto. Debe tener estructura editable:

- objetivo
- alcance
- roles y responsabilidades
- equipos, herramientas y materiales
- EPP obligatorio
- secuencia paso a paso
- riesgos por etapa
- prohibiciones
- respuesta ante emergencias
- firmas de aprobacion
- difusion al personal

El valor real aparece cuando el procedimiento nace desde una plantilla y se completa con datos de la oportunidad.

### C. Entrega de EPP

Debe manejar dos niveles:

- plantilla o pack de EPP requerido por tipo de servicio
- entrega real por trabajador y fecha

La evidencia ideal incluye:

- trabajador
- cargo
- servicio u oportunidad
- item EPP
- talla o especificacion
- cantidad
- fecha de entrega
- reposicion
- firma de recepcion

Este punto se puede integrar muy bien con `signature`.

### D. Charlas diarias

La charla diaria debe dejar de ser un formulario aislado.
Debe vincularse a:

- oportunidad
- fecha
- supervisor o relator
- tema
- personal convocado
- personal asistente
- observaciones del dia
- compromisos

KPI clave:

- porcentaje de asistencia sobre dotacion asignada
- dias ejecutados sin charla registrada

### E. Checklists

El sistema debe soportar checklists por:

- equipo
- vehiculo
- herramienta
- andamio
- area de trabajo
- tarea critica

Cada checklist debe permitir:

- preguntas parametrizables
- respuestas si/no/no aplica
- evidencia fotografica
- responsable
- resultado final
- hallazgos
- accion correctiva
- bloqueo de uso si el resultado es critico

### F. Difusiones de seguridad

Aqui la clave es trazabilidad.

Una difusion debe registrar:

- documento o tema difundido
- motivo
- fecha
- a quienes se difunde
- quienes recibieron y firmaron
- vigencia si aplica

Esto sirve para procedimientos nuevos, alertas de incidente, cambios operacionales o requisitos del mandante.

### G. Carpeta de arranque

Debe ser un contenedor inteligente, no una carpeta estatica.

Contenido minimo recomendado:

- ficha del servicio
- cliente y mandante
- prevencionista y supervisor asignados
- personal asignado
- documentos obligatorios requeridos
- estado de cada documento
- observaciones de cierre de brechas
- fecha objetivo de arranque
- estado de aprobacion

---

## Estructura propuesta para este ERP

Nombre tecnico sugerido del modulo: `safety`

Dependencias sugeridas:

- `base`
- `crm`
- `signature`

Dependencias opcionales de alto valor:

- `hr`
- `reports`

### Integracion con modulos existentes

**CRM**

- el `Lead` es la unidad de negocio sobre la cual nace la carpeta de arranque
- `service_type_id` puede disparar plantillas y requisitos documentales
- el estado del lead puede depender del semaforo de seguridad

**HR**

- `EmployeeProfile` aporta trabajadores, cargos, jefaturas y dotacion
- permite validar si el trabajador tiene requisitos minimos para la tarea

**Signature**

- recepcion de EPP
- difusion de procedimientos
- firma de charlas diarias
- aceptacion de instrucciones y anexos

**Reports**

- ejecucion de checklists y evidencia fotografica en terreno
- observaciones de seguridad y cierre de acciones

---

## Modelos sugeridos

Una primera version consistente con la arquitectura actual podria incluir:

### 1. `SafetyServiceProfile`

Perfil base por tipo de servicio.

Campos:

- `name`
- `service_type_id`
- `risk_level`
- `mandatory_document_codes`
- `mandatory_ppe_codes`
- `mandatory_checklist_codes`
- `active`
- `company_id`

### 2. `SafetyClientRequirement`

Reglas especiales por cliente o mandante.

Campos:

- `customer_id`
- `name`
- `required_document_codes`
- `required_worker_docs`
- `required_inductions`
- `notes`
- `company_id`

### 3. `SafetyFolder`

Carpeta de arranque por oportunidad.

Campos:

- `lead_id`
- `service_profile_id`
- `customer_requirement_id`
- `status`
- `readiness_pct`
- `planned_start_date`
- `approved_by`
- `approved_at`
- `company_id`

### 4. `SafetyDocumentTemplate`

Plantillas reutilizables.

Campos:

- `code`
- `name`
- `document_type`
- `service_type_id`
- `body_template`
- `requires_signature`
- `requires_validity`
- `active`
- `company_id`

### 5. `SafetyFolderDocument`

Documento concreto dentro de la carpeta.

Campos:

- `folder_id`
- `template_id`
- `title`
- `document_type`
- `status`
- `version`
- `assigned_to`
- `issued_at`
- `expires_at`
- `file_path`
- `signature_request_id`
- `company_id`

### 6. `SafetyRiskMatrix`

Matriz asociada a una carpeta.

Campos:

- `folder_id`
- `title`
- `version`
- `status`
- `company_id`

### 7. `SafetyRiskMatrixRow`

Detalle de riesgos.

Campos:

- `matrix_id`
- `activity`
- `hazard`
- `risk`
- `probability`
- `severity`
- `risk_level`
- `controls`
- `required_ppe`
- `owner_name`

### 8. `SafetyPPEDelivery`

Entrega real por trabajador.

Campos:

- `folder_id`
- `employee_id`
- `delivery_date`
- `signed_by_user_id`
- `signature_request_id`
- `status`
- `company_id`

### 9. `SafetyPPEDeliveryLine`

Detalle de items entregados.

Campos:

- `delivery_id`
- `ppe_code`
- `description`
- `quantity`
- `size`

### 10. `SafetyTalk`

Registro de charla diaria.

Campos:

- `folder_id`
- `talk_date`
- `topic`
- `speaker_user_id`
- `attendance_expected`
- `attendance_actual`
- `notes`
- `signature_request_id`
- `company_id`

### 11. `SafetyChecklistTemplate`

Plantilla de checklist por objeto de control.

Campos:

- `code`
- `name`
- `checklist_type`
- `service_type_id`
- `active`
- `company_id`

### 12. `SafetyChecklistRun`

Checklist ejecutado.

Campos:

- `folder_id`
- `template_id`
- `executed_at`
- `executed_by`
- `result`
- `findings`
- `requires_action`
- `company_id`

---

## Reglas de negocio que hacen valioso el modulo

- no permitir que una carpeta pase a `Verde` si faltan documentos criticos
- no permitir iniciar un servicio si la matriz o el procedimiento siguen en `draft`
- alertar si hay trabajadores asignados sin EPP registrado
- alertar si hay documentos vencidos o proximos a vencer
- bloquear el uso de equipo o andamio si el checklist sale critico
- registrar override solo con responsable y justificacion
- guardar historial de cambios de estado, version y aprobacion

Estas reglas son las que convierten el modulo en una herramienta operativa y no en un repositorio pasivo.

---

## Endpoints MVP sugeridos

Pensando en la arquitectura actual del repo, un MVP podria exponer rutas como:

- `GET /safety/service-profiles`
- `POST /safety/service-profiles`
- `GET /safety/client-requirements`
- `POST /safety/client-requirements`
- `GET /safety/folders`
- `POST /safety/folders`
- `GET /safety/folders/{id}`
- `PUT /safety/folders/{id}`
- `POST /safety/folders/{id}/generate-documents`
- `GET /safety/folders/{id}/documents`
- `POST /safety/folders/{id}/documents`
- `POST /safety/folders/{id}/risk-matrix`
- `PUT /safety/risk-matrix/{id}`
- `POST /safety/folders/{id}/ppe-deliveries`
- `POST /safety/folders/{id}/talks`
- `POST /safety/folders/{id}/checklists`
- `POST /safety/checklists/{id}/close`

---

## Pantallas clave del MVP

- tablero general de carpetas de arranque con semaforo y readiness
- ficha de carpeta por oportunidad
- editor de matriz de riesgo
- editor de procedimiento de trabajo
- registro de entrega de EPP
- registro de charla diaria
- ejecutor de checklists
- vista de vencimientos y brechas

---

## Flujo operativo ideal

### Flujo 1: preparacion del servicio

1. Comercial crea o gana una oportunidad en CRM.
2. Se identifica el tipo de servicio.
3. El sistema propone un perfil de seguridad base.
4. Se crea la carpeta de arranque.
5. Se generan documentos obligatorios.
6. Prevencion y operaciones completan brechas.
7. La carpeta queda en verde y el servicio puede iniciar.

### Flujo 2: ejecucion diaria

1. Supervisor abre la jornada.
2. Registra charla diaria.
3. Ejecuta checklist critico.
4. Registra difusiones o alertas si hubo cambios.
5. Reporta observaciones y acciones.
6. El sistema actualiza cumplimiento diario.

### Flujo 3: auditoria o cliente

1. Se abre la carpeta del servicio.
2. Se visualiza estado de cumplimiento.
3. Se descargan documentos vigentes.
4. Se revisan firmas, fechas, versiones y evidencias.
5. Se identifican brechas y responsables.

---

## Caso de uso: servicio de andamios

Si el tipo de servicio es `Andamios`, el modulo deberia aportar valor inmediato sin que el usuario parta desde una hoja en blanco.

### Documentos base sugeridos

- matriz de riesgo para armado, modificacion, uso y desarme
- procedimiento de trabajo seguro para andamios
- difusion del procedimiento
- entrega de EPP para trabajo en altura
- checklist de pre uso del andamio
- checklist de arnes, cola y linea de vida
- charla diaria orientada a altura y caida de objetos

### Riesgos tipicos a cubrir

- caida de distinto nivel
- caida de herramientas o materiales
- colapso por armado deficiente
- falta de anclaje o nivelacion
- interferencia con energia electrica
- sobreesfuerzo en manipulacion de piezas
- trabajo con viento o clima adverso

### Controles esperados

- personal competente y autorizado
- inspeccion previa de componentes
- nivelacion y anclaje segun procedimiento
- delimitacion del area inferior
- uso obligatorio de arnes y amarre de herramientas
- checklist diario antes del uso
- retiro de servicio si hay hallazgos criticos

Este ejemplo muestra por que el modulo debe trabajar por "tipo de servicio" y no solo por archivo suelto.

---

## Roles recomendados

- `Prevencionista`: crea, revisa y aprueba documentos criticos
- `Supervisor`: ejecuta control diario y asegura asistencia
- `Administrador de contrato`: valida arranque y cumplimiento contractual
- `Bodega o logistica`: gestiona entrega y reposicion de EPP
- `Trabajador`: recibe EPP, firma difusiones y registra asistencia
- `Gerencia`: visualiza indicadores y brechas

---

## KPIs que realmente agregan valor

- porcentaje de carpetas listas para arranque
- tiempo promedio desde oportunidad ganada hasta carpeta en verde
- porcentaje de documentos vencidos por servicio
- porcentaje de charlas diarias realizadas vs dias trabajados
- porcentaje de asistencia a charlas vs dotacion asignada
- porcentaje de trabajadores con EPP entregado y vigente
- cantidad de hallazgos criticos abiertos
- tiempo promedio de cierre de acciones correctivas
- servicios ejecutados sin matriz aprobada
- servicios ejecutados sin procedimiento difundido

---

## Roadmap recomendado

### Fase 1: MVP documental y carpeta de arranque

Objetivo:

- crear valor inmediato para contratistas

Alcance:

- catalogos base
- perfiles por tipo de servicio
- requisitos por cliente
- carpeta de arranque por lead
- documentos obligatorios
- semaforo de readiness

Resultado:

- la empresa sabe si puede o no movilizar un servicio

### Fase 2: cumplimiento diario y firmas

Objetivo:

- bajar la brecha entre documentacion y operacion real

Alcance:

- charlas diarias
- difusiones
- entrega de EPP con firma
- checklists ejecutados
- alertas de vencimiento

Resultado:

- evidencia diaria trazable por trabajador y servicio

### Fase 3: auditoria, incidentes y analitica

Objetivo:

- transformar el modulo en una plataforma de control HSE

Alcance:

- observaciones y acciones correctivas
- auditorias internas
- historial y versionamiento completo
- tableros por cliente, faena y servicio
- dossier final del servicio

Resultado:

- la empresa deja de reaccionar y empieza a gestionar seguridad con datos

---

## Recomendacion tecnica concreta para este repo

Para mantener coherencia con la arquitectura actual:

- crear `modules/safety/module_safety.py`
- registrar el modulo en `main.py`
- usar `crm.Lead` como hub principal
- usar `signature` para evidencias firmadas
- agregar paginas como:
  - `/app/safety`
  - `/app/safety/folders/{id}`
  - `/app/safety/templates`
  - `/app/safety/checklists`

Primera entrega recomendada:

1. Catalogo de perfiles por tipo de servicio.
2. Carpeta de arranque por oportunidad.
3. Documentos obligatorios con estados.
4. Matriz de riesgo y procedimiento.
5. Entrega de EPP y charla diaria con firma.

Con esa base ya existe un producto util, vendible y con impacto real.

---

## Conclusion

Si este modulo se disena bien, no sera un repositorio de PDFs.
Sera el sistema que une comercial, operacion, prevencion y evidencia de cumplimiento.

Para una contratista, el valor no esta solo en "tener documentos", sino en saber:

- que documentos exige cada servicio
- que falta para poder arrancar
- que trabajador esta habilitado
- que se hizo cada dia
- y con que evidencia puede defenderse ante una auditoria o incidente

Ese es el enfoque que mas valor autonomo puede aportar a las empresas.
