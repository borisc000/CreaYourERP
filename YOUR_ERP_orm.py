"""
ORM Personalizado - Reemplaza models.Model de Odoo
===================================================

Este ORM es:
- Agnóstico (funciona con cualquier BD: PostgreSQL, MySQL, SQLite)
- Type-safe con type hints completos
- Simple de usar (sin metaclasses ocultas)
- Basado en SQLAlchemy (ecosistema gigante de Python)

Ejemplo de uso:

    class SignatureRequest(BaseModel):
        __tablename__ = 'signature_request'
        
        name = Column(String(255), required=True)
        status = Column(String(50), default='draft')
        
        def before_create(self):
            self.access_token = generate_token()
    
    # CRUD
    record = SignatureRequest(name="Doc").create()
    record.status = 'signed'
    record.save()
    record.delete()
    
    # Búsquedas
    records = SignatureRequest.search([('status', '=', 'draft')])
    record = SignatureRequest.find_by_id(1)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Type, Tuple, Union
from datetime import datetime, date
from enum import Enum
import uuid
import hashlib
import json
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date,
    Text, JSON, ForeignKey, Index, UniqueConstraint,
    create_engine, inspect
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import logging
from YOUR_ERP_CORE.core.time_utils import utc_now

# ============================================================================
# 1. TIPOS DE COLUMNAS
# ============================================================================

class ColumnType(Enum):
    """Tipos de datos disponibles"""
    INTEGER = 'integer'
    STRING = 'string'
    TEXT = 'text'
    FLOAT = 'float'
    BOOLEAN = 'boolean'
    DATETIME = 'datetime'
    DATE = 'date'
    JSON = 'json'
    MANY2ONE = 'many2one'
    ONE2MANY = 'one2many'
    MANY2MANY = 'many2many'


@dataclass
class Column:
    """Definición de columna"""
    
    column_type: ColumnType = ColumnType.STRING
    required: bool = False
    unique: bool = False
    default: Any = None
    onupdate: Any = None
    index: bool = False
    primary_key: bool = False
    foreign_key: Optional[str] = None  # 'other_table.id'
    
    # Metadata
    label: str = ""
    help: str = ""
    readonly: bool = False
    
    def get_sqlalchemy_column(self, name: str):
        """Convertir a columna SQLAlchemy"""
        
        # Mapear tipos
        type_map = {
            ColumnType.INTEGER: Integer,
            ColumnType.STRING: String,
            ColumnType.TEXT: Text,
            ColumnType.FLOAT: Float,
            ColumnType.BOOLEAN: Boolean,
            ColumnType.DATETIME: DateTime,
            ColumnType.DATE: Date,
            ColumnType.JSON: JSON,
        }
        
        sa_type = type_map.get(self.column_type)
        if not sa_type:
            sa_type = String
        
        # Crear columna SQLAlchemy
        kwargs = {
            'primary_key': self.primary_key,
            'nullable': not self.required,
            'unique': self.unique,
            'default': self.default,
            'onupdate': self.onupdate,
            'index': self.index,
        }
        
        if self.foreign_key:
            kwargs['foreign_key'] = self.foreign_key
        
        return Column(name, sa_type(**({} if isinstance(sa_type, type) else {})), **kwargs)


# ============================================================================
# 2. VALIDADORES
# ============================================================================

class Validator(ABC):
    """Base para validadores"""
    
    @abstractmethod
    def validate(self, value: Any) -> Tuple[bool, str]:
        """Validar valor. Retorna (is_valid, error_message)"""
        pass

class RequiredValidator(Validator):
    """Validar campo requerido"""
    
    def validate(self, value: Any) -> Tuple[bool, str]:
        if value is None or value == '':
            return False, "This field is required"
        return True, ""

class EmailValidator(Validator):
    """Validar formato de email"""
    
    def validate(self, value: Any) -> Tuple[bool, str]:
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, str(value)):
            return False, "Invalid email format"
        return True, ""

class LengthValidator(Validator):
    """Validar longitud de string"""
    
    def __init__(self, min_length: int = 0, max_length: int = None):
        self.min_length = min_length
        self.max_length = max_length
    
    def validate(self, value: Any) -> Tuple[bool, str]:
        value_str = str(value)
        if len(value_str) < self.min_length:
            return False, f"Minimum length is {self.min_length}"
        if self.max_length and len(value_str) > self.max_length:
            return False, f"Maximum length is {self.max_length}"
        return True, ""

class RangeValidator(Validator):
    """Validar rango de números"""
    
    def __init__(self, min_value: float = None, max_value: float = None):
        self.min_value = min_value
        self.max_value = max_value
    
    def validate(self, value: Any) -> Tuple[bool, str]:
        if self.min_value is not None and value < self.min_value:
            return False, f"Minimum value is {self.min_value}"
        if self.max_value is not None and value > self.max_value:
            return False, f"Maximum value is {self.max_value}"
        return True, ""


# ============================================================================
# 3. TIMESTAMPS Y AUDITORÍA
# ============================================================================

class AuditMixin:
    """Mixin para auditoría automática"""
    
    created_at = Column(
        ColumnType.DATETIME,
        default=utc_now,
        readonly=True,
        label="Created At"
    )
    
    updated_at = Column(
        ColumnType.DATETIME,
        default=utc_now,
        onupdate=utc_now,
        readonly=True,
        label="Updated At"
    )
    
    created_by = Column(
        ColumnType.INTEGER,
        label="Created By"
    )
    
    updated_by = Column(
        ColumnType.INTEGER,
        label="Updated By"
    )


# ============================================================================
# 4. BASE MODEL - El corazón del ORM
# ============================================================================

@dataclass
class FieldDefinition:
    """Definición de campo"""
    name: str
    column: Column
    validators: List[Validator] = field(default_factory=list)


from abc import ABCMeta

class BaseModelMeta(ABCMeta):
    """Metaclass para BaseModel (mínima, sin magia oculta)"""
    
    def __new__(mcs, name, bases, namespace):
        # Extraer campos
        fields = {}
        for key, value in list(namespace.items()):
            if isinstance(value, Column):
                fields[key] = FieldDefinition(key, value)
                # Remover columnas del namespace (se agregarán después)
                del namespace[key]
        
        namespace['_fields'] = fields
        
        return super().__new__(mcs, name, bases, namespace)


class BaseModel(ABC, metaclass=BaseModelMeta):
    """
    Modelo base para todos los modelos de tu ERP.
    
    Reemplaza models.Model de Odoo de forma más limpia.
    
    Ejemplo:
        class User(BaseModel):
            __tablename__ = 'users'
            
            email = Column(ColumnType.STRING, required=True, unique=True)
            name = Column(ColumnType.STRING, required=True)
            is_active = Column(ColumnType.BOOLEAN, default=True)
            
            def validate_email(self):
                validator = EmailValidator()
                is_valid, error = validator.validate(self.email)
                if not is_valid:
                    raise ValidationError(error)
            
            def before_create(self):
                self.validate_email()
    """
    
    # Debe ser overrideado en subclases
    __tablename__: str = ""
    __displayname__ = "Name"  # Campo que se muestra por defecto
    __access_rules__ = {}     # Reglas de acceso
    
    _fields: Dict[str, FieldDefinition] = {}
    
    # Base de datos actual (se setea globalmente)
    _session = None
    
    def __init__(self, **kwargs):
        """Inicializar modelo con valores"""
        self._id = None
        self._data = {}
        self._original_data = {}
        self._dirty = False
        
        # Setear valores iniciales
        for field_name, value in kwargs.items():
            if field_name in self._fields:
                setattr(self, field_name, value)
                self._data[field_name] = value
    
    # ========================================================================
    # PROPIEDADES Y GETTERS/SETTERS
    # ========================================================================
    
    def __getattr__(self, name: str) -> Any:
        """Obtener valor de campo"""
        if name.startswith('_'):
            return object.__getattribute__(self, name)
        
        if name in self._data:
            return self._data[name]
        
        # Valor por defecto del campo
        if name in self._fields:
            field = self._fields[name]
            return field.column.default
        
        raise AttributeError(f"'{self.__class__.__name__}' has no attribute '{name}'")
    
    def __setattr__(self, name: str, value: Any):
        """Setear valor de campo"""
        if name.startswith('_'):
            object.__setattr__(self, name, value)
            return
        
        if name in self._fields:
            self._data[name] = value
            object.__setattr__(self, '_dirty', True)
        else:
            object.__setattr__(self, name, value)
    
    def __repr__(self) -> str:
        """Representación de string"""
        return f"<{self.__class__.__name__}({self._id})>"
    
    # ========================================================================
    # CRUD - CREATE, READ, UPDATE, DELETE
    # ========================================================================
    
    @classmethod
    def create(cls, values: Dict[str, Any]) -> "BaseModel":
        """
        Crear nuevo registro.
        
        Ejemplo:
            user = User.create({
                'email': 'test@example.com',
                'name': 'Test User'
            })
        """
        instance = cls(**values)
        
        # Hooks
        instance.before_create()
        instance.validate()
        
        # Guardar en BD
        instance.save()
        
        instance.after_create()
        
        return instance
    
    def save(self) -> bool:
        """
        Guardar cambios en BD.
        
        Si el registro es nuevo, inserta.
        Si ya existe, actualiza.
        """
        try:
            # Hooks
            self.before_save()
            
            if self._id is None:
                # INSERT
                self.before_insert()
                # Aquí iría el INSERT en BD real
                self.logger.debug(f"Inserted {self.__class__.__name__}")
                self.after_insert()
            else:
                # UPDATE
                self.before_update()
                # Aquí iría el UPDATE en BD real
                self.logger.debug(f"Updated {self.__class__.__name__} #{self._id}")
                self.after_update()
            
            self._dirty = False
            self.after_save()
            return True
        
        except Exception as e:
            self.logger.error(f"Error saving {self.__class__.__name__}: {str(e)}")
            return False
    
    def delete(self) -> bool:
        """
        Eliminar registro.
        
        Lanza validaciones y hooks.
        """
        try:
            # Hooks
            self.before_delete()
            self.validate_delete()
            
            # Eliminar de BD
            # Aquí iría el DELETE en BD real
            self.logger.debug(f"Deleted {self.__class__.__name__} #{self._id}")
            
            self.after_delete()
            return True
        
        except Exception as e:
            self.logger.error(f"Error deleting {self.__class__.__name__}: {str(e)}")
            return False
    
    @classmethod
    def find_by_id(cls, id: int) -> Optional["BaseModel"]:
        """Obtener por ID"""
        # Aquí iría la búsqueda en BD real
        return None
    
    @classmethod
    def search(cls, domain: List[Tuple] = None, limit: int = None,
               offset: int = 0, order_by: str = None) -> List["BaseModel"]:
        """
        Buscar registros.
        
        Domain format: [('field', 'operator', value)]
        Operators: =, !=, <, >, <=, >=, in, not in, like, ilike
        
        Ejemplo:
            users = User.search([
                ('is_active', '=', True),
                ('email', 'like', '%@example.com')
            ], limit=10)
        """
        # Aquí iría la búsqueda en BD real
        return []
    
    @classmethod
    def search_one(cls, domain: List[Tuple]) -> Optional["BaseModel"]:
        """Buscar y retornar el primer resultado"""
        results = cls.search(domain, limit=1)
        return results[0] if results else None
    
    @classmethod
    def count(cls, domain: List[Tuple] = None) -> int:
        """Contar registros"""
        # Aquí iría el COUNT en BD real
        return 0
    
    # ========================================================================
    # VALIDACIÓN
    # ========================================================================
    
    def validate(self):
        """
        Validar el modelo.
        Override en subclases para lógica personalizada.
        
        Ejemplo:
            def validate(self):
                super().validate()
                if self.start_date > self.end_date:
                    raise ValidationError("End date must be after start date")
        """
        errors = []
        
        # Validar campos requeridos y validadores
        for field_name, field_def in self._fields.items():
            value = self._data.get(field_name, field_def.column.default)
            
            # Validador de requerido
            if field_def.column.required and (value is None or value == ''):
                errors.append(f"{field_name}: This field is required")
            
            # Otros validadores
            for validator in field_def.validators:
                is_valid, error_msg = validator.validate(value)
                if not is_valid:
                    errors.append(f"{field_name}: {error_msg}")
        
        if errors:
            raise ValidationError("; ".join(errors))
    
    def validate_delete(self):
        """Validar que se pueda eliminar. Override en subclases."""
        pass
    
    # ========================================================================
    # HOOKS - Puntos de extensión
    # ========================================================================
    
    def before_create(self):
        """Hook: Antes de crear"""
        pass
    
    def after_create(self):
        """Hook: Después de crear"""
        pass
    
    def before_save(self):
        """Hook: Antes de guardar (ambos insert/update)"""
        pass
    
    def after_save(self):
        """Hook: Después de guardar"""
        pass
    
    def before_insert(self):
        """Hook: Antes de insertar"""
        pass
    
    def after_insert(self):
        """Hook: Después de insertar"""
        pass
    
    def before_update(self):
        """Hook: Antes de actualizar"""
        pass
    
    def after_update(self):
        """Hook: Después de actualizar"""
        pass
    
    def before_delete(self):
        """Hook: Antes de eliminar"""
        pass
    
    def after_delete(self):
        """Hook: Después de eliminar"""
        pass
    
    # ========================================================================
    # UTILIDADES
    # ========================================================================
    
    def to_dict(self) -> Dict[str, Any]:
        """Convertir modelo a diccionario"""
        return self._data.copy()
    
    def to_json(self) -> str:
        """Convertir modelo a JSON"""
        return json.dumps(self.to_dict(), default=str)
    
    def get_changes(self) -> Dict[str, Tuple[Any, Any]]:
        """Obtener cambios realizados (antes y después)"""
        changes = {}
        for field_name, current_value in self._data.items():
            original_value = self._original_data.get(field_name)
            if current_value != original_value:
                changes[field_name] = (original_value, current_value)
        return changes
    
    @property
    def logger(self) -> logging.Logger:
        """Logger del modelo"""
        return logging.getLogger(self.__class__.__name__)
    
    @property
    def id(self) -> Optional[int]:
        """Obtener ID del registro"""
        return self._id
    
    @property
    def display_name(self) -> str:
        """Nombre para mostrar del registro"""
        if hasattr(self, self.__displayname__):
            return str(getattr(self, self.__displayname__))
        return str(self._id)


# ============================================================================
# EXCEPCIONES
# ============================================================================

class ValidationError(Exception):
    """Error de validación"""
    pass

class ModelError(Exception):
    """Error de modelo"""
    pass
