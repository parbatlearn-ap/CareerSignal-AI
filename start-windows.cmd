@echo off
setlocal
rem CareerSignal AI - start the app on Windows. Double-click this file.
cd /d "%~dp0"
if not exist "node_modules" goto nosetup
if not exist ".env.local" goto nosetup

echo.
echo Starting CareerSignal AI at http://localhost:3000
echo Keep this window open while you use the app. Press Ctrl+C here to stop it.
echo.
start "" /min cmd /c "timeout /t 12 /nobreak >nul & start http://localhost:3000"
call npm run dev
pause
exit /b 0

:nosetup
echo Setup has not been run yet. Double-click setup-windows.cmd first.
echo.
pause
exit /b 1
