/* i18n.js — EN/FR strings, no "use strict", no modern syntax that breaks old Safari */

var STRINGS = {
  en: {
    savePdf: "Save PDF", refresh: "Refresh",
    loadingTitle: "Fetching Financial Intelligence",
    loadingMsg: "Connecting to 18 sources across Banking, Insurance, FinTech & Regulatory bodies\u2026",
    translatingMsg: "Translating to French\u2026",
    lastUpdatedPfx: "Last updated ",
    statusLoading: "Loading\u2026", statusFailed: "Load failed",
    all: "All",
    statArticles: "Total Articles", statArticlesSub: "across all sources",
    statActive: "Sources Active", statFailed: "Sources Failed",
    statFailedOk: "all sources responding", statFailedErr: "check network / site availability",
    statCats: "Categories", statCatsSub: "industry segments covered",
    statRefresh: "Refresh Cadence", statRefreshSub: "auto-refresh \xb7 RSS + HTML fallback",
    "Banking News": "Banking News", "FinTech & Innovation": "FinTech & Innovation",
    "Insurance": "Insurance", "Regulation": "Regulation",
    "Strategy & Consulting": "Strategy & Consulting",
    briefTitle: "Intelligence Brief", briefSub: "Structured digest \xb7 by category & region",
    tabCategory: "By Category", tabRegion: "By Region", tabMatrix: "Category \xd7 Region",
    articles: "articles", readArticle: "Read article \u2192",
    rss: "RSS", web: "Web",
    viaRss: "via RSS", viaWeb: "via web",
    readFull: "Read full article \u2192", noSummary: "No summary available.",
    errorSources: "\u26a0 Some sources failed to load.", errorLoad: "Failed to load news: ",
    noData: "No data yet."
  },
  fr: {
    savePdf: "Enregistrer PDF", refresh: "Actualiser",
    loadingTitle: "R\xe9cup\xe9ration des donn\xe9es financi\xe8res",
    loadingMsg: "Connexion \xe0 18 sources : Banque, Assurance, FinTech & R\xe9gulateurs\u2026",
    translatingMsg: "Traduction en fran\xe7ais\u2026",
    lastUpdatedPfx: "Mis \xe0 jour le ",
    statusLoading: "Chargement\u2026", statusFailed: "\xc9chec du chargement",
    all: "Tout",
    statArticles: "Total Articles", statArticlesSub: "toutes sources confondues",
    statActive: "Sources Actives", statFailed: "Sources en \xc9chec",
    statFailedOk: "toutes les sources r\xe9pondent", statFailedErr: "v\xe9rifier le r\xe9seau",
    statCats: "Cat\xe9gories", statCatsSub: "segments sectoriels couverts",
    statRefresh: "Fr\xe9quence d'actualisation", statRefreshSub: "rafra\xeechissement auto \xb7 RSS + HTML",
    "Banking News": "Actualit\xe9s Bancaires", "FinTech & Innovation": "FinTech & Innovation",
    "Insurance": "Assurance", "Regulation": "R\xe9glementation",
    "Strategy & Consulting": "Strat\xe9gie & Conseil",
    briefTitle: "Synth\xe8se Intelligence", briefSub: "Digest structur\xe9 \xb7 par cat\xe9gorie & r\xe9gion",
    tabCategory: "Par Cat\xe9gorie", tabRegion: "Par R\xe9gion", tabMatrix: "Cat\xe9gorie \xd7 R\xe9gion",
    articles: "articles", readArticle: "Lire l'article \u2192",
    rss: "RSS", web: "Web",
    viaRss: "via RSS", viaWeb: "via web",
    readFull: "Lire l'article complet \u2192", noSummary: "Aucun r\xe9sum\xe9 disponible.",
    errorSources: "\u26a0 Certaines sources n'ont pas pu \xeatre charg\xe9es.",
    errorLoad: "\xc9chec du chargement : ", noData: "Aucune donn\xe9e disponible.",
    "Global": "Mondial", "North America": "Am\xe9rique du Nord",
    "Europe": "Europe", "Asia-Pacific": "Asie-Pacifique",
    "Middle East & Africa": "Moyen-Orient & Afrique", "Latin America": "Am\xe9rique Latine",
    "United States": "\xc9tats-Unis", "United Kingdom": "Royaume-Uni",
    "European Union": "Union Europ\xe9enne", "France": "France"
  }
};

var _lang = "en";
var _txCache = {};

function t(key) {
  var s = STRINGS[_lang];
  if (s && s[key] !== undefined) return s[key];
  var e = STRINGS["en"];
  if (e && e[key] !== undefined) return e[key];
  return key;
}

function getLang()  { return _lang; }
function isFrench() { return _lang === "fr"; }

function applyStaticStrings() {
  var els = document.querySelectorAll("[data-i18n]");
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var key = el.getAttribute("data-i18n");
    var val = t(key);
    if (typeof val === "string") el.textContent = val;
  }
  var btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) {
    var nodes = btnRefresh.childNodes;
    for (var j = nodes.length - 1; j >= 0; j--) {
      if (nodes[j].nodeType === 3) { nodes[j].nodeValue = " " + t("refresh"); break; }
    }
  }
  var allBtn = document.querySelector('.cat-btn[data-cat="all"]');
  if (allBtn) allBtn.textContent = t("all");
  document.documentElement.setAttribute("lang", _lang);
  document.title = _lang === "fr"
    ? "Tableau de Bord Intelligence Services Financiers"
    : "FS Intelligence Dashboard \u2014 Financial Services News";
}

function translateBatch(texts) {
  if (_lang === "en") return Promise.resolve(texts);
  var results = new Array(texts.length);
  var toFetch = [];
  for (var i = 0; i < texts.length; i++) {
    var txt = texts[i] || "";
    if (!txt.trim()) { results[i] = txt; continue; }
    if (_txCache[txt] !== undefined) { results[i] = _txCache[txt]; }
    else { toFetch.push({ idx: i, text: txt }); }
  }
  if (toFetch.length === 0) return Promise.resolve(results);
  var CHUNK = 20;
  var chain = Promise.resolve();
  for (var c = 0; c < toFetch.length; c += CHUNK) {
    (function(chunk) {
      chain = chain.then(function() {
        return fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: chunk.map(function(x) { return x.text; }) })
        }).then(function(r) { return r.json(); }).then(function(json) {
          var tr = json.translations || [];
          chunk.forEach(function(item, k) {
            var v = tr[k] || item.text;
            _txCache[item.text] = v;
            results[item.idx] = v;
          });
        }).catch(function() {
          chunk.forEach(function(item) { _txCache[item.text] = item.text; results[item.idx] = item.text; });
        });
      });
    })(toFetch.slice(c, c + CHUNK));
  }
  return chain.then(function() { return results; });
}

function translateData(data) {
  if (_lang === "en") return Promise.resolve(data);
  var toTranslate = [];
  var seen = {};
  function addStr(s) {
    if (s && typeof s === "string" && s.trim() && !_txCache[s] && !seen[s]) {
      seen[s] = true; toTranslate.push(s);
    }
  }
  (data.all_articles || []).forEach(function(a) { addStr(a.title); addStr(a.summary); addStr(a.source_name); });
  var brief = data.intelligence_brief || {};
  Object.values(brief.by_category || {}).forEach(function(d) {
    (d.theme_bullets || []).forEach(addStr);
    (d.top_headlines || []).forEach(function(h) { addStr(h.title); });
  });
  Object.values(brief.by_region || {}).forEach(function(d) {
    (d.theme_bullets || []).forEach(addStr);
    (d.top_headlines || []).forEach(function(h) { addStr(h.title); });
  });
  return translateBatch(toTranslate).then(function() {
    var tx = function(s) { return (s && _txCache[s] !== undefined) ? _txCache[s] : s; };
    return {
      total_articles: data.total_articles, total_sources: data.total_sources,
      sources_ok: data.sources_ok, sources_error: data.sources_error,
      fetched_at: data.fetched_at,
      categories: (data.categories || []).map(function(c) { return t(c) || c; }),
      all_articles: (data.all_articles || []).map(function(a) {
        return Object.assign({}, a, { title: tx(a.title), summary: tx(a.summary), source_name: tx(a.source_name) });
      }),
      intelligence_brief: data.intelligence_brief,
      category_summaries: data.category_summaries,
      source_results: data.source_results
    };
  });
}

function initLang(onToggle) {
  var btn = document.getElementById("btnLang");
  if (!btn) return;
  btn.addEventListener("click", function() {
    _lang = _lang === "en" ? "fr" : "en";
    var flag = btn.querySelector(".lang-flag");
    var label = document.getElementById("langLabel");
    if (_lang === "fr") {
      if (flag) flag.textContent = "\ud83c\uddeb\ud83c\uddf7";
      if (label) label.textContent = "EN";
    } else {
      if (flag) flag.textContent = "\ud83c\uddec\ud83c\udde7";
      if (label) label.textContent = "FR";
    }
    applyStaticStrings();
    onToggle(_lang);
  });
}

window.i18n = { t: t, getLang: getLang, isFrench: isFrench, applyStaticStrings: applyStaticStrings, translateData: translateData, initLang: initLang, translateBatch: translateBatch };
