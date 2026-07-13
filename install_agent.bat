@echo off
chcp 65001 >nul
REM ============================================================
REM  install_agent.bat — 設定一次：寄信小幫手「登入自動、背景」啟動
REM  用「開機啟動資料夾」方式（不需系統管理員、不用 schtasks）
REM  之後日常在網頁按「寄出」即可，不用再點任何 bat
REM ============================================================
cd /d "%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS=%STARTUP%\CL_patch_MailAgent.vbs"

echo 建立開機自動啟動（開機啟動資料夾，不需管理員）...
> "%VBS%" echo Set s = CreateObject("WScript.Shell")
>> "%VBS%" echo s.Run "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""%~dp0mail_agent.ps1""", 0, False

if not exist "%VBS%" (
    echo 建立失敗（可能無法寫入啟動資料夾，請改用 start_agent.bat 手動啟動）。
    pause
    exit /b 1
)

echo 立即啟動一次（背景隱藏）...
start "" wscript "%VBS%"

echo.
echo ============================================
echo   完成！小幫手已在背景執行，且以後開機自動啟動。
echo   回網頁 Email 設定，按「測試小幫手」應顯示已連線。
echo   （要移除：執行 uninstall_agent.bat）
echo ============================================
pause
