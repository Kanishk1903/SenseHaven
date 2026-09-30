"""Production static serving (P4.1): the API serves the built SPA (LEAN §1.2, D-4 one deployable)."""
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings
from .problems import problem_response

WEB_DIST = Path(__file__).resolve().parent.parent.parent / "web" / "dist"

# The SPA fallback must never mask these paths — smoke_prod asserts they 404 (P7.4).
REFUSED_PATHS = {"docs", "redoc", "openapi.json"}

IMMUTABLE_CACHE = "public, max-age=31536000, immutable"


class ImmutableStaticFiles(StaticFiles):
    """Content-hashed assets are cached forever."""

    def file_response(self, *args, **kwargs):  # noqa: ANN002, ANN003
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = IMMUTABLE_CACHE
        return response


def mount_static(app: FastAPI, settings: Settings, web_dist: Path | None = None) -> None:
    dist = web_dist if web_dist is not None else WEB_DIST
    if not settings.is_production or not dist.is_dir():
        return
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", ImmutableStaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str, request: Request) -> FileResponse:
        if full_path in REFUSED_PATHS or full_path.startswith("api/"):
            return problem_response(request, 404, "NOT_FOUND",
                                    "We couldn't find that. It may have been removed — head back and try again.")
        target = (dist / full_path).resolve()
        if full_path and target.is_file() and dist.resolve() in target.parents:
            headers = {"Cache-Control": IMMUTABLE_CACHE} if full_path.startswith("assets/") else {}
            return FileResponse(target, headers=headers)
        return FileResponse(dist / "index.html", headers={"Cache-Control": "no-cache"})
