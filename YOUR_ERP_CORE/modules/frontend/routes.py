# modules/frontend/routes.py
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from fastapi import Request
from fastapi.templating import Jinja2Templates
from pathlib import Path

router = APIRouter()

# Setup Jinja2 templates
templates_dir = Path(__file__).parent.parent.parent / "frontend" / "templates"
templates = Jinja2Templates(directory=str(templates_dir))

@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Render dashboard page"""
    return templates.TemplateResponse("dashboard.html", {"request": request})

@router.get("/employees", response_class=HTMLResponse)
async def employees_page(request: Request):
    """Render employees management page"""
    return templates.TemplateResponse("employees.html", {"request": request})

@router.get("/contracts", response_class=HTMLResponse)
async def contracts_page(request: Request):
    """Render contracts management page"""
    return templates.TemplateResponse("contracts.html", {"request": request})
