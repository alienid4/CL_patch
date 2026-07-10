/* ============================================================
 * js/matrix.js
 * 交叉分析：嚴重度 × 到期時間帶 矩陣 + 逐層點選過濾(cross-filter)。
 *   - 點矩陣格：同時鎖「該嚴重度 + 該時間帶」
 *   - 點列首(嚴重度)：只鎖嚴重度；點欄首(時間帶)：只鎖時間帶
 *   - 兩個分類各自可點，逐層縮小，最後直接看/匯出清單
 * 母體 = 目前分頁的 result.records(已套用部門 + 結案狀態篩選)。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var UI = global.UI;
  var A = global.Analysis;

  var SEV_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Info', 'Unknown'];

  var records = [];        // 目前母體
  var title = '交叉分析';   // drill-down / 匯出標題用
  var state = { sev: null, band: null };

  function sevKey(r) { return r.severity || 'Unknown'; }

  /* 資料中實際出現的嚴重度(依標準順序) */
  function presentSevs() {
    var set = {};
    records.forEach(function (r) { set[sevKey(r)] = 1; });
    return SEV_ORDER.filter(function (s) { return set[s]; });
  }

  /* 目前篩選下符合的紀錄 */
  function filtered() {
    return records.filter(function (r) {
      if (state.sev && sevKey(r) !== state.sev) return false;
      if (state.band && A.bandOf(r) !== state.band) return false;
      return true;
    });
  }

  /* grid[sev][bandKey] = 筆數(整份母體，不受目前篩選影響，維持全貌可讀) */
  function grid(sevs) {
    var g = {};
    sevs.forEach(function (s) {
      g[s] = { _total: 0 };
      A.BANDS.forEach(function (b) { g[s][b.key] = 0; });
    });
    records.forEach(function (r) {
      var s = sevKey(r);
      if (!g[s]) return;
      g[s][A.bandOf(r)]++; g[s]._total++;
    });
    return g;
  }

  function render(result) {
    var host = document.getElementById('matrix-body');
    if (!host) return;
    records = (result && result.records) || [];
    state = { sev: null, band: null };   // 換表/換篩選 → 重置
    draw();
  }

  function draw() {
    var host = document.getElementById('matrix-body');
    host.innerHTML = '';

    var sevs = presentSevs();
    if (!records.length || !sevs.length) {
      host.appendChild(U.el('p', { class: 'empty-hint', text: '目前母體無資料可交叉。' }));
      return;
    }
    var g = grid(sevs);
    var bandTotals = {}; A.BANDS.forEach(function (b) { bandTotals[b.key] = 0; });
    var grand = 0;
    sevs.forEach(function (s) {
      A.BANDS.forEach(function (b) { bandTotals[b.key] += g[s][b.key]; });
      grand += g[s]._total;
    });

    host.appendChild(buildConditionBar());
    host.appendChild(buildMatrix(sevs, g, bandTotals, grand));
    host.appendChild(buildResult());
  }

  /* -------- 目前條件列 -------- */
  function buildConditionBar() {
    var bar = U.el('div', { class: 'xf-condition' });
    var tags = [];
    if (state.sev) tags.push(state.sev);
    if (state.band) tags.push(bandLabel(state.band));
    var txt = tags.length ? tags.join('　×　') : '未套用篩選（顯示全部）';
    bar.appendChild(U.el('span', { class: 'xf-cond-label', text: '目前條件' }));
    bar.appendChild(U.el('span', { class: 'xf-cond-val' + (tags.length ? ' on' : ''), text: txt }));
    if (tags.length) {
      bar.appendChild(U.el('button', {
        class: 'btn btn-secondary btn-sm', text: '清除篩選',
        onclick: function () { state = { sev: null, band: null }; draw(); },
      }));
    }
    return bar;
  }

  function bandLabel(key) {
    var b = A.BANDS.filter(function (x) { return x.key === key; })[0];
    return b ? b.label : key;
  }

  /* -------- 矩陣(嚴重度 × 到期時間帶) -------- */
  function buildMatrix(sevs, g, bandTotals, grand) {
    var wrap = U.el('div', { class: 'xf-matrix-wrap' });
    var table = U.el('table', { class: 'matrix-table xf-matrix' });

    // 表頭：嚴重度＼到期 | 各時間帶 | 合計
    var thead = U.el('thead');
    var htr = U.el('tr');
    htr.appendChild(U.el('th', { class: 'xf-corner', text: '嚴重度＼到期' }));
    A.BANDS.forEach(function (b) {
      htr.appendChild(U.el('th', {
        class: 'xf-col-head' + (state.band === b.key ? ' col-on' : ''),
        title: '只看「' + b.label + '」',
        text: b.label,
        onclick: function () { toggle('band', b.key); },
      }));
    });
    htr.appendChild(U.el('th', { class: 'xf-col-total', text: '合計' }));
    thead.appendChild(htr);
    table.appendChild(thead);

    // 資料列：每個嚴重度
    var tbody = U.el('tbody');
    sevs.forEach(function (s) {
      var tr = U.el('tr', { class: state.sev === s ? 'row-on' : '' });
      // 列首：嚴重度(可點，只鎖嚴重度)
      var rowHead = U.el('th', {
        class: 'xf-row-head' + (state.sev === s ? ' row-on' : ''),
        title: '只看「' + s + '」',
        onclick: function () { toggle('sev', s); },
      }, [U.el('span', { class: 'sev-badge sev-' + s, text: s })]);
      tr.appendChild(rowHead);
      // 各時間帶格
      A.BANDS.forEach(function (b) {
        var n = g[s][b.key];
        var active = (!state.sev || state.sev === s) && (!state.band || state.band === b.key);
        var picked = state.sev === s && state.band === b.key;
        var td = U.el('td', {
          class: 'xf-cell' + (n ? ' has' : ' zero') + (picked ? ' picked' : '') + (active ? '' : ' dim'),
        });
        if (n) {
          td.appendChild(U.el('span', {
            class: 'num-cell clickable' + (b.key === 'overdue' ? ' has-overdue' : ''),
            text: U.num(n),
            title: s + ' × ' + b.label + '：' + n + ' 筆',
            onclick: function () { pickCell(s, b.key); },
          }));
        } else {
          td.appendChild(U.el('span', { class: 'xf-zero', text: '·' }));
        }
        tr.appendChild(td);
      });
      // 列合計
      tr.appendChild(U.el('td', { class: 'total-cell', text: U.num(g[s]._total) }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // 合計列
    var tfoot = U.el('tfoot');
    var ftr = U.el('tr', { class: 'total-row' });
    ftr.appendChild(U.el('th', { class: 'xf-row-head', text: '合計' }));
    A.BANDS.forEach(function (b) {
      ftr.appendChild(U.el('td', { class: 'total-cell', text: U.num(bandTotals[b.key]) }));
    });
    ftr.appendChild(U.el('td', { class: 'total-cell', text: U.num(grand) }));
    tfoot.appendChild(ftr);
    table.appendChild(tfoot);

    wrap.appendChild(table);
    wrap.appendChild(U.el('p', { class: 'xf-hint', text: '點格子＝同時鎖「該嚴重度＋該時間帶」；點嚴重度列首或到期欄首＝只鎖一個維度；再點一次取消。' }));
    return wrap;
  }

  /* -------- 篩選結果清單 -------- */
  function buildResult() {
    var recs = filtered();
    var box = U.el('div', { class: 'xf-result' });

    var head = U.el('div', { class: 'xf-result-head' });
    head.appendChild(U.el('strong', { text: '符合 ' + U.num(recs.length) + ' 筆' }));
    var acts = U.el('div', { class: 'reminder-actions' });
    acts.appendChild(U.el('button', {
      class: 'btn btn-secondary btn-sm', text: '另開新分頁',
      onclick: function () { UI.popOutTable(resultTitle(), recs); },
    }));
    acts.appendChild(U.el('button', {
      class: 'btn btn-secondary btn-sm', text: '匯出此清單 (CSV)',
      onclick: function () { UI.exportCSV(recs, resultTitle()); },
    }));
    head.appendChild(acts);
    box.appendChild(head);

    box.appendChild(UI.buildDetailTable(recs));
    return box;
  }

  function resultTitle() {
    var tags = [];
    if (state.sev) tags.push(state.sev);
    if (state.band) tags.push(bandLabel(state.band));
    return title + (tags.length ? '（' + tags.join(' × ') + '）' : '（全部）');
  }

  /* -------- 互動 -------- */
  function toggle(dim, val) {
    state[dim] = state[dim] === val ? null : val;
    draw();
  }
  function pickCell(sev, bandKey) {
    var same = state.sev === sev && state.band === bandKey;
    state.sev = same ? null : sev;
    state.band = same ? null : bandKey;
    draw();
  }

  global.Matrix = { render: render };
})(window);
