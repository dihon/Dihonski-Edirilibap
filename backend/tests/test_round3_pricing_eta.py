"""
Round 3 backend tests:
- GET / POST /api/admin/config (admin only) persistence + public GET /api/config reflects
- POST /api/orders dynamic pabili fee (weight_kg + item_count)
- POST /api/rides dynamic ride fare from config + zone_distance stored
- GET /api/rides/{id} returns eta_minutes (zone-based)
- GET /api/orders/{id} returns eta_minutes (status-based)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/') + '/api'
UNIQUE = uuid.uuid4().hex[:8]

ADMIN_EMAIL = 'admin@tagkawayan.ph'
ADMIN_PASSWORD = 'admin12345'
SEED_DRIVER_PHONE = '+639171112201'
SEED_DRIVER_NAME = 'Mang Tonyo'


def auth(t):
    return {'Authorization': f'Bearer {t}'}


@pytest.fixture(scope='module')
def s():
    return requests.Session()


@pytest.fixture(scope='module')
def actors(s):
    a = {}
    r = s.post(f'{BASE_URL}/auth/login', json={'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    a['admin_t'] = r.json()['token']

    r = s.post(f'{BASE_URL}/auth/login', json={'phone': SEED_DRIVER_PHONE, 'name': SEED_DRIVER_NAME})
    assert r.status_code == 200, r.text
    a['driver_t'] = r.json()['token']

    email = f'TEST_r3_{UNIQUE}@x.com'
    r = s.post(f'{BASE_URL}/auth/signup', json={
        'name': f'TEST R3 Cust {UNIQUE}', 'email': email, 'password': 'pass12345'
    })
    assert r.status_code == 200, r.text
    a['cust_t'] = r.json()['token']
    return a


DEFAULT_TARGET_CFG = {
    'base_fare': 25.0,
    'per_zone': 12.0,
    'pabili_service_fee': 35.0,
    'pabili_per_kg': 5.0,
    'pabili_per_item': 3.0,
    'eta_base_min': 4,
    'eta_per_zone_min': 7,
}


# ---------------- Admin config ----------------
class TestAdminConfig:
    def test_public_config_open(self, s):
        r = s.get(f'{BASE_URL}/config')
        assert r.status_code == 200
        d = r.json()
        for k in DEFAULT_TARGET_CFG:
            assert k in d, f'missing key {k}'

    def test_admin_get_config_requires_admin(self, s, actors):
        r = s.get(f'{BASE_URL}/admin/config', headers=auth(actors['cust_t']))
        assert r.status_code == 403
        r = s.get(f'{BASE_URL}/admin/config')
        assert r.status_code == 401

    def test_admin_can_get_config(self, s, actors):
        r = s.get(f'{BASE_URL}/admin/config', headers=auth(actors['admin_t']))
        assert r.status_code == 200
        for k in DEFAULT_TARGET_CFG:
            assert k in r.json()

    def test_admin_update_persists_and_public_reflects(self, s, actors):
        # Set to defaults (test) — using round numbers so we can compute
        new_cfg = {
            'base_fare': 25.0,
            'per_zone': 12.0,
            'pabili_service_fee': 35.0,
            'pabili_per_kg': 6.0,   # bumped to detect dynamic
            'pabili_per_item': 3.0,
            'eta_base_min': 5,
            'eta_per_zone_min': 8,
        }
        r = s.post(f'{BASE_URL}/admin/config', json=new_cfg, headers=auth(actors['admin_t']))
        assert r.status_code == 200, r.text
        for k, v in new_cfg.items():
            assert r.json()[k] == v

        # Public GET reflects
        pub = s.get(f'{BASE_URL}/config').json()
        for k, v in new_cfg.items():
            assert pub[k] == v

        # Save updated values into fixture-visible dict via env
        actors['_cfg'] = new_cfg

    def test_admin_config_empty_body_422(self, s, actors):
        r = s.post(f'{BASE_URL}/admin/config', json={}, headers=auth(actors['admin_t']))
        assert r.status_code == 422

    def test_customer_cannot_update_config(self, s, actors):
        r = s.post(f'{BASE_URL}/admin/config', json={'base_fare': 100},
                   headers=auth(actors['cust_t']))
        assert r.status_code == 403


# ---------------- Dynamic pabili fee ----------------
class TestPabiliDynamicFee:
    def test_custom_order_with_weight_and_item_count(self, s, actors):
        # After test_admin_update_persists_and_public_reflects the cfg is:
        # pabili_service_fee=35, pabili_per_kg=6, pabili_per_item=3
        # weight=3kg items=4 -> fee = 35 + 6*3 + 3*4 = 35 + 18 + 12 = 65
        r = s.post(f'{BASE_URL}/orders', json={
            'kind': 'custom',
            'custom_list': 'TEST r3 3kg rice, sardines x4',
            'delivery_address': 'TEST Poblacion',
            'weight_kg': 3,
            'item_count': 4,
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d['weight_kg'] == 3
        assert d['item_count'] == 4
        assert d['service_fee'] == 65.0, f'expected 65 got {d["service_fee"]}'
        assert d['items_total'] == 0
        assert d['estimated_total'] == 65.0
        # persistence: GET back
        oid = d['id']
        g = s.get(f'{BASE_URL}/orders/{oid}', headers=auth(actors['cust_t']))
        assert g.status_code == 200
        assert g.json()['service_fee'] == 65.0
        assert g.json()['estimated_total'] == 65.0

    def test_preset_order_uses_qty_as_item_count(self, s, actors):
        stores = s.get(f'{BASE_URL}/stores').json()
        store = stores[0]
        it0 = store['items'][0]
        it1 = store['items'][1]
        # 2 + 1 = 3 items, no weight -> fee = 35 + 0 + 3*3 = 44
        payload = {
            'kind': 'preset',
            'store_id': store['id'],
            'store_name': store['name'],
            'items': [
                {'name': it0['name'], 'qty': 2, 'price': it0['price']},
                {'name': it1['name'], 'qty': 1, 'price': it1['price']},
            ],
            'delivery_address': 'TEST Preset R3',
            'weight_kg': 0,
        }
        r = s.post(f'{BASE_URL}/orders', json=payload, headers=auth(actors['cust_t']))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d['item_count'] == 3
        assert d['service_fee'] == round(35 + 3 * 3, 2)  # 44
        expected_items_total = round(it0['price'] * 2 + it1['price'] * 1, 2)
        assert d['items_total'] == expected_items_total
        assert d['estimated_total'] == round(expected_items_total + 44, 2)


# ---------------- Dynamic ride fare + zone_distance stored ----------------
class TestRideDynamicFare:
    def test_ride_stores_zone_distance_and_uses_cfg(self, s, actors):
        # base_fare=25, per_zone=12
        # Poblacion (Town Center) zone vs Camflora zone: we compute via /rides/estimate first
        est = s.post(f'{BASE_URL}/rides/estimate', json={
            'pickup': 'Poblacion (Town Center)', 'dropoff': 'Camflora'
        })
        assert est.status_code == 200
        expected_fare = est.json()['fare']

        r = s.post(f'{BASE_URL}/rides', json={
            'pickup': 'Poblacion (Town Center)', 'dropoff': 'Camflora',
            'passengers': 1, 'note': 'TEST R3 dyn fare'
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d['fare'] == expected_fare
        assert 'zone_distance' in d
        assert isinstance(d['zone_distance'], int)
        assert d['zone_distance'] >= 0
        # sanity: fare = base + per_zone * zd (min base)
        assert d['fare'] == max(25.0, round(25.0 + 12.0 * d['zone_distance'], 2))


# ---------------- ETA on rides and orders ----------------
class TestEta:
    def test_order_eta_by_status(self, s, actors):
        # create an order and check eta on GET
        r = s.post(f'{BASE_URL}/orders', json={
            'kind': 'custom', 'custom_list': 'TEST eta',
            'delivery_address': 'TEST', 'weight_kg': 0, 'item_count': 1,
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200
        oid = r.json()['id']
        g = s.get(f'{BASE_URL}/orders/{oid}', headers=auth(actors['cust_t']))
        assert g.status_code == 200
        assert g.json().get('eta_minutes') == 25  # requested → 25

    def test_ride_eta_present_and_positive(self, s, actors):
        r = s.post(f'{BASE_URL}/rides', json={
            'pickup': 'Poblacion (Town Center)', 'dropoff': 'Camflora',
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200
        rid = r.json()['id']
        g = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(actors['cust_t']))
        assert g.status_code == 200
        eta = g.json().get('eta_minutes')
        assert isinstance(eta, int)
        # After cfg update: eta_base=5, per_zone=8. requested → travel+5. zd>=1 → 5+8*zd + 5
        # We at least assert positive.
        assert eta > 0

    def test_ride_eta_changes_with_status(self, s, actors):
        # book a ride, driver online + accept + advance
        r = s.post(f'{BASE_URL}/rides', json={
            'pickup': 'Poblacion (Town Center)', 'dropoff': 'Camflora',
        }, headers=auth(actors['cust_t']))
        rid = r.json()['id']
        s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(actors['driver_t']))
        r = s.post(f'{BASE_URL}/rides/{rid}/accept', headers=auth(actors['driver_t']))
        assert r.status_code == 200
        after_accept = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(actors['driver_t'])).json()['eta_minutes']
        s.post(f'{BASE_URL}/rides/{rid}/status', json={'status': 'arriving'}, headers=auth(actors['driver_t']))
        after_arriving = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(actors['driver_t'])).json()['eta_minutes']
        s.post(f'{BASE_URL}/rides/{rid}/status', json={'status': 'in_progress'}, headers=auth(actors['driver_t']))
        after_prog = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(actors['driver_t'])).json()['eta_minutes']
        assert after_accept > 0
        # Should reduce as we progress
        assert after_arriving <= after_accept
        assert after_prog <= after_arriving
        # complete → 0
        s.post(f'{BASE_URL}/rides/{rid}/status', json={'status': 'completed'}, headers=auth(actors['driver_t']))
        completed_eta = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(actors['driver_t'])).json()['eta_minutes']
        assert completed_eta == 0


# ---------------- Admin list searches (backend supports q?) ----------------
class TestAdminUsersOrders:
    def test_users_list_ok(self, s, actors):
        r = s.get(f'{BASE_URL}/admin/users', headers=auth(actors['admin_t']))
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 3
        assert all('password' not in u for u in arr)

    def test_admin_orders_ok(self, s, actors):
        r = s.get(f'{BASE_URL}/admin/orders', headers=auth(actors['admin_t']))
        assert r.status_code == 200
        assert 'rides' in r.json() and 'orders' in r.json()
