@echo off
setlocal
cd /d "%~dp0"
set "HERE=%~dp0"
if "%HERE:~-1%"=="\" set "HERE=%HERE:~0,-1%"

REM ============================================================
REM  CL_patch update (company side): download latest from public
REM  GitHub and overwrite page files + docs + helper scripts.
REM  Run inside the CL_patch folder; paths auto-detected via %~dp0.
REM ============================================================

set "REPO_ZIP_URL=https://github.com/alienid4/CL_patch/archive/refs/heads/main.zip"
set "TMPZIP=%TEMP%\CL_patch_update.zip"
set "TMPDIR=%TEMP%\CL_patch_update_extract"
set "SRC=%TMPDIR%\CL_patch-main"

echo ============================================
echo   CL_patch Update (download latest dashboard)
echo ============================================
echo.
echo Downloading latest code from GitHub...
curl --ssl-no-revoke -L -o "%TMPZIP%" "%REPO_ZIP_URL%"
if errorlevel 1 (
    echo.
    echo Download failed. Check your network connection.
    pause
    exit /b 1
)

echo Extracting...
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
powershell -NoProfile -Command "Expand-Archive -Path '%TMPZIP%' -DestinationPath '%TMPDIR%' -Force"
if not exist "%SRC%\index.html" (
    echo.
    echo Extract failed ^(index.html not found^). Aborting.
    pause
    exit /b 1
)

REM Read version: old (local) vs new (downloaded), so user can confirm it got the latest
set "OLDVER=(none)"
if exist "%HERE%\config\version.js" for /f "tokens=2 delims='" %%v in ('findstr /c:"APP_VERSION =" "%HERE%\config\version.js"') do set "OLDVER=%%v"
set "NEWVER=?"
for /f "tokens=2 delims='" %%v in ('findstr /c:"APP_VERSION =" "%SRC%\config\version.js"') do set "NEWVER=%%v"

echo.
echo === Changed files this update ^(content differs^) ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%SRC%\_show_changes.ps1" -Src "%SRC%" -Dst "%HERE%"
echo ====================================================
echo.

echo Updating page files ^(index.html, css, js, config, assets^)...
robocopy "%SRC%\css"    "%HERE%\css"    /MIR /NFL /NDL /NJH /NJS >nul
robocopy "%SRC%\js"     "%HERE%\js"     /MIR /NFL /NDL /NJH /NJS >nul
robocopy "%SRC%\config" "%HERE%\config" /MIR /NFL /NDL /NJH /NJS >nul
robocopy "%SRC%\assets" "%HERE%\assets" /MIR /XF logo.png logo.jpg /NFL /NDL /NJH /NJS >nul
copy /Y "%SRC%\index.html" "%HERE%\index.html" >nul

echo Updating docs and helper scripts...
robocopy "%SRC%\docs" "%HERE%\docs" /E /NFL /NDL /NJH /NJS >nul
for %%F in (mail_agent.ps1 install_agent.bat uninstall_agent.bat start_agent.bat send_mail.ps1 send.bat override.json.example dept_manager.json.example _show_changes.ps1) do (
    if exist "%SRC%\%%F" copy /Y "%SRC%\%%F" "%HERE%\%%F" >nul
)

REM Self-update: stage new update.bat as .new (a background helper swaps it in after this exits)
if exist "%SRC%\update.bat" copy /Y "%SRC%\update.bat" "%HERE%\update.bat.new" >nul

echo Cleaning up temp files...
del /q "%TMPZIP%" >nul 2>&1
rmdir /s /q "%TMPDIR%" >nul 2>&1

REM Background helper: after this exits, replace update.bat with the new one, then self-delete
set "SWAP=%TEMP%\cl_patch_upd_swap.bat"
> "%SWAP%" echo @echo off
>> "%SWAP%" echo timeout /t 2 /nobreak ^>nul 2^>^&1
>> "%SWAP%" echo if exist "%HERE%\update.bat.new" move /y "%HERE%\update.bat.new" "%HERE%\update.bat" ^>nul 2^>^&1
>> "%SWAP%" echo del "%%~f0" ^>nul 2^>^&1
start "" /min "%SWAP%"

echo.
echo ============================================
echo   Update complete!   version: %NEWVER%   (was %OLDVER%)
echo   (open page, top-right shows %NEWVER%; press Ctrl+F5 if not)
echo ============================================
start "" "%HERE%\index.html"
pause
