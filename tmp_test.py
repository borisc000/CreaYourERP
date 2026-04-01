import httpx
import asyncio

async def run_smoke_test():
    async with httpx.AsyncClient() as client:
        # 1. Login
        res = await client.post('http://localhost:8000/auth/login', json={'email': 'admin@test.com', 'password': 'admin'})
        if res.status_code != 200:
            print(f"Login failed: {res.text}")
            return
        token = res.json().get('data', {}).get('token')
        headers = {'Authorization': f'Bearer {token}'}

        # 2. Create customer
        payload = {'name': 'Test B2B Corp', 'tax_id': '111', 'address': '123 Test Ave'}
        res = await client.post('http://localhost:8000/crm/customers', json=payload, headers=headers)
        if res.status_code != 201:
            print(f"Customer creation failed: {res.text}")
            return
        
        c = res.json().get('data')
        print(f"Customer created: {c['name']} (ID: {c['id']})")
        c_id = c['id']

        # 3. Create mandante
        m_payload = {'name': 'John Doe', 'position': 'CEO', 'email': 'john@test.com', 'phone': '123'}
        res = await client.post(f'http://localhost:8000/crm/customers/{c_id}/mandantes', json=m_payload, headers=headers)
        if res.status_code != 201:
            print(f"Mandante creation failed: {res.text}")
            return
        
        m = res.json().get('data')
        print(f"Mandante created: {m['name']} (ID: {m['id']}) for Customer ID: {m['customer_id']}")

if __name__ == "__main__":
    asyncio.run(run_smoke_test())
