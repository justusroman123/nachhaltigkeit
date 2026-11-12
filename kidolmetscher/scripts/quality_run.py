#!/usr/bin/env python3
"""Qualitaetslauf: uebersetzt erfundene deutsche Saetze in alle Zielsprachen, erzeugt (wo eine Stimme da ist) den Ton und
schreibt einen Bewertungsbogen als HTML-Datei (offline, ohne externe Ressourcen), den Muttersprachler ausfuellen koennen.

Aufruf (Umgebung wie im Betrieb, z. B. nach `source ~/kidolmetscher/server.env`):
  python3 scripts/quality_run.py [--langs uk,ar,en,tr] [--out ordner] [--no-audio] [--modes plain,structured]
                                 [--sentences datei] [--limit N]

--modes vergleicht Prompt-Formate der Uebersetzung (plain / structured) nebeneinander. Das Ergebnis ist KEINE Messung der
Qualitaet, sondern Material zum Bewerten durch Menschen. Die Saetze sind erfunden; der Ordner kann trotzdem nach dem Test
geloescht werden. Ergebnisse stehen nur im Ausgabeordner (nicht im Repository).
"""
import argparse
import asyncio
import datetime
import html
import time
from pathlib import Path

from _common import ROOT, backend_label, build_pipeline, load_settings, read_sentences

RTL = {"ar", "fa"}
NAMES = {"uk": "Ukrainisch", "ar": "Arabisch", "en": "Englisch", "tr": "Türkisch", "fa": "Persisch"}

CSS = """
body{font:16px/1.5 system-ui,sans-serif;margin:16px auto;max-width:1000px;padding:0 16px;color:#1a2230;background:#fff}
table{border-collapse:collapse;width:100%;margin:12px 0 32px}th,td{border:1px solid #c9d0db;padding:8px;vertical-align:top;text-align:left}
th{background:#eef1f6}.de{color:#44506a}.tr{font-size:1.1rem}.t{font-size:.8rem;color:#5b6678}.rate{min-width:90px}
audio{width:220px}h2{margin-top:32px}.note{background:#fbf0d6;padding:8px 12px;border-radius:8px}
@media print{audio{display:none}}
"""


async def translate_all(pipe, sentences, langs, modes):
    """Liefert {(modus, sprache, kennung): (text|None, ms, fehler|None)}."""
    out = {}
    for mode in modes:
        if hasattr(pipe.mt, "prompt_mode"):
            pipe.mt.prompt_mode = mode
        for lang in langs:
            for sid, _, text in sentences:
                t = time.perf_counter()
                try:
                    res, err = await pipe.mt.translate(text, "de", lang), None
                except Exception as exc:                         # z. B. Chat-Format nicht passend: sichtbar machen
                    res, err = None, f"{type(exc).__name__}: {exc}"[:200]
                out[(mode, lang, sid)] = (res, round((time.perf_counter() - t) * 1000), err)
    return out


async def synthesize_all(pipe, results, outdir: Path, langs, mode):
    """Schreibt WAV-Dateien fuer den ersten Modus; liefert {(sprache, kennung): (dateiname|None, ms)}."""
    audio = {}
    for (m, lang, sid), (text, _, err) in results.items():
        if m != mode or not text or lang not in langs:
            continue
        t = time.perf_counter()
        res = await pipe.tts.synthesize(text, lang)
        ms = round((time.perf_counter() - t) * 1000)
        if res is None:
            audio[(lang, sid)] = (None, ms)
            continue
        name = f"{lang}/{sid}.wav"
        (outdir / lang).mkdir(parents=True, exist_ok=True)
        (outdir / name).write_bytes(res.audio)
        audio[(lang, sid)] = (name, ms)
    return audio


def build_report(sentences, langs, modes, results, audio, backend: str) -> str:
    esc = html.escape
    parts = [f"<!doctype html><html lang='de'><head><meta charset='utf-8'><title>Bewertungsbogen Qualitätslauf</title>"
             f"<style>{CSS}</style></head><body>",
             f"<h1>Bewertungsbogen: Übersetzung und Sprachausgabe</h1>",
             f"<p class='t'>Erstellt am {datetime.datetime.now():%d.%m.%Y %H:%M} · {esc(backend)} · alle Sätze sind erfunden.</p>",
             "<p class='note'>Bitte je Zeile bewerten (1 = unbrauchbar, 5 = sehr gut): <b>Bedeutung</b> (stimmt der Inhalt?), "
             "<b>Sprache</b> (klingt der Text natürlich?), bei Ton zusätzlich <b>Stimme</b> (verständlich, angenehm?). "
             "Zahlen, Uhrzeiten und Namen besonders prüfen. Fehler bitte kurz notieren.</p>"]
    for lang in langs:
        parts.append(f"<h2>{NAMES.get(lang, lang)} ({lang})</h2><table><tr><th>Deutsch</th>")
        for m in modes:
            parts.append(f"<th>Übersetzung{' (' + esc(m) + ')' if len(modes) > 1 else ''}</th>")
        parts.append("<th>Ton</th><th class='rate'>Bedeutung</th><th class='rate'>Sprache</th><th class='rate'>Stimme</th><th>Bemerkung</th></tr>")
        for sid, kind, text in sentences:
            parts.append(f"<tr><td class='de'>{esc(text)}<div class='t'>{esc(sid)} · {esc(kind)}</div></td>")
            for m in modes:
                tr, ms, err = results.get((m, lang, sid), (None, 0, "nicht ausgeführt"))
                d = " dir='rtl'" if lang in RTL else ""
                body = esc(tr) if tr else f"<i>FEHLER: {esc(err or 'leer')}</i>"
                parts.append(f"<td class='tr'{d} lang='{lang}'>{body}<div class='t' dir='ltr'>{ms} ms</div></td>")
            fn, ams = audio.get((lang, sid), (None, 0))
            parts.append("<td>" + (f"<audio controls preload='none' src='{esc(fn)}'></audio><div class='t'>{ams} ms</div>" if fn
                                   else "<span class='t'>kein Ton (keine Stimme)</span>") + "</td>")
            parts.append("<td></td><td></td><td></td><td></td></tr>")
        parts.append("</table>")
    parts.append("</body></html>")
    return "\n".join(parts)


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--langs", default="uk,ar,en,tr")
    ap.add_argument("--out", default="")
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--modes", default="")
    ap.add_argument("--sentences", default="")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    s = load_settings()
    langs = [x.strip() for x in a.langs.split(",") if x.strip()]
    modes = [x.strip() for x in a.modes.split(",") if x.strip()] or [s.mt_prompt_mode]
    path = Path(a.sentences) if a.sentences else ROOT / "tests" / "audio" / "qualitaetssaetze.txt"
    sentences = read_sentences(path)[: a.limit or None]
    outdir = Path(a.out) if a.out else Path(f"qualitaetslauf-{datetime.datetime.now():%Y%m%d-%H%M}")
    outdir.mkdir(parents=True, exist_ok=True)

    pipe = build_pipeline(s)
    t = time.perf_counter()
    await pipe.mt.load()
    if not a.no_audio:
        await pipe.tts.load()
    print(f"Modelle geladen in {time.perf_counter() - t:.1f} s ({backend_label(s)})")

    results = await translate_all(pipe, sentences, langs, modes)
    audio = {} if a.no_audio else await synthesize_all(pipe, results, outdir, langs, modes[0])

    report = outdir / "bewertungsbogen.html"
    report.write_text(build_report(sentences, langs, modes, results, audio, backend_label(s)), encoding="utf-8")

    errors = sum(1 for v in results.values() if v[2])
    for lang in langs:
        ms = [v[1] for (m, l, _), v in results.items() if l == lang and not v[2]]
        if ms:
            print(f"  {lang}: Übersetzung Median {sorted(ms)[len(ms) // 2]} ms, Maximum {max(ms)} ms")
    print(f"Fehler bei der Übersetzung: {errors} von {len(results)}")
    print(f"Bewertungsbogen: {report}")
    return 0 if not errors else 1


raise SystemExit(asyncio.run(main()))
