"""
Round 4 backend tests:
- GET /api/admin/payouts (all-time + with date_from/date_to) requires admin, groups per driver
  with ride_earnings/pabili_earnings/total, plus a totals block
- Trusted-driver config keys (trusted_min_ratings, trusted_min_avg) exist in /api/config and
  are updatable via POST /api/admin/config (persisted, admin-only)
- General DB-switch regression: signup email+password, signup phone+name, login both ways,
  /auth/me, ride full lifecycle w/ fare + eta_minutes, pabili full lifecycle w/ dynamic
  service_fee + eta_minutes, rating updates driver rating_avg/rating_count
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/') + '/api'
UNIQUE = uuid.uuid4().hex[:8]

ADMIN_EMAIL = 'admin@tagkawayan.ph'
ADMIN_PASSWORD = 'admin12345'
DRIVER_PHONE = '+639171112201'
DRIVER_NAME = 'Mang Tonyo'


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

    r = s.post(f'{BASE_URL}/auth/login', json={'phone': DRIVER_PHONE, 'name': DRIVER_NAME})
    assert r.status_code == 200, r.text
    a['driver_t'] = r.json()['token']
    a['driver_u'] = r.json()['user']

    email = f'TEST_r4_{UNIQUE}@x.com'
    r = s.post(f'{BASE_URL}/auth/signup', json={
        'name': f'TEST R4 Cust {UNIQUE}', 'email': email, 'password': 'pass12345'
    })
    assert r.status_code == 200, r.text
    a['cust_t'] = r.json()['token']
    a['cust_email'] = email
    return a


# --------- DB-switch regression: auth ---------
class TestAuthRegression:
    def test_signup_email_password_then_login(self, s):
        email = f'TEST_r4auth_{UNIQUE}@x.com'
        r = s.post(f'{BASE_URL}/auth/signup', json={
            'name': f'TEST auth {UNIQUE}', 'email': email, 'password': 'pass12345'
        })
        assert r.status_code == 200, r.text
        r = s.post(f'{BASE_URL}/auth/login', json={'email': email, 'password': 'pass12345'})
        assert r.status_code == 200
        tok = r.json()['token']

        r = s.get(f'{BASE_URL}/auth/me', headers=auth(tok))
        assert r.status_code == 200
        me = r.json()
        assert me['email'] == email.lower()
        assert me['role'] == 'customer'

    def test_signup_phone_name_then_login(self, s):
        phone = f'+63917{uuid.uuid4().int % 10_000_000:07d}'
        name = f'TEST PN {UNIQUE}'
        r = s.post(f'{BASE_URL}/auth/signup', json={'name': name, 'phone': phone})
        assert r.status_code == 200, r.text

        r = s.post(f'{BASE_URL}/auth/login', json={'phone': phone, 'name': name})
        assert r.status_code == 200
        r = s.get(f'{BASE_URL}/auth/me', headers=auth(r.json()['token']))
        assert r.status_code == 200 and r.json()['phone'] == phone

    def test_wrong_password_401(self, s, actors):
        r = s.post(f'{BASE_URL}/auth/login', json={'email': actors['cust_email'], 'password': 'wrong'})
        assert r.status_code == 401


# --------- DB-switch regression: full ride + rating ---------
class TestRideLifecycle:
    def test_ride_lifecycle_and_rating(self, s, actors):
        r = s.post(f'{BASE_URL}/rides', json={
            'pickup': 'Poblacion (Town Center)', 'dropoff': 'Camflora',
            'passengers': 1, 'note': 'TEST r4', 'payment_method': 'cash',
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200, r.text
        ride = r.json()
        rid = ride['id']
        assert ride['fare'] > 0
        assert ride['status'] == 'requested'

        # eta_minutes present on GET
        r = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(actors['cust_t']))
        assert r.status_code == 200
        assert 'eta_minutes' in r.json()

        # driver online + accept
        s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(actors['driver_t']))
        # visible in driver requests
        r = s.get(f'{BASE_URL}/driver/requests', headers=auth(actors['driver_t']))
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, dict) and 'rides' in body
        assert any(x['id'] == rid for x in body['rides'])

        r = s.post(f'{BASE_URL}/rides/{rid}/accept', headers=auth(actors['driver_t']))
        assert r.status_code == 200
        for st in ['arriving', 'in_progress', 'completed']:
            r = s.post(f'{BASE_URL}/rides/{rid}/status', json={'status': st}, headers=auth(actors['driver_t']))
            assert r.status_code == 200, f'{st}: {r.text}'
        r = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(actors['cust_t']))
        assert r.json()['status'] == 'completed'

        # rating updates driver rating (python-computed)
        before_me = s.get(f'{BASE_URL}/auth/me', headers=auth(actors['driver_t'])).json()
        prev_count = before_me.get('rating_count', 0)
        r = s.post(f'{BASE_URL}/ratings', json={
            'job_id': rid, 'job_type': 'ride', 'stars': 5, 'comment': 'ok'
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200
        after_me = s.get(f'{BASE_URL}/auth/me', headers=auth(actors['driver_t'])).json()
        assert after_me['rating_count'] == prev_count + 1
        assert after_me['rating_avg'] > 0


# --------- DB-switch regression: pabili lifecycle ---------
class TestPabiliLifecycle:
    def test_custom_order_full_flow(self, s, actors):
        r = s.post(f'{BASE_URL}/orders', json={
            'kind': 'custom',
            'list_text': 'suka, toyo, 1kg bigas',
            'delivery_address': 'Camflora',
            'note': 'TEST r4 pabili',
            'payment_method': 'cash',
            'weight_kg': 2,
            'item_count': 3,
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200, r.text
        o = r.json()
        oid = o['id']
        # service fee dynamic > 0
        assert o['service_fee'] > 0
        # eta_minutes present
        r = s.get(f'{BASE_URL}/orders/{oid}', headers=auth(actors['cust_t']))
        assert r.status_code == 200
        assert 'eta_minutes' in r.json()

        # accept + advance
        s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(actors['driver_t']))
        r = s.post(f'{BASE_URL}/orders/{oid}/accept', headers=auth(actors['driver_t']))
        assert r.status_code == 200
        for st in ['shopping', 'delivering', 'completed']:
            r = s.post(f'{BASE_URL}/orders/{oid}/status', json={'status': st}, headers=auth(actors['driver_t']))
            assert r.status_code == 200, f'{st}: {r.text}'


# --------- Round 4 NEW: config trust thresholds ---------
class TestTrustedConfig:
    def test_public_config_includes_trusted_keys(self, s):
        r = s.get(f'{BASE_URL}/config')
        assert r.status_code == 200
        d = r.json()
        assert 'trusted_min_ratings' in d
        assert 'trusted_min_avg' in d

    def test_admin_updates_and_persists_trust(self, s, actors):
        # save originals to restore
        orig = s.get(f'{BASE_URL}/admin/config', headers=auth(actors['admin_t'])).json()

        # set low thresholds
        r = s.post(f'{BASE_URL}/admin/config', json={
            'trusted_min_ratings': 1, 'trusted_min_avg': 4.0
        }, headers=auth(actors['admin_t']))
        assert r.status_code == 200
        got = r.json()
        assert got['trusted_min_ratings'] == 1
        assert got['trusted_min_avg'] == 4.0

        # public reflects
        pub = s.get(f'{BASE_URL}/config').json()
        assert pub['trusted_min_ratings'] == 1
        assert pub['trusted_min_avg'] == 4.0

        # restore
        s.post(f'{BASE_URL}/admin/config', json={
            'trusted_min_ratings': orig.get('trusted_min_ratings', 3),
            'trusted_min_avg': orig.get('trusted_min_avg', 4.5),
        }, headers=auth(actors['admin_t']))

    def test_admin_config_forbidden_for_non_admin(self, s, actors):
        r = s.post(f'{BASE_URL}/admin/config', json={'trusted_min_avg': 4.9},
                   headers=auth(actors['cust_t']))
        assert r.status_code == 403


# --------- Round 4 NEW: driver payouts ---------
class TestPayouts:
    def test_payouts_forbidden_for_non_admin(self, s, actors):
        r = s.get(f'{BASE_URL}/admin/payouts', headers=auth(actors['cust_t']))
        assert r.status_code == 403
        r = s.get(f'{BASE_URL}/admin/payouts', headers=auth(actors['driver_t']))
        assert r.status_code == 403
        r = s.get(f'{BASE_URL}/admin/payouts')
        assert r.status_code == 401

    def test_payouts_all_time_shape(self, s, actors):
        r = s.get(f'{BASE_URL}/admin/payouts', headers=auth(actors['admin_t']))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ['from', 'to', 'report', 'totals']:
            assert k in d, f'missing {k}'
        for k in ['drivers', 'rides', 'orders', 'ride_earnings', 'pabili_earnings', 'total']:
            assert k in d['totals'], f'missing totals.{k}'
        # Each row shape
        for row in d['report']:
            for k in ['driver_id', 'driver_name', 'rides', 'orders',
                      'ride_earnings', 'pabili_earnings', 'total']:
                assert k in row, f'missing row.{k}'
        # There must be at least the seed driver (Mang Tonyo) since prior tests completed jobs
        assert d['totals']['total'] >= 0
        # Sorted desc by total
        totals = [r['total'] for r in d['report']]
        assert totals == sorted(totals, reverse=True)

    def test_payouts_date_from_future_returns_empty_report(self, s, actors):
        r = s.get(f'{BASE_URL}/admin/payouts',
                  params={'date_from': '2099-01-01', 'date_to': '2099-12-31'},
                  headers=auth(actors['admin_t']))
        assert r.status_code == 200
        d = r.json()
        assert d['from'] == '2099-01-01'
        assert d['to'] == '2099-12-31'
        assert d['report'] == []
        assert d['totals']['total'] == 0
        assert d['totals']['drivers'] == 0

    def test_payouts_today_range_returns_row_with_totals_summing(self, s, actors):
        # Ensure at least one completed ride today: our TestRideLifecycle already did.
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        r = s.get(f'{BASE_URL}/admin/payouts',
                  params={'date_from': today, 'date_to': today},
                  headers=auth(actors['admin_t']))
        assert r.status_code == 200
        d = r.json()
        # totals must equal the sum of rows
        assert round(sum(x['total'] for x in d['report']), 2) == d['totals']['total']
        assert sum(x['rides'] for x in d['report']) == d['totals']['rides']
        assert sum(x['orders'] for x in d['report']) == d['totals']['orders']
