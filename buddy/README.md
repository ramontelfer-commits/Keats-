# BOT — Bank of Telfer

A super-simple, iOS-style spending tracker for **two people** (Ramon & Sarah).
Stripped back and beautiful: add a transaction, say who paid, pick a category and
date, and BOT handles the rest. Set costs to repeat, plan upcoming spends, see a
per-person split with a settle-up, and get plain-language warnings when a budget
or a bill is about to bite.

Everything runs in the browser and saves to `localStorage` — no server, no
account, nothing leaves the page.

## Two ways to run it

**Shared (recommended) — `bot.html`.** A single self-contained page that stores
its data *inside itself* and republishes when either person adds or deletes a
transaction, so every open view live-reloads to the latest. This is the true
joint account: Ramon and Sarah open the same link and see each other's spending.
It's published as a private Claude Artifact — share it from the page's share menu
and add Sarah as an **editor** so she can add transactions too (a view-only
guest sees a read-only version). Opened outside that shared context, it quietly
falls back to a local per-browser copy.

**Local — `index.html` + `css/` + `js/`.** The original multi-file version.
Saves to `localStorage` on one device. Good for solo use or one shared phone.

## Run it

```bash
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000  (best viewed narrow, like a phone)
```

Opening `index.html` directly from the filesystem works too — there's no network
fetch, so nothing is blocked over `file://`.

## What it does

- **Spending** — spent-this-month hero, a budget bar, a **who-paid split** for
  Ramon vs Sarah with a **settle-up** line ("Ramon owes Sarah $X to even up"),
  category breakdown, and recent transactions grouped by day (each tagged with
  who paid).
- **Add** (the ⊕ button) — big amount entry, Expense/Income toggle, a **Paid by**
  picker (Ramon / Sarah), a grid of categories, an optional note, and a date.
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
