from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(prefix="/app")


@router.get("/login", response_class=HTMLResponse)
async def login():
    from frontend.pages.login import login_page
    return login_page()


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


@router.get("/settings", response_class=HTMLResponse)
async def settings():
    from frontend.pages.settings import settings_page
    return settings_page()


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


@router.get("/reports/{report_id}", response_class=HTMLResponse)
async def report_workspace(report_id: int):
    from frontend.pages.report_workspace import report_workspace_page
    return report_workspace_page(report_id)


@router.get("/safety", response_class=HTMLResponse)
async def safety():
    from frontend.pages.safety import safety_page
    return safety_page()


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


@router.get("/hr", response_class=HTMLResponse)
async def hr():
    from frontend.pages.hr import hr_page
    return hr_page()


@router.get("/inventory", response_class=HTMLResponse)
async def inventory():
    from frontend.pages.inventory import inventory_page
    return inventory_page()
