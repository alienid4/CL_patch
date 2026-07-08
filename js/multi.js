/* ============================================================
 * js/multi.js  (ms-03)
 * 把 MultiSheet 讀到的各表紀錄，組成看板可用的 result。
 * 預設母體：全部部門 · 未結案(closeBucket=open)。（部門/結案篩選為 ms-04）
 * ============================================================ */
(function (global) {
  'use strict';

  var A = global.Analysis;

  /* 單張表 → result（供 Dashboard/Tracking/Stats/Search 使用） */
  function buildSheetResult(sheet) {
    var records = sheet.records || [];
    records.forEach(function (r) { if (r.department === undefined) r.department = r.unit || ''; });
    // 預設母體：未結案（全部部門）
    var scoped = records.filter(function (r) { return r.closeBucket === 'open'; });
    return A.assembleResult(records, scoped, {
      allCount: records.length,
      scopeLabel: '工作表：' + sheet.name + '　·　全部部門 · 未結案（可於 ms-04 篩選）',
    });
  }

  /* ArrayBuffer → [{ name, index, rawCount, records, result }] */
  function buildAll(buf) {
    var sheets = global.MultiSheet.parseWorkbook(buf);
    return sheets.map(function (s) {
      s.result = buildSheetResult(s);
      return s;
    });
  }

  global.Multi = { buildAll: buildAll, buildSheetResult: buildSheetResult };
})(window);
