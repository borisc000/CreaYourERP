# Migración Fase 4 — RRHH Avanzado

## Estado
✅ **COMPLETADA**

## Módulos migrados

### Recruitment (Reclutamiento)

**Backend:**
| Función | Descripción |
|---------|-------------|
| `seedRecruitmentStages` | Seed de 7 etapas de pipeline (applied → hired/rejected) |
| `getRecruitmentStats` | Stats: vacantes, candidatos, postulaciones, contratados |
| `createJobOpening` | Crea vacante con auto-numeración JOB-{seq} |
| `updateJobOpening` | Actualiza vacante |
| `createCandidate` | Crea candidato con cálculo de completitud (11 campos) |
| `updateCandidate` | Actualiza candidato |
| `createApplication` | Crea postulación vinculando job + candidate |
| `updateApplication` | Actualiza postulación + etapa |
| `hireApplication` | Contrata candidato: crea Employee, cierra vacante si completa |
| `createInterview` | Crea entrevista |
| `updateInterview` | Actualiza entrevista |

**Frontend:** `RecruitmentDashboard`, `JobOpeningList`, `JobOpeningForm`, `CandidateList`, `CandidateForm`

**Modelos:** `RecruitmentStage`, `JobOpening`, `Candidate`, `JobApplication`, `Interview`

**Colecciones:** `recruitmentStages`, `jobOpenings`, `candidates`, `jobApplications`, `interviews`

### Payroll (Remuneraciones)

**Backend:**
| Función | Descripción |
|---------|-------------|
| `seedPayrollParameters` | Seed de parámetros legales Chile + tramos impuesto 2da categoría |
| `getPayrollDashboard` | Stats: períodos, perfiles, liquidaciones, total neto |
| `createPayrollPeriod` | Crea período de pago |
| `calculatePeriod` | Calcula liquidaciones para todos los perfiles activos |
| `approvePeriod` | Aprueba todas las liquidaciones del período |
| `closePeriod` | Cierra período |
| `savePayrollProfile` | Crea/actualiza perfil previsional del empleado |

**Cálculos implementados:**
- Base imponible prorrateada
- AFP (10.44% + comisión según administradora) con tope 90 UF
- Salud: Fonasa 7% o Isapre con tope 90 UF
- Gratificación Art. 50 con tope 4.75 IMM/12
- Impuesto único 2da categoría (8 tramos UTM)
- AFC trabajador 0.6% (indefinido) / empleador 2.4%-3.0%
- SIS 1.54%, Ley 16.744 accidentes, Reforma previsional 1%
- Asignación familiar tramos A/B/C
- Asiento contable automático
- Warnings: sueldo bajo mínimo, líquido negativo

**Frontend:** `PayrollDashboard`, `PayrollPeriodList`, `PayrollPeriodForm`, `PayrollPeriodDetail`, `PayrollProfileList`

**Modelos:** `PayrollLegalParameter`, `PayrollTaxBracket`, `PayrollProfile`, `PayrollPeriod`, `PayrollSettlement`, `PayrollEventLog`

**Colecciones:** `payrollLegalParameters`, `payrollTaxBrackets`, `payrollProfiles`, `payrollPeriods`, `payrollSettlements`, `payrollEventLogs`

## Seed demo
- 7 etapas de reclutamiento + 1 vacante + 1 candidato + 1 postulación
- 2 parámetros legales (IMM, UTM) + 1 perfil previsional
