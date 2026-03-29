import sys
import asyncio

sys.path.append('C:/Users/PC/Desktop/nuevo erp/YOUR_ERP_CORE')
sys.path.append('C:/Users/PC/Desktop/nuevo erp')

from YOUR_ERP_core_framework import CoreFramework, Request

config = {
    'database_url': 'sqlite:///C:/Users/PC/Desktop/nuevo erp/your_erp.db',
    'debug': True,
    'modules_to_load': ['base', 'crm', 'quotes']
}

fw = CoreFramework(config)
fw.initialize()

async def run():
    # TEST 1: The problematic Phase 2.4 export endpoint
    req1 = Request(
        path="/quotes/2/export-data", 
        method="GET", 
        params={}, data={}, files={}, headers={}, remote_addr="", user_agent=""
    )
    req1.user_id = 1  # emulate auth
    
    res1 = await fw.dispatch_request(req1)
    print("\n[TEST 1] /quotes/2/export-data:")
    print("STATUS:", res1.status)
    if res1.errors: print("ERRORS:", res1.errors)
    
    # TEST 2: Existing Endpoint that theoretically "works"
    req2 = Request(
        path="/quotes/2", 
        method="GET", 
        params={}, data={}, files={}, headers={}, remote_addr="", user_agent=""
    )
    req2.user_id = 1
    
    res2 = await fw.dispatch_request(req2)
    print("\n[TEST 2] /quotes/2:")
    print("STATUS:", res2.status)
    if res2.errors: print("ERRORS:", res2.errors)

asyncio.run(run())
