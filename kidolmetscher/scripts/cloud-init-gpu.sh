#!/bin/bash
# Einrichtungsskript fuer das Feld "Cloud-Init Initialisierungsskripte" der centron-Console (laeuft beim ersten Start als root).
# NICHT GETESTET auf einer echten GPU-VM; Ablauf siehe Log: /var/log/kidolmetscher-init.log
# Enthaelt keine Geheimnisse (kein Hugging-Face-Token). TranslateGemma wird danach von Hand geladen (docs/server-test-ablauf.md).
# Ablauf: Pakete + Code + Whisper + Stimmen laden, dann GPU-Treiber installieren, dann Neustart.
exec > /var/log/kidolmetscher-init.log 2>&1
set -u
export HOME=/root DEBIAN_FRONTEND=noninteractive
echo "== Start $(date -Is)"
apt-get update -y
apt-get install -y git python3-venv python3-pip curl ubuntu-drivers-common
# Code holen und alles Noetige laden (ohne TranslateGemma, ohne GPU-Pruefung: der Treiber kommt erst danach)
git clone --branch ccr-4bf88cb4-flgtez https://github.com/justusroman123/nachhaltigkeit.git /root/kidolmetscher/src
SKIP_APT=1 bash /root/kidolmetscher/src/kidolmetscher/scripts/server_setup.sh
echo "== GPU-Treiber $(date -Is)"
ubuntu-drivers devices
ubuntu-drivers install
echo "== Fertig, Neustart $(date -Is)"
touch /root/kidolmetscher/INIT_FERTIG
reboot
