@echo off
rem KI-Dolmetscher: Verbindung zum Server herstellen (SSH-Tunnel) und im Browser oeffnen. Nicht unter Windows getestet.
rem Doppelklick, IP-Adresse der VM eingeben. Fenster offen lassen, solange Sie arbeiten. Schliessen beendet die Verbindung.
setlocal
set /p IP=IP-Adresse der VM (aus der centron-Console): 
if "%IP%"=="" goto fehler
echo.
echo Verbinde mit %IP% ... Browser oeffnet gleich http://localhost:8000 (Bedienschluessel steht auf der VM in ~/kidolmetscher/server.env).
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:8000/"
ssh -N -L 8000:127.0.0.1:8000 root@%IP%
goto ende
:fehler
echo Keine IP-Adresse eingegeben.
:ende
pause
endlocal
