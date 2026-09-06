"""
Backend integration tests for Tagkawayan Ride & Pabili MVP.
Covers: auth, catalog, ride full loop, pabili order loop, driver, admin.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://pabili-rides.preview.emergentagent.com').rstrip('/') + '/api'
UNIQUE = uuid.uuid4().hex[:8]

ADMIN_EMAIL = 'admin@tagkawayan.ph'
ADMIN_PASSWORD = 'admin12345'
DRIVER_NAME = 'Mang Tonyo'
DRIVER_PHONE = '+639171112201'


@pytest.fixture(scope='session')
def s():
    return requests.Session()


@pytest.fixture(scope='session')
def tokens(s):
    """Login/create tokens used across tests."""
    out = {}
    # admin login
    r = s.post(f'{BASE_URL}/auth/login', json={'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f'admin login failed: {r.status_code} {r.text}'
    out['admin'] = r.json()['token']
    out['admin_user'] = r.json()['user']

    # driver login (phone + name)
    r = s.post(f'{BASE_URL}/auth/login', json={'phone': DRIVER_PHONE, 'name': DRIVER_NAME}, timeout=15)
    assert r.status_code == 200, f'driver login failed: {r.status_code} {r.text}'
    out['driver'] = r.json()['token']
    out['driver_user'] = r.json()['user']

    # customer signup (email+password)
    email = f'TEST_cust_{UNIQUE}@example.com'
    r = s.post(f'{BASE_URL}/auth/signup', json={
        'name': f'TEST Customer {UNIQUE}',
        'email': email,
        'password': 'pass12345',
    }, timeout=15)
    assert r.status_code == 200, f'customer signup failed: {r.status_code} {r.text}'
    out['customer'] = r.json()['token']
    out['customer_user'] = r.json()['user']
    out['customer_email'] = email
    return out


def auth(token):
    return {'Authorization': f'Bearer {token}'}


# ---------- Auth ----------
class TestAuth:
    def test_signup_phone(self, s):
        phone = f'+639{int(time.time()) % 1000000000:09d}'
        r = s.post(f'{BASE_URL}/auth/signup', json={'name': f'TEST Phone {UNIQUE}', 'phone': phone})
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'token' in data
        assert data['user']['role'] == 'customer'
        assert data['user']['phone'] == phone

    def test_signup_missing_creds(self, s):
        r = s.post(f'{BASE_URL}/auth/signup', json={'name': 'NoCreds'})
        assert r.status_code == 422

    def test_signup_short_password(self, s):
        r = s.post(f'{BASE_URL}/auth/signup', json={'name': 'Short', 'email': f'TEST_sp_{UNIQUE}@x.com', 'password': '123'})
        assert r.status_code == 422

    def test_signup_duplicate_email(self, s, tokens):
        r = s.post(f'{BASE_URL}/auth/signup', json={'name': 'Dup', 'email': tokens['customer_email'], 'password': 'pass12345'})
        assert r.status_code == 409

    def test_login_bad_password(self, s):
        r = s.post(f'{BASE_URL}/auth/login', json={'email': ADMIN_EMAIL, 'password': 'wrong'})
        assert r.status_code == 401

    def test_login_bad_phone_name(self, s):
        r = s.post(f'{BASE_URL}/auth/login', json={'phone': '+639000000000', 'name': 'Nobody'})
        assert r.status_code == 401

    def test_me(self, s, tokens):
        r = s.get(f'{BASE_URL}/auth/me', headers=auth(tokens['customer']))
        assert r.status_code == 200
        assert r.json()['role'] == 'customer'

    def test_me_no_token(self, s):
        r = s.get(f'{BASE_URL}/auth/me')
        assert r.status_code == 401


# ---------- Catalog ----------
class TestCatalog:
    def test_landmarks(self, s):
        r = s.get(f'{BASE_URL}/landmarks')
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 10
        assert all('name' in x and 'zone' in x for x in arr)

    def test_stores(self, s):
        r = s.get(f'{BASE_URL}/stores')
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 3
        assert 'items' in arr[0] and len(arr[0]['items']) > 0

    def test_store_by_id(self, s):
        stores = s.get(f'{BASE_URL}/stores').json()
        r = s.get(f'{BASE_URL}/stores/{stores[0]["id"]}')
        assert r.status_code == 200
        assert r.json()['id'] == stores[0]['id']

    def test_store_404(self, s):
        r = s.get(f'{BASE_URL}/stores/nope')
        assert r.status_code == 404

    def test_estimate(self, s):
        r = s.post(f'{BASE_URL}/rides/estimate', json={'pickup': 'Poblacion (Town Center)', 'dropoff': 'Camflora'})
        assert r.status_code == 200
        assert r.json()['fare'] > 0


# ---------- Ride full flow ----------
class TestRideFlow:
    def test_ride_end_to_end(self, s, tokens):
        # Customer creates a ride
        r = s.post(f'{BASE_URL}/rides', json={
            'pickup': 'Poblacion (Town Center)', 'dropoff': 'Camflora', 'passengers': 2, 'note': 'TEST ride'
        }, headers=auth(tokens['customer']))
        assert r.status_code == 200, r.text
        ride = r.json()
        rid = ride['id']
        assert ride['status'] == 'requested'
        assert ride['fare'] > 0
        assert ride['payment'] == 'cash'

        # my rides shows it
        r = s.get(f'{BASE_URL}/rides/my', headers=auth(tokens['customer']))
        assert any(x['id'] == rid for x in r.json())

        # Driver online, sees request
        r = s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(tokens['driver']))
        assert r.status_code == 200 and r.json()['online'] is True

        r = s.get(f'{BASE_URL}/driver/requests', headers=auth(tokens['driver']))
        assert r.status_code == 200
        body = r.json()
        assert body['online'] is True
        assert any(x['id'] == rid for x in body['rides'])

        # Driver accepts
        r = s.post(f'{BASE_URL}/rides/{rid}/accept', headers=auth(tokens['driver']))
        assert r.status_code == 200

        # verify accepted state
        r = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(tokens['customer']))
        assert r.status_code == 200
        assert r.json()['status'] == 'accepted'
        assert r.json()['driver_id'] == tokens['driver_user']['id']

        # Cannot re-accept
        r = s.post(f'{BASE_URL}/rides/{rid}/accept', headers=auth(tokens['driver']))
        assert r.status_code == 409

        # Advance through statuses
        for st in ['arriving', 'in_progress', 'completed']:
            r = s.post(f'{BASE_URL}/rides/{rid}/status', json={'status': st}, headers=auth(tokens['driver']))
            assert r.status_code == 200, f'status {st}: {r.text}'

        r = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(tokens['customer']))
        assert r.json()['status'] == 'completed'

    def test_customer_can_cancel_ride(self, s, tokens):
        r = s.post(f'{BASE_URL}/rides', json={'pickup': 'Poblacion (Town Center)', 'dropoff': 'Bagong Silang'},
                   headers=auth(tokens['customer']))
        rid = r.json()['id']
        r = s.post(f'{BASE_URL}/rides/{rid}/status', json={'status': 'cancelled'}, headers=auth(tokens['customer']))
        assert r.status_code == 200

    def test_customer_cannot_advance_ride(self, s, tokens):
        r = s.post(f'{BASE_URL}/rides', json={'pickup': 'Poblacion (Town Center)', 'dropoff': 'Bagong Silang'},
                   headers=auth(tokens['customer']))
        rid = r.json()['id']
        r = s.post(f'{BASE_URL}/rides/{rid}/status', json={'status': 'in_progress'}, headers=auth(tokens['customer']))
        assert r.status_code == 403


# ---------- Pabili order flow ----------
class TestOrderFlow:
    def test_preset_order_flow(self, s, tokens):
        store = s.get(f'{BASE_URL}/stores').json()[0]
        items = [{'name': store['items'][0]['name'], 'qty': 2, 'price': store['items'][0]['price']},
                 {'name': store['items'][1]['name'], 'qty': 1, 'price': store['items'][1]['price']}]
        r = s.post(f'{BASE_URL}/orders', json={
            'kind': 'preset', 'store_id': store['id'], 'store_name': store['name'],
            'items': items, 'delivery_address': 'TEST Poblacion',
        }, headers=auth(tokens['customer']))
        assert r.status_code == 200, r.text
        order = r.json()
        oid = order['id']
        expected_total = round(items[0]['price'] * 2 + items[1]['price'] * 1, 2)
        assert order['items_total'] == expected_total
        # service_fee is now dynamic: base 35 + per_item(3) * derived item_count (sum of qtys = 3)
        item_count = sum(i['qty'] for i in items)
        expected_fee = round(35.0 + 3.0 * item_count, 2)
        assert order['service_fee'] == expected_fee
        assert order['estimated_total'] == round(expected_total + expected_fee, 2)
        assert order['status'] == 'requested'

        # Driver accept + advance
        s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(tokens['driver']))
        r = s.post(f'{BASE_URL}/orders/{oid}/accept', headers=auth(tokens['driver']))
        assert r.status_code == 200
        for st in ['shopping', 'delivering', 'completed']:
            r = s.post(f'{BASE_URL}/orders/{oid}/status', json={'status': st}, headers=auth(tokens['driver']))
            assert r.status_code == 200, f'{st}: {r.text}'
        r = s.get(f'{BASE_URL}/orders/{oid}', headers=auth(tokens['customer']))
        assert r.json()['status'] == 'completed'

    def test_custom_order(self, s, tokens):
        r = s.post(f'{BASE_URL}/orders', json={
            'kind': 'custom', 'custom_list': '1kg rice, 3 sardines',
            'delivery_address': 'TEST Aliji', 'note': 'call when arriving',
        }, headers=auth(tokens['customer']))
        assert r.status_code == 200
        assert r.json()['kind'] == 'custom'
        assert r.json()['items_total'] == 0
        assert r.json()['estimated_total'] == 35.0


# ---------- Driver ----------
class TestDriver:
    def test_offline_no_requests(self, s, tokens):
        s.post(f'{BASE_URL}/driver/status', json={'online': False}, headers=auth(tokens['driver']))
        r = s.get(f'{BASE_URL}/driver/requests', headers=auth(tokens['driver']))
        assert r.status_code == 200
        assert r.json()['online'] is False
        assert r.json()['rides'] == [] and r.json()['orders'] == []

    def test_customer_cannot_call_driver_endpoints(self, s, tokens):
        r = s.get(f'{BASE_URL}/driver/requests', headers=auth(tokens['customer']))
        assert r.status_code == 403

    def test_driver_active_history(self, s, tokens):
        r = s.get(f'{BASE_URL}/driver/active', headers=auth(tokens['driver']))
        assert r.status_code == 200
        assert 'rides' in r.json() and 'orders' in r.json()
        r = s.get(f'{BASE_URL}/driver/history', headers=auth(tokens['driver']))
        assert r.status_code == 200


# ---------- Admin ----------
class TestAdmin:
    def test_stats(self, s, tokens):
        r = s.get(f'{BASE_URL}/admin/stats', headers=auth(tokens['admin']))
        assert r.status_code == 200
        d = r.json()
        for k in ['users', 'drivers', 'customers', 'rides', 'orders', 'online_drivers']:
            assert k in d

    def test_users_list(self, s, tokens):
        r = s.get(f'{BASE_URL}/admin/users', headers=auth(tokens['admin']))
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 3
        # Verify passwords are not leaked
        assert all('password' not in u for u in arr)

    def test_customer_cannot_call_admin(self, s, tokens):
        r = s.get(f'{BASE_URL}/admin/stats', headers=auth(tokens['customer']))
        assert r.status_code == 403

    def test_change_role(self, s, tokens):
        # Create a fresh customer, make them a driver via admin
        email = f'TEST_role_{UNIQUE}@x.com'
        rr = s.post(f'{BASE_URL}/auth/signup', json={'name': f'TEST Role {UNIQUE}', 'email': email, 'password': 'pass12345'})
        uid = rr.json()['user']['id']
        r = s.post(f'{BASE_URL}/admin/users/{uid}/role', json={'role': 'driver', 'tricycle_no': 'TRK-999'},
                   headers=auth(tokens['admin']))
        assert r.status_code == 200
        users = s.get(f'{BASE_URL}/admin/users', headers=auth(tokens['admin'])).json()
        found = next((u for u in users if u['id'] == uid), None)
        assert found and found['role'] == 'driver' and found['tricycle_no'] == 'TRK-999'

    def test_admin_orders(self, s, tokens):
        r = s.get(f'{BASE_URL}/admin/orders', headers=auth(tokens['admin']))
        assert r.status_code == 200
        assert 'rides' in r.json() and 'orders' in r.json()
