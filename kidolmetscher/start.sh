#!/usr/bin/env bash
# Startet den Server lokal mit Attrappen (ohne GPU). Beim ersten Start wird eine
# Python-Umgebung im Ordner server/.venv angelegt (nur lokal, keine Systemaenderung).
# Fuer Handys im selben WLAN:  HOST=0.0.0.0 ./start.sh   (oeffnet den Server im lokalen Netz)
set -euo pipefail
cd "$(dirname "$0")/server"

if [ ! -x .venv/bin/uvicorn ]; then
  echo "Erster Start: richte Python-Umgebung ein (einmalig) ..."
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

if [ -z "${OPERATOR_KEY:-}" ]; then
  OPERATOR_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(18))')"
  export OPERATOR_KEY
  echo "Bedienschlüssel (gilt nur bis zum Beenden dieses Programms): $OPERATOR_KEY"
fi

PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"
echo "Bedienplatz im Browser öffnen: http://localhost:${PORT}/"
echo "Beenden mit Strg+C."
exec .venv/bin/uvicorn app.main:create_app --factory --host "$HOST" --port "$PORT" --no-access-log
