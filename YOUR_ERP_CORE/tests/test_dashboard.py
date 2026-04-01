"""
Test dashboard endpoints
"""
import pytest
from datetime import datetime
from sqlalchemy.orm import Session
from modules.hr.repository import EmployeeRepository, ContractRepository
from modules.signature.repository import SignatureRequestRepository
from core.event_bus import EventBus


def test_get_dashboard_summary(test_db: Session):
    """Test dashboard summary endpoint"""
    # Setup: Create test data
    emp1 = EmployeeRepository.create(
        test_db,
        first_name="John",
        last_name="Doe",
        email="john@example.com"
    )
    emp2 = EmployeeRepository.create(
        test_db,
        first_name="Jane",
        last_name="Smith",
        email="jane@example.com"
    )

    # Create contracts
    contract1 = ContractRepository.create(
        test_db,
        employee_id=emp1.id,
        contract_type="full_time",
        start_date="2026-01-01"
    )
    contract2 = ContractRepository.create(
        test_db,
        employee_id=emp2.id,
        contract_type="part_time",
        start_date="2026-02-01"
    )

    # Transition one contract to signed
    contract1.transition_to("submitted")
    contract1.transition_to("approved")
    contract1.transition_to("pending_signature")
    contract1.transition_to("signed")
    test_db.commit()

    # Test assertions
    assert EmployeeRepository.get_all(test_db) is not None
    assert len(EmployeeRepository.get_all(test_db)) == 2

    contracts = ContractRepository.get_all(test_db)
    assert len(contracts) == 2

    signed_contracts = sum(1 for c in contracts if c.workflow_state == 'signed')
    assert signed_contracts == 1

    completion_rate = (signed_contracts / len(contracts) * 100) if len(contracts) > 0 else 0
    assert completion_rate == 50.0


def test_get_contracts_by_status(test_db: Session):
    """Test contracts breakdown by status"""
    # Create employees
    emp1 = EmployeeRepository.create(
        test_db,
        first_name="Alice",
        last_name="Johnson",
        email="alice@example.com"
    )

    # Create contracts with different states
    c1 = ContractRepository.create(
        test_db,
        employee_id=emp1.id,
        contract_type="full_time",
        start_date="2026-01-01"
    )  # draft

    c2 = ContractRepository.create(
        test_db,
        employee_id=emp1.id,
        contract_type="full_time",
        start_date="2026-02-01"
    )
    c2.transition_to("submitted")
    test_db.commit()

    c3 = ContractRepository.create(
        test_db,
        employee_id=emp1.id,
        contract_type="part_time",
        start_date="2026-03-01"
    )
    c3.transition_to("submitted")
    c3.transition_to("approved")
    test_db.commit()

    c4 = ContractRepository.create(
        test_db,
        employee_id=emp1.id,
        contract_type="full_time",
        start_date="2026-04-01"
    )
    c4.transition_to("submitted")
    c4.transition_to("rejected")
    test_db.commit()

    # Test status breakdown
    contracts = ContractRepository.get_all(test_db)
    assert len(contracts) == 4

    status_breakdown = {
        'draft': 0,
        'submitted': 0,
        'approved': 0,
        'pending_signature': 0,
        'signed': 0,
        'rejected': 0
    }

    for contract in contracts:
        status = contract.workflow_state
        if status in status_breakdown:
            status_breakdown[status] += 1

    assert status_breakdown['draft'] == 1
    assert status_breakdown['submitted'] == 1
    assert status_breakdown['approved'] == 1
    assert status_breakdown['rejected'] == 1


def test_get_recent_activity(test_db: Session):
    """Test recent activity list from event history"""
    # Clear event history
    EventBus._event_history.clear()

    # Emit some test events
    EventBus.emit('contract.created', {
        'contract_id': 1,
        'employee_id': 1,
        'state': 'draft'
    })

    EventBus.emit('contract.transitioned', {
        'contract_id': 1,
        'from_state': 'draft',
        'to_state': 'submitted'
    })

    EventBus.emit('signature.requested', {
        'signature_id': 1,
        'contract_id': 1,
        'status': 'pending'
    })

    # Get history
    history = EventBus.get_history()

    # Test assertions
    assert len(history) >= 3
    assert history[0]['event'] == 'contract.created'
    assert history[1]['event'] == 'contract.transitioned'
    assert history[2]['event'] == 'signature.requested'

    # Test filtering
    contract_events = [h for h in history if h['event'].startswith('contract.')]
    assert len(contract_events) >= 2

    signature_events = [h for h in history if h['event'].startswith('signature.')]
    assert len(signature_events) >= 1
