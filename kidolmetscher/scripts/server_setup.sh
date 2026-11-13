#!/usr/bin/env bash
# Einrichtung des KI-Dolmetschers auf einem frischen Ubuntu/Debian-Server (GPU). Einmalig ausfuehren, als normaler Benutzer
# mit sudo oder als root. Nicht auf Ihrem eigenen Rechner. Idempotent (kann wiederholt werden).
#
# Umgebungsvariablen (alle optional):
#   REPO_URL, BRANCH   Quelle des Codes (Standard: dieses Repository, Entwicklungszweig)
#   DIR                Zielordner (Standard: $HOME/kidolmetscher)
#   HF_TOKEN           Zugriffstoken fuer TranslateGemma (nur als Umgebungsvariable, nie in Dateien/Chat)
#   MT_REPO            Modell auf Hugging Face (Standard google/translategemma-12b-it; z. B. google/translategemma-4b-it)
#   SKIP_APT=1  SKIP_PIP=1  SKIP_MODELS=1   Teilschritte ueberspringen
# Vor dem Termin ausfuehren; waehrend des Termins soll der Server keine Downloads mehr brauchen (docs/firewall-vorschlag.md).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/justusroman123/nachhaltigkeit.git}"
BRANCH="${BRANCH:-ccr-4bf88cb4-flgtez}"
DIR="${DIR:-$HOME/kidolmetscher}"
SRC="$DIR/src"
say() { printf '\n== %s\n' "$*"; }
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

say "1. GPU"
if command -v nvidia-smi >/dev/null; then
  nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
else
  echo "HINWEIS: nvidia-smi nicht gefunden. Ohne GPU-Treiber laeuft nur die CPU (langsam). Image/Anbieter pruefen."
fi

say "2. Systempakete"
if [ "${SKIP_APT:-0}" != "1" ]; then
  $SUDO apt-get update -qq
  $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git python3-venv python3-pip curl >/dev/null
fi

say "3. Code"
mkdir -p "$DIR"
if [ -d "$SRC/.git" ]; then
  git -C "$SRC" fetch -q origin "$BRANCH" && git -C "$SRC" checkout -q "$BRANCH" && git -C "$SRC" pull -q --ff-only origin "$BRANCH"
else
  git clone -q --branch "$BRANCH" "$REPO_URL" "$SRC"
fi
APP="$SRC/kidolmetscher"
echo "Stand: $(git -C "$SRC" log -1 --format='%h %s')"

say "4. Python-Umgebung und Pakete (dauert einige Minuten, mehrere GB)"
if [ "${SKIP_PIP:-0}" != "1" ]; then
  [ -x "$DIR/.venv/bin/python" ] || python3 -m venv "$DIR/.venv"
  "$DIR/.venv/bin/pip" install -q --upgrade pip
  "$DIR/.venv/bin/pip" install -q -r "$APP/server/requirements.txt" -r "$APP/server/requirements-asr.txt" \
      -r "$APP/server/requirements-mt.txt" -r "$APP/server/requirements-tts.txt" huggingface_hub
fi

say "5. Modelle (vor dem Termin laden)"
if [ "${SKIP_MODELS:-0}" != "1" ]; then
  PY="$DIR/.venv/bin/python"
  "$PY" "$APP/scripts/fetch_models.py" Systran/faster-whisper-large-v3 "$DIR/models/whisper-large-v3"
  "$PY" "$APP/scripts/fetch_voices.py" "$DIR/models/voices" uk_UA-ukrainian_tts-medium en_GB-alba-medium
  if [ -n "${HF_TOKEN:-}" ]; then
    "$PY" "$APP/scripts/fetch_models.py" "${MT_REPO:-google/translategemma-12b-it}" "$DIR/models/translategemma" \
      || echo "HINWEIS: TranslateGemma nicht geladen. Freigabe auf Hugging Face (Gemma-Bedingungen) und Token pruefen."
  else
    echo "HINWEIS: HF_TOKEN nicht gesetzt: TranslateGemma wird NICHT geladen. Nach der Freigabe erneut ausfuehren:"
    echo "         HF_TOKEN=... bash $APP/scripts/server_setup.sh   (Token nie in Dateien oder Chat schreiben)"
  fi
fi

say "6. Konfiguration (nur auf diesem Server, nicht im Repository)"
ENVF="$DIR/server.env"
if [ ! -f "$ENVF" ]; then
  umask 077
  cat > "$ENVF" <<ENVEOF
OPERATOR_KEY=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
HOST=127.0.0.1
PORT=8000
ASR_BACKEND=real
MT_BACKEND=real
TTS_BACKEND=real
ASR_MODEL=$DIR/models/whisper-large-v3
ASR_DEVICE=cuda
ASR_COMPUTE_TYPE=float16
MT_MODEL_ID=$DIR/models/translategemma
MT_DEVICE=cuda
MT_DTYPE=bfloat16
TTS_VOICE_DIR=$DIR/models/voices
TTS_VOICES=uk=uk_UA-ukrainian_tts-medium:0,en=en_GB-alba-medium
TARGET_LANGS=uk,ar,en,tr
DEFAULT_LANGS=uk,en
SERVER_HOURLY_EUR=1.24
BUDGET_EUR=20
DEBUG_FEHLER=1
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
HF_HUB_DISABLE_TELEMETRY=1
DO_NOT_TRACK=1
ENVEOF
  echo "Konfiguration angelegt: $ENVF (enthaelt den Bedienschluessel; Datei nicht weitergeben)"
else
  echo "Konfiguration vorhanden, nicht ueberschrieben: $ENVF"
fi

say "7. GPU-Pruefung"
if [ "${SKIP_PIP:-0}" != "1" ]; then
  "$DIR/.venv/bin/python" "$APP/scripts/gpu_check.py" "$DIR/models/whisper-large-v3" || true
fi

cat <<MSG

Fertig. Naechste Schritte:
  Starten:   bash $APP/scripts/server_ctl.sh start
  Status:    bash $APP/scripts/server_ctl.sh status
  Beenden:   bash $APP/scripts/server_ctl.sh stop
Dann auf Ihrem Windows-Rechner (zweites Fenster): ssh -L 8000:127.0.0.1:8000 <benutzer>@<server-adresse>
und im Browser http://localhost:8000 oeffnen. Ablauf und Fehlersuche: docs/server-test-ablauf.md
MSG
