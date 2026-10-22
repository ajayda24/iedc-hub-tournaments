@echo off
setlocal
cd /d "%~dp0"
rem Copies arena-data\ (scores, PINs, tournament history) into backups\<date-time>\.
rem Run it after every event, then copy the backups folder to a pen drive or Google Drive.
if not exist "arena-data" (
  echo.
  echo   Nothing to back up yet: there is no arena-data folder next to this file.
  echo.
  pause
  exit /b 1
)
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set STAMP=%%t
xcopy "arena-data" "backups\%STAMP%\" /E /I /Q /Y >nul
echo.
echo   Backed up to backups\%STAMP%
echo   Keep it private: it contains Student IDs.
echo.
pause
