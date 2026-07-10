/* ============================================================
 * config/config.js
 * 全域設定 — 所有可調參數集中在此，方便日後維護。
 * 依「欄位名稱」讀取，不依賴欄位位置。欄位順序改變仍可運作。
 * ============================================================ */
window.APP_CONFIG = {
  /* Excel 工作表名稱 */
  sheetName: '1-系統弱點掃描弱點',

  /* 找不到指定工作表時，是否退而使用第一個工作表 */
  fallbackToFirstSheet: true,

  /* --------------------------------------------------------
   * 欄位對應表
   * key   = 程式內部使用的欄位代號
   * value = { aliases: 可能的 Excel 標題(容錯多寫幾個), required: 是否必要 }
   * 讀檔時會用 aliases 逐一比對(去除前後空白、忽略大小寫、全半形空白)。
   * -------------------------------------------------------- */
  columns: {
    pluginId:          { aliases: ['Plugin ID', 'PluginID', 'Plugin_ID'], required: true },
    risk:              { aliases: ['Risk', '風險', 'Risk Factor', 'RiskFactor'], required: false },
    severity:          { aliases: ['Severity', '嚴重度', '風險等級',
                                   'Risk Severity', 'RiskSeverity', 'Risk/Severity', 'Risk-Severity', 'Risk_Severity'],
                          required: true },
    host:              { aliases: ['Host'], required: true },
    protocol:          { aliases: ['Protocol'], required: false },
    port:              { aliases: ['Port'], required: false },
    name:              { aliases: ['Name'], required: true },
    synopsis:          { aliases: ['Synopsis'], required: false },
    description:       { aliases: ['Description'], required: false },
    solution:          { aliases: ['Solution'], required: false },
    seeAlso:           { aliases: ['See Also', 'SeeAlso'], required: false },
    pluginOutput:      { aliases: ['Plugin Output', 'PluginOutput'], required: false },
    fixDeadline:       { aliases: ['修補期限'], required: true },
    firstExtension:    { aliases: ['首次展延上限', '首次展延'], required: false },
    exceptionApproval: { aliases: ['例外核准期限', '例外核准'], required: false },
    overdueStatus:     { aliases: ['逾期狀態'], required: false },
    systemCategory:    { aliases: ['系統類別'], required: false },
    assetName:         { aliases: ['資產名稱'], required: false },
    department:        { aliases: ['負責單位'], required: true },
    owner:             { aliases: ['負責人'], required: true },
    retestStatus:      { aliases: ['複測狀態'], required: false },
    closeStatus:       { aliases: ['結案狀態'], required: true },
    closeDate:         { aliases: ['結案日期'], required: false },
    remark:            { aliases: ['備註'], required: false },
    year:              { aliases: ['年度'], required: false },
    pureSystem:        { aliases: ['純期系統', '純測系統'], required: false },
  },

  /* --------------------------------------------------------
   * 分析條件
   * -------------------------------------------------------- */
  filter: {
    department: '資訊架構部',   // 負責單位
    openStatus: '未結案',       // 結案狀態(視為未結案的值)
  },

  /* --------------------------------------------------------
   * 到期分級門檻(天)。累進定義：0 <= 距今天數 <= N。
   * -------------------------------------------------------- */
  nearDays: [30, 90, 180],
  sixMonthsDays: 180,   // 「六個月到期」= 逾期 + 未來180天內到期(需半年內關注者)
  soonDays: 30,         // 「快到期」門檻(天) — 用於例外/展延統計與催辦聚焦

  /* 嚴重度顯示順序與顏色(Chart.js / 卡片) */
  severityOrder: ['Critical', 'High', 'Medium', 'Low', 'Info'],
  severityColors: {
    Critical: '#b71c1c',
    High:     '#e64a19',
    Medium:   '#f9a825',
    Low:      '#43a047',
    Info:     '#90a4ae',
    Unknown:  '#607d8b',
  },

  /* 催辦信件 — 寄件抬頭與署名(可自行修改) */
  mail: {
    subjectPrefix: '【弱點修補催辦】',
    signature: '弱點追蹤管理人員 敬上',
    ccNote: '如已完成修補請回覆本信並提供佐證，謝謝。',
  },

  /* --------------------------------------------------------
   * 風險加權排序 — 分數 = 嚴重度權重 × 急迫倍數
   * -------------------------------------------------------- */
  riskSeverityWeight: { Critical: 100, High: 40, Medium: 10, Low: 2, Info: 1, Unknown: 5 },
  riskTopN: 10,               // 風險排行顯示前 N 名

  /* --------------------------------------------------------
   * 例外治理
   * -------------------------------------------------------- */
  exceptionExpiryDays: [7, 14, 30],  // 例外到期預警級距(天)
  chronicThreshold: 2,               // 處置(展延+例外)申請次數 >= 此值 = 慢性風險
  todayExceptionExpiryDays: 7,       // 今日行動清單納入「例外 N 天內到期」
  dueMatrixMonths: 6,                // 「人員 × 月」到期矩陣顯示幾個月

  /* --------------------------------------------------------
   * 資料品質檢核 — 各嚴重度是否視為可辨識(其餘算異常)
   * -------------------------------------------------------- */
  validSeverities: ['Critical', 'High', 'Medium', 'Low', 'Info'],
  unassignedOwner: '(未指定)',
};
