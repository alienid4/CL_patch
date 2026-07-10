/* ============================================================
 * js/main.js
 * 主控：檔案上傳/拖放、解析、驅動分頁渲染、分頁切換、錯誤提示。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var UI = global.UI;

  var state = { result: null, fileName: '', sheets: null, activeIdx: 0, mode: 'summary', myDept: '__all__', closeStatus: 'open' };

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

    // 「其他功能」下拉選單
    function closeMore() { var d = $('more-dropdown'); if (d) d.classList.add('hidden'); }
    if ($('more-btn')) $('more-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      $('more-dropdown').classList.toggle('hidden');
    });
    document.addEventListener('click', function (e) {
      var d = $('more-dropdown'), b = $('more-btn');
      if (d && !d.classList.contains('hidden') && !d.contains(e.target) && e.target !== b) closeMore();
    });

    // 換一個檔案(保留記憶，匯入新檔才覆蓋)
    $('reload-btn').addEventListener('click', function () {
      closeMore();
      $('file-input').value = '';
      resetToUpload();
    });
    // 清除記憶(移除 localStorage 並回上傳畫面)
    var clearBtn = $('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      closeMore();
      clearState();
      $('file-input').value = '';
      resetToUpload();
      UI.toast('已清除暫存資料', 'success');
    });

    // 載入內建範例資料（天龍八部）— 一鍵載入，免選檔（選單 + 上傳頁兩處都可）
    function loadSample() {
      closeMore();
      if (!global.SAMPLE_XLSX_B64) { UI.toast('找不到內建範例資料', 'error'); return; }
      try {
        setLoading(true);
        hideError();
        var buf = b64ToAb(global.SAMPLE_XLSX_B64);
        state.fileName = global.SAMPLE_XLSX_NAME || '範例資料.xlsx';
        loadWorkbook(buf, state.fileName);
        saveWorkbook(buf, state.fileName);
        setLoading(false);
        UI.toast('已載入範例資料（' + state.sheets.length + ' 張表）', 'success');
      } catch (e) {
        setLoading(false);
        showError('載入範例資料失敗：' + U.esc(e && e.message || e));
        UI.toast('載入失敗', 'error');
      }
    }
    if ($('sample-btn')) $('sample-btn').addEventListener('click', loadSample);
    if ($('sample-btn-2')) $('sample-btn-2').addEventListener('click', loadSample);

    // 複製指標摘要(整理成一段可讀文字 → 剪貼簿，方便貼進 email)
    var copyBtn = $('copy-summary-btn');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      closeMore();
      if (!state.result) return;
      UI.copyText(buildSummaryText(state.result));
    });

    // 記住「我的部門」與「結案狀態」(全域，下次進來預設)
    state.myDept = loadMyDept();
    state.closeStatus = loadCloseStatus();

    // 常駐查詢框（若在總覽，先進入目前項目再查）
    if ($('global-search-input')) $('global-search-input').addEventListener('input', function () {
      if (state.mode === 'summary' && state.sheets) selectSheet(state.activeIdx);
      global.Search.onInput();
    });
    if ($('global-search-clear')) $('global-search-clear').addEventListener('click', function () { global.Search.clear(); });

    // 還原上次匯入(若有)
    tryRestore();
  }

  function todayStr() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate());
  }

  /* 把關鍵指標整理成一段可讀文字(數字取自與指標卡相同來源) */
  function buildSummaryText(result) {
    // 總覽模式：全部項目彙總
    if (state.mode === 'summary' && state.sheets && global.Summary) {
      var o = global.Summary.overall(state.sheets, state.myDept);
      var t = o.totals;
      var hot = o.rows.filter(function (r) { return r.overdue > 0; })
        .sort(function (a, b) { return b.overdue - a.overdue; }).slice(0, 5)
        .map(function (r) { return r.name + '（逾期 ' + r.overdue + '）'; });
      var L = [];
      L.push('【弱點追蹤總覽】　' + todayStr());
      L.push('全部 ' + state.sheets.length + ' 個項目：未結案 ' + U.num(t.open) + ' 筆、已逾期 ' + U.num(t.overdue) +
             ' 筆、近期到期 ' + U.num(t.soon) + ' 筆、高風險未結 ' + U.num(t.high) + ' 筆，整體結案率 ' + t.rate + '%。');
      if (hot.length) L.push('逾期集中：' + hot.join('、') + '。');
      return L.join('\n');
    }
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
    lines.push('整體結案率：' + repairRate + '%。');
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

  /* buf → 建各表 result、渲染左側導覽、預設落在「總覽」首頁 */
  function loadWorkbook(buf, fileName) {
    var sheets = global.Multi.buildAll(buf);
    if (!sheets.length) { showError('找不到「數字-」開頭的工作表。'); throw new Error('無數字工作表'); }
    state.sheets = sheets;
    state.fileName = fileName || state.fileName;
    if (state.activeIdx >= sheets.length) state.activeIdx = 0;
    state.result = sheets[state.activeIdx].result;   // 供查詢/複製摘要有預設對象
    renderSheetNav();
    showDashboard();
    showSummary();                                   // 主管首頁：預設看總覽
  }

  /* -------- 左側導覽：總覽 + 各項目 -------- */
  /* 所有工作表出現過的部門(去重、排序) */
  function allDepartments(sheets) {
    var set = {};
    (sheets || []).forEach(function (s) {
      (s.records || []).forEach(function (r) { set[r.unit || '(未填)'] = 1; });
    });
    return Object.keys(set).sort();
  }
  /* 某表在指定部門 + 結案狀態下的筆數 */
  function deptCount(s, dept, close) {
    return (s.records || []).filter(function (r) {
      var okDept = (dept === '__all__' || (r.unit || '(未填)') === dept);
      var okClose = (close === 'all') || (r.closeBucket === close);
      return okDept && okClose;
    }).length;
  }
  var CLOSE_LABELS = { open: '未結', closed: '已結', all: '筆' };

  function renderSheetNav() {
    var nav = $('sheet-nav');
    nav.innerHTML = '';

    // 部門選擇器(全站；記住的部門若此檔沒有則退回全部)
    var depts = allDepartments(state.sheets);
    if (state.myDept !== '__all__' && depts.indexOf(state.myDept) < 0) state.myDept = '__all__';
    var sel = U.el('select', { class: 'dept-select', id: 'my-dept-select' });
    var oAll = document.createElement('option'); oAll.value = '__all__'; oAll.textContent = '全部部門'; sel.appendChild(oAll);
    depts.forEach(function (u) { var o = document.createElement('option'); o.value = u; o.textContent = u; sel.appendChild(o); });
    sel.value = state.myDept;
    sel.addEventListener('change', function () { setMyDept(sel.value); });
    nav.appendChild(U.el('div', { class: 'dept-picker' }, [
      U.el('span', { class: 'dept-picker-label', text: '部門' }), sel,
    ]));

    // 結案狀態選擇器(全站，接在部門下面)
    var csel = U.el('select', { class: 'dept-select', id: 'my-close-select' });
    [['open', '未結案'], ['closed', '已結案'], ['all', '全部']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; csel.appendChild(op);
    });
    csel.value = state.closeStatus;
    csel.addEventListener('change', function () { setCloseStatus(csel.value); });
    nav.appendChild(U.el('div', { class: 'dept-picker close-picker' }, [
      U.el('span', { class: 'dept-picker-label', text: '結案狀態' }), csel,
    ]));

    // 總覽置頂
    nav.appendChild(U.el('button', {
      class: 'sheet-item nav-summary' + (state.mode === 'summary' ? ' active' : ''),
      onclick: showSummary,
    }, [U.el('span', { class: 'sheet-name', text: '總覽' })]));

    // 各項目(未結數依目前部門)
    state.sheets.forEach(function (s, i) {
      var item = U.el('button', {
        class: 'sheet-item' + (state.mode === 'sheet' && i === state.activeIdx ? ' active' : ''),
        title: s.name,
        onclick: (function (idx) { return function () { selectSheet(idx); saveActiveIdx(idx); }; })(i),
      }, [
        U.el('span', { class: 'sheet-name', text: s.name }),
        U.el('span', { class: 'sheet-count', text: U.num(deptCount(s, state.myDept, state.closeStatus)) + ' ' + CLOSE_LABELS[state.closeStatus] }),
      ]);
      nav.appendChild(item);
    });
  }

  /* 切換「我的部門」：記住、重繪導覽與目前畫面 */
  function setMyDept(v) {
    state.myDept = v;
    saveMyDept(v);
    renderSheetNav();
    if (state.mode === 'summary') showSummary();
    else applyFilters();
  }

  /* 切換「結案狀態」(全站)：記住、重繪導覽計數與目前畫面 */
  function setCloseStatus(v) {
    state.closeStatus = v;
    saveCloseStatus(v);
    renderSheetNav();
    if (state.mode === 'sheet') applyFilters();
  }

  function setNavActive() {
    var nav = $('sheet-nav'); if (!nav) return;
    var sum = nav.querySelector('.nav-summary');
    if (sum) sum.classList.toggle('active', state.mode === 'summary');
    var sheetItems = nav.querySelectorAll('.sheet-item:not(.nav-summary)');
    Array.prototype.forEach.call(sheetItems, function (el, idx) {
      el.classList.toggle('active', state.mode === 'sheet' && idx === state.activeIdx);
    });
  }

  /* 顯示總覽首頁 */
  function showSummary() {
    state.mode = 'summary';
    $('summary-view').classList.remove('hidden');
    $('sheet-view').classList.add('hidden');
    setNavActive();
    global.Summary.render(state.sheets, function (i) { selectSheet(i); saveActiveIdx(i); }, state.myDept);
    if ($('file-name-tag')) $('file-name-tag').textContent = state.fileName + '　(總覽)';
    if ($('copy-summary-btn')) $('copy-summary-btn').disabled = !state.sheets;
  }

  /* 進入某項目(工作表)細項 */
  function selectSheet(i) {
    state.mode = 'sheet';
    state.activeIdx = i;
    var s = state.sheets[i];
    global.Summary.destroyChart();
    $('summary-view').classList.add('hidden');
    $('sheet-view').classList.remove('hidden');
    setNavActive();
    // 部門與結案狀態沿用左側全站設定(不重設)
    applyFilters();
  }

  /* 依目前選的表 + 兩個篩選，重算母體並重繪 */
  function applyFilters() {
    if (!state.sheets) return;
    var s = state.sheets[state.activeIdx];
    var deptSel = state.myDept || '__all__';
    var closeSel = state.closeStatus || 'open';
    var recs = s.records;
    var deptFiltered = (deptSel === '__all__') ? recs : recs.filter(function (r) { return (r.unit || '(未填)') === deptSel; });
    var scoped = (closeSel === 'all') ? deptFiltered : deptFiltered.filter(function (r) { return r.closeBucket === closeSel; });
    var result = global.Analysis.assembleResult(deptFiltered, scoped, { allCount: recs.length });
    result.caps = s.caps;
    state.result = result;
    renderResult(result, s.name, { dept: deptSel, close: closeSel, deptCount: deptFiltered.length });
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
    // 面板自適應：無嚴重度欄 → 隱藏「交叉分析」分頁(嚴重度軸無意義)
    var matrixBtn = document.querySelector('.tab-btn[data-tab="matrix"]');
    if (matrixBtn) {
      matrixBtn.style.display = caps.severity === false ? 'none' : '';
      if (caps.severity === false && matrixBtn.classList.contains('active')) switchTab('dashboard');
    }
    $('file-name-tag').textContent = state.fileName + '　(工作表：' + sheetName + ')';
    renderQuality(result);
    global.Dashboard.render(result);
    global.Tracking.render(result);
    global.Matrix.render(result);
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

  /* 「我的部門」記憶(獨立於檔案，跨檔沿用) */
  var DEPT_KEY = 'vulnDashboard.dept';
  function loadMyDept() { try { return localStorage.getItem(DEPT_KEY) || '__all__'; } catch (e) { return '__all__'; } }
  function saveMyDept(v) { try { localStorage.setItem(DEPT_KEY, v); } catch (e) {} }

  /* 「結案狀態」記憶(全站，跨檔沿用) */
  var CLOSE_KEY = 'vulnDashboard.close';
  function loadCloseStatus() { try { var v = localStorage.getItem(CLOSE_KEY); return (v === 'closed' || v === 'all') ? v : 'open'; } catch (e) { return 'open'; } }
  function saveCloseStatus(v) { try { localStorage.setItem(CLOSE_KEY, v); } catch (e) {} }

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
    if ($('more-btn')) $('more-btn').classList.remove('hidden');
    if ($('header-search')) $('header-search').classList.remove('hidden');
    if ($('copy-summary-btn')) $('copy-summary-btn').disabled = !state.result;
    switchTab('dashboard');
  }
  function resetToUpload() {
    state.result = null;
    state.sheets = null;
    state.activeIdx = 0;
    state.mode = 'summary';
    if ($('sheet-nav')) $('sheet-nav').innerHTML = '';
    if ($('summary-view')) $('summary-view').innerHTML = '';
    global.Summary.destroyChart();
    global.Dashboard.destroyCharts();
    global.Stats.destroyCharts();
    $('main-content').classList.add('hidden');
    $('upload-section').classList.remove('hidden');
    if ($('more-btn')) $('more-btn').classList.add('hidden');
    if ($('header-search')) $('header-search').classList.add('hidden');
    if ($('more-dropdown')) $('more-dropdown').classList.add('hidden');
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
