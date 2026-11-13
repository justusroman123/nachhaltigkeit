#!/bin/bash
# MINI-STARTER fuer das Feld "Cloud-Init Initialisierungsskripte" der centron-Console (beim Anlegen der VM, "Erweiterte Optionen").
# Nur die ZWEI Werte unten ersetzen, den ganzen Text einfuegen, VM erstellen. Alles Weitere erledigt das Hauptskript aus dem
# Repository (scripts/cloud-init-gpu.sh): Treiber, Pakete, Modelle, HTTPS, Dienst, Neustart. Fortschritt: /var/log/kidolmetscher-init.log
# Die Werte gehoeren NUR in Ihre lokale Kopie dieser Datei, nie ins Repository oder in den Chat.
export HF_TOKEN="HIER_DAS_HUGGING_FACE_TOKEN"
export OPERATOR_KEY="HIER_EIN_SELBST_GEWAEHLTER_SCHLUESSEL_NUR_BUCHSTABEN_UND_ZIFFERN_MIND_24"
# Optional: eigene Adresse (DNS-Eintrag muss auf die IP der VM zeigen), sonst Ersatzadresse <ip>.sslip.io
export DOMAIN=""
export MT_REPO="google/translategemma-12b-it"
curl -fsSL https://raw.githubusercontent.com/justusroman123/nachhaltigkeit/ccr-4bf88cb4-flgtez/kidolmetscher/scripts/cloud-init-gpu.sh -o /root/cloud-init-gpu.sh && bash /root/cloud-init-gpu.sh
