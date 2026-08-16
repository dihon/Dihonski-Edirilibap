"""
Backend tests for Round 2 features:
- Driver application (apply, admin approve/reject)
- Image serving with token auth
- Ratings
- Driver earnings
- GCash manual payment
- Complaints
- Admin overview counts (pending_applications, open_complaints)
- Ban / suspend driver
"""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/') + '/api'
UNIQUE = uuid.uuid4().hex[:8]

ADMIN_EMAIL = 'admin@tagkawayan.ph'
ADMIN_PASSWORD = 'admin12345'
SEED_DRIVER_NAME = 'Mang Tonyo'
SEED_DRIVER_PHONE = '+639171112201'


def auth(t):
    return {'Authorization': f'Bearer {t}'}


@pytest.fixture(scope='module')
def s():
    return requests.Session()


@pytest.fixture(scope='module')
def actors(s):
    a = {}
    r = s.post(f'{BASE_URL}/auth/login', json={'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD})
    assert r.status_code == 200
    a['admin_t'] = r.json()['token']

    r = s.post(f'{BASE_URL}/auth/login', json={'phone': SEED_DRIVER_PHONE, 'name': SEED_DRIVER_NAME})
    assert r.status_code == 200
    a['driver_t'] = r.json()['token']
    a['driver_u'] = r.json()['user']

    # a fresh customer
    email = f'TEST_r2cust_{UNIQUE}@x.com'
    r = s.post(f'{BASE_URL}/auth/signup', json={
        'name': f'TEST R2 Customer {UNIQUE}', 'email': email, 'password': 'pass12345'
    })
    assert r.status_code == 200
    a['cust_t'] = r.json()['token']
    a['cust_u'] = r.json()['user']

    # another fresh customer who will apply to become a driver
    email2 = f'TEST_r2applicant_{UNIQUE}@x.com'
    r = s.post(f'{BASE_URL}/auth/signup', json={
        'name': f'TEST R2 Applicant {UNIQUE}', 'email': email2, 'password': 'pass12345'
    })
    assert r.status_code == 200
    a['applicant_t'] = r.json()['token']
    a['applicant_u'] = r.json()['user']
    return a


# --------------- File upload & image serving ---------------

class TestUpload:
    def test_upload_and_serve_own(self, s, actors):
        # tiny in-memory JPEG bytes (not a real jpeg but bytes are okay for storage)
        files = {'file': ('a.jpg', io.BytesIO(b'\xff\xd8\xff\xe0test-jpeg-bytes'), 'image/jpeg')}
        r = s.post(f'{BASE_URL}/upload', files=files, headers=auth(actors['applicant_t']))
        assert r.status_code == 200, r.text
        path = r.json()['path']
        assert path.startswith('tagkawayan-ride-pabili/uploads/')
        actors['_upload_path'] = path

        # Owner can fetch via ?token=
        r = s.get(f'{BASE_URL}/files/{path}', params={'token': actors['applicant_t']})
        assert r.status_code == 200
        assert r.content.startswith(b'\xff\xd8\xff\xe0')

    def test_serve_no_token(self, s, actors):
        path = actors.get('_upload_path')
        assert path
        r = s.get(f'{BASE_URL}/files/{path}')
        assert r.status_code == 401

    def test_serve_forbidden_for_other_user(self, s, actors):
        path = actors.get('_upload_path')
        assert path
        # cust_t is not the owner and not admin
        r = s.get(f'{BASE_URL}/files/{path}', params={'token': actors['cust_t']})
        assert r.status_code == 403

    def test_serve_ok_for_admin(self, s, actors):
        path = actors.get('_upload_path')
        r = s.get(f'{BASE_URL}/files/{path}', params={'token': actors['admin_t']})
        assert r.status_code == 200


# --------------- Driver application + admin approval ---------------

class TestDriverApplication:
    def test_apply_and_status(self, s, actors):
        body = {
            'tricycle_no': f'TRK-{UNIQUE[:4].upper()}',
            'id_card': 'tagkawayan-ride-pabili/uploads/x/id.jpg',
            'orcr': 'tagkawayan-ride-pabili/uploads/x/orcr.jpg',
            'tricycle_photo': 'tagkawayan-ride-pabili/uploads/x/trike.jpg',
        }
        r = s.post(f'{BASE_URL}/driver/apply', json=body, headers=auth(actors['applicant_t']))
        assert r.status_code == 200, r.text
        assert r.json()['driver_status'] == 'pending'

        r = s.get(f'{BASE_URL}/driver/application', headers=auth(actors['applicant_t']))
        assert r.status_code == 200
        d = r.json()
        assert d['driver_status'] == 'pending'
        assert d['tricycle_no'] == body['tricycle_no']
        assert d['driver_docs']['id_card'] == body['id_card']

    def test_pending_cannot_go_online(self, s, actors):
        # still role=customer at this point, so require_role('driver') itself blocks with 403
        r = s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(actors['applicant_t']))
        assert r.status_code == 403

    def test_admin_sees_application(self, s, actors):
        r = s.get(f'{BASE_URL}/admin/applications', headers=auth(actors['admin_t']))
        assert r.status_code == 200
        arr = r.json()
        assert any(u['id'] == actors['applicant_u']['id'] and u.get('driver_status') == 'pending' for u in arr)

    def test_admin_stats_includes_pending(self, s, actors):
        r = s.get(f'{BASE_URL}/admin/stats', headers=auth(actors['admin_t']))
        assert r.status_code == 200
        assert r.json()['pending_applications'] >= 1
        assert 'open_complaints' in r.json()

    def test_admin_approve_then_driver_can_go_online(self, s, actors):
        uid = actors['applicant_u']['id']
        r = s.post(f'{BASE_URL}/admin/applications/{uid}/approve', headers=auth(actors['admin_t']))
        assert r.status_code == 200

        r = s.get(f'{BASE_URL}/auth/me', headers=auth(actors['applicant_t']))
        assert r.status_code == 200
        me = r.json()
        assert me['role'] == 'driver' and me['driver_status'] == 'approved'

        r = s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(actors['applicant_t']))
        assert r.status_code == 200 and r.json()['online'] is True

    def test_reject_flow_on_new_applicant(self, s, actors):
        # Create a fresh applicant and reject
        email = f'TEST_r2rej_{UNIQUE}@x.com'
        r = s.post(f'{BASE_URL}/auth/signup', json={'name': f'TEST Rej {UNIQUE}', 'email': email, 'password': 'pass12345'})
        rej_t = r.json()['token']
        rej_uid = r.json()['user']['id']
        r = s.post(f'{BASE_URL}/driver/apply', json={
            'tricycle_no': 'TRK-REJ', 'id_card': 'a', 'orcr': 'b', 'tricycle_photo': 'c'
        }, headers=auth(rej_t))
        assert r.status_code == 200

        r = s.post(f'{BASE_URL}/admin/applications/{rej_uid}/reject',
                   json={'reason': 'blurry docs'}, headers=auth(actors['admin_t']))
        assert r.status_code == 200

        # Rejected -> role back to customer -> going online forbidden
        r = s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(rej_t))
        assert r.status_code == 403

        r = s.get(f'{BASE_URL}/driver/application', headers=auth(rej_t))
        assert r.json()['driver_status'] == 'rejected'
        assert 'blurry' in (r.json().get('rejection_reason') or '').lower()


# --------------- End-to-end: gcash + ratings + complaints ---------------

class TestGcashRatingsComplaints:
    @pytest.fixture(scope='class')
    def ride_ctx(self, s, actors):
        # Customer books a ride with gcash
        r = s.post(f'{BASE_URL}/rides', json={
            'pickup': 'Poblacion (Town Center)', 'dropoff': 'Camflora',
            'passengers': 1, 'note': 'TEST gcash', 'payment_method': 'gcash',
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200, r.text
        ride = r.json()
        assert ride['payment_method'] == 'gcash'
        assert ride['payment_status'] == 'unpaid'
        rid = ride['id']

        # Seed driver goes online, accepts, advances to completed
        s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(actors['driver_t']))
        r = s.post(f'{BASE_URL}/rides/{rid}/accept', headers=auth(actors['driver_t']))
        assert r.status_code == 200
        for st in ['arriving', 'in_progress', 'completed']:
            r = s.post(f'{BASE_URL}/rides/{rid}/status', json={'status': st}, headers=auth(actors['driver_t']))
            assert r.status_code == 200
        return {'rid': rid}

    def test_gcash_submit_and_confirm(self, s, actors, ride_ctx):
        rid = ride_ctx['rid']
        # customer submits ref
        r = s.post(f'{BASE_URL}/pay/rides/{rid}', json={'gcash_ref': 'REF123456'}, headers=auth(actors['cust_t']))
        assert r.status_code == 200
        # verify
        r = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(actors['cust_t']))
        assert r.json()['payment_status'] == 'submitted'
        assert r.json()['gcash_ref'] == 'REF123456'

        # non-driver/non-admin cannot confirm
        r = s.post(f'{BASE_URL}/pay/rides/{rid}/confirm', headers=auth(actors['cust_t']))
        assert r.status_code == 403

        # driver confirms
        r = s.post(f'{BASE_URL}/pay/rides/{rid}/confirm', headers=auth(actors['driver_t']))
        assert r.status_code == 200
        r = s.get(f'{BASE_URL}/rides/{rid}', headers=auth(actors['cust_t']))
        assert r.json()['payment_status'] == 'confirmed'

    def test_rating_flow(self, s, actors, ride_ctx):
        rid = ride_ctx['rid']
        r = s.post(f'{BASE_URL}/ratings', json={
            'job_id': rid, 'job_type': 'ride', 'stars': 5, 'comment': 'great driver'
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200

        # cannot rate twice
        r = s.post(f'{BASE_URL}/ratings', json={
            'job_id': rid, 'job_type': 'ride', 'stars': 4
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 409

        # driver's rating_avg reflects on /auth/me
        r = s.get(f'{BASE_URL}/auth/me', headers=auth(actors['driver_t']))
        assert r.status_code == 200
        assert r.json()['rating_count'] >= 1
        assert r.json()['rating_avg'] > 0

    def test_driver_earnings(self, s, actors, ride_ctx):
        r = s.get(f'{BASE_URL}/driver/earnings', headers=auth(actors['driver_t']))
        assert r.status_code == 200
        d = r.json()
        for k in ['today', 'week', 'total', 'count', 'rating_avg', 'rating_count']:
            assert k in d
        assert d['total'] > 0
        assert d['count'] >= 1

    def test_complaint_flow(self, s, actors, ride_ctx):
        rid = ride_ctx['rid']
        # invalid category
        r = s.post(f'{BASE_URL}/complaints', json={
            'job_id': rid, 'job_type': 'ride', 'category': 'foo', 'description': 'x'
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 422

        r = s.post(f'{BASE_URL}/complaints', json={
            'job_id': rid, 'job_type': 'ride', 'category': 'rude', 'description': 'was rude'
        }, headers=auth(actors['cust_t']))
        assert r.status_code == 200

        # admin lists complaints
        r = s.get(f'{BASE_URL}/admin/complaints', headers=auth(actors['admin_t']))
        assert r.status_code == 200
        arr = r.json()
        target = next((c for c in arr if c.get('job_id') == rid), None)
        assert target is not None and target['status'] == 'open'
        cid = target['id']

        # admin resolves
        r = s.post(f'{BASE_URL}/admin/complaints/{cid}/resolve', headers=auth(actors['admin_t']))
        assert r.status_code == 200
        arr = s.get(f'{BASE_URL}/admin/complaints', headers=auth(actors['admin_t'])).json()
        target = next((c for c in arr if c['id'] == cid), None)
        assert target and target['status'] == 'reviewed'


# --------------- Ban a driver ---------------

class TestBanDriver:
    def test_ban_then_unban(self, s, actors):
        did = actors['driver_u']['id']
        # Ensure online first (approved driver, should work)
        r = s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(actors['driver_t']))
        assert r.status_code == 200

        # Admin bans driver
        r = s.post(f'{BASE_URL}/admin/users/{did}/ban',
                   json={'banned': True, 'reason': 'complaint upheld'}, headers=auth(actors['admin_t']))
        assert r.status_code == 200

        # Banned driver cannot go online
        r = s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(actors['driver_t']))
        assert r.status_code == 403

        # Unban to leave seed state usable
        r = s.post(f'{BASE_URL}/admin/users/{did}/ban',
                   json={'banned': False}, headers=auth(actors['admin_t']))
        assert r.status_code == 200

        # Now can go online again
        r = s.post(f'{BASE_URL}/driver/status', json={'online': True}, headers=auth(actors['driver_t']))
        assert r.status_code == 200
