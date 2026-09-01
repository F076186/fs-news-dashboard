/* ═══════════════════════════════════════════════════════════════════
   i18n.js — EN/FR translation module
   Exports: initLang(), t(key), translateContent(data) → data_fr
   ═══════════════════════════════════════════════════════════════════ */

"use strict";

// ── Static UI string tables ─────────────────────────────────────────────
const STRINGS = {
  en: {
    // Header / controls
    savePdf:        "Save PDF",
    refresh:        "Refresh",
    loadingTitle:   "Fetching Financial Intelligence",
    loadingMsg:     "Connecting to 18 sources across Banking, Insurance, FinTech & Regulatory bodies…",
    translatingMsg: "Translating to French…",
    lastUpdatedPfx: "Last updated ",
    // Status pill
    statusLoading:  "Loading…",
    statusOk:       (ok, total, art) => `${ok}/${total} sources · ${art} articles`,
    statusErr:      (ok, total, failed) => `${ok}/${total} sources · ${failed} failed`,
    statusFailed:   "Load failed",
    // Category filter
    all:            "All",
    // Stats bar
    statArticles:    "Total Articles",
    statArticlesSub: "across all sources",
    statActive:      "Sources Active",
    statActiveSub:   (n) => `of ${n} monitored`,
    statFailed:      "Sources Failed",
    statFailedOk:    "all sources responding",
    statFailedErr:   "check network / site availability",
    statCats:        "Categories",
    statCatsSub:     "industry segments covered",
    statRefresh:     "Refresh Cadence",
    statRefreshSub:  "auto-refresh · RSS + HTML fallback",
    // Category names
    "Banking News":          "Banking News",
    "FinTech & Innovation":  "FinTech & Innovation",
    "Insurance":             "Insurance",
    "Regulation":            "Regulation",
    "Strategy & Consulting": "Strategy & Consulting",
    // Brief
    briefTitle:   "Intelligence Brief",
    briefSub:     "Structured digest · by category & region",
    tabCategory:  "By Category",
    tabRegion:    "By Region",
    tabMatrix:    "Category × Region",
    articles:     "articles",
    // Card
    readArticle:  "Read article →",
    rss:          "RSS",
    web:          "Web",
    // Modal
    viaRss:       "via RSS",
    viaWeb:       "via web",
    readFull:     "Read full article →",
    noSummary:    "No summary available.",
    // Error
    errorSources: "⚠ Some sources failed to load.",
    errorLoad:    "Failed to load news: ",
    errorUnav:    (n, names) => `${n} source(s) unavailable: ${names}`,
    // Brief detail
    noData:       "No data yet.",
  },
  fr: {
    // Header / controls
    savePdf:        "Enregistrer PDF",
    refresh:        "Actualiser",
    loadingTitle:   "Récupération des données financières",
    loadingMsg:     "Connexion à 18 sources : Banque, Assurance, FinTech & Régulateurs…",
    translatingMsg: "Traduction en français…",
    lastUpdatedPfx: "Mis à jour le ",
    // Status pill
    statusLoading:  "Chargement…",
    statusOk:       (ok, total, art) => `${ok}/${total} sources · ${art} articles`,
    statusErr:      (ok, total, failed) => `${ok}/${total} sources · ${failed} en échec`,
    statusFailed:   "Échec du chargement",
    // Category filter
    all:            "Tout",
    // Stats bar
    statArticles:    "Total Articles",
    statArticlesSub: "toutes sources confondues",
    statActive:      "Sources Actives",
    statActiveSub:   (n) => `sur ${n} surveillées`,
    statFailed:      "Sources en Échec",
    statFailedOk:    "toutes les sources répondent",
    statFailedErr:   "vérifier le réseau / disponibilité",
    statCats:        "Catégories",
    statCatsSub:     "segments sectoriels couverts",
    statRefresh:     "Fréquence d'actualisation",
    statRefreshSub:  "rafraîchissement auto · RSS + HTML",
    // Category names
    "Banking News":          "Actualités Bancaires",
    "FinTech & Innovation":  "FinTech & Innovation",
    "Insurance":             "Assurance",
    "Regulation":            "Réglementation",
    "Strategy & Consulting": "Stratégie & Conseil",
    // Brief
    briefTitle:   "Synthèse Intelligence",
    briefSub:     "Digest structuré · par catégorie & région",
    tabCategory:  "Par Catégorie",
    tabRegion:    "Par Région",
    tabMatrix:    "Catégorie × Région",
    articles:     "articles",
    // Card
    readArticle:  "Lire l'article →",
    rss:          "RSS",
    web:          "Web",
    // Modal
    viaRss:       "via RSS",
    viaWeb:       "via web",
    readFull:     "Lire l'article complet →",
    noSummary:    "Aucun résumé disponible.",
    // Error
    errorSources: "⚠ Certaines sources n'ont pas pu être chargées.",
    errorLoad:    "Échec du chargement : ",
    errorUnav:    (n, names) => `${n} source(s) indisponible(s) : ${names}`,
    // Brief detail
    noData:       "Aucune donnée disponible.",
    // Theme labels (mapped from English)
    "Regulatory & Compliance":      "Réglementation & Conformité",
    "Digital & AI Innovation":      "Innovation Numérique & IA",
    "Risk & Financial Stability":   "Risque & Stabilité Financière",
    "Markets & Investment":         "Marchés & Investissement",
    "Insurance & Re/Insurance":     "Assurance & Réassurance",
    "Banking & Lending":            "Banque & Crédit",
    "Payments & Infrastructure":    "Paiements & Infrastructure",
    "ESG & Sustainability":         "ESG & Durabilité",
    "M&A & Strategy":               "Fusions-Acquisitions & Stratégie",
    "Consumer & Retail FS":         "Services Financiers Grand Public",
    // Region labels
    "Global":                 "Mondial",
    "North America":          "Amérique du Nord",
    "Europe":                 "Europe",
    "Asia-Pacific":           "Asie-Pacifique",
    "Middle East & Africa":   "Moyen-Orient & Afrique",
    "Latin America":          "Amérique Latine",
    // Country labels
    "United States":    "États-Unis",
    "United Kingdom":   "Royaume-Uni",
    "European Union":   "Union Européenne",
    "France":           "France",
    "Global":           "Mondial",
  },
};

// ── State ───────────────────────────────────────────────────────────────
let _lang = "en";

// Client-side translation cache: text → translated text
const _txCache = {};

// ── Accessor ────────────────────────────────────────────────────────────
/**
 * Return the UI string for `key` in the active language.
 * If key not found, return the English fallback, else the key itself.
 */
function t(key) {
  return STRINGS[_lang][key] ?? STRINGS["en"][key] ?? key;
}

function getLang()   { return _lang; }
function isFrench()  { return _lang === "fr"; }

// ── DOM string applicator ────────────────────────────────────────────────
/**
 * Walk all [data-i18n] elements and replace their textContent.
 */
function applyStaticStrings() {
  // Static [data-i18n] elements
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const val = t(key);
    if (typeof val === "string") el.textContent = val;
  });

  // Refresh button — contains an SVG so we only swap the trailing text node
  const btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) {
    // Find the last text node (after the SVG)
    const textNode = [...btnRefresh.childNodes]
      .reverse()
      .find(n => n.nodeType === 3 /* TEXT_NODE */);
    if (textNode) textNode.nodeValue = " " + t("refresh");
  }

  // Category filter "All" button
  const allBtn = document.querySelector('.cat-btn[data-cat="all"]');
  if (allBtn) allBtn.textContent = t("all");

  // Category filter named buttons (rendered by Jinja with English names)
  const CAT_KEYS = ["Banking News","FinTech & Innovation","Insurance","Regulation","Strategy & Consulting"];
  document.querySelectorAll(".cat-btn[data-cat]").forEach(btn => {
    const cat = btn.getAttribute("data-cat");
    if (cat && cat !== "all" && CAT_KEYS.includes(cat)) {
      btn.textContent = t(cat);
    }
  });

  // html[lang] attribute — use document.documentElement, never getElementById
  document.documentElement.setAttribute("lang", _lang);

  // Page title
  document.title = _lang === "fr"
    ? "Tableau de Bord Intelligence Services Financiers"
    : "FS Intelligence Dashboard — Financial Services News";
}

// ── Remote translation via /api/translate ────────────────────────────────
/**
 * Translate an array of strings server-side (MyMemory API, cached).
 * Returns the same array with French translations, preserving order.
 * Strings already in cache are resolved locally without a network round-trip.
 */
async function translateBatch(texts) {
  if (_lang === "en") return texts;

  const results = new Array(texts.length);
  const toFetch  = [];   // { idx, text }

  for (let i = 0; i < texts.length; i++) {
    const txt = texts[i] || "";
    if (!txt.trim()) { results[i] = txt; continue; }
    if (_txCache[txt] !== undefined) {
      results[i] = _txCache[txt];
    } else {
      toFetch.push({ idx: i, text: txt });
    }
  }

  if (toFetch.length === 0) return results;

  // Chunk into batches of 20 to stay within MyMemory's per-request limits
  const CHUNK = 20;
  for (let c = 0; c < toFetch.length; c += CHUNK) {
    const chunk = toFetch.slice(c, c + CHUNK);
    try {
      const resp = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: chunk.map(x => x.text) }),
      });
      const json = await resp.json();
      const translations = json.translations || [];
      chunk.forEach(({ idx, text }, i) => {
        const tr = translations[i] || text;
        _txCache[text] = tr;
        results[idx] = tr;
      });
    } catch {
      // On network error keep originals
      chunk.forEach(({ idx, text }) => {
        _txCache[text] = text;
        results[idx] = text;
      });
    }
  }

  return results;
}

/**
 * Deep-translate all user-visible text fields in the data object.
 * Returns a NEW object — original is not mutated.
 * URLs are never translated.
 */
async function translateData(data) {
  if (_lang === "en") return data;

  // Collect all unique strings that need translation
  const toTranslate = new Set();

  const addStr = (s) => {
    if (s && typeof s === "string" && s.trim() && !_txCache[s]) toTranslate.add(s);
  };

  // Articles
  (data.all_articles || []).forEach(a => {
    addStr(a.title);
    addStr(a.summary);
    addStr(a.source_name);
  });

  // Brief bullets / headlines
  const brief = data.intelligence_brief || {};
  for (const d of Object.values(brief.by_category || {})) {
    (d.theme_bullets || []).forEach(addStr);
    (d.top_headlines || []).forEach(h => addStr(h.title));
  }
  for (const d of Object.values(brief.by_region || {})) {
    (d.theme_bullets || []).forEach(addStr);
    (d.top_headlines || []).forEach(h => addStr(h.title));
  }
  for (const catCells of Object.values(brief.matrix || {})) {
    for (const cell of Object.values(catCells)) {
      (cell.top_headlines || []).forEach(h => addStr(h.title));
    }
  }

  // Run translation
  const texts = [...toTranslate];
  await translateBatch(texts);
  // _txCache is now populated for all these strings

  // Build translated copy
  const tx = (s) => (s && _txCache[s] !== undefined ? _txCache[s] : s);

  // Deep-clone articles with translated fields
  const translatedArticles = (data.all_articles || []).map(a => ({
    ...a,
    title:       tx(a.title),
    summary:     tx(a.summary),
    source_name: tx(a.source_name),
  }));

  // Translate brief
  const translateBriefDigest = (d) => ({
    ...d,
    theme_bullets:  (d.theme_bullets  || []).map(tx),
    top_headlines:  (d.top_headlines  || []).map(h => ({ ...h, title: tx(h.title) })),
    themes:         (d.themes         || []).map(th => t(th) || th),
    regions_present:(d.regions_present || []).map(r => t(r) || r),
    categories_present: (d.categories_present || []).map(c => t(c) || c),
    countries:      (d.countries      || []).map(c => t(c) || c),
  });

  const translatedBrief = {
    ...brief,
    regions: (brief.regions || []).map(r => t(r) || r),
    by_category: Object.fromEntries(
      Object.entries(brief.by_category || {}).map(([cat, d]) => [t(cat) || cat, translateBriefDigest(d)])
    ),
    by_region: Object.fromEntries(
      Object.entries(brief.by_region || {}).map(([reg, d]) => [t(reg) || reg, translateBriefDigest(d)])
    ),
    matrix: Object.fromEntries(
      Object.entries(brief.matrix || {}).map(([cat, regions]) => [
        t(cat) || cat,
        Object.fromEntries(
          Object.entries(regions).map(([reg, cell]) => [
            t(reg) || reg,
            {
              ...cell,
              top_headlines: (cell.top_headlines || []).map(h => ({ ...h, title: tx(h.title) })),
            },
          ])
        ),
      ])
    ),
  };

  // Translate category_summaries
  const translatedCatSummaries = Object.fromEntries(
    Object.entries(data.category_summaries || {}).map(([cat, info]) => {
      const translatedSources = (info.sources || []).map(s => ({
        ...s, name: tx(s.name),
      }));
      const translatedArtsCat = (info.articles || []).map(a => ({
        ...a,
        title:       tx(a.title),
        summary:     tx(a.summary),
        source_name: tx(a.source_name),
      }));
      return [
        t(cat) || cat,
        { ...info, sources: translatedSources, articles: translatedArtsCat },
      ];
    })
  );

  return {
    ...data,
    categories: (data.categories || []).map(c => t(c) || c),
    all_articles: translatedArticles,
    intelligence_brief: translatedBrief,
    category_summaries: translatedCatSummaries,
  };
}

// ── Language toggle ──────────────────────────────────────────────────────
function initLang(onToggle) {
  const btn   = document.getElementById("btnLang");
  const flag  = btn.querySelector(".lang-flag");
  const label = document.getElementById("langLabel");

  btn.addEventListener("click", async () => {
    _lang = _lang === "en" ? "fr" : "en";

    // Update button appearance
    if (_lang === "fr") {
      flag.textContent  = "🇫🇷";
      label.textContent = "EN";
      btn.classList.add("fr-active");
      btn.title = "Switch to English";
    } else {
      flag.textContent  = "🇬🇧";
      label.textContent = "FR";
      btn.classList.remove("fr-active");
      btn.title = "Changer en français";
    }

    applyStaticStrings();
    await onToggle(_lang);
  });

  // Initialise tooltip
  btn.title = "Changer en français";
}

// Export
window.i18n = { t, getLang, isFrench, applyStaticStrings, translateData, initLang, translateBatch };
