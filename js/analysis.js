/* ============================================================
 * js/analysis.js
 * 核心分析：正規化資料列、計算真正到期日、逾期天數、分類統計。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var CFG = global.APP_CONFIG;

  /* 依 colMap 從原始列取值 */
  function pick(row, colMap, key) {
    var header = colMap[key];
    if (!header) return '';
    var v = row[header];
    return v === undefined ? '' : v;
  }

  /* 正規化嚴重度為標準詞 */
  function normSeverity(v) {
    var s = U.normStr(v).toLowerCase();
    if (!s) return 'Unknown';
    if (s.indexOf('critical') >= 0) return 'Critical';
    if (s.indexOf('high') >= 0) return 'High';
    if (s.indexOf('medium') >= 0) return 'Medium';
    if (s.indexOf('low') >= 0) return 'Low';
    if (s.indexOf('info') >= 0 || s.indexOf('none') >= 0) return 'Info';
    return U.normStr(v); // 保留原值(可能是數字風險值)
  }

  /* 解析備註中的處置申請次數(展延/例外)。
   * 以 iForm 出現次數為「申請次數」；展延/例外關鍵字作分項。 */
  function parseActions(remark) {
    if (!remark) return { total: 0, ext: 0, exc: 0 };
    var iforms = remark.match(/iform/gi);
    var total = iforms ? iforms.length : 0;
    var ext = (remark.match(/展延/g) || []).length;
    var exc = (remark.match(/例外/g) || []).length;
    if (!total) total = ext + exc; // 無 iForm 文號時退用關鍵字數
    return { total: total, ext: ext, exc: exc };
  }

  /* 風險分數 = 嚴重度權重 × 急迫倍數(逾期越久越高) */
  function riskScore(severity, realDue, daysLeft, overdueDays) {
    var w = (CFG.riskSeverityWeight && CFG.riskSeverityWeight[severity]);
    if (w === undefined) w = (CFG.riskSeverityWeight && CFG.riskSeverityWeight.Unknown) || 5;
    var mult;
    if (realDue === null) mult = 1;                         // 無到期日
    else if (daysLeft < 0) mult = 2 + (overdueDays / 30);   // 逾期，越久越高
    else if (daysLeft <= (CFG.soonDays || 30)) mult = 1.5;  // 快到期
    else mult = 1;                                          // 尚遠
    return Math.round(w * mult * 10) / 10;
  }

  /* 把一列原始資料轉為標準紀錄 */
  function buildRecord(row, colMap) {
    var fixDeadline = U.parseDate(pick(row, colMap, 'fixDeadline'));
    var firstExtension = U.parseDate(pick(row, colMap, 'firstExtension'));
    var exceptionApproval = U.parseDate(pick(row, colMap, 'exceptionApproval'));

    // 真正到期日：例外核准 → 首次展延 → 修補期限
    var realDue = exceptionApproval || firstExtension || fixDeadline || null;
    var daysLeft = U.daysFromToday(realDue); // 負=逾期

    // 處置階段：有例外核准 → 例外管理中；否則有首次展延 → 首次展延中；
    //           否則有修補期限 → 原始修補期限；三者皆無 → 未定期限
    var stage = exceptionApproval ? 'exception'
              : firstExtension    ? 'extension'
              : fixDeadline       ? 'original'
              :                     'none';
    // 安全名單：例外管理中且新到期日(例外核准期限)尚未到 → 目前受例外保護
    var safeException = (stage === 'exception' && daysLeft !== null && daysLeft >= 0);

    var remarkStr = U.normStr(pick(row, colMap, 'remark'));
    var actions = parseActions(remarkStr);
    var overdueDays = (daysLeft !== null && daysLeft < 0) ? -daysLeft : 0;

    return {
      stage:             stage,
      safeException:     safeException,
      actionCount:       actions.total,
      extCount:          actions.ext,
      excCount:          actions.exc,
      chronic:           actions.total >= (CFG.chronicThreshold || 2),
      riskScore:         riskScore(normSeverity(pick(row, colMap, 'severity')), realDue, daysLeft, overdueDays),
      pluginId:          U.normStr(pick(row, colMap, 'pluginId')),
      risk:              U.normStr(pick(row, colMap, 'risk')),
      severity:          normSeverity(pick(row, colMap, 'severity')),
      host:              U.normStr(pick(row, colMap, 'host')),
      protocol:          U.normStr(pick(row, colMap, 'protocol')),
      port:              U.normStr(pick(row, colMap, 'port')),
      name:              U.normStr(pick(row, colMap, 'name')),
      synopsis:          U.normStr(pick(row, colMap, 'synopsis')),
      description:       U.normStr(pick(row, colMap, 'description')),
      solution:          U.normStr(pick(row, colMap, 'solution')),
      seeAlso:           U.normStr(pick(row, colMap, 'seeAlso')),
      pluginOutput:      U.normStr(pick(row, colMap, 'pluginOutput')),
      fixDeadline:       fixDeadline,
      firstExtension:    firstExtension,
      exceptionApproval: exceptionApproval,
      realDue:           realDue,
      daysLeft:          daysLeft,
      overdue:           (daysLeft !== null && daysLeft < 0),
      overdueDays:       (daysLeft !== null && daysLeft < 0) ? -daysLeft : 0,
      overdueStatus:     U.normStr(pick(row, colMap, 'overdueStatus')),
      systemCategory:    U.normStr(pick(row, colMap, 'systemCategory')),
      assetName:         U.normStr(pick(row, colMap, 'assetName')),
      department:        U.normStr(pick(row, colMap, 'department')),
      owner:             U.normStr(pick(row, colMap, 'owner')) || '(未指定)',
      retestStatus:      U.normStr(pick(row, colMap, 'retestStatus')),
      closeStatus:       U.normStr(pick(row, colMap, 'closeStatus')),
      closeDate:         U.parseDate(pick(row, colMap, 'closeDate')),
      remark:            U.normStr(pick(row, colMap, 'remark')),
      year:              U.normStr(pick(row, colMap, 'year')),
      pureSystem:        U.normStr(pick(row, colMap, 'pureSystem')),
    };
  }

  /* -------- 分類判斷 --------
   * 已結案的弱點一律不再用到期日判斷（不算逾期/近期到期/待追蹤）。 */
  function isClosed(r) { return r.closeBucket === 'closed'; }
  function isOverdue(r) { return !isClosed(r) && r.realDue && r.daysLeft < 0; }
  function withinDays(r, n) { return !isClosed(r) && r.realDue && r.daysLeft >= 0 && r.daysLeft <= n; }
  // 六個月到期：逾期 或 未來180天內到期(半年內需關注)
  function withinSixMonths(r) { return !isClosed(r) && r.realDue && r.daysLeft <= CFG.sixMonthsDays; }
  // 今日待追蹤：今日(含)以前到期，尚未結案 → 需立即處理
  function isTodayTrack(r) { return !isClosed(r) && r.realDue && r.daysLeft <= 0; }
  function isSeverity(r, sev) { return r.severity === sev; }

  /* -------- 到期時間帶(互斥，可加總回總數) --------
   * 每筆紀錄「剛好」落在一個帶，故各帶相加 = 總數，方便驗算。 */
  var BANDS = [
    { key: 'overdue',  label: '已逾期' },
    { key: 'd30',      label: '30天內' },
    { key: 'd90',      label: '31–90天' },
    { key: 'd180',     label: '91–180天' },
    { key: 'over180',  label: '180天以上' },
    { key: 'noDue',    label: '無到期日' },
  ];
  function bandOf(r) {
    if (r.closeBucket === 'closed') return 'noDue';   // 已結案：無活躍到期時間帶，不計入已逾期等帶
    if (!r.realDue) return 'noDue';
    if (r.daysLeft < 0) return 'overdue';
    if (r.daysLeft <= 30) return 'd30';
    if (r.daysLeft <= 90) return 'd90';
    if (r.daysLeft <= 180) return 'd180';
    return 'over180';
  }
  function bandCounts(records) {
    var c = {}; BANDS.forEach(function (b) { c[b.key] = 0; });
    records.forEach(function (r) { c[bandOf(r)]++; });
    return c;
  }

  /* 一組紀錄 → 各項統計 */
  function summarize(records) {
    var s = {
      total: records.length,
      overdue: 0,
      near30: 0, near90: 0, near180: 0,
      sixMonths: 0,
      todayTrack: 0,
      critical: 0, high: 0, medium: 0, low: 0, info: 0,
      severityDist: {},
      noDueDate: 0,
      bands: bandCounts(records),   // 互斥時間帶
    };
    CFG.severityOrder.forEach(function (k) { s.severityDist[k] = 0; });
    s.severityDist.Unknown = 0;

    records.forEach(function (r) {
      if (!r.realDue) s.noDueDate++;
      if (isOverdue(r)) s.overdue++;
      if (withinDays(r, 30)) s.near30++;
      if (withinDays(r, 90)) s.near90++;
      if (withinDays(r, 180)) s.near180++;
      if (withinSixMonths(r)) s.sixMonths++;
      if (isTodayTrack(r)) s.todayTrack++;

      if (r.severity === 'Critical') s.critical++;
      else if (r.severity === 'High') s.high++;
      else if (r.severity === 'Medium') s.medium++;
      else if (r.severity === 'Low') s.low++;
      else if (r.severity === 'Info') s.info++;

      if (s.severityDist[r.severity] === undefined) s.severityDist[r.severity] = 0;
      s.severityDist[r.severity]++;
    });
    return s;
  }

  /* 依處置階段(例外/展延/原始)分組並統計 */
  var STAGE_DEFS = [
    { key: 'exception', label: '例外管理中' },
    { key: 'extension', label: '首次展延中' },
    { key: 'original',  label: '原始修補期限' },
    { key: 'none',      label: '未定期限' },
  ];

  function byStage(records) {
    var soon = CFG.soonDays || 30;
    var stages = STAGE_DEFS.map(function (st) {
      var recs = records.filter(function (r) { return r.stage === st.key; });
      return {
        key: st.key,
        label: st.label,
        records: recs,
        total: recs.length,
        overdue: recs.filter(isOverdue).length,
        soon: recs.filter(function (r) { return r.realDue && r.daysLeft >= 0 && r.daysLeft <= soon; }).length,
        safe: recs.filter(function (r) { return r.realDue && r.daysLeft > soon; }).length,
        noDue: recs.filter(function (r) { return !r.realDue; }).length,
      };
    });
    // 例外保護中(安全名單)
    var safeList = records.filter(function (r) { return r.safeException; });
    // 到期時間帶(互斥，供堆疊圖)：每帶各階段件數
    var bandKeys = BANDS.map(function (b) { return b.key; });
    var bandMatrix = {}; // bandMatrix[stageKey][band] = count
    STAGE_DEFS.forEach(function (st) {
      bandMatrix[st.key] = {}; bandKeys.forEach(function (b) { bandMatrix[st.key][b] = 0; });
    });
    records.forEach(function (r) { bandMatrix[r.stage][bandOf(r)]++; });

    return {
      stages: stages,
      safeList: safeList,
      total: records.length,
      soonDays: soon,
      bands: bandKeys,
      bandMatrix: bandMatrix,
    };
  }

  /* 依負責人分組並統計 */
  function byOwner(records) {
    var groups = {};
    records.forEach(function (r) {
      var k = r.owner;
      if (!groups[k]) groups[k] = [];
      groups[k].push(r);
    });
    var list = Object.keys(groups).map(function (owner) {
      var recs = groups[owner];
      return {
        owner: owner,
        records: recs,
        open: recs.length,
        overdue: recs.filter(isOverdue).length,
        near30: recs.filter(function (r) { return withinDays(r, 30); }).length,
        near90: recs.filter(function (r) { return withinDays(r, 90); }).length,
        near180: recs.filter(function (r) { return withinDays(r, 180); }).length,
        bands: bandCounts(recs),   // 互斥時間帶(可加總)
        exception: recs.filter(function (r) { return r.stage === 'exception'; }).length,
        extension: recs.filter(function (r) { return r.stage === 'extension'; }).length,
        safe: recs.filter(function (r) { return r.safeException; }).length,
      };
    });
    // 逾期多者優先，其次未結案多者
    list.sort(function (a, b) {
      return (b.overdue - a.overdue) || (b.open - a.open) || a.owner.localeCompare(b.owner);
    });
    return list;
  }

  /* 嚴重度 × 修復狀態：對「資訊架構部全部」紀錄，依嚴重度分未修復/已修復/其他。
   *   未修復 = 結案狀態 = 未結案；已修復 = 結案類(含「結」且非未結案)；其他 = 其餘狀態。 */
  function severityRepair(deptAll, openStatus) {
    var openKey = U.normKey(openStatus);
    function classify(r) {
      if (r.closeBucket) return r.closeBucket; // 多表：已有分桶(open/closed/other)
      if (U.normKey(r.closeStatus) === openKey) return 'open';
      if (String(r.closeStatus).indexOf('結') >= 0) return 'closed';
      return 'other';
    }
    var order = CFG.severityOrder.concat(['Unknown']);
    var bySev = {};
    deptAll.forEach(function (r) {
      var sev = order.indexOf(r.severity) >= 0 ? r.severity : (r.severity || 'Unknown');
      var g = bySev[sev] || (bySev[sev] = { sev: sev, open: [], closed: [], other: [] });
      g[classify(r)].push(r);
    });
    // 依嚴重度順序輸出(有資料者)
    var keys = order.slice();
    Object.keys(bySev).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    var rows = [];
    keys.forEach(function (sev) {
      var g = bySev[sev]; if (!g) return;
      var total = g.open.length + g.closed.length + g.other.length;
      rows.push({
        sev: sev, records: g.open.concat(g.closed).concat(g.other),
        open: g.open, closed: g.closed, other: g.other,
        openN: g.open.length, closedN: g.closed.length, otherN: g.other.length,
        total: total, rate: total ? g.closed.length / total : 0,
      });
    });
    var totals = { openN: 0, closedN: 0, otherN: 0, total: 0, open: [], closed: [], other: [] };
    rows.forEach(function (r) {
      totals.openN += r.openN; totals.closedN += r.closedN; totals.otherN += r.otherN; totals.total += r.total;
      totals.open = totals.open.concat(r.open); totals.closed = totals.closed.concat(r.closed); totals.other = totals.other.concat(r.other);
    });
    totals.rate = totals.total ? totals.closedN / totals.total : 0;
    return { rows: rows, totals: totals, hasOther: totals.otherN > 0 };
  }

  /* 例外治理雷達 */
  function governance(records) {
    var exRecs = records.filter(function (r) { return r.stage === 'exception'; });
    var expiryDays = CFG.exceptionExpiryDays || [7, 14, 30];
    var expiry = expiryDays.map(function (d) {
      return {
        days: d,
        records: exRecs.filter(function (r) { return r.realDue && r.daysLeft >= 0 && r.daysLeft <= d; }),
      };
    });
    var expired = exRecs.filter(isOverdue); // 例外破口：例外中卻已逾期
    var chronic = records.filter(function (r) { return r.chronic; })
                         .sort(function (a, b) { return (b.actionCount - a.actionCount) || (a.daysLeft - b.daysLeft); });
    return {
      exCount: exRecs.length,
      total: records.length,
      coverage: records.length ? exRecs.length / records.length : 0,
      expiry: expiry,
      expired: expired,
      chronic: chronic,
    };
  }

  /* 人員 × 月 到期矩陣：每位負責人未來 N 個月各月到期筆數。
   * 只計「未逾期且真正到期日落在未來 N 個月內」的紀錄。 */
  function dueMatrix(records, monthsAhead) {
    monthsAhead = monthsAhead || 6;
    var t = U.today();
    var startY = t.getFullYear(), startM = t.getMonth(); // 0-based
    var months = [];
    for (var i = 0; i < monthsAhead; i++) {
      var d = new Date(startY, startM + i, 1);
      var y = d.getFullYear(), m = d.getMonth() + 1;
      months.push({ y: y, m: m, key: y + '-' + m, label: (y === startY ? m + '月' : y + '/' + m) });
    }
    var monthIndex = {};
    months.forEach(function (mm) { monthIndex[mm.key] = true; });

    var ownerMap = {};
    records.forEach(function (r) {
      if (r.realDue === null || r.daysLeft < 0) return; // 只算未來到期(含今日)
      var key = r.realDue.getFullYear() + '-' + (r.realDue.getMonth() + 1);
      if (!monthIndex[key]) return;                      // 超過 N 個月不列
      var o = ownerMap[r.owner] || (ownerMap[r.owner] = { owner: r.owner, counts: {}, recs: {}, total: 0 });
      o.counts[key] = (o.counts[key] || 0) + 1;
      (o.recs[key] = o.recs[key] || []).push(r);
      o.total++;
    });

    var rows = Object.keys(ownerMap).map(function (k) { return ownerMap[k]; });
    rows.sort(function (a, b) { return (b.total - a.total) || a.owner.localeCompare(b.owner); });

    var totals = { total: 0 };
    months.forEach(function (mm) { totals[mm.key] = 0; });
    rows.forEach(function (r) {
      months.forEach(function (mm) { totals[mm.key] += (r.counts[mm.key] || 0); });
      totals.total += r.total;
    });

    var startLabel = startY + '/' + String(startM + 1).padStart(2, '0');
    var end = months[months.length - 1];
    var endLabel = end.y + '/' + String(end.m).padStart(2, '0');
    return { months: months, rows: rows, totals: totals, monthsAhead: monthsAhead, rangeLabel: startLabel + ' ~ ' + endLabel };
  }

  /* 今日行動清單：逾期 + 今日到期 + 例外N天內到期，依風險分排序 */
  function todayActions(records) {
    var exDays = CFG.todayExceptionExpiryDays || 7;
    var list = records.filter(function (r) {
      if (r.realDue && r.daysLeft <= 0) return true; // 逾期或今日到期
      if (r.stage === 'exception' && r.realDue && r.daysLeft >= 0 && r.daysLeft <= exDays) return true;
      return false;
    });
    list.sort(function (a, b) { return (b.riskScore - a.riskScore) || (a.daysLeft - b.daysLeft); });
    return list;
  }

  /* 風險加權排行 */
  function riskRanking(records, n) {
    return records.slice()
      .sort(function (a, b) { return (b.riskScore - a.riskScore) || (a.daysLeft - b.daysLeft); })
      .slice(0, n || CFG.riskTopN || 10);
  }

  /* 資料品質檢核 */
  function qualityIssues(records) {
    var valid = CFG.validSeverities || ['Critical', 'High', 'Medium', 'Low', 'Info'];
    var unassigned = CFG.unassignedOwner || '(未指定)';
    var defs = [
      { key: 'noDue', label: '缺少到期日',
        test: function (r) { return !r.realDue; } },
      { key: 'exBeforeFix', label: '例外核准期限早於修補期限',
        test: function (r) { return r.exceptionApproval && r.fixDeadline && r.exceptionApproval < r.fixDeadline; } },
      { key: 'extBeforeFix', label: '首次展延上限早於修補期限',
        test: function (r) { return r.firstExtension && r.fixDeadline && r.firstExtension < r.fixDeadline; } },
      { key: 'noOwner', label: '負責人未指定',
        test: function (r) { return !r.owner || r.owner === unassigned; } },
      { key: 'badSeverity', label: '嚴重度無法辨識',
        test: function (r) { return valid.indexOf(r.severity) < 0; } },
    ];
    var issues = defs.map(function (d) {
      return { key: d.key, label: d.label, records: records.filter(d.test) };
    }).filter(function (i) { return i.records.length > 0; });
    var totalFlagged = 0;
    issues.forEach(function (i) { totalFlagged += i.records.length; });
    return { issues: issues, count: totalFlagged };
  }

  /* 補齊衍生欄位(供多表：records 已有 severity/realDue/daysLeft/日期/remark) */
  function finalizeRecord(r) {
    var stage = r.exceptionApproval ? 'exception'
              : r.firstExtension    ? 'extension'
              : r.fixDeadline       ? 'original' : 'none';
    r.stage = stage;
    r.safeException = (stage === 'exception' && r.daysLeft !== null && r.daysLeft >= 0);
    var actions = parseActions(r.remark || '');
    r.actionCount = actions.total; r.extCount = actions.ext; r.excCount = actions.exc;
    r.chronic = actions.total >= (CFG.chronicThreshold || 2);
    // 已結案不再算逾期（統一在此覆寫，確保各路徑一致）
    var od = (r.closeBucket !== 'closed' && r.daysLeft !== null && r.daysLeft < 0);
    r.overdue = od;
    r.overdueDays = od ? -r.daysLeft : 0;
    r.riskScore = riskScore(r.severity, r.realDue, r.daysLeft, r.overdueDays);
    if (r.department === undefined) r.department = r.unit || '';
    if (!r.owner) r.owner = '(未指定)';
    return r;
  }

  /* 由「已正規化紀錄陣列」組出完整分析結果(多表共用同一套看板運算)。
   * allRecords: 該表全部；scoped: 母體(預設 = closeBucket 為 open) */
  function assembleResult(allRecords, scoped, meta) {
    meta = meta || {};
    allRecords.forEach(finalizeRecord);
    scoped = scoped || allRecords.filter(function (r) { return r.closeBucket ? r.closeBucket === 'open' : true; });

    var statusMap = {};
    allRecords.forEach(function (r) {
      var k = r.closeStatus || '(空白)';
      if (!statusMap[k]) statusMap[k] = { status: k, count: 0, records: [] };
      statusMap[k].count++; statusMap[k].records.push(r);
    });
    var statusItems = Object.keys(statusMap).map(function (k) { return statusMap[k]; })
      .sort(function (a, b) { return b.count - a.count; });

    return {
      allCount: meta.allCount != null ? meta.allCount : allRecords.length,
      deptAllCount: allRecords.length,
      records: scoped,
      summary: summarize(scoped),
      owners: byOwner(scoped),
      stageStats: byStage(scoped),
      statusBreakdown: {
        items: statusItems, total: allRecords.length,
        openCount: allRecords.filter(function (r) { return r.closeBucket === 'open'; }).length,
        closedCount: allRecords.filter(function (r) { return r.closeBucket === 'closed'; }).length,
      },
      severityRepair: severityRepair(allRecords, CFG.filter.openStatus),
      governance: governance(scoped),
      dueMatrix: dueMatrix(scoped, CFG.dueMatrixMonths),
      todayActions: todayActions(scoped),
      riskRanking: riskRanking(scoped),
      quality: qualityIssues(scoped),
      scopeLabel: meta.scopeLabel,
    };
  }

  /* 主入口：原始 rows + colMap → 分析結果 */
  function analyze(rows, colMap) {
    var all = rows.map(function (r) { return buildRecord(r, colMap); });

    var dept = CFG.filter.department;
    var open = CFG.filter.openStatus;

    // 分析母體：負責單位 = 資訊架構部 且 結案狀態 = 未結案
    var scoped = all.filter(function (r) {
      return U.normKey(r.department) === U.normKey(dept) &&
             U.normKey(r.closeStatus) === U.normKey(open);
    });

    // 僅符合單位(不論結案) — 供顯示資料涵蓋範圍參考
    var deptAll = all.filter(function (r) {
      return U.normKey(r.department) === U.normKey(dept);
    });

    // 結案狀態拆解(資訊架構部)：未結案 + 結案 + 其他 = 單位總數
    var statusMap = {};
    deptAll.forEach(function (r) {
      var k = r.closeStatus || '(空白)';
      if (!statusMap[k]) statusMap[k] = { status: k, count: 0, records: [] };
      statusMap[k].count++; statusMap[k].records.push(r);
    });
    var statusItems = Object.keys(statusMap).map(function (k) { return statusMap[k]; })
      .sort(function (a, b) { return b.count - a.count; });
    var openKey = U.normKey(open);
    var statusBreakdown = {
      items: statusItems,
      total: deptAll.length,
      openCount: (statusMap[open] ? statusMap[open].count : scoped.length),
      // 「結案」類：狀態含「結」但非「未結案」
      closedCount: statusItems.filter(function (s) {
        return U.normKey(s.status) !== openKey && s.status.indexOf('結') >= 0;
      }).reduce(function (a, s) { return a + s.count; }, 0),
    };

    return {
      allCount: all.length,
      deptAllCount: deptAll.length,
      records: scoped,
      summary: summarize(scoped),
      owners: byOwner(scoped),
      stageStats: byStage(scoped),
      statusBreakdown: statusBreakdown,
      severityRepair: severityRepair(deptAll, open),
      governance: governance(scoped),
      dueMatrix: dueMatrix(scoped, CFG.dueMatrixMonths),
      todayActions: todayActions(scoped),
      riskRanking: riskRanking(scoped),
      quality: qualityIssues(scoped),
    };
  }

  /* 供 UI 重用的分類過濾器(drill-down) */
  var Filters = {
    open:     function (r) { return true; },              // 母體已是未結案
    overdue:  isOverdue,
    near30:   function (r) { return withinDays(r, 30); },
    near90:   function (r) { return withinDays(r, 90); },
    near180:  function (r) { return withinDays(r, 180); },
    sixMonths: withinSixMonths,
    todayTrack: isTodayTrack,
    critical: function (r) { return isSeverity(r, 'Critical'); },
    high:     function (r) { return isSeverity(r, 'High'); },
    medium:   function (r) { return isSeverity(r, 'Medium'); },
    // 快到期(soonDays 內、未逾期)
    soon:     function (r) { return r.realDue && r.daysLeft >= 0 && r.daysLeft <= (CFG.soonDays || 30); },
    // 處置階段
    stageException: function (r) { return r.stage === 'exception'; },
    stageExtension: function (r) { return r.stage === 'extension'; },
    stageOriginal:  function (r) { return r.stage === 'original'; },
    stageNone:      function (r) { return r.stage === 'none'; },
    // 安全名單(例外保護中)
    safeException:  function (r) { return r.safeException; },
    // 慢性風險(反覆展延/例外)
    chronic:        function (r) { return r.chronic; },
  };

  global.Analysis = {
    analyze: analyze,
    assembleResult: assembleResult,
    finalizeRecord: finalizeRecord,
    summarize: summarize,
    BANDS: BANDS,
    bandOf: bandOf,
    byOwner: byOwner,
    byStage: byStage,
    severityRepair: severityRepair,
    governance: governance,
    dueMatrix: dueMatrix,
    todayActions: todayActions,
    riskRanking: riskRanking,
    qualityIssues: qualityIssues,
    Filters: Filters,
    helpers: { isOverdue: isOverdue, withinDays: withinDays, withinSixMonths: withinSixMonths, riskScore: riskScore },
  };
})(window);
