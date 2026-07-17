# 🚇 Berlin Untergrund – U-Bahn Odyssee

Ein kleines **3D-Spiel** (Third-Person, Hitman-Style light) am Berliner
U-Bahnhof **Kottbusser Tor**. Du läufst über den Bahnsteig, sprichst die
typischsten Berliner:innen an, kaufst dir bloß rechtzeitig einen Fahrschein –
und lässt dich **nicht** von den BVG-Kontrolleuren erwischen. 🎫

## Spielen

Einfach den GitHub-Pages-Link öffnen (oder `docs/index.html` im Browser) –
läuft komplett im Browser, auf **Desktop und Smartphone**, kein Download,
nichts umstellen.

## Steuerung

**Kamera-relative Steuerung mit frei drehbarer Ansicht** (mathematisch sauber):
dreh die Ansicht wie du willst – **„vorwärts" geht immer in den Bildschirm
hinein**, **links ist wirklich bildschirm-links, rechts bildschirm-rechts**. So
kannst du die Kamera einmal ausrichten und dann intuitiv navigieren.

Beim Start erklärt ein **Tipp-Banner**, dass man mit **Maus ziehen / Wischen die
Kamera dreht** – das war vorher nicht offensichtlich.

## 🎬 Der Auftakt (sofort Spaß)

Direkt nach dem Start läuft eine kleine **Comedy-Show**: eine absurde
BVG-Durchsage („Wir entschuldigen uns für die Vergangenheit, die Gegenwart und
die Zukunft."), der **🥙 Döner-Ali** steht direkt vor dir und ruft „Ey, mit
alles?", eine 🐀 grinst „Miete? Kenn ick nich.", Techno-Klaus fragt „welcher
Tag?" – und du bekommst **sofort einen Willkommens-Moment geschenkt** 🌟. Der
**Aktions-Knopf zeigt von der ersten Sekunde an**, wen du ansprechen kannst.

| Aktion | Desktop | Handy |
| --- | --- | --- |
| Laufen | `W A S D` / Pfeiltasten | Linker Joystick |
| Ansicht drehen / neigen | Maus ziehen | Rechts über den Screen wischen |
| Interagieren | `E` | **Aktions-Knopf** (Label passt sich an) |
| Rennen | `Shift` | **RENN**-Knopf |
| Ton an/aus | 🔊-Button oben rechts | 🔊-Button oben rechts |

Am Start wählst du deine **Spielfigur** aus (Kreuzberg-Kid, Techno-Raverin,
Rave-Oma, Sterni-Opa, Touristin, Currywurst-Renate, Döner-Ali, Fixie-Hipster).

Der **Aktions-Knopf ist kontextabhängig** und erscheint nur, wenn wirklich etwas
in der Nähe ist – z. B. `HOCH`, `RUNTER`, `EINSTEIGEN`, `AUTOMAT`, `SCHMIEREN`,
`START`, `REIN`.

## Ziel – die ganze Linie U1 fahren

Fahr die **U1** über **4 Stationen**: **Kottbusser Tor → Görlitzer Bahnhof →
Warschauer Straße → Alexanderplatz**. An jeder Station:

**Wichtig:** An jeder Station musst du **erst raus an die Oberfläche** (🚪
Ausgang – der Marker pulsiert, wenn's dran ist) und den Kiez erkunden, **bevor**
du in die U-Bahn einsteigen kannst. Nur die paar Momente unten reichen nicht.

1. **Quatsch die Leute an** (3 pro Station) – über ein Dutzend typische
   Berliner:innen mit eigenen Sprüchen: 🍺 Sterni-Opa, 🎧 Techno-Klaus (seit
   Freitag wach), 🌭 Currywurst-Renate, 🥙 Döner-Ali, 🐕 Punk mit Hund,
   🚲 Fahrrad-Reinschlepper, 🎻 Straßenmusiker, 📸 verlorenes Touri-Paar,
   🏪 Späti-Chef, 📱 Handy-Schnacker, 🧳 Rentnerin, 🔊 Handy-Lautsprecher-Typ …
2. **Warte auf die einfahrende gelbe U-Bahn** 🚇 – sie rollt mit Quietschen ein,
   öffnet die Türen („Zurückbleiben bitte!") …
3. … **steig ein** und fahr zur nächsten Station. Am **Alexanderplatz** ist
   Endstation – „Alles aussteigen bitte!"

Vergiss an der ersten Station den 🎫 **Fahrschein am Automaten** nicht: Ab
Görlitzer Bahnhof patrouillieren **BVG-Kontrolleure** 👮. Erwischen sie dich
ohne Fahrschein, gibt's **60 € erhöhtes Beförderungsentgelt** – und Game Over.

## 🚪 Raus an die Oberfläche!

An jeder Station kannst du über den **Ausgang 🚪 nach oben** an die Straße –
die ganze Umgebung wechselt von U-Bahnhof zu **Berliner Kiez bei Tageslicht**
(Himmel, Altbauten, Späti, Currywurst-Imbiss, Autos, Bäume, U-Bahn-Eingang).
Jeder Kiez sieht anders aus (Fernsehturm, Oberbaumbrücke, Görli-Park …).

Die Figuren haben jetzt **Gesichter** (Augen, Mund, wütende Augenbrauen …),
**laufen herum** statt nur zu stehen, **schauen zu den Passanten** (nicht auf die
Straße) und **drehen sich zu dir**, wenn du näher kommst – die lebende Statue steht
am Gehweg und **guckt sich um, ob wer kommt**. Und es rasen **rücksichtslose
Hindernisse** über den Gehweg, denen du ausweichen musst:

- 🛴 **E-Scooter-Rowdy** („AUS DEM WEG! Klingel is kaputt!") – nietet dich um
- 🚴 **Radfahrer, der nicht guckt** („Ampeln sind Empfehlungen!")

**Physik & Kollision**: Du läufst nicht mehr durch Stände, Laternen, Bäume,
Bänke, E-Scooter-Haufen oder Belohnungs-Bauten hindurch – alles blockt sauber ab.
Und stellst du dich **auf die Fahrbahn**, während ein Auto kommt, wirst du
**weggeschleudert** (in Fahrtrichtung, rauf auf den Gehweg) – „🚗 runter von der
Straße!". Die **Altbauten** zeigen ihre **Fassade jetzt zur Straße** (vorher
kahle Klötze): echte **Fenster mit Sprossenkreuz, Fensterbänken, Blumenkästen**
und ein **Erdgeschoss mit Ladentür & Schaufenstern (mit Markise)** – gleich beim
Rauskommen sieht der Kiez wohnlich aus. Die **Parkbänke** stehen ordentlich an
der Häuserzeile (mit Blick zur Straße) statt mitten im Weg.

## 🎮 12 Minispiele (visuelle Szenen)

In **jedem Kiez** findest du die Minispiel-Schilder (💼 Politiker, 🌙 Görli bei
Nacht, 🎲 Verspätung, 🏠 Wohnung, 🛴 Slalom, 💰 Finanzausgleich, 📋 Bürgeramt,
🕶️ Berlin-Look) plus den **🚌 SEV-Bus** am Straßenrand.

- 🚌 **Schienenersatzverkehr** (überarbeitet – jetzt echtes Gameplay): Die U1
  fällt aus – **du fährst den gelben SEV-Bus** zum Alex. Drei Mechaniken
  greifen ineinander: **Lenken** (◀ ▶ / A D / ziehen) um Baustellen 🚧, Staus
  🚗 & Schlaglöcher 🕳️, **📣 Hupen** (Leertaste/Knopf) scheucht Radler 🚴 &
  Fußgänger 🚶 weg und baut **Combos** – nervt aber die Fahrgäste, und an den
  **🚏 Haltestellen** musst du auf die richtige Seite lenken, um Leute
  mitzunehmen. Dazu **Zufalls-Events** mit dicken Bannern (🚧 Umleitung, ✊ Demo,
  🥳 Karneval, 🚦 Ampel kaputt), **Motorsound & Hupe**, wackelnder Bus mit
  Fahrgästen und die echten Busfahrer-Sprüche samt meuterndem Publikum
  („FARIKAAARTE!").

Alle Minispiele haben jetzt **mehr Sound & Musik** – Motorbrummen, Hupe,
Stempel-Klacken (Bürokratie), Münz-Blings (Finanzausgleich), Würfel-Klackern,
Buh-Rufe bei Fehlern und kleine **Siegs-Fanfaren mit Applaus**. Unten im **U-Bahnhof** gibt's zusätzlich den 🔧 Automaten, die
🎲 BVG-Leitstelle mit großer **Verspätungs-Anzeigetafel** und das 👁️
**Blickduell**. Die 👮 **Fahrkartenkontrolle** ist – logischerweise – **unten im
U-Bahnhof** (die Kontrolleure schnappen dich am Bahnsteig).

- 🌙 **Görli bei Nacht** (Stealth, überarbeitet – jetzt klar & fair): Bring
  **🧍 DICH nach oben zum Ausgang**. Die **Dealer** leuchten ihren **Blick-Kegel**
  ab (wird er **rot**, sehen sie dich); in den **🌳 Büschen bist du versteckt**.
  Von Busch zu Busch nach oben schleichen. Steuerung: Pfeile/WASD oder ziehen.
- 📋 **Bürokratie-Turm** (neu, Bürgeramt): Stapel Berliner Behörden-Formulare
  (Anmeldung, Antrag A38, Wohnungsgeberbestätigung …) **bündig** zu einem
  absurden **Aktenturm**. Überstand fällt ab – 8 Anträge hoch = Ehren-Beamter.
- 🕶️ **Berlin-Look-Battle** (neu): Kombinier ein **so absurdes Outfit** wie
  möglich (Bauchfrei-Netzhemd, Sandalen mit Socken, Taube auf der Schulter …).
  Genug Absurditäts-Punkte = Ikone von Kreuzberg. „Is dit Kunst oder kann dit weg?"
- 👁️ **Blickduell in der U-Bahn** (neu): In Berlin gilt **zu langer Blickkontakt
  = Aggression**. Starr den Fahrgast an, solange er **wegschaut** (😌), und
  **lös den Blick sofort**, wenn er **zurückschaut** (👀) – sonst steht er auf:
  „Ey, was guckst du?!".

- 💶 **Politiker schmieren** (neu, als **Ampel** 🚦): Schieb das Kuvert **nur bei
  GRÜN** – springt die Ampel auf ROT, sofort loslassen, sonst fliegst du auf.
- 🚔 **Kontrolle-Schleichen** (neu, echtes Stealth): Ohne Ticket zum Ausgang
  schleichen, aus dem **Sichtkegel** des Kontrolleurs bleiben, hinter Säulen
  verstecken. (Erwischt dich unten ein Kontrolleur, startet die Flucht direkt.)
- 🎲 **Verspätungen würfeln** (neu): Als BVG-Leitstelle hohe Zahlen würfeln, um
  die **Verärgerung der Fahrgäste auf 100 %** zu treiben. Ein großer Zähler
  zeigt die aufsummierten **Verspätungs-Minuten**, ohne Doppel-1 baust du
  **Combos** (×1,5/×2) auf, Doppel/Signalstörung geben Bonus – aber Doppel-1
  heißt, ein Zug kommt pünktlich (Katastrophe!). Dein Rekord hängt danach als
  **Schandtafel** draußen im Kiez.

## 🏆 Sichtbare Belohnungen

Was du in den Minispielen schaffst, siehst du danach im Kiez:

- **Politiker geschmiert** → dein **🏗️ Baugrundstück** (mit Kran) erscheint.
- **Wohnung bekommen** → daraus wird dein **🔑 Neubau** (gläsernes Hochhaus).
- **Verspätungen-Rekord** → eine große **🚇 „+NN min" Anzeige** auf der Straße –
  **und** die große **Anzeigetafel im U-Bahnhof** glüht dann in Rot mit deinem
  Rekord (z. B. **+97 min · Totalausfall!**).

- 🔧 **Automat reparieren** (am Fahrkartenautomaten, unten): Der Automat ist –
  natürlich – kaputt (mit „DEFEKT"-Display und einer Ratte 🐀). Triff den grünen
  Strom-Bereich, um den Wackelkontakt zu fixen, dann zieht der Automat ein Ticket.
- 💶 **Politiker schmieren** (Straße am Alex): Übergib das Schmiergeld
  **unauffällig** – halte den Knopf, aber nur wenn keiner guckt (👀), sonst
  steigt der Verdacht. Erfolg gibt dir **Baurecht** – damit kannst du bei der
  Wohnungsbesichtigung einfach kaufen.
- 🛴 **Gehweg-Slalom** (Straße): Weich in 3 Spuren den Berliner Gefahren aus –
  E-Scooter-Rowdys, Rentnern mit Rollator, Babys im Lastenrad und Kotti-Gestalten.
- 🏠 **Wohnungsbesichtigung** (Straße): 50 Bewerber:innen vor dir – drängel dich
  sichtbar durch das Getümmel und überzeug am Ende den Vermieter (bestechen,
  ehrlich sein oder mit Baugrundstück direkt kaufen).
- 💰 **Länderfinanzausgleich** (Straße): Berlin lebt vom Geld der anderen! Fang
  mit dem Berliner Bären 🐻 die Goldtaler von **Bayern, Ba-Wü & Niedersachsen**,
  aber lass die **Bürokratie 📄** fallen – satirisch, wie sich die Stadt
  mitfinanziert.

Und du kannst mehr als nur reden – je nach Gestalt eine eigene **Aktivität**:

- 💶 **Filz-Politiker schmieren** (schwarzer Humor, „Für Sie mach ick den BER
  nochmal auf")
- 🪙 **Lebende Statue** mit Münze zum Winken bringen
- 📸 **Foto** mit dem Berliner Bären

Dazu die **schrägsten Gestalten Berlins**, jede mit eigenem Look & eigener
Animation (tanzen, Yoga, panisch rennen, meckern):

- 🩲 **FKK-Sonnenanbeter** (im November, sonnt sich trotzdem)
- 🔊 **Bollerwagen-DJ** (mobiler Rave, tanzt)
- 🐻 **Berliner Bär** im Kostüm (winkt)
- 🧘 **Straßen-Yogi** (Sonnengruß Richtung Späti)
- 🗽 **Lebende Statue** (bewegt sich nur gegen Münze)
- 👟 **Flohmarkt-Verkäufer** mit genau einem Schuh
- 🐦 **Tauben-Fütterer** (umringt von Tauben)
- 🌿 **Dealer-Bande** – gleich mehrere Typen (🌿 Görli-Dealer, 🌳 Parkbank-Dealer,
  🚴 „Lieferando"-Dealer), alle machen **„psst-psst" wie ein Meerschweinchen**,
  sobald du in die Nähe kommst – aber jeder labert **was anderes** und will dir
  unauffällig „Bio-Oregano" & Co. andrehen (satirisch). Höflich abwimmeln =
  Berlin-Moment. Nachts triffst du sie als **ganze Gruppe** im 🌙-Minispiel.
- 🚲 **Fixie-Hipster**, 📋 **Bürgeramt-Verzweifelte** (rennt panisch),
  💃 **Rave-Oma**, 🍺 **Späti-Philosoph**, 🥙 **Döner-Werbetyp**,
  👴 **Mecker-Rentner**, 🧽 **Schwabe aus Stuttgart** („bei uns wär des saubrer!"),
  🏃 **gehetzte Berliner:innen**, die dich anrempeln …

Dazu Currywurst-Imbiss & Späti zum „Einkaufen". Jede Begegnung zählt als
🌟 **Berlin-Moment** (Zähler oben links).

## Details & Berlin-Feeling

- **Realistischer U-Bahnhof**: **gekachelte Wände**, **Holzbänke** auf
  Metallgestell, neutrales Bahnhofslicht und der typische **gelbe Taststreifen**
  an der Bahnsteigkante – kein „alles gelb" mehr. An der **Wand, wo die U-Bahn
  einfährt**, hängen jetzt **beleuchtete Werbetafeln mit satirischen Sprüchen**
  („100 % Pünktlichkeit. …nich.", „Weil wir dich lieben. *Liebe kann sich
  verspäten.", „Neu: der Aufzug – außer Betrieb seit 2019.", „Arm, aber sexy.
  Vor allem arm.").
- **Aufgeräumte Straße**: die Minispiel-Stände stehen jetzt **großzügig verteilt**
  (nichts klebt mehr aneinander), der SEV-Bus parkt mit viel Abstand am
  Straßenrand – alles übersichtlicher und gut erreichbar.
- **Absurde Wahlplakat-Billboards** an der Straße: „Ich verspreche Ihnen das Blau
  vom Himmel!", „Der BER wird fertig – versprochen²", „Bezahlbare Miete für alle
  (ab 2045)" … samt Kleingedrucktem zum Mitlesen.
- **Echte U-Bahn**, die einfährt, hält, die Türen öffnet und mit dir losfährt.
- **Berlin-Panorama am Horizont**: ein Skydome mit **Fernsehturm, Reichstag,
  Brandenburger Tor, Berliner Dom & Siegessäule** als Silhouette – kein leeres
  Blau mehr. Davor eine **Hochhaus-Skyline** und **fahrender Verkehr** (Autos
  fahren auf der Straße), ein **roter Radweg** 🚲 und ein **lebensechter Gehweg**:
  **versetzte, leicht schiefe Gehwegplatten** in verschiedenen Grautönen,
  unregelmäßige Risse, Moos in den Fugen, **Öl-/Schmutzflecken, Kaugummi-Punkte**,
  Gullideckel, Pfütze, Gras und Laub – nichts symmetrisch, alles wie in echt.
- **Angefahren werden hat Folgen**: E-Scooter/Radfahrer nieten dich um → du
  **stolperst/fällst**, der Bildschirm wackelt, „AUA!" – und sie rufen jedes Mal
  **etwas anderes** und fahren **wechselnde Routen**.
- **Deutlich unterschiedlichere Figuren**: verschiedene Größen, Bäuche, Bärte,
  Frisuren (Iro, Dutt, Glatze, Beanie, Cap), Brillen, Kleider, Rucksäcke,
  Props und komplette Kostüme (Bär, Döner-Spieß, Statue).
- **Vorbeirauschende Züge** auf dem Gegengleis, **Zugzielanzeiger** an der Decke.
- **Zufällige gesprochene Durchsagen** – unten BVG („Signalstörung"), oben
  Straßen-Geräusche.
- **Deko**: Graffiti, Werbeplakate, Skyline-Murals, Mülleimer, Pfandflaschen,
  Ratte 🐀, Tauben, E-Scooter-Haufen, Litfaßsäule, Bäume, Autos, Streetart.
- **Linien-Anzeige** unten zeigt deinen Fortschritt über die 4 Stationen.

## Technik

- Reines HTML/JS, 3D mit **Three.js – komplett ins File eingebettet**
  (`docs/index.html`). Ein einziges self-contained File, **keine externen
  Requests**, läuft direkt über GitHub Pages oder githack.
- Grafik aus einfachen Formen (Low-Poly-Berlin), Sound live im Browser generiert
  (U-Bahn-Rumpeln, Türgong, Quietschen, Jingles) plus deutsche Sprachausgabe.

Viel Spaß auf der U1! 🐻
