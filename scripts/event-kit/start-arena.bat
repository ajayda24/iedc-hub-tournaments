@echo off
setlocal
cd /d "%~dp0"
title Brain Arena
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js 20 or newer is required. Install the LTS from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-hotspot.ps1"
rem pass --fresh to start a brand-new event, --pin 1234 to choose the host PIN
node arena.mjs %*
pause
