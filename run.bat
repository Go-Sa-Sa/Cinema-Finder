@echo off
title Cinema Schedule Tool Launcher
cd /d "%~dp0"
echo Starting Cinema Schedule Tool Server...
python server.py
if %errorlevel% neq 0 (
  echo "python" failed. Trying "py"...
  py server.py
)
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Python 3 could not be found or executed.
  echo Please install Python 3 and add it to your system PATH.
  echo.
  pause
)
