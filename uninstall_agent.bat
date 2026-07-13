@echo off
REM 移除寄信小幫手的開機自動啟動
schtasks /End /TN "CL_patch_MailAgent" >nul 2>&1
schtasks /Delete /TN "CL_patch_MailAgent" /F
echo 已移除開機自動啟動（若小幫手仍在跑，重開機或關掉其視窗即可）。
pause
