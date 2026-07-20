# ============================================================
#  mail_agent.ps1 — 本機寄信小幫手（背景常駐，只聽 localhost）
#  網頁「寄出」按鈕把催辦批次 POST 過來 → 查 AD 取 email → 走公司 relay 寄 → 回結果
#  免安裝：ADSI(內建)查 AD、Send-MailMessage 寄信、.NET HttpListener 當本機服務
#  只綁 localhost（不對外）；不寫死任何公司資訊(relay/email 全來自網頁批次 / AD)
#  端點：GET /health（健康檢查）  POST /plan（查AD不寄，回計畫）  POST /send（實際寄）
# ============================================================
param([int]$Port = 8899)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# override.json（姓名 -> email 手動補，補 AD 查不到的）
$script:override = @{}
$ovPath = Join-Path $here 'override.json'
if (Test-Path $ovPath) {
    try {
        (Get-Content $ovPath -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties |
            ForEach-Object { $script:override[$_.Name] = [string]$_.Value }
    } catch {}
}

# 小幫手版本（網頁「測試小幫手」會顯示；用來確認背景跑的是不是最新版）
$AGENT_VER = 'V1.58'

# 發信紀錄檔（磁碟稽核；UTF-8 BOM，Excel 可直接開）
$script:logPath = Join-Path $here 'mail_log.csv'
function Csv-Field($s) { if ($null -eq $s) { return '' }; $s = [string]$s; if ($s -match '[",\r\n]') { return '"' + $s.Replace('"', '""') + '"' } return $s }
function Write-MailLog([string]$owner, [string]$to, [string]$cc, [string]$status, [string]$err) {
    try {
        if (-not (Test-Path $script:logPath)) {
            [IO.File]::WriteAllText($script:logPath, "時間,負責人,收件人,副本,狀態,錯誤`r`n", (New-Object Text.UTF8Encoding($true)))
        }
        $line = ('{0},{1},{2},{3},{4},{5}' -f (Get-Date -Format 'yyyy/MM/dd HH:mm'), (Csv-Field $owner), (Csv-Field $to), (Csv-Field $cc), $status, (Csv-Field $err))
        [IO.File]::AppendAllText($script:logPath, $line + "`r`n", (New-Object Text.UTF8Encoding($false)))
    } catch {}
}

function Resolve-Email([string]$name) {
    if ($script:override.ContainsKey($name)) { return $script:override[$name] }
    try {
        $safe = $name -replace '[()\*\\/]', ''
        $s = New-Object System.DirectoryServices.DirectorySearcher
        $s.Filter = "(&(objectCategory=person)(objectClass=user)(anr=$safe))"
        [void]$s.PropertiesToLoad.Add('mail')
        $mails = @()
        foreach ($e in $s.FindAll()) { if ($e.Properties['mail'].Count -gt 0) { $mails += [string]$e.Properties['mail'][0] } }
        $mails = @($mails | Select-Object -Unique)
        if ($mails.Count -eq 1) { return $mails[0] }
    } catch {}
    return $null
}

function Build-Plan($data) {
    $fallback = @($data.fallbackTo) | Where-Object { $_ }
    $plan = @()
    foreach ($o in $data.owners) {
        $email = Resolve-Email $o.owner
        if ($email) { $mode = 'ad'; $to = $email }
        elseif ($fallback.Count -gt 0) { $mode = 'fallback'; $to = ($fallback -join ',') }
        else { $mode = 'skip'; $to = $null }
        $plan += [pscustomobject]@{ owner = $o.owner; count = $o.count; to = $to; mode = $mode }
    }
    return $plan
}

function Do-Send($data) {
    $smtpHost = $data.smtp.host
    $smtpPort = if ($data.smtp.port) { [int]$data.smtp.port } else { 25 }
    $from     = $data.from
    $cc       = @($data.cc) | Where-Object { $_ }
    $fallback = @($data.fallbackTo) | Where-Object { $_ }
    $sent = 0; $fb = 0; $skipped = 0; $failed = 0; $details = @()
    foreach ($o in $data.owners) {
        $email = Resolve-Email $o.owner
        $subj = $o.subject; $body = $o.body; $to = $null; $mode = ''
        if ($email) { $to = $email; $mode = 'ad' }
        elseif ($fallback.Count -gt 0) {
            $to = $fallback; $mode = 'fallback'
            $subj = "[原負責人 $($o.owner) 查無email/離職] " + $subj
            $body = "※ 原負責人「$($o.owner)」查無 email（可能已離職），轉您處理。`r`n`r`n" + $body
        } else { $skipped++; $details += [pscustomobject]@{ owner = $o.owner; mode = 'skip' }; Write-MailLog $o.owner '' '' '跳過' ''; continue }
        try {
            # ErrorAction Stop：SMTP 失敗多屬非終止錯誤，不加會略過 catch 而被誤記成「寄出」
            $pp = @{ SmtpServer = $smtpHost; Port = $smtpPort; From = $from; To = $to; Subject = $subj; Body = $body; Encoding = ([System.Text.Encoding]::UTF8); ErrorAction = 'Stop' }
            if ($cc.Count -gt 0) { $pp['Cc'] = $cc }
            Send-MailMessage @pp
            if ($mode -eq 'ad') { $sent++ } else { $fb++ }
            $ccStr = ($cc -join ',')
            $details += [pscustomobject]@{ owner = $o.owner; mode = $mode; to = ($to -join ','); cc = $ccStr }
            $st = if ($mode -eq 'ad') { '寄出' } else { '轉主管' }
            Write-MailLog $o.owner ($to -join ',') $ccStr $st ''
        } catch {
            $failed++
            $details += [pscustomobject]@{ owner = $o.owner; mode = 'fail'; to = ($to -join ','); cc = ($cc -join ','); error = $_.Exception.Message }
            Write-MailLog $o.owner ($to -join ',') ($cc -join ',') '失敗' $_.Exception.Message
        }
    }
    return [pscustomobject]@{ ok = $true; sent = $sent; fallback = $fb; skipped = $skipped; failed = $failed; details = $details }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch { Write-Host "啟動失敗（埠 $Port 可能已被占用）：$($_.Exception.Message)" -ForegroundColor Red; exit 1 }
Write-Host "mail-agent 已啟動：http://localhost:$Port/   （關閉本視窗即停止）"

while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    $req = $ctx.Request; $res = $ctx.Response
    try {
        $res.Headers['Access-Control-Allow-Origin'] = '*'
        $res.Headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
        $res.Headers['Access-Control-Allow-Headers'] = 'Content-Type'
        $res.Headers['Access-Control-Allow-Private-Network'] = 'true'
        if ($req.HttpMethod -eq 'OPTIONS') { $res.StatusCode = 204; $res.Close(); continue }

        $path = $req.Url.AbsolutePath
        $out = $null
        if ($path -eq '/health') {
            $out = [pscustomobject]@{ ok = $true; agent = 'mail-agent'; version = $AGENT_VER }
        } elseif ($req.HttpMethod -eq 'POST' -and ($path -eq '/plan' -or $path -eq '/send')) {
            $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
            $bodyText = $reader.ReadToEnd(); $reader.Close()
            $data = $bodyText | ConvertFrom-Json
            if (-not $data.smtp.host -or -not $data.from) {
                $out = [pscustomobject]@{ ok = $false; error = '缺 SMTP 主機或寄件人' }
            } elseif ($path -eq '/plan') {
                $out = [pscustomobject]@{ ok = $true; owners = @(Build-Plan $data) }
            } else {
                $out = Do-Send $data
            }
        } else {
            $res.StatusCode = 404
            $out = [pscustomobject]@{ ok = $false; error = 'not found' }
        }
        $json = $out | ConvertTo-Json -Depth 6 -Compress
        $buf = [System.Text.Encoding]::UTF8.GetBytes($json)
        $res.ContentType = 'application/json; charset=utf-8'
        $res.ContentLength64 = $buf.Length
        $res.OutputStream.Write($buf, 0, $buf.Length)
        $res.Close()
    } catch {
        try {
            $res.StatusCode = 500
            $b = [System.Text.Encoding]::UTF8.GetBytes('{"ok":false,"error":"agent error"}')
            $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
        } catch {}
    }
}
