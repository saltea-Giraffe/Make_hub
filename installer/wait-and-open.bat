@echo off
setlocal
set PORT=3001
set /a COUNT=0

echo Waiting for Make HUB to start...

:loop
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -Uri 'http://localhost:%PORT%/api/health' -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1

if %ERRORLEVEL% equ 0 goto :open

set /a COUNT=%COUNT%+1
if %COUNT% geq 40 goto :timeout
timeout /t 1 /nobreak >nul
goto :loop

:open
start "" "http://localhost:%PORT%"
exit /b 0

:timeout
echo.
echo Server did not respond within 40 seconds.
echo Please check Windows Service "MakeHub" in services.msc
echo.
start "" "http://localhost:%PORT%"
exit /b 1
