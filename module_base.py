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
from typing import Dict, Any, List, Optional
from YOUR_ERP_core_framework import (
    BaseModule, Request, Response, ValidationError
)
from YOUR_ERP_orm import BaseModel, Column, ColumnType, EmailValidator, LengthValidator, AuditMixin


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
    
    is_active = Column(
        ColumnType.BOOLEAN,
        default=True,
        label="Active"
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
        
        self.register_route('/users', self.list_users, methods=['GET'], auth_required=True)
        self.register_route('/users/{id}', self.get_user, methods=['GET'], auth_required=True)
        self.register_route('/users', self.create_user, methods=['POST'], auth_required=True)
        self.register_route('/users/{id}', self.update_user, methods=['PUT'], auth_required=True)
        
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
        
        # Buscar usuario
        users = User.search([('email', '=', email)])
        if not users:
            return Response.unauthorized("Invalid credentials")
        
        user = users[0]
        
        # Verificar contraseña
        if not user.verify_password(password):
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
                "company_id": user.company_id,
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
        
        Request body:
        {
            "email": "newuser@example.com",
            "name": "New User",
            "password": "password123"
        }
        """
        email = request.get_data('email')
        name = request.get_data('name')
        password = request.get_data('password')
        
        # Validar datos
        if not all([email, name, password]):
            return Response.bad_request("Email, name and password required")
        
        if len(password) < 8:
            return Response.bad_request("Password must be at least 8 characters")
        
        # Verificar que no exista
        existing = User.search([('email', '=', email)])
        if existing:
            return Response.bad_request("Email already registered")
        
        try:
            # Crear usuario
            user = User.create({
                'email': email,
                'name': name,
                'company_id': request.company_id,
            })
            
            # Setear contraseña
            user.set_password(password)
            user.save()
            
            return Response.created({
                "message": "User created successfully",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                }
            })
        
        except ValidationError as e:
            return Response.bad_request(str(e))
    
    # ========================================================================
    # RUTAS DE USUARIOS
    # ========================================================================
    
    async def list_users(self, request: Request) -> Response:
        """Listar usuarios"""
        # Obtener parámetros
        limit = request.get_param('limit', 50)
        offset = request.get_param('offset', 0)
        
        # Buscar usuarios
        users = User.search([], limit=limit, offset=offset)
        
        return Response.ok({
            "count": len(users),
            "results": [
                {
                    "id": u.id,
                    "email": u.email,
                    "name": u.name,
                    "is_active": u.is_active,
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
            "company_id": user.company_id,
            "is_active": user.is_active,
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
