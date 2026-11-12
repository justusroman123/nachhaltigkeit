#!/usr/bin/env python3
"""Laedt Piper-Stimmen (.onnx + .onnx.json) aus dem Hugging-Face-Repository rhasspy/piper-voices in einen Ordner.

Aufruf:  python3 scripts/fetch_voices.py <zielordner> <stimme> [<stimme> ...]
Beispiel: python3 scripts/fetch_voices.py models/voices uk_UA-ukrainian_tts-medium en_GB-alba-medium

Nur zur Vorbereitung VOR einem Termin (danach ausgehenden Verkehr sperren, docs/firewall-vorschlag.md).
Lizenz jeder Stimme vorher in der MODEL_CARD pruefen (docs/lizenzen-recherche.md); die Warnliste unten ist nicht vollstaendig.
"""
import re
import sys
import urllib.request
from pathlib import Path

BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
NICHT_KOMMERZIELL = ("en_US-ryan", "en_US-lessac", "tr_TR-dfki")     # laut gelesenen MODEL_CARDs (Stand 11.11.2026)


def pfad(stimme: str) -> str:
    m = re.fullmatch(r"([a-z]{2})_([A-Z]{2})-([A-Za-z0-9_]+)-([a-z_]+)", stimme)
    if not m:
        raise SystemExit(f"Stimmenname unerwartet: {stimme} (erwartet z. B. uk_UA-ukrainian_tts-medium)")
    lang, region, name, quality = m.groups()
    return f"{BASE}/{lang}/{lang}_{region}/{name}/{quality}/{stimme}"


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    ziel = Path(sys.argv[1])
    ziel.mkdir(parents=True, exist_ok=True)
    for stimme in sys.argv[2:]:
        if stimme.startswith(NICHT_KOMMERZIELL):
            print(f"WARNUNG {stimme}: laut MODEL_CARD nicht fuer kommerzielle Nutzung")
        for ende in (".onnx", ".onnx.json"):
            datei = ziel / f"{stimme}{ende}"
            if datei.exists():
                print(f"vorhanden: {datei}")
                continue
            url = pfad(stimme) + ende
            with urllib.request.urlopen(url, timeout=120) as r, open(datei, "wb") as f:
                f.write(r.read())
            print(f"geladen: {datei} ({datei.stat().st_size/1e6:.1f} MB)")
    return 0


sys.exit(main())
