import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from jose import jwt
from typing import List, Optional
from backend.config import settings
from backend.database import get_db
from backend.schemas import LoginRequest, TokenResponse, UserBase, UserCreate
from backend.dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/auth", tags=["auth"])

def _hash_password(password: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), settings.SECRET_KEY.encode(), 120_000).hex()

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, org_id, email, name, role, avatar, password_hash FROM users WHERE email = ?", (request.email,))
        user = cursor.fetchone()
    if not user or not user["password_hash"] or not hmac.compare_digest(user["password_hash"], _hash_password(request.password)):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode({"sub": user["id"], "exp": expires}, settings.SECRET_KEY, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer", "user": {k: user[k] for k in ("id", "org_id", "email", "name", "role", "avatar")}}

@router.get("/users", response_model=List[UserBase])
def get_all_users(current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, org_id, email, name, role, avatar FROM users WHERE org_id = ? ORDER BY name ASC",
            (current_user["org_id"],)
        )
        return cursor.fetchall()

@router.post("/users", response_model=UserBase, status_code=201)
def create_user(request: UserCreate, current_user: dict = Depends(require_role("admin"))):
    email = request.email.strip().lower()
    name = request.name.strip()
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        user_id = f"user_{uuid.uuid4().hex[:12]}"
        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={uuid.uuid4().hex}"
        cursor.execute("""
            INSERT INTO users (id, org_id, email, name, role, avatar, created_at, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            current_user["org_id"],
            email,
            name,
            request.role,
            avatar,
            datetime.now(timezone.utc).isoformat(),
            _hash_password(request.password)
        ))
        cursor.execute(
            "SELECT id, org_id, email, name, role, avatar FROM users WHERE id = ?",
            (user_id,)
        )
        return cursor.fetchone()

@router.get("/me", response_model=UserBase)
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
