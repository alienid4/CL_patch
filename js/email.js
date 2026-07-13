/* ============================================================
 * js/email.js
 * Email 設定（其他功能 → Email 設定）— 個人套個人的 SMTP 設定，存本機。
 * 公司為「免認證內部 relay」，故不收密碼，只存寄件人/收件人/主機等非機密設定。
 * 網頁本身無法直接走 SMTP 寄信（瀏覽器限制）；本模組負責「設定＋產生寄送任務」，
 * 實際寄送由本機 PowerShell 腳本讀取匯出的 mail-task.json 執行。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var UI = global.UI;
  var STORAGE_KEY = 'vulnDashboard.email';

  var DEFAULTS = {
    smtpHost: '',
    smtpPort: 25,
    from: '',
    cc: '',
    fallbackTo: '',        // 查無 email/離職者 → 轉寄給（主管/窗口）
    subjectPrefix: '【弱點修補提醒】',
    scopeOverdue: true,
    scopeSoon: false,
  };

  function loadCfg() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function saveCfg(cfg) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); return true; }
    catch (e) { return false; }
  }

  /* 收件人字串 → 陣列（換行/逗號/分號分隔、去空白去重） */
  function parseList(s) {
    var seen = {}, out = [];
    String(s || '').split(/[\n,;，；]+/).forEach(function (x) {
      var t = x.trim();
      if (t && !seen[t]) { seen[t] = 1; out.push(t); }
    });
    return out;
  }

  /* 取目前資料的「要通知」清單：逾期未結（可含近期到期） */
  function scopedRecords(cfg) {
    var st = (global.App && global.App.getState) ? global.App.getState() : null;
    var sheets = (st && st.sheets) ? st.sheets : [];
    var dept = (st && st.myDept) ? st.myDept : '__all__';
    function inDept(r) { return dept === '__all__' || (r.unit || '(未填)') === dept; }
    var out = [];
    if (cfg.scopeOverdue && global.Summary && global.Summary.collectOverdue) {
      out = global.Summary.collectOverdue(sheets, dept).slice();
    }
    if (cfg.scopeSoon) {
      var soon = (global.APP_CONFIG && global.APP_CONFIG.soonDays) || 30;
      sheets.forEach(function (s) {
        (s.records || []).forEach(function (r) {
          if (r.closeBucket === 'open' && r.realDue && r.daysLeft >= 0 && r.daysLeft <= soon && inDept(r)) out.push(r);
        });
      });
    }
    out.sort(function (a, b) { return (b.overdueDays || 0) - (a.overdueDays || 0); });
    return out;
  }

  /* 產生信件主旨與內文（純事實，不加多餘說明） */
  function buildContent(cfg) {
    var recs = scopedRecords(cfg);
    var today = U.fmtDate(U.today());
    var subject = (cfg.subjectPrefix || '') + '弱點待處理 ' + recs.length + ' 筆（' + today + '）';
    var lines = [];
    lines.push('弱點待處理清單（' + today + '）：');
    lines.push('');
    recs.forEach(function (r) {
      var od = (r.realDue && r.daysLeft < 0) ? ('逾期 ' + r.overdueDays + ' 天')
             : (r.realDue ? ('剩 ' + r.daysLeft + ' 天') : '無到期日');
      lines.push('· [' + r.sheet + '] ' + (r.unit || '(未填)') + ' / ' + r.owner +
                 '｜' + r.name + '｜' + r.severity + '｜到期 ' + U.fmtDate(r.realDue) + '（' + od + '）');
    });
    if (!recs.length) lines.push('（目前無符合條件的項目）');
    return { subject: subject, body: lines.join('\n'), count: recs.length };
  }

  /* 依負責人分組，每人一封催辦（B：各負責人各別催辦；email 由腳本查 AD 補） */
  function buildBatch(cfg) {
    var recs = scopedRecords(cfg);
    var byOwner = {};
    recs.forEach(function (r) { var o = r.owner || '(未指定)'; (byOwner[o] = byOwner[o] || []).push(r); });
    var today = U.fmtDate(U.today());
    var owners = Object.keys(byOwner).sort(function (a, b) { return byOwner[b].length - byOwner[a].length; });
    return owners.map(function (o) {
      var list = byOwner[o];
      var subject = (cfg.subjectPrefix || '') + o + ' 弱點待處理 ' + list.length + ' 筆（' + today + '）';
      var lines = ['以下弱點待您處理（' + today + '）：', ''];
      list.forEach(function (r) {
        var od = (r.realDue && r.daysLeft < 0) ? ('逾期 ' + r.overdueDays + ' 天')
               : (r.realDue ? ('剩 ' + r.daysLeft + ' 天') : '無到期日');
        lines.push('· [' + r.sheet + '] ' + (r.unit || '(未填)') +
                   '｜' + r.name + '｜' + r.severity + '｜到期 ' + U.fmtDate(r.realDue) + '（' + od + '）');
      });
      return { owner: o, count: list.length, subject: subject, body: lines.join('\n') };
    });
  }

  /* 下載 JSON 檔 */
  function downloadJSON(obj, fileName) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = U.el('a', { href: url, download: fileName });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ---- 設定表單 ---- */
  function field(labelText, inputNode) {
    return U.el('label', { class: 'email-field' }, [
      U.el('span', { class: 'email-field-label', text: labelText }),
      inputNode,
    ]);
  }

  function buildForm(cfg) {
    var iHost = U.el('input', { type: 'text', class: 'email-input', value: cfg.smtpHost, placeholder: '公司 SMTP relay 主機（本機設定，不上傳）' });
    var iPort = U.el('input', { type: 'number', class: 'email-input email-input-sm', value: String(cfg.smtpPort), min: '1' });
    var iFrom = U.el('input', { type: 'text', class: 'email-input', value: cfg.from, placeholder: '你的寄件信箱' });
    var iCc = U.el('textarea', { class: 'email-input email-area', rows: '2', placeholder: '每封都副本給（選填，如主管）' });
    iCc.value = cfg.cc;
    var iFallback = U.el('input', { type: 'text', class: 'email-input', value: cfg.fallbackTo || '', placeholder: '查無 email/離職者轉寄給（主管/窗口）' });
    var iSubj = U.el('input', { type: 'text', class: 'email-input', value: cfg.subjectPrefix });
    var cOverdue = U.el('input', { type: 'checkbox' }); cOverdue.checked = !!cfg.scopeOverdue;
    var cSoon = U.el('input', { type: 'checkbox' }); cSoon.checked = !!cfg.scopeSoon;

    var form = U.el('div', { class: 'email-form' }, [
      field('SMTP 主機', iHost),
      field('埠', iPort),
      field('寄件人', iFrom),
      field('副本', iCc),
      field('查無 email 轉寄', iFallback),
      field('主旨前綴', iSubj),
      U.el('div', { class: 'email-field' }, [
        U.el('span', { class: 'email-field-label', text: '寄送範圍' }),
        U.el('div', { class: 'email-scope' }, [
          U.el('label', { class: 'email-check' }, [cOverdue, U.el('span', { text: '逾期未結' })]),
          U.el('label', { class: 'email-check' }, [cSoon, U.el('span', { text: '近期到期' })]),
        ]),
      ]),
    ]);

    function read() {
      return {
        smtpHost: iHost.value.trim(),
        smtpPort: parseInt(iPort.value, 10) || 25,
        from: iFrom.value.trim(),
        cc: iCc.value,
        fallbackTo: iFallback.value,
        subjectPrefix: iSubj.value,
        scopeOverdue: cOverdue.checked,
        scopeSoon: cSoon.checked,
      };
    }
    return { node: form, read: read };
  }

  function openSettings() {
    var cfg = loadCfg();
    var f = buildForm(cfg);
    var listBox = U.el('div', { class: 'batch-list hidden' });
    var body = U.el('div', {}, [f.node, listBox]);
    var listState = { batch: [], checks: {} };

    function doSave() {
      var c = f.read();
      if (saveCfg(c)) UI.toast('Email 設定已儲存', 'success');
      else UI.toast('儲存失敗（瀏覽器空間不足）', 'error');
    }

    function setAll(v) { Object.keys(listState.checks).forEach(function (k) { listState.checks[k].checked = v; }); }

    /* 列出催辦名單（可勾選）：測試時只勾一個人即可 */
    function doList() {
      var c = f.read();
      listState.batch = buildBatch(c);
      listState.checks = {};
      listBox.innerHTML = '';
      listBox.classList.remove('hidden');
      if (!listState.batch.length) {
        listBox.appendChild(U.el('p', { class: 'empty-hint', text: '目前無符合條件的負責人。' }));
        return;
      }
      listBox.appendChild(U.el('div', { class: 'batch-tools' }, [
        U.el('span', { class: 'batch-tools-label', text: '勾選要催辦的人（' + listState.batch.length + ' 位）' }),
        U.el('button', { class: 'btn btn-secondary btn-sm', text: '全選', onclick: function () { setAll(true); } }),
        U.el('button', { class: 'btn btn-secondary btn-sm', text: '全不選', onclick: function () { setAll(false); } }),
      ]));
      listState.batch.forEach(function (b) {
        var cb = U.el('input', { type: 'checkbox' }); cb.checked = true;
        listState.checks[b.owner] = cb;
        listBox.appendChild(U.el('label', { class: 'batch-row' }, [
          cb,
          U.el('span', { class: 'batch-owner', text: b.owner }),
          U.el('span', { class: 'batch-count', text: b.count + ' 筆' }),
        ]));
      });
    }

    function doExportSelected() {
      var c = f.read();
      saveCfg(c);
      if (!c.smtpHost || !c.from) { UI.toast('請先填 SMTP 主機、寄件人', 'error'); return; }
      if (!listState.batch.length) { UI.toast('請先按「列出催辦名單」', 'error'); return; }
      var selected = listState.batch.filter(function (b) { var cb = listState.checks[b.owner]; return cb && cb.checked; });
      if (!selected.length) { UI.toast('請至少勾選一位', 'error'); return; }
      downloadJSON({
        generatedAt: new Date().toISOString(),
        smtp: { host: c.smtpHost, port: c.smtpPort, auth: false },
        from: c.from,
        cc: parseList(c.cc),
        fallbackTo: parseList(c.fallbackTo),
        subjectPrefix: c.subjectPrefix,
        owners: selected,
      }, 'mail-batch.json');
      UI.toast('已匯出 mail-batch.json（勾選 ' + selected.length + ' 位）', 'success');
    }

    var footer = U.el('div', { class: 'reminder-actions' }, [
      U.el('button', { class: 'btn btn-primary', text: '儲存設定', onclick: doSave }),
      U.el('button', { class: 'btn btn-secondary', text: '列出催辦名單', onclick: doList }),
      U.el('button', { class: 'btn btn-secondary', text: '匯出勾選的人', onclick: doExportSelected }),
    ]);
    UI.openModal('Email 設定', body, { footer: footer });
  }

  function init() {
    var btn = document.getElementById('email-settings-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var d = document.getElementById('more-dropdown');
      if (d) d.classList.add('hidden');
      openSettings();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  global.EmailCfg = { load: loadCfg, buildContent: buildContent, buildBatch: buildBatch };
})(window);
