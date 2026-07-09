/* ============================================================
 * js/search.js
 * 查詢：全文搜尋 + 快速篩選。搜尋框常駐於分頁上方(首頁明顯處)，
 * 快速篩選與結果顯示於「查詢」分頁。結果可排序、匯出、另開新分頁。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var UI = global.UI;

  var state = { result: null, activeKey: 'all' };
  var chipEls = {};
  var resultsEl = null;

  /* 快速篩選定義：對應 Analysis.Filters */
  var QUICK = [
    { key: 'all',            label: '全部' },
    { key: 'overdue',        label: '已逾期' },
    { key: 'soon',           label: '近期到期' },
    { key: 'todayTrack',     label: '今日待追蹤' },
    { key: 'sixMonths',      label: '六個月到期' },
    { key: 'critical',       label: 'Critical' },
    { key: 'high',           label: 'High' },
    { key: 'medium',         label: 'Medium' },
    { key: 'stageException', label: '例外管理中' },
    { key: 'stageExtension', label: '首次展延中' },
    { key: 'safeException',  label: '例外核准未到期' },
    { key: 'chronic',        label: '反覆展延／例外' },
  ];

  /* 把一筆紀錄攤平成可搜尋字串 */
  function recordText(r) {
    return [
      r.host, r.owner, r.name, r.pluginId, r.risk, r.severity,
      r.systemCategory, r.assetName, r.protocol, r.port, r.year,
      U.fmtDate(r.fixDeadline), U.fmtDate(r.firstExtension),
      U.fmtDate(r.exceptionApproval), U.fmtDate(r.realDue),
    ].join(' ').toLowerCase();
  }

  function getInput() { return document.getElementById('global-search-input'); }
  function labelOf(key) {
    for (var i = 0; i < QUICK.length; i++) if (QUICK[i].key === key) return QUICK[i].label;
    return key;
  }

  /* 建立「查詢」分頁內容：快速篩選 chips + 結果區（搜尋框在分頁外，常駐） */
  function render(result) {
    state.result = result;
    var box = document.getElementById('search-body');
    if (!box) return;
    box.innerHTML = '';

    var chipWrap = U.el('div', { class: 'search-chips' });
    chipEls = {};
    QUICK.forEach(function (q) {
      var chip = U.el('button', {
        class: 'search-chip' + (q.key === state.activeKey ? ' active' : ''),
        text: q.label,
        onclick: function () { state.activeKey = q.key; syncChips(); run(); },
      });
      chipEls[q.key] = chip;
      chipWrap.appendChild(chip);
    });
    box.appendChild(chipWrap);

    resultsEl = U.el('div', { id: 'search-results', class: 'search-results' });
    box.appendChild(resultsEl);

    run();
  }

  function syncChips() {
    Object.keys(chipEls).forEach(function (k) {
      chipEls[k].classList.toggle('active', k === state.activeKey);
    });
  }

  function run() {
    if (!state.result || !resultsEl) return;
    var input = getInput();
    var text = input ? input.value : '';
    var Filters = global.Analysis.Filters;
    var records = state.result.records;
    var fFn = Filters[state.activeKey] || function () { return true; };
    var terms = text.trim().toLowerCase().split(/\s+/).filter(Boolean);

    var list = records.filter(fFn).filter(function (r) {
      if (!terms.length) return true;
      var t = recordText(r);
      return terms.every(function (term) { return t.indexOf(term) >= 0; });
    });

    resultsEl.innerHTML = '';
    var title = '查詢結果' +
      (state.activeKey !== 'all' ? '（' + labelOf(state.activeKey) + '）' : '') +
      (terms.length ? '（關鍵字：' + terms.join(' ') + '）' : '');
    var bar = U.el('div', { class: 'search-resultbar' }, [
      U.el('span', { class: 'search-count', text: '共 ' + list.length + ' 筆' }),
      U.el('button', { class: 'btn btn-secondary btn-sm', text: '另開新分頁',
        onclick: function () { UI.popOutTable(title, list); }, disabled: list.length ? null : 'disabled' }),
      U.el('button', { class: 'btn btn-secondary btn-sm', text: '匯出 CSV',
        onclick: function () { UI.exportCSV(list, title); }, disabled: list.length ? null : 'disabled' }),
    ]);
    resultsEl.appendChild(bar);
    resultsEl.appendChild(UI.buildDetailTable(list));
  }

  /* 全域搜尋框輸入：有關鍵字就切到「查詢」分頁並執行 */
  function onInput() {
    var input = getInput();
    var txt = input ? input.value.trim() : '';
    var tab = document.getElementById('tab-search');
    if (txt && tab && !tab.classList.contains('active')) {
      var btn = document.querySelector('.tab-btn[data-tab="search"]');
      if (btn) btn.click();
    }
    run();
  }

  function clear() {
    var input = getInput(); if (input) input.value = '';
    state.activeKey = 'all';
    syncChips();
    run();
  }

  global.Search = { render: render, onInput: onInput, clear: clear };
})(window);
