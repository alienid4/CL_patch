# ============================================================
#  send_mail.ps1 — 半自動催辦寄送（配合網頁「Email 設定 → 匯出催辦批次」）
#  流程：讀 mail-batch.json → 逐位負責人查 AD 取 email → 透過公司 relay 寄出
#  免安裝：ADSI(Windows 內建)查 AD；Send-MailMessage 寄信(免認證 relay)
#  查無 email/離職者：先看 override.json，再轉寄「預設收件人(fallbackTo)」，最後列出跳過名單
#  用法：雙擊 send.bat（或 powershell -ExecutionPolicy Bypass -File send_mail.ps1）
#  註：relay 主機、寄件人、收件人 email 全部來自 mail-batch.json / AD，本腳本不寫死任何公司資訊
# ============================================================
[CmdletBinding()]
param([string]$BatchFile)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Find-Batch {
    if ($BatchFile -and (Test-Path $BatchFile)) { return (Resolve-Path $BatchFile).Path }
    $local = Join-Path $here 'mail-batch.json'
    if (Test-Path $local) { return $local }
    $dl = Join-Path $env:USERPROFILE 'Downloads'
    if (Test-Path $dl) {
        $f = Get-ChildItem -Path $dl -Filter 'mail-batch*.json' -File -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($f) { return $f.FullName }
    }
    return $null
}

$batchPath = Find-Batch
if (-not $batchPath) {
    Write-Host "找不到 mail-batch.json（放到本資料夾，或先在網頁匯出到『下載』資料夾）" -ForegroundColor Red
    exit 1
}
Write-Host "讀取批次：$batchPath"
try {
    $data = Get-Content -Path $batchPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    Write-Host "mail-batch.json 讀取/解析失敗：$($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$smtpHost = $data.smtp.host
$smtpPort = if ($data.smtp.port) { [int]$data.smtp.port } else { 25 }
$from     = $data.from
$cc       = @($data.cc) | Where-Object { $_ }
$fallback = @($data.fallbackTo) | Where-Object { $_ }
if (-not $smtpHost -or -not $from) {
    Write-Host "mail-batch.json 缺 SMTP 主機或寄件人，請回網頁 Email 設定補齊。" -ForegroundColor Red
    exit 1
}

# 手動 override（姓名 -> email）：補 AD 查不到的
$override = @{}
$ovPath = Join-Path $here 'override.json'
if (Test-Path $ovPath) {
    try {
        (Get-Content $ovPath -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties |
            ForEach-Object { $override[$_.Name] = [string]$_.Value }
    } catch { Write-Host "override.json 解析失敗，略過。" -ForegroundColor Yellow }
}

function Resolve-Email([string]$name) {
    if ($override.ContainsKey($name)) { return $override[$name] }
    try {
        $safe = $name -replace '[()\*\\/]', ''
        $s = New-Object System.DirectoryServices.DirectorySearcher
        $s.Filter = "(&(objectCategory=person)(objectClass=user)(anr=$safe))"
        [void]$s.PropertiesToLoad.Add('mail')
        $mails = @()
        foreach ($e in $s.FindAll()) {
            if ($e.Properties['mail'].Count -gt 0) { $mails += [string]$e.Properties['mail'][0] }
        }
        $mails = @($mails | Select-Object -Unique)
        if ($mails.Count -eq 1) { return $mails[0] }   # 唯一命中才用；0 或多筆視為查無(避免寄錯人)
    } catch {}
    return $null
}

Write-Host "SMTP relay：$smtpHost`:$smtpPort（免認證）  寄件人：$from"
Write-Host "負責人 $($data.owners.Count) 位，開始處理…`n"

$sent = 0; $fb = 0; $skipped = @()
foreach ($o in $data.owners) {
    $email = Resolve-Email $o.owner
    $subj = $o.subject; $body = $o.body; $to = $null; $mode = ''
    if ($email) {
        $to = $email; $mode = 'ad'
    } elseif ($fallback.Count -gt 0) {
        $to = $fallback; $mode = 'fallback'
        $subj = "[原負責人 $($o.owner) 查無email/離職] " + $subj
        $body = "※ 原負責人「$($o.owner)」查無 email（可能已離職），轉您處理。`r`n`r`n" + $body
    } else {
        $skipped += $o.owner; continue
    }
    try {
        $p = @{ SmtpServer=$smtpHost; Port=$smtpPort; From=$from; To=$to; Subject=$subj; Body=$body; Encoding=([System.Text.Encoding]::UTF8) }
        if ($cc.Count -gt 0) { $p['Cc'] = $cc }
        Send-MailMessage @p
        if ($mode -eq 'ad') { $sent++; Write-Host ("  寄出　{0} -> {1}  ({2} 筆)" -f $o.owner, $email, $o.count) -ForegroundColor Green }
        else { $fb++; Write-Host ("  轉主管 {0} -> {1}  ({2} 筆)" -f $o.owner, ($fallback -join ','), $o.count) -ForegroundColor Yellow }
    } catch {
        $skipped += ("{0}(寄送失敗:{1})" -f $o.owner, $_.Exception.Message)
        Write-Host ("  失敗　{0}：{1}" -f $o.owner, $_.Exception.Message) -ForegroundColor Red
    }
}

Write-Host "`n===== 完成 =====" -ForegroundColor Cyan
Write-Host ("寄出：{0} 封　轉主管(查無/離職)：{1} 封　跳過/失敗：{2}" -f $sent, $fb, $skipped.Count)
if ($skipped.Count -gt 0) { Write-Host ("未處理：{0}" -f ($skipped -join '、')) -ForegroundColor Yellow }
