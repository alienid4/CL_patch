@echo off
REM ============================================================
REM  downloadpatch.bat - one-click update from GitHub
REM    1) download latest ZIP  2) stop running helper(s)
REM    3) overwrite program files (KEEPS your autoimport.json / data)
REM    4) restart the helper
REM  Requires: this machine can reach github.com
REM  (ASCII only on purpose: avoids cmd/Big5 encoding issues)
REM ============================================================
setlocal EnableExtensions
cd /d "%~dp0"

set "URL=https://github.com/alienid4/CL_patch/archive/refs/heads/main.zip"
set "ZIP=%TEMP%\clpatch_main.zip"
set "OUT=%TEMP%\clpatch_extract"
set "SRC=%OUT%\CL_patch-main"

echo.
echo [1/5] Downloading latest from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%URL%' -OutFile '%ZIP%' -UseBasicParsing } catch { Write-Host ('DOWNLOAD FAILED: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }"
if errorlevel 1 ( echo. & echo Download failed - check network / GitHub access. & pause & exit /b 1 )

echo [2/5] Extracting...
if exist "%OUT%" rmdir /s /q "%OUT%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Expand-Archive -Path '%ZIP%' -DestinationPath '%OUT%' -Force } catch { Write-Host ('EXTRACT FAILED: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }"
if not exist "%SRC%\index.html" ( echo. & echo Extract failed - index.html not found. & pause & exit /b 1 )

echo [3/5] Stopping running helper(s)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*mail_agent.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

echo [4/5] Updating program files (your autoimport.json / data are kept)...
copy /Y "%SRC%\index.html" "index.html" >nul
for %%D in (css js config assets docs) do (
    if exist "%SRC%\%%D" robocopy "%SRC%\%%D" "%%D" /E /NFL /NDL /NJH /NJS /NP >nul
)
REM (excludes downloadpatch.bat itself - overwriting a running .bat can break it; re-download ZIP to update it)
for %%F in (mail_agent.ps1 start_agent.bat install_agent.bat uninstall_agent.bat send_mail.ps1 send.bat override.json.example dept_manager.json.example autoimport.json.example _show_changes.ps1 update.bat) do (
    if exist "%SRC%\%%F" copy /Y "%SRC%\%%F" "%%F" >nul
)

echo [5/5] Restarting helper...
start "" "%~dp0start_agent.bat"

echo.
echo ============================================
echo   Done. Program files updated + helper restarted.
echo   Now: refresh the dashboard with Ctrl+F5.
echo   (Test Helper should show V1.79 or newer.)
echo ============================================
pause
