/* Buddy — a stripped-back spending tracker. No dependencies. Saves to localStorage. */
(function () {
  "use strict";

  // ---- Categories -------------------------------------------------------
  var CATS = [
    { id: "food",     name: "Food",      emoji: "🍜", color: "#ff9f0a" },
    { id: "grocery",  name: "Groceries", emoji: "🛒", color: "#30b757" },
    { id: "transport",name: "Transport", emoji: "🚌", color: "#0a84ff" },
    { id: "coffee",   name: "Coffee",    emoji: "☕", color: "#a2845e" },
    { id: "shopping", name: "Shopping",  emoji: "🛍️", color: "#bf5af2" },
    { id: "bills",    name: "Bills",     emoji: "🧾", color: "#5e5ce6" },
    { id: "fun",      name: "Fun",       emoji: "🎉", color: "#ff375f" },
    { id: "health",   name: "Health",    emoji: "❤️", color: "#ff453a" },
    { id: "home",     name: "Home",      emoji: "🏠", color: "#64d2ff" },
    { id: "income",   name: "Income",    emoji: "💰", color: "#30b757" },
    { id: "other",    name: "Other",     emoji: "•",  color: "#8a8a8e" },
  ];
  function cat(id) { return CATS.find(function (c) { return c.id === id; }) || CATS[CATS.length - 1]; }

  // ---- State ------------------------------------------------------------
  var KEY = "buddy.spend.v1";
  var MONTHLY_BUDGET = 2000; // simple default budget for warnings
  var data = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return seed();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  function seed() {
    var t = todayStr();
    var d = new Date();
    function ago(n) { var x = new Date(d); x.setDate(x.getDate() - n); return dstr(x); }
    function ahead(n) { var x = new Date(d); x.setDate(x.getDate() + n); return dstr(x); }
    return {
      budget: MONTHLY_BUDGET,
      txns: [
        { id: uid(), amount: 4.5, type: "expense", cat: "coffee",   note: "Flat white", date: t },
        { id: uid(), amount: 82.3, type: "expense", cat: "grocery",  note: "Countdown",  date: ago(1) },
        { id: uid(), amount: 19,   type: "expense", cat: "transport",note: "Fuel top-up",date: ago(2) },
        { id: uid(), amount: 2400, type: "income",  cat: "income",   note: "Pay",        date: ago(3) },
        { id: uid(), amount: 28,   type: "expense", cat: "fun",      note: "Movie night",date: ago(4) },
      ],
      recurring: [
        { id: uid(), name: "Rent",    amount: 620, cat: "home",  cycle: "weekly",  next: ahead(3) },
        { id: uid(), name: "Spotify", amount: 15,  cat: "fun",   cycle: "monthly", next: ahead(9) },
        { id: uid(), name: "Gym",     amount: 22,  cat: "health",cycle: "fortnightly", next: ahead(6) },
      ],
      upcoming: [
        { id: uid(), name: "Concert ticket", amount: 89, cat: "fun",   date: ahead(5) },
        { id: uid(), name: "Car service",    amount: 240, cat: "transport", date: ahead(12) },
      ],
    };
  }

  // ---- Helpers ----------------------------------------------------------
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function dstr(d) { return d.toISOString().slice(0, 10); }
  function todayStr() { return dstr(new Date()); }
  function parseDate(s) { return new Date(s + "T00:00:00"); }
  function money(n) { return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function money0(n) { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function tint(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  function sameMonth(s) {
    var d = parseDate(s), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  }
  function relDate(s) {
    var d = parseDate(s), n = parseDate(todayStr());
    var days = Math.round((d - n) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days === -1) return "Yesterday";
    if (days > 1 && days < 7) return "in " + days + " days";
    if (days < 0) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  // ---- Rendering --------------------------------------------------------
  var viewEl = document.getElementById("view");
  var current = "home";

  function render() {
    if (current === "home") renderHome();
    else if (current === "recurring") renderRecurring();
    else if (current === "upcoming") renderUpcoming();
    save();
  }

  function badge(c, size) {
    var s = size || 38;
    return '<div class="txn-badge" style="width:' + s + 'px;height:' + s + 'px;background:' +
      tint(c.color, 0.16) + '">' + c.emoji + "</div>";
  }

  function renderHome() {
    var month = new Date().toLocaleDateString(undefined, { month: "long" });
    var expenses = data.txns.filter(function (t) { return t.type === "expense" && sameMonth(t.date); });
    var incomes  = data.txns.filter(function (t) { return t.type === "income"  && sameMonth(t.date); });
    var spent = expenses.reduce(function (s, t) { return s + t.amount; }, 0);
    var earned = incomes.reduce(function (s, t) { return s + t.amount; }, 0);
    var budget = data.budget || 0;
    var pct = budget ? Math.min(100, spent / budget * 100) : 0;
    var over = budget && spent > budget;

    var whole = Math.floor(spent), cents = Math.round((spent - whole) * 100);

    // by-category breakdown
    var byCat = {};
    expenses.forEach(function (t) { byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; });
    var cats = Object.keys(byCat).map(function (id) { return { c: cat(id), amt: byCat[id] }; })
      .sort(function (a, b) { return b.amt - a.amt; });
    var maxCat = cats.length ? cats[0].amt : 1;

    var html = "";
    html += '<div class="head"><div class="head-sub">' + month + '</div>' +
            '<h1 class="head-title">Spending</h1></div>';

    // hero
    html += '<div class="hero">' +
      '<div class="hero-label">Spent this month</div>' +
      '<div class="hero-amount">$' + money0(whole) +
        '<span class="cents">.' + String(cents).padStart(2, "0") + '</span></div>' +
      '<div class="hero-meta">' + (earned ? '<b>+$' + money0(earned) + '</b> in · ' : '') +
        expenses.length + ' transaction' + (expenses.length === 1 ? '' : 's') + '</div>';
    if (budget) {
      html += '<div class="budget"><div class="budget-track">' +
        '<div class="budget-fill" style="width:' + pct + '%;background:' +
          (over ? 'var(--spend)' : pct > 80 ? '#ff9f0a' : 'var(--accent)') + '"></div></div>' +
        '<div class="budget-row"><span>$' + money0(spent) + ' of $' + money0(budget) + '</span>' +
        '<span>' + (over ? '$' + money0(spent - budget) + ' over' : '$' + money0(budget - spent) + ' left') +
        '</span></div></div>';
    }
    html += '</div>';

    // warnings
    var warns = buildWarnings(spent, budget, pct);
    if (warns.length) {
      html += '<div class="warns">' + warns.map(function (w) {
        return '<div class="warn ' + w.tone + '"><div class="warn-ico">' + w.ico +
          '</div><div class="warn-txt">' + w.text + '</div></div>';
      }).join("") + '</div>';
    }

    // category breakdown
    if (cats.length) {
      html += '<div class="sec-head"><div class="sec-title">Categories</div></div>';
      html += '<div class="cats">' + cats.map(function (x) {
        return '<div class="cat-line">' +
          '<div class="cat-badge" style="background:' + tint(x.c.color, 0.16) + '">' + x.c.emoji + '</div>' +
          '<div class="cat-name">' + esc(x.c.name) + '</div>' +
          '<div class="cat-bar"><i style="width:' + (x.amt / maxCat * 100) + '%;background:' + x.c.color + '"></i></div>' +
          '<div class="cat-amt">$' + money(x.amt) + '</div></div>';
      }).join("") + '</div>';
    }

    // recent transactions grouped by date
    html += '<div class="sec-head"><div class="sec-title">Recent</div></div>';
    var sorted = data.txns.slice().sort(function (a, b) { return b.date < a.date ? -1 : b.date > a.date ? 1 : 0; });
    if (!sorted.length) {
      html += emptyState("💸", "No transactions yet", "Tap + to add your first one.");
    } else {
      var groups = {};
      sorted.forEach(function (t) { (groups[t.date] = groups[t.date] || []).push(t); });
      Object.keys(groups).sort().reverse().forEach(function (date) {
        html += '<div class="date-group"><div class="date-label">' + relDate(date) +
          '</div><div class="list">' + groups[date].map(txnRow).join("") + '</div></div>';
      });
    }

    viewEl.innerHTML = html;
    viewEl.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () { delTxn(b.getAttribute("data-del")); });
    });
  }

  function txnRow(t) {
    var c = cat(t.cat);
    var sign = t.type === "income" ? "+" : "−";
    return '<div class="txn">' + badge(c) +
      '<div class="txn-body"><div class="txn-name">' + esc(t.note || c.name) +
      '</div><div class="txn-sub">' + esc(c.name) + '</div></div>' +
      '<div class="txn-amt ' + (t.type === "income" ? "income" : "") + '">' + sign + '$' + money(t.amount) + '</div>' +
      '<button class="txn-del" data-del="' + t.id + '" title="Delete">✕</button></div>';
  }

  function buildWarnings(spent, budget, pct) {
    var w = [];
    // Budget pressure
    if (budget && spent > budget) {
      w.push({ tone: "alert", ico: "🚨", text: "You're <b>$" + money0(spent - budget) + " over</b> your $" + money0(budget) + " budget this month." });
    } else if (budget && pct >= 80) {
      w.push({ tone: "soft", ico: "⚠️", text: "You've used <b>" + Math.round(pct) + "%</b> of your monthly budget." });
    }
    // Upcoming costs due soon
    var soon = data.upcoming.filter(function (u) {
      var days = Math.round((parseDate(u.date) - parseDate(todayStr())) / 86400000);
      return days >= 0 && days <= 7;
    });
    if (soon.length) {
      var total = soon.reduce(function (s, u) { return s + u.amount; }, 0);
      w.push({ tone: "soft", ico: "📅", text: "<b>$" + money0(total) + "</b> in upcoming costs due within 7 days." });
    }
    // Recurring due today/tomorrow
    var dueRec = data.recurring.filter(function (r) {
      var days = Math.round((parseDate(r.next) - parseDate(todayStr())) / 86400000);
      return days >= 0 && days <= 1;
    });
    dueRec.forEach(function (r) {
      w.push({ tone: "soft", ico: "↻", text: "<b>" + esc(r.name) + "</b> ($" + money0(r.amount) + ") is due " + relDate(r.next).toLowerCase() + "." });
    });
    return w;
  }

  function renderRecurring() {
    var monthly = data.recurring.reduce(function (s, r) { return s + r.amount * perMonth(r.cycle); }, 0);
    var html = '<div class="head"><div class="head-sub">Fixed costs</div>' +
      '<h1 class="head-title">Recurring</h1></div>';
    html += '<div class="hero"><div class="hero-label">Est. per month</div>' +
      '<div class="hero-amount">$' + money0(monthly) + '</div>' +
      '<div class="hero-meta">' + data.recurring.length + ' recurring cost' + (data.recurring.length === 1 ? '' : 's') + '</div></div>';

    if (!data.recurring.length) {
      html += emptyState("↻", "No recurring costs", "Add one with + and set Repeat.");
    } else {
      var sorted = data.recurring.slice().sort(function (a, b) { return a.next < b.next ? -1 : 1; });
      html += '<div class="list">' + sorted.map(function (r) {
        var c = cat(r.cat);
        return '<div class="txn">' + badge(c) +
          '<div class="txn-body"><div class="txn-name">' + esc(r.name) +
          '</div><div class="txn-sub">' + cycleLabel(r.cycle) + ' · next ' + relDate(r.next) + '</div></div>' +
          '<div class="txn-amt">$' + money(r.amount) + '</div>' +
          '<button class="txn-del" data-delr="' + r.id + '">✕</button></div>';
      }).join("") + '</div>';
    }
    viewEl.innerHTML = html;
    viewEl.querySelectorAll("[data-delr]").forEach(function (b) {
      b.addEventListener("click", function () {
        data.recurring = data.recurring.filter(function (r) { return r.id !== b.getAttribute("data-delr"); });
        render();
      });
    });
  }

  function renderUpcoming() {
    var sorted = data.upcoming.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var total = sorted.reduce(function (s, u) { return s + u.amount; }, 0);
    var html = '<div class="head"><div class="head-sub">One-off future spends</div>' +
      '<h1 class="head-title">Upcoming</h1></div>';
    html += '<div class="hero"><div class="hero-label">Total upcoming</div>' +
      '<div class="hero-amount">$' + money0(total) + '</div>' +
      '<div class="hero-meta">' + sorted.length + ' planned' + '</div></div>';

    if (!sorted.length) {
      html += emptyState("📅", "Nothing upcoming", "Plan a future cost — add it with + and pick a date.");
    } else {
      html += '<div class="list">' + sorted.map(function (u) {
        var c = cat(u.cat);
        return '<div class="txn">' + badge(c) +
          '<div class="txn-body"><div class="txn-name">' + esc(u.name) +
          '</div><div class="txn-sub">' + relDate(u.date) + ' · ' + c.name + '</div></div>' +
          '<div class="txn-amt">$' + money(u.amount) + '</div>' +
          '<button class="txn-del" data-delu="' + u.id + '">✕</button></div>';
      }).join("") + '</div>';
    }
    viewEl.innerHTML = html;
    viewEl.querySelectorAll("[data-delu]").forEach(function (b) {
      b.addEventListener("click", function () {
        data.upcoming = data.upcoming.filter(function (u) { return u.id !== b.getAttribute("data-delu"); });
        render();
      });
    });
  }

  function emptyState(emoji, title, sub) {
    return '<div class="empty"><div class="empty-emoji">' + emoji + '</div>' +
      '<div class="empty-title">' + esc(title) + '</div>' +
      '<div class="empty-sub">' + esc(sub) + '</div></div>';
  }
  function perMonth(cycle) { return cycle === "weekly" ? 4.33 : cycle === "fortnightly" ? 2.17 : 1; }
  function cycleLabel(cycle) { return cycle === "weekly" ? "Weekly" : cycle === "fortnightly" ? "Fortnightly" : "Monthly"; }

  function delTxn(id) { data.txns = data.txns.filter(function (t) { return t.id !== id; }); render(); }

  // ---- Add sheet --------------------------------------------------------
  var sheet = document.getElementById("sheet");
  var scrim = document.getElementById("scrim");
  var amountEl = document.getElementById("amount");
  var noteEl = document.getElementById("note");
  var dateEl = document.getElementById("date");
  var repeatEl = document.getElementById("repeat");
  var signEl = document.getElementById("amount-sign");
  var catGrid = document.getElementById("cat-grid");
  var pickedCat = "food";
  var pickedType = "expense";

  // Build category picker (skip pure-income cat under expense; keep all otherwise)
  function buildCatGrid() {
    catGrid.innerHTML = CATS.filter(function (c) { return c.id !== "income" || pickedType === "income"; })
      .map(function (c) {
        return '<button class="cat-pick' + (c.id === pickedCat ? ' active' : '') + '" data-cat="' + c.id + '">' +
          '<div class="cat-badge" style="background:' + tint(c.color, 0.16) + '">' + c.emoji + '</div>' +
          '<span>' + esc(c.name) + '</span></button>';
      }).join("");
    catGrid.querySelectorAll("[data-cat]").forEach(function (b) {
      b.addEventListener("click", function () {
        pickedCat = b.getAttribute("data-cat");
        buildCatGrid();
      });
    });
  }

  function openSheet() {
    pickedType = "expense"; pickedCat = "food";
    amountEl.value = ""; noteEl.value = ""; repeatEl.value = "";
    dateEl.value = todayStr();
    setType("expense");
    scrim.classList.remove("hidden"); sheet.classList.remove("hidden");
    requestAnimationFrame(function () { scrim.classList.add("show"); sheet.classList.add("show"); });
    setTimeout(function () { amountEl.focus(); }, 250);
  }
  function closeSheet() {
    scrim.classList.remove("show"); sheet.classList.remove("show");
    setTimeout(function () { scrim.classList.add("hidden"); sheet.classList.add("hidden"); }, 300);
  }
  function setType(type) {
    pickedType = type;
    document.querySelectorAll("#type-seg .seg-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-type") === type);
    });
    signEl.textContent = type === "income" ? "+" : "−";
    signEl.style.color = type === "income" ? "var(--income)" : "var(--spend)";
    if (type === "income") pickedCat = "income";
    else if (pickedCat === "income") pickedCat = "food";
    buildCatGrid();
  }

  function saveTxn() {
    var amt = parseFloat(amountEl.value);
    if (!amt || amt <= 0) { amountEl.focus(); return; }
    var date = dateEl.value || todayStr();
    var note = noteEl.value.trim();
    var future = parseDate(date) > parseDate(todayStr());

    if (repeatEl.value) {
      // Recurring cost
      data.recurring.push({ id: uid(), name: note || cat(pickedCat).name, amount: amt, cat: pickedCat, cycle: repeatEl.value, next: date });
      current = "recurring"; setActiveTab("recurring");
    } else if (future && pickedType === "expense") {
      // Future one-off = upcoming
      data.upcoming.push({ id: uid(), name: note || cat(pickedCat).name, amount: amt, cat: pickedCat, date: date });
      current = "upcoming"; setActiveTab("upcoming");
    } else {
      data.txns.push({ id: uid(), amount: amt, type: pickedType, cat: pickedCat, note: note, date: date });
      current = "home"; setActiveTab("home");
    }
    closeSheet();
    render();
  }

  // ---- Wiring -----------------------------------------------------------
  document.getElementById("fab").addEventListener("click", openSheet);
  document.getElementById("sheet-cancel").addEventListener("click", closeSheet);
  document.getElementById("sheet-save").addEventListener("click", saveTxn);
  scrim.addEventListener("click", closeSheet);
  document.querySelectorAll("#type-seg .seg-btn").forEach(function (b) {
    b.addEventListener("click", function () { setType(b.getAttribute("data-type")); });
  });
  amountEl.addEventListener("input", function () {
    // keep it numeric-ish
    this.value = this.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  });

  function setActiveTab(v) {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-view") === v);
    });
  }
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      current = t.getAttribute("data-view");
      setActiveTab(current);
      render();
    });
  });

  buildCatGrid();
  render();
})();
