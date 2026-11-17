"""KI-Dolmetscher Server (FastAPI).

Start:  cd server && python -m app        (sichere Voreinstellungen: kein Zugriffslog, keine Proxy-Header im Log, kleine Frames)
Von Hand:  uvicorn app.main:create_app --factory --no-access-log --no-proxy-headers --log-level warning --ws-max-size 65536
(Zugriffsprotokolle enthalten sonst URLs und Adressen; wir wollen nur Zaehler/Zeiten.)

Datenschutz (Regel 1): nichts wird gespeichert, keine Inhalts-Logs, keine Cookies.
"""
from __future__ import annotations

import asyncio
import contextlib
import hmac
import io
import json
import logging
import math
import sys
import time
from array import array
from typing import Callable, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, Header, HTTPException, Request, WebSocket
from fastapi.responses import RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
import segno
from pydantic import BaseModel

from .config import Settings
from .messages import (RTL_LANGS, WS_BAD_REQUEST, WS_CONFLICT, WS_EXPIRED, WS_FULL, WS_NOT_FOUND,
                       WS_RATE_LIMITED, WS_UNAUTHORIZED, control_message)
from .conversation import GuestPath
from .orchestrator import Orchestrator
from .pipeline import build_pipeline
from .pipeline.base import Pipeline
from .rooms import END, LanguageError, RoomError, RoomFullError, RoomManager, TokenError
from .turns import SPRICHT
from .security import (BASE_HEADERS, BodyLimitMiddleware, FailureLimiter, RateBucket, build_csp, client_of,
                       collect_page_hashes)

log = logging.getLogger("kidolmetscher")
if not log.handlers:        # Zeitstempel + Zaehler/Dauern, nie Inhalte (siehe orchestrator.py)
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(name)s %(message)s"))
    log.addHandler(_h)
    log.setLevel(logging.INFO)


class _DropConnectionLines(logging.Filter):
    """uvicorn schreibt je WebSocket-Verbindung eine INFO-Zeile mit der Adresse des Besuchers ("<ip>:<port> - "WebSocket /ws/..." [accepted]").
    Wird der Server doch von Hand mit `uvicorn ...` gestartet (statt `python -m app`), halten wir diese Zeilen hiermit aus dem Log."""
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:
            return True
        return not (msg.startswith(("connection open", "connection closed")) or '"WebSocket' in msg or "- \"GET" in msg)


for _name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
    logging.getLogger(_name).addFilter(_DropConnectionLines())
# Bibliotheken koennen in Warnungen Textteile nennen (z. B. Piper: "Missing phoneme from id map: <Zeichen>"): nur Fehler durchlassen
for _noisy in ("piper", "faster_whisper", "ctranslate2"):
    logging.getLogger(_noisy).setLevel(logging.ERROR)


def pcm_rms(pcm: bytes) -> float:
    """Effektivwert eines PCM16-Blocks (Little Endian). Dient nur der Pruefung "es wird gehoert" (Stille-Frist), nichts wird behalten."""
    n = len(pcm) // 2
    if n == 0:
        return 0.0
    a = array("h")
    a.frombytes(pcm[: n * 2])
    if sys.byteorder == "big":
        a.byteswap()
    return math.sqrt(sum(x * x for x in a) / n)


HELLO_TIMEOUT_S = 10
MAX_HELLO_BYTES = 4096            # das erste Frame (hello) ist winzig; alles Groessere wird vor dem Parsen abgewiesen
MAX_HELLO_TOTAL = 64              # gleichzeitig wartende, noch nicht angemeldete WebSocket-Verbindungen insgesamt
MAX_HELLO_PER_CLIENT = 8          # ... und je Absender
MAX_BODY_BYTES = 16_384           # groesster HTTP-Koerper (Einladungen, QR-Adresse sind winzig)
MAX_FRAME_BYTES = 64_000          # ein Audio-Block des Bedienplatzes (PCM16); 50 ms bei 16 kHz sind 1600 Byte
MAX_GUEST_FRAME_BYTES = 16_000    # ein Audio-Block eines Gastes (0,5 s); der Browser sendet 1600 Byte
GUEST_AUDIO_FACTOR = 1.5          # Gast-Audio darf hoechstens so viel schneller als Echtzeit zufliessen (Tablet-Stau darf nachgeliefert werden)
GUEST_AUDIO_BURST_S = 30          # Vorrat in Audio-Sekunden fuer solche Nachlieferungen
CTL_BURST, CTL_PER_S = 60, 20     # Steuernachrichten je Verbindung: Vorrat und Nachschub je Sekunde (normal: wenige je Minute)
CTL_DROP_CLOSE = 200              # so viele verworfene Steuernachrichten, dann wird die Verbindung beendet
MAX_AUDIO_QUEUE = 3000            # Blocks (150 s); Audio wird praktisch nie verworfen, sonst gingen Woerter verloren
_END_UTTERANCE = object()         # Marker in der Audio-Warteschlange: Aussage des Mitarbeiters ist zu Ende (Gespraechsmodus)
REAPER_INTERVAL_S = 30
TICK_INTERVAL_S = 0.2             # Zeitgrenzen der Sperre pruefen (unabhaengig davon, ob ein Bedienplatz verbunden ist)


class RoomRequest(BaseModel):
    langs: Optional[list[str]] = None      # angebotene Sprachen; leer = alle aus TARGET_LANGS
    mode: Optional[str] = None             # "vortrag" (Standard) oder "gespraech" - genau zwei Betriebsarten


class LinkRequest(BaseModel):
    lang: Optional[str] = None             # None = Sammel-Link, Zuhoerer waehlt selbst
    ttl_s: Optional[int] = None


class SessionRequest(BaseModel):
    langs: Optional[list[str]] = None
    ttl_s: Optional[int] = None


class QrRequest(BaseModel):
    url: str


def create_app(settings: Optional[Settings] = None, pipeline: Optional[Pipeline] = None,
               clock: Callable[[], float] = time.time, turn_clock: Optional[Callable[[], float]] = None) -> FastAPI:
    settings = settings or Settings.from_env()
    pipeline = pipeline or build_pipeline(settings)
    rooms = RoomManager(settings, clock, turn_clock)
    page_hashes = collect_page_hashes(settings.web_dir)
    started_at = clock()
    limiter = FailureLimiter(settings.auth_max_fails, settings.auth_window_s, settings.auth_block_s, clock)
    trusted = settings.trusted_proxies
    hello_open: dict[str, int] = {}
    background: set = set()                       # Aufgaben, die den Abbruch eines Handlers ueberleben muessen (Rest einer Aussage abschliessen)

    def spawn(coro) -> None:
        t = asyncio.create_task(coro)
        background.add(t)
        t.add_done_callback(background.discard)

    def who_is(conn) -> str:
        return client_of(conn, trusted)

    # Demo ohne Schluessel: nur Host-Namen dieses Rechners (Schutz gegen DNS-Rebinding: fremde Seite mit eigenem Namen -> 127.0.0.1)
    demo_open = settings.allow_no_key and not settings.operator_key
    allowed_hosts: Optional[set] = None
    if demo_open and settings.host_check:
        allowed_hosts = {"localhost", "127.0.0.1", "[::1]"}
        if settings.public_url:
            allowed_hosts.add((urlparse(settings.public_url).hostname or "").lower())

    def host_ok(conn) -> bool:
        if allowed_hosts is None:
            return True
        h = (conn.headers.get("host") or "").strip().lower()
        h = h.split("]")[0] + "]" if h.startswith("[") else h.split(":")[0]
        return h in allowed_hosts

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        await pipeline.load()          # echte Stufen: bricht mit klarer Meldung ab (TODO-Geruest)

        async def reaper():
            while True:
                await asyncio.sleep(REAPER_INTERVAL_S)
                limiter.purge()
                n = rooms.purge_expired()
                if n:
                    log.info("raeume_abgelaufen=%d", n)

        async def ticker():
            """Zeitgrenzen der Sperre fuer alle Raeume, auch wenn gerade kein Bedienplatz verbunden ist."""
            while True:
                await asyncio.sleep(TICK_INTERVAL_S)
                for room in rooms.all_rooms():
                    try:
                        room.turns.tick()
                        if room.flow.tick():                        # Geraet meldet nicht "fertig": dem Bedienplatz sagen
                            room.push_operator(control_message("problem", what="geraet_antwortet_nicht"))
                    except Exception as exc:
                        log.error("tick_fehler typ=%s", type(exc).__name__)

        tasks = [asyncio.create_task(reaper()), asyncio.create_task(ticker())]
        try:
            yield
        finally:
            for t in tasks + list(background):
                t.cancel()
            for rid in list(rooms.room_ids()):        # Sitzungsende: alles loeschen
                rooms.close_room(rid)

    app = FastAPI(title="KI-Dolmetscher", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings, app.state.rooms, app.state.pipeline = settings, rooms, pipeline
    app.add_middleware(BodyLimitMiddleware, max_bytes=MAX_BODY_BYTES)

    # ---------- Sicherheits-Header ----------
    @app.middleware("http")
    async def security_headers(request, call_next):
        if not host_ok(request):
            resp = Response("Host nicht erlaubt", status_code=421)
        else:
            resp = await call_next(request)
        for k, v in BASE_HEADERS.items():
            resp.headers[k] = v
        scripts, styles = page_hashes.get(request.url.path, ([], []))
        resp.headers["Content-Security-Policy"] = build_csp(scripts, styles)
        return resp

    # ---------- Hilfen ----------
    def check_key(key: Optional[str], who: str) -> str:
        """Prueft den Bedienschluessel mit Schutz gegen Raten. Rueckgabe: "ok" | "falsch" | "gesperrt"."""
        if limiter.blocked_for(who):
            return "gesperrt"                 # gesperrte Absender zaehlen nicht weiter und bekommen keine Aussage zum Schluessel
        if key_ok(key):
            limiter.success(who)
            return "ok"
        if limiter.failure(who):
            log.warning("bedienschluessel_sperre fehlversuche=%d dauer_s=%d", settings.auth_max_fails, int(settings.auth_block_s))
        return "falsch"

    def require_operator(key: Optional[str], request: Request) -> None:
        who = who_is(request)
        res = check_key(key, who)
        if res == "gesperrt":
            raise HTTPException(status_code=429, detail="Zu viele Fehlversuche, bitte spaeter erneut versuchen",
                                headers={"Retry-After": str(limiter.blocked_for(who))})
        if res != "ok":
            raise HTTPException(status_code=401, detail="Bedienschluessel falsch")

    def key_ok(key: Optional[str]) -> bool:
        if demo_open:
            return True                       # Demo nur auf diesem Rechner (siehe config.validate)
        # surrogatepass: auch ein einzelnes Unicode-Surrogat (gueltiges JSON) darf nicht abstuerzen, es ist einfach ein falscher Schluessel
        return isinstance(key, str) and hmac.compare_digest(
            key.encode("utf-8", "surrogatepass"), settings.operator_key.encode("utf-8", "surrogatepass"))

    def origin_ok(ws: WebSocket) -> bool:
        """Schutz gegen fremde Webseiten: Origin muss zum Host passen (fehlt Origin: kein Browser)."""
        if not settings.origin_check:
            return True
        origin = ws.headers.get("origin")
        return not origin or urlparse(origin).netloc == ws.headers.get("host")

    async def read_hello(ws: WebSocket) -> Optional[dict]:
        """Erstes Frame lesen: klein, rechtzeitig, und nur so viele wartende Verbindungen wie erlaubt (vor jeder Anmeldung)."""
        who = who_is(ws)
        if sum(hello_open.values()) >= MAX_HELLO_TOTAL or hello_open.get(who, 0) >= MAX_HELLO_PER_CLIENT:
            return None
        hello_open[who] = hello_open.get(who, 0) + 1
        try:
            raw = await asyncio.wait_for(ws.receive_text(), HELLO_TIMEOUT_S)
            if len(raw) > MAX_HELLO_BYTES:
                return None
            data = json.loads(raw)
            return data if isinstance(data, dict) and data.get("type") == "hello" else None
        except Exception:
            return None
        finally:
            n = hello_open.get(who, 1) - 1
            if n > 0:
                hello_open[who] = n
            else:
                hello_open.pop(who, None)

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
                "key_required": not demo_open,
                "public_url": settings.public_url,
                "listener_ttl_s": settings.listener_ttl_s,
                "min_listener_ttl_s": settings.min_listener_ttl_s,
                "max_listener_ttl_s": settings.max_listener_ttl_s,
                # Zahlen fuer die Sprech-Anzeige am Bedienplatz (Abschnittsgrenzen der Spracherkennung)
                "utterance_max_s": settings.asr_max_utterance_s, "silence_ms": settings.asr_silence_ms,
                "vad_rms": settings.asr_vad_rms}

    @app.post("/api/rooms")
    async def create_room(request: Request, body: Optional[RoomRequest] = None,
                          x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key, request)
        try:
            room = rooms.create_room(body.langs if body else None, body.mode if body else None)
        except (LanguageError, RoomError) as exc:
            raise HTTPException(400, str(exc))
        return {"room_id": room.id, "langs": list(room.langs), "mode": room.mode,
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
    async def create_link(request: Request, room_id: str, body: LinkRequest, x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key, request)
        room = rooms.get(room_id)
        if room is None:
            raise HTTPException(404, "Raum unbekannt")
        return make_link(room, body.lang, body.ttl_s)

    @app.post("/api/session")
    async def create_session(request: Request, body: Optional[SessionRequest] = None,
                             x_operator_key: Optional[str] = Header(default=None)):
        """Plan, Phase 3: erstellt eine Sitzung und gibt Sammel-Link sowie Links je Sprache zurueck."""
        require_operator(x_operator_key, request)
        body = body or SessionRequest()
        try:
            room = rooms.create_room(body.langs)
        except LanguageError as exc:
            raise HTTPException(400, str(exc))
        return {"room_id": room.id, "langs": list(room.langs), "sample_rate": settings.sample_rate,
                "shared": make_link(room, None, body.ttl_s),
                "links": {l: make_link(room, l, body.ttl_s) for l in room.langs}}

    @app.post("/api/qr")
    async def qr_code(request: Request, body: QrRequest, x_operator_key: Optional[str] = Header(default=None)):
        """QR-Code als SVG. Die Adresse wird nicht gespeichert."""
        require_operator(x_operator_key, request)
        if len(body.url) > 400 or not body.url.startswith(("http://", "https://")):
            raise HTTPException(400, "Ungueltige Adresse")
        buf = io.BytesIO()
        segno.make(body.url, error="m", micro=False).save(
            buf, kind="svg", scale=8, border=2, dark="black", light="white", xmldecl=False)
        return Response(content=buf.getvalue(), media_type="image/svg+xml")

    @app.get("/api/rooms/{room_id}/stats")
    async def stats(request: Request, room_id: str, x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key, request)
        room = rooms.get(room_id)
        if room is None:
            raise HTTPException(404, "Raum unbekannt")
        s = room.stats()
        s["server_uptime_s"] = max(0, int(clock() - started_at))     # Laufzeit dieser Anwendung, nicht der VM
        s["server_hourly_eur"] = settings.server_hourly_eur or None
        s["budget_eur"] = settings.budget_eur or None
        return s

    @app.delete("/api/rooms/{room_id}")
    async def delete_room(request: Request, room_id: str, x_operator_key: Optional[str] = Header(default=None)):
        require_operator(x_operator_key, request)
        if not rooms.close_room(room_id):
            raise HTTPException(404, "Raum unbekannt")
        return {"closed": True}

    # ---------- WebSocket: Bedienplatz ----------
    @app.websocket("/ws/operator")
    async def ws_operator(ws: WebSocket):
        try:
            await _ws_operator(ws)
        except Exception as exc:                       # nie unbehandelt: kein Traceback-Flut, nur der Typ
            log.error("ws_fehler art=operator typ=%s", type(exc).__name__)
            await safe_close(ws, WS_BAD_REQUEST)

    async def _ws_operator(ws: WebSocket):
        if not origin_ok(ws) or not host_ok(ws):
            await ws.close(code=1008)
            return
        await ws.accept()
        hello = await read_hello(ws)
        if hello is None:
            return await safe_close(ws, WS_BAD_REQUEST)
        res = check_key(hello.get("operator_key"), who_is(ws))
        if res == "gesperrt":
            return await safe_close(ws, WS_RATE_LIMITED)
        if res != "ok":
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
            # nicht blockieren: ein langsamer Bedienplatz darf die Uebersetzung nicht aufhalten; Ton braucht der Bedienplatz nicht
            d = m.to_dict(for_listener=False)
            d["audio"] = None
            room.push_operator(d)

        orch = Orchestrator(room, pipeline, settings, sink=sink)
        audio_q: asyncio.Queue = asyncio.Queue(MAX_AUDIO_QUEUE)
        ctl = RateBucket(CTL_BURST, CTL_PER_S)
        ctl_dropped = 0

        async def worker():
            while True:
                pcm = await audio_q.get()
                if pcm is None:
                    return
                if pcm is _END_UTTERANCE:      # Aussage des Mitarbeiters zu Ende: Abschnitt abschliessen, dann Sperre weitergeben
                    try:
                        await orch.end_utterance()
                    except Exception as exc:
                        room.counters["pipeline_errors"] += 1
                        log.error("pipeline_fehler typ=%s", settings.fehler(exc))
                        room.push_operator(control_message("problem", what="spracherkennung"))
                    room.turns.end_speaking("staff")
                    continue
                try:
                    await orch.on_audio(pcm)
                except Exception as exc:       # nie Inhalte loggen, nur den Typ
                    room.counters["pipeline_errors"] += 1
                    log.error("pipeline_fehler typ=%s", settings.fehler(exc))
                    room.push_operator(control_message("problem", what="spracherkennung"))

        async def pump():
            """Nachrichten an den Bedienplatz (Zustand der Sperre, Gast-Aussagen) senden."""
            last_log = time.monotonic()
            while True:
                if time.monotonic() - last_log >= 10:        # Staulog: nur Zaehler, nie Inhalte
                    last_log = time.monotonic()
                    snap = room.flow.snapshot()
                    log.info("stau audio_q=%d op_q=%d offen=%s segmente=%d uebersetzungen=%d fehler=%d",
                             audio_q.qsize(), room._operator_q.qsize(), snap.get("pending"),
                             room.counters["segments"], room.counters["translations"], room.counters["pipeline_errors"])
                item = await room.next_operator_message(0.2)
                try:
                    if item is not None:
                        await to_operator(item)
                    if room.take_lost_operator_messages():     # Ueberlauf: nie still verlieren
                        await to_operator(control_message("problem", what="nachrichten_verworfen"))
                except Exception:
                    return

        worker_task = asyncio.create_task(worker())
        pump_task = asyncio.create_task(pump())
        staff_open = False                      # es wurde Audio des Mitarbeiters angenommen, Aussage noch nicht abgeschlossen

        def end_staff_utterance() -> None:
            nonlocal staff_open
            if staff_open:
                staff_open = False
                if audio_q.full():
                    audio_q.get_nowait()
                audio_q.put_nowait(_END_UTTERANCE)

        try:
            await to_operator(control_message("ready", langs=list(room.langs), sample_rate=settings.sample_rate,
                                              mode=room.mode, turn=room.turns.snapshot(), flow=room.flow.snapshot()))
            while not room.closed:
                msg = await ws.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                data = msg.get("bytes")
                if data is not None:
                    if len(data) > MAX_FRAME_BYTES or len(data) % 2:
                        room.counters["bad_frames"] += 1
                        continue
                    if room.strict:
                        if not (room.turns.state == SPRICHT and room.turns.who == "staff"):
                            end_staff_utterance()          # Zeitgrenze oder Sperre: Rest abschliessen, weitere Audioblocks verwerfen
                            continue
                        staff_open = True
                        if pcm_rms(data) >= settings.asr_vad_rms * 0.5:       # hoerbare Sprache: Stille-Frist zuruecksetzen
                            room.turns.touch("staff")
                    if audio_q.full():
                        audio_q.get_nowait()
                        room.counters["audio_dropped"] += 1
                        room.push_operator(control_message("problem", what="audio_verworfen"))   # nicht still verlieren
                    audio_q.put_nowait(data)
                elif msg.get("text"):
                    if not ctl.allow():                            # Steuernachrichten fluten: verwerfen, bei Dauerflut trennen
                        ctl_dropped += 1
                        room.counters["ctl_dropped"] += 1
                        if ctl_dropped > CTL_DROP_CLOSE:
                            break
                        continue
                    try:
                        data_t = json.loads(msg["text"])
                        kind = data_t.get("type")
                        if kind == "end":
                            break
                        if kind == "ping" and isinstance(data_t.get("t"), (int, float)):
                            await to_operator(control_message("pong", t=data_t["t"]))   # Netz-Laufzeit-Messung
                        elif kind == "talk" and room.strict:
                            if data_t.get("on"):
                                ok, _ = room.turns.claim("staff")
                                if not ok:
                                    await to_operator(control_message("busy"))
                            elif room.turns.state == SPRICHT and room.turns.who == "staff":
                                staff_open = True              # auch ohne Audio abschliessen (Marker erzwingen)
                                end_staff_utterance()
                        elif kind == "takeover" and room.strict:   # Vorrang: Mitarbeiter stoppt die andere Person und spricht jetzt
                            ok, why = room.turns.take_over("staff")
                            if not ok and why == "eigene_aussage":
                                room.turns.request("staff")        # eigene Aussage wird noch verteilt: vormerken statt abbrechen
                        elif kind == "want" and room.strict:       # Wortmeldung des Mitarbeiters (keine Unterbrechung)
                            if data_t.get("on"):
                                room.turns.request("staff")
                            else:
                                room.turns.cancel_request("staff")
                        elif kind == "played" and isinstance(data_t.get("seq"), int) and not isinstance(data_t.get("seq"), bool):
                            room.ack("staff", data_t["seq"], "played")     # deutsche Vorlesung der Gast-Antwort ist zu Ende
                        elif kind == "release":
                            room.turns.release()               # Notbremse des Mitarbeiters
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
                pump_task.cancel()
                # Nur die Sache des Mitarbeiters beenden (seine Aussage, Wortmeldung, offene Vorlesungen). Sprechende Gaeste und
                # deren Wortmeldungen bleiben: ein Netzwackler am Bedienplatz darf niemanden mitten im Satz abschneiden.
                room.turns.device_left("staff")
                orch.cancel_workers()
                room.operator_active = False

    # ---------- WebSocket: Zuhoerer ----------
    @app.websocket("/ws/listener")
    async def ws_listener(ws: WebSocket):
        try:
            await _ws_listener(ws)
        except Exception as exc:                       # nie unbehandelt: kein Traceback-Flut, nur der Typ
            log.error("ws_fehler art=zuhoerer typ=%s", type(exc).__name__)
            await safe_close(ws, WS_BAD_REQUEST)

    async def _ws_listener(ws: WebSocket):
        if not origin_ok(ws) or not host_ok(ws):
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
                rtl=listener.lang in RTL_LANGS, mode=room.mode, turn=room.turns.snapshot(),
                device=f"gast:{listener.id}", sample_rate=settings.sample_rate,
                operator_online=room.operator_active,
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

        device = f"gast:{listener.id}"
        guest: Optional[GuestPath] = None
        my_utt = 0                                   # Nummer der eigenen Aussage (schuetzt vor verspaeteten Abschluessen)
        audio_pace = RateBucket(GUEST_AUDIO_BURST_S * settings.sample_rate * 2, GUEST_AUDIO_FACTOR * settings.sample_rate * 2)
        ctl = RateBucket(CTL_BURST, CTL_PER_S)
        ctl_dropped = 0

        async def end_talk(utterance: Optional[int] = None) -> None:
            """Aussage dieses Gastes abschliessen (Fertig, Stopp, Trennung): Rest erkennen und uebersetzen, dann die Sperre weitergeben."""
            if guest is not None:
                await guest.finish()
            room.turns.end_speaking(device, utterance)

        async def ensure_guest() -> bool:
            """Erkennungsstrom des Gastes bereitstellen und die Sperre an ihn binden. False: nicht moeglich (wurde gemeldet)."""
            nonlocal guest
            try:
                if guest is not None and guest.lang != listener.lang:
                    old, guest = guest, None
                    await old.shutdown(settings.stage_timeout_s)
                if guest is None:
                    guest = GuestPath(room, pipeline, settings, listener)
            except Exception as exc:
                room.counters["pipeline_errors"] += 1
                log.error("gast_start_fehler typ=%s", settings.fehler(exc))
                listener.push(control_message("problem", what="spracherkennung"))
                room.push_operator(control_message("problem", what="gast_spracherkennung"))
                return False
            if room.turns.state == SPRICHT and room.turns.who == device:
                guest.begin()
            return True

        async def drain():             # liest Auswahl-Nachrichten und (Gespraechsmodus) Sprechen/Audio/fertig; erkennt, wenn der Client geht
            nonlocal my_utt, ctl_dropped
            while True:
                msg = await ws.receive()
                if msg["type"] == "websocket.disconnect":
                    return
                raw = msg.get("bytes")
                if raw is not None:                         # Audio des Gastes (nur wenn er das Wort hat)
                    if room.mode != "gespraech" or guest is None or len(raw) > MAX_GUEST_FRAME_BYTES or len(raw) % 2:
                        continue
                    if room.turns.state == SPRICHT and room.turns.who == device:
                        if not audio_pace.allow(len(raw)):            # schneller als Echtzeit-Vielfaches: nicht annehmen (aber melden)
                            room.counters["guest_audio_throttled"] += 1
                            if room.counters["guest_audio_throttled"] % 50 == 1:
                                listener.push(control_message("problem", what="audio_verworfen"))
                                room.push_operator(control_message("problem", what="audio_verworfen"))
                            continue
                        if pcm_rms(raw) >= settings.asr_vad_rms * 0.5:
                            room.turns.touch(device)
                        await guest.on_audio(raw)
                    elif guest.busy:
                        await end_talk(my_utt)              # Wort ist weg (Stopp, Zeitgrenze): Rest abschliessen
                    continue
                if not ctl.allow():                         # Steuernachrichten fluten: verwerfen, bei Dauerflut trennen
                    ctl_dropped += 1
                    room.counters["ctl_dropped"] += 1
                    if ctl_dropped > CTL_DROP_CLOSE:
                        return
                    continue
                try:
                    data = json.loads(msg.get("text") or "")
                except ValueError:
                    continue
                if not isinstance(data, dict):
                    continue
                kind = data.get("type")
                if kind == "select":
                    select(data.get("lang"))
                elif kind in ("shown", "played") and isinstance(data.get("seq"), int) and not isinstance(data.get("seq"), bool):
                    room.ack(device, data["seq"], kind)           # Rueckmeldung: angezeigt / fertig gesprochen
                elif room.mode == "gespraech" and listener.lang is not None:
                    if kind == "talk" and data.get("on"):
                        ok, _ = room.turns.claim(device)
                        if ok:
                            my_utt = room.turns.utterance
                            if not await ensure_guest():
                                room.turns.end_speaking(device, my_utt)
                        else:
                            listener.push(control_message("busy"))
                    elif kind == "talk":
                        await end_talk(my_utt)
                    elif kind == "want":                    # Wortmeldung: vorgemerkt, wird automatisch drankommen
                        if data.get("on"):
                            if room.turns.request(device) == "dran":
                                my_utt = room.turns.utterance
                                if not await ensure_guest():
                                    room.turns.end_speaking(device, my_utt)
                        else:
                            room.turns.cancel_request(device)

        recv_task = asyncio.create_task(drain())
        get_task: Optional[asyncio.Task] = None
        cut_tasks: set = set()
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
                    if (isinstance(item, dict) and item.get("type") == "turn" and guest is not None and guest.busy
                            and not (item.get("state") == SPRICHT and item.get("who") == device)):
                        # Mitarbeiter hat das Wort uebernommen (oder lange Stille): bereits Gesagtes abschliessen und uebersetzen
                        cut_task = asyncio.create_task(end_talk(my_utt))
                        cut_tasks.add(cut_task)
                        cut_task.add_done_callback(cut_tasks.discard)
        except Exception:
            pass                        # Verbindung weg; Aufraeumen unten
        finally:
            for t in (recv_task, get_task):
                if t is not None:
                    t.cancel()
            room.detach_listener(listener)
            room.turns.device_left(device)       # Aussage gilt als beendet; die Sperre wartet weiter, bis der Rest uebersetzt ist (Haltemarke)
            room.flow.device_left(device)
            if guest is not None:
                # Den offenen Rest nicht verlieren: abschliessen, uebersetzen lassen und dem Mitarbeiter zustellen, erst dann aufraeumen.
                # Als eigene Aufgabe, damit auch ein abgebrochener Handler (Serverstopp, Testclient) den letzten Satz nicht mitreisst.
                spawn(guest.shutdown(settings.stage_timeout_s))

    # ---------- Statische Dateien (alles lokal) ----------
    @app.get("/", include_in_schema=False)
    async def root():
        return RedirectResponse("/operator.html")

    if settings.web_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.web_dir, html=True), name="web")
    return app
