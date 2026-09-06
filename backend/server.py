from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, UploadFile, File, Query
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import bcrypt
import requests
import mimetypes
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_EXP_HOURS = int(os.environ.get('JWT_EXP_HOURS', '720'))
JWT_ALG = 'HS256'

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----------------------------- Helpers -----------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8')[:72], bcrypt.gensalt()).decode('utf-8')

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8')[:72], hashed.encode('utf-8'))
    except Exception:
        return False

def make_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def public_user(u: dict) -> dict:
    return {
        'id': u['id'],
        'name': u.get('name'),
        'email': u.get('email'),
        'phone': u.get('phone'),
        'role': u.get('role', 'customer'),
        'online': u.get('online', False),
        'tricycle_no': u.get('tricycle_no'),
        'driver_status': u.get('driver_status', 'none'),
        'banned': u.get('banned', False),
        'rating_avg': u.get('rating_avg', 0),
        'rating_count': u.get('rating_count', 0),
    }

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Not authenticated')
    token = authorization.split(' ', 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get('sub')
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    user = await db.users.find_one({'id': uid}, {'_id': 0})
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    return user

def require_role(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user.get('role') not in roles:
            raise HTTPException(status_code=403, detail='Insufficient permissions')
        return user
    return dep

# ----------------------------- Object Storage -----------------------------

STORAGE_BASE = (os.environ.get('INTEGRATION_PROXY_URL') or '').strip() or 'https://integrations.emergentagent.com'
STORAGE_URL = STORAGE_BASE.rstrip('/') + '/objstore/api/v1/storage'
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
APP_NAME = 'tagkawayan-ride-pabili'
_storage_key = None

def _init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def _put_object(path: str, data: bytes, content_type: str) -> dict:
    key = _init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def _get_object(path: str):
    global _storage_key
    key = _init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        _storage_key = None
        key = _init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

async def user_from_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get('sub')
    except Exception:
        return None
    return await db.users.find_one({'id': uid}, {'_id': 0})

# ----------------------------- Models -----------------------------

class SignupBody(BaseModel):
    name: str
    email: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None

class LoginBody(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None

class EstimateBody(BaseModel):
    pickup: str
    dropoff: str

class RideBody(BaseModel):
    pickup: str
    dropoff: str
    passengers: int = 1
    note: Optional[str] = None
    payment_method: str = 'cash'

class OrderItem(BaseModel):
    name: str
    qty: int = 1
    price: Optional[float] = None
    unit: Optional[str] = None

class OrderBody(BaseModel):
    kind: str  # 'preset' | 'custom'
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    items: List[OrderItem] = []
    custom_list: Optional[str] = None
    note: Optional[str] = None
    delivery_address: str
    payment_method: str = 'cash'

class StatusBody(BaseModel):
    status: str

class OnlineBody(BaseModel):
    online: bool

class RoleBody(BaseModel):
    role: str
    tricycle_no: Optional[str] = None

class ApplyBody(BaseModel):
    tricycle_no: str
    id_card: str
    orcr: str
    tricycle_photo: str

class ReasonBody(BaseModel):
    reason: Optional[str] = None

class BanBody(BaseModel):
    banned: bool
    reason: Optional[str] = None

class RatingBody(BaseModel):
    job_id: str
    job_type: str
    stars: int
    comment: Optional[str] = None

class PayBody(BaseModel):
    gcash_ref: str

class ComplaintBody(BaseModel):
    job_id: str
    job_type: str
    category: str
    description: Optional[str] = None

COMPLAINT_CATEGORIES = ['rude', 'scammer', 'unprofessional', 'abusive', 'drunk', 'need_police_action']

class DeleteAccountBody(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None

class DeletionRequestBody(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None

# ----------------------------- Fare -----------------------------

BASE_FARE = 25.0
PER_ZONE = 12.0
SERVICE_FEE = 35.0

async def zone_of(name: str) -> int:
    lm = await db.landmarks.find_one({'name': name}, {'_id': 0})
    return lm['zone'] if lm else 2

async def compute_fare(pickup: str, dropoff: str) -> float:
    z1 = await zone_of(pickup)
    z2 = await zone_of(dropoff)
    fare = BASE_FARE + abs(z1 - z2) * PER_ZONE
    return round(max(BASE_FARE, fare), 2)

# ----------------------------- Auth routes -----------------------------

@api_router.post('/auth/signup')
async def signup(body: SignupBody):
    name = (body.name or '').strip()
    if len(name) < 2:
        raise HTTPException(422, 'Please enter your full name')
    doc = {
        'id': new_id(),
        'name': name,
        'role': 'customer',
        'online': False,
        'driver_status': 'none',
        'banned': False,
        'rating_avg': 0,
        'rating_count': 0,
        'pending_deletion': False,
        'created_at': now_iso(),
    }
    if body.email:
        email = body.email.strip().lower()
        if not body.password or len(body.password) < 5:
            raise HTTPException(422, 'Password must be at least 5 characters')
        if await db.users.find_one({'email': email}):
            raise HTTPException(409, 'Email already registered')
        doc['email'] = email
        doc['password'] = hash_pw(body.password)
    elif body.phone:
        phone = body.phone.strip()
        if await db.users.find_one({'phone': phone}):
            raise HTTPException(409, 'Phone number already registered')
        doc['phone'] = phone
    else:
        raise HTTPException(422, 'Provide an email+password or a phone number')
    await db.users.insert_one(doc)
    return {'token': make_token(doc['id']), 'user': public_user(doc)}

@api_router.post('/auth/login')
async def login(body: LoginBody):
    if body.email:
        user = await db.users.find_one({'email': body.email.strip().lower()}, {'_id': 0})
        if not user or 'password' not in user or not verify_pw(body.password or '', user['password']):
            raise HTTPException(401, 'Wrong email or password')
    elif body.phone and body.name:
        user = await db.users.find_one({'phone': body.phone.strip(), 'name': body.name.strip()}, {'_id': 0})
        if not user:
            raise HTTPException(401, 'No account matches that phone and name')
    else:
        raise HTTPException(422, 'Provide email+password or phone+name')
    return {'token': make_token(user['id']), 'user': public_user(user)}

@api_router.get('/auth/me')
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)

@api_router.post('/account/deletion-request')
async def deletion_request(body: DeletionRequestBody):
    """PUBLIC endpoint (no auth). A user requests account deletion by email or phone.
    Marks the matching account as pending deletion so an admin can review & delete it.
    Returns a generic success regardless of whether an account matched (privacy).
    """
    ors = []
    if body.email:
        ors.append({'email': body.email.strip().lower()})
    if body.phone:
        ors.append({'phone': body.phone.strip()})
    if not ors:
        raise HTTPException(422, 'Provide an email or phone number')
    await db.users.update_one(
        {'$or': ors},
        {'$set': {'pending_deletion': True, 'deletion_requested_at': now_iso()}},
    )
    return {'ok': True, 'message': 'If an account matches, it has been marked for deletion.'}

@api_router.post('/account/delete')
async def delete_account(body: DeleteAccountBody, user: dict = Depends(get_current_user)):
    """Delete a user account identified by email or phone number.
    - A regular user may only delete their OWN account.
    - An admin may delete any account.
    Also removes the account's ratings and complaints. Ride/order history is kept.
    """
    ors = []
    if body.email:
        ors.append({'email': body.email.strip().lower()})
    if body.phone:
        ors.append({'phone': body.phone.strip()})
    if not ors:
        raise HTTPException(422, 'Provide an email or phone number')
    target = await db.users.find_one({'$or': ors}, {'_id': 0})
    if not target:
        raise HTTPException(404, 'No account found for the given email or phone')
    if user.get('role') != 'admin' and target['id'] != user['id']:
        raise HTTPException(403, 'You can only delete your own account')
    # Do not allow deleting the last remaining admin (avoids lockout)
    if target.get('role') == 'admin' and await db.users.count_documents({'role': 'admin'}) <= 1:
        raise HTTPException(400, 'Cannot delete the last admin account')
    await db.users.delete_one({'id': target['id']})
    await db.ratings.delete_many({'customer_id': target['id']})
    await db.complaints.delete_many({'customer_id': target['id']})
    return {'ok': True, 'deleted_id': target['id']}

# ----------------------------- Catalog routes -----------------------------

@api_router.get('/landmarks')
async def get_landmarks():
    items = await db.landmarks.find({}, {'_id': 0}).sort('name', 1).to_list(200)
    return items

@api_router.get('/stores')
async def get_stores():
    items = await db.stores.find({}, {'_id': 0}).to_list(100)
    return items

@api_router.get('/stores/{store_id}')
async def get_store(store_id: str):
    store = await db.stores.find_one({'id': store_id}, {'_id': 0})
    if not store:
        raise HTTPException(404, 'Store not found')
    return store

@api_router.post('/rides/estimate')
async def estimate(body: EstimateBody):
    return {'fare': await compute_fare(body.pickup, body.dropoff)}

# ----------------------------- Ride routes -----------------------------

@api_router.post('/rides')
async def create_ride(body: RideBody, user: dict = Depends(get_current_user)):
    fare = await compute_fare(body.pickup, body.dropoff)
    doc = {
        'id': new_id(),
        'type': 'ride',
        'customer_id': user['id'],
        'customer_name': user['name'],
        'customer_phone': user.get('phone'),
        'pickup': body.pickup,
        'dropoff': body.dropoff,
        'passengers': body.passengers,
        'note': body.note,
        'fare': fare,
        'payment': 'cash',
        'payment_method': body.payment_method,
        'payment_status': 'unpaid' if body.payment_method == 'gcash' else 'cash_on_delivery',
        'gcash_ref': None,
        'status': 'requested',
        'driver_id': None,
        'driver_name': None,
        'driver_phone': None,
        'driver_tricycle': None,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    await db.rides.insert_one(doc)
    doc.pop('_id', None)
    return doc

@api_router.get('/rides/my')
async def my_rides(user: dict = Depends(get_current_user)):
    return await db.rides.find({'customer_id': user['id']}, {'_id': 0}).sort('created_at', -1).to_list(200)

@api_router.get('/rides/{ride_id}')
async def get_ride(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({'id': ride_id}, {'_id': 0})
    if not ride:
        raise HTTPException(404, 'Ride not found')
    return ride

RIDE_FLOW = ['requested', 'accepted', 'arriving', 'in_progress', 'completed']
ORDER_FLOW = ['requested', 'accepted', 'shopping', 'delivering', 'completed']

@api_router.post('/rides/{ride_id}/accept')
async def accept_ride(ride_id: str, user: dict = Depends(require_role('driver'))):
    res = await db.rides.find_one_and_update(
        {'id': ride_id, 'status': 'requested'},
        {'$set': {
            'status': 'accepted',
            'driver_id': user['id'],
            'driver_name': user['name'],
            'driver_phone': user.get('phone'),
            'driver_tricycle': user.get('tricycle_no'),
            'driver_rating': user.get('rating_avg', 0),
            'driver_rating_count': user.get('rating_count', 0),
            'updated_at': now_iso(),
        }},
    )
    if not res:
        raise HTTPException(409, 'Ride is no longer available')
    return {'ok': True}

@api_router.post('/rides/{ride_id}/status')
async def ride_status(ride_id: str, body: StatusBody, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({'id': ride_id}, {'_id': 0})
    if not ride:
        raise HTTPException(404, 'Ride not found')
    if body.status == 'cancelled':
        if user['id'] not in (ride.get('customer_id'), ride.get('driver_id')):
            raise HTTPException(403, 'Not allowed')
    else:
        if user['id'] != ride.get('driver_id'):
            raise HTTPException(403, 'Only the assigned driver can update this')
        if body.status not in RIDE_FLOW:
            raise HTTPException(422, 'Invalid status')
    await db.rides.update_one({'id': ride_id}, {'$set': {'status': body.status, 'updated_at': now_iso()}})
    return {'ok': True}

# ----------------------------- Pabili order routes -----------------------------

@api_router.post('/orders')
async def create_order(body: OrderBody, user: dict = Depends(get_current_user)):
    items = [i.dict() for i in body.items]
    items_total = round(sum((i.get('price') or 0) * i.get('qty', 1) for i in items), 2)
    doc = {
        'id': new_id(),
        'type': 'pabili',
        'customer_id': user['id'],
        'customer_name': user['name'],
        'customer_phone': user.get('phone'),
        'kind': body.kind,
        'store_id': body.store_id,
        'store_name': body.store_name,
        'items': items,
        'custom_list': body.custom_list,
        'note': body.note,
        'delivery_address': body.delivery_address,
        'items_total': items_total,
        'service_fee': SERVICE_FEE,
        'estimated_total': round(items_total + SERVICE_FEE, 2),
        'payment': 'cash',
        'payment_method': body.payment_method,
        'payment_status': 'unpaid' if body.payment_method == 'gcash' else 'cash_on_delivery',
        'gcash_ref': None,
        'status': 'requested',
        'driver_id': None,
        'driver_name': None,
        'driver_phone': None,
        'driver_tricycle': None,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    await db.orders.insert_one(doc)
    doc.pop('_id', None)
    return doc

@api_router.get('/orders/my')
async def my_orders(user: dict = Depends(get_current_user)):
    return await db.orders.find({'customer_id': user['id']}, {'_id': 0}).sort('created_at', -1).to_list(200)

@api_router.get('/orders/{order_id}')
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(404, 'Order not found')
    return order

@api_router.post('/orders/{order_id}/accept')
async def accept_order(order_id: str, user: dict = Depends(require_role('driver'))):
    res = await db.orders.find_one_and_update(
        {'id': order_id, 'status': 'requested'},
        {'$set': {
            'status': 'accepted',
            'driver_id': user['id'],
            'driver_name': user['name'],
            'driver_phone': user.get('phone'),
            'driver_tricycle': user.get('tricycle_no'),
            'driver_rating': user.get('rating_avg', 0),
            'driver_rating_count': user.get('rating_count', 0),
            'updated_at': now_iso(),
        }},
    )
    if not res:
        raise HTTPException(409, 'Order is no longer available')
    return {'ok': True}

@api_router.post('/orders/{order_id}/status')
async def order_status(order_id: str, body: StatusBody, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(404, 'Order not found')
    if body.status == 'cancelled':
        if user['id'] not in (order.get('customer_id'), order.get('driver_id')):
            raise HTTPException(403, 'Not allowed')
    else:
        if user['id'] != order.get('driver_id'):
            raise HTTPException(403, 'Only the assigned driver can update this')
        if body.status not in ORDER_FLOW:
            raise HTTPException(422, 'Invalid status')
    await db.orders.update_one({'id': order_id}, {'$set': {'status': body.status, 'updated_at': now_iso()}})
    return {'ok': True}

# ----------------------------- Driver routes -----------------------------

@api_router.post('/driver/status')
async def driver_status(body: OnlineBody, user: dict = Depends(require_role('driver'))):
    fresh = await db.users.find_one({'id': user['id']}, {'_id': 0})
    if fresh.get('banned'):
        raise HTTPException(403, 'Your account is suspended. Please contact the admin.')
    if fresh.get('driver_status') != 'approved':
        raise HTTPException(403, 'Your driver application is not yet approved.')
    await db.users.update_one({'id': user['id']}, {'$set': {'online': body.online}})
    return {'online': body.online}

@api_router.get('/driver/requests')
async def driver_requests(user: dict = Depends(require_role('driver'))):
    fresh = await db.users.find_one({'id': user['id']}, {'_id': 0})
    if not fresh or not fresh.get('online') or fresh.get('banned'):
        return {'online': False, 'rides': [], 'orders': []}
    rides = await db.rides.find({'status': 'requested'}, {'_id': 0}).sort('created_at', -1).to_list(100)
    orders = await db.orders.find({'status': 'requested'}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return {'online': True, 'rides': rides, 'orders': orders}

@api_router.get('/driver/active')
async def driver_active(user: dict = Depends(require_role('driver'))):
    done = ['completed', 'cancelled']
    rides = await db.rides.find({'driver_id': user['id'], 'status': {'$nin': done}}, {'_id': 0}).sort('updated_at', -1).to_list(100)
    orders = await db.orders.find({'driver_id': user['id'], 'status': {'$nin': done}}, {'_id': 0}).sort('updated_at', -1).to_list(100)
    return {'rides': rides, 'orders': orders}

@api_router.get('/driver/history')
async def driver_history(user: dict = Depends(require_role('driver'))):
    rides = await db.rides.find({'driver_id': user['id'], 'status': 'completed'}, {'_id': 0}).sort('updated_at', -1).to_list(100)
    orders = await db.orders.find({'driver_id': user['id'], 'status': 'completed'}, {'_id': 0}).sort('updated_at', -1).to_list(100)
    return {'rides': rides, 'orders': orders}

# ----------------------------- Admin routes -----------------------------

@api_router.get('/admin/stats')
async def admin_stats(user: dict = Depends(require_role('admin'))):
    return {
        'users': await db.users.count_documents({}),
        'drivers': await db.users.count_documents({'role': 'driver'}),
        'customers': await db.users.count_documents({'role': 'customer'}),
        'rides': await db.rides.count_documents({}),
        'orders': await db.orders.count_documents({}),
        'active_rides': await db.rides.count_documents({'status': {'$nin': ['completed', 'cancelled']}}),
        'active_orders': await db.orders.count_documents({'status': {'$nin': ['completed', 'cancelled']}}),
        'online_drivers': await db.users.count_documents({'role': 'driver', 'online': True}),
        'pending_applications': await db.users.count_documents({'driver_status': 'pending'}),
        'open_complaints': await db.complaints.count_documents({'status': 'open'}),
    }

@api_router.get('/admin/users')
async def admin_users(user: dict = Depends(require_role('admin'))):
    users = await db.users.find({}, {'_id': 0, 'password': 0}).sort('created_at', -1).to_list(500)
    return users

@api_router.get('/admin/list')
async def admin_list(
    type: str,
    q: Optional[str] = Query(None),
    sort: str = 'time',
    order: str = 'desc',
    page: int = 1,
    page_size: int = 10,
    user: dict = Depends(require_role('admin')),
):
    page = max(1, page)
    page_size = min(50, max(1, page_size))
    skip = (page - 1) * page_size
    direction = -1 if order == 'desc' else 1
    q = (q or '').strip()
    done = ['completed', 'cancelled']

    if type in ('total_rides', 'active_rides', 'total_orders', 'active_orders'):
        is_ride = 'rides' in type
        coll = db.rides if is_ride else db.orders
        query: dict = {}
        if 'active' in type:
            query['status'] = {'$nin': done}
        if q:
            rx = {'$regex': q, '$options': 'i'}
            if is_ride:
                query['$or'] = [{'customer_name': rx}, {'driver_name': rx}, {'pickup': rx}, {'dropoff': rx}]
            else:
                query['$or'] = [{'customer_name': rx}, {'driver_name': rx}, {'delivery_address': rx}, {'store_name': rx}]
        sort_field = 'created_at' if sort == 'time' else 'customer_name'
        total = await coll.count_documents(query)
        items = await coll.find(query, {'_id': 0}).sort(sort_field, direction).skip(skip).limit(page_size).to_list(page_size)
    elif type in ('customers', 'drivers'):
        role = 'customer' if type == 'customers' else 'driver'
        query = {'role': role}
        if q:
            rx = {'$regex': q, '$options': 'i'}
            query['$or'] = [{'name': rx}, {'phone': rx}, {'email': rx}, {'tricycle_no': rx}]
        sort_field = 'created_at' if sort == 'time' else 'name'
        total = await db.users.count_documents(query)
        items = await db.users.find(query, {'_id': 0, 'password': 0}).sort(sort_field, direction).skip(skip).limit(page_size).to_list(page_size)
    else:
        raise HTTPException(422, 'Invalid list type')

    return {
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'pages': max(1, (total + page_size - 1) // page_size),
        'kind': 'ride' if 'rides' in type else 'order' if 'orders' in type else 'user',
    }

@api_router.post('/admin/users/{user_id}/role')
async def set_role(user_id: str, body: RoleBody, user: dict = Depends(require_role('admin'))):
    if body.role not in ('customer', 'driver', 'admin'):
        raise HTTPException(422, 'Invalid role')
    update = {'role': body.role}
    if body.role == 'driver' and body.tricycle_no:
        update['tricycle_no'] = body.tricycle_no
    res = await db.users.update_one({'id': user_id}, {'$set': update})
    if res.matched_count == 0:
        raise HTTPException(404, 'User not found')
    return {'ok': True}

@api_router.get('/admin/orders')
async def admin_orders(user: dict = Depends(require_role('admin'))):
    rides = await db.rides.find({}, {'_id': 0}).sort('created_at', -1).to_list(300)
    orders = await db.orders.find({}, {'_id': 0}).sort('created_at', -1).to_list(300)
    return {'rides': rides, 'orders': orders}

# ----------------------------- File upload / storage -----------------------------

@api_router.post('/upload')
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, 'File too large (max 8MB)')
    ext = (file.filename or 'img.jpg').split('.')[-1].lower()
    if ext not in ('jpg', 'jpeg', 'png', 'webp', 'heic'):
        ext = 'jpg'
    path = f"{APP_NAME}/uploads/{user['id']}/{new_id()}.{ext}"
    ct = file.content_type or mimetypes.guess_type(f'x.{ext}')[0] or 'image/jpeg'
    try:
        await run_in_threadpool(_put_object, path, data, ct)
    except Exception:
        logger.exception('upload failed')
        raise HTTPException(502, 'Upload failed, please try again')
    return {'path': path}

@api_router.get('/files/{path:path}')
async def serve_file(path: str, token: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    user = None
    if token:
        user = await user_from_token(token)
    elif authorization and authorization.lower().startswith('bearer '):
        user = await user_from_token(authorization.split(' ', 1)[1])
    if not user:
        raise HTTPException(401, 'Not authenticated')
    if user.get('role') != 'admin' and f"/uploads/{user['id']}/" not in f"/{path}":
        raise HTTPException(403, 'Not allowed')
    try:
        content, ct = await run_in_threadpool(_get_object, path)
    except Exception:
        raise HTTPException(404, 'File not found')
    return Response(content=content, media_type=ct)

# ----------------------------- Driver application -----------------------------

@api_router.post('/driver/apply')
async def driver_apply(body: ApplyBody, user: dict = Depends(get_current_user)):
    if user.get('role') == 'driver' and user.get('driver_status') == 'approved':
        raise HTTPException(400, 'You are already an approved driver')
    await db.users.update_one({'id': user['id']}, {'$set': {
        'driver_status': 'pending',
        'tricycle_no': body.tricycle_no.strip(),
        'driver_docs': {'id_card': body.id_card, 'orcr': body.orcr, 'tricycle_photo': body.tricycle_photo},
        'rejection_reason': None,
        'applied_at': now_iso(),
    }})
    return {'ok': True, 'driver_status': 'pending'}

@api_router.get('/driver/application')
async def driver_application(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({'id': user['id']}, {'_id': 0, 'password': 0})
    return {
        'driver_status': u.get('driver_status', 'none'),
        'rejection_reason': u.get('rejection_reason'),
        'tricycle_no': u.get('tricycle_no'),
        'driver_docs': u.get('driver_docs'),
    }

# ----------------------------- Driver earnings -----------------------------

@api_router.get('/driver/earnings')
async def driver_earnings(user: dict = Depends(require_role('driver'))):
    rides = await db.rides.find({'driver_id': user['id'], 'status': 'completed'}, {'_id': 0}).to_list(2000)
    orders = await db.orders.find({'driver_id': user['id'], 'status': 'completed'}, {'_id': 0}).to_list(2000)
    now = datetime.now(timezone.utc)
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_week = start_today - timedelta(days=now.weekday())
    today = week = total = 0.0
    c_today = c_week = 0
    for j in rides + orders:
        amt = j.get('fare', 0) if j.get('type') == 'ride' else j.get('service_fee', 0)
        total += amt
        try:
            t = datetime.fromisoformat(j.get('updated_at'))
        except Exception:
            t = now
        if t >= start_week:
            week += amt
            c_week += 1
        if t >= start_today:
            today += amt
            c_today += 1
    return {
        'today': round(today, 2), 'week': round(week, 2), 'total': round(total, 2),
        'count': len(rides) + len(orders), 'count_today': c_today, 'count_week': c_week,
        'rating_avg': user.get('rating_avg', 0), 'rating_count': user.get('rating_count', 0),
    }

# ----------------------------- Ratings -----------------------------

@api_router.post('/ratings')
async def create_rating(body: RatingBody, user: dict = Depends(get_current_user)):
    coll = db.rides if body.job_type == 'ride' else db.orders
    job = await coll.find_one({'id': body.job_id}, {'_id': 0})
    if not job:
        raise HTTPException(404, 'Job not found')
    if job.get('customer_id') != user['id']:
        raise HTTPException(403, 'Not allowed')
    if job.get('status') != 'completed':
        raise HTTPException(400, 'You can only rate after completion')
    if not job.get('driver_id'):
        raise HTTPException(400, 'No driver to rate')
    if job.get('rated'):
        raise HTTPException(409, 'You already rated this trip')
    stars = max(1, min(5, int(body.stars)))
    await db.ratings.insert_one({
        'id': new_id(), 'driver_id': job['driver_id'], 'customer_id': user['id'],
        'customer_name': user['name'], 'job_id': body.job_id, 'job_type': body.job_type,
        'stars': stars, 'comment': (body.comment or '').strip(), 'created_at': now_iso(),
    })
    await coll.update_one({'id': body.job_id}, {'$set': {'rated': True, 'rating_stars': stars}})
    agg = await db.ratings.aggregate([
        {'$match': {'driver_id': job['driver_id']}},
        {'$group': {'_id': None, 'avg': {'$avg': '$stars'}, 'cnt': {'$sum': 1}}},
    ]).to_list(1)
    if agg:
        await db.users.update_one({'id': job['driver_id']}, {'$set': {
            'rating_avg': round(agg[0]['avg'], 2), 'rating_count': agg[0]['cnt'],
        }})
    return {'ok': True}

# ----------------------------- GCash manual payment -----------------------------

def _job_coll(job_type: str):
    return db.rides if job_type in ('ride', 'rides') else db.orders

@api_router.post('/pay/{job_type}/{job_id}')
async def submit_payment(job_type: str, job_id: str, body: PayBody, user: dict = Depends(get_current_user)):
    coll = _job_coll(job_type)
    job = await coll.find_one({'id': job_id}, {'_id': 0})
    if not job:
        raise HTTPException(404, 'Not found')
    if job.get('customer_id') != user['id']:
        raise HTTPException(403, 'Not allowed')
    await coll.update_one({'id': job_id}, {'$set': {
        'payment_status': 'submitted', 'gcash_ref': body.gcash_ref.strip(), 'updated_at': now_iso(),
    }})
    return {'ok': True}

@api_router.post('/pay/{job_type}/{job_id}/confirm')
async def confirm_payment(job_type: str, job_id: str, user: dict = Depends(get_current_user)):
    coll = _job_coll(job_type)
    job = await coll.find_one({'id': job_id}, {'_id': 0})
    if not job:
        raise HTTPException(404, 'Not found')
    if user['id'] != job.get('driver_id') and user.get('role') != 'admin':
        raise HTTPException(403, 'Not allowed')
    await coll.update_one({'id': job_id}, {'$set': {'payment_status': 'confirmed', 'updated_at': now_iso()}})
    return {'ok': True}

# ----------------------------- Complaints -----------------------------

@api_router.post('/complaints')
async def create_complaint(body: ComplaintBody, user: dict = Depends(get_current_user)):
    if body.category not in COMPLAINT_CATEGORIES:
        raise HTTPException(422, 'Invalid category')
    coll = _job_coll(body.job_type)
    job = await coll.find_one({'id': body.job_id}, {'_id': 0})
    if not job or job.get('customer_id') != user['id']:
        raise HTTPException(403, 'Not allowed')
    if not job.get('driver_id'):
        raise HTTPException(400, 'No driver on this job')
    await db.complaints.insert_one({
        'id': new_id(), 'customer_id': user['id'], 'customer_name': user['name'],
        'driver_id': job['driver_id'], 'driver_name': job.get('driver_name'),
        'job_id': body.job_id, 'job_type': body.job_type, 'category': body.category,
        'description': (body.description or '').strip(), 'status': 'open', 'created_at': now_iso(),
    })
    await coll.update_one({'id': body.job_id}, {'$set': {'complaint_filed': True}})
    return {'ok': True}

# ----------------------------- Admin: applications, complaints, ban -----------------------------

@api_router.get('/admin/applications')
async def admin_applications(user: dict = Depends(require_role('admin'))):
    return await db.users.find(
        {'driver_status': {'$in': ['pending', 'approved', 'rejected']}},
        {'_id': 0, 'password': 0},
    ).sort('applied_at', -1).to_list(300)

@api_router.post('/admin/applications/{uid}/approve')
async def approve_application(uid: str, user: dict = Depends(require_role('admin'))):
    res = await db.users.update_one({'id': uid}, {'$set': {
        'role': 'driver', 'driver_status': 'approved', 'rejection_reason': None,
    }})
    if res.matched_count == 0:
        raise HTTPException(404, 'User not found')
    return {'ok': True}

@api_router.post('/admin/applications/{uid}/reject')
async def reject_application(uid: str, body: ReasonBody, user: dict = Depends(require_role('admin'))):
    res = await db.users.update_one({'id': uid}, {'$set': {
        'role': 'customer', 'driver_status': 'rejected', 'online': False,
        'rejection_reason': (body.reason or 'Documents did not meet requirements').strip(),
    }})
    if res.matched_count == 0:
        raise HTTPException(404, 'User not found')
    return {'ok': True}

@api_router.post('/admin/users/{uid}/ban')
async def ban_user(uid: str, body: BanBody, user: dict = Depends(require_role('admin'))):
    upd = {'banned': body.banned, 'ban_reason': (body.reason or '').strip()}
    if body.banned:
        upd['online'] = False
    res = await db.users.update_one({'id': uid}, {'$set': upd})
    if res.matched_count == 0:
        raise HTTPException(404, 'User not found')
    return {'ok': True}

@api_router.post('/admin/users/{uid}/delete')
async def admin_delete_user(uid: str, user: dict = Depends(require_role('admin'))):
    target = await db.users.find_one({'id': uid}, {'_id': 0})
    if not target:
        raise HTTPException(404, 'User not found')
    if target.get('role') == 'admin' and await db.users.count_documents({'role': 'admin'}) <= 1:
        raise HTTPException(400, 'Cannot delete the last admin account')
    await db.users.delete_one({'id': uid})
    await db.ratings.delete_many({'customer_id': uid})
    await db.complaints.delete_many({'customer_id': uid})
    return {'ok': True}

@api_router.get('/admin/complaints')
async def admin_complaints(user: dict = Depends(require_role('admin'))):
    return await db.complaints.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)

@api_router.post('/admin/complaints/{cid}/resolve')
async def resolve_complaint(cid: str, user: dict = Depends(require_role('admin'))):
    res = await db.complaints.update_one({'id': cid}, {'$set': {'status': 'reviewed'}})
    if res.matched_count == 0:
        raise HTTPException(404, 'Complaint not found')
    return {'ok': True}

# ----------------------------- Seed -----------------------------

LANDMARKS = [
    ('Poblacion (Town Center)', 1), ('Tagkawayan Public Market', 1), ('Tagkawayan Port', 2),
    ('Tagkawayan Bus Terminal', 2), ('Bagong Silang', 2), ('Aliji', 3), ('Cabibihan', 3),
    ('Kinamaligan', 3), ('Camflora', 4), ('Vega', 3), ('Bukal', 4), ('Katimo', 4),
    ('Lubi', 5), ('Payte', 4), ('San Vicente', 3), ('Sto. Niño', 2), ('Gapas', 4),
    ('Manato', 5), ('Rizal', 2), ('Mahinta', 4),
]

STORES = [
    {
        'name': 'Tagkawayan Public Market', 'category': 'Wet Market',
        'image': 'https://images.unsplash.com/photo-1506484381205-f7945653044d?crop=entropy&cs=srgb&fm=jpg&q=85&w=800',
        'items': [
            {'name': 'Rice (per kilo)', 'price': 52, 'unit': 'kg'},
            {'name': 'Pork (per kilo)', 'price': 320, 'unit': 'kg'},
            {'name': 'Chicken (per kilo)', 'price': 200, 'unit': 'kg'},
            {'name': 'Bangus / Milkfish', 'price': 180, 'unit': 'kg'},
            {'name': 'Tomatoes', 'price': 60, 'unit': 'kg'},
            {'name': 'Onions', 'price': 90, 'unit': 'kg'},
            {'name': 'Garlic', 'price': 120, 'unit': 'kg'},
            {'name': 'Eggs (per tray)', 'price': 215, 'unit': 'tray'},
            {'name': 'Kalabasa / Squash', 'price': 40, 'unit': 'kg'},
            {'name': 'Bananas (Saba)', 'price': 55, 'unit': 'kg'},
        ],
    },
    {
        'name': 'Aling Nena Sari-Sari Store', 'category': 'Sari-sari',
        'image': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?crop=entropy&cs=srgb&fm=jpg&q=85&w=800',
        'items': [
            {'name': 'Instant Noodles', 'price': 12, 'unit': 'pack'},
            {'name': 'Coffee 3-in-1', 'price': 8, 'unit': 'sachet'},
            {'name': 'Sugar (per kilo)', 'price': 75, 'unit': 'kg'},
            {'name': 'Cooking Oil (bottle)', 'price': 85, 'unit': 'btl'},
            {'name': 'Soy Sauce', 'price': 28, 'unit': 'btl'},
            {'name': 'Canned Sardines', 'price': 25, 'unit': 'can'},
            {'name': 'Softdrinks 1.5L', 'price': 75, 'unit': 'btl'},
            {'name': 'Bread (Tasty)', 'price': 65, 'unit': 'loaf'},
        ],
    },
    {
        'name': 'Botika ng Bayan', 'category': 'Pharmacy',
        'image': 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?crop=entropy&cs=srgb&fm=jpg&q=85&w=800',
        'items': [
            {'name': 'Paracetamol (Biogesic)', 'price': 5, 'unit': 'tab'},
            {'name': 'Mefenamic Acid', 'price': 8, 'unit': 'tab'},
            {'name': 'Vitamin C', 'price': 10, 'unit': 'tab'},
            {'name': 'Alcohol 500ml', 'price': 95, 'unit': 'btl'},
            {'name': 'Band-Aid (box)', 'price': 45, 'unit': 'box'},
            {'name': 'Cotton (roll)', 'price': 35, 'unit': 'roll'},
        ],
    },
    {
        'name': 'Tagkawayan Bakery', 'category': 'Bakery',
        'image': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?crop=entropy&cs=srgb&fm=jpg&q=85&w=800',
        'items': [
            {'name': 'Pandesal (per piece)', 'price': 3, 'unit': 'pc'},
            {'name': 'Ensaymada', 'price': 15, 'unit': 'pc'},
            {'name': 'Spanish Bread', 'price': 12, 'unit': 'pc'},
            {'name': 'Loaf Bread', 'price': 60, 'unit': 'loaf'},
            {'name': 'Cheese Bread', 'price': 10, 'unit': 'pc'},
        ],
    },
]

async def seed():
    if await db.landmarks.count_documents({}) == 0:
        await db.landmarks.insert_many([{'id': new_id(), 'name': n, 'zone': z} for n, z in LANDMARKS])
        logger.info('Seeded landmarks')
    if await db.stores.count_documents({}) == 0:
        docs = []
        for s in STORES:
            docs.append({
                'id': new_id(),
                'name': s['name'],
                'category': s['category'],
                'image': s['image'],
                'items': [{'id': new_id(), **it} for it in s['items']],
            })
        await db.stores.insert_many(docs)
        logger.info('Seeded stores')
    # Admin (idempotent)
    admin_email = os.environ['ADMIN_EMAIL'].strip().lower()
    if not await db.users.find_one({'email': admin_email}):
        await db.users.insert_one({
            'id': new_id(), 'name': os.environ.get('ADMIN_NAME', 'Admin'),
            'email': admin_email, 'password': hash_pw(os.environ['ADMIN_PASSWORD']),
            'role': 'admin', 'online': False, 'created_at': now_iso(),
        })
        logger.info('Seeded admin')
    # Sample drivers
    sample_drivers = [
        ('Mang Tonyo', '+639171112201', 'TRK-101'),
        ('Kuya Ben', '+639171112202', 'TRK-205'),
    ]
    for name, phone, trike in sample_drivers:
        if not await db.users.find_one({'phone': phone}):
            await db.users.insert_one({
                'id': new_id(), 'name': name, 'phone': phone, 'role': 'driver',
                'online': False, 'tricycle_no': trike, 'driver_status': 'approved',
                'banned': False, 'rating_avg': 0, 'rating_count': 0, 'created_at': now_iso(),
            })
    # Migration: ensure existing drivers are marked approved
    await db.users.update_many(
        {'role': 'driver', 'driver_status': {'$exists': False}},
        {'$set': {'driver_status': 'approved', 'banned': False}},
    )
    logger.info('Seed complete')

@app.on_event('startup')
async def on_startup():
    await seed()
    try:
        await run_in_threadpool(_init_storage)
        logger.info('Object storage initialized')
    except Exception:
        logger.exception('Object storage init failed (uploads may not work)')

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
