/* ============================================================
 * js/utils.js
 * 共用工具函式：日期解析、天數計算、格式化、DOM 輔助。
 * ============================================================ */
(function (global) {
  'use strict';

  /* 去掉時分秒，只留日期(避免同日因時間差被判為逾期) */
  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /* 取「今天」(去時分秒) */
  function today() {
    return stripTime(new Date());
  }

  /* --------------------------------------------------------
   * 強韌的日期解析。可吃：
   *   - JS Date 物件(SheetJS cellDates 產生)
   *   - Excel 序號(數字)
   *   - 字串 "2025/4/12" "2025-04-12" "2025.4.12" "2025年4月12日"
   * 解析失敗回傳 null(不丟例外)。
   * -------------------------------------------------------- */
  function parseDate(v) {
    if (v === null || v === undefined || v === '') return null;

    if (v instanceof Date) {
      return isNaN(v.getTime()) ? null : stripTime(v);
    }

    if (typeof v === 'number' && isFinite(v)) {
      // Excel 序號起點 1899/12/30
      var ms = Math.round((v - 25569) * 86400 * 1000);
      var d = new Date(ms);
      return isNaN(d.getTime()) ? null : stripTime(d);
    }

    var s = String(v).trim();
    if (!s) return null;

    // 中文年月日
    var cm = s.match(/^(\d{3,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/);
    if (cm) return new Date(+cm[1], +cm[2] - 1, +cm[3]);

    // yyyy/m/d、yyyy-m-d、yyyy.m.d
    var m = s.match(/^(\d{3,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (m) {
      var y = +m[1];
      // 支援民國年(<1911 視為民國，+1911)
      if (y < 1911) y += 1911;
      return new Date(y, +m[2] - 1, +m[3]);
    }

    var d2 = new Date(s);
    return isNaN(d2.getTime()) ? null : stripTime(d2);
  }

  /* 兩日期相差天數 (b - a)，以毫秒換算避免夏令時誤差 */
  function daysBetween(a, b) {
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  /* 距今天數 (dueDate - today)。負數=已逾期 */
  function daysFromToday(due) {
    if (!due) return null;
    return daysBetween(today(), due);
  }

  /* 日期格式化 yyyy/mm/dd；無值回傳 '-' */
  function fmtDate(d) {
    if (!d) return '-';
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '/' + mm + '/' + dd;
  }

  /* 正規化字串：trim + 全形空白轉半形 */
  function normStr(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/　/g, ' ').trim();
  }

  /* 正規化用於比對的鍵：去空白、小寫 */
  function normKey(v) {
    return normStr(v).replace(/\s+/g, '').toLowerCase();
  }

  /* HTML escape，避免 Excel 內容含 <> 破版或 XSS */
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* 千分位 */
  function num(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Number(n).toLocaleString('en-US');
  }

  /* 簡易 DOM 建立 */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (k === 'dataset') {
          Object.keys(attrs[k]).forEach(function (d) { node.dataset[d] = attrs[k][d]; });
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  global.Utils = {
    stripTime: stripTime,
    today: today,
    parseDate: parseDate,
    daysBetween: daysBetween,
    daysFromToday: daysFromToday,
    fmtDate: fmtDate,
    normStr: normStr,
    normKey: normKey,
    esc: esc,
    num: num,
    el: el,
  };
})(window);
