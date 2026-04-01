import pytest
from modules.hr.models.contract import Contract

def test_contract_creation():
    """Test crear contrato"""
    contract = Contract(
        employee_id=1,
        job_profile_id=5,
        start_date="2026-04-15",
        contract_type="Indefinido"
    )

    assert contract.employee_id == 1
    assert contract.workflow_state == "draft"

def test_contract_with_template():
    """Test contrato con plantilla"""
    contract = Contract(
        employee_id=1,
        template_id=10,
        personalization_data={
            'employee_name': 'Juan Pérez',
            'position': 'Andamiero',
            'salary': 1500000
        }
    )

    assert contract.template_id == 10
    assert contract.personalization_data['salary'] == 1500000

def test_contract_workflow_transitions():
    """Test transiciones de estado del contrato"""
    contract = Contract(employee_id=1)

    assert contract.workflow_state == "draft"

    contract.transition_to("submitted")
    assert contract.workflow_state == "submitted"

    contract.transition_to("approved")
    assert contract.workflow_state == "approved"

    contract.transition_to("pending_signature")
    assert contract.workflow_state == "pending_signature"
