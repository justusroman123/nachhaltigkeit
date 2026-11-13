@echo off
rem Kopiert den Bewertungsbogen (Qualitaetslauf) von der VM in den aktuellen Ordner. Nicht unter Windows getestet.
setlocal
set /p IP=IP-Adresse der VM: 
if "%IP%"=="" goto ende
scp -r root@%IP%:/root/kidolmetscher/qualitaetslauf "%USERPROFILE%\Downloads\"
echo Fertig: %USERPROFILE%\Downloads\qualitaetslauf\bewertungsbogen.html im Browser oeffnen.
:ende
pause
endlocal
