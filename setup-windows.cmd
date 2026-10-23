@echo off
setlocal
rem CareerSignal AI - first-time setup for Windows. Double-click this file.
cd /d "%~dp0"
echo.
echo === CareerSignal AI - Windows setup ===
echo.
where node >nul 2>nul
if errorlevel 1 goto nonode

node scripts\setup.mjs
if errorlevel 1 goto failed

echo Installing dependencies. This can take several minutes - please wait...
call npm install
if errorlevel 1 goto failed

echo.
echo Opening .env.local in Notepad. Edit LLM_PROVIDER and GEMINI_API_KEY, then Save and close Notepad.
notepad ".env.local"
echo.
echo Setup finished. Next: double-click start-windows.cmd
echo.
pause
exit /b 0

:nonode
echo Node.js is not installed, or not on PATH.
echo Install the LTS version from https://nodejs.org, then double-click this file again.
echo On a work laptop you may need IT to install it.
echo.
pause
exit /b 1

:failed
echo.
echo Setup stopped because of the error shown above.
echo See the "Windows troubleshooting" section in README.md.
echo.
pause
exit /b 1
