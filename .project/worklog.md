# 工作筆記 worklog — 邊做邊寫，斷線先讀這個

> 用途：防「Wi-Fi 隨時斷」。切片做到一半斷了，下個 AI 讀這裡就知道**接哪一步**，不用重讀程式猜、不用重撈重想。
> 規矩：
> ① 開一個切片**前**，先寫「要做什麼 / 怎樣算對 / 計畫步驟」——**先寫意圖再動手**。
> ② 過程中每完成一小塊就更新「已驗到哪 / 剛發現的事實」並**存檔**（硬斷線只有磁碟上的活得下來）。
> ③ 切片 commit 完，把該段收斂成一行結論。
> ④ 最新的寫在**最上面**。（`snapshot.py` 會把本檔最後幾行帶進 `CURRENT_STATE.md`）

---

## 2026-07-10 V1.15 交叉分析分頁：嚴重度 × 到期時間帶 逐層過濾（第一版）✅ 完成
- 需求(使用者)：把「嚴重度×結案狀態」「負責人×到期」兩張表的維度交叉 → 一張「嚴重度 × 到期時間帶」矩陣（Critical 且 30天內幾筆？31–90天？…）；並要「逐層點選過濾」技巧：每個分類攤成可點選項，點一個就往下縮，慢慢篩出最後想看的清單。方案採甲(只 嚴重度×到期 兩維)、母體=未結案(跟現有篩選走)、嚴重度分數暫放明細欄(Risk/Severity)非第三軸。
- 成果：新增分頁「交叉分析」(tab-matrix，介於人員追蹤與例外統計之間)。js/matrix.js：Matrix.render(result) 讀 result.records，畫 嚴重度(列)×A.BANDS(欄) 矩陣+列/欄/總合計；點格=鎖 sev+band、點列首=只鎖 sev、點欄首=只鎖 band、再點取消、清除鈕；下方即時 UI.buildDetailTable(篩選後) + 另開新分頁/匯出CSV(reuse popOutTable/exportCSV)。main.js renderResult 加 Matrix.render 與「無嚴重度欄(caps.severity===false)則隱藏此分頁」自適應。css 加 .xf-* 樣式(reuse --c-* 與 .matrix-table/.sev-badge/.num-cell)。index.html 加 tab 鈕+panel+script。
- 驗(預覽 http.server 載範例資料)：表1(7筆)矩陣 Critical 已逾2/30天1/91–180天1=4、Medium 已逾2/31–90天1=3，欄合計 4/1/1/1/0/0、總計7，與使用者截圖一致；互動:點Medium列首→2筆/cond「Medium」、再點已逾期欄首→2筆/cond「Medium × 已逾期」、清除→7筆、點Critical×30天內格→cond更新+清單同步；表10(4筆)矩陣同步正確；console 無錯；V1.15；index.html ?v 全 1.15。
- 待辦/可續：若使用者要「真漏斗」再加 部門/負責人 facet(方案乙)；嚴重度分數若要當軸再議；A5 一頁列印、A4 弱點聚合、Email 寄送仍在 backlog。

## 2026-07-10 V1.14 再掃畫面殘留「括號說明字」全清 ✅ 完成
- 背景：使用者截圖指「到期時間帶（互斥）」等括號小備註不該出現(長期偏好 no-ui-annotation-text)。全站再掃一次。
- 清掉(會顯示在畫面的自創解釋字)：dashboard.js 指標卡標題「未結案（總）→未結案」「到期時間帶（互斥）→到期時間帶」；summary.js 總覽KPI「高風險未結（C+H）→高風險未結」；stats.js 堆疊圖標題「到期時間帶 × 處置階段（堆疊）→…（去堆疊）」；analysis.js 品質異常清單「缺少到期日（修補/展延/例外皆空）」「…（邏輯矛盾）」×2 去括號。
- 保留(功能性計數，非備註)：查看全部（N筆）、合計（N人）、產生催辦（N人）、複製整封（主旨+內容）、版本日期 tooltip。
- 修環境雷：.claude/launch.json 之前指向另一台 `C:\Users\leea6\...`＋用壞掉的 `python`→改本機 `C:\Users\User\...`＋`py`，預覽伺服器才起得來。
- 驗(預覽 http.server 8778 載範例資料)：group 標題=總覽/到期時間帶/嚴重度(無互斥)；指標卡 label 未結案(無總)；總覽 KPI 高風險未結(無C+H)；全頁掃 互斥/C+H/堆疊/邏輯矛盾/皆空 皆 0 殘留；console 無錯；V1.14。index.html ?v 全數 1.13→1.14。
- 待辦不變：A4 弱點聚合、A5 一頁列印、Email 寄送。

## 2026-07-10 V1.13 內建「載入範例資料（天龍八部）」按鈕 ✅ 完成
- 背景：使用者要看假資料但一直載到舊真實檔(其他功能→檔案顯示 弱點彙總報告(New)_V20260702 的TEST.xlsx)。用 computer-use 讀取層看到其畫面：版本已是 V1.12(對)，純粹載錯檔。Claude Chrome 擴充未連(list_connected_browsers 空)→無法替他點 Chrome(唯讀層)。故改用「內建範例資料一鍵載入」根治。
- 成果：assets/sample-data.js(把 docs/測試假資料_天龍八部.xlsx 轉 base64 內嵌，約21KB)；index.html 掛該檔＋「載入範例資料（天龍八部）」按鈕兩處(其他功能選單 #sample-btn＋上傳頁 #sample-btn-2)；main.js loadSample() 讀內建 b64→走既有 loadWorkbook/saveWorkbook。免選檔、離線可用(file:// 也行，不需 fetch)。
- 驗(預覽)：清空 localStorage→上傳頁→點按鈕→測試假資料_天龍八部.xlsx 載入、10表66筆、KPI 55/16/17/27/16.7%、負責人段正淳等天龍八部名、console 無錯、V1.13。

### 接手狀態（給新 session）
- App 版本 **V1.13**。使用者實機：Windows 11 + Chrome，用 **file://** 開 `C:\Users\leea6\OneDrive\2025 Data\AI LAB\CL_patch\index.html`。**Claude Chrome 擴充未連**→Claude 無法直接操作其瀏覽器；要嘛請他連擴充，要嘛靠「載入範例資料」按鈕/口頭指引。
- **測試資料**：`docs/測試假資料_天龍八部.xlsx`(66筆全『資訊架構部』、天龍八部人名、逾期/例外/展延齊、每項6-7筆) 與舊真實檔 `docs/弱點彙總報告(New)_V20260702 的TEST.xlsx` 皆**未進版控**(測試檔)。是否加 .gitignore 使用者尚未定(上次 dismiss)。
- **Email(E2 手動寄 ps1 / E3 排程自動)**：暫停中(backlog email-send-script)，等使用者要開發再做；開發前先問環境(能否跑.ps1 / relay 主機:埠 / Excel / 排程時間)。Email 設定介面 V1.11 已完成。
- **第一批剩餘**：A4 弱點聚合(同 Plugin ID 跨主機收合)、A5 一頁列印/PDF。
- 使用者長期偏好(已存 memory no-ui-annotation-text)：畫面不放說明/備註/自創解釋字。
- 環境雷：本機 `python` 是 Windows Store stub(壞，exit 49/9009)，一律用 **`py`** 跑 .project/checks.py、snapshot.py。

## 2026-07-10 V1.12 我的部門(全站記憶) ＋ 版面收窄放大 ✅ 完成
- 需求(使用者)：①左側白邊太多→放大/往左移，中間字放大；②沒有部門想看全部，要能選自己部門且「下次進來預設就是我的部門」，不用每次重選。
- 我的部門：部門控制從「每張表 filter-dept」升級為左側全站選擇器 #my-dept-select(在導覽頂端)；選擇存 localStorage『vulnDashboard.dept』跨檔沿用；總覽標題/KPI/狀態表/未結數/逾期橫幅/複製摘要/Email 內容全部吃 state.myDept；此檔無該部門→自動退回全部部門。移除表內 filter-dept 與 populateDeptOptions；filter-bar 只留結案狀態。summary.js agg/overall/collectOverdue/render 加 dept 參數；email.js scopedRecords 依 myDept。
- 版面：.container 版心 1280→1600(左白邊約 210→75px)、header-inner 同步 1600；.sheet-nav 288→340px、sheet-name 12.5→14、count 11→12.5、item padding 放大；指標 metric-value 23→26 首格 30→34、label 12→13；tracking/summary 表 th/td 字 14→15。總覽項名由「總覽（全部）」改「總覽」(選部門後不再是全部)。
- 驗(10 項測試檔、桌面 1710 寬)：V1.12；部門選擇器 11 部門；選『資訊架構部』→標題『資訊架構部 總覽』、KPI 1/1/0/0/91.7%、橫幅 1 筆、未結數只第10項 1；reload 後預設仍『資訊架構部』(持久化 OK)；進項目 scope-info 自動『部門：資訊架構部』；切回全部→19/18/…/87.3%；container 1600、nav 340px 量測相符；console 無錯。

## 2026-07-10 V1.11 Email 設定管理介面（其他功能）✅ 完成
- 決策(使用者)：Email 首要；架構=網頁做設定＋產生內容→本機 PowerShell 走公司 SMTP 寄→工作排程器自動(跑在使用者個人電腦)；公司 SMTP=免認證內部 relay(不收密碼)。
- 鐵牆說明：瀏覽器無法直接走 SMTP(無 TCP socket)，故網頁只負責設定＋產生 mail-task.json，實際寄送與自動由本機腳本＋排程做。
- 成果：js/email.js 新增「其他功能→Email 設定」視窗：SMTP 主機/埠/寄件人/收件人/副本/主旨前綴/寄送範圍(逾期未結、近期到期)，存 localStorage(個人套個人)；「預覽通知內容」；「匯出寄送任務」下載 mail-task.json(含 smtp/from/to/cc/subject/body/count，auth:false)。index.html 加選單項＋email.js；summary.js 公開 collectOverdue；css 加表單樣式。
- 驗(localStorage 還原真實 App state 測)：V1.11；EmailCfg.buildContent 主旨「【弱點修補提醒】弱點待處理 5 筆」、逐筆含項目/部門/負責人/弱點/嚴重度/到期/逾期天數；開視窗 6 欄＋範圍勾選、設定回填、預覽正確；console 無錯。
- 待續：E2 本機 send_mail.ps1(讀 mail-task.json→relay 寄，手動)；E3 排程自動＋腳本自解析最新 xlsx(需 Excel COM/檔案路徑/排程時間)。寫腳本前先問環境。

## 2026-07-10 V1.10 畫面去說明字 ✅ 完成
- 使用者規則(再次聲明，列為長期偏好)：畫面上不放任何說明性/備註性文字、不放沒出現過的自創說明，避免別人問「這是什麼」。資料「備註」欄早在 V1.05 就不顯示(只背後算慢性風險)。
- 成果：summary.js 移除堆疊圖的說明式標題「各項目未結案（含已逾期），x 軸為項目編號」(title display:false)；總覽小字去掉教學語「· 點列可進入細項」。
- 驗(重載抓 ?v=1.10)：chartTitle display=false、panel-note=「共 N 個項目」、逾期橫幅仍正常、console 無錯、V1.10。

## 2026-07-10 V1.09 主管稽核：全域逾期攤開 ✅ 完成
- 背景：以「窗口做事＋主管稽核」雙軌重新定位。主管要「審視有沒有弱點沒修補」，但逾期資訊原本散在各項目列、要逐一點進去看。
- 成果：總覽頁新增紅色逾期警示橫幅(全部項目逾期未結筆數＋最久逾期天數＋逾期集中部門)；點「查看全部逾期清單」開跨項目明細，前置「項目/部門」兩欄，可排序/匯出CSV/另開分頁。summary.js: collectOverdue()/openAllOverdue()/OVERDUE_EXTRA_COLS＋render 插橫幅；ui-common.js: openDetail/buildDetailTable/popOutTable/exportCSV 加可選 extraCols(向後相容，dueCi 以欄名動態定位)；css: .overdue-alert/.btn-danger。
- 驗(預覽伺服器實載測試檔)：橫幅顯示5筆/最久191天/集中資訊架構部(4)網路部(1)；彈窗欄序 項目→部門→Host…→逾期天數共13欄、預設排真正到期日、5列；回歸:一般 openDetail 仍11欄從Host起無項目/部門欄；console 無錯；V1.09。
- 待辦(第一批剩餘)：my-dept-landing(A1)、vuln-aggregate(A4)、one-page-print(A5)。SOP 文件延後(使用者指示:先把功能做扎實再做SOP)。

## 2026-07-10 V1.08 主管總覽首頁 ✅ 完成
- 成果：js/summary.js；左側置頂「總覽（全部）」預設落點；一頁 KPI 合計(未結19/逾期18/近期0/高風險1/結案率87.3%)+各項目狀態表(狀態燈:有逾期/追蹤中/已全數結案，可點列進細項)+堆疊圖；複製摘要在總覽出全部彙總文字；查詢在總覽時先進入目前項目。
- 驗：預設總覽、KPI/狀態表/圖正確、點列進表9(未結16)、無 console 錯、V1.08。

## 2026-07-10 V1.07 頁首重整 ✅ 完成
- 成果：查詢框移到藍底頁首中央；版本號與 複製指標/重新選擇/清除 收進右上「其他功能 ▾」下拉(含檔名/版本)；外部點擊關閉。
- 驗：頁首查詢框顯示、下拉開合、項目齊、版本/檔名在選單、搜尋作用、無 console 錯、V1.07。

## 2026-07-10 V1.06 查詢常駐首頁 ✅ 完成
- 成果：查詢框搬到分頁上方常駐(每頁可見)，輸入自動切到「查詢」分頁並執行；快速篩選 chips 與結果仍在查詢分頁。search.js 改用全域 #global-search-input，main 綁 input/clear。
- 驗：常駐框顯示、搜負責人5筆/已逾期16筆、自動切分頁、清除有效、無 console 錯、V1.06。

## 2026-07-08 V1.05 正式化(對外用) ✅ 完成
- 成果：全站正式用語。分頁去 emoji；自創名詞改正式(安全名單→例外核准未到期、例外治理雷達→例外與展延概況、例外破口→例外核准已逾期、慢性風險→反覆展延／例外、今日行動清單→優先處理清單、風險加權排行→風險排序、已/未修復→已/未結案、修復率→結案率、快到期→近期到期、尚安全→尚未到期)；移除說明提示；明細表/CSV/催辦/搜尋 皆去「備註」。
- 驗：分頁/面板/例外統計/明細欄 全部正式化、無備註欄、無 console 錯、checks PASS。
- 待辦：docs/使用說明.html 仍是單表舊版(emoji+舊詞)，需另做正式重寫。

## 2026-07-08 V1.03 側欄單行化 ✅ 完成
- 改：左側工作表項目 雙行→單行(flex，名稱省略號+未結數同列)，item 33px、10項共 360px 一眼看完；長名 hover 顯全名。
- 驗：V1.03、單行、同列、截斷、無錯。

## 2026-07-08 V1.02 離線函式庫（修 XLSX is not defined）✅ 完成
- 問題：CDN 抓 SheetJS，硬重新整理+Wi-Fi 斷 → XLSX 未載入 → 解析失敗。教訓：改版後沒測「離線/硬重整」路徑。
- 修：把 xlsx/chart 下載進 assets/vendor/、index.html 改本機載入(不依賴 CDN)；handleFile 加 XLSX 未載入的友善提示；checks.py 白名單 vendor 檔(minified 誤判 token)。
- 驗：XLSX/Chart 皆從本機載入、圖表可畫、V1.02、匯入正常、無 console 錯、checks PASS。

## 2026-07-08 版本號顯示 ✅ 完成（V1.0）
- 成果：config/version.js(window.APP_VERSION='V1.0')；右上角顯示、hover 顯日期；驗過。
- **紀律：之後每次 App 變更都要 bump config/version.js（小版 +0.01），回報時講版號。** 目前基準 V1.0＝多表擴充完工。

## 2026-07-08 ms-06 記憶/匯出/催辦 + ms-07 逐表驗證交付 ✅ 完成（多表擴充全數完工）
- ms-06：記憶(base64)還原OK；r.risk=severityRaw 讓 Risk 欄/CSV 有值；CSV(6.5KB)/單人+批次催辦 都驗過；無 console 錯。
- ms-07：10 表逐一切換無錯、抽樣數字對帳一致；README 補多表說明；checks 全 PASS。
- **多表擴充 ms-01～ms-07 全部完成**。下一步：合併 work/multi-sheet → main（等 USER 點頭）。

## 2026-07-08 ms-05 面板自適應 ✅ 完成
- 成果：multi.js computeCaps→s.caps；main 依 caps.stagePanel 切「例外/展延統計」分頁鈕；dashboard 依 caps.severity 隱藏 嚴重度group/圓餅/修復表；stats 依 stagePanel early-return。
- 驗過：表1/9 完整；表6 有嚴重度但無 TAB3；表8 全精簡(無嚴重度無TAB3)；表10 無嚴重度但有 TAB3。無 console 錯。
- 下一件：ms-06 記憶/匯出/催辦在多表下沿用（記憶已於 ms-03 用 base64 完成；主要驗匯出CSV、催辦，表8無負責人降級）。

## 2026-07-08 ms-04 部門＋結案狀態篩選 ✅ 完成
- 成果：filter-bar 兩個下拉（部門=該表distinct單位+全部；結案=未結案/已結案/全部），預設 全部部門+未結案；change→applyFilters 重算重繪。
- 實作：main.js applyFilters()（deptFiltered→scoped→Analysis.assembleResult）、populateDeptOptions()、renderResult()；index.html filter-bar；css。
- 驗過(表9)：部門選項加總136、未結16/已結120/全部136、選單一部門數字縮到該部門、scope 反映、無 console 錯。
- 下一件：ms-05 面板自適應（缺欄就隱藏該面板，如表6/7無例外面板、表8最精簡）。

## 2026-07-08 目前狀態（乾淨落點）

- 分支：`work/multi-sheet`
- 落點：**乾淨**（ms-03 已 commit；接手/續作機制已 commit）——目前在切片之間，無半成品
- 進行中步驟：無
- **下一件：ms-04**（部門＋結案狀態篩選；整合 backlog 的 filter-department-all / filter-close-status）— 尚未開始
- 已驗事實：多表讀取/對映/左側切表 都驗過；TEST 檔是稀疏樣本（表1–4 未結案顯示 0 屬正常）
- 提醒：`python` 是空殼→用 `py`；TEST 檔被 Excel 鎖→先 `cp` 再讀；驗證用 `docs/多表檢查.html` 或 `py -m http.server`

---

## 範本（開一個新切片時，複製到最上面填）

```
## [日期] [切片 id] 進行中
- 要做：…
- 怎樣算對：…
- 計畫步驟：1)…  2)…  3)…
### 進度
- [x] 步驟1 —（驗法/結果）
- [ ] 步驟2 ← 現在卡在這
- 剛發現：…（路徑、筆數、雷、要注意的欄位…）
- 未驗 / 待辦：…
```
