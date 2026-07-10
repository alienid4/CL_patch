# 工作筆記 worklog — 邊做邊寫，斷線先讀這個

> 用途：防「Wi-Fi 隨時斷」。切片做到一半斷了，下個 AI 讀這裡就知道**接哪一步**，不用重讀程式猜、不用重撈重想。
> 規矩：
> ① 開一個切片**前**，先寫「要做什麼 / 怎樣算對 / 計畫步驟」——**先寫意圖再動手**。
> ② 過程中每完成一小塊就更新「已驗到哪 / 剛發現的事實」並**存檔**（硬斷線只有磁碟上的活得下來）。
> ③ 切片 commit 完，把該段收斂成一行結論。
> ④ 最新的寫在**最上面**。（`snapshot.py` 會把本檔最後幾行帶進 `CURRENT_STATE.md`）

---

## 2026-07-10 V1.23 部門／負責人紅黑榜（第一個掛進功能開關的新模組）✅ 完成
- 需求(使用者)：主管要一眼知道「哪個部門/誰逾期最多、結案率最差」→ 找誰談。做成模組、掛在功能開關。
- 成果：summary.js 加 rankBy(sheets,dept,keyFn) 跨全部項目彙整(部門=r.unit、負責人=r.owner)，算 未結/已逾期/高風險未結/已結/結案率，並存各子集 records 供 drill；預設按已逾期多者在前。renderRankings 在總覽首頁(圖表下方)出兩張表(部門排行/負責人排行)；makeSortableTable 通用可排序表(欄首可排序、數字欄首點=大到小)。每個數字可點→UI.openDetail 看實際筆數。紅黑視覺：有逾期列 row-overdue(紅)、全數結案列 row-clean(綠, css #f0f9f1)。config/features.js 註冊 panel-red-list(群組『總覽（首頁）』, 預設開)；summary.render 用 Features.isOn 包起來。css .rank-wrap/.rank-block/.rank-table。
- 驗(預覽範例)：總覽出現紅黑榜；部門排行資訊架構部 55未結/16逾期/27高風險/11已結/16.7%(對帳 55+11=66、11/66=16.7%)；負責人排行逾期者紅列在上(玄慈2逾期居首)、全結案綠列在下(包不同等100%)；點玄慈已逾期→彈窗2筆；點已結案欄首→排序;功能開關關掉紅黑榜→整塊消失(reload 持久化沿用框架)；console 無錯；V1.23;?v 全1.23。
- 下一步(剩兩個新功能)：#2 SLA 達成率(要先定各嚴重度天數政策)、#1 跟上次比的趨勢(要存歷史快照)。都照同模式掛進功能開關。

## 2026-07-10 V1.22 功能開關框架＋設定面板（模組化 feature toggle，A＋B 兩層）✅ 完成
- 決策(使用者)：功能模組化、有開關；主管不喜歡就到「後台」關掉。確認採 A＋B 兩層(config 出廠預設＋個人 localStorage 覆寫)。先做框架＋設定面板，把現有分頁/面板納管，再逐一加新功能(紅黑榜/SLA/趨勢)。
- 架構：config/features.js＝出廠預設註冊表(layer A，隨資料夾發布)；js/features.js＝Features 模組 isOn/set/reset/openSettings，個人覆寫存 localStorage『vulnDashboard.features』(layer B)。isOn=個人有覆寫用覆寫，否則吃 config default。加新功能只需往 APP_FEATURES 加一行，設定面板與渲染自動吃。
- 納管：分頁 tracking/matrix/stats/search(dashboard 總覽固定不關)；各項目看板面板 sev-repair/today-actions/risk-top/charts。main.js applyTabVisibility(caps+Features 任一不通即隱藏，當前分頁被藏退回總覽)取代原本 caps-only 隱藏；dashboard.js 各面板 gate(display)＋跳過 render；index.html 其他功能加「功能開關」#features-btn→Features.openSettings(refreshView)。css .feature-*。
- 驗(預覽表1)：設定面板 8 開關/2 群組；關「交叉分析」→分頁消失、關「風險排序」→面板消失、存 ls；reload 後仍隱藏(持久化)；還原預設→全復原、ls 清空、勾選全回(落回出廠預設)；console 無錯；V1.22；?v 全1.22。
- 下一步：把三個新功能當模組插進去 → #3 部門/負責人紅黑榜(先)、#2 SLA 達成率、#1 跟上次比的趨勢(要存歷史快照)。若主管要一鍵改全體，再補 C(設定匯出/匯入 settings.json)。

## 2026-07-10 V1.21 面板改名＋署名改＋總覽項目表可排序＋去括號備註 ✅ 完成
- 需求(使用者3件)：①「嚴重度 × 結案狀態」名詞不好→改新名；②署名「資安管理小組 敬上」→改「弱點追蹤管理人員」；③總覽的項目狀態表要可排序。
- 成果：
  · dashboard.js sev-repair 面板標題「嚴重度 × 結案狀態」→「各嚴重度結案進度」；副標去掉「含未結案與已結案」冗字→只留「共 N 筆」。
  · config.js mail.signature「資安管理小組 敬上」→「弱點追蹤管理人員 敬上」(保留敬上)；docs/mail_內文.txt 同步。reminder.js 催辦信吃此署名。
  · summary.js 各項目狀態表改可排序：8 欄皆可點欄首排序(數字欄首點=大到小、再點升序、字串欄升序)，reuse .th-sort/.sorted/.sort-ind(tracking-table 已有樣式)；每列先記 r._idx=原始項目索引→排序後點列仍正確進入該項目；順手把表頭「高風險(未結)」→「高風險未結」(去括號，與 V1.14 KPI 一致)、移除列的「點擊進入…」tooltip(使用者不要的說明備註)。
- 驗(預覽範例)：面板=各嚴重度結案進度/共7筆、舊詞全消失；署名=弱點追蹤管理人員 敬上；表頭無(未結)、無 tr.title；點未結案欄首→降序7777654444/▼、再點→升序、排序後點「4-滲透測試」列→正確進該表(sheet模式)；console 無錯；V1.21;?v 全1.21。
- 註：署名保留「敬上」；若要整行只留「弱點追蹤管理人員」再說。docs/使用說明.html 頁尾「請洽資安管理小組」未動(不同語境:求助聯絡)。

## 2026-07-10 V1.20 結案狀態改全域：移到左側「部門」下面(持久化、不再進項目重設) ✅ 完成
- 需求(使用者)：結案狀態放到部門下面，變全域(全域去找)。原本在分頁內 #filter-bar，每次進項目重設成未結案。
- 成果：index.html 移除 #filter-bar。main.js：state 加 closeStatus(全域，localStorage vulnDashboard.close 持久化，預設 open)；renderSheetNav 在部門 picker 下加同款 #my-close-select(未結案/已結案/全部)；setCloseStatus 重繪 nav 計數＋(sheet模式)applyFilters；applyFilters 改吃 state.closeStatus；selectSheet 不再重設；deptOpenCount→deptCount(dept,close) 計數，nav 未結數改隨狀態顯示「N 未結/已結/筆」。css：.dept-picker 加 width:100%+box-sizing 讓兩選擇器在窄視窗(≤900px row-wrap)也獨佔整列上下堆疊；label min-width:4em 對齊。
- 驗(預覽載範例)：nav 兩選擇器 部門+結案狀態、filter-bar 消失；切已結案→左側計數「0/2 已結」、看板總數 7→0、scope 狀態：已結案；切全部→進別項目沿用(不重設)；設已結→reload→自動還原已結(持久化 OK)；兩選擇器上下堆疊靠左對齊(top164/224)；console 無錯；V1.20；?v 全1.20。
- 註：結案狀態只影響各項目細項(sheet 視圖)；總覽(summary)仍是全狀態彙總不受影響(合理)。summary.js tr.title/「高風險(未結)」備註仍待清。

## 2026-07-10 V1.19 交叉分析改「排除式」：點嚴重度＝把它藏起來(其餘全留) ✅ 完成
- 修正(使用者澄清)：V1.17 做反了。使用者要的不是「點 Critical 就只剩 Critical」，而是「點 Critical→Critical 消失，High/Medium/Low 全留」＝排除法(把不想看的關掉，剩下就是要看的)。
- 重寫 js/matrix.js 互動模型：state 改 {hiddenSevs[],hiddenBands[],dept,owner}。點嚴重度列首→toggle 進 hiddenSevs(該列消失，其餘留)；點到期欄首→toggle hiddenBands(該欄消失)；條件列列出「隱藏 X ✕」可逐一復原＋清除全部。格子數字改成 drill(cellDrill→UI.openDetail 看該 sev×band 實際筆數，延續 V1.18「數字都能點」)，不再是設 filter。部門/負責人 facet 維持「聚焦某一個」(inclusion)，chip 計數＝在目前可見 sev/band＋另一 facet 下的筆數(藏了時間帶→只在該帶的負責人會從選項消失，正確)。合計只在可見多列/多欄時顯示。matrixRecords=只套 dept/owner；filtered=套全部(藏的排除)。
- 驗(預覽表1 7筆)：初始2列7筆；點Critical→只剩Medium列、條件「隱藏 Critical」、3筆；條件列✕復原→回2列7筆；點格子 Critical×已逾期→彈窗2筆；藏已逾期欄→該欄消失其餘留、3筆；facet玄慈→2筆；清除全部→7筆；console 無錯；V1.19;?v 全1.19。
- 註：目前 facet(部門/負責人)是 inclusion(聚焦)，矩陣是 exclusion(排除)；若使用者要 facet 也改成「點=藏」再議。summary.js tr.title/「高風險(未結)」備註仍待清。

## 2026-07-10 V1.18 全站圖表/百分比可鑽取（核心原則：是數字就能點看實際筆數）✅ 完成
- 需求(使用者)：不管什麼東西點下去都要能追到實際筆數。明指:圓餅圖、堆疊長條圖、28.6% 例外覆蓋率、7/14/30天內 chip、例外核准逾期。「全部只要是數字，都要可以點進去看，包括長條圖」。
- 現況盤點:stats 分頁的階段卡/子chip/例外核准已逾期/到期預警chip 早已可點；缺的是四張圖表本身與覆蓋率百分比。
- 成果:ui-common.js 加共用 UI.drillEvents(resolve)→回傳 {onClick,onHover} 綁 Chart.js(hover 變手指、點圖元素觸發 resolve)。套用:
  · dashboard.js 嚴重度圓餅(點扇區→該嚴重度清單)、到期長條(點柱→該時間帶清單)
  · stats.js 處置階段圓餅(點扇區→該階段)、到期×階段堆疊長條(點段→該階段×時間帶)、例外覆蓋率 gov-box 改可點(→例外管理中實際筆數)
  · summary.js 總覽堆疊長條(點某項目柱→切進該項目細項 onSelect)
  · css .gov-box.clickable hover 樣式
- 驗(預覽表1 直接呼叫各 chart.options.onClick 觸發):嚴重度圓餅 index0=Critical 4筆、到期長條=已逾期4筆、階段圓餅=例外管理中2筆、堆疊長條=例外管理中×已逾期1筆、覆蓋率box=例外管理中2筆(=2/7 對 28.6%)、總覽長條點項目→mode summary→sheet；6 個 drill 全開正確彈窗、筆數對；console 無錯;V1.18;?v 全1.18。
- 待清(下次可做，非本次範圍):summary.js 仍有 tr.title「點擊進入…」tooltip 與表頭「高風險(未結)」括號字，屬使用者不要的說明備註，之後順手清。

## 2026-07-10 V1.17 交叉分析：篩掉的列/欄整個消失（不淡化）＋去說明備註 ✅ 完成
- 需求(使用者，看 V1.16 截圖)：①選了 Critical，Medium 那列不該只是淡化(區分度不夠)，要「整列消失」；點欄首/格子同理，非選中的欄也要消失。②畫面還有說明備註(「點格子＝…」教學句與各 tooltip)，人類自己會判讀，像 Word/Excel 點每格都沒備註 → 全部拿掉。
- 成果(js/matrix.js)：buildMatrix 改 visSevs/visBands：state.sev→只留該列、state.band→只留該欄，其餘整列/整欄不 render(取代舊 .dim 淡化)。合計只在「多列/多欄」時顯示(單列或單欄時合計=本身，冗餘故隱藏)；rowTot/colTot/grand 依可見範圍算。移除 .xf-hint 教學句、移除矩陣所有 title tooltip(cell/列首/欄首/cond-tag)。條件列無篩選時整條不顯示(去掉「未套用篩選(顯示全部)」字)。
- 驗(預覽表1 7筆)：初始無條件列/無 hint、矩陣2列6欄+合計、7筆；點Critical列首→Medium整列消失(只剩Critical列)、無底部合計列、4筆；點已逾期欄首→只剩已逾期欄(其他欄消失)、兩列在、4筆；點Critical×91–180天格→只剩單列單欄單格「1」、無合計、cond[Critical,91–180天]、1筆；矩陣內 title 元素=0；console 無錯；V1.17；?v 全1.17。(剩餘 14 個 title 在明細表 Name/Host 資料格=既有共用元件的過長 hover 全文，非自創備註，不動。)
- 註：切嚴重度需先取消現選(sev 無 facet chip，只在矩陣列首)；若日後嫌切換麻煩再加 sev facet 或別的切法。

## 2026-07-10 V1.16 交叉分析升級「真漏斗」：多維度可疊加 cross-filter ✅ 完成
- 需求(使用者)：V1.15 第一版看了「對對對，我就是要真漏斗」→ 升級成方案乙。矩陣(嚴重度×到期)照舊，再加 部門／負責人 facet chips，任意維度疊點，每點一次矩陣格/facet 計數/清單全部即時重算。
- 成果(改寫 js/matrix.js)：狀態 {sev,band,dept,owner}；DIMS 取值函式；matchesExcept(r,exceptKeys) 做「除了某維度外其他都符合」的交叉統計核心。矩陣改吃 matrixRecords()(套 dept/owner 後再拆 sev×band)→選部門/負責人後矩陣跟著縮。facet：部門/負責人各一排 chip(reuse .search-chip)，每 chip 計數=「其他維度都符合下」該值筆數(標準 faceted count)；單一值且未選的維度自動隱藏(範例資料同部門→部門排不出現)。條件列改成可點的 tag(點 tag 移除該維度)＋清除全部。清單/標題/匯出沿用。css 加 .xf-cond-tag/.xf-facet/.xf-chip。
- 驗(預覽表1 7筆)：facet 只出負責人5人(部門單值隱藏，對)；點喬峰→矩陣總計縮成2、清單2、cond[負責人:喬峰]；疊點矩陣格 Critical×已逾期→cond三條[Critical,已逾期,喬峰]、1筆；點條件 tag 移除負責人→回[Critical,已逾期]2筆、矩陣總計回7；清除全部→7筆、facet回滿5 chip；選玄慈→矩陣2筆全已逾期、chip亮；console 無錯；V1.16；?v 全1.16。
- 可續：若要更多維度(處置階段/系統類別)照 FACET_DEFS 加一行即可；嚴重度分數當軸仍未做(目前在明細欄)。A5 一頁列印、A4 弱點聚合、Email 寄送仍在 backlog。

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
