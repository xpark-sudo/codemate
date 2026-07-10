"""
Login and registration route handlers.
"""
from src.auth.auth import create_token, verify_token
from src.models.user import User
from src.utils.password import hash_password, check_password

# Mock user database
_users_db: dict[str, User] = {}


def register(username: str, password: str, email: str) -> dict:
    """Register a new user account."""
    if username in _users_db:
        return {"error": "Username already exists", "status": 409}

    user = User(
        id=str(len(_users_db) + 1),
        username=username,
        password_hash=hash_password(password),
        email=email,
        role="viewer",
    )
    _users_db[username] = user
    return {"user": user.to_dict(), "status": 201}


def login(username: str, password: str) -> dict:
    """Authenticate a user and return a JWT token."""
    user = _users_db.get(username)
    if not user:
        return {"error": "User not found", "status": 404}

    if not check_password(password, user.password_hash):
        return {"error": "Invalid password", "status": 401}

    token = create_token(user)
    return {"token": token, "user": user.to_dict()}
