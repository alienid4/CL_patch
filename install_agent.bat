@echo off
REM ============================================================
REM  install_agent.bat — 設定一次：讓寄信小幫手「登入時自動、背景」啟動
REM  之後日常就在網頁按「寄出」即可，不用再點任何 bat
REM ============================================================
cd /d "%~dp0"

echo 註冊登入自動啟動（背景、隱藏視窗）...
schtasks /Create /TN "CL_patch_MailAgent" /SC ONLOGON /RL LIMITED /F ^
 /TR "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%~dp0mail_agent.ps1\""
if errorlevel 1 (
    echo 註冊失敗，請看上方訊息。
    pause
    exit /b 1
)

echo 立即啟動一次...
schtasks /Run /TN "CL_patch_MailAgent" >nul 2>&1

echo.
echo 完成！小幫手已在背景執行，且以後開機會自動啟動。
echo 回網頁 Email 設定，按「測試小幫手」應顯示已連線。
echo （要移除：執行 uninstall_agent.bat）
pause
