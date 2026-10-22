@echo off
rem Starts a brand-new event: clears the scoreboard and playlist progress.
rem Students' PINs and the monthly history are always kept.
call "%~dp02-START-EVENT.bat" --fresh %*
