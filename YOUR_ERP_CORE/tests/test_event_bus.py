# tests/test_event_bus.py
import pytest
from core.event_bus import EventBus

def test_event_bus_subscribe_and_emit():
    """Test que el bus emite eventos a subscribers"""
    events_received = []

    def listener(event_data):
        events_received.append(event_data)

    EventBus.subscribe('employee.hired', listener)
    EventBus.emit('employee.hired', {'employee_id': 1, 'name': 'Juan'})

    assert len(events_received) == 1
    assert events_received[0]['employee_id'] == 1

def test_event_bus_multiple_listeners():
    """Test múltiples listeners para mismo evento"""
    results = []

    def listener1(data):
        results.append(('listener1', data))

    def listener2(data):
        results.append(('listener2', data))

    EventBus.subscribe('contract.created', listener1)
    EventBus.subscribe('contract.created', listener2)
    EventBus.emit('contract.created', {'contract_id': 5})

    assert len(results) == 2
