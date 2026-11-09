"""KI-Dolmetscher Server (FastAPI).

Start:  cd server && uvicorn app.main:create_app --factory --no-access-log
(--no-access-log: Zugriffsprotokolle enthalten sonst URLs; wir wollen nur Zaehler/Zeiten.)

Datenschutz (Regel 1): nichts wird gespeichert, keine Inhalts-Logs, keine Cookies.
"""
from __future__ import annotations

import asyncio
import contextlib
import hmac
import json
import logging
import time
from typing import Callable, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, Header, HTTPException, WebSocket
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import Settings
from .messages import (RTL_LANGS, WS_BAD_REQUEST, WS_CONFLICT, WS_EXPIRED, WS_FULL,
                       WS_NOT_FOUND, WS_UNAUTHORIZED, control_message)
from .orchestrator import Orchestrator
from .pipeline import build_pipeline
from .pipeline.base import Pipeline
from .rooms import END, RoomError, RoomFullError, RoomManager, TokenError
from .security import BASE_HEADERS, build_csp, collect_page_hashes

log = logging.getLogger("kidolmetscher")
if not log.handlers:        # Zeitstempel + Zaehler/Dauern, nie Inhalte (siehe orchestrator.py)
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(name)s %(message)s"))
    log.addHandler(_h)
    log.setLevel(logging.INFO)

HELLO_TIMEOUT_S = 10
MAX_FRAME_BYTES = 64_000          # ein Audio-Block (PCM16); 50 ms bei 16 kHz sind 1600 Byte
MAX_AUDIO_QUEUE = 100             # Blocks; bei Rueckstau werden alte verworfen und gezaehlt
REAPER_INTERVAL_S = 30


class LinkRequest(BaseModel):
    lang: str
    ttl_s: Optional[int] = None


def create_app(settings: Optional[Settings] = None, pipeline: Optional[Pipeline] = None,
               clock: Callable[[], float] = time.time) -> FastAPI:
    settings = settings or Settings.from_env()
    pipeline = pipeline or build_pipeline(settings)
    rooms = RoomManager(settings, clock)
    page_hashes = collect_page_hashes(settings.web_dir)

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        await pipeline.load()          # echte Stufen: bricht mit klarer Meldung ab (TODO-Geruest)

        async def reaper():
            while True:
                await asyncio.sleep(REAPER_INTERVAL_S)
                n = rooms.purge_expired()
                if n:
                    log.info("raeume_abgelaufen=%d", n)

        task = asyncio.create_task(reaper())
        try:
            yield
        finally:
            task.cancel()
            for rid in list(rooms._rooms):        # Sitzungsende: alles loeschen
                rooms.close_room(rid)

    app = FastAPI(title="KI-Dolmetscher", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings, app.state.rooms, app.state.pipeline = settings, rooms, pipeline

    # ---------- Sicherheits-Header ----------
    @app.middleware("http")
    async def security_headers(request, call_next):
        resp = await call_next(request)
        for k, v in BASE_HEADERS.items():
            resp.headers[k] = v
        scripts, styles = page_hashes.get(request.url.path, ([], []))
        resp.headers["Content-Security-Policy"] = build_csp(scripts, styles)
        return resp

    # ---------- Hilfen ----------
    def require_operator(key: Optional[str]) -> None:
        if not key_ok(key):
            raise HTTPException(status_code=401, detail="Bedienschluessel falsch")

    def key_ok(key: Optional[str]) -> bool:
        return isinstance(key, str) and hmac.compare_digest(
            key.encode("utf-8"), settings.operator_key.encode("utf-8"))

    def origin_ok(ws: WebSocket) -> bool:
        """Schutz gegen fremde Webseiten: Origin muss zum Host passen (fehlt Origin: kein Browser)."""
        origin = ws.headers.get("origin")
        return not origin or urlparse(origin).netloc == ws.headers.get("host")

    async def read_hello(ws: WebSocket) -> Optional[dict]:
        try:
            raw = await asyncio.wait_for(ws.receive_text(), HELLO_TIMEOUT_S)
            data = json.loads(raw)
            return data if isinstance(data, dict) and data.get("type") == "hello" else None
        except Exception:
            return None

    async def safe_close(ws: WebSocket, code: int) -> None:
        with contextlib.suppress(Exception):
            await ws.close(code=code)

    # ---------- REST ----------
    @app.get("/healthz")
    async def healthz():
        return {"status": "ok"}

    @app.post("/api/rooms")
    async def create_room(x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key)
        room = rooms.create_room()
        return {"room_id": room.id, "langs": list(settings.target_langs),
                "expires_in_s": settings.room_ttl_s, "sample_rate": settings.sample_rate,
                "listener_ttl_s": settings.listener_ttl_s,
                "min_listener_ttl_s": settings.min_listener_ttl_s,
                "max_listener_ttl_s": settings.max_listener_ttl_s}

    @app.post("/api/rooms/{room_id}/listener-links")
    async def create_link(room_id: str, body: LinkRequest, x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key)
        room = rooms.get(room_id)
        if room is None:
            raise HTTPException(404, "Raum unbekannt")
        try:
            token, expires_at = room.create_listener_token(body.lang, body.ttl_s)
        except RoomError as exc:
            raise HTTPException(400, str(exc))
        # Token im Fragment (#), damit er nie in Server-Logs oder Referrer landet.
        return {"token": token, "path": f"/listener.html#t={token}", "lang": body.lang,
                "expires_in_s": max(0, int(expires_at - clock()))}

    @app.get("/api/rooms/{room_id}/stats")
    async def stats(room_id: str, x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key)
        room = rooms.get(room_id)
        if room is None:
            raise HTTPException(404, "Raum unbekannt")
        return room.stats()

    @app.delete("/api/rooms/{room_id}")
    async def delete_room(room_id: str, x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key)
        if not rooms.close_room(room_id):
            raise HTTPException(404, "Raum unbekannt")
        return {"closed": True}

    # ---------- WebSocket: Bedienplatz ----------
    @app.websocket("/ws/operator")
    async def ws_operator(ws: WebSocket):
        if not origin_ok(ws):
            await ws.close(code=1008)
            return
        await ws.accept()
        hello = await read_hello(ws)
        if hello is None:
            return await safe_close(ws, WS_BAD_REQUEST)
        if not key_ok(hello.get("operator_key")):
            return await safe_close(ws, WS_UNAUTHORIZED)
        room = rooms.get(str(hello.get("room_id", "")))
        if room is None:
            return await safe_close(ws, WS_NOT_FOUND)
        if room.operator_active:
            return await safe_close(ws, WS_CONFLICT)

        room.operator_active = True
        orch = Orchestrator(room, pipeline, settings)
        audio_q: asyncio.Queue = asyncio.Queue(MAX_AUDIO_QUEUE)

        async def send_to_operator(msgs):
            for m in msgs:
                await ws.send_json(m.to_dict(for_listener=False))

        async def worker():
            while True:
                pcm = await audio_q.get()
                if pcm is None:
                    return
                try:
                    await send_to_operator(await orch.on_audio(pcm))
                except Exception as exc:       # nie Inhalte loggen, nur den Typ
                    room.counters["pipeline_errors"] += 1
                    log.error("pipeline_fehler typ=%s", type(exc).__name__)

        worker_task = asyncio.create_task(worker())
        try:
            await ws.send_json(control_message("ready", langs=list(settings.target_langs),
                                               sample_rate=settings.sample_rate))
            while not room.closed:
                msg = await ws.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                data = msg.get("bytes")
                if data is not None:
                    if len(data) > MAX_FRAME_BYTES or len(data) % 2:
                        room.counters["bad_frames"] += 1
                        continue
                    if audio_q.full():
                        audio_q.get_nowait()
                        room.counters["audio_dropped"] += 1
                    audio_q.put_nowait(data)
                elif msg.get("text"):
                    try:
                        if json.loads(msg["text"]).get("type") == "end":
                            break
                    except Exception:
                        room.counters["bad_frames"] += 1
        finally:
            if audio_q.full():
                audio_q.get_nowait()
            audio_q.put_nowait(None)
            with contextlib.suppress(Exception):
                await asyncio.wait_for(worker_task, 5)
            worker_task.cancel()
            with contextlib.suppress(Exception):
                await send_to_operator(await orch.finish())
            room.operator_active = False
            await safe_close(ws, 1000)

    # ---------- WebSocket: Zuhoerer ----------
    @app.websocket("/ws/listener")
    async def ws_listener(ws: WebSocket):
        if not origin_ok(ws):
            await ws.close(code=1008)
            return
        await ws.accept()
        hello = await read_hello(ws)
        token = hello.get("token") if hello else None
        if not isinstance(token, str) or len(token) > 128:
            return await safe_close(ws, WS_BAD_REQUEST)
        try:
            room, listener = rooms.attach_listener(token)
        except RoomFullError:
            await ws.send_json(control_message("error", code="room_full"))
            return await safe_close(ws, WS_FULL)
        except TokenError:
            await ws.send_json(control_message("error", code="token_invalid"))
            return await safe_close(ws, WS_UNAUTHORIZED)

        async def drain():             # erkennt, wenn der Client geht
            while True:
                if (await ws.receive())["type"] == "websocket.disconnect":
                    return

        recv_task = asyncio.create_task(drain())
        get_task: Optional[asyncio.Task] = None
        try:
            await ws.send_json(control_message(
                "ready", lang=listener.lang, rtl=listener.lang in RTL_LANGS,
                expires_in_s=max(0, int(listener.expires_at - clock()))))
            for m in room.replay(listener.lang):
                await ws.send_json(m)
            while True:
                remaining = listener.expires_at - clock()
                if remaining <= 0:
                    await ws.send_json(control_message("token_expired"))
                    await safe_close(ws, WS_EXPIRED)
                    break
                if get_task is None:
                    get_task = asyncio.create_task(listener.queue.get())
                done, _ = await asyncio.wait({get_task, recv_task}, timeout=remaining,
                                             return_when=asyncio.FIRST_COMPLETED)
                if recv_task in done:
                    break
                if get_task in done:
                    item, get_task = get_task.result(), None
                    if item is END:
                        await ws.send_json(control_message("session_end"))
                        await safe_close(ws, 1000)
                        break
                    await ws.send_json(item)
        except Exception:
            pass                        # Verbindung weg; Aufraeumen unten
        finally:
            for t in (recv_task, get_task):
                if t is not None:
                    t.cancel()
            room.detach_listener(listener)

    # ---------- Statische Dateien (alles lokal) ----------
    @app.get("/", include_in_schema=False)
    async def root():
        return RedirectResponse("/operator.html")

    if settings.web_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.web_dir, html=True), name="web")
    return app
