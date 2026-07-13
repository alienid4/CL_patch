@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM  CL_patch NB 端上傳：把目前這份看板推到 public GitHub。
REM  CL_patch 這個資料夾本身就是 public repo，直接 add/commit/push。
REM  (真實資料 *.xlsx 已由 .gitignore 擋掉，不會上傳)
REM ============================================================

echo ============================================
echo   CL_patch Upload (push latest to GitHub)
echo ============================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo This folder is not a git repo. Aborting.
    pause
    exit /b 1
)

echo Staging changes...
git add -A

echo Committing...
git commit -m "update %DATE% %TIME%"
if errorlevel 1 echo (Nothing new to commit - will still try to push.)

echo Pushing to GitHub...
git push
if errorlevel 1 (
    echo.
    echo Push failed. Check network / GitHub login (git credential manager).
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Upload complete!
echo ============================================
pause
