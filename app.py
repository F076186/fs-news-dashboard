"""
Flask backend for the Financial Services News Dashboard.
Serves the UI and exposes a JSON API for live refresh.
"""
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

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


def _is_cache_valid() -> bool:
    if not _cache:
        return False
    age = time.time() - _cache.get("_cached_at", 0)
    return age < _cache_ttl


def _refresh_cache():
    logger.info("Refreshing news cache…")
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


def _background_refresh():
    """Warm the cache on startup in a background thread."""
    _refresh_cache()


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template(
        "index.html",
        categories=CATEGORIES,
        sources=SOURCES,
    )


@app.route("/api/news")
def api_news():
    """
    Returns all aggregated news data as JSON.
    Query params:
      - refresh=1  → force a live re-fetch (ignores cache)
      - category=<name>  → filter by category
    """
    force = request.args.get("refresh", "0") == "1"

    if force or not _is_cache_valid():
        _refresh_cache()

    with _cache_lock:
        data = dict(_cache)

    # Optional category filter
    cat_filter = request.args.get("category", "").strip()
    if cat_filter and cat_filter in data.get("category_summaries", {}):
        filtered_summaries = {cat_filter: data["category_summaries"][cat_filter]}
        filtered_articles = [
            a for a in data.get("all_articles", [])
            if a["category"] == cat_filter
        ]
        data = dict(data)
        data["category_summaries"] = filtered_summaries
        data["all_articles"] = filtered_articles

    # Remove internal key
    data.pop("_cached_at", None)
    return jsonify(data)


@app.route("/api/status")
def api_status():
    with _cache_lock:
        cached_at = _cache.get("_cached_at", 0)
        total = _cache.get("total_articles", 0)
        sources_ok = _cache.get("sources_ok", 0)
        sources_err = _cache.get("sources_error", 0)

    age_s = int(time.time() - cached_at) if cached_at else -1
    return jsonify(
        {
            "status": "ok",
            "cache_age_seconds": age_s,
            "cache_valid": _is_cache_valid(),
            "total_articles": total,
            "sources_ok": sources_ok,
            "sources_error": sources_err,
            "utc_now": datetime.now(timezone.utc).isoformat(),
        }
    )


# ── Startup ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Warm cache in background so the UI shows immediately
    t = threading.Thread(target=_background_refresh, daemon=True)
    t.start()

    logger.info("Starting FS News Dashboard on http://127.0.0.1:5050")
    app.run(host="127.0.0.1", port=5050, debug=False, use_reloader=False)
