# Buddy — Spending Tracker

A super-simple, iOS-style spending tracker. Stripped back and beautiful: add a
transaction, pick a category and date, and Buddy handles the rest. Set costs to
repeat, plan upcoming spends, and get plain-language warnings when a budget or a
bill is about to bite.

Everything runs in the browser and saves to `localStorage` — no server, no
account, nothing leaves the page.

## Run it

```bash
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000  (best viewed narrow, like a phone)
```

Opening `index.html` directly from the filesystem works too — there's no network
fetch, so nothing is blocked over `file://`.

## What it does

- **Spending** — spent-this-month hero, a budget bar, category breakdown, and
  recent transactions grouped by day.
- **Add** (the ⊕ button) — big amount entry, Expense/Income toggle, a grid of
  categories, an optional note, and a date.
  - Set **Repeat** (weekly / fortnightly / monthly) → it becomes a **recurring** cost.
  - Give it a **future date** → it becomes an **upcoming** cost.
- **Recurring** — all your fixed costs with an estimated monthly total.
- **Upcoming** — planned one-off future spends with a running total.
- **Warnings** — over-budget alerts, "80% of budget used", costs due within 7
  days, and recurring bills due today/tomorrow.

## Layout

```
index.html      app shell: views, tab bar, add sheet
css/styles.css  iOS-style theming (light + dark), no frameworks
js/app.js       categories, transactions, recurring/upcoming, warnings, storage
```

No build step, no dependencies.
