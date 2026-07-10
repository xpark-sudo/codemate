"""
Password hashing and validation utilities.
"""
import hashlib
import secrets


def hash_password(password: str) -> str:
    """Hash a password using SHA-256 with a random salt."""
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hashed}"


def check_password(password: str, stored_hash: str) -> bool:
    """Verify a password against its stored hash."""
    salt, original = stored_hash.split("$", 1)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return hashed == original


def generate_api_key() -> str:
    """Generate a random API key."""
    return "ak_" + secrets.token_hex(24)
