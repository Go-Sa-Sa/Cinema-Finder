@echo off
title Chiba Cinema Finder - Local Server
cd /d "%~dp0"
echo ========================================================
echo Starting Chiba Cinema Finder (Local Web Server)...
echo Access at: http://localhost:8000
echo (Press Ctrl+C to stop)
echo ========================================================

python server.py
if %errorlevel% neq 0 (
  py server.py
)
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Python 3 could not be found or executed.
  echo Please install Python 3 and add it to your system PATH.
  echo.
  pause
)
