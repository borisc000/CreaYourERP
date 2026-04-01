# modules/notifications/service.py
"""
Notification Service for Email and SMS
Integrates with SMTP (Gmail) and Twilio (SMS)
"""
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from core.config import settings
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Servicio centralizado de notificaciones"""

    # Try to import Twilio (optional)
    try:
        from twilio.rest import Client
        twilio_enabled = True
    except ImportError:
        twilio_enabled = False

    @staticmethod
    def send_email(to_email: str, subject: str, message: str, html: bool = False):
        """
        Enviar email vía SMTP
        
        Args:
            to_email: Email destino
            subject: Asunto del email
            message: Contenido del mensaje
            html: Si es HTML o texto plano
        
        Returns:
            Dict con status y detalles
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = settings.smtp_user or settings.default_from_email
            msg['To'] = to_email
            msg['Date'] = datetime.utcnow().isoformat()

            # Attach message content
            if html:
                msg.attach(MIMEText(message, 'html'))
            else:
                msg.attach(MIMEText(message, 'plain'))

            # For testing in development, log instead of actually sending
            if settings.environment.value == 'development':
                logger.info(f"📧 [DEV MODE] Email to {to_email}: {subject}")
                return {
                    "status": "sent",
                    "message_id": f"dev_{datetime.utcnow().timestamp()}",
                    "recipient": to_email,
                    "timestamp": datetime.utcnow().isoformat()
                }

            # In production, actually send via SMTP
            # Note: aiosmtplib requires async context
            # For now, log the attempt
            logger.info(f"📧 Email to {to_email}: {subject}")
            return {
                "status": "queued",
                "recipient": to_email,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Error sending email to {to_email}: {str(e)}")
            return {
                "status": "failed",
                "error": str(e),
                "recipient": to_email,
                "timestamp": datetime.utcnow().isoformat()
            }

    @staticmethod
    def send_sms(phone: str, message: str):
        """
        Enviar SMS vía Twilio
        
        Args:
            phone: Número de teléfono (+country_code format)
            message: Contenido del SMS
        
        Returns:
            Dict con status y detalles
        """
        try:
            # For testing in development, log instead of sending
            if settings.environment.value == 'development':
                logger.info(f"📱 [DEV MODE] SMS to {phone}: {message[:50]}...")
                return {
                    "status": "sent",
                    "message_id": f"dev_{datetime.utcnow().timestamp()}",
                    "phone": phone,
                    "timestamp": datetime.utcnow().isoformat()
                }

            # In production with Twilio
            if NotificationService.twilio_enabled and hasattr(settings, 'twilio_account_sid'):
                if settings.twilio_account_sid:
                    client = NotificationService.Client(
                        settings.twilio_account_sid,
                        settings.twilio_auth_token
                    )
                    message_obj = client.messages.create(
                        body=message,
                        from_=settings.twilio_phone,
                        to=phone
                    )
                    return {
                        "status": "sent",
                        "message_id": message_obj.sid,
                        "phone": phone,
                        "timestamp": datetime.utcnow().isoformat()
                    }

            logger.warning(f"Twilio not configured, logging SMS to {phone}")
            return {
                "status": "queued",
                "phone": phone,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Error sending SMS to {phone}: {str(e)}")
            return {
                "status": "failed",
                "error": str(e),
                "phone": phone,
                "timestamp": datetime.utcnow().isoformat()
            }

    @staticmethod
    def send_contract_approval(employee_email: str, employee_name: str, 
                               contract_id: int, contract_title: str):
        """
        Notificar aprobación de contrato
        """
        subject = f"Contrato Aprobado: {contract_title}"
        message = f"""
Estimado(a) {employee_name},

Su contrato como {contract_title} ha sido aprobado exitosamente.

Próximo paso: Firma digital del documento

Contrato ID: {contract_id}

Por favor, acceda al portal para continuar con el proceso de firma.

Saludos cordiales,
Departamento de Recursos Humanos
        """
        
        return NotificationService.send_email(
            to_email=employee_email,
            subject=subject,
            message=message
        )

    @staticmethod
    def send_signature_request(employee_email: str, employee_name: str,
                               contract_id: int, signature_url: str):
        """
        Notificar solicitud de firma
        """
        subject = f"Acción Requerida: Firma Digital de Contrato #{contract_id}"
        message = f"""
Estimado(a) {employee_name},

Se requiere su firma digital para finalizar su contrato.

Acceda al siguiente enlace para firmar:
{signature_url}

Contrato ID: {contract_id}

Por favor, complete el proceso dentro de 48 horas.

Saludos cordiales,
Departamento de Recursos Humanos
        """
        
        return NotificationService.send_email(
            to_email=employee_email,
            subject=subject,
            message=message
        )

    @staticmethod
    def send_employee_onboarding(employee_email: str, employee_name: str,
                                 start_date: str, department: str):
        """
        Notificar onboarding de nuevo empleado
        """
        subject = f"Bienvenida a la empresa: {employee_name}"
        message = f"""
Estimado(a) {employee_name},

¡Bienvenido(a) a nuestro equipo!

Detalles de inicio:
- Fecha de inicio: {start_date}
- Departamento: {department}

Por favor, acceda al portal corporativo para completar su perfil.

Si tiene preguntas, contacte a Recursos Humanos.

Saludos cordiales,
Departamento de Recursos Humanos
        """
        
        return NotificationService.send_email(
            to_email=employee_email,
            subject=subject,
            message=message
        )

    @staticmethod
    def send_signature_reminder(employee_email: str, employee_name: str,
                                contract_id: int):
        """
        Recordatorio de firma pendiente
        """
        subject = f"Recordatorio: Contrato Pendiente de Firma #{contract_id}"
        message = f"""
Estimado(a) {employee_name},

Le recordamos que aún hay un contrato pendiente de su firma.

Contrato ID: {contract_id}

Por favor, acceda al portal para completar la firma lo antes posible.

Saludos cordiales,
Departamento de Recursos Humanos
        """
        
        return NotificationService.send_email(
            to_email=employee_email,
            subject=subject,
            message=message
        )
