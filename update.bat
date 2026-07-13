@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM  CL_patch 公司端更新：從 public GitHub 下載最新版看板，
REM  覆蓋 index.html 與 css/ js/ config/ assets/。純前端，免 Python。
REM  放在 CL_patch 資料夾內執行；路徑用 %~dp0 自動抓，不需固定。
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

REM 讀版號：舊(本機現有) 與 新(剛下載的)，讓使用者確認抓到最新
set "OLDVER=(none)"
if exist "%~dp0config\version.js" for /f "tokens=2 delims='" %%v in ('findstr /c:"APP_VERSION =" "%~dp0config\version.js"') do set "OLDVER=%%v"
set "NEWVER=?"
for /f "tokens=2 delims='" %%v in ('findstr /c:"APP_VERSION =" "%SRC%\config\version.js"') do set "NEWVER=%%v"

echo.
echo === Changed files this update ^(content differs^) ===
powershell -NoProfile -ExecutionPolicy Bypass -File "%SRC%\_show_changes.ps1" -Src "%SRC%" -Dst "%~dp0"
echo ====================================================
echo.

echo Updating page files ^(index.html, css, js, config, assets^)...
robocopy "%SRC%\css"    "%~dp0css"    /MIR /NFL /NDL /NJH /NJS >nul
robocopy "%SRC%\js"     "%~dp0js"     /MIR /NFL /NDL /NJH /NJS >nul
robocopy "%SRC%\config" "%~dp0config" /MIR /NFL /NDL /NJH /NJS >nul
robocopy "%SRC%\assets" "%~dp0assets" /MIR /NFL /NDL /NJH /NJS >nul
copy /Y "%SRC%\index.html" "%~dp0index.html" >nul

echo Updating docs and helper scripts...
robocopy "%SRC%\docs" "%~dp0docs" /E /NFL /NDL /NJH /NJS >nul
for %%F in (mail_agent.ps1 install_agent.bat uninstall_agent.bat start_agent.bat send_mail.ps1 send.bat override.json.example _show_changes.ps1) do (
    if exist "%SRC%\%%F" copy /Y "%SRC%\%%F" "%~dp0%%F" >nul
)

REM 自我更新：先把新版 update.bat 放成 .new（本程式結束後由背景小幫手換上，下次執行起即最新）
if exist "%SRC%\update.bat" copy /Y "%SRC%\update.bat" "%~dp0update.bat.new" >nul

echo Cleaning up temp files...
del /q "%TMPZIP%" >nul 2>&1
rmdir /s /q "%TMPDIR%" >nul 2>&1

REM 產生背景小幫手：等本程式結束後，把 update.bat 換成新版，再自刪
set "SWAP=%TEMP%\cl_patch_upd_swap.bat"
> "%SWAP%" echo @echo off
>> "%SWAP%" echo timeout /t 2 /nobreak ^>nul 2^>^&1
>> "%SWAP%" echo if exist "%~dp0update.bat.new" move /y "%~dp0update.bat.new" "%~dp0update.bat" ^>nul 2^>^&1
>> "%SWAP%" echo del "%%~f0" ^>nul 2^>^&1
start "" /min "%SWAP%"

echo.
echo ============================================
echo   Update complete!   version: %NEWVER%   (was %OLDVER%)
echo   ^(open page, top-right shows %NEWVER%; press Ctrl+F5 if not^)
echo ============================================
start "" "%~dp0index.html"
pause
