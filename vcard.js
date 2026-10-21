/* Builds the contact file (.vcf) and hands it to the phone. */
(function () {
  var T = window.Tap = window.Tap || {};
  function line(s) { return String(s == null ? "" : s).replace(/[\r\n]+/g, " ").trim(); }   /* a line break would let a value inject new vCard fields */
  function esc(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }

  T.buildVCard = function (c) {
    var L = ["BEGIN:VCARD", "VERSION:3.0"];
    L.push("N:" + esc(c.last) + ";" + esc(c.first) + ";;" + esc(c.prefix) + ";");
    L.push("FN:" + esc(T.displayName(c)));
    if (c.company) L.push("ORG:" + esc(c.company));
    if (c.title) L.push("TITLE:" + esc(c.title));
    if (c.phone) L.push("TEL;TYPE=CELL,VOICE:" + line(c.phone));
    if (c.email) L.push("EMAIL;TYPE=INTERNET,WORK:" + esc(c.email));
    if (c.website) L.push("URL:" + line(c.website));
    if (c.address) L.push("ADR;TYPE=WORK:;;" + esc(c.address) + ";;;;");
    (c.socials || []).forEach(function (s) { L.push("X-SOCIALPROFILE;TYPE=" + line(s.label).toLowerCase().replace(/[^a-z0-9-]/g, "") + ":" + line(s.url)); });
    if (c.note) L.push("NOTE:" + esc(c.note));
    L.push("END:VCARD");
    return L.join("\r\n") + "\r\n";
  };

  /* iPhone Safari opens the Add Contact sheet when it navigates to a .vcf. Other browsers download it
     and Android offers to open it in Contacts. */
  T.saveContact = function (c) {
    var blob = new Blob([T.buildVCard(c)], { type: "text/vcard;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    try {
      if (isIOS) { window.location.href = url; }
      else {
        var a = document.createElement("a");
        a.href = url; a.download = (c.slug || "contact") + ".vcf";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    } catch (e) {}
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  };
})();
