"""
Financial Services news source definitions.
Each source has: name, url, category, rss_url (preferred), scrape_config (fallback).
"""

SOURCES = [
    # ── Banking & Finance News ──────────────────────────────────────────────
    {
        "id": "americanbanker",
        "name": "American Banker",
        "url": "https://www.americanbanker.com/",
        "category": "Banking News",
        # AB blocks direct RSS; use Google News RSS for their content
        "rss": "https://news.google.com/rss/search?q=site:americanbanker.com&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": "article, .article-block, .river-item",
            "title_selector": "h3, h2, .headline",
            "link_selector": "a",
            "summary_selector": ".summary, .deck, p",
        },
    },
    {
        "id": "ft",
        "name": "Financial Times",
        "url": "https://www.ft.com",
        "category": "Banking News",
        "rss": "https://www.ft.com/rss/home/uk",
        "scrape": {
            "article_selector": ".o-teaser, article",
            "title_selector": ".o-teaser__heading, h2",
            "link_selector": "a",
            "summary_selector": ".o-teaser__standfirst, p",
        },
    },
    {
        "id": "wsj_finance",
        "name": "WSJ Finance & Banking",
        "url": "https://www.wsj.com/finance/banking",
        "category": "Banking News",
        "rss": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
        "scrape": {
            "article_selector": "article, .WSJTheme--story-body",
            "title_selector": "h2, h3",
            "link_selector": "a",
            "summary_selector": "p",
        },
    },
    # ── Insurance ───────────────────────────────────────────────────────────
    {
        "id": "insurancejournal",
        "name": "Insurance Journal",
        "url": "https://www.insurancejournal.com",
        "category": "Insurance",
        "rss": "https://www.insurancejournal.com/feed/",
        "scrape": {
            "article_selector": ".article, article",
            "title_selector": "h3, h2, .title",
            "link_selector": "a",
            "summary_selector": ".excerpt, p",
        },
    },
    {
        "id": "insurancebusiness",
        "name": "Insurance Business",
        "url": "https://www.insurancebusinessmag.com",
        "category": "Insurance",
        "rss": "https://news.google.com/rss/search?q=site:insurancebusinessmag.com+insurance&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": "article, .article-card",
            "title_selector": "h2, h3",
            "link_selector": "a",
            "summary_selector": "p",
        },
    },
    {
        "id": "theinsurer",
        "name": "The Insurer",
        "url": "https://www.theinsurer.com",
        "category": "Insurance",
        # paywalled — use Google News RSS
        "rss": "https://news.google.com/rss/search?q=site:theinsurer.com&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": "article",
            "title_selector": "h2, h3",
            "link_selector": "a",
            "summary_selector": "p",
        },
    },
    # ── FinTech & Innovation ─────────────────────────────────────────────────
    {
        "id": "finextra",
        "name": "Finextra",
        "url": "https://www.finextra.com",
        "category": "FinTech & Innovation",
        "rss": "https://www.finextra.com/rss/headlines.aspx",
        "scrape": {
            "article_selector": ".news-item, article",
            "title_selector": "h2, h3, .headline",
            "link_selector": "a",
            "summary_selector": ".summary, p",
        },
    },
    {
        "id": "financialbrand",
        "name": "The Financial Brand",
        "url": "https://thefinancialbrand.com",
        "category": "FinTech & Innovation",
        # WordPress blocks RSS scraping; use Google News fallback
        "rss": "https://news.google.com/rss/search?q=site:thefinancialbrand.com+banking+fintech&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": "article, .post",
            "title_selector": "h2, h3",
            "link_selector": "a",
            "summary_selector": ".excerpt, p",
        },
    },
    {
        "id": "pymnts",
        "name": "PYMNTS",
        "url": "https://www.pymnts.com",
        "category": "FinTech & Innovation",
        "rss": "https://www.pymnts.com/feed/",
        "scrape": {
            "article_selector": "article, .post",
            "title_selector": "h2, h3",
            "link_selector": "a",
            "summary_selector": ".excerpt, p",
        },
    },
    # ── Consulting & Strategy ────────────────────────────────────────────────
    {
        "id": "mckinsey_fs",
        "name": "McKinsey Financial Services",
        "url": "https://www.mckinsey.com/industries/financial-services/our-insights",
        "category": "Strategy & Consulting",
        # Google News RSS for McKinsey FS content
        "rss": "https://news.google.com/rss/search?q=mckinsey+%22financial+services%22+site:mckinsey.com&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": "article, .mck-c-card",
            "title_selector": "h2, h3, .mck-c-card__headline",
            "link_selector": "a",
            "summary_selector": ".mck-c-card__description, p",
        },
    },
    {
        "id": "bain_fs",
        "name": "Bain Financial Services",
        "url": "https://www.bain.com/insights/topics/financial-services/",
        "category": "Strategy & Consulting",
        "rss": "https://news.google.com/rss/search?q=bain+%22financial+services%22+site:bain.com&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": "article, .insight-card, .card",
            "title_selector": "h2, h3, .card-title",
            "link_selector": "a",
            "summary_selector": "p, .card-description",
        },
    },
    {
        "id": "bcg_fi",
        "name": "BCG Financial Institutions",
        "url": "https://www.bcg.com/industries/financial-institutions",
        "category": "Strategy & Consulting",
        "rss": "https://news.google.com/rss/search?q=bcg+%22financial+institutions%22+site:bcg.com&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": "article, .content-card",
            "title_selector": "h2, h3",
            "link_selector": "a",
            "summary_selector": "p",
        },
    },
    {
        "id": "pwc_fs",
        "name": "PwC Financial Services",
        "url": "https://www.pwc.com/us/en/industries/financial-services/library.html",
        "category": "Strategy & Consulting",
        "rss": "https://news.google.com/rss/search?q=pwc+%22financial+services%22+site:pwc.com&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": "article, .insight-tile, .card",
            "title_selector": "h2, h3, .insight-title",
            "link_selector": "a",
            "summary_selector": "p",
        },
    },
    # ── Regulators ──────────────────────────────────────────────────────────
    {
        "id": "eba",
        "name": "EBA (European Banking Authority)",
        "url": "https://www.eba.europa.eu",
        "category": "Regulation",
        "rss": "https://www.eba.europa.eu/rss.xml",
        "scrape": {
            "article_selector": ".news-item, article, li",
            "title_selector": "h3, h2, a",
            "link_selector": "a",
            "summary_selector": "p, .summary",
        },
    },
    {
        "id": "eiopa",
        "name": "EIOPA",
        "url": "https://www.eiopa.europa.eu",
        "category": "Regulation",
        # EIOPA RSS returns 404 — use Google News fallback
        "rss": "https://news.google.com/rss/search?q=EIOPA+insurance+regulation+Europe&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": ".views-row, article",
            "title_selector": "h3, h2",
            "link_selector": "a",
            "summary_selector": "p",
        },
    },
    {
        "id": "ecb_supervision",
        "name": "ECB Banking Supervision",
        "url": "https://www.bankingsupervision.europa.eu",
        "category": "Regulation",
        # ECB SSM direct RSS returns 404 — use Google News
        "rss": "https://news.google.com/rss/search?q=ECB+%22banking+supervision%22+regulation&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": ".news-item, article",
            "title_selector": "h3, h2",
            "link_selector": "a",
            "summary_selector": "p",
        },
    },
    {
        "id": "acpr",
        "name": "ACPR (Banque de France)",
        "url": "https://acpr.banque-france.fr",
        "category": "Regulation",
        # Use Google News for ACPR (site blocks direct RSS)
        "rss": "https://news.google.com/rss/search?q=ACPR+regulation+banking+insurance&hl=en-US&gl=US&ceid=US:en",
        "scrape": {
            "article_selector": ".news-item, article, .views-row",
            "title_selector": "h3, h2",
            "link_selector": "a",
            "summary_selector": "p",
        },
    },
    {
        "id": "esma",
        "name": "ESMA",
        "url": "https://www.esma.europa.eu",
        "category": "Regulation",
        "rss": "https://www.esma.europa.eu/press-news/esma-news/feed",
        "scrape": {
            "article_selector": ".news-item, article, .views-row",
            "title_selector": "h3, h2",
            "link_selector": "a",
            "summary_selector": "p",
        },
    },
]

CATEGORIES = sorted(set(s["category"] for s in SOURCES))
SOURCE_MAP = {s["id"]: s for s in SOURCES}
