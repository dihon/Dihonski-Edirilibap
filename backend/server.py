from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import bcrypt
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

class StatusBody(BaseModel):
    status: str

class OnlineBody(BaseModel):
    online: bool

class RoleBody(BaseModel):
    role: str
    tricycle_no: Optional[str] = None

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
    await db.users.update_one({'id': user['id']}, {'$set': {'online': body.online}})
    return {'online': body.online}

@api_router.get('/driver/requests')
async def driver_requests(user: dict = Depends(require_role('driver'))):
    fresh = await db.users.find_one({'id': user['id']}, {'_id': 0})
    if not fresh or not fresh.get('online'):
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
    }

@api_router.get('/admin/users')
async def admin_users(user: dict = Depends(require_role('admin'))):
    users = await db.users.find({}, {'_id': 0, 'password': 0}).sort('created_at', -1).to_list(500)
    return users

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
                'online': False, 'tricycle_no': trike, 'created_at': now_iso(),
            })
    logger.info('Seed complete')

@app.on_event('startup')
async def on_startup():
    await seed()

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
