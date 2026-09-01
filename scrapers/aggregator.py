"""
Aggregator: runs all sources concurrently, groups results, computes category summaries.
"""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Dict, List, Any

from scrapers.fetcher import fetch_source
from scrapers.sources import SOURCES, CATEGORIES
from scrapers.brief import build_intelligence_brief

logger = logging.getLogger(__name__)

MAX_WORKERS = 10  # concurrent HTTP connections


def _summarise_category(articles: List[Dict]) -> Dict:
    """Build a structured category summary from article list."""
    if not articles:
        return {"count": 0, "top_titles": [], "keywords": []}

    titles = [a["title"] for a in articles[:10]]

    # Simple keyword extraction: most common meaningful words across titles
    stop = {
        "the", "a", "an", "of", "in", "to", "for", "and", "or", "is", "are",
        "was", "on", "at", "by", "as", "it", "its", "with", "from", "that",
        "this", "be", "new", "will", "has", "have", "how", "why", "what",
        "who", "when", "after", "more", "their", "than", "not", "over",
        "amid", "says", "could", "would", "into", "amid", "s", "we", "you",
    }
    word_freq: Dict[str, int] = {}
    for a in articles:
        text = (a["title"] + " " + a.get("summary", "")).lower()
        for w in text.split():
            w = w.strip(".,;:!?\"'()[]{}")
            if len(w) > 3 and w not in stop:
                word_freq[w] = word_freq.get(w, 0) + 1

    top_keywords = sorted(word_freq, key=word_freq.get, reverse=True)[:12]

    return {
        "count": len(articles),
        "top_titles": titles[:5],
        "keywords": top_keywords,
    }


def aggregate_all() -> Dict[str, Any]:
    """
    Fetch all sources concurrently, return structured aggregated data.
    """
    source_results: List[Dict] = []
    errors: List[Dict] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {executor.submit(fetch_source, s): s for s in SOURCES}
        for future in as_completed(future_map):
            try:
                result = future.result()
                source_results.append(result)
            except Exception as exc:
                src = future_map[future]
                logger.error("Unexpected error for %s: %s", src["name"], exc)
                errors.append({
                    "source_id": src["id"],
                    "source_name": src["name"],
                    "category": src["category"],
                    "error": str(exc),
                    "articles": [],
                    "count": 0,
                    "status": "error",
                })

    # Combine
    all_results = source_results + errors

    # Group by category
    by_category: Dict[str, List] = {c: [] for c in CATEGORIES}
    all_articles: List[Dict] = []

    for res in all_results:
        cat = res.get("category", "Other")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(res)
        all_articles.extend(res.get("articles", []))

    # Category summaries
    category_summaries = {}
    for cat, results in by_category.items():
        cat_articles = []
        for r in results:
            cat_articles.extend(r.get("articles", []))
        summary = _summarise_category(cat_articles)
        summary["sources"] = [
            {
                "id": r["source_id"],
                "name": r["source_name"],
                "url": r.get("source_url", ""),
                "count": r["count"],
                "status": r["status"],
                "error": r.get("error", ""),
                "method": r.get("method", ""),
                "elapsed": r.get("elapsed", 0),
            }
            for r in results
        ]
        summary["articles"] = cat_articles
        category_summaries[cat] = summary

    # Overall stats
    total_ok = sum(1 for r in all_results if r["status"] == "ok")
    total_err = sum(1 for r in all_results if r["status"] == "error")

    # Intelligence brief (category × region structured digest)
    intelligence_brief = build_intelligence_brief(all_articles)

    return {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "total_sources": len(SOURCES),
        "sources_ok": total_ok,
        "sources_error": total_err,
        "total_articles": len(all_articles),
        "categories": CATEGORIES,
        "category_summaries": category_summaries,
        "all_articles": all_articles,
        "source_results": all_results,
        "intelligence_brief": intelligence_brief,
    }
