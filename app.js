(function () {
  "use strict";
  var C = window.COURSE || { lessons: [], tracks: [], titles: {}, done: [] };
  var KEY = "backend-checklist-done-v1";
  var done = {};

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function mmss(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? h + ":" + pad(m) + ":" + pad(r) : pad(m) + ":" + pad(r);
  }
  function mins(s) { return Math.round(s / 60); }
  function long(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? h + "h " + m + "m " + r + "s" : m + "m " + r + "s";
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Progress is kept in localStorage. It can throw (private mode, blocked storage), so every access is wrapped.
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var arr = JSON.parse(raw); arr.forEach(function (id) { done[id] = true; }); return; }
    } catch (e) {}
    (C.done || []).forEach(function (id) { done[id] = true; });
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(Object.keys(done))); $("status").textContent = ""; }
    catch (e) { $("status").textContent = "Progress can't be saved in this browser (storage is blocked)."; }
  }

  function buildGroups() {
    var lessons = C.lessons.slice().sort(function (a, b) { return a.sec - b.sec || 0; });
    var bySec = {}, order = [];
    C.lessons.forEach(function (l) {
      if (!bySec[l.sec]) { bySec[l.sec] = { key: l.sec, title: C.titles[l.sec] || ("Section " + l.sec), items: [] }; order.push(bySec[l.sec]); }
      bySec[l.sec].items.push(l);
    });
    var used = {}, layout = [];
    (C.tracks || []).forEach(function (t) {
      var gs = [];
      (t.secs || []).forEach(function (k) { if (bySec[k] && !used[k]) { used[k] = true; gs.push(bySec[k]); } });
      if (gs.length) layout.push({ name: t.name, note: t.note, groups: gs });
    });
    var rest = order.filter(function (g) { return !used[g.key]; });
    if (rest.length) layout.push({ name: "Other", note: "", groups: rest });
    return layout;
  }

  var layout = buildGroups();

  function render() {
    var activeId = document.activeElement && document.activeElement.id;
    var list = $("list");
    list.textContent = "";

    var total = 0, watched = 0, doneCount = 0;
    C.lessons.forEach(function (l) {
      var s = l.s || 0;
      total += s;
      if (done[l.id]) { watched += s; doneCount++; }
    });
    $("sDone").textContent = doneCount + " / " + C.lessons.length;
    $("sWatched").textContent = mins(watched).toLocaleString() + " / " + mins(total).toLocaleString() + " min";
    $("sLeft").textContent = long(total - watched);
    $("sTotal").textContent = long(total);
    var pct = total ? Math.round((watched / total) * 100) : 0;
    $("barFill").style.width = pct + "%";
    $("bar").setAttribute("aria-valuenow", pct);
    $("barNote").textContent = pct + "% of the video time covered, " + mins(total - watched).toLocaleString() + " min to go";

    var n = 0;
    var frag = document.createDocumentFragment();
    layout.forEach(function (t) {
      var tn = 0, td = 0, tw = 0, tt = 0;
      t.groups.forEach(function (g) { g.items.forEach(function (l) { tn++; tt += l.s || 0; if (done[l.id]) { td++; tw += l.s || 0; } }); });
      var tHead = el("div", "track-head");
      tHead.appendChild(el("h2", null, t.name));
      tHead.appendChild(el("div", "track-meta", td + "/" + tn + " lessons · " + mins(tw) + " / " + mins(tt) + " min" + (t.note ? " · " + t.note : "")));
      frag.appendChild(tHead);

      t.groups.forEach(function (g) {
        var sec = el("section", "sec");
        var gTotal = 0, gWatched = 0, gDone = 0;
        g.items.forEach(function (l) { gTotal += l.s || 0; if (done[l.id]) { gWatched += l.s || 0; gDone++; } });

        var head = el("div", "sec-head");
        head.appendChild(el("h2", null, g.title));
        head.appendChild(el("div", "sec-meta", gDone + "/" + g.items.length + " done · " + mins(gWatched) + " / " + mins(gTotal) + " min"));
        sec.appendChild(head);
        var bar = el("div", "sec-bar");
        var fill = document.createElement("i");
        fill.style.width = (gTotal ? Math.round((gWatched / gTotal) * 100) : (gDone === g.items.length ? 100 : 0)) + "%";
        bar.appendChild(fill);
        sec.appendChild(bar);

        g.items.forEach(function (l) {
          n++;
          var isDone = !!done[l.id];
          var row = el("label", "row" + (isDone ? " is-done" : ""));
          var cb = document.createElement("input");
          cb.type = "checkbox";
          cb.id = "c-" + l.id;
          cb.checked = isDone;
          cb.addEventListener("change", function () {
            if (cb.checked) done[l.id] = true; else delete done[l.id];
            save();
            render();
          });
          row.appendChild(cb);
          row.appendChild(el("span", "num", pad(n)));
          row.appendChild(el("span", "ttl", l.t));
          var dur = el("span", "dur");
          if (l.s == null) dur.appendChild(el("span", "tag", l.k === "pdf" ? "PDF" : "—"));
          else dur.textContent = mmss(l.s);
          row.appendChild(dur);
          sec.appendChild(row);
        });
        frag.appendChild(sec);
      });
    });
    list.appendChild(frag);

    if (activeId) { var a = $(activeId); if (a) a.focus(); }
  }

  // Two-step reset: the first click asks, the second confirms. (No confirm() dialog, so it works everywhere.)
  var resetArmed = false, resetTimer = null;
  $("reset").addEventListener("click", function () {
    var b = $("reset");
    if (!resetArmed) {
      resetArmed = true;
      b.textContent = "Click again to clear all ticks";
      resetTimer = setTimeout(function () { resetArmed = false; b.textContent = "Reset progress"; }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    b.textContent = "Reset progress";
    done = {};
    save();
    render();
  });

  load();
  render();
})();
