from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from backend.database import get_db
from backend.schemas import UserBase

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.get("/users", response_model=List[UserBase])
def get_all_users():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, org_id, email, name, role, avatar FROM users ORDER BY name ASC")
        return cursor.fetchall()

@router.get("/me", response_model=UserBase)
def get_current_user(x_user_id: Optional[str] = Header("user_riya")):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, org_id, email, name, role, avatar FROM users WHERE id = ?", (x_user_id,))
        user = cursor.fetchone()
        if not user:
            # Fallback to default user
            cursor.execute("SELECT id, org_id, email, name, role, avatar FROM users LIMIT 1")
            user = cursor.fetchone()
        return user

