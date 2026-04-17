# modules/frontend/routes.py
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from fastapi.responses import RedirectResponse
from fastapi import Request
from fastapi.templating import Jinja2Templates
from pathlib import Path

router = APIRouter()

# Setup Jinja2 templates
templates_dir = Path(__file__).parent.parent.parent / "frontend" / "templates"
templates = Jinja2Templates(directory=str(templates_dir))

@router.get("/", response_class=HTMLResponse)
async def dashboard():
    """Redirect root to the current app entrypoint."""
    return RedirectResponse(url="/app/login", status_code=307)

@router.get("/employees", response_class=HTMLResponse)
async def employees_page(request: Request):
    """Render employees management page"""
    return templates.TemplateResponse(request, "employees.html")

@router.get("/contracts", response_class=HTMLResponse)
async def contracts_page(request: Request):
    """Render contracts management page"""
    return templates.TemplateResponse(request, "contracts.html")


@router.get("/accreditation", response_class=HTMLResponse)
async def accreditation_page(request: Request):
    """Render accreditation service orders list page"""
    return templates.TemplateResponse(request, "accreditation.html")


@router.get("/accreditation/{service_order_id}", response_class=HTMLResponse)
async def accreditation_detail_page(request: Request, service_order_id: int):
    """Render accreditation detail page with dynamic worker matrix"""
    return templates.TemplateResponse(
        request,
        "accreditation_detail.html",
        {"service_order_id": service_order_id},
    )
