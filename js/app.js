// app.js — wires the UI: load data, filter, render metrics, charts, and insights.

const state = {
  posts: [],
  filtered: [],
  platformFilter: "All",
  source: "sample",
};

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

async function boot() {
  wireControls();
  try {
    const res = await fetch("data/sample.csv");
    if (!res.ok) throw new Error("no sample");
    const text = await res.text();
    loadFromText(text, "sample");
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
  $("#load-sample").addEventListener("click", async () => {
    try {
      const res = await fetch("data/sample.csv");
      loadFromText(await res.text(), "sample");
    } catch {
      $("#parse-note").textContent = "Sample data can only auto-load when served over http. Use “Import CSV”.";
    }
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
  renderKpis(a.totals);
  renderInsights(a.insights);
  renderPlatformTable(a.byPlatform);
  renderTimeline(a.timeline);
  renderTiming(a.byDayOfWeek, a.byHour);
  renderDonut(a.byPlatform);
  renderTopPosts(a.topPosts);
  renderBreakouts(a.breakout);
  renderDuration(a.durationBuckets);
}

function kpi(label, value, sub) {
  return `<div class="kpi"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ""}</div>`;
}

function renderKpis(t) {
  $("#kpis").innerHTML = [
    kpi("Total views", fmt(t.views), `${fmt(t.avgViews)} avg · ${fmt(t.medianViews)} median`),
    kpi("Engagement rate", pct(t.engagementRate), `${fmt(t.engagements)} total engagements`),
    kpi("Posts", fmt(t.posts), `${fmt(t.followers)} new followers`),
    kpi("Likes", fmt(t.likes), `${fmt(t.comments)} comments`),
    kpi("Shares", fmt(t.shares), `${fmt(t.saves)} saves`),
  ].join("");
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

function renderTopPosts(posts) {
  $("#top-posts").innerHTML = posts.map((p, i) => `
    <li>
      <span class="rank">${i + 1}</span>
      <span class="dot" style="background:${platformColor(p.platform)}" title="${escapeHtml(p.platform)}"></span>
      <div class="post-main">
        ${p.url ? `<a href="${escapeAttr(p.url)}" target="_blank" rel="noopener">${escapeHtml(truncate(p.title, 60))}</a>`
                : `<span>${escapeHtml(truncate(p.title, 60))}</span>`}
        <div class="post-meta">${escapeHtml(p.account)} · ${p.publishedAt ? p.publishedAt.toLocaleDateString() : "—"}</div>
      </div>
      <div class="post-stats"><b>${fmt(p.views)}</b> views · ${pct(engagementRate(p))} eng.</div>
    </li>`).join("");
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
