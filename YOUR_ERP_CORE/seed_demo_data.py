"""
SEED_DEMO_DATA.PY - Datos de prueba ficticios para demo
========================================================

Ejecutar con: python seed_demo_data.py
Crea usuario demo y datos ficticios para testing.
"""

import sys
sys.path.insert(0, '/'.join(__file__.split('/')[:-1]))

from datetime import datetime, timedelta
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import User, Company
from modules.crm.module_crm import Customer, Mandante, Lead, ServiceType, Stage
from modules.quotes.module_quotes import ServiceCatalog, WorkerCatalog, ItemCatalog
from modules.reports.module_reports import Report, ReportCheckpoint, AreaFaena, SectorFaena
from modules.hr.module_hr import Department, EmployeeProfile, EmployeeContract

def seed_demo():
    """Crear datos de demostración."""

    print("[*] Sembrando datos de prueba...")

    # 1. CREAR EMPRESA DEMO
    company = Company.create({
        'name': 'Pedro Construction',
        'legal_name': 'PEDRO CONSTRUCCIÓN E.I.R.L.',
        'tax_id': '76.123.456-7',
        'address': 'Calle Principal 123, Santiago',
        'city': 'Santiago',
        'country': 'Chile',
        'phone': '+56 2 2345 6789',
        'email': 'info@pedroconstruction.cl',
        'website': 'www.pedroconstruction.cl',
        'active': True,
    })
    company.save()
    company_id = company.id
    print(f"[+] Empresa: {company.name} (ID: {company_id})")

    # 2. CREAR USUARIO DEMO
    user = User(
        company_id=company_id,
        email='demo@pedroconstruction.cl',
        name='Usuario Demo',
        is_active=True,
        role='manager',
    )
    # Usar método set_password para hashear correctamente ANTES de crear
    user.set_password('demo123')
    user.save()
    # Generar token
    user.auth_token = f"demo_token_{user.id}_{datetime.utcnow().timestamp()}"
    user.save()
    print(f"[+] Usuario: demo@pedroconstruction.cl")
    print(f"  Contraseña: demo123")
    print(f"  Token: {user.auth_token}")

    # 3. CREAR CLIENTES
    customers_data = [
        {'name': 'Constructora Las Nuevas', 'address': 'Av. Principal 456', 'tax_id': '76.234.567-8'},
        {'name': 'Minería del Sur', 'address': 'Ruta 5 Sur Km 200', 'tax_id': '76.345.678-9'},
        {'name': 'Energética Verde', 'address': 'Camino a la Costa 789', 'tax_id': '76.456.789-0'},
    ]

    customers = []
    for cdata in customers_data:
        cust = Customer.create({
            'company_id': company_id,
            'name': cdata['name'],
            'address': cdata['address'],
            'tax_id': cdata['tax_id'],
            'city': 'Santiago',
            'country': 'Chile',
            'active': True,
        })
        cust.save()
        customers.append(cust)
        print(f"[+] Cliente: {cust.name}")

    # 4. CREAR MANDANTES (contactos de clientes)
    for idx, cust in enumerate(customers):
        mandante = Mandante.create({
            'company_id': company_id,
            'customer_id': cust.id,
            'name': f'Encargado Proyecto {idx+1}',
            'email': f'encargado{idx+1}@cliente.cl',
            'phone': f'+56 9 {2000+idx}{0000+idx}',
            'position': 'Supervisor de Proyecto',
            'active': True,
        })
        mandante.save()

    # 5. CREAR TIPOS DE SERVICIO
    service_types = [
        'CONSULTORÍA ESTRATÉGICA',
        'SUPERVISIÓN DE OBRA',
        'CONTROL DE CALIDAD',
        'INSPECCIÓN DE SEGURIDAD',
        'LEVANTAMIENTO TOPOGRÁFICO',
    ]

    service_type_objs = []
    for st in service_types:
        obj = ServiceType.create({
            'company_id': company_id,
            'name': st,
            'active': True,
        })
        obj.save()
        service_type_objs.append(obj)
        print(f"[+] Tipo de Servicio: {st}")

    # 6. CREAR CATÁLOGO DE SERVICIOS
    services = [
        {'name': 'Inspección Diaria', 'code': 'INS-001', 'cost_price': 150000, 'selling_price': 250000, 'desc': 'Inspección diaria en sitio de obra'},
        {'name': 'Auditoría Completa', 'code': 'AUD-001', 'cost_price': 500000, 'selling_price': 950000, 'desc': 'Auditoría integral con informe'},
        {'name': 'Reporte Técnico', 'code': 'REP-001', 'cost_price': 200000, 'selling_price': 400000, 'desc': 'Reporte técnico detallado'},
    ]

    for srv in services:
        svc = ServiceCatalog.create({
            'company_id': company_id,
            'name': srv['name'],
            'code': srv['code'],
            'description': srv['desc'],
            'cost_price': srv['cost_price'],
            'selling_price': srv['selling_price'],
            'active': True,
        })
        svc.save()
        print(f"[+] Servicio Catálogo: {srv['name']} (${srv['selling_price']:,})")

    # 7. CREAR CATÁLOGO DE PERSONAL
    workers = [
        {'position': 'Ingeniero Inspección', 'rate': 150.0},
        {'position': 'Técnico Senior', 'rate': 120.0},
        {'position': 'Supervisor', 'rate': 130.0},
    ]

    for wrk in workers:
        wrc = WorkerCatalog.create({
            'company_id': company_id,
            'position_name': wrk['position'],
            'hour_rate_hh': wrk['rate'],
        })
        wrc.save()
        print(f"[+] Personal Catálogo: {wrk['position']} (${wrk['rate']:.0f}/HH)")

    # 8. CREAR CATÁLOGO DE INSUMOS
    items = [
        {'code': 'ITE-001', 'desc': 'Transporte de personal y equipos', 'cost': 50000, 'unit': 'servicio'},
        {'code': 'ITE-002', 'desc': 'Equipos especializados de medición', 'cost': 30000, 'unit': 'día'},
        {'code': 'ITE-003', 'desc': 'Preparación de documentación técnica', 'cost': 20000, 'unit': 'paquete'},
    ]

    for itm in items:
        itc = ItemCatalog.create({
            'company_id': company_id,
            'code': itm['code'],
            'description': itm['desc'],
            'cost_price': itm['cost'],
            'unit': itm['unit'],
        })
        itc.save()
        print(f"[+] Insumo Catálogo: {itm['desc']} ({itm['unit']})")

    # 9. CREAR ÁREAS Y SECTORES
    areas_data = {
        'Área Norte': ['Sector A - Fundaciones', 'Sector B - Estructura', 'Sector C - Acabados'],
        'Área Sur': ['Sector A - Excavación', 'Sector B - Drenaje', 'Sector C - Compactación'],
        'Área Central': ['Sector A - Control', 'Sector B - Inspección'],
    }

    for area_name, sectors in areas_data.items():
        area = AreaFaena.create({
            'company_id': company_id,
            'customer_id': customers[0].id,
            'nombre': area_name,
            'descripcion': f'Área operativa: {area_name}',
            'activa': True,
        })
        area.save()

        for sector_name in sectors:
            sector = SectorFaena.create({
                'company_id': company_id,
                'area_id': area.id,
                'nombre': sector_name,
                'descripcion': f'Sector dentro de {area_name}',
                'activa': True,
            })
            sector.save()

        print(f"[+] Área: {area_name} ({len(sectors)} sectores)")

    # 10. CREAR OPORTUNIDADES/LEADS
    leads_data = [
        {
            'customer_id': customers[0].id,
            'title': 'Inspección Mensual Proyecto Nuevo',
            'description': 'Se requiere inspección completa del sitio de construcción',
            'service_type': 'SUPERVISIÓN DE OBRA',
        },
        {
            'customer_id': customers[1].id,
            'title': 'Auditoría de Seguridad - Mina Centro',
            'description': 'Auditoría integral de protocolos de seguridad',
            'service_type': 'INSPECCIÓN DE SEGURIDAD',
        },
        {
            'customer_id': customers[2].id,
            'title': 'Levantamiento Topográfico - Sector Ampliación',
            'description': 'Topografía y delimitación de área de ampliación',
            'service_type': 'LEVANTAMIENTO TOPOGRÁFICO',
        },
    ]

    leads = []
    for ldata in leads_data:
        lead = Lead.create({
            'company_id': company_id,
            'customer_id': ldata['customer_id'],
            'title': ldata['title'],
            'description': ldata['description'],
            'service_type': ldata['service_type'],
            'status': 'open',
            'po_number': f"OC-{2024}{len(leads)+1:03d}",
            'is_active': True,
        })
        lead.save()
        leads.append(lead)
        print(f"[+] Oportunidad: {lead.title}")

    # 11. CREAR REPORTES DE TERRENO
    service_types_list = ['SUPERVISIÓN DE OBRA', 'INSPECCIÓN DE SEGURIDAD']
    for idx, lead in enumerate(leads[:2]):  # Primeros 2 leads
        report = Report.create({
            'company_id': company_id,
            'lead_id': lead.id,
            'estado': 'ABIERTO',
            'servicio': 'Inspección de terreno',
            'tiposervicio': service_types_list[idx],
            'area': 'Área Norte',
            'sector': 'Sector A - Fundaciones',
            'empresa': 'Constructora Las Nuevas',
            'apr': 'Ingeniero Demo',
            'supervisor': 'Supervisor Demo',
            'adm': 'Administrador Demo',
            'mandante': 'Encargado Proyecto',
            'emision': datetime.utcnow().isoformat(),
            'active': True,
        })
        report.save()

        # Agregar checkpoints de ejemplo
        checkpoint_types = ['INICIAL', 'CONTROL']
        for ctype in checkpoint_types:
            cp = ReportCheckpoint.create({
                'company_id': company_id,
                'report_id': report.id,
                'tipo': ctype,
                'descripcion': f'Checkpoint {ctype} - Verificación de estándares',
                'emision': (datetime.utcnow() + timedelta(days=checkpoint_types.index(ctype))).isoformat(),
                'active': True,
            })
            cp.save()

        print(f"[+] Reporte: #{report.id} - {lead.title}")

    print("\n[*] Base de datos poblada con datos de demostración!")
    print(f"\n[INFO] Credenciales de acceso:")
    print(f"   Email: demo@pedroconstruction.cl")
    print(f"   Contraseña: demo123")
    print(f"\n[DATA] Datos de prueba:")
    print(f"   - 1 empresa (Pedro Construction)")
    print(f"   - 1 usuario demo")
    print(f"   - 3 clientes ficticios")
    print(f"   - 5 tipos de servicio")
    print(f"   - 3 servicios en catálogo")
    print(f"   - 3 posiciones de personal")
    print(f"   - 3 insumos")
    print(f"   - 5 áreas y sectores")
    print(f"   - 3 oportunidades/leads")
    print(f"   - 2 reportes de terreno con checkpoints")

def seed_if_empty():
    """Seed demo data only if database is empty"""
    from modules.base.module_base import User
    if len(User._store) == 0:
        seed_demo()
        return True
    return False

if __name__ == '__main__':
    seed_demo()
