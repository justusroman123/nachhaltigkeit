# Betrieb: Aufrufen, Sprachen, Hosting (Stand 09.11.2026)

Google Drive enthält nur Dokumente, **nicht** die Anwendung. Die Anwendung ist ein Server, der irgendwo laufen muss;
Bedienplatz und Zuhörer rufen ihn im Browser auf.

## 1. So wird die Anwendung bedient

**Bedienplatz (Chromebook):** Adresse des Servers öffnen (z. B. `https://dolmetscher.example.org/`).

1. Bedienschlüssel eingeben. Sprachen anhaken (Ukrainisch, Arabisch, Englisch, Türkisch sind vorab angehakt, Persisch optional).
2. **„Sitzung starten“.** Es erscheint ein QR-Code mit Link: auf Beamer/Bildschirm zeigen oder Link kopieren und verschicken.
3. Mikrofon prüfen (ein DJI-Mikrofon wird automatisch gewählt), **„Senden starten“**, sprechen.
4. Unter „Live“ sieht man, wie viele Zuhörer in welcher Sprache verbunden sind, und die Verzögerung.
5. Ende: **„Sitzung beenden und alles löschen“** (Links ungültig, Puffer gelöscht).

**Zuhörer (Handy/Tablet):** QR-Code scannen oder Link öffnen, **auf die eigene Sprache tippen**, fertig. Untertitel erscheinen groß.
Oben rechts: 🌐 Sprache wechseln, 🔇/🔊 Ton an/aus (Kopfhörer; Ton muss einmal bewusst eingeschaltet werden, sonst blockt der Browser),
A− / A+ Schriftgröße. Der Link läuft nach der eingestellten Zeit ab (Standard 1 Stunde).

**Sprachen:** wählbar sind `uk` Ukrainisch, `ar` Arabisch, `en` Englisch, `tr` Türkisch, `fa` Persisch (optional).
Welche Sprachen überhaupt zur Auswahl stehen, steht in `TARGET_LANGS`; was vorab angehakt ist, in `DEFAULT_LANGS`
(siehe `.env.example`). Es wird nur in Sprachen übersetzt, in denen gerade ein Zuhörer verbunden ist.
Ob jede Sprache mit den echten Modellen gut funktioniert, ist **unbekannt** (Mock-Stufen liefern nur Testsätze).

## 2. Heute testen (ohne GPU, ohne Cloud)

Auf einem Rechner mit Python 3: `./start.sh` im Projektordner. Der Bedienschlüssel wird beim Start angezeigt.
Dann `http://localhost:8000/` im Browser. Mikrofon geht auf `localhost`.

Zuhörer-Handys im selben WLAN: `HOST=0.0.0.0 ./start.sh` (öffnet den Server im lokalen Netz, nur in vertrauenswürdigem Netz),
am Bedienplatz im Feld „Adresse für Zuhörer“ die Adresse des Rechners eintragen (`http` + `://` + IP des Rechners + `:8000`).
Zuhörer brauchen kein Mikrofon, daher geht das ohne HTTPS. Der Bedienplatz selbst bleibt auf `localhost`.

## 3. Wo soll es laufen? Empfehlung

| Option | Bewertung |
| --- | --- |
| **A. Auf dem gemieteten GPU-Server in Deutschland (empfohlen)** | Die Pipeline läuft dort ohnehin. Audio und Texte verlassen den Server nicht, kein zusätzlicher Anbieter. Server vor Ort in Deutschland. |
| B. Zusätzlicher kleiner Server nur für Tests ohne GPU | Sinnvoll, falls der GPU-Server noch nicht verfügbar ist. Zusätzlicher Anbieter, Kosten **unbekannt**. Nur nach Rückfrage. |
| C. US-Cloud-Dienste für den Audiopfad | **Nicht empfohlen**: Datenschutz und Auftragsverarbeitung wären zusätzlich zu klären. |
| D. Tunnel-Dienste (z. B. ngrok, Cloudflare-Tunnel) | Nur für kurze Tests, nicht für echte Veranstaltungen: der gesamte Verkehr läuft über einen Dritten; Konto nötig. |
| E. Google Drive/Docs | **Ungeeignet**: kann keine Anwendung ausführen. Bleibt Ablage für Dokumente. |

**Warum HTTPS nötig ist:** Der Browser erlaubt Mikrofonzugriff nur über HTTPS (oder `localhost`). Der Bedienplatz auf dem
Chromebook braucht daher eine Adresse mit gültigem Zertifikat. Zuhörer brauchen es technisch nicht, aber ohne HTTPS warnen Browser.

**Was dafür gebraucht wird (nichts davon habe ich angelegt oder gekauft):**

1. Eine **Domain** oder Subdomain, die auf die Adresse des GPU-Servers zeigt. Kosten: **unbekannt**, abhängig vom Anbieter.
2. Einen **Reverse Proxy** mit automatischem Zertifikat, z. B. Caddy (freie Software). Beispiel `Caddyfile`
   (von mir **nicht getestet**; Zugriffsprotokoll nicht aktivieren, bitte Standardverhalten der installierten Version prüfen):

   ```
   dolmetscher.example.org {
       reverse_proxy 127.0.0.1:8000
   }
   ```

3. Auf dem Server: Anwendung starten (`docker compose ... --profile gpu up` oder `./start.sh`), `PUBLIC_URL=https://dolmetscher.example.org`
   und einen langen `OPERATOR_KEY` setzen (nicht ins Repository).
4. Firewall: nur Ports 80 und 443 (und SSH) öffnen. Der Anwendungs-Port 8000 bleibt nur lokal.

**Datenschutz-Punkte, die vor dem echten Einsatz geklärt werden müssen (ich bin kein Jurist):**
Auftragsverarbeitungsvertrag mit dem Hosting-Anbieter, Hinweis an Zuhörer, Aufbewahrungsfristen des Anbieters (Server-Logs, Snapshots),
ob die Muttergesellschaft des Anbieters außerhalb der EU sitzt. Antworten dazu: **unbekannt**.

## 4. Offene Fragen an den Betreiber

1. Bei welchem Anbieter ist der GPU-Server gemietet? (bestimmt die konkreten Schritte, Basis-Image und Netzwerkregeln)
2. Gibt es schon eine Domain, die genutzt werden kann?
3. Soll ich Schritt für Schritt eine Installationsanleitung für diesen Anbieter schreiben? (Installation auf dem Server nur nach Ihrer Freigabe.)

## Nachtrag 11.11.2026: Angaben aus dem Plan-Dokument

- **Anbieter laut Plan: centron** (RTX 6000 Ada 48 GB, Standort Hallstadt, 1,19 € pro Stunde netto, stündliche Abrechnung); Alternative STACKIT L40S (1,74 € pro Stunde).
  Von mir **nicht** geprüft (Seiten aus der Sitzung nicht erreichbar). Offene Punkte beim Anbieter: AVV, Kosten pausierter Server, Gesamtpreis, Zertifizierungen. Fragenliste: `docs/kosten.md`.
- **Docker mit HTTPS:** `docker compose -f docker/docker-compose.yml --profile gpu up --build` startet die Anwendung (Dienst `gpu`, Modelle als Nur-lese-Volume `/models`) und davor Caddy (`docker/Caddyfile`).
  Nötig: `.env` mit `OPERATOR_KEY`, Umgebungsvariablen `BASE_IMAGE`, `DOMAIN`, `MODELS_DIR`. **Nicht gebaut und nicht getestet.**
- **Firewall:** nur Vorschlag, nichts aktiviert: `docs/firewall-vorschlag.md`.
- **Kosten und Budget:** `docs/kosten.md`; Anzeige am Bedienplatz über `SERVER_HOURLY_EUR` und `BUDGET_EUR`.
- **Vorführung:** Skript und Checkliste in `docs/vorfuehrung.md`.
- Die Frage nach dem Anbieter ist damit beantwortet. Offen bleiben: Domain (Subdomain von kischub.de?) und Budgetgrenze (Vorschlag des Plans: 50 €).
