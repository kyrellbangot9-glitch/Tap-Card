/* Public card page: find the slug in the address, load that client, draw the card. */
(function () {
  var T = window.Tap, h = T.h, C = window.TAP_CONFIG || {};
  var page = document.getElementById("page");

  function slugFromAddress() {
    var m = /\/c\/([^\/?#]+)/.exec(location.pathname);               /* https://cards.yourbrand.com/c/kape-ni-lolo */
    if (m) return decodeURIComponent(m[1]);
    return new URLSearchParams(location.search).get("c") || location.hash.replace("#", "");   /* ?c=slug or #slug while testing */
  }
  function note(text) { page.textContent = ""; page.appendChild(h("p", { class: "page-note", text: text })); }

  function showHome() {
    /* No card in the address. With a real database the bare address is the owner's door: go to the admin login.
       Card links always carry ?c=name, so customers never land here. */
    if (C.MODE === "supabase") { location.replace("admin/"); return; }
    /* In demo mode, list the sample cards so testing is one click. */
    page.textContent = "";
    page.appendChild(h("p", { class: "page-note", text: "No card selected. A card link ends with ?c=name (for example index.html?c=kape-ni-lolo)." }));
    if (C.MODE === "supabase") return;
    T.store.list().then(function (list) {
      if (!list.length) return;
      var ul = h("div", { class: "rows", style: "width:100%" });
      list.forEach(function (c) {
        ul.appendChild(h("a", { class: "row", href: "?c=" + encodeURIComponent(c.slug) }, [
          h("span", {}, [h("span", { class: "k", text: c.slug }), h("span", { class: "v", text: c.company || T.displayName(c) })]),
          h("span", { class: "go", text: "Open" })
        ]));
      });
      page.appendChild(ul);
    });
  }

  function show() {
    var slug = slugFromAddress();
    if (!slug) return showHome();
    note("Loading card...");
    T.store.get(slug).then(function (client) {
      if (!client) { note("This card was not found. Check the link or ask the card owner for a new one."); return; }
      page.textContent = "";
      var card = h("article", { class: "card", "aria-label": "Digital business card" });
      page.appendChild(card);
      T.renderCard(card, client);
      document.title = T.displayName(client) + " | " + (client.company || "Digital card");
    }).catch(function () { note("Could not load this card. Check your connection and tap again."); });
  }

  T.store.init().then(function () {
    show();
    window.addEventListener("hashchange", show);   /* typing a new #name in the address bar now updates the page */
  }).catch(function () { note("Could not start. Check config.js."); });
})();