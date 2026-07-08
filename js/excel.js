/* ============================================================
 * js/excel.js
 * 負責用 SheetJS 讀取 Excel，解析工作表，並依「欄位名稱」建立
 * 欄位對應。缺少必要欄位時回報缺哪些欄位，不當機。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var CFG = global.APP_CONFIG;

  /* 讀取檔案(File 物件) → Promise<ArrayBuffer> */
  function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.onerror = function () { reject(new Error('檔案讀取失敗')); };
      reader.readAsArrayBuffer(file);
    });
  }

  /* 從工作表取出資料列(物件陣列)與原始標題 */
  function sheetToRows(ws) {
    // header:1 先拿原始標題列，才能做欄位比對與去空白
    var matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
    if (!matrix.length) return { headers: [], rows: [] };

    var headers = matrix[0].map(function (h) { return U.normStr(h); });
    var rows = [];
    for (var i = 1; i < matrix.length; i++) {
      var arr = matrix[i];
      // 整列皆空則略過
      var allEmpty = arr.every(function (c) { return U.normStr(c) === ''; });
      if (allEmpty) continue;
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        obj[headers[c]] = arr[c] === undefined ? '' : arr[c];
      }
      rows.push(obj);
    }
    return { headers: headers, rows: rows };
  }

  /* 依 config.columns 的 aliases 在實際標題中找出對應欄位。
   * 回傳 { map: {代號: 實際標題}, missingRequired: [代號...] } */
  function resolveColumns(headers) {
    // 建立「正規化標題 → 原始標題」索引(空白標題略過，避免右側雜訊欄干擾)
    var normHeaderIndex = {};
    headers.forEach(function (h) {
      if (U.normStr(h) !== '') normHeaderIndex[U.normKey(h)] = h;
    });

    var map = {};

    // 1) 依 aliases 逐一比對(精確、去空白、忽略大小寫/全半形)
    Object.keys(CFG.columns).forEach(function (key) {
      var spec = CFG.columns[key];
      for (var i = 0; i < spec.aliases.length; i++) {
        var nk = U.normKey(spec.aliases[i]);
        if (normHeaderIndex[nk]) { map[key] = normHeaderIndex[nk]; break; }
      }
    });

    // 2) 容錯：Risk 與 Severity 合併為單一欄(如「Risk Severity」「Risk/Severity」「Risk\nSeverity」)
    if (!map.severity || !map.risk) {
      var combined = null;
      for (var h = 0; h < headers.length; h++) {
        var k = U.normKey(headers[h]);
        if (k.indexOf('risk') >= 0 && k.indexOf('severity') >= 0) { combined = headers[h]; break; }
      }
      if (combined) {
        if (!map.severity) map.severity = combined;
        if (!map.risk) map.risk = combined;
      }
    }

    // 3) 容錯：仍缺 severity → 取任何含 "severity" 的欄
    if (!map.severity) {
      for (var j = 0; j < headers.length; j++) {
        if (U.normStr(headers[j]) !== '' && U.normKey(headers[j]).indexOf('severity') >= 0) {
          map.severity = headers[j]; break;
        }
      }
    }

    // 4) 統計缺少的必要欄位
    var missingRequired = [];
    var missingRequiredAlias = [];
    Object.keys(CFG.columns).forEach(function (key) {
      var spec = CFG.columns[key];
      if (spec.required && !map[key]) {
        missingRequired.push(key);
        missingRequiredAlias.push(spec.aliases[0]);
      }
    });

    return { map: map, missingRequired: missingRequired, missingRequiredAlias: missingRequiredAlias };
  }

  /* 主入口：解析 File → 回傳 Promise<{ headers, rows, colMap, sheetName }>
   * 若缺必要欄位或找不到工作表，reject 帶詳細訊息物件。 */
  function parseFile(file) {
    return readFileAsArrayBuffer(file).then(function (buf) {
      var wb;
      try {
        wb = XLSX.read(buf, { type: 'array', cellDates: true });
      } catch (e) {
        throw { type: 'parse', message: '無法解析此 Excel 檔案：' + e.message };
      }

      var sheetNames = wb.SheetNames || [];
      var targetName = CFG.sheetName;
      var usedName = null;

      if (sheetNames.indexOf(targetName) >= 0) {
        usedName = targetName;
      } else if (CFG.fallbackToFirstSheet && sheetNames.length) {
        usedName = sheetNames[0];
      } else {
        throw {
          type: 'sheet',
          message: '找不到工作表「' + targetName + '」。檔案內的工作表：' +
                   (sheetNames.join('、') || '(無)'),
        };
      }

      var parsed = sheetToRows(wb.Sheets[usedName]);
      if (!parsed.headers.length) {
        throw { type: 'empty', message: '工作表「' + usedName + '」沒有標題列或內容為空。' };
      }

      var resolved = resolveColumns(parsed.headers);
      if (resolved.missingRequired.length) {
        throw {
          type: 'columns',
          message: '缺少必要欄位',
          missing: resolved.missingRequiredAlias,
          headers: parsed.headers,
        };
      }

      return {
        headers: parsed.headers,
        rows: parsed.rows,
        colMap: resolved.map,
        sheetName: usedName,
        sheetNames: sheetNames,
        requestedSheet: targetName,
      };
    });
  }

  global.ExcelReader = { parseFile: parseFile };
})(window);
