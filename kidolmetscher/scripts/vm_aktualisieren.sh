#!/usr/bin/env bash
# Aktualisiert die Anwendung auf der gemieteten VM und startet sie mit den sicheren Voreinstellungen neu.
# Aufruf als root auf der VM:   bash /root/kidolmetscher/src/kidolmetscher/scripts/vm_aktualisieren.sh
# Was passiert (nichts davon loescht Daten; es gibt keine gespeicherten Inhalte):
#   1. neue Programmversion holen (git pull, nur Vorwaertsstand)
#   2. Startbefehl des Dienstes auf "python -m app" stellen (kleine Datei in /etc/systemd/system/kidolmetscher.service.d/);
#      aeltere VMs starten sonst uvicorn ohne WebSocket-Frame-Grenze und ohne Log-Filter fuer Adressen.
#      Dazu drei vorsichtige Haertungen (NICHT auf der echten VM getestet): keine Core-Dumps (LimitCORE=0), eigenes /tmp (PrivateTmp),
#      keine neuen Rechte (NoNewPrivileges). Rueckgaengig: Datei sicher.conf loeschen, "systemctl daemon-reload", "systemctl restart kidolmetscher".
#   3. warnen, wenn DEBUG_FEHLER=1 in server.env steht (Fehlermeldungen im Log koennen Textteile enthalten); mit der Option --debug-aus
#      wird es auf 0 gestellt
#   4. Dienst neu starten und Zustand anzeigen
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
LimitCORE=0
PrivateTmp=true
NoNewPrivileges=true
EOT
systemctl daemon-reload

echo "3. Fehlersuch-Einstellung pruefen"
ENVF="$DIR/server.env"
if [ -f "$ENVF" ] && grep -q '^DEBUG_FEHLER=1' "$ENVF"; then
  if [ "${1:-}" = "--debug-aus" ]; then
    sed -i 's/^DEBUG_FEHLER=1/DEBUG_FEHLER=0/' "$ENVF"
    echo "   DEBUG_FEHLER auf 0 gestellt: Fehlermeldungen im Log enthalten keine Textteile mehr."
  else
    echo "   WARNUNG: DEBUG_FEHLER=1 in $ENVF. Fehlermeldungen im Log koennen Textteile enthalten."
    echo "            Ausschalten: dieses Skript mit der Option --debug-aus erneut aufrufen."
  fi
else
  echo "   in Ordnung (DEBUG_FEHLER ist nicht auf 1)."
fi

echo "4. Dienst neu starten (Modelle werden geladen, das dauert einige Minuten)"
systemctl restart "$UNIT"
sleep 3
systemctl is-active "$UNIT" || { echo "Dienst laeuft nicht: journalctl -u $UNIT -n 50 --no-pager"; echo "Haertung zuruecknehmen: rm /etc/systemd/system/$UNIT.service.d/sicher.conf && systemctl daemon-reload && systemctl restart $UNIT"; exit 1; }
echo "Fertig. Fortschritt: journalctl -u $UNIT -f   (enthaelt nur Zaehler und Zeiten, keine Inhalte und keine Adressen)"
