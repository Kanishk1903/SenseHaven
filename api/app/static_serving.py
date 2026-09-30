"""Production static serving (P4.1): the API serves the built SPA (LEAN §1.2, D-4 one deployable)."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings

WEB_DIST = Path(__file__).resolve().parent.parent.parent / "web" / "dist"


def mount_static(app: FastAPI, settings: Settings, web_dist: Path | None = None) -> None:
    dist = web_dist if web_dist is not None else WEB_DIST
    if not settings.is_production or not dist.is_dir():
        return
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str) -> FileResponse:
        target = (dist / full_path).resolve()
        if full_path and target.is_file() and dist.resolve() in target.parents:
            headers = (
                {"Cache-Control": "public, max-age=31536000, immutable"}
                if full_path.startswith("assets/")
                else {}
            )
            return FileResponse(target, headers=headers)
        return FileResponse(dist / "index.html", headers={"Cache-Control": "no-cache"})
