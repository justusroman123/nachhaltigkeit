#!/usr/bin/env python3
"""Prueft in wenigen Sekunden, ob die GPU fuer Spracherkennung (CTranslate2) und Uebersetzung (PyTorch) nutzbar ist.
Gibt nur Zahlen und Hinweise aus (keine Inhalte). Aufruf: python3 scripts/gpu_check.py [whisper-ordner]
Wenn ein Ordner angegeben ist, wird dort das Whisper-Modell auf der GPU (float16) geladen und der VRAM gemessen."""
import shutil
import subprocess
import sys


def main() -> int:
    ok = True
    if shutil.which("nvidia-smi"):
        out = subprocess.run(["nvidia-smi", "--query-gpu=name,driver_version,memory.total,memory.used", "--format=csv,noheader"],
                             capture_output=True, text=True).stdout.strip()
        print("GPU laut nvidia-smi:", out or "keine Ausgabe")
    else:
        print("nvidia-smi nicht gefunden: Treiber vermutlich nicht installiert (Hinweis an den Anbieter/Image pruefen)")
        ok = False
    try:
        import torch
        print("PyTorch", torch.__version__, "| CUDA fuer PyTorch verfuegbar:", torch.cuda.is_available())
        ok &= torch.cuda.is_available()
    except Exception as exc:
        print("PyTorch nicht nutzbar:", type(exc).__name__, exc)
        ok = False
    try:
        import ctranslate2
        n = ctranslate2.get_cuda_device_count()
        print("CTranslate2", ctranslate2.__version__, "| CUDA-Geraete:", n,
              "| float16 moeglich:", "float16" in ctranslate2.get_supported_compute_types("cuda") if n else "-")
        ok &= n > 0
    except Exception as exc:
        print("CTranslate2 (Spracherkennung) nicht nutzbar:", type(exc).__name__, exc)
        print("Hinweis: fehlt libcublas.so.12 / libcudnn, siehe docs/server-test-ablauf.md, Abschnitt Fehlersuche")
        ok = False
    if len(sys.argv) > 1 and ok:
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel(sys.argv[1], device="cuda", compute_type="float16")
            print("Whisper-Modell auf der GPU geladen:", sys.argv[1])
            import numpy as np                    # echter Rechenlauf: erst dabei werden cuBLAS/cuDNN geladen
            list(model.transcribe(np.zeros(16000, dtype=np.float32), language="de")[0])
            print("Whisper-Rechenlauf auf der GPU erfolgreich")
            print(subprocess.run(["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader"],
                                 capture_output=True, text=True).stdout.strip(), "(VRAM nach dem Laden)")
        except Exception as exc:
            print("Whisper auf der GPU fehlgeschlagen:", type(exc).__name__, exc)
            ok = False
    print("ERGEBNIS:", "GPU nutzbar" if ok else "NICHT bereit (siehe Meldungen oben)")
    return 0 if ok else 1


sys.exit(main())
