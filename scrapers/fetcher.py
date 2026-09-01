"""
Fetcher: tries RSS first, falls back to HTML scraping.
Returns a list of article dicts per source.
"""
import html
import logging
import re
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin, urlparse

import feedparser
import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = 12  # seconds
MAX_ARTICLES_PER_SOURCE = 8


def _clean_text(raw: str) -> str:
    """Strip HTML tags and normalise whitespace."""
    text = BeautifulSoup(raw or "", "lxml").get_text(separator=" ")
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _parse_date(raw: Optional[str]) -> str:
    """Try to parse a date string; return ISO string or empty."""
    if not raw:
        return ""
    try:
        dt = dateparser.parse(raw, ignoretz=False)
        if dt:
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        pass
    return raw


def _make_absolute(url: str, base: str) -> str:
    if url and not url.startswith("http"):
        return urljoin(base, url)
    return url


# ── RSS fetcher ─────────────────────────────────────────────────────────────

def _fetch_rss(source: Dict) -> List[Dict[str, Any]]:
    rss_url = source.get("rss")
    if not rss_url:
        return []
    try:
        feed = feedparser.parse(
            rss_url,
            request_headers={"User-Agent": HEADERS["User-Agent"]},
        )
        articles = []
        for entry in feed.entries[:MAX_ARTICLES_PER_SOURCE]:
            title = _clean_text(entry.get("title", ""))
            link = entry.get("link", "")

            # Google News returns redirect URLs — extract the real URL
            # Pattern: https://news.google.com/rss/articles/...?url=<actual>
            if "news.google.com" in link:
                from urllib.parse import urlparse, parse_qs
                qs = parse_qs(urlparse(link).query)
                real = qs.get("url", [None])[0]
                if real:
                    link = real

            summary = _clean_text(
                entry.get("summary", "") or entry.get("description", "")
            )
            # Remove "Read more" trailing noise
            summary = re.sub(r"\[?read\s+more\.?\]?", "", summary, flags=re.I).strip()
            # Trim long summaries
            if len(summary) > 350:
                summary = summary[:347] + "…"

            published = _parse_date(
                entry.get("published") or entry.get("updated", "")
            )
            if not title or not link:
                continue
            articles.append(
                {
                    "title": title,
                    "url": link,
                    "summary": summary,
                    "published": published,
                    "source_id": source["id"],
                    "source_name": source["name"],
                    "category": source["category"],
                    "method": "rss",
                }
            )
        return articles
    except Exception as exc:
        logger.warning("RSS fetch failed for %s: %s", source["name"], exc)
        return []


# ── HTML scraper ─────────────────────────────────────────────────────────────

def _fetch_html(source: Dict) -> List[Dict[str, Any]]:
    cfg = source.get("scrape", {})
    if not cfg:
        return []
    try:
        resp = requests.get(
            source["url"],
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")
        base_url = source["url"]

        # Try each selector in the list (comma-separated CSS)
        articles_raw = []
        for sel in cfg["article_selector"].split(","):
            sel = sel.strip()
            found = soup.select(sel)
            if found:
                articles_raw = found[:MAX_ARTICLES_PER_SOURCE * 3]
                break

        articles = []
        seen_titles: set = set()

        for node in articles_raw:
            # Title
            title_el = None
            for sel in cfg["title_selector"].split(","):
                title_el = node.select_one(sel.strip())
                if title_el:
                    break
            title = _clean_text(title_el.get_text()) if title_el else ""
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)

            # Link
            link_el = node.select_one("a")
            href = link_el.get("href", "") if link_el else ""
            url = _make_absolute(href, base_url)
            if not url:
                continue

            # Summary
            summary = ""
            for sel in cfg["summary_selector"].split(","):
                summary_el = node.select_one(sel.strip())
                if summary_el:
                    summary = _clean_text(summary_el.get_text())
                    break
            if len(summary) > 350:
                summary = summary[:347] + "…"

            # Date (best-effort)
            date_el = node.select_one("time")
            published = ""
            if date_el:
                published = _parse_date(
                    date_el.get("datetime") or date_el.get_text()
                )

            articles.append(
                {
                    "title": title,
                    "url": url,
                    "summary": summary,
                    "published": published,
                    "source_id": source["id"],
                    "source_name": source["name"],
                    "category": source["category"],
                    "method": "scrape",
                }
            )
            if len(articles) >= MAX_ARTICLES_PER_SOURCE:
                break

        return articles
    except Exception as exc:
        logger.warning("HTML scrape failed for %s: %s", source["name"], exc)
        return []


# ── Public interface ─────────────────────────────────────────────────────────

def fetch_source(source: Dict) -> Dict[str, Any]:
    """
    Fetch articles for one source. Returns a result dict with:
      - source_id, source_name, category
      - articles: list of article dicts
      - status: 'ok' | 'partial' | 'error'
      - error: optional message
    """
    start = time.time()
    articles = _fetch_rss(source)
    method_used = "rss"

    if not articles:
        articles = _fetch_html(source)
        method_used = "scrape"

    elapsed = round(time.time() - start, 2)

    status = "ok" if articles else "error"
    error_msg = "" if articles else f"No articles retrieved (tried RSS + HTML scrape)"

    logger.info(
        "[%s] %s — %d articles via %s in %.2fs",
        status.upper(),
        source["name"],
        len(articles),
        method_used,
        elapsed,
    )

    return {
        "source_id": source["id"],
        "source_name": source["name"],
        "source_url": source["url"],
        "category": source["category"],
        "articles": articles,
        "count": len(articles),
        "method": method_used,
        "elapsed": elapsed,
        "status": status,
        "error": error_msg,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
