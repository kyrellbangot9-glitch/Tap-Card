/* Data layer. Everything else in the project talks to Tap.store and never knows where records live.
   Two adapters: "demo" (this browser) and "supabase" (your database, plain REST, no SDK needed). */
(function () {
  var T = window.Tap = window.Tap || {};
  var C = window.TAP_CONFIG || {};
  var KEY = "tap.clients.v1";
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };

  /* ---------- demo adapter ---------- */
  var mem = null;
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
  var demo = {
    label: "Demo mode. Records are saved in this browser only.",
    needsLogin: false,
    session: function () { return true; },
    login: function () { return Promise.resolve(); },
    logout: function () { return Promise.resolve(); },
    init: function () {
      try { var raw = localStorage.getItem(KEY); if (raw) mem = JSON.parse(raw); } catch (e) {}
      if (!mem) mem = clone(T.SEED || []);
      return Promise.resolve();
    },
    list: function () { return Promise.resolve(clone(mem)); },
    get: function (slug) {
      var r = mem.filter(function (c) { return c.slug === slug; })[0];
      return Promise.resolve(r ? clone(r) : null);
    },
    save: function (rec) {
      var i = mem.findIndex(function (c) { return c.slug === rec.slug; });
      if (i > -1) mem[i] = clone(rec); else mem.push(clone(rec));
      persist(); return Promise.resolve(clone(rec));
    },
    remove: function (slug) {
      mem = mem.filter(function (c) { return c.slug !== slug; });
      persist(); return Promise.resolve();
    }
  };

  /* ---------- supabase adapter ---------- */
  var SESSION_KEY = "tap.session.v2";
  var sess = null;                       /* { access, refresh } for a signed-in admin, else null */
  function readSess() { try { var r = localStorage.getItem(SESSION_KEY); sess = r ? JSON.parse(r) : null; } catch (e) { sess = null; } }
  function writeSess(s) { sess = s; try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch (e) {} }
  function keepAuth(j) {
    if (!j || !j.access_token) throw new Error("Sign in failed.");
    writeSess({ access: j.access_token, refresh: j.refresh_token });
  }

  function baseHeaders(extra) {
    /* Legacy anon keys are JWTs (start "eyJ") and may be sent as Bearer. Newer publishable keys
       (sb_publishable_...) are not JWTs, so Bearer is only sent once an admin is signed in. */
    var key = C.SUPABASE_ANON_KEY || "";
    var h = { apikey: key, "Content-Type": "application/json" };
    if (sess && sess.access) h.Authorization = "Bearer " + sess.access;
    else if (key.indexOf("eyJ") === 0) h.Authorization = "Bearer " + key;
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  /* One network call with a 12 second limit and clear errors. `build` is a function so that a retry
     after a token refresh picks up the fresh headers. */
  function send(path, build) {
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 12000);
    var opts = build(); opts.signal = ctl.signal;
    return fetch(C.SUPABASE_URL + path, opts).then(function (r) {
      clearTimeout(timer); return r;
    }, function (e) {
      clearTimeout(timer);
      throw new Error(e && e.name === "AbortError"
        ? "No answer from Supabase after 12 seconds. Check SUPABASE_URL and your internet."
        : "Could not reach Supabase. Check SUPABASE_URL in config.js. (" + (e && e.message) + ")");
    });
  }
  function body(r) {
    if (r.ok) return r.status === 204 ? null : r.json().catch(function () { return null; });
    return r.text().then(function (t) { var e = new Error(t || ("Request failed (" + r.status + ")")); e.status = r.status; throw e; });
  }
  function refresh() {
    if (!sess || !sess.refresh) { writeSess(null); return Promise.reject(new Error("Session ended.")); }
    return send("/auth/v1/token?grant_type=refresh_token", function () {
      return { method: "POST", headers: { apikey: C.SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: sess.refresh }) };
    }).then(body).then(keepAuth).catch(function (e) { writeSess(null); throw e; });
  }
  function call(path, build) {
    return send(path, build).then(function (r) {
      if (r.status === 401 && sess) {       /* access token expired: refresh once and retry */
        return refresh().then(function () { return send(path, build); }).then(body);
      }
      return body(r);
    });
  }

  var sb = {
    label: "Connected to your Supabase database.",
    needsLogin: true,
    session: function () { return !!sess; },
    init: function () { readSess(); return Promise.resolve(); },
    login: function (email, password) {
      return send("/auth/v1/token?grant_type=password", function () {
        return { method: "POST", headers: { apikey: C.SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: email, password: password }) };
      }).then(body).then(keepAuth);
    },
    logout: function () { writeSess(null); return Promise.resolve(); },

    /* Public: one card by slug, through the get_card() function. The table itself is closed to visitors. */
    get: function (slug) {
      return call("/rest/v1/rpc/get_card", function () {
        return { method: "POST", headers: baseHeaders(), body: JSON.stringify({ p_slug: slug }) };
      }).then(function (d) { if (!d) return null; d.slug = slug; return d; });
    },
    /* Admin only (row-level security returns nothing to anyone else). */
    list: function () {
      return call("/rest/v1/clients?select=slug,data&order=updated_at.desc", function () { return { headers: baseHeaders() }; })
        .then(function (rows) { return (rows || []).map(function (r) { var d = r.data || {}; d.slug = r.slug; return d; }); });
    },
    save: function (rec) {
      return call("/rest/v1/clients?on_conflict=slug", function () {
        return { method: "POST", headers: baseHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
          body: JSON.stringify([{ slug: rec.slug, data: rec, updated_at: new Date().toISOString() }]) };
      }).then(function () { return rec; });
    },
    remove: function (slug) {
      return call("/rest/v1/clients?slug=eq." + encodeURIComponent(slug), function () { return { method: "DELETE", headers: baseHeaders() }; }).then(function () {});
    }
  };

  T.store = C.MODE === "supabase" ? sb : demo;
})();
