from datetime import datetime

HIRING_WORKFLOW_STATES = {
    'draft': ['submitted'],
    'submitted': ['approved', 'rejected'],
    'approved': ['pending_signature'],
    'pending_signature': ['signed', 'rejected'],
    'rejected': ['draft'],
    'signed': []
}

class WorkflowEngine:
    """Motor de workflows para gestión de procesos"""

    def __init__(self, workflow_type: str):
        self.workflow_type = workflow_type
        self.current_state = 'draft'
        self.context = {}
        self.state_transitions = HIRING_WORKFLOW_STATES
        self.history = []
        self._record_transition('draft', 'initialized')

    def transition(self, new_state: str):
        """Transicionar a nuevo estado"""
        allowed_states = self.state_transitions.get(
            self.current_state, []
        )

        if new_state not in allowed_states:
            raise ValueError(
                f"Transición inválida: {self.current_state} → {new_state}. "
                f"Estados permitidos: {allowed_states}"
            )

        self._record_transition(self.current_state, new_state)
        self.current_state = new_state

    def _record_transition(self, from_state: str, to_state: str):
        """Registrar transición en historial"""
        self.history.append({
            'from': from_state,
            'to': to_state,
            'timestamp': datetime.now(),
            'context': self.context.copy()
        })

    def get_history(self):
        return self.history
