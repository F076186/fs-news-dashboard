"""
Flask backend for the Financial Services News Dashboard.
Serves the UI and exposes a JSON API for live refresh.
All JS/CSS is inlined in the template — no external static file loading.
"""
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import requests as _requests
from flask import Flask, jsonify, render_template, request

from scrapers.aggregator import aggregate_all
from scrapers.sources import CATEGORIES, SOURCES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)

# ── In-memory cache ──────────────────────────────────────────────────────────
_cache_lock = threading.Lock()
_cache: dict = {}
_cache_ttl = 15 * 60  # 15 minutes
_warming = threading.Event()


def _is_cache_valid() -> bool:
    if not _cache:
        return False
    age = time.time() - _cache.get("_cached_at", 0)
    return age < _cache_ttl


def _refresh_cache():
    logger.info("Refreshing news cache…")
    _warming.set()
    try:
        data = aggregate_all()
        with _cache_lock:
            _cache.clear()
            _cache.update(data)
            _cache["_cached_at"] = time.time()
        logger.info(
            "Cache updated — %d articles from %d sources",
            data["total_articles"],
            data["total_sources"],
        )
    finally:
        _warming.clear()


def _background_refresh():
    _refresh_cache()


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", categories=CATEGORIES, sources=SOURCES)


@app.route("/api/news")
def api_news():
    force = request.args.get("refresh", "0") == "1"
    if force:
        _refresh_cache()
    elif not _is_cache_valid():
        if _warming.is_set():
            return jsonify({"warming": True}), 202
        else:
            _refresh_cache()

    with _cache_lock:
        data = dict(_cache)

    cat_filter = request.args.get("category", "").strip()
    if cat_filter and cat_filter in data.get("category_summaries", {}):
        data = dict(data)
        data["category_summaries"] = {cat_filter: data["category_summaries"][cat_filter]}
        data["all_articles"] = [a for a in data.get("all_articles", []) if a["category"] == cat_filter]

    data.pop("_cached_at", None)
    return jsonify(data)


# ── Translation endpoint ─────────────────────────────────────────────────────
_translation_cache: dict = {}
_translation_lock = threading.Lock()
_MYMEMORY_URL = "https://api.mymemory.translated.net/get"


def _translate_text(text: str, src: str = "en", tgt: str = "fr") -> str:
    if not text or not text.strip():
        return text
    key = f"{src}:{tgt}:{text}"
    with _translation_lock:
        if key in _translation_cache:
            return _translation_cache[key]
    try:
        resp = _requests.get(_MYMEMORY_URL, params={"q": text, "langpair": f"{src}|{tgt}"}, timeout=8)
        data = resp.json()
        translated = data.get("responseData", {}).get("translatedText", "")
        result = translated if (translated and data.get("responseStatus") == 200) else text
    except Exception:
        result = text
    with _translation_lock:
        _translation_cache[key] = result
    return result


@app.route("/api/translate", methods=["POST"])
def api_translate():
    body = request.get_json(force=True, silent=True) or {}
    texts = body.get("texts", [])
    if not isinstance(texts, list):
        return jsonify({"error": "texts must be a list"}), 400
    return jsonify({"translations": [_translate_text(str(t)) for t in texts]})


@app.route("/api/status")
def api_status():
    with _cache_lock:
        cached_at = _cache.get("_cached_at", 0)
        total = _cache.get("total_articles", 0)
        sources_ok = _cache.get("sources_ok", 0)
        sources_err = _cache.get("sources_error", 0)
    age_s = int(time.time() - cached_at) if cached_at else -1
    return jsonify({
        "status": "ok",
        "cache_age_seconds": age_s,
        "cache_valid": _is_cache_valid(),
        "warming": _warming.is_set(),
        "total_articles": total,
        "sources_ok": sources_ok,
        "sources_error": sources_err,
        "utc_now": datetime.now(timezone.utc).isoformat(),
    })


# ── Startup ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    t = threading.Thread(target=_background_refresh, daemon=True)
    t.start()
    logger.info("Starting FS News Dashboard on http://127.0.0.1:5050")
    app.run(host="127.0.0.1", port=5050, debug=False, use_reloader=False)
