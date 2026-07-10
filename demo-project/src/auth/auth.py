"""
Authentication middleware and JWT token management.
"""
import jwt
import time
from typing import Optional
from src.models.user import User

JWT_SECRET = "demo-secret-key"
JWT_EXPIRY_HOURS = 24


def create_token(user: User) -> str:
    """Create a JWT token for the given user."""
    payload = {
        "sub": user.id,
        "username": user.username,
        "role": user.role,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_HOURS * 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> Optional[dict]:
    """Verify a JWT token and return the payload, or None if invalid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError:
        return None


def auth_middleware(request):
    """Middleware that validates JWT tokens on protected routes."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"error": "Missing or invalid Authorization header", "status": 401}

    token = auth_header[len("Bearer "):]
    payload = verify_token(token)
    if payload is None:
        return {"error": "Invalid or expired token", "status": 401}

    request.user = payload
    return None  # None means pass through


class AuthGuard:
    """Decorator-based auth guard for route handlers."""

    ROLES_HIERARCHY = {"admin": 3, "editor": 2, "viewer": 1}

    def __init__(self, required_role: str = "viewer"):
        self.required_level = self.ROLES_HIERARCHY.get(required_role, 0)

    def check(self, user_role: str) -> bool:
        user_level = self.ROLES_HIERARCHY.get(user_role, 0)
        return user_level >= self.required_level
