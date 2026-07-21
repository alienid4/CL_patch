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
$AGENT_VER = 'V1.71'

# ── 存取權杖 ─────────────────────────────────────────────
# 沒有權杖的話，任何網頁只要在這台機器上被開啟，就能呼叫 /send 用公司 relay
# 以你的名義發信。啟動時產生一次性 token 寫到 agent_token.txt，網頁需帶 token 才受理。
$script:token = [guid]::NewGuid().ToString('N')
$tokenPath = Join-Path $here 'agent_token.txt'
# 注意：token 檔要等監聽成功才寫，否則啟動失敗(埠被占用)也留下新 token，使用者會誤以為已就緒

# 允許的來源：本機看板（file:// 會送 Origin: null，或不送 Origin）
function Test-Origin($req) {
    $o = $req.Headers['Origin']
    if ([string]::IsNullOrEmpty($o) -or $o -eq 'null') { return $true }   # file:// 開啟的看板
    return ($o -match '^https?://(localhost|127\.0\.0\.1)(:\d+)?$')
}
function Test-Token($req) {
    return ($req.Headers['X-Agent-Token'] -eq $script:token)
}

# 發信紀錄檔（磁碟稽核；UTF-8 BOM，Excel 可直接開）
$script:logPath = Join-Path $here 'mail_log.csv'
function Csv-Field($s) { if ($null -eq $s) { return '' }; $s = [string]$s; if ($s -match '[",\r\n]') { return '"' + $s.Replace('"', '""') + '"' } return $s }
$script:logErrors = @()
function Write-MailLog([string]$owner, [string]$to, [string]$cc, [string]$status, [string]$err) {
    # $line 先算好：若失敗發生在寫表頭階段，catch 的備援才不會寫進空值
    $line = ('{0},{1},{2},{3},{4},{5}' -f (Get-Date -Format 'yyyy/MM/dd HH:mm'), (Csv-Field $owner), (Csv-Field $to), (Csv-Field $cc), $status, (Csv-Field $err))
    try {
        if (-not (Test-Path $script:logPath)) {
            [IO.File]::WriteAllText($script:logPath, "時間,負責人,收件人,副本,狀態,錯誤`r`n", (New-Object Text.UTF8Encoding($true)))
        }
        [IO.File]::AppendAllText($script:logPath, $line + "`r`n", (New-Object Text.UTF8Encoding($false)))
    } catch {
        # 寫檔失敗常見於「使用者正用 Excel 開著 mail_log.csv」→ 檔案被鎖。
        # 原本靜默吞掉會造成稽核紀錄斷層而無人知曉，改為回報給網頁提示。
        $script:logErrors += $_.Exception.Message
        try {
            $alt = [IO.Path]::ChangeExtension($script:logPath, $null) + (Get-Date -Format 'yyyyMMdd') + '.csv'
            [IO.File]::AppendAllText($alt, $line + "`r`n", (New-Object Text.UTF8Encoding($true)))
        } catch {}
    }
}

# 回傳 @{ email=<字串或$null>; reason='override'|'ad'|'ambiguous'|'notfound'|'error'; candidates=@() }
# 舊版只回 email，導致「同名多筆」與「真的查不到」都顯示成『查無 email』，使用者無從判斷
function Resolve-EmailInfo([string]$name) {
    if ($script:override.ContainsKey($name)) {
        return @{ email = $script:override[$name]; reason = 'override'; candidates = @() }
    }
    try {
        # 先把括號連同內容整段拿掉（「王小明(資安室)」→「王小明」），
        # 只拿掉括號符號會變成「王小明資安室」而在 AD 查無
        $safe = $name -replace '[(（][^)）]*[)）]', ''
        $safe = ($safe -replace '[\*\\/()（）]', '').Trim()
        if (-not $safe) { return @{ email = $null; reason = 'notfound'; candidates = @() } }

        $s = New-Object System.DirectoryServices.DirectorySearcher
        $s.Filter = "(&(objectCategory=person)(objectClass=user)(anr=$safe))"
        [void]$s.PropertiesToLoad.Add('mail')
        [void]$s.PropertiesToLoad.Add('samaccountname')
        $found = @()
        foreach ($e in $s.FindAll()) {
            if ($e.Properties['mail'].Count -gt 0) {
                $found += [pscustomobject]@{
                    mail = [string]$e.Properties['mail'][0]
                    sam  = if ($e.Properties['samaccountname'].Count -gt 0) { [string]$e.Properties['samaccountname'][0] } else { '' }
                }
            }
        }
        $found = @($found | Sort-Object mail -Unique)
        if ($found.Count -eq 1) { return @{ email = $found[0].mail; reason = 'ad'; candidates = @() } }
        if ($found.Count -gt 1) {
            # 多筆時優先取「非管理者帳號」(adm_/a-/admin 前綴)，仍唯一才自動採用
            $normal = @($found | Where-Object { $_.sam -notmatch '^(adm[_-]|a[_-]|admin)' })
            if ($normal.Count -eq 1) { return @{ email = $normal[0].mail; reason = 'ad'; candidates = @() } }
            return @{ email = $null; reason = 'ambiguous'; candidates = @($found | ForEach-Object { $_.mail }) }
        }
        return @{ email = $null; reason = 'notfound'; candidates = @() }
    } catch {
        return @{ email = $null; reason = 'error'; candidates = @() }
    }
}

# 相容舊呼叫：只要 email
function Resolve-Email([string]$name) { return (Resolve-EmailInfo $name).email }

function Build-Plan($data) {
    $fallback = @($data.fallbackTo) | Where-Object { $_ }
    $plan = @()
    foreach ($o in $data.owners) {
        $info = Resolve-EmailInfo $o.owner
        $email = $info.email
        if ($email) { $mode = 'ad'; $to = $email }
        elseif ($fallback.Count -gt 0) { $mode = 'fallback'; $to = ($fallback -join ',') }
        else { $mode = 'skip'; $to = $null }
        $plan += [pscustomobject]@{
            owner = $o.owner; count = $o.count; to = $to; mode = $mode
            reason = $info.reason; candidates = @($info.candidates)
        }
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
    $script:logErrors = @()   # 本批次的稽核檔寫入錯誤
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
    return [pscustomobject]@{
        ok = $true; sent = $sent; fallback = $fb; skipped = $skipped; failed = $failed; details = $details
        logError = if ($script:logErrors.Count -gt 0) { $script:logErrors[0] } else { $null }
    }
}

# 埠被其他程式占用時自動往後找可用埠（網頁端會依序探測同一組候選埠）
$listener = $null
$usedPort = $null
foreach ($p in $Port..($Port + 5)) {
    $try = New-Object System.Net.HttpListener
    $try.Prefixes.Add("http://localhost:$p/")
    try { $try.Start(); $listener = $try; $usedPort = $p; break }
    catch { try { $try.Close() } catch {} }
}
if (-not $listener) {
    Write-Host "啟動失敗：連接埠 $Port ~ $($Port + 5) 都無法使用。" -ForegroundColor Red
    Write-Host "請確認是否有其他程式占用，或關閉後重試。" -ForegroundColor Red
    exit 1
}

# 權杖檔：限縮為「僅目前使用者可讀」，避免同機其他帳戶取得寄信授權
try {
    [IO.File]::WriteAllText($tokenPath, $script:token, (New-Object Text.UTF8Encoding($false)))
    $acl = New-Object System.Security.AccessControl.FileSecurity
    $acl.SetAccessRuleProtection($true, $false)     # 停用繼承，且不複製既有規則
    $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
        $me, 'FullControl', 'Allow')))
    Set-Acl -Path $tokenPath -AclObject $acl
    $aclNote = '（已限縮為僅你本人可讀）'
} catch { $aclNote = '（權限限縮失敗，請自行確認該檔存取權）' }

Write-Host "mail-agent 已啟動：http://localhost:$usedPort/   （關閉本視窗即停止）"
if ($usedPort -ne $Port) {
    Write-Host "註：埠 $Port 已被占用，改用 $usedPort（網頁會自動找到）" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "存取權杖（第一次使用請貼到網頁 Email 設定的「小幫手權杖」欄）：" -ForegroundColor Yellow
Write-Host "  $script:token" -ForegroundColor Cyan
Write-Host "  已寫入 $tokenPath $aclNote"
Write-Host "  每次重啟會換新，換了要重貼。"

while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    $req = $ctx.Request; $res = $ctx.Response
    try {
        # CORS：只回請求端自己的 Origin（且需通過白名單），不再無條件 '*'
        $org = $req.Headers['Origin']
        if (Test-Origin $req) {
            $res.Headers['Access-Control-Allow-Origin'] = if ([string]::IsNullOrEmpty($org)) { 'null' } else { $org }
        }
        $res.Headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
        $res.Headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Agent-Token'
        $res.Headers['Access-Control-Allow-Private-Network'] = 'true'
        if ($req.HttpMethod -eq 'OPTIONS') { $res.StatusCode = 204; $res.Close(); continue }

        $path = $req.Url.AbsolutePath
        $out = $null
        if (-not (Test-Origin $req)) {
            $res.StatusCode = 403
            $out = [pscustomobject]@{ ok = $false; error = '來源不被允許' }
        } elseif ($path -eq '/health') {
            # /health 不需 token（網頁用它確認小幫手是否在跑），但不回傳 token
            $out = [pscustomobject]@{ ok = $true; agent = 'mail-agent'; version = $AGENT_VER; needToken = $true }
        } elseif ($req.HttpMethod -eq 'POST' -and ($path -eq '/plan' -or $path -eq '/send') -and -not (Test-Token $req)) {
            $res.StatusCode = 401
            $out = [pscustomobject]@{ ok = $false; error = "未授權：請在 Email 設定貼上 agent_token.txt 的內容" }
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
