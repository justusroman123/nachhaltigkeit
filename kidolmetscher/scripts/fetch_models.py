#!/usr/bin/env python3
"""Laedt ein Modell-Repository von Hugging Face in einen lokalen Ordner (Vorbereitung VOR dem Termin).

Aufruf:  python3 scripts/fetch_models.py <repo-id> <zielordner>
Beispiele (Repo-IDs vor Einsatz pruefen; fuer TranslateGemma ist die ID UNBEKANNT und das Repo gesperrt/freigabepflichtig):
  python3 scripts/fetch_models.py Systran/faster-whisper-large-v3 models/whisper-large-v3
  HF_TOKEN=... python3 scripts/fetch_models.py <translategemma-repo-id> models/translategemma

Das Zugriffs-Token nur ueber die Umgebungsvariable HF_TOKEN, nie in Dateien oder Chat. Danach laeuft der Server mit
HF_HUB_OFFLINE=1 und ASR_MODEL / MT_MODEL_ID als lokale Ordner. Benoetigt: pip install huggingface_hub
"""
import os
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")      # einfacher HTTP-Download (kein zusaetzlicher Xet-Host noetig); vor dem Import setzen
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("huggingface_hub fehlt: pip install huggingface_hub")
        return 1
    repo, ziel = sys.argv[1], sys.argv[2]
    pfad = snapshot_download(repo_id=repo, local_dir=ziel, token=os.environ.get("HF_TOKEN") or None)
    print(f"geladen nach {pfad}")
    return 0


sys.exit(main())
