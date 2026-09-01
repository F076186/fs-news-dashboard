# Financial Services Intelligence Dashboard

> A macOS-native web application that aggregates real-time news, trends, regulations and innovation signals from 19 leading Financial Services sources.

## Quick Start

```bash
cd /Users/f076186/Desktop/DEV/fs-news-dashboard
chmod +x launch.sh stop.sh
./launch.sh
```

The launcher will:
1. Create a Python virtual environment (first run only)
2. Install all dependencies automatically
3. Start the Flask server on `http://127.0.0.1:5050`
4. Open the dashboard in your default browser

Press **Ctrl+C** to stop.

---

## Sources Monitored (19)

| Category | Sources |
|---|---|
| **Banking News** | American Banker, Financial Times, WSJ Finance |
| **Insurance** | Insurance Journal, Insurance Business, The Insurer |
| **FinTech & Innovation** | Finextra, The Financial Brand, PYMNTS |
| **Strategy & Consulting** | McKinsey FS, Bain FS, BCG Financial Institutions, PwC FS Library |
| **Regulation** | EBA, EIOPA, ECB Banking Supervision, ACPR, ESMA |

---

## How It Works

- **RSS-first**: For sources with RSS feeds, `feedparser` pulls structured entries directly — fast and reliable.
- **HTML fallback**: For sources without RSS (McKinsey, Bain, BCG, PwC), Beautiful Soup scrapes article cards.
- **Concurrent**: All 19 sources are fetched in parallel (10 threads) — full refresh takes ~10–20 seconds.
- **15-minute cache**: Results are cached server-side; the UI auto-checks every 60 seconds and triggers a refresh when the cache expires.
- **Category keywords**: Top trending terms are extracted automatically from article titles/summaries.

---

## Architecture

```
fs-news-dashboard/
├── app.py                     # Flask server (port 5050)
├── launch.sh                  # macOS launcher
├── stop.sh                    # Stop server
├── requirements.txt
├── scrapers/
│   ├── sources.py             # 19 source definitions
│   ├── fetcher.py             # RSS + HTML scraping per source
│   └── aggregator.py         # Parallel fetch + category grouping
├── templates/
│   └── index.html             # Jinja2 template
└── static/
    ├── css/dashboard.css
    └── js/dashboard.js
```

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Dashboard UI |
| `GET /api/news` | Full aggregated data (JSON) |
| `GET /api/news?refresh=1` | Force live re-fetch |
| `GET /api/news?category=Banking News` | Filter by category |
| `GET /api/status` | Cache health check |

---

## Requirements

- macOS with Python 3.9+
- Internet connection
- No API keys required
