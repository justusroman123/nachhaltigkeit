@echo off
rem KI-Dolmetscher starten (Windows). Demo mit Attrappen, ohne Bedienschluessel, nur auf diesem Rechner.
rem Voraussetzung: Python 3 ist installiert (https://www.python.org/downloads/, beim Installieren
rem "Add python.exe to PATH" ankreuzen). Beim ersten Start wird eine lokale Umgebung im Ordner server\.venv angelegt.
rem Von mir nicht unter Windows getestet.
setlocal
cd /d "%~dp0server"

set PYCMD=
where py >nul 2>nul
if %errorlevel%==0 set PYCMD=py -3
if "%PYCMD%"=="" (
  where python >nul 2>nul
  if %errorlevel%==0 set PYCMD=python
)
if "%PYCMD%"=="" goto nopython

if exist ".venv\Scripts\uvicorn.exe" goto start
echo Erster Start: richte die Python-Umgebung ein (einmalig, dauert etwas) ...
%PYCMD% -m venv .venv
if errorlevel 1 goto fehler
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt
if errorlevel 1 goto fehler

:start
set ALLOW_NO_KEY=true
set HOST=127.0.0.1
set PORT=8000
echo.
echo Bedienplatz: http://localhost:8000/   (wird gleich im Browser geoeffnet)
echo Beenden: dieses Fenster schliessen oder Strg+C.
echo.
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:8000/"
".venv\Scripts\uvicorn.exe" app.main:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log
goto ende

:nopython
echo.
echo Python wurde nicht gefunden. Bitte Python 3 installieren: https://www.python.org/downloads/
echo Beim Installieren "Add python.exe to PATH" ankreuzen, danach start.bat erneut doppelklicken.
goto ende

:fehler
echo.
echo Die Einrichtung ist fehlgeschlagen (siehe Meldung oben).

:ende
echo.
pause
endlocal
