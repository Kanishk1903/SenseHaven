"""Cross-cutting middleware (P2.1): request ids + security headers (LEAN §1.2 set)."""
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from .config import Settings

_HOME_SCRIPT = "sha256-qmDYHsvQtl4SIstx1bCCYTQdTu++NZnfxwMcENTH4l4="
_APP_SCRIPT = "sha256-p6pQNuF9Y22V3Uy6QgJaJliL9xWiyWKkBdP5gOkx1/M="
CSP = (
    "default-src 'self'; "
    f"script-src 'self' '{_APP_SCRIPT}' '{_HOME_SCRIPT}'; "
    "img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; "
    "connect-src 'self'; frame-ancestors 'none'"
)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        import uuid

        request.state.request_id = uuid.uuid4().hex[:16]
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings):
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers.setdefault("Content-Security-Policy", CSP)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if self.settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


def install_middleware(app, settings: Settings) -> None:
    app.add_middleware(SecurityHeadersMiddleware, settings=settings)
    app.add_middleware(RequestIdMiddleware)
