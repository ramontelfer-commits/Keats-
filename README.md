# Signal — Social Media Performance Review

A self-contained web app that reviews how your social media is performing. Import a
CSV export of your posts (TikTok, YouTube, Instagram, or anything with the right
columns) and Signal gives you an at-a-glance review: reach, engagement, your best
posting days and times, platform comparison, breakout posts, and plain-language
recommendations for what to do next.

Everything runs in the browser. Your data never leaves the page — there's no server,
no account, no upload.

## Run it

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

The bundled sample dataset (`data/sample.csv`, 180 posts across three platforms)
loads automatically so you can see the whole thing working immediately.

> Opening `index.html` directly from the filesystem also works, but browsers block
> `fetch()` over `file://`, so the sample won't auto-load — use **Import CSV** or
> **Paste CSV** instead, or serve over http as above.

## Bring your own numbers

Click **Import CSV** (or **Paste CSV**) and drop in an export. Column names are
matched flexibly, so most native exports work with little or no editing. The
recognized fields:

| Field | Aliases accepted | Notes |
|-------|------------------|-------|
| `platform` | network, channel type, source | Inferred from the URL if missing |
| `account` | handle, username, channel, profile | |
| `published_at` | date, posted, publish date, time | Any parseable date/time |
| `title` | caption, description, text | |
| `url` | link, permalink | Makes top-post titles clickable |
| `views` | impressions, plays, reach | |
| `likes` | reactions, favorites, hearts | |
| `comments` | replies | |
| `shares` | reshares, sends | |
| `saves` | bookmarks | |
| `followers_gained` | new followers, follows | |
| `duration_seconds` | duration, length | Powers the clip-length analysis |

Unknown columns are ignored; missing columns default to zero. At minimum you need a
`views` or `likes` column.

## What you get

- **Overview** — total views, engagement rate, followers, likes, shares, with
  averages and medians.
- **What the numbers say** — prioritized, human-readable recommendations (best
  platform, best day and hour to post, ideal clip length, cadence warnings, hit
  rate).
- **Views over time** — weekly trend line.
- **View share by platform** and a full platform breakdown table.
- **Best day / best hour to post** — average views by day of week and hour.
- **Clip length vs. reach** — how video duration relates to views.
- **Breakout posts** — anything that beat its platform's median reach by 3× or more.
- **Top 10 posts** by views.

Use the platform tabs at the top to filter the entire review down to a single
network.

## Project layout

```
index.html          markup + panels
css/styles.css      theme-aware styling (dark / light)
js/parse.js         flexible CSV parsing + normalization
js/analytics.js     metrics + the insight/recommendation engine
js/charts.js        dependency-free SVG charts
js/app.js           UI wiring
data/sample.csv     bundled demo dataset
```

No build step, no dependencies.
