"""
Módulo RIOHS - Generador de Reglamento Interno de Orden, Higiene y Seguridad
Basado en el formato ACHS 2026 (DS N°44, Código del Trabajo, Ley 16.744)
"""
from __future__ import annotations
import json
import os
from datetime import datetime
from typing import Any, Dict, Optional

from core.YOUR_ERP_core_framework import BaseModule, Request, Response
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin


class ReglamentoConfig(BaseModel, AuditMixin):
    """Configuración guardada de un reglamento generado"""
    _store: Dict[int, "ReglamentoConfig"] = {}

    # Datos empresa
    empresa_nombre    = Column(ColumnType.STRING, required=True, label="Razón Social")
    empresa_rut       = Column(ColumnType.STRING, required=True, label="RUT Empresa")
    empresa_giro      = Column(ColumnType.STRING, required=True, label="Giro / Actividad")
    empresa_direccion = Column(ColumnType.STRING, required=True, label="Dirección")
    empresa_ciudad    = Column(ColumnType.STRING, required=True, label="Ciudad")
    empresa_region    = Column(ColumnType.STRING, required=True, label="Región")
    empresa_telefono  = Column(ColumnType.STRING, label="Teléfono")
    empresa_email     = Column(ColumnType.STRING, label="Email empresa")
    organismo_admin   = Column(ColumnType.STRING, required=True, label="Organismo Administrador del Seguro")

    # Estructura organizacional
    num_trabajadores       = Column(ColumnType.INTEGER, required=True, label="N° Trabajadores")
    tipo_reglamento        = Column(ColumnType.STRING, required=True, label="Tipo Reglamento")  # RIHS / RIOHS
    tiene_comite_paritario = Column(ColumnType.BOOLEAN, label="Tiene Comité Paritario")
    tiene_delegado_sst     = Column(ColumnType.BOOLEAN, label="Tiene Delegado SST")
    tiene_dpto_prevencion  = Column(ColumnType.BOOLEAN, label="Tiene Dpto. Prevención")
    responsable_sst_nombre = Column(ColumnType.STRING, label="Responsable SST")
    responsable_sst_cargo  = Column(ColumnType.STRING, label="Cargo Responsable SST")
    responsable_sst_email  = Column(ColumnType.STRING, label="Email Responsable SST")

    # Jornada
    jornada_horas_semanales = Column(ColumnType.INTEGER, label="Horas semanales")
    jornada_dias            = Column(ColumnType.STRING,  label="Días laborales")
    jornada_hora_inicio     = Column(ColumnType.STRING,  label="Hora inicio")
    jornada_hora_fin        = Column(ColumnType.STRING,  label="Hora fin")
    tiene_turnos            = Column(ColumnType.BOOLEAN, label="Sistema de turnos")
    descripcion_turnos      = Column(ColumnType.TEXT,    label="Descripción turnos (Anexo 1)")
    tiene_teletrabajo       = Column(ColumnType.BOOLEAN, label="Tiene teletrabajo/trabajo a distancia")

    # Remuneraciones
    remuneracion_periodo = Column(ColumnType.STRING, label="Período de pago")   # quincenal/mensual
    remuneracion_dia     = Column(ColumnType.INTEGER, label="Día de pago")
    remuneracion_metodo  = Column(ColumnType.STRING, label="Método de pago")   # deposito/cheque/efectivo
    escalas_cargos       = Column(ColumnType.TEXT,   label="Cargos y escalas (Anexo 2)")

    # Riesgos (JSON lista)
    riesgos_fisicos        = Column(ColumnType.TEXT, label="Riesgos físicos")
    riesgos_quimicos       = Column(ColumnType.TEXT, label="Riesgos químicos")
    riesgos_biologicos     = Column(ColumnType.TEXT, label="Riesgos biológicos")
    riesgos_ergonomicos    = Column(ColumnType.TEXT, label="Riesgos ergonómicos")
    riesgos_psicosociales  = Column(ColumnType.TEXT, label="Riesgos psicosociales")

    # EPP y Vacunas
    epp_requeridos      = Column(ColumnType.TEXT, label="EPP requeridos")
    vacunas_requeridas  = Column(ColumnType.TEXT, label="Vacunas requeridas")

    # Actividades especiales
    trabaja_alturas           = Column(ColumnType.BOOLEAN, label="Trabajos en altura")
    trabaja_electricidad      = Column(ColumnType.BOOLEAN, label="Trabajos eléctricos")
    trabaja_quimicos          = Column(ColumnType.BOOLEAN, label="Trabajo con químicos")
    trabaja_maquinaria        = Column(ColumnType.BOOLEAN, label="Maquinaria pesada")
    trabaja_espacios_confinados = Column(ColumnType.BOOLEAN, label="Espacios confinados")
    trabaja_con_publico       = Column(ColumnType.BOOLEAN, label="Atención público")

    # Sanciones
    multa_min_pct = Column(ColumnType.INTEGER, label="Multa mínima % sueldo diario")
    multa_max_pct = Column(ColumnType.INTEGER, label="Multa máxima % sueldo diario")

    # Contacto reclamos
    reclamos_email = Column(ColumnType.STRING, label="Email canal de reclamos")
    reclamos_plazo = Column(ColumnType.INTEGER, label="Plazo respuesta reclamos (días)")

    # Meta
    fecha_vigencia = Column(ColumnType.STRING, label="Fecha de vigencia")
    estado         = Column(ColumnType.STRING, label="Estado")  # borrador/generado
    company_id     = Column(ColumnType.INTEGER, label="Empresa ERP")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "empresa_nombre": self.empresa_nombre,
            "empresa_rut": self.empresa_rut,
            "empresa_giro": self.empresa_giro,
            "empresa_direccion": self.empresa_direccion,
            "empresa_ciudad": self.empresa_ciudad,
            "empresa_region": self.empresa_region,
            "empresa_telefono": self.empresa_telefono,
            "empresa_email": self.empresa_email,
            "organismo_admin": self.organismo_admin,
            "num_trabajadores": self.num_trabajadores,
            "tipo_reglamento": self.tipo_reglamento,
            "tiene_comite_paritario": self.tiene_comite_paritario,
            "tiene_delegado_sst": self.tiene_delegado_sst,
            "tiene_dpto_prevencion": self.tiene_dpto_prevencion,
            "responsable_sst_nombre": self.responsable_sst_nombre,
            "responsable_sst_cargo": self.responsable_sst_cargo,
            "responsable_sst_email": self.responsable_sst_email,
            "jornada_horas_semanales": self.jornada_horas_semanales,
            "jornada_dias": self.jornada_dias,
            "jornada_hora_inicio": self.jornada_hora_inicio,
            "jornada_hora_fin": self.jornada_hora_fin,
            "tiene_turnos": self.tiene_turnos,
            "descripcion_turnos": self.descripcion_turnos,
            "tiene_teletrabajo": self.tiene_teletrabajo,
            "remuneracion_periodo": self.remuneracion_periodo,
            "remuneracion_dia": self.remuneracion_dia,
            "remuneracion_metodo": self.remuneracion_metodo,
            "escalas_cargos": self.escalas_cargos,
            "riesgos_fisicos": self.riesgos_fisicos,
            "riesgos_quimicos": self.riesgos_quimicos,
            "riesgos_biologicos": self.riesgos_biologicos,
            "riesgos_ergonomicos": self.riesgos_ergonomicos,
            "riesgos_psicosociales": self.riesgos_psicosociales,
            "epp_requeridos": self.epp_requeridos,
            "vacunas_requeridas": self.vacunas_requeridas,
            "trabaja_alturas": self.trabaja_alturas,
            "trabaja_electricidad": self.trabaja_electricidad,
            "trabaja_quimicos": self.trabaja_quimicos,
            "trabaja_maquinaria": self.trabaja_maquinaria,
            "trabaja_espacios_confinados": self.trabaja_espacios_confinados,
            "trabaja_con_publico": self.trabaja_con_publico,
            "multa_min_pct": self.multa_min_pct,
            "multa_max_pct": self.multa_max_pct,
            "reclamos_email": self.reclamos_email,
            "reclamos_plazo": self.reclamos_plazo,
            "fecha_vigencia": self.fecha_vigencia,
            "estado": self.estado,
            "company_id": self.company_id,
            "created_at": self.created_at.isoformat() if self.created_at and hasattr(self.created_at, 'isoformat') else str(self.created_at or ""),
        }


class RiohsModule(BaseModule):
    name = "RIOHS"
    version = "1.0.0"
    author = "YOUR ERP"
    description = "Generador de Reglamento Interno de Orden, Higiene y Seguridad (ACHS 2026)"
    depends = ["base"]

    def init_module(self):
        self.register_route("/riohs/configs",          self.list_configs,   methods=["GET"],  auth_required=True)
        self.register_route("/riohs/configs",          self.create_config,  methods=["POST"], auth_required=True)
        self.register_route("/riohs/configs/{id}",     self.get_config,     methods=["GET"],  auth_required=True)
        self.register_route("/riohs/configs/{id}",     self.update_config,  methods=["PUT"],  auth_required=True)
        self.register_route("/riohs/configs/{id}",     self.delete_config,  methods=["DELETE"], auth_required=True)
        self.register_route("/riohs/configs/{id}/generate", self.generate_docx, methods=["GET"], auth_required=True)
        self.logger.info("Módulo RIOHS inicializado")

    # ──────────────────────────────────────────────
    # CRUD
    # ──────────────────────────────────────────────
    async def list_configs(self, request: Request) -> Response:
        company_id = getattr(request, "company_id", None)
        all_cfgs = ReglamentoConfig.search([])
        if company_id:
            all_cfgs = [c for c in all_cfgs if c.company_id == company_id]
        return Response.ok([c.to_dict() for c in all_cfgs])

    async def create_config(self, request: Request) -> Response:
        data = request.data or {}
        company_id = getattr(request, "company_id", None)
        cfg = ReglamentoConfig()
        self._apply_data(cfg, data)
        cfg.company_id = company_id
        cfg.estado = data.get("estado", "borrador")
        cfg.save()
        return Response.ok(cfg.to_dict())

    async def get_config(self, request: Request) -> Response:
        cfg_id = int(request.params.get("id", 0))
        cfg = ReglamentoConfig.find_by_id(cfg_id)
        if not cfg:
            return Response.not_found("Configuración no encontrada")
        return Response.ok(cfg.to_dict())

    async def update_config(self, request: Request) -> Response:
        cfg_id = int(request.params.get("id", 0))
        cfg = ReglamentoConfig.find_by_id(cfg_id)
        if not cfg:
            return Response.not_found("Configuración no encontrada")
        data = request.data or {}
        self._apply_data(cfg, data)
        cfg.save()
        return Response.ok(cfg.to_dict())

    async def delete_config(self, request: Request) -> Response:
        cfg_id = int(request.params.get("id", 0))
        cfg = ReglamentoConfig.find_by_id(cfg_id)
        if not cfg:
            return Response.not_found("Configuración no encontrada")
        cfg.delete()
        return Response.ok({"deleted": True})

    # ──────────────────────────────────────────────
    # Generar DOCX
    # ──────────────────────────────────────────────
    async def generate_docx(self, request: Request) -> Response:
        from fastapi.responses import FileResponse
        cfg_id = int(request.params.get("id", 0))
        cfg = ReglamentoConfig.find_by_id(cfg_id)
        if not cfg:
            return Response.not_found("Configuración no encontrada")

        try:
            from modules.riohs.doc_generator import generar_reglamento
            filepath = generar_reglamento(cfg)
            # Devuelve path para que el frontend descargue
            return Response.ok({"filepath": filepath, "filename": os.path.basename(filepath)})
        except Exception as e:
            self.logger.error(f"Error generando DOCX: {e}")
            return Response.error(f"Error al generar documento: {str(e)}")

    # ──────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────
    def _apply_data(self, cfg: ReglamentoConfig, data: dict):
        fields = [
            "empresa_nombre","empresa_rut","empresa_giro","empresa_direccion",
            "empresa_ciudad","empresa_region","empresa_telefono","empresa_email",
            "organismo_admin","num_trabajadores","tipo_reglamento",
            "tiene_comite_paritario","tiene_delegado_sst","tiene_dpto_prevencion",
            "responsable_sst_nombre","responsable_sst_cargo","responsable_sst_email",
            "jornada_horas_semanales","jornada_dias","jornada_hora_inicio","jornada_hora_fin",
            "tiene_turnos","descripcion_turnos","tiene_teletrabajo",
            "remuneracion_periodo","remuneracion_dia","remuneracion_metodo","escalas_cargos",
            "riesgos_fisicos","riesgos_quimicos","riesgos_biologicos",
            "riesgos_ergonomicos","riesgos_psicosociales",
            "epp_requeridos","vacunas_requeridas",
            "trabaja_alturas","trabaja_electricidad","trabaja_quimicos",
            "trabaja_maquinaria","trabaja_espacios_confinados","trabaja_con_publico",
            "multa_min_pct","multa_max_pct","reclamos_email","reclamos_plazo",
            "fecha_vigencia","estado",
        ]
        for f in fields:
            if f in data:
                setattr(cfg, f, data[f])
