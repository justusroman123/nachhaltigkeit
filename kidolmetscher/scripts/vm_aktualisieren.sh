#!/usr/bin/env bash
# Aktualisiert die Anwendung auf der gemieteten VM und startet sie mit den sicheren Voreinstellungen neu.
# Aufruf als root auf der VM:   bash /root/kidolmetscher/src/kidolmetscher/scripts/vm_aktualisieren.sh
# Was passiert (nichts davon loescht Daten; es gibt keine gespeicherten Inhalte):
#   1. neue Programmversion holen (git pull, nur Vorwaertsstand)
#   2. Startbefehl des Dienstes auf "python -m app" stellen (kleine Datei in /etc/systemd/system/kidolmetscher.service.d/);
#      aeltere VMs starten sonst uvicorn ohne WebSocket-Frame-Grenze und ohne Log-Filter fuer Adressen
#   3. Dienst neu starten und Zustand anzeigen
# Laufende Sitzungen enden dabei (sie liegen nur im Arbeitsspeicher): nicht waehrend einer Veranstaltung ausfuehren.
set -euo pipefail
DIR="${DIR:-/root/kidolmetscher}"
UNIT=kidolmetscher
[ "$(id -u)" = "0" ] || { echo "Bitte als root ausfuehren."; exit 1; }
[ -d "$DIR/src/.git" ] || { echo "Programmordner $DIR/src nicht gefunden (DIR=... setzen)."; exit 1; }

echo "1. Programmversion holen"
git -C "$DIR/src" pull -q --ff-only
git -C "$DIR/src" log -1 --format="   Stand: %h %s"

echo "2. Startbefehl sicher stellen"
install -d "/etc/systemd/system/$UNIT.service.d"
cat > "/etc/systemd/system/$UNIT.service.d/sicher.conf" <<EOT
[Service]
ExecStart=
ExecStart=$DIR/.venv/bin/python -m app
Environment=HOST=127.0.0.1 PORT=8000
LimitNOFILE=65536
EOT
systemctl daemon-reload

echo "3. Dienst neu starten (Modelle werden geladen, das dauert einige Minuten)"
systemctl restart "$UNIT"
sleep 3
systemctl is-active "$UNIT" || { echo "Dienst laeuft nicht: journalctl -u $UNIT -n 50 --no-pager"; exit 1; }
echo "Fertig. Fortschritt: journalctl -u $UNIT -f   (enthaelt nur Zaehler und Zeiten, keine Inhalte und keine Adressen)"
