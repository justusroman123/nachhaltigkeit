#!/usr/bin/env python3
"""Speist eine Audiodatei wie ein Mikrofon in den Server ein (Plan, Prompt D) und zeigt die Zeitstempel.

Ablauf: Sitzung ueber /api/session anlegen, je Sprache einen Test-Zuhoerer verbinden (ohne Zuhoerer wird nichts
uebersetzt), WAV (16 kHz, mono, 16 Bit) in 100-ms-Bloecken in Echtzeit senden, Ergebnisse als Tabelle ausgeben.
Der Bedienschluessel kommt aus der Umgebung (OPERATOR_KEY), nie aus Argumenten.

Beispiel:  OPERATOR_KEY=... python3 scripts/fake_speaker.py --url http://127.0.0.1:8000 --wav tests/audio/platzhalter/satz03.wav --langs uk,en
"""
import argparse
import asyncio
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))
from app.benchmarks import chunks, md_table, read_wav_pcm16        # noqa: E402

import websockets                                                  # noqa: E402


def api(base, method, path, key, body=None):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-Operator-Key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


async def listener(ws_base, token, lang, received):
    async with websockets.connect(ws_base + "/ws/listener") as ws:
        await ws.send(json.dumps({"type": "hello", "token": token, "lang": lang}))
        async for raw in ws:
            d = json.loads(raw)
            if d["type"] == "translation":
                received.append((lang, d, int(time.time() * 1000)))
            elif d["type"] in ("session_end", "token_expired"):
                return


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--wav", required=True)
    ap.add_argument("--langs", default="uk,en")
    ap.add_argument("--fast", action="store_true", help="ohne Echtzeit-Pause senden")
    ap.add_argument("--tail-s", type=float, default=3.0, help="Wartezeit nach dem letzten Block")
    a = ap.parse_args()
    key = os.environ.get("OPERATOR_KEY")
    if not key:
        sys.exit("OPERATOR_KEY fehlt in der Umgebung.")
    langs = [x for x in a.langs.split(",") if x]
    ws_base = a.url.replace("http", "ws", 1)
    pcm = read_wav_pcm16(a.wav)
    sess = api(a.url, "POST", "/api/session", key, {"langs": langs})
    received: list = []
    tasks = [asyncio.create_task(listener(ws_base, sess["links"][l]["token"], l, received)) for l in langs]
    await asyncio.sleep(0.5)                                   # Zuhoerer anmelden lassen
    async with websockets.connect(ws_base + "/ws/operator") as op:
        await op.send(json.dumps({"type": "hello", "room_id": sess["room_id"], "operator_key": key}))
        ready = json.loads(await op.recv())
        assert ready["type"] == "ready", ready
        sent = 0
        for c in chunks(pcm, ready["sample_rate"], 100):
            await op.send(c)
            sent += 1
            if not a.fast:
                await asyncio.sleep(0.1)
        await asyncio.sleep(a.tail_s)
        await op.send(json.dumps({"type": "end"}))
        await asyncio.sleep(1.0)
    api(a.url, "DELETE", f"/api/rooms/{sess['room_id']}", key)
    await asyncio.gather(*tasks, return_exceptions=True)
    rows = []
    for lang, d, t_recv in sorted(received, key=lambda x: (x[1]["seq"], x[0])):
        t = d["t"]
        tts = t["t_tts"] if t["t_tts"] is not None else t["t_mt"]
        rows.append([d["seq"], lang, t["t_audio_in"] % 10**7, t["t_asr"] - t["t_audio_in"], t["t_mt"] - t["t_asr"],
                     "-" if t["t_tts"] is None else t["t_tts"] - t["t_mt"], t["t_out"] - tts,
                     t["t_out"] - t["t_audio_in"], t_recv - t["t_out"], "ja" if d["audio"] else "nein"])
    print(f"Bloecke gesendet: {sent}, Nachrichten empfangen: {len(received)}, Sprachen: {', '.join(langs)}")
    print(md_table(["seq", "Sprache", "t_audio_in (ms, letzte 7 Ziffern)", "ASR ms", "MT ms", "TTS ms", "Ausgabe ms",
                    "gesamt (serverseitig) ms", "Server->Zuhoerer ms (gleiche Uhr)", "Audio"], rows))
    print("\nHinweis: 'ASR ms' enthaelt bei Mocks die Segmentlaenge; Server->Zuhoerer gilt nur, wenn alles auf demselben Rechner laeuft.")


asyncio.run(main())
