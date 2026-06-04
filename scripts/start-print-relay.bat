@echo off
echo Starting local print relay for SATI-TIMSA...
echo This allows the cloud app to send labels to your local Zebra printer.
echo.
cd /d "%~dp0.."
node scripts/print-relay.js
pause
