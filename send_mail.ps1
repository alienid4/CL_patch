# ============================================================
#  send_mail.ps1 — 半自動催辦寄送（配合網頁「Email 設定 → 匯出勾選的人」）
#  流程：讀 mail-batch.json → 逐位負責人查 AD 取 email → 顯示計畫 → Y/N 確認 → 才寄
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
Write-Host "查 AD 解析 email 中…`n"

# ---- Pass 1：建立寄送計畫（先解析，不寄） ----
$plan = @()
foreach ($o in $data.owners) {
    $email = Resolve-Email $o.owner
    if ($email) {
        $plan += [pscustomobject]@{ Owner=$o.owner; Count=$o.count; To=$email; Mode='ad'; Subject=$o.subject; Body=$o.body }
    } elseif ($fallback.Count -gt 0) {
        $plan += [pscustomobject]@{ Owner=$o.owner; Count=$o.count; To=($fallback -join ','); Mode='fallback'; Subject=$o.subject; Body=$o.body }
    } else {
        $plan += [pscustomobject]@{ Owner=$o.owner; Count=$o.count; To=$null; Mode='skip'; Subject=$o.subject; Body=$o.body }
    }
}

Write-Host "===== 寄送計畫 ====="
foreach ($p in $plan) {
    switch ($p.Mode) {
        'ad'       { Write-Host ("  [寄出]   {0} -> {1}  ({2} 筆)" -f $p.Owner, $p.To, $p.Count) -ForegroundColor Green }
        'fallback' { Write-Host ("  [轉主管] {0} 查無email -> {1}  ({2} 筆)" -f $p.Owner, $p.To, $p.Count) -ForegroundColor Yellow }
        'skip'     { Write-Host ("  [跳過]   {0} 查無email且無轉寄  ({1} 筆)" -f $p.Owner, $p.Count) -ForegroundColor DarkGray }
    }
}
$willSend = @($plan | Where-Object { $_.Mode -ne 'skip' })
Write-Host ("`n共 {0} 位，實際會寄出 {1} 封。" -f $plan.Count, $willSend.Count) -ForegroundColor Cyan

if ($willSend.Count -eq 0) { Write-Host "沒有可寄的對象，結束。" -ForegroundColor Yellow; exit 0 }
$ans = Read-Host "確認寄出？(Y = 寄出 / 其他任意鍵 = 取消)"
if ($ans -notmatch '^[Yy]') { Write-Host "已取消，未寄任何信。" -ForegroundColor Cyan; exit 0 }

# ---- Pass 2：實際寄送 ----
Write-Host "`n寄送中…"
$sent = 0; $fb = 0; $failed = @()
foreach ($p in $plan) {
    if ($p.Mode -eq 'skip') { continue }
    $subj = $p.Subject; $body = $p.Body; $to = $p.To
    if ($p.Mode -eq 'fallback') {
        $to   = $fallback
        $subj = "[原負責人 $($p.Owner) 查無email/離職] " + $subj
        $body = "※ 原負責人「$($p.Owner)」查無 email（可能已離職），轉您處理。`r`n`r`n" + $body
    }
    try {
        $pp = @{ SmtpServer=$smtpHost; Port=$smtpPort; From=$from; To=$to; Subject=$subj; Body=$body; Encoding=([System.Text.Encoding]::UTF8) }
        if ($cc.Count -gt 0) { $pp['Cc'] = $cc }
        Send-MailMessage @pp
        if ($p.Mode -eq 'ad') { $sent++ } else { $fb++ }
        Write-Host ("  已寄 {0}" -f $p.Owner) -ForegroundColor Green
    } catch {
        $failed += ("{0}(失敗:{1})" -f $p.Owner, $_.Exception.Message)
        Write-Host ("  失敗 {0}：{1}" -f $p.Owner, $_.Exception.Message) -ForegroundColor Red
    }
}

$skipCount = @($plan | Where-Object { $_.Mode -eq 'skip' }).Count
Write-Host "`n===== 完成 =====" -ForegroundColor Cyan
Write-Host ("寄出：{0}　轉主管(查無/離職)：{1}　跳過：{2}　失敗：{3}" -f $sent, $fb, $skipCount, $failed.Count)
if ($failed.Count -gt 0) { Write-Host ("失敗清單：{0}" -f ($failed -join '、')) -ForegroundColor Yellow }
