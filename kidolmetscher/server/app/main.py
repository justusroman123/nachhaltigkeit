"""KI-Dolmetscher Server (FastAPI).

Start:  cd server && uvicorn app.main:create_app --factory --no-access-log
(--no-access-log: Zugriffsprotokolle enthalten sonst URLs; wir wollen nur Zaehler/Zeiten.)

Datenschutz (Regel 1): nichts wird gespeichert, keine Inhalts-Logs, keine Cookies.
"""
from __future__ import annotations

import asyncio
import contextlib
import hmac
import io
import json
import logging
import time
from typing import Callable, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, Header, HTTPException, WebSocket
from fastapi.responses import RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
import segno
from pydantic import BaseModel

from .config import Settings
from .messages import (RTL_LANGS, WS_BAD_REQUEST, WS_CONFLICT, WS_EXPIRED, WS_FULL,
                       WS_NOT_FOUND, WS_UNAUTHORIZED, control_message)
from .orchestrator import Orchestrator
from .pipeline import build_pipeline
from .pipeline.base import Pipeline
from .rooms import END, LanguageError, RoomError, RoomFullError, RoomManager, TokenError
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


class RoomRequest(BaseModel):
    langs: Optional[list[str]] = None      # angebotene Sprachen; leer = alle aus TARGET_LANGS


class LinkRequest(BaseModel):
    lang: Optional[str] = None             # None = Sammel-Link, Zuhoerer waehlt selbst
    ttl_s: Optional[int] = None


class SessionRequest(BaseModel):
    langs: Optional[list[str]] = None
    ttl_s: Optional[int] = None


class QrRequest(BaseModel):
    url: str


def create_app(settings: Optional[Settings] = None, pipeline: Optional[Pipeline] = None,
               clock: Callable[[], float] = time.time) -> FastAPI:
    settings = settings or Settings.from_env()
    pipeline = pipeline or build_pipeline(settings)
    rooms = RoomManager(settings, clock)
    page_hashes = collect_page_hashes(settings.web_dir)
    started_at = clock()

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
        if not settings.origin_check:
            return True
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

    @app.get("/api/config")
    async def public_config():
        """Nur unkritische Werte, damit die Oberflaeche die Auswahl anzeigen kann."""
        return {"langs": list(settings.target_langs), "default_langs": list(settings.default_langs),
                "public_url": settings.public_url,
                "listener_ttl_s": settings.listener_ttl_s,
                "min_listener_ttl_s": settings.min_listener_ttl_s,
                "max_listener_ttl_s": settings.max_listener_ttl_s}

    @app.post("/api/rooms")
    async def create_room(body: Optional[RoomRequest] = None,
                          x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key)
        try:
            room = rooms.create_room(body.langs if body else None)
        except LanguageError as exc:
            raise HTTPException(400, str(exc))
        return {"room_id": room.id, "langs": list(room.langs),
                "expires_in_s": settings.room_ttl_s, "sample_rate": settings.sample_rate,
                "listener_ttl_s": settings.listener_ttl_s,
                "min_listener_ttl_s": settings.min_listener_ttl_s,
                "max_listener_ttl_s": settings.max_listener_ttl_s}

    def make_link(room, lang: Optional[str], ttl_s: Optional[int]) -> dict:
        try:
            token, expires_at = room.create_listener_token(lang, ttl_s)
        except RoomError as exc:
            raise HTTPException(400, str(exc))
        # Token im Fragment (#), damit er nie in Server-Logs oder Referrer landet.
        lang_part = f"&l={lang}" if lang else ""
        return {"token": token, "path": f"/listener.html#t={token}{lang_part}", "lang": lang,
                "expires_in_s": max(0, int(expires_at - clock()))}

    @app.post("/api/rooms/{room_id}/listener-links")
    async def create_link(room_id: str, body: LinkRequest, x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key)
        room = rooms.get(room_id)
        if room is None:
            raise HTTPException(404, "Raum unbekannt")
        return make_link(room, body.lang, body.ttl_s)

    @app.post("/api/session")
    async def create_session(body: Optional[SessionRequest] = None,
                             x_operator_key: Optional[str] = Header(default=None)):
        """Plan, Phase 3: erstellt eine Sitzung und gibt Sammel-Link sowie Links je Sprache zurueck."""
        require_operator(x_operator_key)
        body = body or SessionRequest()
        try:
            room = rooms.create_room(body.langs)
        except LanguageError as exc:
            raise HTTPException(400, str(exc))
        return {"room_id": room.id, "langs": list(room.langs), "sample_rate": settings.sample_rate,
                "shared": make_link(room, None, body.ttl_s),
                "links": {l: make_link(room, l, body.ttl_s) for l in room.langs}}

    @app.post("/api/qr")
    async def qr_code(body: QrRequest, x_operator_key: Optional[str] = Header(default=None)):
        """QR-Code als SVG. Die Adresse wird nicht gespeichert."""
        require_operator(x_operator_key)
        if len(body.url) > 400 or not body.url.startswith(("http://", "https://")):
            raise HTTPException(400, "Ungueltige Adresse")
        buf = io.BytesIO()
        segno.make(body.url, error="m", micro=False).save(
            buf, kind="svg", scale=8, border=2, dark="black", light="white", xmldecl=False)
        return Response(content=buf.getvalue(), media_type="image/svg+xml")

    @app.get("/api/rooms/{room_id}/stats")
    async def stats(room_id: str, x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key)
        room = rooms.get(room_id)
        if room is None:
            raise HTTPException(404, "Raum unbekannt")
        s = room.stats()
        s["server_uptime_s"] = max(0, int(clock() - started_at))     # Laufzeit dieser Anwendung, nicht der VM
        s["server_hourly_eur"] = settings.server_hourly_eur or None
        s["budget_eur"] = settings.budget_eur or None
        return s

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
        send_lock = asyncio.Lock()             # ein Sender zur Zeit (Untertitel und Ping-Antwort)

        async def to_operator(obj: dict) -> None:
            async with send_lock:
                await ws.send_json(obj)

        async def sink(m) -> None:
            await to_operator(m.to_dict(for_listener=False))

        orch = Orchestrator(room, pipeline, settings, sink=sink)
        audio_q: asyncio.Queue = asyncio.Queue(MAX_AUDIO_QUEUE)

        async def worker():
            while True:
                pcm = await audio_q.get()
                if pcm is None:
                    return
                try:
                    await orch.on_audio(pcm)
                except Exception as exc:       # nie Inhalte loggen, nur den Typ
                    room.counters["pipeline_errors"] += 1
                    log.error("pipeline_fehler typ=%s", type(exc).__name__)

        worker_task = asyncio.create_task(worker())
        try:
            await to_operator(control_message("ready", langs=list(room.langs),
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
                        data_t = json.loads(msg["text"])
                        kind = data_t.get("type")
                        if kind == "end":
                            break
                        if kind == "ping" and isinstance(data_t.get("t"), (int, float)):
                            await to_operator(control_message("pong", t=data_t["t"]))   # Netz-Laufzeit-Messung
                    except Exception:
                        room.counters["bad_frames"] += 1
        finally:
            try:
                if audio_q.full():
                    audio_q.get_nowait()
                audio_q.put_nowait(None)
                with contextlib.suppress(Exception):
                    await asyncio.wait_for(worker_task, 5)
                worker_task.cancel()
                with contextlib.suppress(Exception):
                    await orch.finish()        # Rest ausgeben, Puffer loeschen, Arbeiter beenden
                await safe_close(ws, 1000)
            finally:
                # Auch wenn das Aufraeumen abgebrochen wird (z. B. Serverstopp): Bedienplatz wieder freigeben
                worker_task.cancel()
                orch.cancel_workers()
                room.operator_active = False

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

        def ready_message() -> dict:
            return control_message(
                "ready", lang=listener.lang, langs=list(room.langs),
                rtl=listener.lang in RTL_LANGS,
                expires_in_s=max(0, int(listener.expires_at - clock())))

        def select(lang: object) -> bool:
            """Sprache waehlen/wechseln; bei Erfolg kommen ready + letzte Untertitel in die Warteschlange."""
            try:
                room.select_language(listener, str(lang))
            except RoomError:
                listener.push(control_message("error", code="lang_invalid"))
                return False
            listener.push(ready_message())
            for m in room.replay(listener.lang):
                listener.push(m)
            return True

        async def drain():             # liest Auswahl-Nachrichten, erkennt, wenn der Client geht
            while True:
                msg = await ws.receive()
                if msg["type"] == "websocket.disconnect":
                    return
                try:
                    data = json.loads(msg.get("text") or "")
                except ValueError:
                    continue
                if isinstance(data, dict) and data.get("type") == "select":
                    select(data.get("lang"))

        recv_task = asyncio.create_task(drain())
        get_task: Optional[asyncio.Task] = None
        try:
            if listener.lang is None and isinstance(hello.get("lang"), str):
                if not select(hello["lang"]):       # z. B. nach Neuladen, Sprache nicht mehr angeboten
                    listener.push(ready_message())
            else:
                await ws.send_json(ready_message())
                for m in room.replay(listener.lang) if listener.lang else ():
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
