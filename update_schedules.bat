@echo off
title Chiba Cinema Finder - Update Movie Schedules
cd /d "%~dp0"

echo ========================================================
echo Updating Movie Schedules from eiga.com...
echo (Scraping 7 theaters. This may take 1-2 minutes...)
echo ========================================================
echo.

python crawler.py
if %errorlevel% neq 0 (
  py crawler.py
)
if %errorlevel% neq 0 (
  echo.
  echo ========================================================
  echo [ERROR] Failed to run crawler.
  echo Please check if Python 3 is installed and connected to internet.
  echo ========================================================
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================================
echo [SUCCESS] Movie schedules updated successfully!
echo Please click the 'Refresh' button in your browser
echo or reload the page (F5) to see the latest schedules.
echo ========================================================
echo.
pause