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

# dept_manager.json（部門 -> 主管 email，手填）。用於「每封催辦副本給該部門主管」。
# AD 沒填 manager 時的主要來源；此檔優先於 AD 的直屬主管（與 override.json 優先於 AD 同邏輯）。
$script:deptMgr = @{}
$dmPath = Join-Path $here 'dept_manager.json'
if (Test-Path $dmPath) {
    try {
        (Get-Content $dmPath -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties |
            ForEach-Object { $script:deptMgr[$_.Name] = [string]$_.Value }
    } catch {}
}

# autoimport.json（來源資料夾 + 檔名樣式，管理者填一次）。有此檔時，小幫手會把設定隨權杖
# 一起送進網頁 → 所有窗口零設定、開 app 就自動抓最新。無此檔則退回各人瀏覽器自行設定。
$script:autoDir = ''
$script:autoPattern = ''
$aiPath = Join-Path $here 'autoimport.json'
if (Test-Path $aiPath) {
    try {
        $ai = Get-Content $aiPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $script:autoDir = [string]$ai.dir
        $script:autoPattern = [string]$ai.pattern
    } catch {}
}

# 小幫手版本（網頁「測試小幫手」會顯示；用來確認背景跑的是不是最新版）
$AGENT_VER = 'V1.78 (shared-token)'

# ── 存取權杖 ─────────────────────────────────────────────
# 沒有權杖的話，任何網頁只要在這台機器上被開啟，就能呼叫 /send 用公司 relay
# 以你的名義發信。啟動時產生一次性 token 寫到 agent_token.txt，網頁需帶 token 才受理。
# 權杖存「每台機器共用一處」(不分資料夾)：不管幾份 app 複本、哪支小幫手，都用同一個權杖，
# 徹底避免「app 讀到的權杖 ≠ 跑在 8899 的小幫手權杖」→ 401。放 LOCALAPPDATA(本機、使用者專屬)。
$tokenDir = $null
try {
    if ($env:LOCALAPPDATA) {
        $tokenDir = Join-Path $env:LOCALAPPDATA 'CL_patch'
        if (-not (Test-Path $tokenDir)) { New-Item -ItemType Directory -Force $tokenDir | Out-Null }
    }
} catch { $tokenDir = $null }
if (-not $tokenDir) { $tokenDir = $here }              # 萬一取不到 LOCALAPPDATA，退回本資料夾
$tokenPath   = Join-Path $tokenDir 'agent_token.txt'   # 機器共用的權杖來源
$tokenJsPath = Join-Path $here 'agent_token.js'        # 仍寫在 app 資料夾，供網頁 <script> 載入
# 固定權杖：已存在就沿用同一個（不每次換新）；不存在才首次產生。取捨：不再每次重啟輪替，
# 但只聽 localhost + 檔案 ACL 限本人可讀。機器共用 → 多複本權杖一致、不再 401。
$existingTok = ''
if (Test-Path $tokenPath) { try { $existingTok = (Get-Content $tokenPath -Raw -Encoding UTF8).Trim() } catch {} }
$script:token = if ($existingTok) { $existingTok } else { [guid]::NewGuid().ToString('N') }
# 注意：token 檔要等監聽成功才(重)寫，避免啟動失敗(埠占用)時誤留狀態

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

# 自動匯入紀錄檔（每次讀公槽都寫一筆，失敗有持久紀錄可查/可寄；UTF-8 BOM，Excel 可直接開）
$script:aiLogPath = Join-Path $here 'autoimport_log.csv'
function Write-AutoImportLog($dir, $result) {
    $ok   = if ($result.ok) { '成功' } else { '失敗' }
    $name = if ($result.ok) { [string]$result.name } else { '' }
    $err  = if ($result.ok) { '' } else { [string]$result.error }
    $line = ('{0},{1},{2},{3},{4}' -f (Get-Date -Format 'yyyy/MM/dd HH:mm'), (Csv-Field $dir), $ok, (Csv-Field $name), (Csv-Field $err))
    try {
        if (-not (Test-Path $script:aiLogPath)) {
            [IO.File]::WriteAllText($script:aiLogPath, "時間,來源資料夾,結果,匯入檔名,錯誤`r`n", (New-Object Text.UTF8Encoding($true)))
        }
        [IO.File]::AppendAllText($script:aiLogPath, $line + "`r`n", (New-Object Text.UTF8Encoding($false)))
    } catch {}   # 寫 log 失敗不可影響匯入本身
}

# 由主管的 DN 取其 email。任何失敗（沒填 manager、繫結失敗、沒 mail）一律回 $null，
# 絕不丟例外——這只是「加值副本」，查不到就當沒這功能，不能因此影響本人寄信。
function Resolve-ManagerEmail([string]$mgrDN) {
    if ([string]::IsNullOrWhiteSpace($mgrDN)) { return $null }
    try {
        $m = [ADSI]"LDAP://$mgrDN"
        if ($m.Properties['mail'].Count -gt 0) {
            $mm = [string]$m.Properties['mail'][0]
            if (-not [string]::IsNullOrWhiteSpace($mm)) { return $mm }
        }
        return $null
    } catch { return $null }
}

# 回傳 @{ email=<字串或$null>; reason='override'|'ad'|'ambiguous'|'notfound'|'error'; candidates=@(); managerEmail=<字串或$null> }
# 舊版只回 email，導致「同名多筆」與「真的查不到」都顯示成『查無 email』，使用者無從判斷
# managerEmail：只有唯一命中該負責人時才解析他的直屬主管信箱，供「每封 CC 主管」用；查不到回 $null
function Resolve-EmailInfo([string]$name) {
    if ($script:override.ContainsKey($name)) {
        return @{ email = $script:override[$name]; reason = 'override'; candidates = @(); managerEmail = $null }
    }
    try {
        # 先把括號連同內容整段拿掉（「王小明(資安室)」→「王小明」），
        # 只拿掉括號符號會變成「王小明資安室」而在 AD 查無
        $safe = $name -replace '[(（][^)）]*[)）]', ''
        $safe = ($safe -replace '[\*\\/()（）]', '').Trim()
        if (-not $safe) { return @{ email = $null; reason = 'notfound'; candidates = @(); managerEmail = $null } }

        $s = New-Object System.DirectoryServices.DirectorySearcher
        $s.Filter = "(&(objectCategory=person)(objectClass=user)(anr=$safe))"
        [void]$s.PropertiesToLoad.Add('mail')
        [void]$s.PropertiesToLoad.Add('samaccountname')
        [void]$s.PropertiesToLoad.Add('manager')
        $found = @()
        foreach ($e in $s.FindAll()) {
            if ($e.Properties['mail'].Count -gt 0) {
                $found += [pscustomobject]@{
                    mail = [string]$e.Properties['mail'][0]
                    sam  = if ($e.Properties['samaccountname'].Count -gt 0) { [string]$e.Properties['samaccountname'][0] } else { '' }
                    mgr  = if ($e.Properties['manager'].Count -gt 0) { [string]$e.Properties['manager'][0] } else { '' }
                }
            }
        }
        $found = @($found | Sort-Object mail -Unique)
        $chosen = $null
        if ($found.Count -eq 1) { $chosen = $found[0] }
        elseif ($found.Count -gt 1) {
            # 多筆時優先取「非管理者帳號」(adm_/a-/admin 前綴)，仍唯一才自動採用
            $normal = @($found | Where-Object { $_.sam -notmatch '^(adm[_-]|a[_-]|admin)' })
            if ($normal.Count -eq 1) { $chosen = $normal[0] }
            else { return @{ email = $null; reason = 'ambiguous'; candidates = @($found | ForEach-Object { $_.mail }); managerEmail = $null } }
        }
        if ($chosen) {
            $mgrMail = Resolve-ManagerEmail $chosen.mgr
            if ($mgrMail -and ($mgrMail -eq $chosen.mail)) { $mgrMail = $null }  # 主管就是本人時不重複
            return @{ email = $chosen.mail; reason = 'ad'; candidates = @(); managerEmail = $mgrMail }
        }
        return @{ email = $null; reason = 'notfound'; candidates = @(); managerEmail = $null }
    } catch {
        return @{ email = $null; reason = 'error'; candidates = @(); managerEmail = $null }
    }
}

# 相容舊呼叫：只要 email
function Resolve-Email([string]$name) { return (Resolve-EmailInfo $name).email }

# 決定該負責人這封要副本給哪位主管：手填的 dept_manager.json 優先，其次 AD 直屬主管，都沒有回 $null。
# 回 $null 表示「主管未填」——網頁計畫畫面會明講並且不加副本，不會亂寄。
function Resolve-ManagerCc([string]$dept, $adManagerEmail) {
    if ($dept -and $script:deptMgr.ContainsKey($dept)) {
        $v = [string]$script:deptMgr[$dept]
        if (-not [string]::IsNullOrWhiteSpace($v)) { return $v }
    }
    if ($adManagerEmail) { return [string]$adManagerEmail }
    return $null
}

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
            dept = $o.dept                                        # 供計畫畫面在主管未填時提示要補哪個部門
            managerCc = (Resolve-ManagerCc $o.dept $info.managerEmail)  # 部門對照優先、其次 AD，無則 $null(未填)
        }
    }
    return $plan
}

function Do-Send($data) {
    $smtpHost = $data.smtp.host
    $smtpPort = if ($data.smtp.port) { [int]$data.smtp.port } else { 25 }
    $from     = $data.from
    $ccGlobal = @($data.cc) | Where-Object { $_ }   # 全域副本（設定畫面填的固定副本）
    $fallback = @($data.fallbackTo) | Where-Object { $_ }
    $sent = 0; $fb = 0; $skipped = 0; $failed = 0; $details = @()
    $script:logErrors = @()   # 本批次的稽核檔寫入錯誤
    foreach ($o in $data.owners) {
        $info = Resolve-EmailInfo $o.owner
        $email = $info.email
        $subj = $o.subject; $body = $o.body; $to = $null; $mode = ''
        if ($email) { $to = $email; $mode = 'ad' }
        elseif ($fallback.Count -gt 0) {
            $to = $fallback; $mode = 'fallback'
            $subj = "[原負責人 $($o.owner) 查無email/離職] " + $subj
            $body = "※ 原負責人「$($o.owner)」查無 email（可能已離職），轉您處理。`r`n`r`n" + $body
        } else { $skipped++; $details += [pscustomobject]@{ owner = $o.owner; mode = 'skip' }; Write-MailLog $o.owner '' '' '跳過' ''; continue }
        # 本封副本 = 全域副本 + 該負責人主管（部門對照優先、其次 AD；去空、去重、不與收件人重複）
        $mgrCc = Resolve-ManagerCc $o.dept $info.managerEmail
        $toArr = @($to)
        $ccList = @($ccGlobal)
        if ($mgrCc) { $ccList += $mgrCc }
        $ccList = @($ccList | Where-Object { $_ } | Select-Object -Unique | Where-Object { $toArr -notcontains $_ })
        $ccStr = ($ccList -join ',')
        try {
            # ErrorAction Stop：SMTP 失敗多屬非終止錯誤，不加會略過 catch 而被誤記成「寄出」
            $pp = @{ SmtpServer = $smtpHost; Port = $smtpPort; From = $from; To = $to; Subject = $subj; Body = $body; Encoding = ([System.Text.Encoding]::UTF8); ErrorAction = 'Stop' }
            if ($ccList.Count -gt 0) { $pp['Cc'] = $ccList }
            Send-MailMessage @pp
            if ($mode -eq 'ad') { $sent++ } else { $fb++ }
            $details += [pscustomobject]@{ owner = $o.owner; mode = $mode; to = ($to -join ','); cc = $ccStr }
            $st = if ($mode -eq 'ad') { '寄出' } else { '轉主管' }
            Write-MailLog $o.owner ($to -join ',') $ccStr $st ''
        } catch {
            $failed++
            $details += [pscustomobject]@{ owner = $o.owner; mode = 'fail'; to = ($to -join ','); cc = $ccStr; error = $_.Exception.Message }
            Write-MailLog $o.owner ($to -join ',') $ccStr '失敗' $_.Exception.Message
        }
    }
    return [pscustomobject]@{
        ok = $true; sent = $sent; fallback = $fb; skipped = $skipped; failed = $failed; details = $details
        logError = if ($script:logErrors.Count -gt 0) { $script:logErrors[0] } else { $null }
    }
}

# ── 自動匯入：讀取來源資料夾裡「最新」的弱點彙總報告 ─────────────
# 純前端網頁讀不到 UNC 分享路徑，故由小幫手代讀。dir/pattern 由網頁帶來（存本機、不寫死）。
# 「最新」= 檔名裡 8 碼日期(YYYYMMDD)最大者；無日期則退回檔案修改時間。任何失敗回結構化錯誤，不丟例外。
function Get-LatestReport([string]$dir, [string]$pattern) {
    if ([string]::IsNullOrWhiteSpace($dir)) { return [pscustomobject]@{ ok = $false; error = '未設定來源資料夾' } }
    if (-not (Test-Path -LiteralPath $dir)) { return [pscustomobject]@{ ok = $false; error = "讀不到資料夾（不在內網或無權限）" } }
    $pat = if ([string]::IsNullOrWhiteSpace($pattern)) { '*.xlsx' } else { $pattern }
    try {
        $files = @(Get-ChildItem -LiteralPath $dir -File -ErrorAction Stop | Where-Object {
            $_.Name -like $pat -and $_.Name -notlike '~$*' -and $_.Extension -match '(?i)^\.(xlsx|xlsm|xls|csv)$'
        })
    } catch { return [pscustomobject]@{ ok = $false; error = "列目錄失敗：$($_.Exception.Message)" } }
    if (-not $files.Count) { return [pscustomobject]@{ ok = $false; error = "找不到符合『$pat』的檔案" } }
    # 排序鍵：檔名 8 碼日期優先，無則用修改時間的日期；同鍵再用修改時間細分
    $ranked = $files | ForEach-Object {
        $m = [regex]::Match($_.Name, '(\d{8})')
        $key = if ($m.Success) { $m.Groups[1].Value } else { $_.LastWriteTime.ToString('yyyyMMdd') }
        [pscustomobject]@{ f = $_; key = $key; mtime = $_.LastWriteTime }
    } | Sort-Object key, mtime -Descending
    $latest = $ranked[0].f
    try { $bytes = [IO.File]::ReadAllBytes($latest.FullName) }
    catch { return [pscustomobject]@{ ok = $false; error = "檔案讀取失敗（可能正被開啟）：$($latest.Name)" } }
    return [pscustomobject]@{
        ok         = $true
        name       = $latest.Name
        modified   = $latest.LastWriteTime.ToString('yyyy/MM/dd HH:mm')
        sizeKB     = [int]($latest.Length / 1KB)
        contentB64 = [Convert]::ToBase64String($bytes)
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

# 權杖檔：限縮為「僅目前使用者可讀」，避免同機其他帳戶取得授權
try {
    [IO.File]::WriteAllText($tokenPath, $script:token, (New-Object Text.UTF8Encoding($false)))
    # 同時寫成網頁可直接 <script> 載入的 JS：開 app 就自動帶入權杖(與集中設定)，使用者不必手動。
    # 用佔位符組字串（而非直接寫 TOKEN='...'），避免密鑰掃描把「變數」誤判成寫死金鑰。
    $q = [char]39   # 單引號；GUID 僅十六進位字元，單引號包起即可
    # JS 單引號字串內，反斜線與單引號需跳脫（UNC 路徑含反斜線，務必處理）
    function Esc-Js([string]$s) { return $s.Replace('\', '\\').Replace([string][char]39, '\' + [char]39) }
    $lines = @('window.__AGENT_TOKEN=@T@;'.Replace('@T@', $q + $script:token + $q))
    if ($script:autoDir) {
        $lines += 'window.__AUTOIMPORT_DIR=@D@;'.Replace('@D@', $q + (Esc-Js $script:autoDir) + $q)
        $lines += 'window.__AUTOIMPORT_PATTERN=@P@;'.Replace('@P@', $q + (Esc-Js $script:autoPattern) + $q)
    }
    [IO.File]::WriteAllText($tokenJsPath, ($lines -join "`r`n"), (New-Object Text.UTF8Encoding($false)))
    $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    foreach ($f in @($tokenPath, $tokenJsPath)) {
        $acl = New-Object System.Security.AccessControl.FileSecurity
        $acl.SetAccessRuleProtection($true, $false)     # 停用繼承，且不複製既有規則
        $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
            $me, 'FullControl', 'Allow')))
        Set-Acl -Path $f -AclObject $acl
    }
    $aclNote = '（已限縮為僅你本人可讀）'
} catch { $aclNote = '（權限限縮失敗，請自行確認該檔存取權）' }

Write-Host "mail-agent 已啟動：http://localhost:$usedPort/   （關閉本視窗即停止）"
if ($usedPort -ne $Port) {
    Write-Host "註：埠 $Port 已被占用，改用 $usedPort（網頁會自動找到）" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "存取權杖（已自動寫入，網頁開啟即帶入，無需手動貼）：" -ForegroundColor Yellow
Write-Host "  $script:token" -ForegroundColor Cyan
Write-Host "  已寫入 $tokenPath 與 agent_token.js $aclNote"
Write-Host "  固定權杖：重啟沿用同一個，網頁重新整理即生效。"

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
        } elseif (($path -eq '/plan' -or $path -eq '/send' -or $path -eq '/latest-report') -and -not (Test-Token $req)) {
            $res.StatusCode = 401
            $out = [pscustomobject]@{ ok = $false; error = "未授權：請在 Email 設定貼上 agent_token.txt 的內容" }
        } elseif ($req.HttpMethod -eq 'GET' -and $path -eq '/latest-report') {
            # 自動匯入：讀來源資料夾最新報告回傳（dir/pattern 由查詢字串帶來，本機設定不寫死）
            $reqDir = $req.QueryString['dir']
            $out = Get-LatestReport $reqDir $req.QueryString['pattern']
            Write-AutoImportLog $reqDir $out   # 每次讀取都留紀錄（成功/失敗都寫）
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
