from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from backend.config import settings
from backend.database import get_db

bearer_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")

    return get_user_from_access_token(credentials.credentials)


def get_user_from_access_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token") from exc
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, role, org_id, email, avatar FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")
    return dict(user)

def require_role(*roles: str):
    def role_checker(user: dict = Depends(get_current_user)):
        if user['role'] not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Action requires role in {roles}, but current role is '{user['role']}'"
            )
        return user
    return role_checker

def organization_scope(user: dict, requested_org_id: str | None = None) -> str:
    if requested_org_id and requested_org_id != user["org_id"]:
        raise HTTPException(status_code=403, detail="Organization scope does not match authenticated user")
    return user["org_id"]
