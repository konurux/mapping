from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24 * 7  # 7 days for convenience in this app

app = FastAPI(title="MapForge API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Password & Token helpers
# -----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )


async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Не авторизован")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Неверный токен")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Пользователь не найден")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Срок действия токена истёк")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Неверный токен")


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    created_at: str


class Marker(BaseModel):
    id: str
    layer_id: str
    x: float
    y: float
    title: str = ""
    description: str = ""
    color: str = "#F59E0B"


class Polygon(BaseModel):
    id: str
    layer_id: str
    points: List[List[float]]
    name: str = ""
    fill: str = "#F59E0B"
    stroke: str = "#FFFFFF"
    opacity: float = 0.35
    label_x: Optional[float] = None
    label_y: Optional[float] = None
    label_size: float = 14


class Line(BaseModel):
    id: str
    layer_id: str
    points: List[List[float]]
    name: str = ""
    color: str = "#F59E0B"
    width: float = 2


class TextItem(BaseModel):
    id: str
    layer_id: str
    x: float
    y: float
    text: str = "Текст"
    size: float = 18
    color: str = "#FFFFFF"


class Layer(BaseModel):
    id: str
    name: str
    visible: bool = True


class MapCreate(BaseModel):
    title: str = "Без названия"
    description: str = ""


class MapUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    layers: Optional[List[Layer]] = None
    polygons: Optional[List[Polygon]] = None
    markers: Optional[List[Marker]] = None
    lines: Optional[List[Line]] = None
    texts: Optional[List[TextItem]] = None


class MapDoc(BaseModel):
    id: str
    owner_id: str
    title: str
    description: str
    layers: List[Layer]
    polygons: List[Polygon]
    markers: List[Marker]
    lines: List[Line]
    texts: List[TextItem]
    is_public: bool
    share_token: Optional[str]
    created_at: str
    updated_at: str


# -----------------------------------------------------------------------------
# Auth endpoints
# -----------------------------------------------------------------------------
def user_to_public(u: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "created_at": u["created_at"]}


@api_router.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": user_id,
        "email": email,
        "name": req.name,
        "password_hash": hash_password(req.password),
        "created_at": now,
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return {"user": user_to_public(doc), "token": token}


@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    token = create_access_token(user["id"], user["email"])
    set_auth_cookie(response, token)
    return {"user": user_to_public(user), "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_to_public(user)


# -----------------------------------------------------------------------------
# Maps endpoints
# -----------------------------------------------------------------------------
def default_layer() -> Dict[str, Any]:
    return {"id": str(uuid.uuid4()), "name": "Основной слой", "visible": True}


def serialize_map(m: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": m["id"],
        "owner_id": m["owner_id"],
        "title": m["title"],
        "description": m.get("description", ""),
        "layers": m.get("layers", []),
        "polygons": m.get("polygons", []),
        "markers": m.get("markers", []),
        "lines": m.get("lines", []),
        "texts": m.get("texts", []),
        "is_public": m.get("is_public", False),
        "share_token": m.get("share_token"),
        "created_at": m["created_at"],
        "updated_at": m["updated_at"],
    }


@api_router.get("/maps")
async def list_maps(user: dict = Depends(get_current_user)):
    cursor = db.maps.find({"owner_id": user["id"]}, {"_id": 0}).sort("updated_at", -1)
    items = await cursor.to_list(500)
    return [serialize_map(m) for m in items]


@api_router.post("/maps")
async def create_map(payload: MapCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "title": payload.title,
        "description": payload.description,
        "background_image": None,
        "layers": [default_layer()],
        "polygons": [],
        "markers": [],
        "is_public": False,
        "share_token": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.maps.insert_one(doc)
    return serialize_map(doc)


@api_router.get("/maps/{map_id}")
async def get_map(map_id: str, user: dict = Depends(get_current_user)):
    m = await db.maps.find_one({"id": map_id, "owner_id": user["id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Карта не найдена")
    return serialize_map(m)


@api_router.put("/maps/{map_id}")
async def update_map(map_id: str, payload: MapUpdate, user: dict = Depends(get_current_user)):
    m = await db.maps.find_one({"id": map_id, "owner_id": user["id"]})
    if not m:
        raise HTTPException(status_code=404, detail="Карта не найдена")
    update: Dict[str, Any] = {}
    data = payload.model_dump(exclude_none=True)
    for k, v in data.items():
        update[k] = v
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.maps.update_one({"id": map_id}, {"$set": update})
    m2 = await db.maps.find_one({"id": map_id}, {"_id": 0})
    return serialize_map(m2)


@api_router.delete("/maps/{map_id}")
async def delete_map(map_id: str, user: dict = Depends(get_current_user)):
    res = await db.maps.delete_one({"id": map_id, "owner_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Карта не найдена")
    return {"ok": True}


@api_router.post("/maps/{map_id}/share")
async def toggle_share(map_id: str, user: dict = Depends(get_current_user)):
    m = await db.maps.find_one({"id": map_id, "owner_id": user["id"]})
    if not m:
        raise HTTPException(status_code=404, detail="Карта не найдена")
    if m.get("is_public"):
        await db.maps.update_one({"id": map_id}, {"$set": {"is_public": False}})
        m2 = await db.maps.find_one({"id": map_id}, {"_id": 0})
        return serialize_map(m2)
    token = m.get("share_token") or secrets.token_urlsafe(12)
    await db.maps.update_one({"id": map_id}, {"$set": {"is_public": True, "share_token": token}})
    m2 = await db.maps.find_one({"id": map_id}, {"_id": 0})
    return serialize_map(m2)


@api_router.get("/public/maps/{share_token}")
async def get_public_map(share_token: str):
    m = await db.maps.find_one({"share_token": share_token, "is_public": True}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Публичная карта не найдена")
    return serialize_map(m)


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "MapForge API"}


# 1. Сначала создаем приложение
app = FastAPI(title="MapForge API")

# 2. СРАЗУ настраиваем CORS (до подключения роутеров)
frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. И только потом подключаем роутеры
app.include_router(api_router)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.maps.create_index("owner_id")
    await db.maps.create_index("share_token")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
