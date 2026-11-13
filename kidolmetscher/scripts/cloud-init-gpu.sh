#!/bin/bash
# "Alles-automatisch"-Skript fuer das Feld "Cloud-Init Initialisierungsskripte" der centron-Console (laeuft beim ersten Start als root).
# NICHT GETESTET auf einer echten GPU-VM. Fortschritt/Fehler: /var/log/kidolmetscher-init.log
#
# Ablauf: Pakete + Code + Whisper + Stimmen + TranslateGemma laden -> GPU-Treiber -> Dienst einrichten -> Neustart.
# Nach dem Neustart startet der Dienst von allein (optional vorher einmal der Qualitaetslauf). Nichts muss getippt werden.
#
# EINSTELLUNGEN (vor dem Einfuegen in die Console hier eintragen, NICHT ins Repository zurueckschreiben):
HF_TOKEN=""                                   # Hugging-Face-Lesetoken fuer TranslateGemma; leer = TranslateGemma wird nicht geladen.
                                              # Das Token liegt danach noch in den Cloud-Init-Daten der VM: nach dem Test widerrufen.
MT_REPO="google/translategemma-12b-it"        # oder google/translategemma-4b-it (kleiner, fuer eine 16-GB-GPU)
QUALITAETSLAUF="1"                            # 1 = vor dem ersten Start einmal alle Sprachen durchrechnen (Bewertungsbogen)
# ------------------------------------------------------------------------------------------------
exec > /var/log/kidolmetscher-init.log 2>&1
set -u
export HOME=/root DEBIAN_FRONTEND=noninteractive HF_TOKEN MT_REPO
echo "== Start $(date -Is)"
apt-get update -y
apt-get install -y git python3-venv python3-pip curl ubuntu-drivers-common
git clone --branch ccr-4bf88cb4-flgtez https://github.com/justusroman123/nachhaltigkeit.git /root/kidolmetscher/src
SKIP_APT=1 bash /root/kidolmetscher/src/kidolmetscher/scripts/server_setup.sh
unset HF_TOKEN

# Dienst: startet die Anwendung beim Hochfahren (nur auf 127.0.0.1, Zugriff per SSH-Tunnel)
cat > /root/kidolmetscher/qualitaetslauf.sh <<'QEOF'
#!/bin/bash
# einmalig vor dem ersten Start: Bewertungsbogen erzeugen (Ergebnis nur auf dieser VM)
[ "__QUALITAET__" = "1" ] || exit 0
[ -f /root/kidolmetscher/QUALITAET_ERLEDIGT ] && exit 0
set -a; . /root/kidolmetscher/server.env; set +a
cd /root/kidolmetscher/src/kidolmetscher
/root/kidolmetscher/.venv/bin/python scripts/quality_run.py --langs uk,ar,en,tr --modes structured,plain \
  --out /root/kidolmetscher/qualitaetslauf > /root/kidolmetscher/qualitaetslauf.log 2>&1
touch /root/kidolmetscher/QUALITAET_ERLEDIGT
QEOF
sed -i "s/__QUALITAET__/$QUALITAETSLAUF/" /root/kidolmetscher/qualitaetslauf.sh
chmod +x /root/kidolmetscher/qualitaetslauf.sh
cat > /etc/systemd/system/kidolmetscher.service <<'UEOF'
[Unit]
Description=KI-Dolmetscher
After=network-online.target
Wants=network-online.target
[Service]
WorkingDirectory=/root/kidolmetscher/src/kidolmetscher/server
EnvironmentFile=/root/kidolmetscher/server.env
TimeoutStartSec=3600
ExecStartPre=-/root/kidolmetscher/qualitaetslauf.sh
ExecStart=/root/kidolmetscher/.venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log
Restart=on-failure
[Install]
WantedBy=multi-user.target
UEOF
systemctl daemon-reload
systemctl enable kidolmetscher.service

echo "== GPU-Treiber $(date -Is)"
ubuntu-drivers devices
ubuntu-drivers install
# Token-Reste in den Cloud-Init-Daten dieser VM entfernen (soweit moeglich)
rm -f /var/lib/cloud/instance/user-data.txt /var/lib/cloud/instance/scripts/* /var/lib/cloud/instances/*/user-data.txt* 2>/dev/null
echo "== Fertig, Neustart $(date -Is)"
touch /root/kidolmetscher/INIT_FERTIG
reboot
