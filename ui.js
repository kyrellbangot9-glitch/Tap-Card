/* Tiny helpers shared by the card page and the admin: DOM builder, toast, copy-to-clipboard. */
(function () {
  var T = window.Tap = window.Tap || {};

  /* h("div", {class: "x", onclick: fn}, [child, "text"]) */
  T.h = function (tag, attrs, kids) {
    var n = document.createElement(tag), later = null;
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style") n.style.cssText = v;      /* set through CSSOM so a strict CSP allows it */
      else if (k === "value") later = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    if (later !== null) n.value = later;
    return n;
  };

  var timer;
  T.toast = function (msg) {
    var t = document.getElementById("toast");
    if (!t) { t = T.h("div", { id: "toast", class: "toast", role: "status" }); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(timer); timer = setTimeout(function () { t.hidden = true; }, 3200);
  };

  T.copy = function (text, okMsg) {
    var ok = function () { T.toast(okMsg || "Copied"); };
    var fallback = function () {
      var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); ok(); } catch (e) { T.toast("Select the text and copy it manually"); }
      document.body.removeChild(ta);
    };
    try { navigator.clipboard.writeText(text).then(ok, fallback); } catch (e) { fallback(); }
  };

  T.slugify = function (s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  };

  /* "Dr. Mara Villanueva" built from the three name parts */
  T.displayName = function (c) {
    var parts = [c.prefix, c.first, c.last].map(function (x) { return (x || "").trim(); }).filter(Boolean);
    return parts.length ? parts.join(" ") : (c.name || "");
  };
})();
