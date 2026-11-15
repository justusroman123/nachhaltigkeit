@echo off
rem Doppelklick: richtet eine frische KI-Dolmetscher-VM ein (fragt IP, Token, Schluessel versteckt ab). Ungetestet.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vm-einrichten.ps1"
pause
