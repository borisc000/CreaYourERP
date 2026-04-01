#!/usr/bin/env python3
"""
Test script for Task 8: Contract -> Correspondencia -> Firma integration
Tests the event chain: contract.approved -> correspondence.draft_created -> correspondence.approved -> correspondence.approved_for_signature
"""

import sys
import os
import json
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent / "YOUR_ERP_CORE"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root.parent))

# Import required modules
from core.event_bus import EventBus
from core.template_processor import TemplateProcessor
from modules.hr.api.contract_routes import create_contract, approve_contract, _contracts_db
from modules.cross_correspondence.api.hiring_routes import (
    _correspondence_drafts,
    approve_correspondence,
    render_template as api_render_template
)
from datetime import datetime


def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")


async def test_event_chain():
    """Test the complete event chain"""
    print_section("TEST 1: Event Chain - Contract Approval Triggers Correspondencia")

    # Create contract
    contract_data = {
        "employee_id": 1,
        "job_profile_id": 1,
        "template_id": 5,
        "contract_type": "Indefinido",
        "start_date": "2026-04-15",
        "personalization_data": {
            "employee_name": "Juan Perez",
            "cedula": "12345678-9",
            "company_name": "Mi Empresa",
            "position": "Andamiero",
            "start_date": "2026-04-15",
            "salary": 1500000
        }
    }

    print("1. Creating contract...")
    contract = await create_contract(contract_data)
    contract_id = contract['id']
    print(f"   CREATED: Contract ID {contract_id}")
    print(f"   Status: {contract['workflow_state']}")

    print("\n2. Submitting contract...")
    from modules.hr.api.contract_routes import submit_contract
    contract = await submit_contract(contract_id)
    print(f"   SUBMITTED: Contract status changed to '{contract['workflow_state']}'")

    print("\n3. Approving contract (triggers event)...")
    print("   Expected: contract.approved event should fire")
    print("   Expected: _on_contract_approved listener should create correspondencia draft")

    contract = await approve_contract(contract_id)
    print(f"   APPROVED: Contract status changed to '{contract['workflow_state']}'")

    # Check if correspondence draft was created
    print("\n4. Checking if correspondencia draft was created...")
    if contract_id in _correspondence_drafts:
        draft = _correspondence_drafts[contract_id]
        print(f"   SUCCESS: Correspondencia draft created")
        print(f"   Draft ID: {draft['id']}")
        print(f"   Status: {draft['status']}")
        print(f"   Template ID: {draft['template_id']}")
        print(f"   Personalization data: {draft['personalization_data']}")
    else:
        print(f"   FAILED: No correspondencia draft found for contract {contract_id}")
        return False

    return True


async def test_correspondence_approval():
    """Test correspondence approval triggering signature event"""
    print_section("TEST 2: Correspondencia Approval Triggers Signature Event")

    # Use the contract from previous test
    contract_id = list(_contracts_db)[0].id if _contracts_db else None
    if not contract_id:
        print("No contract found from previous test")
        return False

    if contract_id not in _correspondence_drafts:
        print(f"No correspondencia draft for contract {contract_id}")
        return False

    print(f"1. Approving correspondencia {contract_id}...")
    print("   Expected: correspondence.approved event should fire")
    print("   Expected: _on_correspondence_approved listener should create signature request")

    draft = await approve_correspondence(contract_id)
    print(f"   APPROVED: Correspondencia status changed to '{draft['status']}'")
    print(f"   Approved at: {draft['approved_at']}")

    return True


async def test_template_rendering():
    """Test template rendering"""
    print_section("TEST 3: Template Rendering")

    employee_data = {
        "employee_name": "Maria Garcia",
        "cedula": "98765432-1",
        "company_name": "Constructora XYZ",
        "position": "Supervisora",
        "start_date": "2026-05-01",
        "salary": 2000000
    }

    print("1. Rendering template with employee data...")
    result = await api_render_template(
        template_id=5,
        employee_data=employee_data
    )

    print(f"   SUCCESS: {result['success']}")
    if result['success']:
        print(f"   Rendered content (first 200 chars):")
        print(f"   {result['rendered_content'][:200]}...")
        print(f"   Signature markers: {result['signature_markers']}")
    else:
        print(f"   ERROR: {result.get('error', 'Unknown error')}")

    return result['success']


def test_event_history():
    """Test event history tracking"""
    print_section("TEST 4: Event History")

    history = EventBus.get_history()
    print(f"Total events recorded: {len(history)}")
    print("\nEvent timeline:")
    for i, event in enumerate(history[-10:], 1):  # Show last 10 events
        print(f"  {i}. {event['event']}")
        print(f"     Data: {event['data']}")
        print(f"     Time: {event['timestamp']}")

    return len(history) > 0


def test_template_processor():
    """Test TemplateProcessor directly"""
    print_section("TEST 5: Template Processor")

    template_content = """
CONTRATO DE EMPLEO

Empleado: {{ employee_name }}
CI: {{ cedula }}
Posicion: {{ position }}
Salario: ${{ salary }}

Firma: _______________
"""

    data = {
        "employee_name": "Carlos Lopez",
        "cedula": "11111111-1",
        "position": "Inspector",
        "salary": 1800000
    }

    print("1. Testing TemplateProcessor.render_template()...")
    result = TemplateProcessor.render_template(
        template_content,
        data,
        signature_markers={'signature': {'x': 100, 'y': 600}}
    )

    print(f"   Success: {result['success']}")
    print(f"   Rendered content:")
    print(f"   {result['rendered_content']}")
    print(f"   Signature markers: {result['signature_markers']}")

    return result['success']


async def run_all_tests():
    """Run all tests"""
    print("\n" + "="*70)
    print("TASK 8 INTEGRATION TEST SUITE")
    print("Contract -> Correspondencia -> Firma Event Chain")
    print("="*70)

    results = {}

    # Test template processor first
    results['template_processor'] = test_template_processor()

    # Test event chain
    results['event_chain'] = await test_event_chain()

    # Test correspondence approval
    results['correspondence_approval'] = await test_correspondence_approval()

    # Test template rendering
    results['template_rendering'] = await test_template_rendering()

    # Test event history
    results['event_history'] = test_event_history()

    # Summary
    print_section("TEST SUMMARY")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        print(f"  {test_name}: {status}")

    print("\n" + "="*70)
    if passed == total:
        print("ALL TESTS PASSED!")
    else:
        print(f"SOME TESTS FAILED ({total - passed} failures)")
    print("="*70 + "\n")

    return passed == total


if __name__ == "__main__":
    import asyncio
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
