# ============================================================
#  probe_ad_manager.ps1 — 唯讀診斷：公司 AD 有沒有填 manager / department
#
#  用途：決定「催辦信自動轉給該部門主管」要走哪種做法。
#        有 manager → 直接問 AD，零維護；沒有 → 只能做本機部門對照表。
#
#  ※ 本腳本只讀取、不修改任何東西，也不寄信、不連外部網路。
#  ※ 需在「已加入網域的公司電腦」上、用公司帳號登入的狀態執行。
#  ※ 相容 Windows PowerShell 5.1（未使用 ?? / ?: 等 7.x 專屬語法）。
#
#  用法（PowerShell）：
#      powershell -NoProfile -ExecutionPolicy Bypass -File probe_ad_manager.ps1
#      powershell -NoProfile -ExecutionPolicy Bypass -File probe_ad_manager.ps1 -Name 王小明
# ============================================================
param(
    [string]$Name = $env:USERNAME    # 預設查自己
)

$ErrorActionPreference = 'Stop'

function Show([string]$label, $value) {
    if ([string]::IsNullOrWhiteSpace([string]$value)) {
        Write-Host ("  {0}: (空)" -f $label.PadRight(12)) -ForegroundColor DarkGray
    } else {
        Write-Host ("  {0}: {1}" -f $label.PadRight(12), $value)
    }
}

function Prop($entry, [string]$key) {
    if ($entry.Properties[$key].Count -gt 0) { return [string]$entry.Properties[$key][0] }
    return $null
}

Write-Host ""
Write-Host "=== AD 欄位診斷 ===" -ForegroundColor Cyan
Write-Host "查詢對象：$Name"
Write-Host ""

try {
    $safe = ($Name -replace '[()\\*\x00/]', '')
    if (-not $safe) { Write-Host "名稱空白，結束。" -ForegroundColor Yellow; exit 1 }

    $s = New-Object System.DirectoryServices.DirectorySearcher
    $s.Filter = "(&(objectCategory=person)(objectClass=user)(anr=$safe))"
    foreach ($p in 'displayname', 'mail', 'department', 'title', 'manager', 'samaccountname') {
        [void]$s.PropertiesToLoad.Add($p)
    }

    $results = @($s.FindAll())
    if ($results.Count -eq 0) {
        Write-Host "查無此人（anr=$safe）。換個名字或帳號再試。" -ForegroundColor Yellow
        exit 2
    }
    Write-Host ("命中 {0} 筆" -f $results.Count) -ForegroundColor Green
    Write-Host ""

    $hasManager = $false
    $hasDept = $false
    $i = 0

    foreach ($r in $results) {
        $i++
        Write-Host "--- 第 $i 筆 ---"
        Show 'displayName' (Prop $r 'displayname')
        Show 'mail'        (Prop $r 'mail')

        $dept = Prop $r 'department'
        Show 'department'  $dept
        if (-not [string]::IsNullOrWhiteSpace($dept)) { $hasDept = $true }

        Show 'title'       (Prop $r 'title')

        $mgr = Prop $r 'manager'
        if ([string]::IsNullOrWhiteSpace($mgr)) {
            Write-Host "  manager     : (空)" -ForegroundColor Yellow
        } else {
            $hasManager = $true
            Write-Host "  manager     : 有值" -ForegroundColor Green
            # 再查一次主管本人的 mail —— 這就是「自動帶入」會走的路徑
            try {
                $m = [ADSI]"LDAP://$mgr"
                $mMail = [string]$m.Properties['mail'][0]
                $mName = [string]$m.Properties['displayname'][0]
                if ([string]::IsNullOrWhiteSpace($mMail)) {
                    Write-Host ("  -> 主管 {0}：查到人但沒有 mail" -f $mName) -ForegroundColor Yellow
                } else {
                    Write-Host ("  -> 主管 {0}  <{1}>" -f $mName, $mMail) -ForegroundColor Green
                }
            } catch {
                Write-Host ("  -> 主管解析失敗：{0}" -f $_.Exception.Message) -ForegroundColor Yellow
            }
        }
        Write-Host ""
    }

    Write-Host "=== 結論 ===" -ForegroundColor Cyan
    if ($hasManager) {
        Write-Host "[A] AD 有填 manager → 可做『自動帶入直屬主管』，零維護。" -ForegroundColor Green
    } elseif ($hasDept) {
        Write-Host "[B] 沒有 manager 但有 department → 只能做『部門 -> 主管信箱』本機對照表。" -ForegroundColor Yellow
    } else {
        Write-Host "[C] manager 與 department 都沒有 → 維持現在的單一轉寄信箱最實際。" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "請把上面整段貼回來（含真實姓名/信箱的話，請自行遮成 王O明 / a***@ 再貼）。"
}
catch {
    Write-Host ("查詢失敗：{0}" -f $_.Exception.Message) -ForegroundColor Red
    Write-Host "常見原因：這台電腦沒加入網域、或目前不在公司網路。"
    exit 3
}
