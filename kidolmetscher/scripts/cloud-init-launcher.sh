#!/bin/bash
# MINI-STARTER fuer das Feld "Cloud-Init Initialisierungsskripte" der centron-Console (beim Anlegen der VM, "Erweiterte Optionen").
# Nur die ZWEI Werte unten ersetzen, den ganzen Text einfuegen, VM erstellen. Alles Weitere erledigt das Hauptskript aus dem
# Repository (scripts/cloud-init-gpu.sh): Treiber, Pakete, Modelle, HTTPS, Dienst, Neustart. Fortschritt: /var/log/kidolmetscher-init.log
# Die Werte gehoeren NUR in Ihre lokale Kopie dieser Datei, nie ins Repository oder in den Chat.
export HF_TOKEN="HIER_DAS_HUGGING_FACE_TOKEN"
export OPERATOR_KEY="HIER_EIN_SELBST_GEWAEHLTER_SCHLUESSEL_NUR_BUCHSTABEN_UND_ZIFFERN_MIND_24"
# Optional: eigene Adresse (DNS-Eintrag muss auf die IP der VM zeigen), sonst Ersatzadresse <ip>.sslip.io
export DOMAIN=""
# Modell: 12B fuer die RTX 6000 Ada (48 GB), 4B fuer die RTX A4000 (16 GB, guenstiger).
export MT_REPO="google/translategemma-4b-it"
# Vorauswahl der Sprache(n) im Bedienplatz (eine Sprache = weniger Rechenlast), z. B. "uk" oder "uk,en".
export DEFAULT_LANGS="uk"
# Stundenpreis der gewaehlten VM (netto, Zahl mit Punkt) nur fuer die Kostenanzeige; erst nach Pruefen im Checkout eintragen, sonst leer.
export SERVER_HOURLY_EUR=""
curl -fsSL https://raw.githubusercontent.com/justusroman123/nachhaltigkeit/ccr-4bf88cb4-flgtez/kidolmetscher/scripts/cloud-init-gpu.sh -o /root/cloud-init-gpu.sh && bash /root/cloud-init-gpu.sh
