from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import TokenData

security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        clerk_id: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        if clerk_id is None:
            return None
        return TokenData(clerk_id=clerk_id, user_id=user_id)
    except JWTError:
        return None


def verify_clerk_token(token: str) -> Optional[dict]:
    """
    Verify Clerk JWT token.
    In production, use Clerk's JWKS endpoint for proper verification.
    For hackathon, we'll decode without verification (trust Clerk).
    """
    try:
        # For hackathon: decode without verification
        # In production: fetch JWKS from https://YOUR_CLERK_DOMAIN/.well-known/jwks.json
        payload = jwt.decode(
            token,
            options={"verify_signature": False},
            algorithms=["RS256"]
        )
        return payload
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    
    # Try Clerk token first (production)
    clerk_payload = verify_clerk_token(token)
    if clerk_payload and clerk_payload.get("sub"):
        clerk_id = clerk_payload["sub"]
        user = db.query(User).filter(User.clerk_id == clerk_id).first()
        if user:
            return user
        # Auto-create user from Clerk
        user = User(
            clerk_id=clerk_id,
            email=clerk_payload.get("email", ""),
            full_name=clerk_payload.get("name", ""),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    # Fallback to our own JWT (development)
    token_data = verify_token(token)
    if token_data is None or token_data.clerk_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.clerk_id == token_data.clerk_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user


def require_role(allowed_roles: list):
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user
    return role_checker