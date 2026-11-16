#!/usr/bin/env bash
# Richtet die deutsche Stimme ein (Vorlesen der Gast-Antworten am Bedienplatz) auf der LAUFENDEN VM.
# Aufruf auf der VM als root:
#   bash /root/kidolmetscher/src/kidolmetscher/scripts/stimme_de_einrichten.sh
# Stimme: de_DE-thorsten-medium. Modellkarte (rhasspy/piper-voices, gelesen am 16.11.2026): Lizenz CC0, Datensatz Thorsten-Voice;
# braucht Piper 1.5 oder neuer (im Projekt: piper-tts >= 1.8). Download ca. 63 MB, nur vor dem Termin ausfuehren.
# Idempotent: kann wiederholt werden. Aendert nur die Zeile TTS_VOICES in server.env (der Bedienschluessel dort wird weder
# gelesen noch ausgegeben), laedt die Stimme, prueft sie mit einem kurzen Satz und startet den Dienst neu.
# Optional: DIR (Standard /root/kidolmetscher), STIMME (Standard de_DE-thorsten-medium), NEUSTART=0 (Dienst nicht neu starten).
set -euo pipefail
DIR="${DIR:-/root/kidolmetscher}"
STIMME="${STIMME:-de_DE-thorsten-medium}"
ENVF="$DIR/server.env"
APP="$DIR/src/kidolmetscher"
PY="$DIR/.venv/bin/python"

[ -f "$ENVF" ] || { echo "FEHLER: $ENVF nicht gefunden (ist die VM eingerichtet?)"; exit 1; }
grep -q '^TTS_VOICES=' "$ENVF" || { echo "FEHLER: Zeile TTS_VOICES= fehlt in $ENVF (Einrichtung unvollstaendig)"; exit 1; }
[[ "$STIMME" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "FEHLER: Stimmenname unzulaessig"; exit 1; }

echo "1. Stimme laden: $STIMME"
"$PY" "$APP/scripts/fetch_voices.py" "$DIR/models/voices" "$STIMME"

echo "2. Konfiguration: Eintrag de=$STIMME in TTS_VOICES"
if grep '^TTS_VOICES=' "$ENVF" | grep -Eq '(=|,)de='; then
  sed -i -E "/^TTS_VOICES=/ s/(=|,)de=[^,]*/\1de=$STIMME/" "$ENVF"
else
  sed -i -E "/^TTS_VOICES=/ s/\$/,de=$STIMME/" "$ENVF"
fi
grep '^TTS_VOICES=' "$ENVF"                      # nur diese Zeile (enthaelt keine Geheimnisse)

echo "3. Pruefung: Stimme laden und einen Satz sprechen"
"$PY" - "$DIR/models/voices/$STIMME.onnx" <<'PYEOF'
import io, sys, time, wave
from piper import PiperVoice
t0 = time.time()
v = PiperVoice.load(sys.argv[1])
buf = io.BytesIO()
with wave.open(buf, "wb") as w:
    v.synthesize_wav("Guten Tag, wie kann ich Ihnen helfen?", w)
r = wave.open(io.BytesIO(buf.getvalue()))
print("OK: %.1f s Ton, %d Hz, gesamt %.1f s (Laden + Sprechen)" % (r.getnframes() / r.getframerate(), r.getframerate(), time.time() - t0))
PYEOF

if [ "${NEUSTART:-1}" = "1" ]; then
  echo "4. Dienst neu starten"
  systemctl restart kidolmetscher
  sleep 5
  systemctl is-active kidolmetscher
  echo "Fertig. Modelle werden geladen (einige Minuten); danach neue Sitzung im Modus Gespraech anlegen und testen."
else
  echo "4. Neustart uebersprungen (NEUSTART=0): spaeter 'systemctl restart kidolmetscher' ausfuehren."
fi
