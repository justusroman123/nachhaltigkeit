#!/usr/bin/env python3
"""Hoervergleich VoxCPM2 fuer Arabisch/Tuerkisch auf dem GPU-Server (NICHT getestet: braucht GPU und das Modell).
Aufruf: python3 scripts/tts_candidate_try.py <ausgabeordner> [ar|tr ...]
Voraussetzung: pip install voxcpm soundfile  (und Modell: openbmb/VoxCPM2, Apache-2.0 laut Modellkarte)
Die uebersetzten Saetze kommen aus einem vorherigen Qualitaetslauf (bewertungsbogen) oder aus den Beispielen unten.
Ohne Referenzstimme wird eine Stimmbeschreibung in Klammern vorangestellt (laut Modellkarte); eine Stimme einer echten Person
wird NICHT geklont. Gibt nur Zeiten aus, keine Inhalte."""
import sys
import time
from pathlib import Path

BEISPIELE = {      # erfundene Beispielsaetze (von Hand eingetragen, vor dem Hoeren von Muttersprachlern pruefen lassen)
    "ar": ["مرحبًا بكم في عرض اليوم.", "يُرجى التقدّم بالطلب قبل نهاية الشهر."],
    "tr": ["Bugünkü sunuma hoş geldiniz.", "Lütfen başvurunuzu ay sonuna kadar yapınız."],
}
STIMME = "(A calm adult speaker, clear and neutral, medium pace)"


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    langs = sys.argv[2:] or ["ar", "tr"]
    from voxcpm import VoxCPM
    import soundfile as sf
    model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False)
    for lang in langs:
        for i, text in enumerate(BEISPIELE[lang], 1):
            t = time.perf_counter()
            wav = model.generate(text=f"{STIMME}{text}", cfg_value=2.0, inference_timesteps=10)
            dt = time.perf_counter() - t
            secs = len(wav) / model.tts_model.sample_rate
            sf.write(out / f"{lang}-{i}.wav", wav, model.tts_model.sample_rate)
            print(f"{lang}-{i}: {secs:.1f} s Ton in {dt:.1f} s Rechenzeit (RTF {dt / secs:.2f})")
    return 0


sys.exit(main())
