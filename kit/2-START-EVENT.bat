@echo off
setlocal
cd /d "%~dp0"
title Event arena - keep this window open
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js 20 or newer is required. Install the LTS from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\start-hotspot.ps1"
rem Everything this laptop remembers (scores, PINs, history) lives in arena-data\ next to this file.
rem Extra options: --fresh starts a brand-new event, --pin 1234 picks the host PIN.
node "%~dp0app\arena.mjs" --data "%~dp0arena-data" %*
pause
