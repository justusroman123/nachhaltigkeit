# KI-Dolmetscher: frische centron-GPU-VM einrichten. Windows PowerShell 5.1 oder neuer. UNGETESTET (Stand 15.11.2026).
# Fragt die IP der VM sowie Token und Bedienschluessel VERSTECKT ab, schickt das Startskript ueber SSH (stdin, nichts wird
# im Chat oder in Dateien auf dem PC abgelegt), wartet auf das Ende der Einrichtung und prueft die Webseite.
# Voraussetzung: VM ist angelegt (ohne Cloud-Init), der DNS-Eintrag zeigt auf die IP, ssh funktioniert (Schluessel kidolmetscher-test).
$ErrorActionPreference = 'Stop'
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
$Repo = 'justusroman123/nachhaltigkeit'; $Branch = 'ccr-4bf88cb4-flgtez'
$Domain = 'dolmetscher.kischub.de'; $MtRepo = 'google/translategemma-4b-it'; $Sprachen = 'uk'; $Preis = '0.2652'

function Lies-Geheim([string]$Frage) {
    $s = Read-Host $Frage -AsSecureString
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

Write-Host "`n=== KI-Dolmetscher: VM einrichten ===" -ForegroundColor Cyan
$ip = (Read-Host 'Oeffentliche IPv4-Adresse der neuen VM').Trim()
if ($ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { throw 'Das ist keine IPv4-Adresse.' }
$tok = Lies-Geheim 'Hugging-Face-Token (beginnt mit hf_, Eingabe bleibt unsichtbar)'
if ($tok -notmatch '^hf_[A-Za-z0-9]{20,}$') { throw 'Das sieht nicht wie ein Hugging-Face-Token aus (hf_ gefolgt von Buchstaben/Ziffern).' }
$key = Lies-Geheim 'Bedienschluessel (Buchstaben/Ziffern, mind. 24; leer lassen = wird zufaellig erzeugt)'
$erzeugt = $false
if (-not $key) {
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 24; $rng.GetBytes($bytes)
    $key = ([BitConverter]::ToString($bytes) -replace '-', '').ToLower(); $erzeugt = $true
}
if ($key -notmatch '^[A-Za-z0-9]{24,}$') { throw 'Bedienschluessel: nur Buchstaben und Ziffern, mindestens 24 Zeichen.' }

# DNS-Hinweis (nur Warnung; der lokale Zwischenspeicher kann veraltet sein)
try {
    $dns = [Net.Dns]::GetHostAddresses($Domain) | ForEach-Object { $_.IPAddressToString }
    if ($dns -notcontains $ip) { Write-Host "Hinweis: $Domain zeigt hier noch auf $($dns -join ', '), nicht auf $ip. DNS-Eintrag bei ALL-INKL pruefen (ipconfig /flushdns hilft bei altem Zwischenspeicher)." -ForegroundColor Yellow }
} catch { Write-Host "Hinweis: $Domain wird noch nicht aufgeloest. DNS-Eintrag pruefen." -ForegroundColor Yellow }

$ssh = @('-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15', "root@$ip")
Write-Host 'Teste SSH-Verbindung ...'
$ok = & ssh @ssh 'echo verbunden' 2>&1
if ($LASTEXITCODE -ne 0 -or "$ok" -notmatch 'verbunden') { throw "SSH zu $ip klappt nicht (VM schon 'on'? richtige IP?). Meldung: $ok" }

$starter = @"
#!/bin/bash
export HF_TOKEN='$tok'
export OPERATOR_KEY='$key'
export DOMAIN='$Domain'
export MT_REPO='$MtRepo'
export DEFAULT_LANGS='$Sprachen'
export SERVER_HOURLY_EUR='$Preis'
curl -fsSL https://raw.githubusercontent.com/$Repo/$Branch/kidolmetscher/scripts/cloud-init-gpu.sh -o /root/cloud-init-gpu.sh && bash /root/cloud-init-gpu.sh
"@
$tok = $null
($starter -replace "`r`n", "`n") | & ssh @ssh 'tr -d ''\r'' > /root/start.sh && chmod 600 /root/start.sh'
if ($LASTEXITCODE -ne 0) { throw 'Startskript konnte nicht auf die VM geschrieben werden.' }
$starter = $null
& ssh @ssh 'setsid nohup bash /root/start.sh > /root/start.log 2>&1 < /dev/null & sleep 3; rm -f /root/start.sh; echo gestartet'
if ($LASTEXITCODE -ne 0) { throw 'Start auf der VM fehlgeschlagen.' }
Write-Host "Einrichtung laeuft (Start $(Get-Date -Format HH:mm:ss)). Dauer unbekannt, bisher ca. 10 bis 20 Minuten. Die VM startet einmal neu." -ForegroundColor Green

$fertig = $false
for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 20
    $o = & ssh -o ConnectTimeout=8 @ssh 'ls /root/kidolmetscher/INIT_FERTIG 2>/dev/null; grep -a ''^== '' /var/log/kidolmetscher-init.log | tail -n 1' 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "$(Get-Date -Format HH:mm:ss) VM nicht erreichbar (Neustart?) ..."; continue }
    Write-Host "$(Get-Date -Format HH:mm:ss) $($o -join ' | ')"
    if ("$o" -match 'INIT_FERTIG') { $fertig = $true; break }
}
if (-not $fertig) { throw 'Einrichtung nach 40 Minuten nicht fertig. Log ansehen: ssh root@IP, dann: grep -a "^==" /var/log/kidolmetscher-init.log | tail' }

Write-Host 'Einrichtung abgeschlossen, warte auf den Neustart und den Dienst ...'
$laeuft = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 15
    try { $r = Invoke-WebRequest "https://$Domain/healthz" -UseBasicParsing -TimeoutSec 15; if ($r.StatusCode -eq 200) { $laeuft = $true; break } } catch { }
}
$modell = & ssh -o ConnectTimeout=8 @ssh 'ls /root/kidolmetscher/models/translategemma/config.json 2>/dev/null' 2>$null
if (-not $modell) { Write-Host 'WARNUNG: Das Uebersetzungsmodell fehlt (Token ungueltig oder ohne Freigabe?). Auf der VM: strings /var/log/kidolmetscher-init.log | grep HINWEIS' -ForegroundColor Red }
if ($laeuft) {
    Write-Host "`nFERTIG. Bedienplatz: https://$Domain/operator.html" -ForegroundColor Green
    if ($erzeugt) { Write-Host "Bedienschluessel (jetzt in den Passwort-Manager kopieren, nicht in den Chat): $key" -ForegroundColor Yellow }
} else {
    Write-Host "`nDie Seite antwortet noch nicht (DNS/Zertifikat/Dienst). Pruefen: ssh root@$ip, dann: journalctl -u caddy --no-pager | tail; journalctl -u kidolmetscher --no-pager | tail" -ForegroundColor Red
}
Write-Host 'Danach NICHT vergessen: VM in der centron-Console zerstoeren (Name kidolmetscher-test eingeben).' -ForegroundColor Cyan
