/* Draws a client's card into any container. Used by the public page and by the admin preview. */
(function () {
  var T = window.Tap = window.Tap || {};
  var h = T.h;

  function rgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return [15, 107, 92];
    var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function toHex(a) { return "#" + a.map(function (v) { return ("0" + Math.round(v).toString(16)).slice(-2); }).join(""); }
  function lum(a) {
    var f = a.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  }
  /* One brand color in, four theme values out: the color itself for light mode, a lighter
     version for dark mode, and a readable text color on top of each. */
  T.palette = function (hex) {
    var a = rgb(hex), d = a.map(function (v) { return v + (255 - v) * 0.55; });
    return { l: toHex(a), d: toHex(d), onL: lum(a) > 0.4 ? "#111111" : "#ffffff", onD: lum(d) > 0.4 ? "#0d1512" : "#ffffff" };
  };

  function safeUrl(u) { return /^(https?:|viber:|tg:|whatsapp:)/i.test(u || "") ? u : "#"; }
  function initials(c) {
    var f = (c.first || T.displayName(c) || "?").trim().charAt(0), l = (c.last || "").trim().charAt(0);
    return (f + l).toUpperCase();
  }

  T.renderCard = function (root, c) {
    var p = T.palette(c.accent), name = T.displayName(c);
    root.style.setProperty("--accent-l", p.l); root.style.setProperty("--accent-d", p.d);
    root.style.setProperty("--on-accent-l", p.onL); root.style.setProperty("--on-accent-d", p.onD);
    root.textContent = "";

    root.appendChild(h("div", { class: "head" }, [
      h("p", { class: "tap-hint", text: "Tapped via NFC" }),
      h("p", { class: "company", text: c.company || "" })
    ]));

    var av = h("div", { class: "avatar" });
    if (c.photo) av.appendChild(h("img", { src: c.photo, alt: name })); else av.textContent = initials(c);
    root.appendChild(h("div", { class: "person" }, [
      av, h("h1", { text: name || "Your name" }), h("p", { class: "role", text: c.title || "" }),
      c.tagline ? h("p", { class: "tagline", text: c.tagline }) : null
    ]));

    var body = h("div", { class: "body" });
    var saveBtn = h("button", { class: "save", type: "button" });
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>';
    saveBtn.appendChild(document.createTextNode("Save to my contacts"));
    var fb = h("div", { class: "fallback", hidden: true }, [
      h("p", { text: "Phone did not offer to save? Copy the details and paste them into a new contact." }),
      h("button", { class: "ghost", type: "button", text: "Copy contact details", onclick: function () {
        T.copy([name, c.title, c.company, c.phoneDisplay || c.phone, c.email, c.website].filter(Boolean).join("\n"), "Details copied");
      } })
    ]);
    var save = function () {
      T.saveContact(c); fb.hidden = false;
      T.toast("Opening your contact screen. If nothing appears, copy the details below.");
    };
    saveBtn.addEventListener("click", save);
    body.appendChild(saveBtn);

    /* contact rows */
    var rows = h("div", { class: "rows" });
    if (c.phone) {
      /* tapping the number saves the contact */
      rows.appendChild(h("button", { class: "row phone", type: "button", onclick: save }, [
        h("span", {}, [h("span", { class: "k", text: "Mobile" }), h("span", { class: "v", text: c.phoneDisplay || c.phone })]),
        h("span", { class: "go", text: "Tap to save" })
      ]));
    }
    function linkRow(k, v, href, go) {
      var ext = /^https?:/.test(href);
      return h("a", { class: "row", href: href, target: ext ? "_blank" : null, rel: ext ? "noopener noreferrer" : null }, [
        h("span", {}, [h("span", { class: "k", text: k }), h("span", { class: "v", text: v })]),
        h("span", { class: "go", text: go })
      ]);
    }
    if (c.email) rows.appendChild(linkRow("Email", c.email, "mailto:" + c.email, "Write"));
    if (c.website) rows.appendChild(linkRow("Website", c.website.replace(/^https?:\/\//, ""), safeUrl(c.website), "Open"));
    if (c.address) rows.appendChild(linkRow("Address", c.address, "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.address), "Map"));
    var contact = h("div", {}, [h("p", { class: "section-label", text: "Contact" }), rows]);
    if (c.phone) contact.appendChild(h("div", { class: "sub" }, [
      h("a", { class: "ghost", href: "tel:" + c.phone, text: "Call now" }),
      h("a", { class: "ghost", href: "sms:" + c.phone, text: "Text" })
    ]));
    if (c.phone || c.email || c.website || c.address) body.appendChild(contact);

    /* socials */
    var socials = (c.socials || []).filter(function (s) { return s && s.url; });
    if (socials.length) {
      var sr = h("div", { class: "rows" });
      socials.forEach(function (s) {
        var ext = /^https?:/.test(s.url);
        sr.appendChild(h("a", { class: "row social", href: safeUrl(s.url), target: ext ? "_blank" : null, rel: ext ? "noopener noreferrer" : null }, [
          h("span", {}, [h("span", { class: "v" }, [(s.label || "Link") + " ", h("small", { text: s.handle || "" })])]),
          h("span", { class: "go", text: "Open" })
        ]));
      });
      body.appendChild(h("div", {}, [h("p", { class: "section-label", text: "Find us online" }), sr]));
    }

    body.appendChild(fb);
    if (c.note) body.appendChild(h("p", { class: "foot", text: c.note }));
    root.appendChild(body);
  };
})();
