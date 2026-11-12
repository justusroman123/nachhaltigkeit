#!/usr/bin/env bash
# Startet/stoppt den KI-Dolmetscher auf dem Server. Aufruf: server_ctl.sh start|stop|status
# Erwartet die Dateien aus server_setup.sh unter $DIR (Standard $HOME/kidolmetscher). Hoert NUR auf 127.0.0.1;
# Zugriff von Ihrem Rechner per SSH-Tunnel (kein offener Port, keine Domain noetig).
set -euo pipefail
DIR="${DIR:-$HOME/kidolmetscher}"
APP="$DIR/src/kidolmetscher"
PIDF="$DIR/server.pid"
LOGF="$DIR/server.log"       # enthaelt nur Zaehler und Zeiten, keine Inhalte
case "${1:-}" in
  start)
    [ -f "$DIR/server.env" ] || { echo "server.env fehlt: erst server_setup.sh ausfuehren"; exit 1; }
    if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; then echo "laeuft bereits (PID $(cat "$PIDF"))"; exit 0; fi
    set -a; . "$DIR/server.env"; set +a
    cd "$APP/server"
    nohup "$DIR/.venv/bin/uvicorn" app.main:create_app --factory --host 127.0.0.1 --port "${PORT:-8000}" --no-access-log \
      > "$LOGF" 2>&1 &
    echo $! > "$PIDF"
    echo "gestartet (PID $(cat "$PIDF")). Modelle werden geladen; das kann einige Minuten dauern. Fortschritt: tail -f $LOGF"
    echo "Bedienschluessel: $(grep '^OPERATOR_KEY=' "$DIR/server.env" | cut -d= -f2)"
    ;;
  stop)
    if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; then kill "$(cat "$PIDF")"; rm -f "$PIDF"; echo "gestoppt"; else echo "laeuft nicht"; fi
    echo "ERINNERUNG: Das Stoppen des Programms beendet NICHT die Kosten. Die Server-Instanz in der centron-Console LOESCHEN."
    ;;
  status)
    if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; then
      echo "laeuft (PID $(cat "$PIDF"))"
      curl -s -o /dev/null -w "Antwort der Startseite: HTTP %{http_code}\n" "http://127.0.0.1:${PORT:-8000}/" || true
    else echo "laeuft nicht"; fi
    ;;
  *) echo "Aufruf: $0 start|stop|status"; exit 2 ;;
esac
