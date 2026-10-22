@echo off
rem Run once per laptop. Windows will ask for admin permission.
rem Raises the hotspot limit to 128 phones, keeps the hotspot on, opens port 4000.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\setup-hotspot.ps1"
