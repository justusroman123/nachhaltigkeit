#!/usr/bin/env python3
"""Gibt den Suchpfad (LD_LIBRARY_PATH) fuer die per pip installierten CUDA-12-Bibliotheken aus (cuBLAS, cuDNN).
Leere Ausgabe, wenn sie nicht installiert sind. CTranslate2 (Whisper) braucht sie, PyTorch nicht."""
import importlib.util
import os

paths = []
for name in ("nvidia.cublas", "nvidia.cudnn"):
    try:
        spec = importlib.util.find_spec(name)
    except ModuleNotFoundError:
        continue
    for base in (spec.submodule_search_locations or []) if spec else []:
        lib = os.path.join(base, "lib")
        if os.path.isdir(lib) and lib not in paths:
            paths.append(lib)
print(":".join(paths))
