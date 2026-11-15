# VM neu einrichten (Ablaufplan, Stand 15.11.2026)

**Stichwort für einen neuen Chat:** „Ich möchte die VM wieder einrichten.“ Dann dieses Dokument Schritt für Schritt abarbeiten: jeweils **einen** Schritt nennen, auf das Ergebnis warten, nichts vorwegnehmen. Token und Schlüssel **nie** in den Chat (Nutzer tippt sie nur in die versteckte Abfrage des Skripts).

**Status der Teile:** Gelaufen am 14./15.11.2026: Setup-Skripte auf der VM (mit mehreren Fehlversuchen, jetzt behoben), HTTPS-Adresse, Dienst, Handy-Test. **Ungetestet:** `windows/vm-einrichten.ps1` (Ein-Klick-Einrichtung) und der Gesamtablauf ohne manuelle Eingriffe. Cloud-Init-Feld der Console: **nicht verwenden** (Text kam nicht an, VM wurde einmal als „fehlgeschlagen“ markiert).

## Einmalig vorbereitet (vorhanden)
- centron-Konto, SSH-Schlüssel `kidolmetscher-test` (in der Console hinterlegt, privater Schlüssel am Windows-PC).
- Hugging-Face-Konto mit Freigabe für TranslateGemma 4B/12B/27B.
- DNS: A-Eintrag `dolmetscher` bei ALL-INKL (KAS), zeigt auf die jeweils letzte VM-IP. Wildcard `*` und Hauptdomain **nie ändern**.

## Ablauf
1. **Vorher besorgen:** neues Hugging-Face-Lesetoken (Typ Read; altes löschen), Bedienschlüssel (24 oder mehr Buchstaben/Ziffern, im Passwort-Manager) **oder** das Skript einen erzeugen lassen.
2. **VM anlegen (selbst oder mit Plugin-Prompt „Wizard vorbereiten“, Cloud-Init AUS):** GPU RTX A4000 16 GB, Bamberg BBG1, 4 vCPU / 16 GB RAM / 100 GB, Ubuntu LTS 26, SSH-Key `kidolmetscher-test`, Name `kidolmetscher-test`. Preisleiste prüfen (zuletzt 0,2652 € pro Stunde netto), **selbst „VM erstellen“ klicken**. Status in der Serverliste prüfen: Steht dort „Fehlgeschlagen“, nicht weitermachen.
3. **IP notieren** (VM-Seite, Netzwerk). **DNS-Eintrag `dolmetscher` bearbeiten** (KAS: Tools → DNS-Einstellungen → kischub.de → Stift beim Eintrag `dolmetscher` → neue IP). Nur diesen einen Eintrag ändern; die Liste muss 9 Einträge zeigen.
4. **Am Windows-PC `windows\vm-einrichten.bat` doppelklicken.** Das Skript fragt IP, Token und Schlüssel (unsichtbar), prüft SSH, schickt das Startskript, wartet (ca. 10 bis 20 Minuten, **ungemessen**) und prüft `https://dolmetscher.kischub.de/healthz`. Am Ende zeigt es die Adresse (und den Schlüssel, falls erzeugt: in den Passwort-Manager kopieren).
5. **Testen:** Bedienplatz öffnen, anmelden, Sitzung, QR-Code am Handy, 10 Sekunden sprechen.
6. **Fertig: VM zerstören** (Console → ccloud³ → Server → `kidolmetscher-test` → Zerstören, Namen eingeben). Billing am nächsten Tag prüfen.

## Falls das Skript fehlschlägt (Rückfall von Hand, nur mit Einzelbefehlen)
- SSH am Windows-PC: `ssh root@<IP>` (Prompt muss `root@xv…:~#` zeigen).
- Fortschritt: `grep -a "^==" /var/log/kidolmetscher-init.log | tail -n 10`
- Modell fehlt (`/root/kidolmetscher/models/translategemma` nicht da): `strings /var/log/kidolmetscher-init.log | grep HINWEIS`; Token prüfen; Modell laden: ` HF_TOKEN='hf_…' /root/kidolmetscher/.venv/bin/python /root/kidolmetscher/src/kidolmetscher/scripts/fetch_models.py google/translategemma-4b-it /root/kidolmetscher/models/translategemma`, dann `systemctl restart kidolmetscher`.
- Dienst/Zertifikat: `journalctl -u kidolmetscher --no-pager | tail`, `journalctl -u caddy --no-pager | tail`.
- Neue Programmversion einspielen: `cd /root/kidolmetscher/src && git pull -q --ff-only && systemctl restart kidolmetscher`.

## Bekannte Stolpersteine (alle am 14./15.11. erlebt)
- Bei der Einrichtung **Befehle einzeln** eingeben; nie `cat > datei` und danach Befehle tippen; Prompt (`C:\Users\Dell>` = PC, `root@xv…:~#` = VM) vor jedem Befehl prüfen.
- Variablennamen nicht überschreiben (`HF_TOKEN=` bleibt stehen): deshalb die versteckte Abfrage im Skript.
- Alte VM-IP im Browser-Cache: `ipconfig /flushdns`; Test an DNS vorbei: `curl.exe -I --resolve dolmetscher.kischub.de:443:<IP> https://dolmetscher.kischub.de/`.
- Der Dienst startet erst nach dem Neustart der VM; das Setup meldet „Fertig, Neustart“.

## Test-Empfehlung vor dem nächsten GPU-Einsatz
Skript `vm-einrichten.ps1` **einmal auf einer billigen Nicht-GPU-VM** (centron „Optimiertes Cloud Computing“) ausprobieren: Zustellung per SSH, Ports 80/443, Zertifikat. Die GPU-spezifischen Schritte (Treiber, Whisper, Modell) bleiben dabei ungeprüft.
