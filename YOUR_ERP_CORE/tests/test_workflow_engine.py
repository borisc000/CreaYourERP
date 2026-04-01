import pytest
from core.workflow_engine import WorkflowEngine

def test_workflow_transitions():
    """Test transiciones de workflow"""
    workflow = WorkflowEngine('hiring')
    assert workflow.current_state == 'draft'

    workflow.transition('submitted')
    assert workflow.current_state == 'submitted'

    workflow.transition('approved')
    assert workflow.current_state == 'approved'

def test_workflow_invalid_transition():
    """Test que transición inválida falla"""
    workflow = WorkflowEngine('hiring')

    with pytest.raises(ValueError):
        workflow.transition('invalid_state')

def test_workflow_context():
    """Test que workflow guarda contexto"""
    workflow = WorkflowEngine('hiring')
    workflow.context = {
        'employee_id': 1,
        'contract_id': 5,
        'template_id': 3
    }
    assert workflow.context['employee_id'] == 1
