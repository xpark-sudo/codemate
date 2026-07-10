"""
Main application entry point and route registration.
"""
from src.routes.login import register, login
from src.auth.auth import auth_middleware
from src.utils.search import SearchEngine


def create_app():
    """Initialize and configure the application."""
    search_engine = SearchEngine()

    # Register built-in routes
    routes = {
        "POST /register": register,
        "POST /login": login,
    }

    return {
        "routes": routes,
        "search": search_engine,
        "middleware": [auth_middleware],
    }


if __name__ == "__main__":
    app = create_app()
    print(f"App initialized with {len(app['routes'])} routes")
