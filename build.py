#!/usr/bin/env python3
"""Bundle the multi-file app into one self-contained HTML page (for hosting/sharing)."""
import re, pathlib, html

root = pathlib.Path(__file__).parent

def esc_template(s):  # make text safe inside a JS backtick template literal
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")

index = (root / "index.html").read_text()
css   = (root / "css/styles.css").read_text()
js    = "\n".join((root / f"js/{f}").read_text() for f in
                  ["parse.js", "analytics.js", "charts.js", "app.js"])

mine   = (root / "data/theillcollective.csv").read_text()
sample = (root / "data/sample.csv").read_text()

# Pull the <body> inner markup (drop the doctype/head and the <script> includes).
body = re.search(r"<body>(.*?)<script", index, re.S).group(1).strip()
# Grab the <title>.
title = re.search(r"<title>(.*?)</title>", index).group(1)

# fetch() shim so the app's existing fetch("data/*.csv") calls resolve to embedded text.
shim = f"""
const __EMBEDDED = {{
  "data/theillcollective.csv": `{esc_template(mine)}`,
  "data/sample.csv": `{esc_template(sample)}`,
}};
const __origFetch = window.fetch ? window.fetch.bind(window) : null;
window.fetch = (u, ...rest) => {{
  const key = String(u);
  const hit = Object.keys(__EMBEDDED).find(k => key.endsWith(k));
  if (hit) return Promise.resolve(new Response(__EMBEDDED[hit], {{ status: 200, headers: {{ "Content-Type": "text/csv" }} }}));
  return __origFetch ? __origFetch(u, ...rest) : Promise.reject(new Error("offline"));
}};
"""

out = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{shim}
{js}
</script>
</body>
</html>
"""

dist = root / "dist"
dist.mkdir(exist_ok=True)
(dist / "signal.html").write_text(out)
print("wrote dist/signal.html", len(out), "bytes")
