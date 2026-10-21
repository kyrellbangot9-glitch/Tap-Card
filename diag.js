/* Self-diagnosis. Loaded FIRST on both pages. If another file is missing or a script crashes,
   this prints what went wrong on the page instead of leaving it blank. */
(function () {
  var missing = [];
  function box(title, lines) {
    if (!document.body) return;
    var d = document.createElement("div");
    d.setAttribute("role", "alert");
    d.style.cssText = "max-width:600px;margin:24px auto;padding:16px 18px;border:2px solid #b3261e;border-radius:12px;font:15px/1.5 system-ui,sans-serif;background:#fff;color:#111";
    var h = document.createElement("strong"); h.textContent = title; d.appendChild(h);
    lines.forEach(function (t) { var p = document.createElement("p"); p.style.margin = "8px 0 0"; p.textContent = t; d.appendChild(p); });
    document.body.insertBefore(d, document.body.firstChild);
  }
  window.addEventListener("error", function (e) {
    if (e.target && e.target.tagName === "SCRIPT") {
      /* Only our own files count. In-app browsers (Messenger, Facebook, Instagram) inject their own scripts,
         and the content security policy blocks them. That is harmless and not our problem. */
      var from = e.target.src || "";
      if (from.indexOf(location.origin + "/") === 0) missing.push(e.target.getAttribute("src") || "");
      return;
    }
    if (e.target && e.target.tagName) return;   /* a font or image that failed to download is not a crash */
    if (e.filename && e.filename.indexOf(location.origin + "/") !== 0) return;   /* an error inside someone else's script */
    box("A script error stopped this page", [String(e.message) + (e.filename ? "  (" + e.filename.split("/").pop() + ", line " + e.lineno + ")" : "")]);
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    box("Something failed while loading", [String(e.reason && e.reason.message || e.reason)]);
  });
  window.addEventListener("load", function () {
    if (missing.length) box("These files did not load: " + missing.join(", "), [
      "Keep the folder layout from the zip. config.js, ui.js, store.js, card.js, vcard.js, app.js, diag.js and styles.css sit next to the public index.html. Only index.html, admin.js and admin.css go inside the admin folder.",
      "The two files named index.html are different. Do not put them in the same folder."
    ]);
  });
})();