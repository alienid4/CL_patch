/* ============================================================
 * js/summary.js
 * 主管總覽首頁：一頁彙總全部項目(工作表)狀態。
 * KPI 合計 + 各項目狀態表(可點進細項) + 各項目未結案堆疊圖。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var CFG = global.APP_CONFIG;
  var chart = null;

  function inDept(r, dept) { return !dept || dept === '__all__' || (r.unit || '(未填)') === dept; }

  /* 單一項目(工作表)的彙總(可限定部門) */
  function agg(sheet, dept) {
    var soon = CFG.soonDays || 30;
    var recs = (sheet.records || []).filter(function (r) { return inDept(r, dept); });
    var open = recs.filter(function (r) { return r.closeBucket === 'open'; });
    var closed = recs.filter(function (r) { return r.closeBucket === 'closed'; });
    var overdue = open.filter(function (r) { return r.realDue && r.daysLeft < 0; });
    var soonN = open.filter(function (r) { return r.realDue && r.daysLeft >= 0 && r.daysLeft <= soon; });
    var high = open.filter(function (r) { return r.severity === 'Critical' || r.severity === 'High'; });
    return {
      name: sheet.name, total: recs.length, open: open.length, closed: closed.length,
      overdue: overdue.length, soon: soonN.length, high: high.length,
      rate: recs.length ? closed.length / recs.length : 0,
    };
  }

  /* 全部項目彙總(供 KPI / 複製摘要；可限定部門) */
  function overall(sheets, dept) {
    var rows = (sheets || []).map(function (s) { return agg(s, dept); });
    var t = { open: 0, closed: 0, overdue: 0, soon: 0, high: 0, total: 0 };
    rows.forEach(function (r) {
      t.open += r.open; t.closed += r.closed; t.overdue += r.overdue;
      t.soon += r.soon; t.high += r.high; t.total += r.total;
    });
    t.rate = t.total ? Math.round(t.closed / t.total * 1000) / 10 : 0;
    return { rows: rows, totals: t };
  }

  /* 跨所有項目，撈出「未結案且已逾期」的弱點（主管稽核：沒修補的弱點；可限定部門） */
  function collectOverdue(sheets, dept) {
    var out = [];
    (sheets || []).forEach(function (s) {
      (s.records || []).forEach(function (r) {
        if (r.closeBucket === 'open' && r.overdue && inDept(r, dept)) out.push(r);
      });
    });
    return out;
  }

  /* 全域逾期清單的前置欄位：讓主管一眼看到是哪個項目、哪個部門 */
  var OVERDUE_EXTRA_COLS = [
    { h: '項目', cls: 'col-name', disp: function (r) { return r.sheet; }, sortVal: function (r) { return (r.sheet || '').toLowerCase(); } },
    { h: '部門', cls: '', disp: function (r) { return r.unit || '(未填)'; }, sortVal: function (r) { return (r.unit || '').toLowerCase(); } },
  ];

  /* 開啟「全部逾期未結」明細（跨項目彙整，可排序 / 匯出 / 另開分頁） */
  function openAllOverdue(recs) {
    if (!global.UI) return;
    global.UI.openDetail('全部逾期未結清單（' + recs.length + ' 筆）', recs, { extraCols: OVERDUE_EXTRA_COLS });
  }

  function render(sheets, onSelect, dept) {
    var box = document.getElementById('summary-view');
    if (!box) return;
    box.innerHTML = '';
    var o = overall(sheets, dept);
    var rows = o.rows, t = o.totals;

    box.appendChild(U.el('div', { class: 'panel-bar' }, [
      U.el('h3', { text: (dept && dept !== '__all__') ? (dept + ' 總覽') : '全部項目總覽' }),
      U.el('span', { class: 'panel-bar-note', text: '共 ' + sheets.length + ' 個項目' }),
    ]));

    /* 逾期警示橫幅（主管稽核）：跨全部項目的「沒修補（逾期未結）」弱點，一鍵攤開 */
    var overdueRecs = collectOverdue(sheets, dept);
    if (overdueRecs.length) {
      var maxOd = overdueRecs.reduce(function (m, r) { return Math.max(m, r.overdueDays || 0); }, 0);
      var byDept = {};
      overdueRecs.forEach(function (r) { var u = r.unit || '(未填)'; byDept[u] = (byDept[u] || 0) + 1; });
      var topDepts = Object.keys(byDept)
        .sort(function (a, b) { return byDept[b] - byDept[a]; }).slice(0, 4)
        .map(function (u) { return u + '（' + byDept[u] + '）'; });
      box.appendChild(U.el('div', { class: 'overdue-alert' }, [
        U.el('span', { class: 'oa-icon', text: '⚠' }),
        U.el('span', { class: 'oa-text', html:
          '全部項目共 <b>' + U.num(overdueRecs.length) + '</b> 筆弱點<b>已逾期尚未結案</b>，最久已逾期 <b>' + U.num(maxOd) + '</b> 天。' +
          (topDepts.length ? '　逾期集中：' + U.esc(topDepts.join('、')) + '。' : '') }),
        U.el('button', { class: 'btn btn-danger btn-sm', text: '查看全部逾期清單',
          onclick: function () { openAllOverdue(overdueRecs); } }),
      ]));
    }

    /* KPI 合計 */
    var kpis = [
      { label: '未結案', value: t.open, cls: 'm-total' },
      { label: '已逾期', value: t.overdue, cls: 'm-overdue' },
      { label: '近期到期', value: t.soon, cls: 'm-warn' },
      { label: '高風險未結', value: t.high, cls: 'm-critical' },
      { label: '整體結案率', value: t.rate + '%', cls: 'm-info' },
    ];
    var kgrid = U.el('div', { class: 'summary-kpis' });
    kpis.forEach(function (k) {
      kgrid.appendChild(U.el('div', { class: 'metric-card ' + k.cls }, [
        U.el('div', { class: 'metric-value', text: (typeof k.value === 'number' ? U.num(k.value) : k.value) }),
        U.el('div', { class: 'metric-label', text: k.label }),
      ]));
    });
    box.appendChild(kgrid);

    /* 各項目狀態表 */
    var table = U.el('table', { class: 'tracking-table summary-table' });
    var thead = U.el('thead'); var htr = U.el('tr');
    ['項目', '未結案', '已逾期', '近期到期', '高風險(未結)', '已結案', '結案率', '狀態'].forEach(function (h) {
      htr.appendChild(U.el('th', { text: h }));
    });
    thead.appendChild(htr); table.appendChild(thead);

    var tbody = U.el('tbody');
    rows.forEach(function (r, i) {
      var tr = U.el('tr', { class: 'clickable' + (r.overdue > 0 ? ' row-overdue' : '') });
      tr.title = '點擊進入「' + r.name + '」細項';
      tr.addEventListener('click', function () { onSelect(i); });
      tr.appendChild(U.el('td', { class: 'owner-cell', text: r.name }));
      tr.appendChild(U.el('td', { class: 'num-cell', text: U.num(r.open) }));
      tr.appendChild(U.el('td', { class: 'num-cell' + (r.overdue > 0 ? ' has-overdue' : ''), text: U.num(r.overdue) }));
      tr.appendChild(U.el('td', { class: 'num-cell', text: U.num(r.soon) }));
      tr.appendChild(U.el('td', { class: 'num-cell', text: U.num(r.high) }));
      tr.appendChild(U.el('td', { class: 'num-cell', text: U.num(r.closed) }));
      tr.appendChild(U.el('td', { class: 'num-cell', text: (Math.round(r.rate * 1000) / 10) + '%' }));
      var st = r.overdue > 0 ? { t: '有逾期', c: 'st-red' }
             : r.open > 0 ? { t: '追蹤中', c: 'st-amber' }
             : { t: '已全數結案', c: 'st-green' };
      var stTd = U.el('td'); stTd.appendChild(U.el('span', { class: 'status-pill ' + st.c, text: st.t }));
      tr.appendChild(stTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    var tfoot = U.el('tfoot'); var ftr = U.el('tr', { class: 'total-row' });
    ftr.appendChild(U.el('td', { class: 'owner-cell', text: '合計' }));
    [t.open, t.overdue, t.soon, t.high, t.closed].forEach(function (v, idx) {
      ftr.appendChild(U.el('td', { class: 'num-cell' + (idx === 1 && v > 0 ? ' has-overdue' : ''), text: U.num(v) }));
    });
    ftr.appendChild(U.el('td', { class: 'num-cell', text: t.rate + '%' }));
    ftr.appendChild(U.el('td', {}));
    tfoot.appendChild(ftr); table.appendChild(tfoot);
    box.appendChild(U.el('div', { class: 'table-scroll' }, [table]));

    /* 圖表：各項目 已逾期 + 其他未結（堆疊） */
    box.appendChild(U.el('div', { class: 'chart-card summary-chart-card' }, [
      U.el('div', { class: 'chart-wrap' }, [U.el('canvas', { id: 'summary-chart' })]),
    ]));
    renderChart(rows, onSelect);
  }

  function renderChart(rows, onSelect) {
    if (chart) { chart.destroy(); chart = null; }
    var canvas = document.getElementById('summary-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    var labels = rows.map(function (r) { var m = r.name.match(/^\d+/); return m ? m[0] : r.name; });
    var drill = global.UI.drillEvents(function (i) { if (onSelect && rows[i]) onSelect(i); });
    chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: '已逾期', data: rows.map(function (r) { return r.overdue; }), backgroundColor: '#b71c1c', borderRadius: 3 },
          { label: '其他未結', data: rows.map(function (r) { return Math.max(0, r.open - r.overdue); }), backgroundColor: '#1976d2', borderRadius: 3 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        onClick: drill.onClick, onHover: drill.onHover,
        plugins: { legend: { position: 'top' }, title: { display: false } },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  function destroyChart() { if (chart) { chart.destroy(); chart = null; } }

  global.Summary = { render: render, overall: overall, destroyChart: destroyChart, collectOverdue: collectOverdue };
})(window);
