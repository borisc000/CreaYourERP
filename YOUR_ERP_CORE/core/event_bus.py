from datetime import datetime

class EventBus:
    """Bus de eventos para desacoplamiento de módulos"""

    _subscribers = {}
    _event_history = []

    @classmethod
    def subscribe(cls, event_name: str, callback):
        """Suscribir a un evento"""
        if event_name not in cls._subscribers:
            cls._subscribers[event_name] = []
        cls._subscribers[event_name].append(callback)
        print(f"[+] Subscriber registrado para: {event_name}")

    @classmethod
    def emit(cls, event_name: str, data: dict):
        """Emitir un evento"""
        cls._event_history.append({
            'event': event_name,
            'data': data,
            'timestamp': datetime.now()
        })

        for callback in cls._subscribers.get(event_name, []):
            try:
                callback(data)
            except Exception as e:
                print(f"[-] Error en callback de {event_name}: {e}")

    @classmethod
    def unsubscribe(cls, event_name: str, callback):
        """Desuscribir de un evento"""
        if event_name in cls._subscribers:
            cls._subscribers[event_name].remove(callback)

    @classmethod
    def get_history(cls):
        """Obtener historial de eventos"""
        return cls._event_history
