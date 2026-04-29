"""Auth helpers: password hashing and JWT token issue/verify.

Tokens are HS256 with a configurable secret + 24-hour expiry. The secret should
come from an env var in any non-local environment; the default is fine for
local-only use.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, UserRole

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me-before-cloud")
JWT_ALGO = "HS256"
JWT_TTL = timedelta(hours=24)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

# bcrypt has a 72-byte ceiling on the input. Truncate explicitly so callers
# never hit a ValueError, matching standard library behaviour.
_BCRYPT_LIMIT = 72


def _enc(plain: str) -> bytes:
    return plain.encode("utf-8")[:_BCRYPT_LIMIT]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_enc(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_enc(plain), hashed.encode("utf-8"))
    except ValueError:
        return False


def issue_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "exp": datetime.now(timezone.utc) + JWT_TTL,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Returns the current user if a valid token is present, else None.

    Use this on routes that should still work for anonymous callers but want
    to attribute audit-log entries when a user IS authenticated. With auth
    fully enforced, switch callers to `get_current_user`.
    """
    if not token:
        return None
    payload = _decode(token)
    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError):
        return None
    user = db.get(User, user_id)
    if not user or not user.is_active:
        return None
    return user


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = _decode(token)
    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token subject")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or disabled")
    return user


def require_role(*roles: UserRole):
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user
    return _dep
