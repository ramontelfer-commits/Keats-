// app.js — wires the UI: load data, filter, render metrics, charts, and insights.

const state = {
  posts: [],
  filtered: [],
  platformFilter: "All",
  source: "sample",
};

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

// Default dataset: Ramon's real @theillcollective TikTok export.
const DEFAULT_DATA = "data/theillcollective.csv";
const DEFAULT_LABEL = "@theillcollective (your TikTok)";

async function boot() {
  wireControls();
  try {
    const res = await fetch(DEFAULT_DATA);
    if (!res.ok) throw new Error("no data");
    loadFromText(await res.text(), DEFAULT_LABEL);
  } catch {
    // fetch() fails under file:// — show the empty state with import prompt.
    renderEmpty();
  }
}

function wireControls() {
  $("#file-input").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadFromText(reader.result, file.name);
    reader.readAsText(file);
  });
  $("#load-mine").addEventListener("click", async () => {
    try { loadFromText(await (await fetch(DEFAULT_DATA)).text(), DEFAULT_LABEL); }
    catch { $("#parse-note").textContent = "Data can only auto-load over http. Use “Import CSV”."; }
  });
  $("#load-sample").addEventListener("click", async () => {
    try { loadFromText(await (await fetch("data/sample.csv")).text(), "multi-platform sample"); }
    catch { $("#parse-note").textContent = "Sample can only auto-load over http. Use “Import CSV”."; }
  });
  $("#paste-toggle").addEventListener("click", () => {
    $("#paste-area").classList.toggle("hidden");
  });
  $("#paste-load").addEventListener("click", () => {
    const text = $("#paste-text").value.trim();
    if (text) loadFromText(text, "pasted");
  });
}

function loadFromText(text, sourceName) {
  const { posts, errors } = parsePosts(text);
  if (!posts.length) {
    $("#parse-note").textContent = errors[0] || "No rows found.";
    return;
  }
  state.posts = posts;
  state.source = sourceName;
  state.platformFilter = "All";
  const note = `Loaded ${posts.length} posts from ${sourceName}` +
    (errors.length ? ` · ${errors.length} row${errors.length > 1 ? "s" : ""} had issues` : "");
  $("#parse-note").textContent = note;
  buildPlatformTabs();
  applyFilterAndRender();
  $("#dashboard").classList.remove("hidden");
  $("#empty-state").classList.add("hidden");
}

function buildPlatformTabs() {
  const platforms = ["All", ...new Set(state.posts.map(p => p.platform))];
  const wrap = $("#platform-tabs");
  wrap.innerHTML = "";
  platforms.forEach(p => {
    const b = document.createElement("button");
    b.className = "tab" + (p === state.platformFilter ? " active" : "");
    b.textContent = p;
    if (p !== "All") b.style.setProperty("--dot", platformColor(p));
    b.addEventListener("click", () => {
      state.platformFilter = p;
      buildPlatformTabs();
      applyFilterAndRender();
    });
    wrap.appendChild(b);
  });
}

function applyFilterAndRender() {
  state.filtered = state.platformFilter === "All"
    ? state.posts
    : state.posts.filter(p => p.platform === state.platformFilter);
  render(analyze(state.filtered));
}

function render(a) {
  renderKpis(a.totals, a.caps);
  renderInsights(a.insights);
  renderThemes(a.themes, a.caps);
  renderHashtags(a.hashtags, a.caps);
  renderTopPosts(a.topPosts, a.caps);
  renderBreakouts(a.breakout);
  renderDuration(a.durationBuckets);

  // Date-dependent panels
  show("#timeline-section", a.caps.hasDates);
  show("#timing-row", a.caps.hasDates);
  if (a.caps.hasDates) { renderTimeline(a.timeline); renderTiming(a.byDayOfWeek, a.byHour); }

  // Platform panels only matter with more than one platform
  const multiPlatform = a.byPlatform.length > 1;
  show("#donut-section", multiPlatform);
  show("#platform-section", multiPlatform);
  if (multiPlatform) { renderDonut(a.byPlatform); renderPlatformTable(a.byPlatform); }
}

function show(sel, on) { $(sel).classList.toggle("hidden", !on); }

function kpi(label, value, sub) {
  return `<div class="kpi"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ""}</div>`;
}

function renderKpis(t, caps) {
  const cards = [
    kpi("Total views", fmt(t.views), `${fmt(t.avgViews)} avg · ${fmt(t.medianViews)} median`),
    kpi("Posts", fmt(t.posts), caps.hasEngagement ? `${fmt(t.followers)} new followers` : "in this dataset"),
    kpi("Best post", fmt(t.topViews), "peak reach"),
  ];
  if (caps.hasEngagement) {
    cards.splice(1, 0, kpi("Engagement rate", pct(t.engagementRate), `${fmt(t.engagements)} total engagements`));
    cards.push(kpi("Likes", fmt(t.likes), `${fmt(t.comments)} comments`));
    cards.push(kpi("Shares", fmt(t.shares), `${fmt(t.saves)} saves`));
  } else {
    cards.push(kpi("Median views", fmt(t.medianViews), "the typical post"));
    cards.push(kpi("Top 10% floor", fmt(t.p90), "views to reach your best tier"));
  }
  $("#kpis").innerHTML = cards.join("");
}

function renderThemes(themes, caps) {
  if (!caps.hasText || themes.length < 2) { show("#theme-section", false); return; }
  show("#theme-section", true);
  barChart($("#theme-chart"),
    themes.map(t => ({ label: `${t.key} (${t.posts})`, value: Math.round(t.avgViews) })),
    { valueFmt: fmt });
}

function renderHashtags(tags, caps) {
  if (!caps.hasHashtags || !tags.length) { show("#hashtag-section", false); return; }
  show("#hashtag-section", true);
  barChart($("#hashtag-chart"),
    tags.slice(0, 12).map(t => ({ label: `${t.tag} (${t.posts})`, value: Math.round(t.avgViews) })),
    { valueFmt: fmt });
}

function renderInsights(insights) {
  const icons = { good: "✓", tip: "→", warn: "!", };
  $("#insights").innerHTML = insights.map(i =>
    `<div class="insight insight-${i.kind}">
       <span class="insight-badge">${icons[i.kind] || "•"}</span>
       <div><h4>${escapeHtml(i.title)}</h4><p>${escapeHtml(i.body)}</p></div>
     </div>`
  ).join("");
}

function renderPlatformTable(rows) {
  const body = rows.map(r => `
    <tr>
      <td><span class="dot" style="background:${platformColor(r.key)}"></span>${escapeHtml(r.key)}</td>
      <td>${fmt(r.posts)}</td>
      <td>${fmt(r.views)}</td>
      <td>${fmt(r.avgViews)}</td>
      <td>${pct(r.engagementRate)}</td>
      <td>${fmt(r.followers)}</td>
    </tr>`).join("");
  $("#platform-table").innerHTML = `
    <table>
      <thead><tr><th>Platform</th><th>Posts</th><th>Views</th><th>Avg views</th><th>Eng. rate</th><th>Followers</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function renderTimeline(weeks) {
  lineChart($("#timeline-chart"),
    weeks.map(w => ({ x: w.week, y: w.views })),
    { valueFmt: fmt, labelFmt: iso => iso.slice(5) });
}

function renderTiming(dow, hours) {
  columnChart($("#dow-chart"), dow.map(d => ({ label: d.label, value: Math.round(d.avgViews) })), { valueFmt: fmt });
  columnChart($("#hour-chart"),
    hours.map(h => ({ label: `${h.hour}`, value: Math.round(h.avgViews) })), { valueFmt: fmt });
}

function renderDonut(byPlatform) {
  donutChart($("#donut-chart"), byPlatform.map(p => ({ label: p.key, value: p.views, color: platformColor(p.key) })));
  $("#donut-legend").innerHTML = byPlatform.map(p =>
    `<li><span class="dot" style="background:${platformColor(p.key)}"></span>${escapeHtml(p.key)} <b>${pct(p.views / Math.max(1, byPlatform.reduce((a, x) => a + x.views, 0)))}</b></li>`
  ).join("");
}

function renderTopPosts(posts, caps) {
  $("#top-posts").innerHTML = posts.map((p, i) => {
    const meta = [escapeHtml(p.account), p.publishedAt ? p.publishedAt.toLocaleDateString() : null]
      .filter(Boolean).join(" · ");
    const stats = caps.hasEngagement
      ? `<b>${fmt(p.views)}</b> views · ${pct(engagementRate(p))} eng.`
      : `<b>${fmt(p.views)}</b> views`;
    return `
    <li>
      <span class="rank">${i + 1}</span>
      <span class="dot" style="background:${platformColor(p.platform)}" title="${escapeHtml(p.platform)}"></span>
      <div class="post-main">
        ${p.url ? `<a href="${escapeAttr(p.url)}" target="_blank" rel="noopener">${escapeHtml(truncate(p.title, 60))}</a>`
                : `<span>${escapeHtml(truncate(p.title, 60))}</span>`}
        ${meta ? `<div class="post-meta">${meta}</div>` : ""}
      </div>
      <div class="post-stats">${stats}</div>
    </li>`;
  }).join("");
}

function renderBreakouts(breakouts) {
  const wrap = $("#breakout-section");
  if (!breakouts.length) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  $("#breakouts").innerHTML = breakouts.map(p => `
    <div class="breakout-card">
      <div class="breakout-mult">${p.multiple.toFixed(1)}×</div>
      <div>
        <div class="breakout-title">${escapeHtml(truncate(p.title, 44))}</div>
        <div class="post-meta"><span class="dot" style="background:${platformColor(p.platform)}"></span>${escapeHtml(p.platform)} · ${fmt(p.views)} views</div>
      </div>
    </div>`).join("");
}

function renderDuration(buckets) {
  const wrap = $("#duration-section");
  if (!buckets.length) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  barChart($("#duration-chart"),
    buckets.map(b => ({ label: `${b.label} (${b.posts})`, value: Math.round(b.avgViews) })),
    { valueFmt: fmt });
}

function renderEmpty() {
  $("#dashboard").classList.add("hidden");
  $("#empty-state").classList.remove("hidden");
}

// --- small helpers ---
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

document.addEventListener("DOMContentLoaded", boot);
