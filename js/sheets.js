/* ============================================================
 * js/sheets.js  (ms-01 讀取 + ms-02 正規化)
 * 讀取所有「數字-」開頭工作表，依 profile 對應並正規化成統一紀錄。
 * 特例：表8 單位欄拆單位+負責人；表9 風險計數「中*4 低*2」展開成多筆。
 * 不影響現有單表流程（此檔為新增，尚未接 UI）。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var P = global.SHEET_PROFILES;

  /* ---- 欄位解析：先精確、再前綴，皆用 normKey 去空白/大小寫 ---- */
  function resolveField(normHeaders, aliases) {
    var i, h, ak;
    for (i = 0; i < aliases.length; i++) {
      ak = U.normKey(aliases[i]);
      for (h = 0; h < normHeaders.length; h++) if (normHeaders[h].k === ak) return normHeaders[h].raw;
    }
    for (i = 0; i < aliases.length; i++) {
      ak = U.normKey(aliases[i]);
      for (h = 0; h < normHeaders.length; h++) if (normHeaders[h].k.indexOf(ak) === 0) return normHeaders[h].raw;
    }
    return null;
  }

  function resolveProfile(headers) {
    var normHeaders = headers.filter(function (x) { return U.normStr(x) !== ''; })
      .map(function (x) { return { raw: x, k: U.normKey(x) }; });
    var map = {};
    Object.keys(P.fieldAliases).forEach(function (field) {
      map[field] = resolveField(normHeaders, P.fieldAliases[field]);
    });
    return map;
  }

  /* ---- 嚴重度正規化 ---- */
  function mapSeverity(raw) {
    var s = U.normStr(raw); if (!s) return 'Unknown';
    var low = s.toLowerCase();
    var keys = Object.keys(P.severityMap);
    for (var i = 0; i < keys.length; i++) {
      if (low.indexOf(keys[i]) >= 0) return P.severityMap[keys[i]];
    }
    return 'Unknown';
  }

  /* 判斷是否為「計數字串」如「中*4 低*2」「High*3」 */
  var COUNT_RE = /(嚴重|critical|高|high|中|medium|低|low|info)\s*[\*xX×]\s*(\d+)/gi;
  function parseCounts(raw) {
    var s = U.normStr(raw); if (!s) return null;
    COUNT_RE.lastIndex = 0;
    var m, out = [];
    while ((m = COUNT_RE.exec(s)) !== null) {
      out.push({ sev: mapSeverity(m[1]), n: parseInt(m[2], 10) || 0 });
    }
    return out.length ? out : null;
  }

  /* ---- 結案分桶：open / closed / other ---- */
  function classifyClose(rawStatus, closeDate) {
    var s = U.normStr(rawStatus);
    if (s) {
      if (s.indexOf('未結') >= 0 || s.indexOf('進行中') >= 0) return 'open';
      if (s.indexOf('結案') >= 0 || s.indexOf('已修補') >= 0) return 'closed';
      return 'other';
    }
    return closeDate ? 'closed' : 'open';
  }

  /* ---- 取值 ---- */
  function pick(row, header) {
    if (!header) return '';
    var v = row[header];
    return v === undefined ? '' : v;
  }

  /* 表8 特例：單位欄含人名「資訊架構部-林偉竹 (EDR偵測規則)」→ 拆 */
  function splitUnitOwner(raw) {
    var s = U.normStr(raw);
    var idx = s.indexOf('-');
    if (idx < 0) idx = s.indexOf('–'); // en dash
    if (idx < 0) return { unit: s, owner: '' };
    var unit = s.slice(0, idx).trim();
    var owner = s.slice(idx + 1).replace(/[（(].*$/, '').trim(); // 去尾註 (…)
    return { unit: unit, owner: owner };
  }

  /* ---- 一列 → 一或多筆標準紀錄 ---- */
  function buildRecords(row, map, sheetName) {
    var fix = U.parseDate(pick(row, map.fixDeadline));
    var ext = U.parseDate(pick(row, map.firstExtension));
    var exc = U.parseDate(pick(row, map.exceptionApproval));
    var other = U.parseDate(pick(row, map.otherDue));
    var realDue = exc || ext || fix || other || null;
    var daysLeft = U.daysFromToday(realDue);

    var closeDate = U.parseDate(pick(row, map.closeDate));
    var closeRaw = U.normStr(pick(row, map.closeStatus));
    var closeBucket = classifyClose(closeRaw, closeDate);

    // 單位/負責人（表8：無 owner 欄且單位含「-」→ 拆）
    var unit = U.normStr(pick(row, map.unit));
    var owner = map.owner ? U.normStr(pick(row, map.owner)) : '';
    if (!map.owner && unit.indexOf('-') >= 0) {
      var so = splitUnitOwner(unit); unit = so.unit; owner = so.owner;
    }
    if (!owner) owner = '(未指定)';

    var base = {
      sheet: sheetName,
      host: U.normStr(pick(row, map.host)),
      name: U.normStr(pick(row, map.name)),
      pluginId: U.normStr(pick(row, map.pluginId)),
      unit: unit,
      owner: owner,
      fixDeadline: fix, firstExtension: ext, exceptionApproval: exc, otherDue: other,
      realDue: realDue, daysLeft: daysLeft,
      overdue: (daysLeft !== null && daysLeft < 0),
      overdueDays: (daysLeft !== null && daysLeft < 0) ? -daysLeft : 0,
      closeStatus: closeRaw, closeBucket: closeBucket, closeDate: closeDate,
      remark: U.normStr(pick(row, map.remark)),
    };

    // 嚴重度：表9 計數字串 → 展開多筆；否則單筆
    var sevRaw = U.normStr(pick(row, map.severity));
    var counts = parseCounts(sevRaw);
    base.risk = sevRaw; // Risk 欄/CSV 顯示原始嚴重度值
    if (counts) {
      var out = [];
      counts.forEach(function (c) {
        for (var i = 0; i < c.n; i++) {
          out.push(Object.assign({}, base, { severity: c.sev, severityRaw: sevRaw, fromCount: true }));
        }
      });
      return out.length ? out : [Object.assign({}, base, { severity: 'Unknown', severityRaw: sevRaw })];
    }
    base.severity = map.severity ? mapSeverity(sevRaw) : 'Unknown';
    base.severityRaw = sevRaw;
    return [base];
  }

  /* ---- 工作表 → {name, headers, rawCount, records, profile} ---- */
  function parseSheet(ws, name) {
    var matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
    if (!matrix.length) return { name: name, headers: [], rawCount: 0, records: [], profile: {} };
    var headers = matrix[0].map(function (h) { return U.normStr(h); });
    var map = resolveProfile(headers);
    var records = [];
    var rawCount = 0;
    for (var i = 1; i < matrix.length; i++) {
      var arr = matrix[i];
      if (arr.every(function (c) { return U.normStr(c) === ''; })) continue;
      rawCount++;
      var obj = {};
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = arr[c] === undefined ? '' : arr[c];
      buildRecords(obj, map, name).forEach(function (r) { records.push(r); });
    }
    return { name: name, headers: headers, rawCount: rawCount, records: records, profile: map };
  }

  /* ---- 主入口：ArrayBuffer → 各數字表結果（依表號排序） ---- */
  function parseWorkbook(buf) {
    var wb = XLSX.read(buf, { type: 'array', cellDates: true });
    var pat = new RegExp(P.numberedSheetPattern);
    var names = (wb.SheetNames || []).filter(function (n) { return pat.test(n); });
    names.sort(function (a, b) { return leadNum(a) - leadNum(b); });
    return names.map(function (n, i) {
      var res = parseSheet(wb.Sheets[n], n);
      res.index = i;
      return res;
    });
  }
  function leadNum(name) {
    var m = String(name).match(/\d+/);
    return m ? parseInt(m[0], 10) : 9999;
  }

  global.MultiSheet = { parseWorkbook: parseWorkbook, resolveProfile: resolveProfile, mapSeverity: mapSeverity, classifyClose: classifyClose };
})(window);
