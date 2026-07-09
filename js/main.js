/* ============================================================
 * js/main.js
 * 主控：檔案上傳/拖放、解析、驅動分頁渲染、分頁切換、錯誤提示。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var UI = global.UI;

  var state = { result: null, fileName: '', sheets: null, activeIdx: 0 };

  function $(id) { return document.getElementById(id); }

  /* -------- 入口綁定 -------- */
  function init() {
    // 版本號(右上角)
    var vEl = $('app-version');
    if (vEl && global.APP_VERSION) {
      vEl.textContent = global.APP_VERSION;
      if (global.APP_VERSION_DATE) vEl.title = '版本 ' + global.APP_VERSION + '（' + global.APP_VERSION_DATE + '）';
    }

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

    // 複製指標摘要(整理成一段可讀文字 → 剪貼簿，方便貼進 email)
    var copyBtn = $('copy-summary-btn');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      if (!state.result) return;
      UI.copyText(buildSummaryText(state.result));
    });

    // 篩選：部門 / 結案狀態
    if ($('filter-dept')) $('filter-dept').addEventListener('change', applyFilters);
    if ($('filter-close')) $('filter-close').addEventListener('change', applyFilters);

    // 還原上次匯入(若有)
    tryRestore();
  }

  /* 把關鍵指標整理成一段可讀文字(數字取自與指標卡相同來源) */
  function buildSummaryText(result) {
    var s = result.summary;
    var dept = (state.sheets && state.sheets[state.activeIdx]) ? state.sheets[state.activeIdx].name : '';
    var repairRate = (result.severityRepair && result.severityRepair.totals)
      ? Math.round(result.severityRepair.totals.rate * 1000) / 10 : 0;
    var today = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    var dateStr = today.getFullYear() + '/' + p(today.getMonth() + 1) + '/' + p(today.getDate());

    var lines = [];
    lines.push('【資安弱點指標摘要】' + (dept ? '（' + dept + '）' : '') + '　' + dateStr);
    lines.push('未結案 ' + U.num(s.total) + ' 筆；其中已逾期 ' + U.num(s.bands.overdue) +
               ' 筆、30 天內到期 ' + U.num(s.bands.d30) + ' 筆。');
    lines.push('高風險：Critical ' + U.num(s.critical) + ' 筆、High ' + U.num(s.high) + ' 筆。');
    lines.push('整體修復率：' + repairRate + '%。');
    return lines.join('\n');
  }

  /* -------- 檔案處理（多工作表） -------- */
  function handleFile(file) {
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
      UI.toast('請選擇 Excel 檔（.xlsx / .xls / .csv）', 'error');
      return;
    }
    if (typeof XLSX === 'undefined') {
      showError('試算表函式庫未載入。請確認 <b>assets/vendor/xlsx.full.min.js</b> 存在，然後重新整理（Ctrl+F5）。');
      UI.toast('函式庫未載入', 'error');
      return;
    }
    state.fileName = file.name;
    setLoading(true);
    hideError();

    readArrayBuffer(file).then(function (buf) {
      loadWorkbook(buf, file.name);
      saveWorkbook(buf, file.name);
      setLoading(false);
      UI.toast('解析完成：' + file.name + '（' + state.sheets.length + ' 張表）', 'success');
    }).catch(function (err) {
      setLoading(false);
      showError('解析失敗：' + U.esc(err && err.message || err));
      UI.toast('解析失敗', 'error');
    });
  }

  function readArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function (e) { resolve(e.target.result); };
      r.onerror = function () { reject(new Error('檔案讀取失敗（可能正被 Excel 鎖住，請先關閉）')); };
      r.readAsArrayBuffer(file);
    });
  }

  /* buf → 建各表 result、渲染左側導覽、選第一張 */
  function loadWorkbook(buf, fileName) {
    var sheets = global.Multi.buildAll(buf);
    if (!sheets.length) { showError('找不到「數字-」開頭的工作表。'); throw new Error('無數字工作表'); }
    state.sheets = sheets;
    state.fileName = fileName || state.fileName;
    if (state.activeIdx >= sheets.length) state.activeIdx = 0;
    renderSheetNav();
    selectSheet(state.activeIdx);
    showDashboard();
  }

  /* -------- 左側工作表導覽 -------- */
  function renderSheetNav() {
    var nav = $('sheet-nav');
    nav.innerHTML = '';
    state.sheets.forEach(function (s, i) {
      var item = U.el('button', {
        class: 'sheet-item' + (i === state.activeIdx ? ' active' : ''),
        title: s.name,
        onclick: (function (idx) { return function () { selectSheet(idx); saveActiveIdx(idx); }; })(i),
      }, [
        U.el('span', { class: 'sheet-name', text: s.name }),
        U.el('span', { class: 'sheet-count', text: U.num(s.result.summary.total) + ' 未結' }),
      ]);
      nav.appendChild(item);
    });
  }

  function selectSheet(i) {
    state.activeIdx = i;
    var s = state.sheets[i];
    // nav active
    var items = document.querySelectorAll('#sheet-nav .sheet-item');
    Array.prototype.forEach.call(items, function (el, idx) { el.classList.toggle('active', idx === i); });
    // 填部門選項 + 重設篩選為預設(全部部門 / 未結案)
    populateDeptOptions(s);
    if ($('filter-close')) $('filter-close').value = 'open';
    applyFilters();
  }

  /* 依目前選的表 + 兩個篩選，重算母體並重繪 */
  function applyFilters() {
    if (!state.sheets) return;
    var s = state.sheets[state.activeIdx];
    var deptSel = $('filter-dept') ? $('filter-dept').value : '__all__';
    var closeSel = $('filter-close') ? $('filter-close').value : 'open';
    var recs = s.records;
    var deptFiltered = (deptSel === '__all__') ? recs : recs.filter(function (r) { return (r.unit || '(未填)') === deptSel; });
    var scoped = (closeSel === 'all') ? deptFiltered : deptFiltered.filter(function (r) { return r.closeBucket === closeSel; });
    var result = global.Analysis.assembleResult(deptFiltered, scoped, { allCount: recs.length });
    result.caps = s.caps;
    state.result = result;
    renderResult(result, s.name, { dept: deptSel, close: closeSel, deptCount: deptFiltered.length });
  }

  function populateDeptOptions(s) {
    var sel = $('filter-dept'); if (!sel) return;
    sel.innerHTML = '';
    var units = {};
    s.records.forEach(function (r) { var u = r.unit || '(未填)'; units[u] = (units[u] || 0) + 1; });
    var all = document.createElement('option');
    all.value = '__all__'; all.textContent = '全部部門 (' + s.records.length + ')';
    sel.appendChild(all);
    Object.keys(units).sort().forEach(function (u) {
      var o = document.createElement('option'); o.value = u; o.textContent = u + ' (' + units[u] + ')'; sel.appendChild(o);
    });
    sel.value = '__all__';
  }

  function renderResult(result, sheetName, opts) {
    opts = opts || {};
    var caps = result.caps || {};
    // 面板自適應：無例外/展延 → 隱藏「例外/展延統計」分頁
    var statsBtn = document.querySelector('.tab-btn[data-tab="stats"]');
    if (statsBtn) {
      statsBtn.style.display = caps.stagePanel === false ? 'none' : '';
      if (caps.stagePanel === false && statsBtn.classList.contains('active')) switchTab('dashboard');
    }
    $('file-name-tag').textContent = state.fileName + '　(工作表：' + sheetName + ')';
    renderQuality(result);
    global.Dashboard.render(result);
    global.Tracking.render(result);
    global.Stats.render(result);
    global.Search.render(result);
    // scope-info 反映目前篩選
    var deptLabel = (opts.dept && opts.dept !== '__all__') ? opts.dept : '全部部門';
    var closeLabel = { open: '未結案', closed: '已結案', all: '全部狀態' }[opts.close || 'open'];
    var scope = $('scope-info');
    scope.innerHTML = '';
    scope.appendChild(U.el('span', { html:
      '<b>' + U.esc(sheetName) + '</b>　·　部門：<b>' + U.esc(deptLabel) + '</b>　·　狀態：<b>' + closeLabel +
      '</b>　|　顯示 <b>' + U.num(result.summary.total) + '</b> 筆（該部門全部 ' + U.num(opts.deptCount != null ? opts.deptCount : result.allCount) + ' 筆）' }));
    if ($('copy-summary-btn')) $('copy-summary-btn').disabled = !state.result;
  }

  /* -------- 記住上次匯入(localStorage：存整份檔 base64 + 目前選的表) -------- */
  var STORAGE_KEY = 'vulnDashboard.v2';

  function abToB64(buf) {
    var bytes = new Uint8Array(buf), bin = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  function b64ToAb(b64) {
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function saveWorkbook(buf, fileName) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: 2, b64: abToB64(buf), fileName: fileName,
        activeIdx: state.activeIdx, savedAt: new Date().toISOString(),
      }));
    } catch (e) {
      UI.toast('檔案較大，未能記住（下次需重新匯入）', 'error');
    }
  }
  function saveActiveIdx(i) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY); if (!raw) return;
      var p = JSON.parse(raw); p.activeIdx = i; localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch (e) {}
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      return (p && p.b64) ? p : null;
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
      state.activeIdx = saved.activeIdx || 0;
      loadWorkbook(b64ToAb(saved.b64), saved.fileName);
      var when = fmtSavedAt(saved.savedAt);
      UI.toast('已還原上次匯入：' + (saved.fileName || '') + (when ? '（' + when + '）' : ''), 'success');
    } catch (e) {
      clearState(); // 還原失敗就清掉，回到上傳畫面
    }
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
    if ($('copy-summary-btn')) $('copy-summary-btn').disabled = !state.result;
    switchTab('dashboard');
  }
  function resetToUpload() {
    state.result = null;
    state.sheets = null;
    state.activeIdx = 0;
    if ($('sheet-nav')) $('sheet-nav').innerHTML = '';
    global.Dashboard.destroyCharts();
    global.Stats.destroyCharts();
    $('main-content').classList.add('hidden');
    $('upload-section').classList.remove('hidden');
    $('reload-btn').classList.add('hidden');
    if ($('clear-btn')) $('clear-btn').classList.add('hidden');
    if ($('copy-summary-btn')) $('copy-summary-btn').disabled = true;
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
