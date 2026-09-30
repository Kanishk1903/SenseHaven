"""problem+json errors with a stable `code` from contracts/error_codes.md (P2.1)."""
import logging
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("senseheaven")

TITLES = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    410: "Gone",
    413: "Content Too Large",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
}

# Fallback mapping for plain HTTPExceptions we did not raise ourselves.
HTTP_TO_CODE = {
    401: "UNAUTHENTICATED",
    403: "CSRF_HEADER_MISSING",
    404: "NOT_FOUND",
    405: "NOT_FOUND",
}


class ApiError(Exception):
    """Raise anywhere in a request to emit a problem+json response with a stable code."""

    def __init__(self, status: int, code: str, detail: str | None = None, headers: dict | None = None):
        self.status = status
        self.code = code
        self.detail = detail
        self.headers = headers
        super().__init__(detail or code)


def _content(status: int, code: str, detail: str | None, request_id: str, extra: dict[str, Any] | None = None) -> dict:
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": TITLES.get(status, "Error"),
        "status": status,
        "code": code,
        "detail": detail,
        "request_id": request_id,
    }
    if extra:
        body.update(extra)
    return body


def problem_response(
    request: Request, status: int, code: str, detail: str | None, extra: dict[str, Any] | None = None
) -> JSONResponse:
    request_id = getattr(getattr(request, "state", None), "request_id", None) or uuid.uuid4().hex[:16]
    return JSONResponse(
        status_code=status,
        media_type="application/problem+json",
        headers={"X-Request-ID": request_id},
        content=_content(status, code, detail, request_id, extra),
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
        response = problem_response(request, exc.status, exc.code, exc.detail)
        if exc.headers:
            for key, value in exc.headers.items():
                response.headers[key] = value
        return response

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields: list[dict[str, Any]] = [
            {"loc": [str(p) for p in err.get("loc", [])], "msg": err.get("msg", "")}
            for err in exc.errors()
        ]
        return problem_response(
            request,
            422,
            "VALIDATION_ERROR",
            "Some details need a fix. Check the highlighted fields and try again.",
            extra={"errors": fields},
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = HTTP_TO_CODE.get(exc.status_code, "INTERNAL_ERROR" if exc.status_code >= 500 else "NOT_FOUND")
        response = problem_response(request, exc.status_code, code, str(exc.detail))
        if exc.headers:
            for key, value in exc.headers.items():
                response.headers[key] = value
        return response

    @app.exception_handler(Exception)
    async def _internal(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error")
        return problem_response(
            request, 500, "INTERNAL_ERROR", "Something went wrong on our side. Try again in a moment."
        )
