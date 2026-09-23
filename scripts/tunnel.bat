@echo off
REM Exposes the local server on a public HTTPS URL via Cloudflare Tunnel.
REM Run scripts\start.bat FIRST, in its own window, then run this one.
cd /d "%~dp0.."

if not exist "tools\cloudflared.exe" (
    echo [!] tools\cloudflared.exe missing.
    echo     Download it from:
    echo     https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    pause
    exit /b 1
)

REM Fail early with a clear message instead of handing out a URL that 502s.
curl -s -o nul http://localhost:8000/api/health
if errorlevel 1 (
    echo [!] Nothing is answering on http://localhost:8000
    echo     Start scripts\start.bat in another window first, then re-run this.
    pause
    exit /b 1
)

echo Server is up. Opening public tunnel...
echo.
echo Look for the https://....trycloudflare.com address in the box below.
echo That is your public URL. It changes every time you restart this.
echo Keep BOTH windows open during the demo. Ctrl+C here closes the tunnel.
echo.

tools\cloudflared.exe tunnel --url http://localhost:8000
pause
