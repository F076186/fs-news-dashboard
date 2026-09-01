/* ═══════════════════════════════════════════════════════════════════
   FS Intelligence Dashboard — JavaScript
   ═══════════════════════════════════════════════════════════════════ */

"use strict";

// ── Config ─────────────────────────────────────────────────────────────
const API_URL        = "/api/news";
const STATUS_URL     = "/api/status";
const POLL_INTERVAL  = 60_000;   // re-check status every 60 s
const AUTO_REFRESH_S = 15 * 60;  // cache TTL on server (15 min)

// Category → colour mapping (matches CSS vars)
const CAT_COLORS = {
  "Banking News":         "#2f81f7",
  "Insurance":            "#3fb950",
  "FinTech & Innovation": "#a371f7",
  "Strategy & Consulting":"#d29922",
  "Regulation":           "#f85149",
};

// Region → colour mapping
const REGION_COLORS = {
  "Global":                "#39d3bb",
  "North America":         "#2f81f7",
  "Europe":                "#a371f7",
  "Asia-Pacific":          "#f0883e",
  "Middle East & Africa":  "#d29922",
  "Latin America":         "#3fb950",
};

// ── State ───────────────────────────────────────────────────────────────
let _data          = null;   // raw EN data from server
let _displayData   = null;   // current display data (EN or FR translated copy)
let _activeFilter  = "all";
let _polling       = null;
let _briefView     = "category";   // "category" | "region" | "matrix"

// ── DOM helpers ─────────────────────────────────────────────────────────
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showOverlay()  { $("#loadingOverlay").classList.remove("hidden"); }
function hideOverlay()  { $("#loadingOverlay").classList.add("hidden"); }
function showModal()    { $("#modalOverlay").classList.remove("hidden"); }
function hideModal()    { $("#modalOverlay").classList.add("hidden"); }

function setStatusPill(text, cls) {
  const el = $("#statusPill");
  el.textContent = text;
  el.className = "status-pill " + (cls || "");
}

function setRefreshBtn(loading) {
  const btn = $("#btnRefresh");
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle("spinning", loading);
  const svg = btn.querySelector("svg");
  if (svg) svg.style.animation = loading ? "spin .8s linear infinite" : "";
}

const { t, isFrench, applyStaticStrings, translateData, initLang } = window.i18n;

function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d   = new Date(iso);
    const now = new Date();
    const diffH = (now - d) / 36e5;
    const locale = isFrench() ? "fr-FR" : "en-GB";
    if (diffH < 1) return Math.round(diffH * 60) + (isFrench() ? " min" : "m ago");
    if (diffH < 24) return Math.round(diffH) + (isFrench() ? " h" : "h ago");
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  } catch { return iso; }
}

function escHtml(s) {
  return String(s || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// ── Loading dots (source progress) ─────────────────────────────────────
function initSourceDots(count) {
  const container = $("#sourceProgress");
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const d = document.createElement("div");
    d.className = "sp-dot";
    d.id = "sp-" + i;
    container.appendChild(d);
  }
}

function tickDot(idx, status) {
  const d = document.getElementById("sp-" + idx);
  if (d) d.classList.add(status === "ok" ? "ok" : "err");
}

// ── Fetch & render ──────────────────────────────────────────────────────
async function loadNews(force = false) {
  showOverlay();
  setStatusPill(t("statusLoading"), "loading");
  setRefreshBtn(true);
  initSourceDots(18);

  const url = force ? API_URL + "?refresh=1" : API_URL;
  let dotIdx = 0;
  const dotTimer = setInterval(() => {
    if (dotIdx < 18) { tickDot(dotIdx++, "ok"); }
  }, 350);

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    _data = await resp.json();

    clearInterval(dotTimer);
    while (dotIdx < 18) { tickDot(dotIdx++, "ok"); }

    // If French is active, translate now
    _displayData = isFrench() ? await _translateAndShow(_data) : _data;

    _renderWithData(_displayData);
    _updateStatusAfterLoad(_data);
  } catch (err) {
    clearInterval(dotTimer);
    console.error("Load failed:", err);
    setStatusPill(t("statusFailed"), "err");
    showErrorBanner(t("errorLoad") + err.message);
  } finally {
    hideOverlay();
    setRefreshBtn(false);
  }
}

function _updateStatusAfterLoad(data) {
  const locale = isFrench() ? "fr-FR" : "en-GB";
  const fetched = data.fetched_at
    ? new Date(data.fetched_at).toLocaleTimeString(locale)
    : "";
  $("#lastUpdated").textContent = fetched ? t("lastUpdatedPfx") + fetched : "";

  const errCount = data.sources_error || 0;
  if (errCount > 0) {
    setStatusPill(t("statusErr")(data.sources_ok, data.total_sources, errCount), "err");
  } else {
    setStatusPill(t("statusOk")(data.sources_ok, data.total_sources, data.total_articles), "ok");
  }
}

async function _translateAndShow(data) {
  const overlay = $("#translatingOverlay");
  const msg     = $("#translatingMsg");
  msg.textContent = t("translatingMsg");
  overlay.classList.remove("hidden");
  try {
    const translated = await translateData(data);
    return translated;
  } finally {
    overlay.classList.add("hidden");
  }
}

// ── Render ──────────────────────────────────────────────────────────────
function render() {
  if (!_displayData) return;
  _renderWithData(_displayData);
}

function _renderWithData(d) {
  renderStats(d);
  renderIntelBrief(d);
  renderCategories(d);
  updateErrorBanner();
}

function renderStats(d) {
  d = d || _displayData;
  const bar = $("#statsBar");
  bar.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">${t("statArticles")}</div>
      <div class="stat-value accent">${d.total_articles || 0}</div>
      <div class="stat-sub">${t("statArticlesSub")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t("statActive")}</div>
      <div class="stat-value green">${d.sources_ok || 0}</div>
      <div class="stat-sub">${t("statActiveSub")(d.total_sources || 0)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t("statFailed")}</div>
      <div class="stat-value ${d.sources_error > 0 ? "red" : "green"}">${d.sources_error || 0}</div>
      <div class="stat-sub">${d.sources_error > 0 ? t("statFailedErr") : t("statFailedOk")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t("statCats")}</div>
      <div class="stat-value orange">${(d.categories || []).length}</div>
      <div class="stat-sub">${t("statCatsSub")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t("statRefresh")}</div>
      <div class="stat-value" style="font-size:18px;color:var(--teal)">15 min</div>
      <div class="stat-sub">${t("statRefreshSub")}</div>
    </div>
  `;
}

function renderCategories(d) {
  d = d || _displayData;
  const container = $("#categorySections");
  container.innerHTML = "";

  // Active filter may be in original EN or translated FR cat name
  const summaries = d.category_summaries || {};
  const cats      = d.categories || Object.keys(summaries);

  for (const cat of cats) {
    // Filter matching: compare both translated name and English name
    if (_activeFilter !== "all" && _activeFilter !== cat) continue;
    const info = summaries[cat];
    if (!info) continue;

    // Color lookup: try translated name first, then EN name
    const color = CAT_COLORS[cat] || CAT_COLORS[_enCatName(cat)] || "#8b949e";
    const section = document.createElement("section");
    section.className = "category-section";
    section.dataset.cat = cat;

    const kwHtml = (info.keywords || []).slice(0, 8).map(k =>
      `<span class="kw-tag">${escHtml(k)}</span>`
    ).join("");

    const srcBadges = (info.sources || []).map(s => {
      const cls = s.status === "ok" ? "ok" : "err";
      const cnt = s.count ? ` <span class="cnt">${s.count}</span>` : "";
      return `<span class="source-badge ${cls}" title="${escHtml(s.error || s.name)}">
        <span class="dot"></span>${escHtml(s.name)}${cnt}
      </span>`;
    }).join("");

    section.innerHTML = `
      <div class="cat-section-header">
        <span class="cat-dot" style="background:${color}"></span>
        <h2 class="cat-section-title">${escHtml(cat)}</h2>
        <span class="cat-count">${info.count || 0} ${t("articles")}</span>
        <div class="cat-keywords">${kwHtml}</div>
      </div>
      <div class="source-status-row">${srcBadges}</div>
      <div class="articles-grid" id="grid-${escHtml(cat.replace(/\W+/g,"-"))}"></div>
    `;

    container.appendChild(section);

    const gridId  = "grid-" + cat.replace(/\W+/g, "-");
    const grid    = document.getElementById(gridId);
    const articles = info.articles || [];

    if (articles.length === 0) {
      grid.innerHTML = `<div class="empty-state">${t("noData")}</div>`;
    } else {
      for (const a of articles) {
        grid.appendChild(makeCard(a, color));
      }
    }
  }
}

// Map a possibly-translated cat name back to its EN key for colour lookup
const _enCatName = (() => {
  const fr2en = {};
  ["Banking News","FinTech & Innovation","Insurance","Regulation","Strategy & Consulting"].forEach(en => {
    fr2en[t(en)] = en;
  });
  return (name) => fr2en[name] || name;
})();

function makeCard(article, catColor) {
  const card = document.createElement("article");
  card.className = "article-card";
  card.style.setProperty("--cat-color", catColor);

  const date  = fmtDate(article.published);
  const title = escHtml(article.title);
  const src   = escHtml(article.source_name);
  const sum   = escHtml(article.summary || "");
  const meth  = article.method === "rss" ? t("rss") : t("web");

  card.innerHTML = `
    <div class="card-source-row">
      <span class="card-source-tag">${src}</span>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="card-method-badge">${meth}</span>
        ${date ? `<span class="card-date">${date}</span>` : ""}
      </div>
    </div>
    <div class="card-title">${title}</div>
    ${sum ? `<div class="card-summary">${sum}</div>` : ""}
    <div class="card-footer">
      <span class="card-read-link">${t("readArticle")}</span>
    </div>
  `;

  card.addEventListener("click", (e) => {
    // If user ctrl+clicks or middle-clicks, let the browser handle it
    if (e.metaKey || e.ctrlKey) {
      window.open(article.url, "_blank", "noopener");
      return;
    }
    openModal(article, catColor);
  });

  return card;
}

// ── Modal ───────────────────────────────────────────────────────────────
function openModal(article, catColor) {
  $("#modalSource").textContent  = article.source_name;
  $("#modalSource").style.color  = catColor;
  $("#modalTitle").textContent   = article.title;
  $("#modalMeta").textContent    = [
    article.category,
    article.published ? fmtDate(article.published) : "",
    article.method === "rss" ? t("viaRss") : t("viaWeb")
  ].filter(Boolean).join(" · ");
  $("#modalSummary").textContent = article.summary || t("noSummary");
  $("#modalLink").textContent    = t("readFull");
  $("#modalLink").href           = article.url;
  showModal();
}

// ── Error banner ────────────────────────────────────────────────────────
// ── Intelligence Brief ──────────────────────────────────────────────────

function renderIntelBrief(d) {
  d = d || _displayData;
  const brief = (d || {}).intelligence_brief;
  const section = $("#intelBrief");
  if (!brief) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  _renderBriefView(_briefView, brief);
}

function _renderBriefView(view, brief) {
  _briefView = view;
  brief = brief || (_displayData || {}).intelligence_brief;
  if (!brief) return;

  // Sync tab active state
  $$(".intel-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });

  const body = $("#intelBody");
  if (view === "category")    { body.innerHTML = _buildByCategoryHTML(brief); }
  else if (view === "region") { body.innerHTML = _buildByRegionHTML(brief); }
  else                        { body.innerHTML = _buildMatrixHTML(brief); }
}

// ── By-Category HTML ────────────────────────────────────────────────────
function _buildByCategoryHTML(brief) {
  const cats = Object.keys(brief.by_category);
  if (!cats.length) return `<p style="color:var(--text-dim)">${t("noData")}</p>`;

  const cards = cats.map(cat => {
    const d     = brief.by_category[cat];
    const color = CAT_COLORS[cat] || CAT_COLORS[_enCatName(cat)] || "#8b949e";

    const themeHtml = (d.themes || []).map(th =>
      `<span class="brief-theme-tag">${escHtml(th)}</span>`
    ).join("");

    const bulletHtml = (d.theme_bullets || []).map(b => {
      const formatted = escHtml(b).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<li>${formatted}</li>`;
    }).join("");

    const hlHtml = (d.top_headlines || []).map(h =>
      `<a class="brief-headline-link" href="${escHtml(h.url)}" target="_blank" rel="noopener"
         title="${escHtml(h.source)}">${escHtml(h.title)}</a>`
    ).join("");

    const regionChips = (d.regions_present || []).map(r =>
      `<span class="brief-region-chip">${escHtml(r)}</span>`
    ).join("");

    return `
      <div class="brief-cat-card" style="--cat-color:${color}">
        <div class="brief-cat-card-title">
          ${escHtml(cat)}
          <span class="brief-count-badge">${d.count} ${t("articles")}</span>
        </div>
        <div class="brief-themes">${themeHtml}</div>
        <ul class="brief-bullets">${bulletHtml}</ul>
        <div class="brief-headlines">${hlHtml}</div>
        <div class="brief-region-row">${regionChips}</div>
      </div>`;
  }).join("");

  return `<div class="brief-cat-grid">${cards}</div>`;
}

// ── By-Region HTML ──────────────────────────────────────────────────────
function _buildByRegionHTML(brief) {
  const regions = brief.regions || Object.keys(brief.by_region);
  if (!regions.length) return `<p style="color:var(--text-dim)">${t("noData")}</p>`;

  const cards = regions.map(reg => {
    const d     = brief.by_region[reg];
    if (!d) return "";
    const color = REGION_COLORS[reg] || REGION_COLORS[_enRegName(reg)] || "#39d3bb";

    const themeHtml = (d.themes || []).map(th =>
      `<span class="brief-theme-tag">${escHtml(th)}</span>`
    ).join("");

    const bulletHtml = (d.theme_bullets || []).map(b => {
      const formatted = escHtml(b).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<li>${formatted}</li>`;
    }).join("");

    const hlHtml = (d.top_headlines || []).map(h =>
      `<a class="brief-headline-link" href="${escHtml(h.url)}" target="_blank" rel="noopener"
         title="${escHtml(h.source)}">${escHtml(h.title)}</a>`
    ).join("");

    const catChips = (d.categories_present || []).map(c =>
      `<span class="brief-region-chip" style="color:${CAT_COLORS[c]||CAT_COLORS[_enCatName(c)]||'#8b949e'}">${escHtml(c)}</span>`
    ).join("");

    const countries = (d.countries || []).join(" · ");

    return `
      <div class="brief-region-card" style="--region-color:${color}">
        <div class="brief-region-card-title">
          ${escHtml(reg)}
          <span class="brief-count-badge">${d.count} ${t("articles")}</span>
        </div>
        ${countries ? `<div class="brief-countries">${escHtml(countries)}</div>` : ""}
        <div class="brief-themes">${themeHtml}</div>
        <ul class="brief-bullets">${bulletHtml}</ul>
        <div class="brief-headlines">${hlHtml}</div>
        <div class="brief-region-row">${catChips}</div>
      </div>`;
  }).join("");

  return `<div class="brief-region-grid">${cards}</div>`;
}

// Map a possibly-translated region name back to its EN key for colour lookup
const _enRegName = (() => {
  const fr2en = {};
  ["Global","North America","Europe","Asia-Pacific","Middle East & Africa","Latin America"].forEach(en => {
    fr2en[t(en)] = en;
  });
  return (name) => fr2en[name] || name;
})();

// ── Matrix HTML ─────────────────────────────────────────────────────────
function _buildMatrixHTML(brief) {
  const cats    = Object.keys(brief.by_category);
  const regions = brief.regions || Object.keys(brief.by_region);
  if (!cats.length || !regions.length) return `<p style="color:var(--text-dim)">${t("noData")}</p>`;

  const thead = `<tr>
    <th class="cat-header">${isFrench() ? "Catégorie \\ Région" : "Category \\ Region"}</th>
    ${regions.map(r => `<th style="color:${REGION_COLORS[r]||REGION_COLORS[_enRegName(r)]||'#39d3bb'}">${escHtml(r)}</th>`).join("")}
  </tr>`;

  const rows = cats.map(cat => {
    const catColor = CAT_COLORS[cat] || CAT_COLORS[_enCatName(cat)] || "#8b949e";
    const cells = regions.map(reg => {
      const cell = (brief.matrix[cat] || {})[reg];
      if (!cell) return `<td><span class="matrix-cell-empty">—</span></td>`;

      const kws = (cell.hot_keywords || []).map(k =>
        `<span class="matrix-kw">${escHtml(k)}</span>`
      ).join("");

      const headlines = (cell.top_headlines || []).map(h =>
        `<a class="matrix-headline" href="${escHtml(h.url)}" target="_blank" rel="noopener">${escHtml(h.title)}</a>`
      ).join("");

      return `<td>
        <div class="matrix-cell-count">${cell.count}</div>
        ${headlines}
        <div class="matrix-cell-kws">${kws}</div>
      </td>`;
    }).join("");

    return `<tr>
      <th style="color:${catColor}">${escHtml(cat)}</th>
      ${cells}
    </tr>`;
  }).join("");

  return `<div class="brief-matrix-wrap">
    <table class="brief-matrix">
      <thead>${thead}</thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── Intel Brief tab handler ─────────────────────────────────────────────
function initIntelBriefTabs() {
  const tabs = $("#intelTabs");
  if (!tabs) return;
  tabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".intel-tab");
    if (!tab) return;
    _renderBriefView(tab.dataset.view);
  });
}

// ── Error banner ────────────────────────────────────────────────────────
function showErrorBanner(msg) {
  const el = $("#errorBanner");
  el.classList.remove("hidden");
  $("#errorDetail").textContent = " " + msg;
}

function updateErrorBanner() {
  if (!_data) return;
  const errs = (_data.source_results || []).filter(r => r.status === "error");
  if (errs.length === 0) {
    $("#errorBanner").classList.add("hidden");
    return;
  }
  const names = errs.map(r => r.source_name).join(", ");
  showErrorBanner(t("errorUnav")(errs.length, names));
}

// ── Category filter ─────────────────────────────────────────────────────
function initCategoryFilter() {
  const bar = $("#catBar");
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    $$(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    _activeFilter = btn.dataset.cat;
    if (_displayData) renderCategories();
  });
}

// ── Auto status poll ────────────────────────────────────────────────────
function startPolling() {
  if (_polling) clearInterval(_polling);
  _polling = setInterval(async () => {
    try {
      const r = await fetch(STATUS_URL);
      const s = await r.json();
      if (!s.cache_valid) {
        console.log("Cache expired — auto-refreshing…");
        await loadNews(false);
      }
    } catch { /* silent */ }
  }, POLL_INTERVAL);
}

// ── PDF Export ──────────────────────────────────────────────────────────
function exportPdf() {
  if (!_displayData) return;

  const btn = $("#btnPdf");
  btn.disabled = true;
  btn.textContent = isFrench() ? "Préparation…" : "Preparing…";

  // Temporarily expand all clamped titles & summaries so the printed
  // page shows full text (the @media print rule does this too, but this
  // ensures it also works in browsers that ignore CSS clamp in print).
  const clamped = document.querySelectorAll(".card-title, .card-summary");
  clamped.forEach(el => el.style.webkitLineClamp = "unset");

  // Set a meaningful document title → becomes the default PDF filename
  const datestamp = new Date().toISOString().slice(0, 10);
  const prevTitle = document.title;
  document.title = isFrench()
    ? `Tableau-de-Bord-FS-Intelligence_${datestamp}`
    : `FS-Intelligence-Dashboard_${datestamp}`;

  // Give the browser one frame to apply layout changes, then print
  requestAnimationFrame(() => {
    setTimeout(() => {
      window.print();

      // Restore after the print dialog closes
      document.title = prevTitle;
      clamped.forEach(el => el.style.webkitLineClamp = "");
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <span data-i18n="savePdf">${t("savePdf")}</span>`;
    }, 80);
  });
}

// ── Keyboard / click handlers ───────────────────────────────────────────
function initEventHandlers() {
  $("#btnRefresh").addEventListener("click", () => loadNews(true));
  $("#btnPdf").addEventListener("click", exportPdf);
  $("#modalClose").addEventListener("click", hideModal);
  $("#modalOverlay").addEventListener("click", (e) => {
    if (e.target === $("#modalOverlay")) hideModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
  });
}

// ── Language toggle handler ──────────────────────────────────────────────
async function onLangToggle(lang) {
  if (!_data) return;
  if (lang === "fr") {
    _displayData = await _translateAndShow(_data);
  } else {
    _displayData = _data;
  }
  applyStaticStrings();
  _renderWithData(_displayData);
  _updateStatusAfterLoad(_data);
}

// ── Boot ────────────────────────────────────────────────────────────────
(function init() {
  try {
    initCategoryFilter();
    initIntelBriefTabs();
    initEventHandlers();
    initLang(onLangToggle);
    applyStaticStrings();
  } catch (e) {
    // UI init error — log but don't block news loading
    console.error("UI init error:", e);
  }
  // Always attempt to load news regardless of UI init errors
  loadNews(false);
  startPolling();
})();
