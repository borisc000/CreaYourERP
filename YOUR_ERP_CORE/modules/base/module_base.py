"""
MÓDULO BASE - Sistema de Usuarios y Empresas
==============================================

Este módulo proporciona:
- Modelo de usuarios
- Modelo de empresas
- Modelo de grupos
- Rutas básicas de autenticación

Es la base sobre la que se construyen otros módulos.
"""

import asyncio
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from core.YOUR_ERP_core_framework import (
    BaseModule, Request, Response, ValidationError
)
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, EmailValidator, LengthValidator, AuditMixin


# ============================================================================
# MODELOS
# ============================================================================

class Company(BaseModel, AuditMixin):
    """Modelo de empresa"""
    
    __tablename__ = 'companies'
    __displayname__ = 'name'
    
    # Campos
    name = Column(
        ColumnType.STRING,
        required=True,
        label="Company Name"
    )
    
    email = Column(
        ColumnType.STRING,
        required=True,
        unique=True,
        label="Email",
    )
    
    phone = Column(
        ColumnType.STRING,
        label="Phone"
    )
    
    address = Column(
        ColumnType.TEXT,
        label="Address"
    )
    
    # Datos fiscales / legales
    legal_name = Column(
        ColumnType.STRING,
        label="Legal Name"
    )

    tax_id = Column(
        ColumnType.STRING,
        label="Tax ID / RUT"
    )

    logo_url = Column(
        ColumnType.STRING,
        label="Logo URL"
    )

    # ── Datos Bancarios ──
    bank_name = Column(
        ColumnType.STRING,
        label="Bank Name"
    )
    account_type = Column(
        ColumnType.STRING,
        label="Account Type"
    )
    account_number = Column(
        ColumnType.STRING,
        label="Account Number"
    )

    # ── Términos y Condiciones por defecto para cotizaciones ──
    default_terms = Column(
        ColumnType.TEXT,
        label="Términos y Condiciones por Defecto"
    )

    is_active = Column(
        ColumnType.BOOLEAN,
        default=True,
        label="Active"
    )

    # ── Secuencia de Proyectos (PRJ-XXXX) ──
    current_project_seq = Column(
        ColumnType.INTEGER,
        default=5000,
        label="Secuencia Actual de Proyectos"
    )

    def validate(self):
        """Validar empresa"""
        super().validate()
        
        # Email válido
        validator = EmailValidator()
        is_valid, error = validator.validate(self.email)
        if not is_valid:
            raise ValidationError(f"Email: {error}")


class Group(BaseModel, AuditMixin):
    """Grupos de usuarios (roles)"""
    
    __tablename__ = 'groups'
    __displayname__ = 'name'
    
    name = Column(
        ColumnType.STRING,
        required=True,
        unique=True,
        label="Group Name"
    )
    
    description = Column(
        ColumnType.TEXT,
        label="Description"
    )
    
    # Permisos (JSON)
    permissions = Column(
        ColumnType.JSON,
        default={},
        label="Permissions"
    )


class User(BaseModel, AuditMixin):
    """Modelo de usuario"""
    
    __tablename__ = 'users'
    __displayname__ = 'name'
    
    # Información básica
    email = Column(
        ColumnType.STRING,
        required=True,
        unique=True,
        label="Email"
    )
    
    name = Column(
        ColumnType.STRING,
        required=True,
        label="Full Name"
    )
    
    phone = Column(
        ColumnType.STRING,
        label="Phone"
    )
    
    # Credenciales
    password_hash = Column(
        ColumnType.STRING,
        required=True,
        readonly=True,
        label="Password Hash"
    )
    
    # Estado
    is_active = Column(
        ColumnType.BOOLEAN,
        default=True,
        label="Active"
    )

    is_admin = Column(
        ColumnType.BOOLEAN,
        default=False,
        label="Administrator"
    )

    # Rol estructurado RBAC
    # Valores: superadmin | company_admin | employee
    role = Column(
        ColumnType.STRING,
        default='company_admin',
        label="Role"
    )

    allowed_modules = Column(
        ColumnType.JSON,
        default=[],
        label="Allowed Modules"
    )
    
    # Relaciones
    company_id = Column(
        ColumnType.INTEGER,
        required=True,
        label="Company"
    )
    
    group_ids = Column(
        ColumnType.JSON,
        default=[],
        label="Groups"
    )
    
    # Configuración
    language = Column(
        ColumnType.STRING,
        default='es_ES',
        label="Language"
    )
    
    timezone = Column(
        ColumnType.STRING,
        default='UTC',
        label="Timezone"
    )
    
    # Tokens de sesión
    auth_token = Column(
        ColumnType.STRING,
        label="Auth Token"
    )

    # Recuperación de contraseña
    reset_token = Column(
        ColumnType.STRING,
        label="Password Reset Token"
    )

    reset_token_expires = Column(
        ColumnType.DATETIME,
        label="Reset Token Expires"
    )
    
    def before_create(self):
        """Antes de crear usuario"""
        # Validar email
        validator = EmailValidator()
        is_valid, error = validator.validate(self.email)
        if not is_valid:
            raise ValidationError(f"Email: {error}")
    
    def set_password(self, password: str):
        """
        Setear contraseña.
        
        Genera hash seguro con salt.
        """
        # Generar salt
        salt = secrets.token_hex(32)
        
        # Hash PBKDF2
        password_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000  # iteraciones
        )
        
        # Guardar salt + hash
        self.password_hash = f"{salt}${password_hash.hex()}"
    
    def verify_password(self, password: str) -> bool:
        """Verificar contraseña"""
        try:
            salt, stored_hash = self.password_hash.split('$')
            
            password_hash = hashlib.pbkdf2_hmac(
                'sha256',
                password.encode('utf-8'),
                salt.encode('utf-8'),
                100000
            )
            
            return password_hash.hex() == stored_hash
        except:
            return False
    
    def generate_auth_token(self) -> str:
        """Generar token de autenticación"""
        self.auth_token = secrets.token_urlsafe(32)
        return self.auth_token
    
    def validate(self):
        """Validar usuario"""
        super().validate()
        
        # Email válido
        validator = EmailValidator()
        is_valid, error = validator.validate(self.email)
        if not is_valid:
            raise ValidationError(f"Email: {error}")
        
        # Nombre mínimo 3 caracteres
        name_validator = LengthValidator(min_length=3)
        is_valid, error = name_validator.validate(self.name)
        if not is_valid:
            raise ValidationError(f"Name: {error}")


# ============================================================================
# MÓDULO BASE
# ============================================================================

class BaseModule(BaseModule):
    """
    Módulo BASE - Proporciona funcionalidad fundamental.
    
    Modelos:
    - Company (empresas)
    - Group (grupos/roles)
    - User (usuarios)
    
    Rutas:
    - POST /auth/login
    - POST /auth/logout
    - POST /auth/register
    - GET /users
    - GET /users/{id}
    - POST /users
    - PUT /users/{id}
    """
    
    # Metadata del módulo
    name = "Base"
    version = "1.0.0"
    author = "Your Company"
    description = "Base functionality: users, companies, groups"
    depends = []
    
    def init_module(self):
        """Inicializar módulo base"""
        # Registrar modelos
        self.register_model('company', Company)
        self.register_model('group', Group)
        self.register_model('user', User)
        
        # Registrar rutas
        self.register_route('/auth/login', self.login, methods=['POST'], auth_required=False)
        self.register_route('/auth/logout', self.logout, methods=['POST'], auth_required=True)
        self.register_route('/auth/register', self.register, methods=['POST'], auth_required=False)
        self.register_route('/auth/forgot-password', self.forgot_password, methods=['POST'], auth_required=False)
        self.register_route('/auth/reset-password', self.reset_password, methods=['POST'], auth_required=False)
        
        # IMPORTANTE: rutas específicas ANTES que las rutas con parámetros {id}
        self.register_route('/users/me', self.get_me, methods=['GET'], auth_required=True)
        self.register_route('/users/me', self.update_me, methods=['PUT'], auth_required=True)
        self.register_route('/users/me/password', self.change_password, methods=['PUT'], auth_required=True)
        self.register_route('/users/employees', self.add_employee, methods=['POST'], auth_required=True)

        self.register_route('/users', self.list_users, methods=['GET'], auth_required=True)
        self.register_route('/users', self.create_user, methods=['POST'], auth_required=True)
        self.register_route('/users/{id}', self.get_user, methods=['GET'], auth_required=True)
        self.register_route('/users/{id}', self.update_user, methods=['PUT'], auth_required=True)

        self.register_route('/company/settings', self.get_company_settings, methods=['GET'], auth_required=True)
        self.register_route('/company/settings', self.update_company_settings, methods=['PUT'], auth_required=True)

        self.logger.info("Base module initialized")
    
    # ========================================================================
    # RUTAS DE AUTENTICACIÓN
    # ========================================================================
    
    async def login(self, request: Request) -> Response:
        """
        Login de usuario.
        
        Request body:
        {
            "email": "user@example.com",
            "password": "password123"
        }
        
        Response:
        {
            "token": "...",
            "user": {...}
        }
        """
        email = request.get_data('email')
        password = request.get_data('password')

        if not email or not password:
            return Response.bad_request("Email and password required")

        # DEBUG
        import logging
        logger = logging.getLogger('auth')
        logger.info(f"LOGIN attempt: {email}, users={len(User._store)}")

        # Buscar usuario
        users = User.search([('email', '=', email)])
        logger.info(f"Search result: {len(users)} users")

        if not users:
            all_emails = [u.email for u in User._store.values()]
            logger.info(f"Available users: {all_emails}")
            return Response.unauthorized("Invalid credentials")

        user = users[0]
        logger.info(f"Found user, hash={'YES' if user.password_hash else 'NO'}")

        # Verificar contraseña
        verify_result = user.verify_password(password)
        logger.info(f"Password check: {verify_result}")

        if not verify_result:
            return Response.unauthorized("Invalid credentials")
        
        # Verificar que esté activo
        if not user.is_active:
            return Response.forbidden("User is not active")
        
        # Generar token
        token = user.generate_auth_token()
        user.save()
        
        return Response.ok({
            "token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role or 'employee',
                "company_id": user.company_id,
                "is_admin": user.is_admin,
                "allowed_modules": user.allowed_modules or [],
            }
        })
    
    async def logout(self, request: Request) -> Response:
        """Logout de usuario"""
        # Invalidar token
        user = self.env.user
        if user:
            user.auth_token = None
            user.save()
        
        return Response.ok({"message": "Logged out successfully"})
    
    async def register(self, request: Request) -> Response:
        """
        Registrar nuevo usuario.
        Crea automáticamente una nueva empresa y asigna al usuario como company_admin.

        Request body:
        {
            "email": "newuser@example.com",
            "name": "New User",
            "password": "password123",
            "company_name": "Mi Empresa S.A."   (opcional)
        }
        """
        email = request.get_data('email')
        name = request.get_data('name')
        password = request.get_data('password')
        company_name = request.get_data('company_name') or f"{name}'s Company"

        # Validar datos
        if not all([email, name, password]):
            return Response.bad_request("Email, name and password required")

        if len(password) < 8:
            return Response.bad_request("Password must be at least 8 characters")

        # Verificar que el email no esté registrado como usuario
        existing = User.search([('email', '=', email)])
        if existing:
            return Response.bad_request("Email already registered")

        try:
            # 1. Crear empresa para este tenant
            company = Company.create({
                'name': company_name,
                'email': email,
            })

            # 1b. Crear etapas CRM por defecto para la nueva empresa
            try:
                from modules.crm.module_crm import seed_default_stages
                seed_default_stages(company.id)
            except Exception as _seed_err:
                self.logger.warning(f"CRM stage seeding skipped: {_seed_err}")

            try:
                from modules.hr.module_hr import seed_default_departments
                seed_default_departments(company.id)
            except Exception as _seed_err:
                self.logger.warning(f"HR department seeding skipped: {_seed_err}")

            try:
                from modules.recruitment.module_recruitment import seed_default_recruitment_stages
                seed_default_recruitment_stages(company.id)
            except Exception as _seed_err:
                self.logger.warning(f"Recruitment stage seeding skipped: {_seed_err}")

            # 2. Hashear password
            temp_user = User()
            temp_user.set_password(password)

            # 3. Crear usuario como company_admin de la nueva empresa
            # Set default all-access
            user = User.create({
                'email': email,
                'name': name,
                'company_id': company.id,
                'password_hash': temp_user.password_hash,
                'role': 'company_admin',
                'is_admin': True,
                'allowed_modules': ["crm", "operations", "finance", "settings", "users", "recruitment", "hr", "inventory"]
            })

            # 4. Auto-login: generar token directamente
            token = user.generate_auth_token()
            user.save()

            return Response.created({
                "token": token,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "role": user.role,
                    "company_id": user.company_id,
                    "is_admin": user.is_admin,
                    "allowed_modules": user.allowed_modules or [],
                }
            })

        except ValidationError as e:
            return Response.bad_request(str(e))
    
    # ========================================================================
    # RUTAS DE USUARIOS
    # ========================================================================
    
    async def list_users(self, request: Request) -> Response:
        """Listar usuarios — aislado por empresa (superadmin ve todos)"""
        current_user = self.env.user
        if not current_user:
            return Response.unauthorized("Authentication required")

        # Solo company_admin y superadmin pueden listar usuarios
        if current_user.role == 'employee':
            return Response.forbidden("Insufficient permissions to list users")

        limit = request.get_param('limit', 50)
        offset = request.get_param('offset', 0)

        # Superadmin ve todos; el resto solo su empresa
        if current_user.role == 'superadmin':
            users = User.search([], limit=limit, offset=offset)
        else:
            users = User.search(
                [('company_id', '=', current_user.company_id)],
                limit=limit, offset=offset
            )

        return Response.ok({
            "count": len(users),
            "results": [
                {
                    "id": u.id,
                    "email": u.email,
                    "name": u.name,
                    "role": u.role or 'employee',
                    "company_id": u.company_id,
                    "is_active": u.is_active,
                    "allowed_modules": u.allowed_modules or [],
                }
                for u in users
            ]
        })
    
    async def get_user(self, request: Request) -> Response:
        """Obtener usuario por ID"""
        user_id = request.params.get('id')
        
        user = User.find_by_id(int(user_id))
        if not user:
            return Response.not_found("User not found")
        
        return Response.ok({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "phone": user.phone,
            "role": user.role or 'employee',
            "company_id": user.company_id,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "allowed_modules": user.allowed_modules or [],
            "language": user.language,
            "timezone": user.timezone,
        })
    
    async def create_user(self, request: Request) -> Response:
        """Crear nuevo usuario (por admin)"""
        # Validar que sea admin
        if not self.env.user or not self.env.user.is_admin:
            return Response.forbidden("Only admins can create users")
        
        try:
            # Crear usuario
            user = User.create({
                'email': request.get_data('email'),
                'name': request.get_data('name'),
                'phone': request.get_data('phone'),
                'company_id': request.company_id,
                'language': request.get_data('language', 'es_ES'),
                'timezone': request.get_data('timezone', 'UTC'),
            })
            
            # Setear contraseña
            password = request.get_data('password')
            if password:
                user.set_password(password)
            
            user.save()
            
            return Response.created({
                "id": user.id,
                "email": user.email,
                "name": user.name,
            })
        
        except ValidationError as e:
            return Response.bad_request(str(e))
    
    async def update_user(self, request: Request) -> Response:
        """Actualizar usuario"""
        user_id = request.params.get('id')
        
        # Obtener usuario
        user = User.find_by_id(int(user_id))
        if not user:
            return Response.not_found("User not found")
        
        # Verificar permisos (solo admin o el mismo usuario)
        if not self.env.user or (self.env.user.id != user.id and not self.env.user.is_admin):
            return Response.forbidden("Cannot update this user")
        
        try:
            # Actualizar campos
            data = request.data
            updateable_fields = ['name', 'phone', 'language', 'timezone']
            
            for field in updateable_fields:
                if field in data:
                    setattr(user, field, data[field])
            
            # Solo admins pueden cambiar el rol y módulos de otros (y de si mismos)
            if self.env.user.is_admin or self.env.user.role in ('superadmin', 'company_admin'):
                if 'role' in data:
                    user.role = data['role']
                    # Sincronizar flag obsoleto por compatibilidad
                    if data['role'] == 'company_admin' or data['role'] == 'superadmin':
                        user.is_admin = True
                    else:
                        user.is_admin = False
                if 'allowed_modules' in data:
                    user.allowed_modules = data['allowed_modules']
            
            # Cambiar contraseña si se solicita
            if 'password' in data and data['password']:
                user.set_password(data['password'])
            
            user.save()
            
            return Response.ok({
                "message": "User updated successfully",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                }
            })

        except ValidationError as e:
            return Response.bad_request(str(e))

    # ========================================================================
    # GESTIÓN DE EMPLEADOS (dentro de la misma empresa)
    # ========================================================================

    async def add_employee(self, request: Request) -> Response:
        """
        Crear un empleado dentro de la empresa del administrador.
        NO crea una empresa nueva — hereda el company_id del solicitante.
        Solo company_admin y superadmin pueden usar este endpoint.

        Request body: { "name": "Juan Pérez", "email": "juan@empresa.com" }
        """
        current_user = self.env.user
        if not current_user:
            return Response.unauthorized("Authentication required")

        if current_user.role not in ('company_admin', 'superadmin'):
            return Response.forbidden("Only admins can add employees")

        name  = request.get_data('name')
        email = request.get_data('email')
        role  = request.get_data('role', 'employee')
        allowed_modules = request.get_data('allowed_modules', [])

        if not name or not email:
            return Response.bad_request("Name and email are required")

        if User.search([('email', '=', email)]):
            return Response.bad_request("Email already registered")

        try:
            temp_password = 'temp1234'
            temp_user = User()
            temp_user.set_password(temp_password)
            
            # Security explicit map
            is_admin = True if role == 'company_admin' else False

            employee = User.create({
                'email': email,
                'name': name,
                'company_id': current_user.company_id,
                'password_hash': temp_user.password_hash,
                'role': role,
                'is_admin': is_admin,
                'allowed_modules': allowed_modules
            })

            return Response.created({
                "id": employee.id,
                "name": employee.name,
                "email": employee.email,
                "role": employee.role,
                "allowed_modules": employee.allowed_modules,
                "company_id": employee.company_id,
                "temp_password": temp_password,
                "message": f"Employee created. Temporary password: {temp_password}",
            })

        except ValidationError as e:
            return Response.bad_request(str(e))

    # ========================================================================
    # SETTINGS DE EMPRESA
    # ========================================================================

    async def get_company_settings(self, request: Request) -> Response:
        """Obtener configuración de la empresa del usuario activo."""
        current_user = self.env.user
        if not current_user:
            return Response.unauthorized("Authentication required")

        company = Company.find_by_id(current_user.company_id)
        if not company:
            return Response.not_found("Company not found")

        return Response.ok({
            "id": company.id,
            "name": company.name,
            "legal_name": company.legal_name or '',
            "email": company.email,
            "phone": company.phone or '',
            "address": company.address or '',
            "tax_id": company.tax_id or '',
            "logo_url": company.logo_url or '',
            "bank_name": company.bank_name or '',
            "account_type": company.account_type or '',
            "account_number": company.account_number or '',
            "default_terms": company.default_terms or '',
        })

    async def update_company_settings(self, request: Request) -> Response:
        """
        Actualizar configuración de la empresa del usuario activo.
        Solo company_admin y superadmin pueden hacerlo.
        """
        current_user = self.env.user
        if not current_user:
            return Response.unauthorized("Authentication required")

        if current_user.role not in ('company_admin', 'superadmin'):
            return Response.forbidden("Only admins can update company settings")

        company = Company.find_by_id(current_user.company_id)
        if not company:
            return Response.not_found("Company not found")

        updatable = ['name', 'legal_name', 'phone', 'address', 'tax_id', 'logo_url', 'bank_name', 'account_type', 'account_number', 'default_terms']
        data = request.data or {}
        for field in updatable:
            if field in data:
                setattr(company, field, data[field])

        try:
            company.save()
            return Response.ok({
                "message": "Company settings updated",
                "company": {
                    "id": company.id,
                    "name": company.name,
                    "legal_name": company.legal_name or '',
                    "email": company.email,
                    "phone": company.phone or '',
                    "address": company.address or '',
                    "tax_id": company.tax_id or '',
                    "logo_url": company.logo_url or '',
                    "bank_name": company.bank_name or '',
                    "account_type": company.account_type or '',
                    "account_number": company.account_number or '',
                    "default_terms": company.default_terms or '',
                }
            })
        except ValidationError as e:
            return Response.bad_request(str(e))

    # ========================================================================
    # MI PERFIL — /users/me
    # ========================================================================

    async def get_me(self, request: Request) -> Response:
        """Devuelve el perfil del usuario autenticado."""
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        return Response.ok({
            "id":         user.id,
            "name":       user.name,
            "email":      user.email,
            "phone":      user.phone or '',
            "role":       user.role or 'employee',
            "company_id": user.company_id,
            "language":   user.language,
            "timezone":   user.timezone,
            "is_admin":   user.is_admin,
            "allowed_modules": user.allowed_modules or [],
        })

    async def update_me(self, request: Request) -> Response:
        """Actualizar nombre y teléfono del usuario autenticado."""
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")

        data = request.data or {}
        if 'name' in data and data['name']:
            user.name = data['name']
        if 'phone' in data:
            user.phone = data['phone']

        try:
            user.save()
            return Response.ok({
                "message": "Profile updated",
                "user": {
                    "id":    user.id,
                    "name":  user.name,
                    "email": user.email,
                    "phone": user.phone or '',
                    "role":  user.role,
                    "allowed_modules": user.allowed_modules or [],
                }
            })
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def change_password(self, request: Request) -> Response:
        """
        Cambiar contraseña del usuario autenticado.
        Body: { "current_password": "...", "new_password": "...", "confirm_password": "..." }
        """
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")

        current  = request.get_data('current_password')
        new_pass = request.get_data('new_password')
        confirm  = request.get_data('confirm_password')

        if not all([current, new_pass, confirm]):
            return Response.bad_request("All password fields are required")
        if new_pass != confirm:
            return Response.bad_request("New passwords do not match")
        if len(new_pass) < 8:
            return Response.bad_request("Password must be at least 8 characters")
        if not user.verify_password(current):
            return Response.bad_request("Current password is incorrect")

        user.set_password(new_pass)
        user.save()
        return Response.ok({"message": "Password changed successfully"})

    # ========================================================================
    # RECUPERACIÓN DE CONTRASEÑA
    # ========================================================================

    async def forgot_password(self, request: Request) -> Response:
        """
        Genera token de reset e imprime en consola (simulación de email para dev).
        Body: { "email": "user@example.com" }
        """
        email = request.get_data('email')
        if not email:
            return Response.bad_request("Email is required")

        users = User.search([('email', '=', email)])
        if not users:
            return Response.ok({"message": "If that email exists, a reset link was sent"})

        user    = users[0]
        token   = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=1)

        user.reset_token         = token
        user.reset_token_expires = expires
        user.save()

        reset_url = f"http://localhost:8000/app/reset-password?token={token}"
        self.logger.info("=" * 60)
        self.logger.info("  PASSWORD RESET LINK (dev mode - no email sent)")
        self.logger.info(f"  User   : {user.email}")
        self.logger.info(f"  Link   : {reset_url}")
        self.logger.info(f"  Expires: {expires.strftime('%Y-%m-%d %H:%M UTC')}")
        self.logger.info("=" * 60)

        return Response.ok({
            "message": "If that email exists, a reset link was sent",
            "_dev_token": token,
            "_dev_link":  reset_url,
        })

    async def reset_password(self, request: Request) -> Response:
        """
        Valida el token y establece la nueva contraseña.
        Body: { "token": "...", "new_password": "...", "confirm_password": "..." }
        """
        token    = request.get_data('token')
        new_pass = request.get_data('new_password')
        confirm  = request.get_data('confirm_password')

        if not all([token, new_pass, confirm]):
            return Response.bad_request("All fields are required")
        if new_pass != confirm:
            return Response.bad_request("Passwords do not match")
        if len(new_pass) < 8:
            return Response.bad_request("Password must be at least 8 characters")

        users = User.search([('reset_token', '=', token)])
        if not users:
            return Response.bad_request("Invalid or expired reset token")

        user = users[0]
        if not user.reset_token_expires or datetime.utcnow() > user.reset_token_expires:
            user.reset_token = None
            user.reset_token_expires = None
            user.save()
            return Response.bad_request("Reset token has expired. Please request a new one.")

        user.set_password(new_pass)
        user.reset_token         = None
        user.reset_token_expires = None
        user.save()
        return Response.ok({"message": "Password reset successfully. You can now log in."})
