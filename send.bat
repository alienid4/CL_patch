@echo off
REM ============================================================
REM  send.bat — 雙擊即寄：跑 send_mail.ps1 寄出催辦批次
REM  先在網頁「Email 設定 → 匯出催辦批次」產生 mail-batch.json
REM ============================================================
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0send_mail.ps1"
echo.
pause
