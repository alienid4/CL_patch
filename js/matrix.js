/* ============================================================
 * js/matrix.js
 * 交叉分析（真漏斗 cross-filter）：多維度逐層過濾。
 *   維度：嚴重度、到期時間帶（用矩陣呈現 + 可點）、部門、負責人（用 facet chips）。
 *   任一維度點下去 → 其餘所有維度的數字(含矩陣格、facet 計數、清單)即時重算，
 *   一路疊點縮小到最後想看的清單。再點同一項＝取消。
 * 母體 = 目前分頁的 result.records（已套用左側部門 + 結案狀態篩選；預設未結案）。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var UI = global.UI;
  var A = global.Analysis;

  var SEV_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Info', 'Unknown'];

  // 維度取值函式
  var DIMS = {
    sev:   function (r) { return r.severity || 'Unknown'; },
    band:  function (r) { return A.bandOf(r); },
    dept:  function (r) { return r.unit || r.department || '(未填)'; },
    owner: function (r) { return r.owner || '(未指定)'; },
  };

  var base = [];                                   // 母體
  var title = '交叉分析';
  var state = { sev: null, band: null, dept: null, owner: null };

  /* 除了 exceptKeys 以外的所有已選維度都要符合 */
  function matchesExcept(r, exceptKeys) {
    for (var k in state) {
      if (state[k] === null) continue;
      if (exceptKeys.indexOf(k) >= 0) continue;
      if (DIMS[k](r) !== state[k]) return false;
    }
    return true;
  }
  function filtered() { return base.filter(function (r) { return matchesExcept(r, []); }); }

  /* 供矩陣用：套用「非 sev/band」的維度後的紀錄(矩陣自己拆 sev×band) */
  function matrixRecords() { return base.filter(function (r) { return matchesExcept(r, ['sev', 'band']); }); }

  function render(result) {
    var host = document.getElementById('matrix-body');
    if (!host) return;
    base = (result && result.records) || [];
    state = { sev: null, band: null, dept: null, owner: null };  // 換表/換篩選 → 重置
    draw();
  }

  function draw() {
    var host = document.getElementById('matrix-body');
    host.innerHTML = '';
    if (!base.length) {
      host.appendChild(U.el('p', { class: 'empty-hint', text: '目前母體無資料可交叉。' }));
      return;
    }
    host.appendChild(buildConditionBar());
    host.appendChild(buildMatrix());
    host.appendChild(buildFacets());
    host.appendChild(buildResult());
  }

  function bandLabel(key) {
    var b = A.BANDS.filter(function (x) { return x.key === key; })[0];
    return b ? b.label : key;
  }

  /* -------- 目前條件列 -------- */
  var COND_ORDER = [
    { key: 'sev', name: '嚴重度' },
    { key: 'band', name: '到期', fmt: bandLabel },
    { key: 'dept', name: '部門' },
    { key: 'owner', name: '負責人' },
  ];
  function buildConditionBar() {
    var bar = U.el('div', { class: 'xf-condition' });
    bar.appendChild(U.el('span', { class: 'xf-cond-label', text: '目前條件' }));
    var tags = COND_ORDER.filter(function (d) { return state[d.key] !== null; });
    if (!tags.length) {
      bar.appendChild(U.el('span', { class: 'xf-cond-val', text: '未套用篩選（顯示全部）' }));
    } else {
      tags.forEach(function (d) {
        var val = d.fmt ? d.fmt(state[d.key]) : state[d.key];
        bar.appendChild(U.el('button', {
          class: 'xf-cond-tag', title: '移除此條件',
          html: '<b>' + U.esc(d.name) + '</b>：' + U.esc(val) + ' ✕',
          onclick: (function (k) { return function () { state[k] = null; draw(); }; })(d.key),
        }));
      });
      bar.appendChild(U.el('button', {
        class: 'btn btn-secondary btn-sm', text: '清除全部',
        onclick: function () { state = { sev: null, band: null, dept: null, owner: null }; draw(); },
      }));
    }
    return bar;
  }

  /* -------- 矩陣：嚴重度 × 到期時間帶（依 dept/owner 篩選後重算） -------- */
  function buildMatrix() {
    var recs = matrixRecords();
    var set = {}; recs.forEach(function (r) { set[DIMS.sev(r)] = 1; });
    var sevs = SEV_ORDER.filter(function (s) { return set[s]; });
    // 目前若已選 sev 但被 dept/owner 篩掉，仍保留該列可見(以便取消)
    if (state.sev && sevs.indexOf(state.sev) < 0) sevs.push(state.sev);

    var g = {}, bandTotals = {}, grand = 0;
    A.BANDS.forEach(function (b) { bandTotals[b.key] = 0; });
    sevs.forEach(function (s) { g[s] = { _t: 0 }; A.BANDS.forEach(function (b) { g[s][b.key] = 0; }); });
    recs.forEach(function (r) {
      var s = DIMS.sev(r); if (!g[s]) return;
      var bk = DIMS.band(r); g[s][bk]++; g[s]._t++; bandTotals[bk]++; grand++;
    });

    var wrap = U.el('div', { class: 'xf-matrix-wrap' });
    var table = U.el('table', { class: 'matrix-table xf-matrix' });

    var thead = U.el('thead'), htr = U.el('tr');
    htr.appendChild(U.el('th', { class: 'xf-corner', text: '嚴重度＼到期' }));
    A.BANDS.forEach(function (b) {
      htr.appendChild(U.el('th', {
        class: 'xf-col-head' + (state.band === b.key ? ' col-on' : ''),
        title: '只看「' + b.label + '」', text: b.label,
        onclick: function () { toggle('band', b.key); },
      }));
    });
    htr.appendChild(U.el('th', { class: 'xf-col-total', text: '合計' }));
    thead.appendChild(htr); table.appendChild(thead);

    var tbody = U.el('tbody');
    sevs.forEach(function (s) {
      var tr = U.el('tr', { class: state.sev === s ? 'row-on' : '' });
      tr.appendChild(U.el('th', {
        class: 'xf-row-head' + (state.sev === s ? ' row-on' : ''),
        title: '只看「' + s + '」',
        onclick: function () { toggle('sev', s); },
      }, [U.el('span', { class: 'sev-badge sev-' + s, text: s })]));
      A.BANDS.forEach(function (b) {
        var n = g[s][b.key];
        var active = (!state.sev || state.sev === s) && (!state.band || state.band === b.key);
        var picked = state.sev === s && state.band === b.key;
        var td = U.el('td', { class: 'xf-cell' + (picked ? ' picked' : '') + (active ? '' : ' dim') });
        if (n) {
          td.appendChild(U.el('span', {
            class: 'num-cell clickable' + (b.key === 'overdue' ? ' has-overdue' : ''),
            text: U.num(n), title: s + ' × ' + b.label + '：' + n + ' 筆',
            onclick: function () { pickCell(s, b.key); },
          }));
        } else {
          td.appendChild(U.el('span', { class: 'xf-zero', text: '·' }));
        }
        tr.appendChild(td);
      });
      tr.appendChild(U.el('td', { class: 'total-cell', text: U.num(g[s]._t) }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    var tfoot = U.el('tfoot'), ftr = U.el('tr', { class: 'total-row' });
    ftr.appendChild(U.el('th', { class: 'xf-row-head', text: '合計' }));
    A.BANDS.forEach(function (b) { ftr.appendChild(U.el('td', { class: 'total-cell', text: U.num(bandTotals[b.key]) })); });
    ftr.appendChild(U.el('td', { class: 'total-cell', text: U.num(grand) }));
    tfoot.appendChild(ftr); table.appendChild(tfoot);

    wrap.appendChild(table);
    wrap.appendChild(U.el('p', { class: 'xf-hint', text: '點格子＝同時鎖「該嚴重度＋該時間帶」；點嚴重度列首或到期欄首＝只鎖一個維度；再點一次取消。' }));
    return wrap;
  }

  /* -------- Facet chips：部門 / 負責人（可疊加的漏斗維度） -------- */
  var FACET_DEFS = [
    { key: 'dept', name: '部門' },
    { key: 'owner', name: '負責人' },
  ];
  function buildFacets() {
    var box = U.el('div', { class: 'xf-facets' });
    FACET_DEFS.forEach(function (def) {
      // 此維度的可選值：以「其他維度都符合」為母體，統計每個值的筆數
      var pool = base.filter(function (r) { return matchesExcept(r, [def.key]); });
      var counts = {};
      pool.forEach(function (r) { var v = DIMS[def.key](r); counts[v] = (counts[v] || 0) + 1; });
      var vals = Object.keys(counts);
      // 單一值(或無)且未選 → 不顯示這排(沒有篩選意義)
      if (vals.length <= 1 && state[def.key] === null) return;
      vals.sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });

      var row = U.el('div', { class: 'xf-facet' });
      row.appendChild(U.el('span', { class: 'xf-facet-label', text: def.name }));
      vals.forEach(function (v) {
        var on = state[def.key] === v;
        row.appendChild(U.el('button', {
          class: 'search-chip xf-chip' + (on ? ' active' : ''),
          html: U.esc(v) + ' <span class="xf-chip-n">' + counts[v] + '</span>',
          onclick: (function (k, val) { return function () { toggle(k, val); }; })(def.key, v),
        }));
      });
      box.appendChild(row);
    });
    return box;
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
    var tags = COND_ORDER.filter(function (d) { return state[d.key] !== null; })
      .map(function (d) { return d.fmt ? d.fmt(state[d.key]) : state[d.key]; });
    return title + (tags.length ? '（' + tags.join(' × ') + '）' : '（全部）');
  }

  /* -------- 互動 -------- */
  function toggle(dim, val) { state[dim] = state[dim] === val ? null : val; draw(); }
  function pickCell(sev, bandKey) {
    var same = state.sev === sev && state.band === bandKey;
    state.sev = same ? null : sev;
    state.band = same ? null : bandKey;
    draw();
  }

  global.Matrix = { render: render };
})(window);
