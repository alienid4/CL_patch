@echo off
chcp 65001 >nul
REM 移除寄信小幫手的開機自動啟動，並停止正在跑的小幫手
set "VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CL_patch_MailAgent.vbs"

if exist "%VBS%" del "%VBS%" >nul 2>&1

REM 若舊版曾用排程註冊，一併移除（沒有也無妨）
schtasks /Delete /TN "CL_patch_MailAgent" /F >nul 2>&1

REM 停掉正在跑的小幫手（佔用 8899 的 PowerShell）
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8899 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo 已移除開機自動啟動並停止小幫手。
pause
