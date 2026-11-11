# Firewall-Vorschlag für den GPU-Server (Stand 11.11.2026)

**Nur ein Vorschlag. Nichts davon wurde ausgeführt oder aktiviert.** Vor dem Aktivieren: Zugang zum Server sichern
(zweite SSH-Sitzung offen lassen), sonst kann man sich aussperren.

Ziel (Plan, Phase 1): nur SSH und HTTPS von außen. Die Anwendung selbst (Port 8000) ist nur im internen Docker-Netz erreichbar.

Beispiel mit `ufw` (Ubuntu/Debian). Ob der Server `ufw` nutzt, welche Firewall der Anbieter vorgelagert hat und ob Docker
eigene Regeln setzt, ist **unbekannt** und beim Anbieter bzw. auf dem Server zu prüfen:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
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
