#!/bin/bash
# "Alles-automatisch"-Skript fuer das Feld "Cloud-Init Initialisierungsskripte" der centron-Console (laeuft beim ersten Start als root).
# NICHT GETESTET auf einer echten GPU-VM. Fortschritt/Fehler: /var/log/kidolmetscher-init.log
#
# Ablauf: Pakete + Code + Whisper + Stimmen + TranslateGemma laden -> GPU-Treiber -> Dienst einrichten -> Neustart.
# Nach dem Neustart startet der Dienst von allein (optional vorher einmal der Qualitaetslauf). Nichts muss getippt werden.
#
# EINSTELLUNGEN: kommen normalerweise aus dem Mini-Starter (scripts/cloud-init-launcher.sh) als Umgebungsvariablen.
# Werte NIE in dieses Repository-Skript schreiben.
HF_TOKEN="${HF_TOKEN:-}"                     # Hugging-Face-Lesetoken fuer TranslateGemma; leer = TranslateGemma wird nicht geladen.
                                              # Das Token liegt danach noch in den Cloud-Init-Daten der VM: nach dem Test widerrufen.
MT_REPO="${MT_REPO:-google/translategemma-12b-it}"        # oder google/translategemma-4b-it (kleiner, fuer eine 16-GB-GPU)
QUALITAETSLAUF="${QUALITAETSLAUF:-1}"                            # 1 = vor dem ersten Start einmal alle Sprachen durchrechnen (Bewertungsbogen)
OPERATOR_KEY="${OPERATOR_KEY:-}"                               # Ihr Bedienschluessel (nur Buchstaben und Ziffern, mind. 24 Zeichen, z. B. aus dem Passwort-Manager).
                                              # Leer = wird zufaellig erzeugt (steht dann nur in ~/kidolmetscher/server.env auf der VM).
DOMAIN="${DOMAIN:-}"                                     # Adresse fuer Chromebook und Tablets, z. B. dolmetscher.beispiel.de. Der DNS-Eintrag (A) muss VOR
                                              # dem Start auf die IP der VM zeigen. Leer = Ersatzadresse <ip>.sslip.io (fremder DNS-Dienst, Zertifikat-
                                              # Limits moeglich, ungeprueft). Ohne HTTPS gibt der Browser das Mikrofon nicht frei.
# ------------------------------------------------------------------------------------------------
exec > /var/log/kidolmetscher-init.log 2>&1
set -u
export HOME=/root DEBIAN_FRONTEND=noninteractive HF_TOKEN MT_REPO
echo "== Start $(date -Is)"
apt-get update -y
apt-get install -y git python3-venv python3-pip curl ubuntu-drivers-common caddy
git clone --branch ccr-4bf88cb4-flgtez https://github.com/justusroman123/nachhaltigkeit.git /root/kidolmetscher/src
SKIP_APT=1 bash /root/kidolmetscher/src/kidolmetscher/scripts/server_setup.sh
unset HF_TOKEN

# Bedienschluessel, Adresse (HTTPS) und Reverse Proxy
IP=$(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | head -1)
[ -n "$DOMAIN" ] || DOMAIN="$(echo "$IP" | tr . -).sslip.io"
if echo "$OPERATOR_KEY" | grep -Eq '^[A-Za-z0-9]{24,}$'; then
  sed -i "s/^OPERATOR_KEY=.*/OPERATOR_KEY=$OPERATOR_KEY/" /root/kidolmetscher/server.env
else
  echo "HINWEIS: OPERATOR_KEY leer oder ungueltig (nur Buchstaben/Ziffern, mind. 24): zufaelliger Schluessel in server.env bleibt"
fi
echo "PUBLIC_URL=https://$DOMAIN" >> /root/kidolmetscher/server.env
cat > /etc/caddy/Caddyfile <<CEOF
$DOMAIN {
	reverse_proxy 127.0.0.1:8000
}
CEOF
systemctl enable caddy
systemctl restart caddy
command -v ufw >/dev/null && ufw status | grep -q "Status: active" && { ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; }

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
ubuntu-drivers install || apt-get install -y nvidia-driver-595-open
# Token-Reste in den Cloud-Init-Daten dieser VM entfernen (soweit moeglich)
rm -f /var/lib/cloud/instance/user-data.txt /var/lib/cloud/instance/scripts/* /var/lib/cloud/instances/*/user-data.txt* 2>/dev/null
echo "== Fertig, Neustart $(date -Is)"
touch /root/kidolmetscher/INIT_FERTIG
reboot
