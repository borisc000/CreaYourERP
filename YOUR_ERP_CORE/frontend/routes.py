import time
from fastapi import APIRouter, Body
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from core.mvp import get_mvp_disabled_app_module

router = APIRouter(prefix="/app")


def _mvp_redirect(path: str):
    disabled_module = get_mvp_disabled_app_module(path)
    if not disabled_module:
        return None
    return RedirectResponse(url=f"/app/dashboard?mvp={disabled_module}", status_code=307)


@router.get("/test-demo", response_class=HTMLResponse)
async def test_demo():
    return "<html><body><button onclick='alert(123)'>DEMO BUTTON HERE</button></body></html>"


@router.get("/login", response_class=HTMLResponse)
async def login():
    from frontend.pages.login import login_page
    return login_page()


@router.get("/subscription", response_class=HTMLResponse)
async def subscription():
    from frontend.pages.subscription import subscription_page
    return subscription_page()


@router.post("/api/billing/checkout-preview")
async def subscription_checkout_preview(payload: dict = Body(...)):
    from frontend.pages.subscription import get_plan_by_id

    required_fields = ["plan_id", "billing_cycle", "payment_method", "company_name", "admin_name", "admin_email"]
    missing_fields = [field for field in required_fields if not payload.get(field)]
    if missing_fields:
        return JSONResponse(
            {
                "success": False,
                "errors": [f"Faltan campos requeridos: {', '.join(missing_fields)}"],
            },
            status_code=400,
        )

    plan = get_plan_by_id(payload.get("plan_id", ""))
    if not plan:
        return JSONResponse(
            {"success": False, "errors": ["Plan no valido"]},
            status_code=400,
        )

    billing_cycle = payload.get("billing_cycle")
    if billing_cycle not in ("monthly", "yearly"):
        return JSONResponse(
            {"success": False, "errors": ["Ciclo de cobro no valido"]},
            status_code=400,
        )

    amount = plan["monthly_price"] if billing_cycle == "monthly" else plan["yearly_price"]
    preview_reference = f"SUB-PREVIEW-{int(time.time())}"

    return JSONResponse(
        {
            "success": True,
            "data": {
                "subscription_id": preview_reference,
                "status": "provider_pending",
                "status_label": "Listo para integrar pasarela",
                "plan_name": plan["name"],
                "billing_cycle": billing_cycle,
                "amount": amount,
                "currency": "CLP",
                "provider_hint": "Reemplazar este endpoint por la integracion real del proveedor.",
                "login_url": "/app/login?subscription=ready",
            },
        }
    )


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    from frontend.pages.dashboard import dashboard_page
    return dashboard_page()


@router.get("/users", response_class=HTMLResponse)
async def users():
    from frontend.pages.users import users_page
    return users_page()


@router.get("/crm", response_class=HTMLResponse)
async def crm():
    from frontend.pages.crm import crm_page
    return crm_page()


@router.get("/signatures", response_class=HTMLResponse)
async def signatures():
    from frontend.pages.signatures import signatures_page
    return signatures_page()


@router.get("/signature-center", response_class=HTMLResponse)
async def signature_center():
    from frontend.pages.signatures import signatures_page
    return signatures_page()


@router.get("/settings", response_class=HTMLResponse)
async def settings():
    from frontend.pages.settings import settings_page
    return settings_page()


@router.get("/google-workspace", response_class=HTMLResponse)
async def google_workspace():
    redirect = _mvp_redirect("/app/google-workspace")
    if redirect:
        return redirect
    from frontend.pages.google_workspace import google_workspace_page
    return google_workspace_page()


@router.get("/profile", response_class=HTMLResponse)
async def profile():
    from frontend.pages.profile import profile_page
    return profile_page()


@router.get("/forgot-password", response_class=HTMLResponse)
async def forgot_password():
    from frontend.pages.forgot_password import forgot_password_page
    return forgot_password_page()


@router.get("/reset-password", response_class=HTMLResponse)
async def reset_password():
    from frontend.pages.reset_password import reset_password_page
    return reset_password_page()


@router.get("/sign/{token}", response_class=HTMLResponse)
async def sign(token: str):
    from frontend.pages.signing import signing_page
    return signing_page(token)


@router.get("/quotes", response_class=HTMLResponse)
async def quotes_list():
    from frontend.pages.quotes import quotes_page
    return quotes_page()


@router.get("/billing", response_class=HTMLResponse)
async def billing():
    from frontend.pages.billing import billing_page
    return billing_page()


@router.get("/expenses", response_class=HTMLResponse)
async def expenses():
    from frontend.pages.expenses import expenses_page
    return expenses_page()


@router.get("/planning", response_class=HTMLResponse)
async def planning():
    from frontend.pages.planning import planning_page
    return planning_page()


@router.get("/billing/{document_id}/preview", response_class=HTMLResponse)
async def billing_preview(document_id: str):
    from frontend.pages.billing_preview import billing_preview_page
    return billing_preview_page(document_id=document_id)


@router.get("/quotes/new", response_class=HTMLResponse)
async def quote_new():
    from frontend.pages.quote_form import quote_form_page
    return quote_form_page(quote_id=None)


@router.get("/quotes/{quote_id}", response_class=HTMLResponse)
async def quote_detail(quote_id: str):
    from frontend.pages.quote_form import quote_form_page
    return quote_form_page(quote_id=quote_id)


@router.get("/quotes/{quote_id}/preview", response_class=HTMLResponse)
async def quote_preview(quote_id: str):
    from frontend.pages.quote_preview import quote_preview_page
    return quote_preview_page(quote_id=quote_id)


@router.get("/crm/customers", response_class=HTMLResponse)
async def crm_customers():
    from frontend.pages.crm_customers import crm_customers_page
    return crm_customers_page()


@router.get("/crm/customers/{customer_id}", response_class=HTMLResponse)
async def crm_customer_detail(customer_id: str):
    from frontend.pages.crm_customer_detail import crm_customer_detail_page
    return crm_customer_detail_page()


@router.get("/crm/leads/{lead_id}", response_class=HTMLResponse)
async def crm_lead_detail(lead_id: str):
    from frontend.pages.crm_lead_detail import crm_lead_detail_page
    return crm_lead_detail_page(lead_id)


@router.get("/reports/verify/{public_token}", response_class=HTMLResponse)
async def report_verification(public_token: str):
    from frontend.pages.report_verification import report_verification_page
    return report_verification_page(public_token)


@router.get("/services/verify/{public_token}", response_class=HTMLResponse)
async def service_verification(public_token: str):
    from frontend.pages.service_verification import service_verification_page
    return service_verification_page(public_token)


@router.get("/reports/{report_id}", response_class=HTMLResponse)
async def report_workspace(report_id: int):
    from frontend.pages.report_workspace import report_workspace_page
    return report_workspace_page(report_id)


@router.get("/safety", response_class=HTMLResponse)
async def safety():
    from frontend.pages.safety import safety_page
    return safety_page()


@router.get("/safety/admin", response_class=HTMLResponse)
async def safety_admin():
    return RedirectResponse(url="/app/safety/activities", status_code=307)


@router.get("/safety/locations", response_class=HTMLResponse)
async def safety_locations():
    from frontend.pages.safety_locations import safety_locations_page
    return safety_locations_page()


@router.get("/safety/activities", response_class=HTMLResponse)
async def safety_activities():
    from frontend.pages.safety_activities import safety_activities_page
    return safety_activities_page()


@router.get("/safety/miper", response_class=HTMLResponse)
async def safety_miper():
    from frontend.pages.safety_miper import safety_miper_page
    return safety_miper_page()


@router.get("/safety/procedures", response_class=HTMLResponse)
async def safety_procedures():
    from frontend.pages.safety_procedures import safety_procedures_page
    return safety_procedures_page()


@router.get("/safety/folders/{folder_id}", response_class=HTMLResponse)
async def safety_folder_detail(folder_id: str):
    from frontend.pages.safety_folder_detail import safety_folder_detail_page
    return safety_folder_detail_page(folder_id)


@router.get("/catalogs", response_class=HTMLResponse)
async def catalogs():
    from frontend.pages.catalogs import catalogs_page
    return catalogs_page()


@router.get("/recruitment", response_class=HTMLResponse)
async def recruitment():
    from frontend.pages.recruitment import recruitment_page
    return recruitment_page()


@router.get("/tasks", response_class=HTMLResponse)
async def tasks():
    from frontend.pages.tasks import tasks_page
    return tasks_page()


@router.get("/hr", response_class=HTMLResponse)
async def hr():
    from frontend.pages.hr import hr_page
    return hr_page()


@router.get("/job-profiles", response_class=HTMLResponse)
async def job_profiles():
    from frontend.pages.job_profiles import job_profiles_page
    return job_profiles_page()


@router.get("/attendance", response_class=HTMLResponse)
async def attendance():
    redirect = _mvp_redirect("/app/attendance")
    if redirect:
        return redirect
    from frontend.pages.attendance import attendance_page
    return attendance_page()


@router.get("/payroll", response_class=HTMLResponse)
async def payroll():
    redirect = _mvp_redirect("/app/payroll")
    if redirect:
        return redirect
    from frontend.pages.payroll import payroll_page
    return payroll_page()


@router.get("/accreditation", response_class=HTMLResponse)
async def accreditation():
    from frontend.pages.accreditation import accreditation_page
    return accreditation_page()


@router.get("/document-center", response_class=HTMLResponse)
async def document_center():
    from frontend.pages.document_center import document_center_page
    return document_center_page()


@router.get("/cross-correspondence", response_class=HTMLResponse)
async def cross_correspondence():
    from frontend.pages.document_center import document_center_page
    return document_center_page()


@router.get("/inventory", response_class=HTMLResponse)
async def inventory():
    from frontend.pages.inventory import inventory_page
    return inventory_page()


@router.get("/activos", response_class=HTMLResponse)
async def assets():
    redirect = _mvp_redirect("/app/activos")
    if redirect:
        return redirect
    from frontend.pages.assets import assets_page
    return assets_page()


@router.get("/suppliers", response_class=HTMLResponse)
async def suppliers():
    from frontend.pages.suppliers import suppliers_page
    return suppliers_page()


@router.get("/rentals", response_class=HTMLResponse)
async def rentals():
    from frontend.pages.rentals import rentals_page
    return rentals_page()


@router.get("/riohs", response_class=HTMLResponse)
async def riohs():
    redirect = _mvp_redirect("/app/riohs")
    if redirect:
        return redirect
    from frontend.pages.riohs import riohs_page
    return riohs_page()

@router.get("/ai", response_class=HTMLResponse)
async def ai():
    redirect = _mvp_redirect("/app/ai")
    if redirect:
        return redirect
    from frontend.pages.ai import ai_page
    return ai_page()


@router.get("/riohs/download/{filename}", response_class=HTMLResponse)
async def riohs_download(filename: str):
    redirect = _mvp_redirect("/app/riohs/download")
    if redirect:
        return redirect
    import os
    from fastapi.responses import FileResponse
    # Buscar en generated_docs relativo a la raíz del proyecto
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    filepath = os.path.join(base, "generated_docs", filename)
    if not os.path.exists(filepath):
        return HTMLResponse("<h1>Archivo no encontrado</h1>", status_code=404)
    return FileResponse(
        path=filepath,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
    )
