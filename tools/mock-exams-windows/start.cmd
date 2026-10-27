@echo off
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-LocalTest.ps1"
if errorlevel 1 (
  echo.
  echo Server could not start. See README.txt.
  pause
)
