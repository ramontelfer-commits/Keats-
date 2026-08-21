// analytics.js — pure functions that turn normalized posts into the performance review.

const PLATFORM_COLORS = {
  TikTok: "#ff2d55",
  YouTube: "#ff0000",
  Instagram: "#c13584",
  X: "#1d9bf0",
  Facebook: "#1877f2",
  Unknown: "#8a8f98",
};

function platformColor(p) { return PLATFORM_COLORS[p] || "#8a8f98"; }

function engagements(p) {
  return p.likes + p.comments + p.shares + p.saves;
}

// Engagement rate as a share of views (fallbacks to 0 when no views).
function engagementRate(p) {
  return p.views > 0 ? engagements(p) / p.views : 0;
}

function sum(arr, f) { return arr.reduce((a, x) => a + f(x), 0); }
function avg(arr, f) { return arr.length ? sum(arr, f) / arr.length : 0; }
function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentile(nums, q) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor(q * s.length));
  return s[idx];
}

function fmt(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(Math.abs(n) >= 1e4 ? 0 : 1) + "K";
  return String(n);
}
function pct(x) { return (x * 100).toFixed(1) + "%"; }

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Which capabilities does this dataset actually support? Drives adaptive UI.
function capabilities(posts) {
  return {
    hasEngagement: posts.some(p => p.likes + p.comments + p.shares + p.saves > 0),
    hasDates: posts.some(p => p.publishedAt),
    hasDuration: posts.some(p => p.durationSeconds > 0),
    hasText: posts.some(p => extractHashtags(p).length || (p.title && p.title !== "(untitled)")),
    hasHashtags: posts.some(p => extractHashtags(p).length),
  };
}

// The main entry point: compute everything the dashboard renders.
function analyze(posts) {
  const dated = posts.filter(p => p.publishedAt);
  const caps = capabilities(posts);
  const totals = {
    posts: posts.length,
    views: sum(posts, p => p.views),
    likes: sum(posts, p => p.likes),
    comments: sum(posts, p => p.comments),
    shares: sum(posts, p => p.shares),
    saves: sum(posts, p => p.saves),
    followers: sum(posts, p => p.followersGained),
  };
  totals.engagements = totals.likes + totals.comments + totals.shares + totals.saves;
  totals.engagementRate = totals.views > 0 ? totals.engagements / totals.views : 0;
  totals.medianViews = median(posts.map(p => p.views));
  totals.avgViews = avg(posts, p => p.views);
  totals.topViews = posts.length ? Math.max(...posts.map(p => p.views)) : 0;
  totals.p90 = percentile(posts.map(p => p.views), 0.9);

  return {
    caps,
    totals,
    byPlatform: groupStats(posts, p => p.platform),
    byAccount: groupStats(posts, p => `${p.platform} · ${p.account}`),
    byDayOfWeek: dayOfWeekStats(dated),
    byHour: hourStats(dated),
    timeline: timelineStats(dated),
    topPosts: [...posts].sort((a, b) => b.views - a.views).slice(0, 10),
    breakout: findBreakouts(posts),
    durationBuckets: durationStats(posts.filter(p => p.durationSeconds > 0)),
    hashtags: hashtagStats(posts),
    themes: themeStats(posts),
    insights: buildInsights(posts, totals, caps),
  };
}

// --- Text/copy analysis (hashtags + hook themes) ---

function extractHashtags(p) {
  const text = `${p.title || ""} ${p.caption || ""}`;
  const tags = text.match(/#[\p{L}0-9_]+/gu) || [];
  // de-dupe within a post, normalize case
  return [...new Set(tags.map(t => t.toLowerCase()))];
}

// Average views per hashtag, for tags used on at least `minPosts` posts.
function hashtagStats(posts, minPosts = 3) {
  const map = {};
  for (const p of posts) {
    for (const tag of extractHashtags(p)) {
      (map[tag] ||= []).push(p.views);
    }
  }
  const overallAvg = avg(posts, p => p.views) || 1;
  return Object.entries(map)
    .filter(([, v]) => v.length >= minPosts)
    .map(([tag, v]) => ({
      tag,
      posts: v.length,
      avgViews: v.reduce((a, x) => a + x, 0) / v.length,
      medianViews: median(v),
      lift: (v.reduce((a, x) => a + x, 0) / v.length) / overallAvg,
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
}

// Hook/theme taxonomy learned from The Ill Collective's copy bible.
const THEMES = [
  { key: "Political / censorship", test: t => /\b(trump|donald|epstein|iran|orange man|blood orange|protest|tr-?mp|white house|censor|ban|banned|pull(ing|ed)? down|silenc|frozen|freeze)\b/.test(t) },
  { key: "“Where are you from?” bait", test: t => /where are you from|only show|geo|new zealand.*(from|where)|showing my music to/.test(t) },
  { key: "Underdog / small artist", test: t => /\b(small|undiscovered|stumbled|scrolled upon|before (they|you|i) blow up|non-?trending|bedroom|shooting my shot|very small|not trending|little secret|gatekeep)\b/.test(t) },
  { key: "Vulnerability / backstory", test: t => /\b(depression|addiction|lost (one|my)|grief|dad|father|survived|surviving|tough time|breathing|honest|mate)\b/.test(t) },
  { key: "Reply to comment", test: t => /reply to|replying to/.test(t) },
  { key: "Lyric / karaoke video", test: t => /karaoke|lyric video|lyrics only|no fixed on-screen hook|no fixed spoken/.test(t) },
  { key: "Release / listen ask", test: t => /\b(out now|link in bio|pre-?save|dropping|drops|new single|new track|take a listen|15 seconds|20 seconds|stream|spotify)\b/.test(t) },
];

function classifyTheme(p) {
  const t = `${p.title || ""} ${p.caption || ""}`.toLowerCase();
  for (const theme of THEMES) if (theme.test(t)) return theme.key;
  return "Other";
}

// Average views per hook theme.
function themeStats(posts) {
  const map = {};
  for (const p of posts) (map[classifyTheme(p)] ||= []).push(p.views);
  return Object.entries(map)
    .map(([key, v]) => ({
      key,
      posts: v.length,
      avgViews: v.reduce((a, x) => a + x, 0) / v.length,
      medianViews: median(v),
      totalViews: v.reduce((a, x) => a + x, 0),
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
}

function groupStats(posts, keyFn) {
  const groups = {};
  for (const p of posts) {
    const k = keyFn(p);
    (groups[k] ||= []).push(p);
  }
  return Object.entries(groups).map(([key, items]) => ({
    key,
    posts: items.length,
    views: sum(items, p => p.views),
    avgViews: avg(items, p => p.views),
    medianViews: median(items.map(p => p.views)),
    engagements: sum(items, p => engagements(p)),
    engagementRate: avg(items, engagementRate),
    followers: sum(items, p => p.followersGained),
  })).sort((a, b) => b.views - a.views);
}

function dayOfWeekStats(posts) {
  const buckets = DOW.map((label, i) => ({ label, i, posts: 0, views: 0, er: 0 }));
  for (const p of posts) {
    const b = buckets[p.publishedAt.getDay()];
    b.posts++; b.views += p.views; b.er += engagementRate(p);
  }
  buckets.forEach(b => {
    b.avgViews = b.posts ? b.views / b.posts : 0;
    b.engagementRate = b.posts ? b.er / b.posts : 0;
  });
  return buckets;
}

function hourStats(posts) {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, posts: 0, views: 0, er: 0 }));
  for (const p of posts) {
    const b = buckets[p.publishedAt.getHours()];
    b.posts++; b.views += p.views; b.er += engagementRate(p);
  }
  buckets.forEach(b => {
    b.avgViews = b.posts ? b.views / b.posts : 0;
    b.engagementRate = b.posts ? b.er / b.posts : 0;
  });
  return buckets;
}

// Weekly timeline of total views + posting cadence.
function timelineStats(posts) {
  if (!posts.length) return [];
  const byWeek = {};
  for (const p of posts) {
    const d = new Date(p.publishedAt);
    const day = (d.getDay() + 6) % 7; // Monday start
    const monday = new Date(d); monday.setDate(d.getDate() - day); monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    (byWeek[key] ||= { week: key, views: 0, posts: 0, engagements: 0 });
    byWeek[key].views += p.views;
    byWeek[key].posts += 1;
    byWeek[key].engagements += engagements(p);
  }
  return Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week));
}

function durationStats(posts) {
  const ranges = [
    { label: "0–15s", min: 0, max: 15 },
    { label: "16–30s", min: 16, max: 30 },
    { label: "31–60s", min: 31, max: 60 },
    { label: "60s+", min: 61, max: Infinity },
  ];
  return ranges.map(r => {
    const items = posts.filter(p => p.durationSeconds >= r.min && p.durationSeconds <= r.max);
    return {
      label: r.label,
      posts: items.length,
      avgViews: avg(items, p => p.views),
      engagementRate: avg(items, engagementRate),
    };
  }).filter(r => r.posts > 0);
}

// Posts that beat their platform's median views by a wide margin.
function findBreakouts(posts) {
  const medians = {};
  const byPlat = {};
  for (const p of posts) (byPlat[p.platform] ||= []).push(p);
  for (const [plat, items] of Object.entries(byPlat)) medians[plat] = median(items.map(x => x.views)) || 1;
  return posts
    .map(p => ({ ...p, multiple: p.views / (medians[p.platform] || 1) }))
    .filter(p => p.multiple >= 3)
    .sort((a, b) => b.multiple - a.multiple)
    .slice(0, 8);
}

// Human-readable, prioritized recommendations.
function buildInsights(posts, totals, caps = capabilities(posts)) {
  const out = [];
  const dated = posts.filter(p => p.publishedAt);

  // Best hook theme (only when we have copy to classify).
  if (caps.hasText) {
    const themes = themeStats(posts).filter(t => t.posts >= 2 && t.key !== "Other");
    if (themes.length >= 2) {
      const best = themes[0];
      const overall = totals.avgViews || 1;
      out.push({
        kind: "good",
        title: `${best.key} — your top-performing hook angle`,
        body: `Those posts average ${fmt(best.avgViews)} views — ${(best.avgViews / overall).toFixed(1)}× your overall average of ${fmt(overall)} across ${best.posts} posts. Lead with this angle when the news cycle allows.`,
      });
      const weak = themes[themes.length - 1];
      if (weak.key !== best.key && weak.avgViews < overall * 0.75) {
        out.push({
          kind: "warn",
          title: `${weak.key} hooks underperform`,
          body: `They average just ${fmt(weak.avgViews)} views (${(weak.avgViews / overall).toFixed(1)}× overall). Use this format sparingly, or pair it with a stronger hook overlay.`,
        });
      }
    }
  }

  // Best hashtag by average views.
  if (caps.hasHashtags) {
    const tags = hashtagStats(posts, 3);
    if (tags.length) {
      const best = tags[0];
      out.push({
        kind: "tip",
        title: `${best.tag} is your highest-reach tag`,
        body: `Posts using ${best.tag} average ${fmt(best.avgViews)} views — ${best.lift.toFixed(1)}× your overall average — across ${best.posts} posts. Keep it in rotation when it fits the song.`,
      });
    }
  }

  // Best platform by engagement rate (only if engagement data exists).
  const plats = groupStats(posts, p => p.platform).filter(g => g.posts >= 3);
  if (caps.hasEngagement && plats.length >= 2) {
    const best = [...plats].sort((a, b) => b.engagementRate - a.engagementRate)[0];
    const worst = [...plats].sort((a, b) => a.engagementRate - b.engagementRate)[0];
    out.push({
      kind: "good",
      title: `${best.key} is your strongest audience`,
      body: `It engages at ${pct(best.engagementRate)} — the highest of your platforms. ${worst.key} sits at ${pct(worst.engagementRate)}. Lead with ${best.key} for new material, then cross-post the winners.`,
    });
  }

  // Best day of week.
  if (dated.length >= 10) {
    const dow = dayOfWeekStats(dated).filter(d => d.posts >= 2);
    if (dow.length) {
      const best = [...dow].sort((a, b) => b.avgViews - a.avgViews)[0];
      out.push({
        kind: "tip",
        title: `${DOW_FULL[best.i]} posts reach the most people`,
        body: `They average ${fmt(best.avgViews)} views vs. an overall average of ${fmt(totals.avgViews)}. Line up your best clips for ${DOW_FULL[best.i]}.`,
      });
    }
  }

  // Best posting window.
  if (dated.length >= 10) {
    const hours = hourStats(dated).filter(h => h.posts >= 2);
    if (hours.length) {
      const best = [...hours].sort((a, b) => b.avgViews - a.avgViews)[0];
      out.push({
        kind: "tip",
        title: `Your ${hourLabel(best.hour)} window outperforms`,
        body: `Posts published around ${hourLabel(best.hour)} average ${fmt(best.avgViews)} views. Try to schedule drops in that window.`,
      });
    }
  }

  // Duration signal.
  const durs = durationStats(posts.filter(p => p.durationSeconds > 0));
  if (durs.length >= 2) {
    const best = [...durs].sort((a, b) => b.avgViews - a.avgViews)[0];
    out.push({
      kind: "tip",
      title: `${best.label} clips land best`,
      body: `They average ${fmt(best.avgViews)} views at a ${pct(best.engagementRate)} engagement rate. Keep cuts in that range when you can.`,
    });
  }

  // Saves/shares — the "recommendation fuel" signal.
  if (totals.views > 0) {
    const shareRate = totals.shares / totals.views;
    const saveRate = totals.saves / totals.views;
    if (saveRate > 0.008 || shareRate > 0.008) {
      const lead = saveRate >= shareRate ? "saves" : "shares";
      out.push({
        kind: "good",
        title: `People ${lead === "saves" ? "save" : "share"} your work`,
        body: `${lead === "saves" ? "Saves" : "Shares"} run at ${pct(lead === "saves" ? saveRate : shareRate)} of views — a strong signal to the algorithm. Make more of whatever your top ${lead}d posts have in common.`,
      });
    }
  }

  // Consistency check.
  const weeks = timelineStats(dated);
  if (weeks.length >= 4) {
    const cadence = weeks.map(w => w.posts);
    const gaps = cadence.filter(c => c === 0).length;
    const spread = Math.max(...cadence) - Math.min(...cadence);
    if (gaps > 0 || spread >= 4) {
      out.push({
        kind: "warn",
        title: "Your posting cadence is uneven",
        body: `Weekly output swings from ${Math.min(...cadence)} to ${Math.max(...cadence)} posts. A steady rhythm compounds — pick a floor (e.g. 3/week) and protect it.`,
      });
    }
  }

  // Hit rate: how many posts clear a "good" bar (2x median).
  const med = median(posts.map(p => p.views)) || 1;
  const hits = posts.filter(p => p.views >= med * 2).length;
  out.push({
    kind: hits / posts.length >= 0.2 ? "good" : "tip",
    title: `${hits} of ${posts.length} posts broke out`,
    body: `${pct(hits / posts.length)} of your posts more than doubled your median reach. ${hits / posts.length >= 0.2 ? "That is a healthy hit rate — study those posts." : "Study those winners and make more like them."}`,
  });

  return out;
}

const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function hourLabel(h) {
  const suffix = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}
