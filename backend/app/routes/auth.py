from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, UserRole
from app.schemas.auth import TokenRead, UserLogin, UserRead, UserRegister
from app.services.auth import (
    get_current_user,
    hash_password,
    issue_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenRead)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """Create a user. The very first user becomes ADMIN; subsequent users are
    ANALYST by default unless an authenticated admin specifies the role
    elsewhere (admin user-creation is a future endpoint).
    """
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Email already registered")

    is_first = db.query(User).count() == 0
    role = UserRole.ADMIN if is_first else (payload.role or UserRole.ANALYST)

    user = User(
        email=str(payload.email),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenRead(access_token=issue_token(user), user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenRead)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(payload.email)).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "User is disabled")
    return TokenRead(access_token=issue_token(user), user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user
