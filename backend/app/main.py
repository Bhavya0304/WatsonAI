import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from . import db
from .api import admin, public
from .api.deps import client_ip
from .config import ROOT_DIR, get_settings
from .content import get_content
from .logging_setup import log_event, setup_logging
from .rag.index import ensure_index
from .services import reaper

log = logging.getLogger("watson.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    db.init_db()
    get_content()
    await asyncio.to_thread(ensure_index)
    task = asyncio.create_task(reaper.run_forever())
    log.info("Watson is up")
    yield
    task.cancel()


s = get_settings()
app = FastAPI(title="Watson API", lifespan=lifespan, docs_url=None, redoc_url=None)

app.add_middleware(
    SessionMiddleware, secret_key=s.secret_key, session_cookie="watson_admin",
    max_age=60 * 60 * 12, same_site="strict", https_only=s.cookie_secure,
)
app.add_middleware(
    CORSMiddleware, allow_origins=s.cors_origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.middleware("http")
async def request_log(request: Request, call_next):
    started = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        if request.url.path.startswith("/api"):
            latency = int((time.perf_counter() - started) * 1000)
            ip = client_ip(request)
            sid = (request.headers.get("x-session-id") or "")[:64] or None
            entry = dict(ts=db.ts(), ip=ip, method=request.method, path=request.url.path,
                         status=status, latency_ms=latency, session_id=sid)
            log_event("http", "request", **entry)
            try:
                await asyncio.to_thread(db.add_request, **entry)
            except Exception:
                log.exception("failed to store request row")


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("unhandled error on %s", request.url.path)
    return JSONResponse({"detail": "Watson tripped over a cable 🔌 Please try again."}, status_code=500)


app.include_router(public.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"ok": True}


# Serve the built frontend from the same process when it exists (single-port local/LAN runs).
# In production Nginx serves frontend/dist directly and this is never reached for static files.
DIST = ROOT_DIR / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        file = (DIST / path).resolve()
        if path and file.is_file() and DIST.resolve() in file.parents:
            return FileResponse(file)
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})
