# Firewall-Vorschlag für den GPU-Server (Stand 11.11.2026, Status berichtigt 17.11.2026)

**Stand 17.11.2026 (Abgleich mit Skripten und Code):**
- **Keine Firewall ist eingerichtet.** Kein Skript legt eine Sperre an: `scripts/cloud-init-gpu.sh` (Zeile 51) und `scripts/oeffentlich_freigeben.sh` (Zeile 29) führen nur `ufw allow` aus, **wenn ufw bereits aktiv ist**. Es gibt keinen Treffer für `deny outgoing` oder `default deny` in `scripts/`. Der centron-Wizard bietet keine Firewall-Einstellung (kostenpflichtige Cloud Firewall 7,58 € pro Monat, nicht gebucht). Ob Port 80 und 443 vom Anbieter standardmäßig offen sind, zeigt nur der Test; belegt ist seit 15.11.2026, dass Port 443 von außen erreichbar ist (Protokoll Abschnitt 18).
- **Ausgehender Verkehr ist derzeit nicht gesperrt und nicht gemessen.** Belegt sind nur der Code ohne Netzwerk-Clients (Test `server/tests/test_keine_ausgehenden_verbindungen.py`) und die Offline-Einstellungen der Modell-Bibliotheken (`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, seit 17.11.2026 setzt die Anwendung sie bei lokalen Modellordnern selbst). Ob die Bibliotheken im Betrieb tatsächlich keine Verbindung aufbauen, ist **unbekannt** (Messung: `ss -tnp state established \| grep -v ':22 '` und `tcpdump` auf ausgehende Verbindungsaufbauten während einer Sitzung; danach sperren und wiederholen).
- **Überholt seit 14.11.2026:** Die Aussage „Die Anwendung selbst (Port 8000) ist nur im internen Docker-Netz erreichbar“ beschreibt den Docker-Weg, der **nicht gebaut und nicht getestet** ist. Produktiv läuft die Anwendung als systemd-Dienst und lauscht nur auf `127.0.0.1:8000`; davor steht Caddy (Ports 80 und 443).
- Das Beispiel unten ist weiterhin **nur ein Vorschlag**. Es enthält `ufw default allow outgoing`; das gilt nur für die Einrichtungsphase (Modelle, Pakete laden) und **widerspricht** dem Ziel, im Betrieb ausgehenden Verkehr zu sperren (Abschnitt „Ausgehende Verbindungen“, `docs/datenschutz-nachweis.md`). Die Aussage „im Datenpfad kein Drittanbieter“ stützt sich deshalb bisher auf den Code, nicht auf eine Sperre.

**Nur ein Vorschlag. Nichts davon wurde ausgeführt oder aktiviert.** Vor dem Aktivieren: Zugang zum Server sichern
(zweite SSH-Sitzung offen lassen), sonst kann man sich aussperren.

Ziel (Plan, Phase 1): nur SSH und HTTPS von außen. Die Anwendung selbst (Port 8000) ist nur intern erreichbar. *Überholt seit 14.11.2026: „im internen Docker-Netz“; im produktiven Weg (systemd) lauscht sie nur auf `127.0.0.1:8000`.*

Beispiel mit `ufw` (Ubuntu/Debian). Ob der Server `ufw` nutzt, welche Firewall der Anbieter vorgelagert hat und ob Docker
eigene Regeln setzt, ist **unbekannt** und beim Anbieter bzw. auf dem Server zu prüfen:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing   # nur Einrichtungsphase; im Betrieb ersetzen (siehe unten)
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 80/tcp comment 'HTTP, nur fuer Zertifikatsausstellung und Weiterleitung auf HTTPS'
# erst nach Pruefung aktivieren:
# sudo ufw enable
```

Hinweise:
- Port 80 braucht Caddy für die automatische Zertifikatsausstellung (je nach Verfahren). Wenn der Plan strikt „nur SSH und 443“ vorsieht, muss ein anderes Zertifikatsverfahren gewählt werden. Entscheidung offen.
- Docker kann veröffentlichte Ports an `ufw` vorbei freigeben. Deshalb veröffentlicht `docker-compose.yml` im Profil `gpu` nur die Caddy-Ports 80 und 443.
- SSH nur mit Schlüssel, Passwort-Anmeldung abschalten (Serverkonfiguration, nicht Teil dieser Anwendung).

## Ausgehende Verbindungen (Datenschutz)

Für die Aussage „im Datenpfad läuft nichts über Fremdserver“ reicht der Code allein nicht. Zusätzlich auf dem Server:
- Im Betrieb (Sitzung läuft) **ausgehenden Verkehr sperren**, außer was die Anwendung nachweislich braucht (voraussichtlich nichts außer Antworten auf eingehende Verbindungen und die Zertifikatserneuerung von Caddy).
- Modelle, Pakete und Container-Images **vor** dem Termin laden (dafür kurz Zugriff auf Hugging Face, Paket- und Container-Register erlauben), danach sperren.
- Die Compose-Datei setzt für die Modell-Bibliotheken `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1` und schaltet Telemetrie ab. Ob die später gewählten ASR-/MT-/TTS-Bibliotheken noch weitere Verbindungen aufbauen, ist **unbekannt** und mit einer Netzwerkmessung (z. B. Protokoll der gesperrten ausgehenden Verbindungen) zu prüfen.
