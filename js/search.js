/* ============================================================
 * js/search.js
 * TAB「查詢」：全文搜尋 + 快速篩選（可查某人所有 CASE、未來六個月到期…）。
 * 結果用可排序明細表呈現，可匯出 / 另開新分頁。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var UI = global.UI;

  var state = { result: null, activeKey: 'all', text: '' };

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

  function render(result) {
    state.result = result;
    var box = document.getElementById('search-body');
    if (!box) return;
    box.innerHTML = '';

    /* 搜尋列 */
    var input = U.el('input', {
      type: 'search', class: 'search-input',
      placeholder: '輸入關鍵字（可空格分隔多字）：負責人／主機／弱點名稱／Plugin ID…',
      value: state.text,
    });
    input.addEventListener('input', function () { state.text = input.value; run(); });
    var clearBtn = U.el('button', { class: 'btn btn-secondary btn-sm', text: '清除',
      onclick: function () { state.text = ''; input.value = ''; state.activeKey = 'all'; syncChips(); run(); } });
    box.appendChild(U.el('div', { class: 'search-bar' }, [input, clearBtn]));

    /* 快速篩選 chips */
    var chipWrap = U.el('div', { class: 'search-chips' });
    var chipEls = {};
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

    function syncChips() {
      Object.keys(chipEls).forEach(function (k) {
        chipEls[k].classList.toggle('active', k === state.activeKey);
      });
    }

    /* 結果區 */
    var results = U.el('div', { id: 'search-results', class: 'search-results' });
    box.appendChild(results);

    function run() {
      var Filters = global.Analysis.Filters;
      var records = state.result.records;
      var fFn = Filters[state.activeKey] || function () { return true; };
      var terms = state.text.trim().toLowerCase().split(/\s+/).filter(Boolean);

      var list = records.filter(fFn).filter(function (r) {
        if (!terms.length) return true;
        var t = recordText(r);
        return terms.every(function (term) { return t.indexOf(term) >= 0; });
      });

      results.innerHTML = '';
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
      results.appendChild(bar);
      results.appendChild(UI.buildDetailTable(list));
    }

    function labelOf(key) {
      for (var i = 0; i < QUICK.length; i++) if (QUICK[i].key === key) return QUICK[i].label;
      return key;
    }

    run();
  }

  global.Search = { render: render };
})(window);
