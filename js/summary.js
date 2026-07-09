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

  /* 單一項目(工作表)的彙總 */
  function agg(sheet) {
    var soon = CFG.soonDays || 30;
    var recs = sheet.records || [];
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

  /* 全部項目彙總(供 KPI / 複製摘要) */
  function overall(sheets) {
    var rows = (sheets || []).map(agg);
    var t = { open: 0, closed: 0, overdue: 0, soon: 0, high: 0, total: 0 };
    rows.forEach(function (r) {
      t.open += r.open; t.closed += r.closed; t.overdue += r.overdue;
      t.soon += r.soon; t.high += r.high; t.total += r.total;
    });
    t.rate = t.total ? Math.round(t.closed / t.total * 1000) / 10 : 0;
    return { rows: rows, totals: t };
  }

  function render(sheets, onSelect) {
    var box = document.getElementById('summary-view');
    if (!box) return;
    box.innerHTML = '';
    var o = overall(sheets);
    var rows = o.rows, t = o.totals;

    box.appendChild(U.el('div', { class: 'panel-bar' }, [
      U.el('h3', { text: '全部項目總覽' }),
      U.el('span', { class: 'panel-bar-note', text: '共 ' + sheets.length + ' 個項目 · 點列可進入細項' }),
    ]));

    /* KPI 合計 */
    var kpis = [
      { label: '未結案', value: t.open, cls: 'm-total' },
      { label: '已逾期', value: t.overdue, cls: 'm-overdue' },
      { label: '近期到期', value: t.soon, cls: 'm-warn' },
      { label: '高風險未結（C+H）', value: t.high, cls: 'm-critical' },
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
    renderChart(rows);
  }

  function renderChart(rows) {
    if (chart) { chart.destroy(); chart = null; }
    var canvas = document.getElementById('summary-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    var labels = rows.map(function (r) { var m = r.name.match(/^\d+/); return m ? m[0] : r.name; });
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
        plugins: { legend: { position: 'top' }, title: { display: true, text: '各項目未結案（含已逾期），x 軸為項目編號', font: { size: 14 } } },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  function destroyChart() { if (chart) { chart.destroy(); chart = null; } }

  global.Summary = { render: render, overall: overall, destroyChart: destroyChart };
})(window);
