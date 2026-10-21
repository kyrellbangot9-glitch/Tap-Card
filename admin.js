/* Admin dashboard: list clients, edit one, save, delete, copy the NFC link. */
(function () {
  var T = window.Tap, h = T.h, S = T.store, C = window.TAP_CONFIG || {};
  var app = document.getElementById("app");
  var PLATFORMS = ["Facebook", "Instagram", "WhatsApp", "Viber", "TikTok", "Messenger", "Telegram", "X", "YouTube", "LinkedIn", "Website"];

  var state = { list: [], draft: null, isNew: false, dirty: false, slugTouched: false, filter: "", pending: null, confirmDelete: false, errors: [], savedAt: "" };
  var el = {};   /* live pieces updated without rebuilding the form */

  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  function blank() {
    return { slug: "", prefix: "", first: "", last: "", title: "", company: "", tagline: "", accent: "#2a6f5f", photo: "",
      phone: "", phoneDisplay: "", email: "", website: "", address: "", note: "", socials: [] };
  }
  function nfcLink(slug) { return (C.CARD_BASE || "") + (slug || "your-slug"); }

  /* ---------- boot ---------- */
  S.init().then(function () {
    if (S.needsLogin && !S.session()) return showLogin();
    return load();
  }).catch(showFatal);

  function showFatal(e) {
    app.textContent = "";
    app.appendChild(h("div", { class: "login" }, [h("h1", { text: "Could not start" }), h("p", { class: "mode", text: String(e && e.message || e) })]));
  }

  function showLogin(msg) {
    app.textContent = "";
    var email = h("input", { id: "em", type: "email", autocomplete: "username", required: true });
    var pw = h("input", { id: "pw", type: "password", autocomplete: "current-password", required: true });
    var err = h("p", { class: "errors", role: "alert", text: msg || "" });
    var form = h("form", { class: "login", onsubmit: function (ev) {
      ev.preventDefault();
      S.login(email.value, pw.value).then(load).catch(function (e) { err.textContent = "Sign in failed. Check your email and password."; });
    } }, [
      h("h1", { text: "Tap Card Admin" }),
      h("label", { class: "fld", for: "em" }, [h("span", { text: "Email" }), email]),
      h("label", { class: "fld", for: "pw" }, [h("span", { text: "Password" }), pw]),
      err, h("button", { class: "btn primary", type: "submit", text: "Sign in" })
    ]);
    app.appendChild(form);
  }

  function load() {
    return S.list().then(function (list) {
      state.list = list.sort(function (a, b) { return (a.company || "").localeCompare(b.company || ""); });
      if (state.list.length) select(state.list[0].slug); else startNew();
    }).catch(function (e) {
      if (S.needsLogin && !S.session()) return showLogin("Your session ended. Sign in again.");
      showFatal(e);
    });
  }

  /* ---------- state changes ---------- */
  function select(slug) {
    var rec = state.list.filter(function (c) { return c.slug === slug; })[0];
    if (!rec) return;
    state.draft = clone(rec); state.isNew = false; state.dirty = false; state.slugTouched = true;
    state.pending = null; state.confirmDelete = false; state.errors = []; state.savedAt = "";
    build();
  }
  function startNew(base) {
    state.draft = base || blank(); state.isNew = true; state.dirty = !!base; state.slugTouched = !!base;
    state.pending = null; state.confirmDelete = false; state.errors = []; state.savedAt = "";
    build();
  }
  function guard(action) {          /* ask before leaving unsaved edits */
    if (state.dirty) { state.pending = action; renderNotice(); } else action();
  }
  function touch() { state.dirty = true; state.savedAt = ""; renderPreview(); renderBar(); }

  /* ---------- layout ---------- */
  function build() {
    var scroll = window.scrollY;
    app.textContent = "";
    el = {};

    app.appendChild(h("header", { class: "top" }, [
      h("div", {}, [h("h1", { text: "Tap Card Admin" }), h("p", { class: "mode", text: S.label })]),
      h("div", { class: "top-actions" }, [
        h("button", { class: "btn", type: "button", text: "Light / dark", onclick: toggleTheme }),
        S.needsLogin ? h("button", { class: "btn", type: "button", text: "Sign out", onclick: function () { S.logout().then(function () { showLogin(); }); } }) : null
      ])
    ]));

    var shell = h("div", { class: "shell" });
    shell.appendChild(buildSide());
    shell.appendChild(buildEditor());
    var prev = h("aside", { class: "preview", "aria-label": "Card preview" }, [
      h("p", { class: "cap", text: "What the customer sees" }),
      el.card = h("article", { class: "card" })
    ]);
    shell.appendChild(prev);
    app.appendChild(shell);
    renderPreview(); renderBar(); renderNotice();
    window.scrollTo(0, scroll);
  }

  function buildSide() {
    var search = h("input", { id: "q", type: "search", placeholder: "Search clients", "aria-label": "Search clients", value: state.filter, oninput: function (e) { state.filter = e.target.value; renderList(); } });
    el.list = h("ul", { class: "clients" });
    var side = h("nav", { class: "side", "aria-label": "Clients" }, [
      h("button", { class: "btn primary", type: "button", text: "+ New client", onclick: function () { guard(function () { startNew(); }); } }),
      search, el.list
    ]);
    renderList();
    return side;
  }
  function renderList() {
    el.list.textContent = "";
    var q = state.filter.trim().toLowerCase();
    var items = state.list.filter(function (c) { return !q || (c.company + " " + T.displayName(c) + " " + c.slug).toLowerCase().indexOf(q) > -1; });
    if (!items.length) el.list.appendChild(h("li", {}, [h("p", { class: "empty", text: q ? "No client matches that search." : "No clients yet." })]));
    items.forEach(function (c) {
      var current = !state.isNew && state.draft && state.draft.slug === c.slug;
      el.list.appendChild(h("li", {}, [h("button", { class: "client-btn", type: "button", "aria-current": current ? "true" : null,
        onclick: function () { if (!current) guard(function () { select(c.slug); }); } }, [
        h("span", { class: "swatch", style: "background:" + (c.accent || "#888") }),
        h("span", {}, [h("strong", { text: c.company || T.displayName(c) }), h("span", { class: "sub", text: T.displayName(c) })])
      ])]));
    });
  }

  function field(label, key, o) {
    o = o || {};
    var id = "f-" + key;
    var input = h(o.area ? "textarea" : "input", {
      id: id, type: o.area ? null : (o.type || "text"), value: state.draft[key] || "", placeholder: o.ph || null,
      inputmode: o.mode || null, autocomplete: "off", readonly: o.readonly || null, rows: o.area ? 3 : null, maxlength: o.max || null,
      oninput: function (e) { state.draft[key] = e.target.value; if (o.after) o.after(e.target.value); touch(); }
    });
    el[id] = input;
    return h("label", { class: "fld", for: id }, [h("span", { text: label }), input, o.hint ? h("small", { text: o.hint }) : null]);
  }

  function buildEditor() {
    var d = state.draft;
    var form = h("form", { class: "form", novalidate: true, onsubmit: function (e) { e.preventDefault(); doSave(); } });

    form.appendChild(h("fieldset", {}, [h("legend", { text: "Person and business" }),
      h("div", { class: "grid three" }, [
        field("Title", "prefix", { ph: "Dr.", max: 12 }),
        field("First name", "first"), field("Last name", "last")
      ]),
      h("div", { class: "grid two" }, [field("Business name", "company", { after: function (v) {
        if (state.isNew && !state.slugTouched) { state.draft.slug = T.slugify(v); el["f-slug"].value = state.draft.slug; renderBar(); }
      } }), field("Job title", "title")]),
      field("Short intro", "tagline", { area: true, max: 160, hint: "One or two lines under the name. Keep it under 160 characters." })
    ]));

    form.appendChild(h("fieldset", {}, [h("legend", { text: "Contact" }),
      h("div", { class: "grid two" }, [
        field("Mobile number", "phone", { type: "tel", mode: "tel", ph: "+639171234567", hint: "With country code and no spaces. This is what gets saved to the phone." }),
        field("Number as shown on card", "phoneDisplay", { ph: "+63 917 123 4567" })
      ]),
      h("div", { class: "grid two" }, [field("Email", "email", { type: "email", mode: "email" }), field("Website", "website", { type: "url", ph: "https://" })]),
      field("Address", "address"), field("Footer line", "note", { hint: "For example opening hours." })
    ]));

    var colorCode = h("code", { text: d.accent });
    var colorIn = h("input", { id: "f-accent", type: "color", value: d.accent || "#2a6f5f", oninput: function (e) { state.draft.accent = e.target.value; colorCode.textContent = e.target.value; touch(); } });
    form.appendChild(h("fieldset", {}, [h("legend", { text: "Look" }),
      h("div", { class: "fld" }, [h("span", { text: "Brand color" }), h("div", { class: "colorrow" }, [colorIn, colorCode,
        h("small", { text: "The dark-mode shade and text color are worked out for you." })])]),
      field("Photo or logo link", "photo", { type: "url", ph: "https://", hint: "Optional. Leave empty to show initials." })
    ]));

    el.socials = h("div", { class: "grid" });
    form.appendChild(h("fieldset", {}, [h("legend", { text: "Social links" }), el.socials,
      h("div", {}, [h("button", { class: "btn small", type: "button", text: "+ Add link", onclick: function () {
        state.draft.socials.push({ label: "Facebook", handle: "", url: "" }); renderSocials(); touch();
      } })])
    ]));
    renderSocials();

    /* NFC link */
    el.nfc = h("code", { text: nfcLink(d.slug) });
    form.appendChild(h("fieldset", {}, [h("legend", { text: "NFC tag" }), h("div", { class: "nfc" }, [
      h("span", { class: "mode", text: "Write this link to the client's tag. The tag never needs rewriting when details change." }),
      el.nfc,
      h("div", { class: "actions" }, [
        h("button", { class: "btn small", type: "button", text: "Copy link", onclick: function () { T.copy(nfcLink(state.draft.slug), "NFC link copied"); } }),
        window.TAP_EMBED ? null : h("a", { class: "btn small", id: "openCard", href: "../index.html#" + d.slug, target: "_blank", rel: "noopener", text: "Open live card" })
      ])
    ])]));

    var slugField = field("Card address (slug)", "slug", { readonly: !state.isNew, ph: "villanueva-dental", max: 40,
      hint: state.isNew ? "Lowercase letters, numbers and hyphens. It becomes part of the NFC link, so it cannot change after saving." : "Locked because it is already written on the client's NFC tag.",
      after: function (v) { state.slugTouched = true; state.draft.slug = v.toLowerCase().replace(/[^a-z0-9-]/g, "-"); el.nfc.textContent = nfcLink(state.draft.slug); } });
    form.insertBefore(h("fieldset", {}, [h("legend", { text: "Card address" }), slugField]), form.firstChild);

    el.notice = h("div");
    el.bar = h("div", { class: "savebar" });
    var head = h("div", { class: "editor-head" }, [
      h("h2", { text: state.isNew ? "New client" : (state.draft.company || "Client") }),
      h("div", { class: "top-actions" }, state.isNew ? [] : [
        h("button", { class: "btn small", type: "button", text: "Duplicate", onclick: function () { guard(duplicate); } }),
        h("button", { class: "btn small danger", type: "button", text: "Delete", onclick: function () { state.confirmDelete = true; renderBar(); } })
      ])
    ]);
    return h("section", { class: "editor", "aria-label": "Edit client" }, [head, el.notice, form, el.bar]);
  }

  function renderSocials() {
    el.socials.textContent = "";
    state.draft.socials.forEach(function (s, i) {
      var sel = h("select", { "aria-label": "Platform", value: s.label, onchange: function (e) { s.label = e.target.value; touch(); } },
        PLATFORMS.map(function (p) { return h("option", { value: p, text: p }); }));
      el.socials.appendChild(h("div", { class: "soc" }, [
        sel,
        h("input", { type: "text", placeholder: "@handle or label", "aria-label": "Handle", value: s.handle || "", oninput: function (e) { s.handle = e.target.value; touch(); } }),
        h("input", { type: "url", placeholder: "https://...", "aria-label": "Link", value: s.url || "", oninput: function (e) { s.url = e.target.value; touch(); } }),
        h("button", { class: "btn small", type: "button", text: "Remove", onclick: function () { state.draft.socials.splice(i, 1); renderSocials(); touch(); } })
      ]));
    });
    if (!state.draft.socials.length) el.socials.appendChild(h("p", { class: "empty", text: "No social links yet." }));
  }

  function renderPreview() { if (el.card) T.renderCard(el.card, state.draft); }

  function renderNotice() {
    if (!el.notice) return;
    el.notice.textContent = "";
    if (!state.pending) return;
    el.notice.appendChild(h("div", { class: "notice", role: "alert" }, [
      h("span", { text: "You have unsaved changes." }),
      h("span", { class: "top-actions" }, [
        h("button", { class: "btn small", type: "button", text: "Keep editing", onclick: function () { state.pending = null; renderNotice(); } }),
        h("button", { class: "btn small danger", type: "button", text: "Discard and continue", onclick: function () { var a = state.pending; state.dirty = false; a(); } })
      ])
    ]));
  }

  function renderBar() {
    if (!el.bar) return;
    el.bar.textContent = "";
    if (state.errors.length) el.bar.appendChild(h("ul", { class: "errors", role: "alert" }, state.errors.map(function (m) { return h("li", { text: m }); })));
    if (el.nfc) el.nfc.textContent = nfcLink(state.draft.slug);
    var open = document.getElementById("openCard"); if (open) open.setAttribute("href", "../index.html#" + state.draft.slug);

    if (state.confirmDelete) {
      el.bar.appendChild(h("div", { class: "row-actions" }, [
        h("span", { text: "Delete " + (state.draft.company || "this client") + "? Their NFC card will stop working." }),
        h("button", { class: "btn small danger", type: "button", text: "Yes, delete", onclick: doDelete }),
        h("button", { class: "btn small", type: "button", text: "Cancel", onclick: function () { state.confirmDelete = false; renderBar(); } })
      ]));
      return;
    }
    var status = h("span", { class: "status" + (state.savedAt ? " ok" : ""), role: "status",
      text: state.savedAt ? "Saved at " + state.savedAt : (state.dirty ? "Unsaved changes" : "No changes") });
    el.bar.appendChild(h("div", { class: "row-actions" }, [
      h("button", { class: "btn primary", type: "button", id: "saveBtn", disabled: state.dirty ? null : true, text: state.isNew ? "Create client" : "Save changes", onclick: doSave }),
      state.dirty && !state.isNew ? h("button", { class: "btn", type: "button", text: "Undo changes", onclick: function () { select(state.draft.slug); } }) : null,
      status
    ]));
  }

  /* ---------- actions ---------- */
  function validate() {
    var d = state.draft, e = [];
    if (!(d.first || "").trim() && !(d.last || "").trim()) e.push("Enter a first or last name.");
    if (!(d.company || "").trim()) e.push("Enter the business name.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug) || d.slug.length < 3) e.push("Card address needs 3 or more lowercase letters, numbers or hyphens.");
    if (state.isNew && state.list.some(function (c) { return c.slug === d.slug; })) e.push("That card address is already used by another client.");
    if (d.phone && !/^\+\d{8,15}$/.test(d.phone)) e.push("Mobile number needs a country code and digits only, like +639171234567.");
    if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) e.push("The email address looks incomplete.");
    if (d.website && !/^https?:\/\//.test(d.website)) e.push("Website must start with https://");
    if (d.photo && !/^https?:\/\//.test(d.photo)) e.push("Photo link must start with https://");
    d.socials.forEach(function (s, i) { if (!/^(https?|viber|tg):/.test(s.url || "")) e.push("Social link " + (i + 1) + " (" + s.label + ") needs a full link, like https://facebook.com/yourpage."); });
    return e;
  }

  function doSave() {
    if (!state.dirty) return;
    state.errors = validate();
    if (state.errors.length) { renderBar(); return; }
    var rec = clone(state.draft);
    rec.name = T.displayName(rec);
    if (!rec.phoneDisplay) rec.phoneDisplay = rec.phone;
    var btn = document.getElementById("saveBtn"); if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
    S.save(rec).then(function () {
      var i = state.list.findIndex(function (c) { return c.slug === rec.slug; });
      if (i > -1) state.list[i] = rec; else state.list.push(rec);
      state.list.sort(function (a, b) { return (a.company || "").localeCompare(b.company || ""); });
      state.draft = clone(rec); state.isNew = false; state.dirty = false;
      var now = new Date(); state.savedAt = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      var keep = state.savedAt; build(); state.savedAt = keep; renderBar();
      T.toast("Saved. The live card is updated.");
    }).catch(function (e) {
      if (S.needsLogin && !S.session()) return showLogin("Your session ended. Sign in again, then save once more.");
      state.errors = [/row-level security|42501|403/.test(String(e && e.message)) ? "This login is not an admin yet. In Supabase, run the \"insert into public.admins\" step at the bottom of supabase.sql for your email." : "Could not save: " + String(e && e.message || e).slice(0, 160)]; renderBar();
    });
  }

  function doDelete() {
    var slug = state.draft.slug;
    S.remove(slug).then(function () {
      state.list = state.list.filter(function (c) { return c.slug !== slug; });
      state.dirty = false;
      if (state.list.length) select(state.list[0].slug); else startNew();
      T.toast("Client deleted.");
    }).catch(function (e) { state.errors = ["Could not delete: " + String(e && e.message || e).slice(0, 160)]; state.confirmDelete = false; renderBar(); });
  }

  function duplicate() {
    var c = clone(state.draft);
    c.slug = c.slug + "-copy"; c.company = (c.company || "") + " (copy)";
    startNew(c);
  }

  function toggleTheme() {
    var r = document.documentElement, dark = r.getAttribute("data-theme") === "dark" ||
      (!r.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    r.setAttribute("data-theme", dark ? "light" : "dark");
  }

  window.addEventListener("beforeunload", function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });
})();
