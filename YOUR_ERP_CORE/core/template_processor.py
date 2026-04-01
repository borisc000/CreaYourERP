"""
Template Processor - Personalización de plantillas con datos
"""
from jinja2 import Template, TemplateSyntaxError
from typing import Dict, Optional

class TemplateProcessor:
    """Procesa y personaliza plantillas con datos"""

    @staticmethod
    def render_template(
        template_content: str,
        data: Dict,
        signature_markers: Optional[Dict] = None
    ) -> Dict:
        """Renderizar plantilla con datos"""
        try:
            template = Template(template_content)
            rendered = template.render(**data)

            return {
                'success': True,
                'rendered_content': rendered,
                'signature_markers': signature_markers or {},
                'personalization_data': data
            }
        except TemplateSyntaxError as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def create_draft_document(
        employee_data: Dict,
        template_id: int,
        signature_positions: Dict
    ) -> Dict:
        """Crear borrador de documento personalizado"""
        return {
            'document_id': None,
            'template_id': template_id,
            'employee_data': employee_data,
            'signature_positions': signature_positions,
            'status': 'draft',
            'created_at': None
        }
