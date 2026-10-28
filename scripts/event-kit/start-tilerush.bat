@echo off
setlocal
cd /d "%~dp0"
title Tile Rush (router mode)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js 20 or newer is required. Install the LTS from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)
rem Tile Rush runs on a router: phones have no internet, this laptop does (Gemini needs it).
rem No hotspot here, and no warning about the laptop being online. See README.txt, "Tile Rush".
set ALLOW_HOST_INTERNET=1
node arena.mjs %*
pause
