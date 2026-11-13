#!/usr/bin/env bash
# Macht die laufende Anwendung ueber eine HTTPS-Adresse erreichbar (fuer Tablets/Smartphones/Chromebook).
# Installiert Caddy (Reverse Proxy, holt automatisch ein Zertifikat), traegt PUBLIC_URL in server.env ein.
# Aufruf auf dem Server: bash oeffentlich_freigeben.sh [DOMAIN]   (ohne DOMAIN: <IP-mit-Bindestrichen>.sslip.io)
# Zuruecknehmen: bash oeffentlich_freigeben.sh aus
# Voraussetzung: Ports 80 und 443 sind vom Internet erreichbar (centron-Firewall: unbekannt, beim Test pruefen).
set -euo pipefail
DIR="${DIR:-$HOME/kidolmetscher}"
ENVF="$DIR/server.env"
CTL="$DIR/src/kidolmetscher/scripts/server_ctl.sh"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

if [ "${1:-}" = "aus" ]; then
  $SUDO systemctl disable --now caddy 2>/dev/null || true
  sed -i '/^PUBLIC_URL=/d' "$ENVF"
  bash "$CTL" stop; bash "$CTL" start
  echo "Oeffentliche Adresse abgeschaltet. Zugriff nur noch per SSH-Tunnel."
  exit 0
fi

IP=$(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | head -1)
DOMAIN="${1:-$(echo "$IP" | tr . -).sslip.io}"
echo "Adresse: https://$DOMAIN"

command -v caddy >/dev/null || { $SUDO apt-get update -qq; $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy; }
printf '%s {\n\treverse_proxy 127.0.0.1:8000\n}\n' "$DOMAIN" | $SUDO tee /etc/caddy/Caddyfile >/dev/null
$SUDO systemctl enable caddy >/dev/null 2>&1
$SUDO systemctl restart caddy
command -v ufw >/dev/null && ufw status | grep -q "Status: active" && { ufw allow 80/tcp; ufw allow 443/tcp; } || true

sed -i '/^PUBLIC_URL=/d' "$ENVF"
echo "PUBLIC_URL=https://$DOMAIN" >> "$ENVF"
bash "$CTL" stop; bash "$CTL" start
echo
echo "Fertig. Zertifikat und Erreichbarkeit pruefen (nach ca. 1 Minute):"
echo "  curl -sS -o /dev/null -w 'HTTP %{http_code}\n' https://$DOMAIN/"
echo "Danach auf dem Tablet/Smartphone: https://$DOMAIN/  (Bedienplatz) bzw. den Zuhoerer-Link/QR-Code der Sitzung."
