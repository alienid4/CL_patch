@echo off
REM ============================================================
REM  start_agent.bat — 手動啟動寄信小幫手（測試用，視窗可見）
REM  平常請改用 install_agent.bat 設定成開機自動背景啟動
REM ============================================================
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0mail_agent.ps1"
pause
