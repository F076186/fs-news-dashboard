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
  "Banking News":        "#2f81f7",
  "Insurance":           "#3fb950",
  "FinTech & Innovation":"#a371f7",
  "Strategy & Consulting":"#d29922",
  "Regulation":          "#f85149",
};

// ── State ───────────────────────────────────────────────────────────────
let _data          = null;
let _activeFilter  = "all";
let _polling       = null;

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
  btn.disabled = loading;
  btn.classList.toggle("spinning", loading);
  btn.querySelector("svg").style.animation = loading ? "spin .8s linear infinite" : "";
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now - d) / 36e5;
    if (diffH < 1) return Math.round(diffH * 60) + "m ago";
    if (diffH < 24) return Math.round(diffH) + "h ago";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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
  setStatusPill("Loading…", "loading");
  setRefreshBtn(true);
  initSourceDots(19);

  const url = force ? API_URL + "?refresh=1" : API_URL;
  // Animate dots progressively while waiting
  let dotIdx = 0;
  const dotTimer = setInterval(() => {
    if (dotIdx < 19) { tickDot(dotIdx++, "ok"); }
  }, 350);

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    _data = await resp.json();

    clearInterval(dotTimer);
    // Mark remaining dots
    while (dotIdx < 19) { tickDot(dotIdx++, "ok"); }

    render();
    const fetched = _data.fetched_at
      ? new Date(_data.fetched_at).toLocaleTimeString("en-GB")
      : "";
    $("#lastUpdated").textContent = fetched ? "Last updated " + fetched : "";

    const errCount = _data.sources_error || 0;
    if (errCount > 0) {
      setStatusPill(
        `${_data.sources_ok}/${_data.total_sources} sources · ${errCount} failed`,
        "err"
      );
    } else {
      setStatusPill(`${_data.sources_ok}/${_data.total_sources} sources · ${_data.total_articles} articles`, "ok");
    }
  } catch (err) {
    clearInterval(dotTimer);
    console.error("Load failed:", err);
    setStatusPill("Load failed", "err");
    showErrorBanner("Failed to load news: " + err.message);
  } finally {
    hideOverlay();
    setRefreshBtn(false);
  }
}

// ── Render ──────────────────────────────────────────────────────────────
function render() {
  if (!_data) return;
  renderStats();
  renderCategories();
  updateErrorBanner();
}

function renderStats() {
  const bar = $("#statsBar");
  const d   = _data;
  bar.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Articles</div>
      <div class="stat-value accent">${d.total_articles || 0}</div>
      <div class="stat-sub">across all sources</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Sources Active</div>
      <div class="stat-value green">${d.sources_ok || 0}</div>
      <div class="stat-sub">of ${d.total_sources || 0} monitored</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Sources Failed</div>
      <div class="stat-value ${d.sources_error > 0 ? "red" : "green"}">${d.sources_error || 0}</div>
      <div class="stat-sub">${d.sources_error > 0 ? "check network / site availability" : "all sources responding"}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Categories</div>
      <div class="stat-value orange">${(d.categories || []).length}</div>
      <div class="stat-sub">industry segments covered</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Refresh Cadence</div>
      <div class="stat-value" style="font-size:18px;color:var(--teal)">15 min</div>
      <div class="stat-sub">auto-refresh · RSS + HTML fallback</div>
    </div>
  `;
}

function renderCategories() {
  const container = $("#categorySections");
  container.innerHTML = "";

  const summaries = _data.category_summaries || {};
  const cats      = _data.categories || Object.keys(summaries);

  for (const cat of cats) {
    if (_activeFilter !== "all" && _activeFilter !== cat) continue;
    const info = summaries[cat];
    if (!info) continue;

    const color = CAT_COLORS[cat] || "#8b949e";
    const section = document.createElement("section");
    section.className = "category-section";
    section.dataset.cat = cat;

    // Keywords chips
    const kwHtml = (info.keywords || []).slice(0, 8).map(k =>
      `<span class="kw-tag">${escHtml(k)}</span>`
    ).join("");

    // Source badges
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
        <span class="cat-count">${info.count || 0} articles</span>
        <div class="cat-keywords">${kwHtml}</div>
      </div>
      <div class="source-status-row">${srcBadges}</div>
      <div class="articles-grid" id="grid-${escHtml(cat.replace(/\s+/g,"-"))}"></div>
    `;

    container.appendChild(section);

    // Render article cards
    const gridId = "grid-" + cat.replace(/\s+/g, "-");
    const grid   = document.getElementById(gridId);
    const articles = info.articles || [];

    if (articles.length === 0) {
      grid.innerHTML = `<div class="empty-state">No articles retrieved from this category.</div>`;
    } else {
      for (const a of articles) {
        grid.appendChild(makeCard(a, color));
      }
    }
  }
}

function makeCard(article, catColor) {
  const card = document.createElement("article");
  card.className = "article-card";
  card.style.setProperty("--cat-color", catColor);

  const date  = fmtDate(article.published);
  const title = escHtml(article.title);
  const src   = escHtml(article.source_name);
  const sum   = escHtml(article.summary || "");
  const meth  = article.method === "rss" ? "RSS" : "Web";

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
      <span class="card-read-link">Read article →</span>
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
    article.method === "rss" ? "via RSS" : "via web"
  ].filter(Boolean).join(" · ");
  $("#modalSummary").textContent = article.summary || "No summary available.";
  $("#modalLink").href            = article.url;
  showModal();
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
  showErrorBanner(`${errs.length} source(s) unavailable: ${names}`);
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
    if (_data) renderCategories();
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

// ── Keyboard / click handlers ───────────────────────────────────────────
function initEventHandlers() {
  $("#btnRefresh").addEventListener("click", () => loadNews(true));
  $("#modalClose").addEventListener("click", hideModal);
  $("#modalOverlay").addEventListener("click", (e) => {
    if (e.target === $("#modalOverlay")) hideModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
  });
}

// ── Boot ────────────────────────────────────────────────────────────────
(function init() {
  initCategoryFilter();
  initEventHandlers();
  loadNews(false);
  startPolling();
})();
