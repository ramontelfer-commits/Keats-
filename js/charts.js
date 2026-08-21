// charts.js — tiny dependency-free SVG chart helpers, theme-aware via CSS vars.

const SVGNS = "http://www.w3.org/2000/svg";
function el(name, attrs = {}, children = []) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of [].concat(children)) if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}
function svg(w, h) {
  return el("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%", height: h, class: "chart", preserveAspectRatio: "xMidYMid meet", role: "img" });
}
function axisColor() { return "var(--grid)"; }
function textColor() { return "var(--text-dim)"; }

// Horizontal bar chart. data: [{label, value, color?}]
function barChart(container, data, { valueFmt = String, height } = {}) {
  container.innerHTML = "";
  if (!data.length) return;
  const rowH = 34, padL = 130, padR = 60, padT = 6, padB = 6, w = 720;
  const h = height || padT + padB + data.length * rowH;
  const max = Math.max(...data.map(d => d.value), 1);
  const s = svg(w, h);
  data.forEach((d, i) => {
    const y = padT + i * rowH + rowH / 2;
    const barW = Math.max(2, (w - padL - padR) * (d.value / max));
    s.appendChild(el("text", { x: padL - 12, y: y + 4, "text-anchor": "end", class: "c-label" }, d.label));
    s.appendChild(el("rect", { x: padL, y: y - 11, width: barW, height: 22, rx: 5, fill: d.color || "var(--accent)" }));
    s.appendChild(el("text", { x: padL + barW + 8, y: y + 4, class: "c-value" }, valueFmt(d.value)));
  });
  container.appendChild(s);
}

// Vertical column chart (e.g. by hour / day). data: [{label, value}]
function columnChart(container, data, { valueFmt = String, highlightMax = true } = {}) {
  container.innerHTML = "";
  if (!data.length) return;
  const w = 720, h = 240, padL = 40, padR = 12, padT = 16, padB = 34;
  const max = Math.max(...data.map(d => d.value), 1);
  const s = svg(w, h);
  const bw = (w - padL - padR) / data.length;
  const maxVal = Math.max(...data.map(d => d.value));
  // baseline
  s.appendChild(el("line", { x1: padL, y1: h - padB, x2: w - padR, y2: h - padB, stroke: axisColor() }));
  data.forEach((d, i) => {
    const x = padL + i * bw;
    const barH = (h - padT - padB) * (d.value / max);
    const isMax = highlightMax && d.value === maxVal && d.value > 0;
    s.appendChild(el("rect", {
      x: x + bw * 0.15, y: h - padB - barH, width: bw * 0.7, height: Math.max(0, barH),
      rx: 3, fill: isMax ? "var(--accent)" : "var(--bar-dim)",
    }));
    if (data.length <= 14 || i % 2 === 0)
      s.appendChild(el("text", { x: x + bw / 2, y: h - padB + 16, "text-anchor": "middle", class: "c-axis" }, d.label));
    if (isMax)
      s.appendChild(el("text", { x: x + bw / 2, y: h - padB - barH - 6, "text-anchor": "middle", class: "c-value" }, valueFmt(d.value)));
  });
  container.appendChild(s);
}

// Line chart with area fill for the weekly timeline. series: [{x, y}] with labels.
function lineChart(container, points, { valueFmt = String, labelFmt = String } = {}) {
  container.innerHTML = "";
  if (points.length < 2) { container.innerHTML = '<p class="empty">Not enough dated posts to plot a trend.</p>'; return; }
  const w = 720, h = 240, padL = 48, padR = 16, padT = 18, padB = 34;
  const max = Math.max(...points.map(p => p.y), 1);
  const s = svg(w, h);
  const X = i => padL + (w - padL - padR) * (i / (points.length - 1));
  const Y = v => h - padB - (h - padT - padB) * (v / max);
  // gridlines
  for (let g = 0; g <= 3; g++) {
    const gy = padT + (h - padT - padB) * (g / 3);
    s.appendChild(el("line", { x1: padL, y1: gy, x2: w - padR, y2: gy, stroke: axisColor(), "stroke-dasharray": "3 4" }));
    s.appendChild(el("text", { x: padL - 8, y: gy + 4, "text-anchor": "end", class: "c-axis" }, valueFmt(max * (1 - g / 3))));
  }
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${X(points.length - 1).toFixed(1)},${h - padB} L${padL},${h - padB} Z`;
  s.appendChild(el("path", { d: area, fill: "var(--accent-fade)" }));
  s.appendChild(el("path", { d: line, fill: "none", stroke: "var(--accent)", "stroke-width": 2.5, "stroke-linejoin": "round" }));
  points.forEach((p, i) => {
    s.appendChild(el("circle", { cx: X(i), cy: Y(p.y), r: 3.5, fill: "var(--accent)" }));
    if (points.length <= 16 && (i % Math.ceil(points.length / 8) === 0 || i === points.length - 1))
      s.appendChild(el("text", { x: X(i), y: h - padB + 16, "text-anchor": "middle", class: "c-axis" }, labelFmt(p.x)));
  });
  container.appendChild(s);
}

// Donut showing view share by platform. data: [{label, value, color}]
function donutChart(container, data) {
  container.innerHTML = "";
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return;
  const size = 200, r = 78, cx = size / 2, cy = size / 2, sw = 26;
  const s = svg(size, size);
  let angle = -Math.PI / 2;
  data.forEach(d => {
    const frac = d.value / total;
    const a2 = angle + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    if (frac > 0.999) {
      s.appendChild(el("circle", { cx, cy, r, fill: "none", stroke: d.color, "stroke-width": sw }));
    } else {
      s.appendChild(el("path", {
        d: `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`,
        fill: "none", stroke: d.color, "stroke-width": sw, "stroke-linecap": "butt",
      }));
    }
    angle = a2;
  });
  s.appendChild(el("text", { x: cx, y: cy - 4, "text-anchor": "middle", class: "donut-total" }, String(data.length)));
  s.appendChild(el("text", { x: cx, y: cy + 14, "text-anchor": "middle", class: "c-axis" }, "platforms"));
  container.appendChild(s);
}
