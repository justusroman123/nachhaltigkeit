# Datenschutz-Nachweis für Gespräche mit Behörden und Unternehmen (Stand 12.11.2026)

Zweck: Sie sollen Kunden nur das zusagen, was belegt ist. **Keine Rechtsberatung, keine Zertifizierung.** Eine Aussage wie „super sicher“ oder „DSGVO-konform zertifiziert“ lässt sich damit **nicht** begründen.

## 1. Was belegt ist

| Aussage | Beleg | Art des Belegs |
| --- | --- | --- |
| Audio und Text werden nicht gespeichert (nur Arbeitsspeicher, Puffer weg bei Sitzungsende) | Tests `test_sitzungsende_benachrichtigt_und_loescht`, `test_finish_gibt_rest_aus_und_leert_puffer` | automatischer Test (mit Attrappen) |
| Keine Inhalte in den Protokollen (nur Zeiten und Zähler) | Test `test_keine_inhalte_in_logs`; Server startet mit `--no-access-log` | automatischer Test |
| Keine Cookies, kein Tracking, kein Browser-Speicher | Prüflauf nach Plan-Prompt F (Speicher leer, 0 Cookies); statische Tests der Web-Dateien | Browser-Test in Chromium |
| Browser lädt nichts von Fremdservern (keine CDNs, Schriften, Skripte) | Prüflauf F: nur der eigene Ursprung; strenge Content-Security-Policy (Test) | Browser-Test, Header-Test |
| Der Anwendungscode baut selbst keine ausgehenden Verbindungen auf | Test `test_keine_ausgehenden_verbindungen.py` (keine Netzwerk-Clients, keine Fremdadressen in `server/app`) | statischer Test, **nur Code der Anwendung**, nicht die späteren Modell-Bibliotheken |
| Zuhörer-Links sind zufällig und laufen ab (auch bei laufender Verbindung) | Tests zu Token und Ablauf | automatischer Test |
| Bedienplatz geschützt (Schlüssel, nur ein Bedienplatz, Herkunftsprüfung) | Tests; die Demo ohne Schlüssel ist nur auf dem eigenen Rechner erlaubt (Test) | automatischer Test |

## 2. Was der Anbieter laut eigenen Angaben bietet (von mir gelesen, nicht unabhängig geprüft)

Quelle: www.centron.de, gelesen am 11./12.11.2026.
- Eigenes Rechenzentrum in Hallstadt bei Bamberg; „Ihre Daten verlassen Deutschland nicht“.
- „Inhabergeführtes deutsches Unternehmen ohne ausländische Konzernmutter“, daher laut centron Unterwerfung nur unter deutsches und europäisches Recht.
- Zertifizierungen laut Seite: ISO 27001 auf Basis IT-Grundschutz, BSI C5:2020 Typ 1, ISO 9001, ISO 14001. **Ob das auch für die GPU-Instanzen gilt: unbekannt.**
- Auftragsverarbeitungsvertrag nach Art. 28 DSGVO samt TOMs öffentlich einsehbar; Abschluss über compliance@centron.de. Der Vertrag sieht u. a. weisungsgebundene Verarbeitung vor, **Drittlandverlagerung nur mit vorheriger dokumentierter Zustimmung**, Löschung oder Rückgabe am Ende. Abschnitt „Unterauftragsverhältnisse“ (Unterauftragnehmer) wurde **nicht im Detail gelesen**.

## 3. Wohin die Daten fließen (Datenpfad der Übersetzung)

Sprecher → Mikrofon → Browser auf dem Bedienplatz → verschlüsselte Verbindung (HTTPS/WSS) → Server in Hallstadt (nur Arbeitsspeicher: Spracherkennung, Übersetzung, Sprachausgabe) → verschlüsselte Verbindung → Browser der Zuhörer (Tablets).

**Im Datenpfad der Übersetzung ist nach der Konzeption kein Dienst eines Dritten vorgesehen** (insbesondere keine Cloud-API von Google, Microsoft, OpenAI u. a.). Das gilt für die Anwendung; die echten Modelle sind noch nicht eingebaut und ihre Bibliotheken noch nicht auf Fremdverbindungen geprüft.

### Drittparteien, die bei Aufbau und Betrieb vorkommen, aber **keine Gesprächsinhalte** sehen

| Drittpartei | Wofür | Sieht | Anmerkung |
| --- | --- | --- | --- |
| Hugging Face | einmaliger Download der Modelle (Whisper, TranslateGemma) vor dem Termin | Anfrage des Servers, ggf. Ihr Zugriffs-Token | Sitz des Unternehmens von mir nicht geprüft. Modelle danach lokal; Compose schaltet Abrufe zur Laufzeit ab. |
| Paket- und Container-Register (z. B. PyPI, Docker Hub) | Installation vor dem Termin | Anfrage des Servers | Sitz nicht geprüft; vor dem Termin erledigen, danach ausgehenden Verkehr sperren. |
| Zertifizierungsstelle (Caddy nutzt standardmäßig eine öffentliche Stelle für HTTPS-Zertifikate; welche, habe ich nicht geprüft) | HTTPS-Zertifikat der Domain | Domainname, Serveradresse | keine Gesprächsdaten; Domainname kann in öffentlichen Zertifikatsprotokollen stehen. |
| Anbieter der Domain/DNS | Namensauflösung | Anfragen an den Domainnamen | beim Domain-Anbieter klären. |
| Browser- und Geräte-Hersteller | Chromebook (Chrome/ChromeOS), Tablets | je nach Einstellung Telemetrie, Synchronisierung, Diktier-/Assistenzfunktionen | **außerhalb unserer Kontrolle.** Empfehlung (Plan): Gastprofil oder zurückgesetzte Geräte, kein Konto, keine fremden Apps, privater Modus, Verlauf danach löschen. Diktier- und Sprachassistenz-Funktionen prüfen und abschalten. Was ChromeOS genau sendet: unbekannt. |

## 4. Was Sie Kunden (noch) nicht sagen sollten

- „Läuft nicht über amerikanische Server“ **ohne Zusatz**: Zutreffend und belegbar ist nur: „Die Verarbeitung der Sprache und der Texte erfolgt auf einem Server in Deutschland; im Datenpfad ist kein Dienst eines Drittanbieters vorgesehen.“ Einmalige Vorbereitungsschritte (Modell-Download) laufen über Dienste, deren Sitz ich nicht geprüft habe, und enthalten keine Gesprächsdaten.
- „DSGVO-konform“, „BSI-zertifiziert“, „C5-konform“, „behördentauglich“: Das sind Bewertungen, die Ihnen dieses Dokument nicht liefert (Anbieterangaben ≠ Zertifizierung Ihrer Lösung).
- „Fehlerfrei“ oder „vollständig“: Die Übersetzung ist KI-erzeugt; Hinweis laut Plan nötig (Art. 50 KI-VO, Übergangsfrist laut Plan bis 02.12.2026).

## 5. Offene Punkte vor einem Einsatz bei Behörden/Unternehmen

1. Rechtliche Prüfung (Datenschutzbeauftragte/r bzw. Fachleute): Datenschutz-Merkblatt, KI-Hinweis, AVV, Verzeichnis der Verarbeitungstätigkeiten, ggf. Datenschutz-Folgenabschätzung.
2. AVV mit dem Anbieter abschließen, TOMs und Unterauftragnehmer prüfen.
3. **Gemma-Bedingungen:** Das Bereitstellen als gehosteter Dienst gilt laut Text als „Distribution“; Nutzungseinschränkungen sind in Ihre Nutzungsbedingungen aufzunehmen (Details: `docs/lizenzen-recherche.md`).
4. Ausgehenden Verkehr auf dem Server sperren und mit einer Messung belegen (`docs/firewall-vorschlag.md`); Bibliotheken der echten Stufen prüfen.
5. Protokolle des vorgeschalteten Proxys (Caddy) und des Anbieters (Server-Logs, Snapshots) klären: Aufbewahrung, Inhalt.
6. Penetrationstest, Verschlüsselung der Verbindung (TLS-Konfiguration prüfen), Zugriffsschutz des Bedienplatzes bei öffentlicher Erreichbarkeit (kein Schutz gegen Dauer-Raten des Schlüssels).
7. Geräteleitfaden für Chromebook und Tablets (Gastprofil, Diktier-/Assistenzfunktionen aus).

## 6. Formulierungsvorschlag (nur belegte Aussagen, vor Verwendung rechtlich prüfen lassen)

> Die Sprache wird live auf einem Server in Deutschland verarbeitet (Rechenzentrum Hallstadt, Anbieter mit eigenem Rechenzentrum). Es werden weder Audio noch Text gespeichert; Protokolle enthalten nur Zeiten und Zähler. Die Seiten für Bedienplatz und Zuhörer laden keine Inhalte von Drittanbietern und verwenden keine Cookies oder Tracking. Zuhörer treten über zufällige, zeitlich begrenzte Links bei. Die Übersetzung wird von einer KI erzeugt und kann Fehler enthalten.
