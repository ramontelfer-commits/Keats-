// parse.js — CSV parsing and post-record normalization.
// Accepts flexible column names so exports from different tools can be dropped in.

const COLUMN_ALIASES = {
  platform:   ["platform", "network", "channel type", "source"],
  account:    ["account", "handle", "username", "channel", "profile", "page"],
  publishedAt:["published_at", "date", "posted", "publish date", "post date", "time", "created", "datetime", "published"],
  title:      ["title", "caption", "description", "text", "post", "name"],
  url:        ["url", "link", "permalink", "post url"],
  views:      ["views", "impressions", "plays", "reach", "video views"],
  likes:      ["likes", "reactions", "favorites", "hearts"],
  comments:   ["comments", "replies"],
  shares:     ["shares", "reshares", "retweets", "sends"],
  saves:      ["saves", "bookmarks", "saved"],
  followersGained: ["followers_gained", "followers gained", "new followers", "follows"],
  durationSeconds: ["duration_seconds", "duration", "length", "seconds", "video length"],
};

// Minimal RFC-4180-ish CSV parser (handles quotes, commas, newlines inside quotes).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

function buildHeaderMap(headerRow) {
  const normalized = headerRow.map(h => h.trim().toLowerCase());
  const map = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = normalized.findIndex(h => aliases.includes(h));
    if (idx !== -1) map[key] = idx;
  }
  return map;
}

function num(v) {
  if (v == null) return 0;
  const cleaned = String(v).replace(/[, ]/g, "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function guessPlatformFromUrl(url) {
  if (!url) return "Unknown";
  const u = url.toLowerCase();
  if (u.includes("tiktok")) return "TikTok";
  if (u.includes("youtu")) return "YouTube";
  if (u.includes("instagram")) return "Instagram";
  if (u.includes("twitter") || u.includes("x.com")) return "X";
  if (u.includes("facebook")) return "Facebook";
  return "Unknown";
}

function normalizePlatform(name, url) {
  const raw = (name || "").trim().toLowerCase();
  const table = {
    tiktok: "TikTok", tt: "TikTok",
    youtube: "YouTube", yt: "YouTube", "youtube shorts": "YouTube",
    instagram: "Instagram", ig: "Instagram", insta: "Instagram", reels: "Instagram",
    twitter: "X", x: "X",
    facebook: "Facebook", fb: "Facebook",
  };
  if (table[raw]) return table[raw];
  if (raw) return name.trim();
  return guessPlatformFromUrl(url);
}

// Turn raw CSV text into an array of normalized post records.
// Returns { posts, errors, matched } for surfacing parse feedback.
function parsePosts(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { posts: [], errors: ["File has no data rows."], matched: {} };

  const headerMap = buildHeaderMap(rows[0]);
  if (headerMap.views === undefined && headerMap.likes === undefined) {
    return {
      posts: [],
      errors: ["Could not find a 'views' or 'likes' column. Check the header row."],
      matched: headerMap,
    };
  }

  const posts = [];
  const errors = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (k) => (headerMap[k] !== undefined ? r[headerMap[k]] : undefined);
    const rawDate = get("publishedAt");
    const date = rawDate ? new Date(rawDate) : null;
    if (rawDate && isNaN(date.getTime())) {
      errors.push(`Row ${i + 1}: unrecognized date "${rawDate}"`);
    }
    const url = (get("url") || "").trim();
    posts.push({
      platform: normalizePlatform(get("platform"), url),
      account: (get("account") || "—").trim(),
      publishedAt: date && !isNaN(date.getTime()) ? date : null,
      title: (get("title") || "(untitled)").trim(),
      url,
      views: num(get("views")),
      likes: num(get("likes")),
      comments: num(get("comments")),
      shares: num(get("shares")),
      saves: num(get("saves")),
      followersGained: num(get("followersGained")),
      durationSeconds: num(get("durationSeconds")),
    });
  }
  return { posts, errors, matched: headerMap };
}
