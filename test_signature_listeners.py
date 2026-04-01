"""
Test script for Signature Module Event Listeners
Tests the event chain: Contract → Correspondence → Signature
"""
import sys
sys.path.insert(0, 'YOUR_ERP_CORE')

from core.event_bus import EventBus
from modules.signature import listeners

print("\n" + "="*60)
print("Testing Signature Module Event Listeners")
print("="*60)

# Test 1: Emit correspondence_approved_for_signature event
print("\n[TEST 1] Emitting correspondence.approved_for_signature event...")
try:
    EventBus.emit('correspondence.approved_for_signature', {
        'correspondence_id': 100,
        'contract_id': 50,
        'template_id': 5,
        'personalization_data': {
            'employee_name': 'Juan',
            'position': 'Developer',
            'salary': 5000000
        }
    })
    print("[PASS] Event emitted successfully")
except Exception as e:
    print(f"[FAIL] Error emitting event: {e}")

# Test 2: Verify signature.request_created event is triggered
print("\n[TEST 2] Checking that signature.request_created event listener is registered...")
if 'signature.request_created' in EventBus._subscribers:
    print(f"[PASS] Event listener registered for signature.request_created")
    print(f"       Number of subscribers: {len(EventBus._subscribers['signature.request_created'])}")
else:
    print("[FAIL] Event listener not registered for signature.request_created")

# Test 3: Emit signature.completed event
print("\n[TEST 3] Emitting signature.completed event...")
try:
    EventBus.emit('signature.completed', {
        'contract_id': 50,
        'signature_request_id': 1
    })
    print("[PASS] Event emitted successfully")
except Exception as e:
    print(f"[FAIL] Error emitting event: {e}")

# Test 4: Emit signature.rejected event
print("\n[TEST 4] Emitting signature.rejected event...")
try:
    EventBus.emit('signature.rejected', {
        'contract_id': 50,
        'reason': 'Employee requested changes'
    })
    print("[PASS] Event emitted successfully")
except Exception as e:
    print(f"[FAIL] Error emitting event: {e}")

# Test 5: Verify all subscribers are registered
print("\n[TEST 5] Verifying all listener registrations...")
required_listeners = [
    'correspondence.approved_for_signature',
    'signature.completed',
    'signature.rejected',
    'signature.request_created'
]

for listener_name in required_listeners:
    if listener_name in EventBus._subscribers:
        print(f"[OK] Listener registered: {listener_name}")
    else:
        print(f"[FAIL] Listener NOT registered: {listener_name}")

print("\n" + "="*60)
print("Test Summary")
print("="*60)
print(f"Total events in history: {len(EventBus.get_history())}")
print("\nEvent History:")
for i, event in enumerate(EventBus.get_history(), 1):
    print(f"  {i}. {event['event']} - {event['timestamp']}")

print("\n[DONE] Signature Module listeners test completed")
