# ============================================================
#  _show_changes.ps1 - 比對「剛下載的新版」與「本機現有」，列出真正有變更的檔
#  由 update.bat 呼叫；比內容雜湊(不比時間戳，避免每個檔都被當成變更)
#  只看 update.bat 會覆蓋的那些檔(index.html / css / js / config / assets / docs / 根腳本)
# ============================================================
param([string]$Src, [string]$Dst)

if (-not $Src -or -not $Dst) { exit 0 }
# 清掉引號/尾端斜線(避免 -Dst "%~dp0" 尾端反斜線+引號變成非法路徑)
$Src = $Src.Trim([char]34).TrimEnd([char]92, [char]47)
$Dst = $Dst.Trim([char]34).TrimEnd([char]92, [char]47)

# 只納入 update.bat 實際會更新的檔(資料夾以 / 結尾)
$inc = @('index.html', 'css/', 'js/', 'config/', 'assets/', 'docs/', 'mail_agent.ps1', 'install_agent.bat', 'uninstall_agent.bat', 'start_agent.bat', 'send_mail.ps1', 'send.bat', 'override.json.example')
function Test-Inc([string]$rel) {
    foreach ($p in $inc) {
        if ($p.EndsWith('/')) { if ($rel -like "$p*") { return $true } }
        elseif ($rel -ieq $p) { return $true }
    }
    return $false
}

$changed = @()
Get-ChildItem -Path $Src -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = $_.FullName.Substring($Src.Length).TrimStart([char]92, [char]47).Replace([char]92, [char]47)
    if (-not (Test-Inc $rel)) { return }
    $d = Join-Path $Dst $rel.Replace([char]47, [char]92)
    if (-not (Test-Path $d)) { $changed += "[新增] $rel" }
    else {
        try {
            if ((Get-FileHash -Algorithm MD5 $_.FullName).Hash -ne (Get-FileHash -Algorithm MD5 $d).Hash) { $changed += "[更新] $rel" }
        } catch {}
    }
}

if ($changed.Count -eq 0) { Write-Host "  (no file changed / 已是最新)" }
else { $changed | Sort-Object | ForEach-Object { Write-Host "  $_" } }
