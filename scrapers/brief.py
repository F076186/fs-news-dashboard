"""
Intelligence Brief generator.

Produces a structured digest from all fetched articles, organised by:
  1. Category  (Banking News, FinTech & Innovation, …)
  2. Region    (Global, North America, Europe, …)

For each cell (category × region) it returns:
  - headline_count  : number of articles
  - top_headlines   : up to 3 representative article titles (with source + URL)
  - theme_bullets   : 3-5 plain-English theme sentences derived from titles/summaries
  - hot_keywords    : top 6 trending words
"""

import re
import textwrap
from collections import Counter, defaultdict
from typing import Dict, List, Any

from scrapers.sources import CATEGORIES, REGION_ORDER, SOURCE_MAP


# ── stop-word list ────────────────────────────────────────────────────────────
_STOP = {
    "the", "a", "an", "of", "in", "to", "for", "and", "or", "is", "are",
    "was", "were", "on", "at", "by", "as", "it", "its", "with", "from",
    "that", "this", "be", "new", "will", "has", "have", "how", "why",
    "what", "who", "when", "after", "more", "their", "than", "not", "over",
    "amid", "says", "could", "would", "into", "amid", "s", "we", "you",
    "but", "also", "year", "up", "down", "out", "first", "two", "three",
    "back", "about", "just", "can", "had", "says", "about", "get", "set",
    "may", "per", "since", "now", "us", "eu", "uk", "one", "its", "them",
    "they", "been", "being", "all", "said", "under", "high", "low", "report",
    "between", "while", "still", "off", "calls", "next", "last", "week",
}

# Thematic signal words → theme label
_THEME_SIGNALS: List[tuple] = [
    ({"regulation", "regulatory", "rule", "rules", "compliance", "supervisory",
      "supervision", "regulator", "regulators", "directive", "framework",
      "consultation", "guideline", "guidelines", "policy", "policies",
      "prudential", "capital", "requirements"}, "Regulatory & Compliance"),
    ({"ai", "artificial", "intelligence", "machine", "learning", "automation",
      "digital", "technology", "tech", "data", "cloud", "platform", "software",
      "fintech", "innovation", "generative", "model", "algorithm"}, "Digital & AI Innovation"),
    ({"risk", "risks", "stress", "test", "resilience", "cyber", "fraud",
      "financial", "stability", "systemic", "vulnerability", "exposure",
      "default", "credit"}, "Risk & Financial Stability"),
    ({"market", "markets", "rates", "rate", "interest", "bond", "bonds",
      "equity", "stock", "stocks", "yield", "currency", "crypto",
      "investment", "fund", "funds", "asset", "assets"}, "Markets & Investment"),
    ({"insurance", "insurer", "insurers", "premium", "premiums", "underwriting",
      "claims", "reinsurance", "catastrophe", "nat", "cat", "eiopa",
      "solvency"}, "Insurance & Re/Insurance"),
    ({"bank", "banks", "banking", "lender", "lenders", "lending", "deposit",
      "deposits", "mortgage", "mortgages", "loan", "loans", "credit",
      "liquidity"}, "Banking & Lending"),
    ({"payment", "payments", "transaction", "transactions", "transfer",
      "swift", "cbdc", "stablecoin", "wallet", "checkout", "settlement",
      "clearing", "open", "banking"}, "Payments & Infrastructure"),
    ({"esg", "sustainable", "sustainability", "climate", "green", "social",
      "governance", "impact", "net", "zero", "emission", "emissions",
      "transition"}, "ESG & Sustainability"),
    ({"merger", "acquisition", "m&a", "deal", "deals", "ipo", "spinoff",
      "buyout", "consolidation", "strategic"}, "M&A & Strategy"),
    ({"consumer", "retail", "customer", "customers", "wealth", "private",
      "personal", "household", "inclusion", "access"}, "Consumer & Retail FS"),
]


def _keywords(texts: List[str], top: int = 6) -> List[str]:
    freq: Counter = Counter()
    for t in texts:
        for w in re.sub(r"[^a-z\s]", " ", t.lower()).split():
            if len(w) > 3 and w not in _STOP:
                freq[w] += 1
    return [w for w, _ in freq.most_common(top)]


def _detect_themes(articles: List[Dict]) -> List[str]:
    """Return up to 5 thematic labels present in the article set."""
    word_bag = set()
    for a in articles:
        text = (a["title"] + " " + a.get("summary", "")).lower()
        word_bag.update(re.sub(r"[^a-z\s]", " ", text).split())

    hits: List[tuple] = []
    for signal_words, label in _THEME_SIGNALS:
        score = len(signal_words & word_bag)
        if score:
            hits.append((score, label))

    hits.sort(reverse=True)
    return [label for _, label in hits[:5]]


def _theme_bullets(articles: List[Dict], themes: List[str]) -> List[str]:
    """
    Build 3-5 plain-English bullet sentences summarising what is happening.
    Each bullet is derived from the most-representative article for a theme.
    """
    bullets: List[str] = []
    used_titles: set = set()

    for theme in themes[:5]:
        signal_words = {
            w for sw, lbl in _THEME_SIGNALS if lbl == theme for w in sw
        }
        # Score each article by how many signal words appear
        best = None
        best_score = 0
        for a in articles:
            text = (a["title"] + " " + a.get("summary", "")).lower()
            score = sum(1 for w in signal_words if w in text)
            if score > best_score and a["title"] not in used_titles:
                best_score = score
                best = a
        if best:
            used_titles.add(best["title"])
            summary = best.get("summary", "").strip()
            title = best["title"].strip()
            src = best.get("source_name", "")
            if summary and len(summary) > 30:
                # Use first sentence of summary if it's informative
                first_sent = re.split(r"(?<=[.!?])\s", summary)[0]
                if len(first_sent) > 20:
                    bullets.append(f"**{theme}:** {first_sent} ({src})")
                else:
                    bullets.append(f"**{theme}:** {title} ({src})")
            else:
                bullets.append(f"**{theme}:** {title} ({src})")

    # Pad with generic bullets if fewer than 3
    if len(bullets) < 3 and articles:
        for a in articles:
            if a["title"] not in used_titles and len(bullets) < 3:
                src = a.get("source_name", "")
                bullets.append(f"{a['title']} ({src})")
                used_titles.add(a["title"])

    return bullets


def _top_headlines(articles: List[Dict], n: int = 3) -> List[Dict]:
    seen: set = set()
    result = []
    for a in articles:
        t = a["title"]
        if t not in seen:
            seen.add(t)
            result.append({
                "title": t,
                "url": a.get("url", ""),
                "source": a.get("source_name", ""),
                "published": a.get("published", ""),
            })
        if len(result) >= n:
            break
    return result


# ── Public API ────────────────────────────────────────────────────────────────

def build_intelligence_brief(all_articles: List[Dict]) -> Dict[str, Any]:
    """
    Build a two-axis intelligence brief:
      brief["by_category"][cat] → category-level digest
      brief["by_region"][region] → region-level digest
      brief["matrix"][cat][region] → intersection cell
    """

    # Attach region/country from SOURCE_MAP to each article that lacks it
    src_meta: Dict[str, Dict] = {
        s["id"]: {"region": s["region"], "country": s["country"]}
        for s in SOURCE_MAP.values()
    }
    for a in all_articles:
        meta = src_meta.get(a.get("source_id", ""), {})
        a.setdefault("region", meta.get("region", "Global"))
        a.setdefault("country", meta.get("country", "Global"))

    # ── Group by category ────────────────────────────────────────────────
    by_cat: Dict[str, List] = defaultdict(list)
    for a in all_articles:
        by_cat[a["category"]].append(a)

    # ── Group by region ──────────────────────────────────────────────────
    by_region: Dict[str, List] = defaultdict(list)
    for a in all_articles:
        by_region[a["region"]].append(a)

    # ── Matrix: category × region ────────────────────────────────────────
    matrix: Dict[str, Dict[str, Dict]] = defaultdict(dict)
    for a in all_articles:
        cat = a["category"]
        reg = a["region"]
        matrix[cat].setdefault(reg, []).append(a)

    # ── Build category digests ───────────────────────────────────────────
    cat_digests: Dict[str, Dict] = {}
    for cat in CATEGORIES:
        arts = by_cat.get(cat, [])
        if not arts:
            continue
        themes = _detect_themes(arts)
        cat_digests[cat] = {
            "count": len(arts),
            "themes": themes,
            "theme_bullets": _theme_bullets(arts, themes),
            "top_headlines": _top_headlines(arts, 3),
            "hot_keywords": _keywords([a["title"] for a in arts], 8),
            "regions_present": sorted(set(a["region"] for a in arts)),
        }

    # ── Build region digests ─────────────────────────────────────────────
    present_regions = [r for r in REGION_ORDER if r in by_region]
    # Also include any region not in the canonical order
    for r in sorted(by_region.keys()):
        if r not in present_regions:
            present_regions.append(r)

    reg_digests: Dict[str, Dict] = {}
    for reg in present_regions:
        arts = by_region.get(reg, [])
        if not arts:
            continue
        themes = _detect_themes(arts)
        countries = sorted(set(
            a["country"] for a in arts if a.get("country") and a["country"] != reg
        ))
        reg_digests[reg] = {
            "count": len(arts),
            "countries": countries,
            "themes": themes,
            "theme_bullets": _theme_bullets(arts, themes),
            "top_headlines": _top_headlines(arts, 3),
            "hot_keywords": _keywords([a["title"] for a in arts], 8),
            "categories_present": sorted(set(a["category"] for a in arts)),
        }

    # ── Build matrix cells ───────────────────────────────────────────────
    matrix_out: Dict[str, Dict] = {}
    for cat in CATEGORIES:
        matrix_out[cat] = {}
        for reg in present_regions:
            arts = matrix.get(cat, {}).get(reg, [])
            if not arts:
                continue
            matrix_out[cat][reg] = {
                "count": len(arts),
                "top_headlines": _top_headlines(arts, 2),
                "hot_keywords": _keywords([a["title"] for a in arts], 4),
            }

    return {
        "regions": present_regions,
        "by_category": cat_digests,
        "by_region": reg_digests,
        "matrix": matrix_out,
    }
