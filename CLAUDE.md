# CL_patch — 專案規則

> 本檔給 AI 助手看，說明這個 repo 是什麼、動手時要遵守什麼。
> **本 repo 為公開 GitHub**，撰寫任何內容（含本檔、commit 訊息）都要假設外部看得到。

## 這是什麼

國泰證券**弱點彙總看板**。純前端單機工具：瀏覽器開啟本機 HTML，
解析弱點掃描報告 Excel，產生追蹤看板。無伺服器、無資料庫、不對外連線。

- **Remote**: `https://github.com/alienid4/CL_patch`（**公開**）
- **工作目錄**: `C:\AiProject\CL_Patch\code`（**已搬離 OneDrive，勿再放回去**）
- 選用模組：本機寄信小幫手（PowerShell，僅聽 localhost，需存取權杖）

## 相關位置（不在本 repo）

| 內容 | 位置 |
|---|---|
| 測試報告、資安改善報告、交接摘要、合規落差對照表 | `C:\AiProject\CL_Patch\報告文件\` |
| 公司內部規範文件 | `C:\AiProject\CL_Patch\公司規範\` |

這些**一律不進本 repo**（內部文件／含安全細節）。

---

## 鐵律

### 1. 改前端就要 bump 版號 ★ 最常犯

修改任何 `js/`、`css/`、`config/` 檔案後，**必須同步更新兩處**：

- `config/version.js` 的 `APP_VERSION`
- `index.html` 所有 `?v=x.xx` 快取破壞參數（用 replace_all）

**沒 bump 的後果**：瀏覽器載入舊檔，測試會出現「驗證假通過」——
畫面顯示已修好、其實根本沒生效。這在 2026-07 的測試中真的發生過。

### 2. 公開 repo，這些絕不可進版控

- 真實弱點資料（`*.xlsx`）
- 公司內部規範文件
- 測試報告／資安報告（含安全細節）
- 人員信箱對照、催辦紀錄、存取權杖
- **部署與派送流程的實作細節**——文件與 commit 訊息一律不描述

`.gitignore` 已設規則，但 **`git add` 前仍要確認**，不要用 `git add -A` 一把梭。

### 3. commit 前跑檢查

```
py .project\checks.py     # 必須全 PASS
```

**Python 一律用 `py`**，不要用 `python`（那是壞掉的 Windows Store stub，會回 exit 9009）。

### 4. 編碼規則

| 檔案類型 | 編碼 | 原因 |
|---|---|---|
| 含中文的 `.bat` | **Big5 (cp950)**，不要加 `chcp` | cmd 對 cp950 是原生，UTF-8 會亂碼且拆行報錯 |
| 含中文的 `.ps1` | **UTF-8 with BOM** | PowerShell 5.1 沒 BOM 會讀成亂碼 |
| 網頁與 `.js`/`.css` | UTF-8 | |

用 Edit 工具改過 `.ps1` 後**要重存成 BOM**（Edit 寫出的是無 BOM）。

### 5. 小幫手改了要重啟才生效

`mail_agent.ps1` 是背景常駐服務。**換檔案不會讓執行中的服務更新**——
必須關掉黑色視窗再重開 `start_agent.bat`。
權杖每次重啟會換新，要重新貼到「Email 設定 → 小幫手權杖」。

---

## 架構要點

**實際解析路徑**（別在錯的地方改 bug）：

```
main.js handleFile
  → Multi.buildAll(buf)
    → MultiSheet.parseWorkbook   (js/sheets.js：欄位對應、正規化)
    → Analysis.assembleResult    (js/analysis.js：統計)
  → Dashboard/Tracking/Matrix/Stats/Search 各自 render
```

- 欄位對應定義在 `config/profiles.js`（不是 `config/config.js`）
- 逾期天數在**解析當下**計算；跨午夜由 `main.js` 的日期偵測自動重算
- 統計數字一律要能**下鑽到明細**，且筆數必須與數字相符

## 測試方式

本 app 走 `file://`，預覽窗載不了 file 協定 → 用本機靜態伺服器測：

```
.claude/launch.json 已設好（用工作目錄，不寫死路徑）
```

檔案上傳無法驅動系統選檔器 → 用真實 `DragEvent('drop')` + `DataTransfer`
餵檔給 `#drop-zone`，走 app 自己的監聽器。

測試資料：`docs/測試假資料_天龍八部.xlsx`（未進版控，需本機自備）

---

## 完成前自我檢查

- [ ] 版號已 bump（`version.js` + `index.html` 的 `?v=`）
- [ ] `py .project\checks.py` 全 PASS
- [ ] 改動**實際驗證過**，不是只看程式碼
- [ ] 沒有把不該公開的東西加進版控
- [ ] 改過 `.ps1` 的話已重存 UTF-8 BOM
