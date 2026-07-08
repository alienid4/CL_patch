/* ============================================================
 * js/main.js
 * 主控：檔案上傳/拖放、解析、驅動分頁渲染、分頁切換、錯誤提示。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var UI = global.UI;

  var state = { result: null, fileName: '' };

  function $(id) { return document.getElementById(id); }

  /* -------- 入口綁定 -------- */
  function init() {
    // 檢查相依函式庫
    if (typeof XLSX === 'undefined') {
      showError('缺少 SheetJS(XLSX) 函式庫，請確認網路可連 CDN，或依 assets/vendor/README 放置離線檔。');
    }

    var fileInput = $('file-input');
    var dropZone = $('drop-zone');
    var pickBtn = $('pick-btn');

    pickBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });

    // 拖放
    ['dragenter', 'dragover'].forEach(function (ev) {
      dropZone.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropZone.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });
    dropZone.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files[0]) handleFile(files[0]);
    });

    // 分頁切換
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
    });

    // Modal 關閉
    $('modal-close').addEventListener('click', UI.closeModal);
    $('modal-overlay').addEventListener('click', function (e) {
      if (e.target === this) UI.closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') UI.closeModal();
    });

    // 換一個檔案(保留記憶，匯入新檔才覆蓋)
    $('reload-btn').addEventListener('click', function () {
      $('file-input').value = '';
      resetToUpload();
    });
    // 清除記憶(移除 localStorage 並回上傳畫面)
    var clearBtn = $('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      clearState();
      $('file-input').value = '';
      resetToUpload();
      UI.toast('已清除記住的資料', 'success');
    });

    // 還原上次匯入(若有)
    tryRestore();
  }

  /* -------- 檔案處理 -------- */
  function handleFile(file) {
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
      UI.toast('請選擇 Excel 檔（.xlsx / .xls / .csv）', 'error');
      return;
    }
    state.fileName = file.name;
    setLoading(true);
    hideError();

    global.ExcelReader.parseFile(file).then(function (parsed) {
      parsed.fileName = file.name;
      applyParsed(parsed, true);   // true = 存入 localStorage
      setLoading(false);
      UI.toast('解析完成：' + file.name, 'success');
    }).catch(function (err) {
      setLoading(false);
      handleParseError(err);
    });
  }

  /* 套用一份已解析資料(來自檔案或 localStorage 還原) */
  function applyParsed(parsed, doSave) {
    var result = global.Analysis.analyze(parsed.rows, parsed.colMap);
    state.result = result;
    state.fileName = parsed.fileName || state.fileName;
    renderAll(result, parsed);
    showDashboard();
    if (doSave) saveState(parsed);
  }

  /* -------- 記住上次匯入(localStorage) -------- */
  var STORAGE_KEY = 'vulnDashboard.v1';

  function cellForStore(v) {
    if (v instanceof Date) { return isNaN(v.getTime()) ? '' : (v.getFullYear() + '/' + (v.getMonth() + 1) + '/' + v.getDate()); }
    return v;
  }
  // 只存「有用到的欄位」以縮小體積、避開長描述欄
  function slimRows(rows, colMap) {
    var headers = [];
    Object.keys(colMap).forEach(function (k) { var h = colMap[k]; if (headers.indexOf(h) < 0) headers.push(h); });
    return rows.map(function (r) {
      var o = {}; headers.forEach(function (h) { if (r[h] !== undefined) o[h] = cellForStore(r[h]); }); return o;
    });
  }
  function saveState(parsed) {
    try {
      var payload = {
        v: 1, rows: slimRows(parsed.rows, parsed.colMap), colMap: parsed.colMap,
        sheetName: parsed.sheetName, requestedSheet: parsed.requestedSheet,
        fileName: parsed.fileName, savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      UI.toast('本次資料量較大，未能記住（下次需重新匯入）', 'error');
    }
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || !p.rows || !p.colMap) return null;
      return p;
    } catch (e) { return null; }
  }
  function clearState() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

  function fmtSavedAt(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function tryRestore() {
    var saved = loadState();
    if (!saved) return;
    try {
      applyParsed({
        rows: saved.rows, colMap: saved.colMap, sheetName: saved.sheetName,
        requestedSheet: saved.requestedSheet, fileName: saved.fileName,
      }, false);
      var when = fmtSavedAt(saved.savedAt);
      UI.toast('已還原上次匯入：' + (saved.fileName || '') + (when ? '（' + when + '）' : ''), 'success');
    } catch (e) {
      clearState(); // 還原失敗就清掉，回到上傳畫面
    }
  }

  function handleParseError(err) {
    if (err && err.type === 'columns') {
      var msg = '缺少必要欄位：<b>' + err.missing.map(U.esc).join('、') + '</b><br>' +
        '<span class="err-sub">請確認工作表標題列包含上述欄位（可調整 config/config.js 的 aliases）。</span><br>' +
        '<span class="err-sub">目前讀到的標題：' + (err.headers || []).map(U.esc).join('、') + '</span>';
      showError(msg);
    } else if (err && err.message) {
      showError(U.esc(err.message));
    } else {
      showError('解析失敗，請確認檔案格式是否正確。');
    }
    UI.toast('解析失敗', 'error');
  }

  /* -------- 渲染 -------- */
  function renderAll(result, parsed) {
    $('file-name-tag').textContent = state.fileName +
      '　(工作表：' + parsed.sheetName +
      (parsed.sheetName !== parsed.requestedSheet ? '，已改用第一個工作表' : '') + ')';
    renderQuality(result);
    global.Dashboard.render(result);
    global.Tracking.render(result);
    global.Stats.render(result);
    global.Search.render(result);
  }

  /* 資料品質檢核橫幅(全域，位於分頁上方) */
  function renderQuality(result) {
    var banner = $('quality-banner');
    if (!banner) return;
    banner.innerHTML = '';
    var q = result.quality;

    if (!q || q.count === 0) {
      banner.className = 'quality-banner ok';
      banner.appendChild(U.el('span', { text: '✅ 資料品質檢核通過，未發現異常。' }));
      return;
    }

    banner.className = 'quality-banner warn';
    var summary = q.issues.map(function (i) { return i.label.replace(/（.*）/, '') + ' ' + i.records.length; }).join('　·　');
    banner.appendChild(U.el('span', { class: 'q-icon', text: '⚠' }));
    banner.appendChild(U.el('span', { class: 'q-text', html: '資料品質：發現 <b>' + q.count + '</b> 項異常（' + U.esc(summary) + '）' }));
    banner.appendChild(U.el('button', {
      class: 'btn btn-secondary btn-sm', text: '檢視明細',
      onclick: function () { openQuality(q); },
    }));
  }

  function openQuality(q) {
    var wrap = U.el('div', { class: 'quality-detail' });
    q.issues.forEach(function (i) {
      wrap.appendChild(U.el('div', { class: 'q-issue-head' }, [
        U.el('span', { class: 'q-badge', text: String(i.records.length) }),
        U.el('span', { text: i.label }),
        U.el('button', { class: 'btn btn-secondary btn-sm q-view', text: '看清單',
          onclick: function () { UI.openDetail(i.label + '（' + i.records.length + ' 筆）', i.records); } }),
      ]));
    });
    UI.openModal('資料品質檢核（' + q.count + ' 項異常）', wrap);
  }

  /* -------- 版面狀態 -------- */
  function setLoading(on) {
    $('loading').classList.toggle('show', !!on);
  }
  function showDashboard() {
    $('upload-section').classList.add('hidden');
    $('main-content').classList.remove('hidden');
    $('reload-btn').classList.remove('hidden');
    if ($('clear-btn')) $('clear-btn').classList.remove('hidden');
    switchTab('dashboard');
  }
  function resetToUpload() {
    state.result = null;
    global.Dashboard.destroyCharts();
    global.Stats.destroyCharts();
    $('main-content').classList.add('hidden');
    $('upload-section').classList.remove('hidden');
    $('reload-btn').classList.add('hidden');
    if ($('clear-btn')) $('clear-btn').classList.add('hidden');
    $('file-name-tag').textContent = '';
    hideError();
  }
  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + tab);
    });
  }
  function showError(html) {
    var box = $('error-box');
    box.innerHTML = html;
    box.classList.add('show');
  }
  function hideError() {
    var box = $('error-box');
    box.classList.remove('show');
    box.innerHTML = '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.App = { getState: function () { return state; } };
})(window);
