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
    to: '',
    cc: '',
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
    var iHost = U.el('input', { type: 'text', class: 'email-input', value: cfg.smtpHost, placeholder: '例：mailrelay.company.local' });
    var iPort = U.el('input', { type: 'number', class: 'email-input email-input-sm', value: String(cfg.smtpPort), min: '1' });
    var iFrom = U.el('input', { type: 'text', class: 'email-input', value: cfg.from, placeholder: '你的寄件信箱' });
    var iTo = U.el('textarea', { class: 'email-input email-area', rows: '3', placeholder: '一行一位，或用逗號分隔' });
    iTo.value = cfg.to;
    var iCc = U.el('textarea', { class: 'email-input email-area', rows: '2', placeholder: '選填' });
    iCc.value = cfg.cc;
    var iSubj = U.el('input', { type: 'text', class: 'email-input', value: cfg.subjectPrefix });
    var cOverdue = U.el('input', { type: 'checkbox' }); cOverdue.checked = !!cfg.scopeOverdue;
    var cSoon = U.el('input', { type: 'checkbox' }); cSoon.checked = !!cfg.scopeSoon;

    var form = U.el('div', { class: 'email-form' }, [
      field('SMTP 主機', iHost),
      field('埠', iPort),
      field('寄件人', iFrom),
      field('收件人', iTo),
      field('副本', iCc),
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
        to: iTo.value,
        cc: iCc.value,
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
    var preview = U.el('pre', { class: 'email-preview hidden' });

    var body = U.el('div', {}, [f.node, preview]);

    function doSave() {
      var c = f.read();
      if (saveCfg(c)) UI.toast('Email 設定已儲存', 'success');
      else UI.toast('儲存失敗（瀏覽器空間不足）', 'error');
    }
    function doPreview() {
      var c = f.read();
      var m = buildContent(c);
      preview.textContent = '主旨：' + m.subject + '\n\n' + m.body;
      preview.classList.remove('hidden');
    }
    function doExport() {
      var c = f.read();
      saveCfg(c);
      var to = parseList(c.to), cc = parseList(c.cc);
      if (!c.smtpHost || !c.from || !to.length) {
        UI.toast('請先填 SMTP 主機、寄件人、收件人', 'error');
        return;
      }
      var m = buildContent(c);
      downloadJSON({
        generatedAt: new Date().toISOString(),
        smtp: { host: c.smtpHost, port: c.smtpPort, auth: false },
        from: c.from, to: to, cc: cc,
        subject: m.subject, body: m.body, count: m.count,
      }, 'mail-task.json');
      UI.toast('已匯出 mail-task.json', 'success');
    }

    var footer = U.el('div', { class: 'reminder-actions' }, [
      U.el('button', { class: 'btn btn-primary', text: '儲存設定', onclick: doSave }),
      U.el('button', { class: 'btn btn-secondary', text: '預覽通知內容', onclick: doPreview }),
      U.el('button', { class: 'btn btn-secondary', text: '匯出寄送任務', onclick: doExport }),
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

  global.EmailCfg = { load: loadCfg, buildContent: buildContent };
})(window);
