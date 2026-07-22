// ============================================================
//  regression_test.js — 回歸測試（無頭 Chrome，實跑真網頁）
//
//  涵蓋 V1.58~V1.73 最容易復發的四塊：
//    A. 日期解析（民國年、非法日期、Excel 序號）—— 純函式，直接呼叫 window.Utils
//    B. 結案分類（「結案中」不誤判為結案、認不得的落 other 不丟棄）
//    C. 數字對帳（每張 KPI 卡點開的明細筆數 == 卡片數字）
//    D. sticky modal（有輸入的視窗不被誤觸關閉，唯讀明細仍好關）
//
//  前置：
//    1. 另開視窗跑起本機伺服器（.claude\launch.json 的 vuln-dashboard，埠 8778）
//         py -m http.server 8778
//    2. 需要 docs\測試假資料_天龍八部.xlsx（未進版控，本機自備）
//    3. node dev\regression_test.js         （會自動找系統 Chrome）
//
//  離開碼 0=全過、1=有失敗、2=環境問題（伺服器沒開 / 缺 Chrome / 缺測資）
// ============================================================
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:8778";
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const CHROME = CHROME_CANDIDATES.find(p => p && fs.existsSync(p));
const wait = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? "  \x1b[32mPASS\x1b[0m  " : "  \x1b[31mFAIL\x1b[0m  ") + name + (extra != null ? "   → " + extra : ""));
  ok ? pass++ : fail++;
}
function group(title) { console.log("\n\x1b[36m" + title + "\x1b[0m"); }

(async () => {
  if (!CHROME) { console.error("找不到 Chrome/Edge，無法執行。"); process.exit(2); }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new", args: ["--no-sandbox"],
    defaultViewport: { width: 1440, height: 950 },
  });
  const page = await browser.newPage();
  const BENIGN = /logo\.(png|jpg)|favicon\.ico/;   // 商標/favicon 本機自備，缺了不影響邏輯
  const jsErrors = [];   // 真正的 JS 例外
  const bad404 = [];     // 非無害的資源 404（app 檔案掉了才該擋）
  page.on("pageerror", e => jsErrors.push("PAGEERROR: " + e.message));
  page.on("console", m => {
    // 資源 404 會產生通用的「Failed to load resource」訊息（不含網址），改由 response 事件精準判斷
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) jsErrors.push(m.text());
  });
  page.on("response", r => {
    if (r.status() === 404 && !BENIGN.test(r.url())) bad404.push(r.url());
  });

  try {
    await page.goto(BASE, { waitUntil: "networkidle0", timeout: 15000 });
  } catch (e) {
    console.error(`連不到 ${BASE}。請先在另一個視窗啟動伺服器：py -m http.server 8778`);
    await browser.close(); process.exit(2);
  }

  const ver = await page.evaluate(() => window.APP_VERSION);
  console.log("受測版本:", ver, " @ ", BASE);

  // ══════════════════════════ A. 日期解析（純函式）
  group("A. 日期解析 window.Utils.parseDate");
  const d = await page.evaluate(() => {
    const P = window.Utils.parseDate;
    const iso = x => (x ? x.getFullYear() + "/" + (x.getMonth() + 1) + "/" + x.getDate() : null);
    return {
      roc:      iso(P("114年5月1日")),   // 民國114 = 西元2025
      rocSlash: iso(P("114/5/1")),        // 民國 + 斜線
      west:     iso(P("2025年4月12日")),
      westSlash:iso(P("2025/4/12")),
      dash:     iso(P("2025-04-12")),
      dot:      iso(P("2025.4.12")),
      bad:      iso(P("2025/2/31")),      // 非法日期 → null（不滾到 3/3）
      empty:    P(""),                     // → null
      excel:    iso(P(45658)),            // Excel 序號 2025/1/1
    };
  });
  check("民國年『114年5月1日』→ 2025/5/1（不是西元114年）", d.roc === "2025/5/1", d.roc);
  check("民國年斜線『114/5/1』→ 2025/5/1", d.rocSlash === "2025/5/1", d.rocSlash);
  check("西元中文『2025年4月12日』→ 2025/4/12", d.west === "2025/4/12", d.west);
  check("西元斜線『2025/4/12』→ 2025/4/12", d.westSlash === "2025/4/12", d.westSlash);
  check("破折號『2025-04-12』→ 2025/4/12", d.dash === "2025/4/12", d.dash);
  check("點號『2025.4.12』→ 2025/4/12", d.dot === "2025/4/12", d.dot);
  check("非法日期『2025/2/31』→ null（不靜默滾月）", d.bad === null, String(d.bad));
  check("空字串 → null", d.empty === null, String(d.empty));
  check("Excel 序號 45658 → 2025/1/1", d.excel === "2025/1/1", d.excel);

  // ══════════════════════════ B. 結案分類（純函式）
  group("B. 結案分類 window.MultiSheet.classifyClose");
  const c = await page.evaluate(() => {
    const C = window.MultiSheet.classifyClose;
    return {
      repaired:  C("已修復", null),   // 修過的 bug：曾被整批丟棄
      done:      C("已結案", null),
      fixed:     C("已修補", null),
      inClose:   C("結案中", null),   // 帶「結案」二字但其實未完成 → 要判 open
      inProg:    C("處理中", null),
      unknown:   C("待老闆確認", null),// 認不得 → other，不丟棄
      emptyDate: C("", new Date()),    // 空狀態 + 有結案日 → closed
      emptyNone: C("", null),          // 空狀態 + 無結案日 → open
    };
  });
  check("『已修復』→ closed（不被丟棄）", c.repaired === "closed", c.repaired);
  check("『已結案』→ closed", c.done === "closed", c.done);
  check("『已修補』→ closed", c.fixed === "closed", c.fixed);
  check("『結案中』→ open（不因含『結案』誤判）", c.inClose === "open", c.inClose);
  check("『處理中』→ open", c.inProg === "open", c.inProg);
  check("認不得的狀態 → other（不靜默丟棄）", c.unknown === "other", c.unknown);
  check("空狀態+有結案日 → closed", c.emptyDate === "closed", c.emptyDate);
  check("空狀態+無結案日 → open", c.emptyNone === "open", c.emptyNone);

  // 載入假資料（供 C/D 用）
  const dropped = await page.evaluate(async () => {
    const res = await fetch("/docs/" + encodeURIComponent("測試假資料_天龍八部.xlsx"));
    if (!res.ok) return "HTTP " + res.status;
    const buf = await res.arrayBuffer();
    const dt = new DataTransfer();
    dt.items.add(new File([buf], "測試假資料_天龍八部.xlsx"));
    document.getElementById("drop-zone").dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    return "ok";
  });
  if (dropped !== "ok") {
    console.error("\n載入測試假資料失敗（" + dropped + "）。需 docs\\測試假資料_天龍八部.xlsx");
    await browser.close(); process.exit(2);
  }
  await wait(2500);

  // ══════════════════════════ C. 數字對帳：KPI 卡點開的筆數 == 卡片數字
  group("C. 數字對帳（總覽 KPI 卡 → 明細筆數）");
  const isOpen = () => page.evaluate(() =>
    document.getElementById("modal-overlay").classList.contains("show"));
  const cards = [
    [".metric-card.m-total", "未結案"],
    [".metric-card.m-overdue", "已逾期"],
    [".metric-card.m-warn", "近期到期"],
    [".metric-card.m-critical", "高風險未結"],
  ];
  for (const [sel, label] of cards) {
    // 卡片上的數字
    const cardNum = await page.$eval(sel, el => {
      const m = el.textContent.match(/\d+/);
      return m ? +m[0] : null;
    }).catch(() => null);
    if (cardNum === null) { check(`KPI「${label}」卡片存在`, false, "找不到"); continue; }
    await page.click(sel); await wait(700);
    // 明細的「共 N 筆」與實際列數
    const info = await page.evaluate(() => {
      const cnt = document.querySelector("#modal-body .detail-count");
      const m = cnt && cnt.textContent.match(/\d+/);
      const rows = document.querySelectorAll("#modal-body table tbody tr").length;
      return { stated: m ? +m[0] : null, rows };
    });
    check(`「${label}」卡片數字 ${cardNum} == 明細標示筆數`, cardNum === info.stated, `卡片=${cardNum} 明細=${info.stated}`);
    check(`「${label}」明細標示 ${info.stated} == 實際表格列數`, info.stated === info.rows, `標示=${info.stated} 列數=${info.rows}`);
    await page.click("#modal-close"); await wait(400);
  }

  // ══════════════════════════ D. sticky modal（V1.73 回歸）
  group("D. sticky modal 防誤觸（V1.73）");
  const clickOverlayBlank = () => page.evaluate(() =>
    document.getElementById("modal-overlay").dispatchEvent(new MouseEvent("click", { bubbles: true })));

  // 唯讀明細：仍要好關
  await page.click(".metric-card.m-overdue"); await wait(600);
  await clickOverlayBlank(); await wait(300);
  check("唯讀明細：點空白處『可關』（未回歸）", !(await isOpen()));
  await page.click(".metric-card.m-overdue"); await wait(600);
  await page.keyboard.press("Escape"); await wait(300);
  check("唯讀明細：Esc『可關』（未回歸）", !(await isOpen()));

  // Email 設定：不可被誤觸關掉，輸入值要保留
  await page.click("#more-btn"); await wait(300);
  await page.click("#email-settings-btn"); await wait(700);
  await page.evaluate(() => {
    const i = document.querySelector("#modal-body input[type=text]");
    if (i) { i.value = "smtp.regtest.local"; i.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await clickOverlayBlank(); await wait(300);
  check("Email 設定：點空白處『不關』", await isOpen());
  await page.keyboard.press("Escape"); await wait(300);
  check("Email 設定：Esc『不關』", await isOpen());
  const kept = await page.evaluate(() => {
    const i = document.querySelector("#modal-body input[type=text]"); return i ? i.value : null;
  });
  check("Email 設定：輸入值未被清掉", kept === "smtp.regtest.local", kept);
  await page.click("#modal-close"); await wait(400);
  check("Email 設定：✕ 可正常關閉", !(await isOpen()));

  // ══════════════════════════ 收尾
  group("E. 全域");
  check("全程無 JS 例外", jsErrors.length === 0,
    jsErrors.length ? jsErrors.slice(0, 3).join(" | ") : null);
  check("無 app 檔案 404（logo/favicon 除外）", bad404.length === 0,
    bad404.length ? bad404.slice(0, 3).join(" | ") : null);

  console.log(`\n═══ 結果：\x1b[32mPASS ${pass}\x1b[0m　\x1b[31mFAIL ${fail}\x1b[0m ═══`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("執行失敗:", e.message); process.exit(2); });
