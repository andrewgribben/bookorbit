var re = Object.defineProperty;
var Jt = (r) => {
  throw TypeError(r);
};
var ie = (r, t, e) => t in r ? re(r, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : r[t] = e;
var bt = (r, t, e) => ie(r, typeof t != "symbol" ? t + "" : t, e), vt = (r, t, e) => t.has(r) || Jt("Cannot " + e);
var o = (r, t, e) => (vt(r, t, "read from private field"), e ? e.call(r) : t.get(r)), L = (r, t, e) => t.has(r) ? Jt("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(r) : t.set(r, e), $ = (r, t, e, s) => (vt(r, t, "write to private field"), s ? s.call(r, e) : t.set(r, e), e), v = (r, t, e) => (vt(r, t, "access private method"), e);
var Kt = (r, t, e, s) => ({
  set _(i) {
    $(r, t, i, e);
  },
  get _() {
    return o(r, t, s);
  }
});
import { f as ne, p as oe, t as Qt, a as ae } from "./index-Ju7JRMGG.js";
const N = {
  CONTAINER: "urn:oasis:names:tc:opendocument:xmlns:container",
  XHTML: "http://www.w3.org/1999/xhtml",
  OPF: "http://www.idpf.org/2007/opf",
  EPUB: "http://www.idpf.org/2007/ops",
  DC: "http://purl.org/dc/elements/1.1/",
  ENC: "http://www.w3.org/2001/04/xmlenc#",
  NCX: "http://www.daisy.org/z3986/2005/ncx/",
  XLINK: "http://www.w3.org/1999/xlink",
  SMIL: "http://www.w3.org/ns/SMIL"
}, x = {
  XML: "application/xml",
  NCX: "application/x-dtbncx+xml",
  XHTML: "application/xhtml+xml",
  HTML: "text/html",
  CSS: "text/css",
  SVG: "image/svg+xml",
  JS: /\/(x-)?(javascript|ecmascript)/
}, q = {
  a11y: "http://www.idpf.org/epub/vocab/package/a11y/#",
  dcterms: "http://purl.org/dc/terms/",
  marc: "http://id.loc.gov/vocabulary/",
  media: "http://www.idpf.org/epub/vocab/overlays/#",
  onix: "http://www.editeur.org/ONIX/book/codelists/current.html#",
  rendition: "http://www.idpf.org/vocab/rendition/#",
  schema: "http://schema.org/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  msv: "http://www.idpf.org/epub/vocab/structure/magazine/#",
  prism: "http://www.prismstandard.org/specifications/3.0/PRISM_CV_Spec_3.0.htm#"
}, ce = {
  art: "artist",
  aut: "author",
  clr: "colorist",
  edt: "editor",
  ill: "illustrator",
  nrt: "narrator",
  trl: "translator",
  pbl: "publisher"
}, le = {
  "02": "isbn",
  "06": "doi",
  15: "isbn",
  26: "doi",
  34: "issn"
}, At = (r) => r.toLowerCase().replace(/[-:](.)/g, (t, e) => e.toUpperCase()), he = (r) => r ? r.replace(/[\t\n\f\r ]+/g, " ").replace(/^[\t\n\f\r ]+/, "").replace(/[\t\n\f\r ]+$/, "") : "", ue = (r, t, e) => e ? (s) => {
  var i, l;
  return (l = (i = s.getAttribute(r)) == null ? void 0 : i.split(/\s/)) == null ? void 0 : l.includes(t);
} : typeof t == "function" ? (s) => t(s.getAttribute(r)) : (s) => s.getAttribute(r) === t, ft = (...r) => (t) => t ? Object.fromEntries(r.map((e) => [At(e), t.getAttribute(e)])) : null, j = (r) => he(r == null ? void 0 : r.textContent), dt = (r, t) => {
  if (!(r != null && r.documentElement))
    return {
      $: () => null,
      $$: () => [],
      $$$: () => []
    };
  const e = r.lookupNamespaceURI(null) === t || r.lookupPrefix(t), s = e ? (i, l) => (c) => c.namespaceURI === t && c.localName === l : (i, l) => (c) => c.localName === l;
  return {
    $: (i, l) => [...i.children].find(s(i, l)),
    $$: (i, l) => [...i.children].filter(s(i, l)),
    $$$: e ? (i, l) => [...i.getElementsByTagNameNS(t, l)] : (i, l) => [...i.getElementsByTagName(l)]
  };
}, X = (r, t) => {
  try {
    if (t.includes(":")) return new URL(r, t);
    const e = "https://invalid.invalid/", s = new URL(r, e + t);
    return s.search = "", decodeURI(s.href.replace(e, ""));
  } catch (e) {
    return console.warn(e), r;
  }
}, mt = (r) => /^(?!blob)\w+:/i.test(r), pe = (r, t) => {
  if (!r) return t;
  const e = r.replace(/\/$/, "").split("/"), s = t.replace(/\/$/, "").split("/"), i = (e.length > s.length ? e : s).findIndex((l, c) => e[c] !== s[c]);
  return i < 0 ? "" : Array(e.length - i).fill("..").concat(s.slice(i)).join("/");
}, de = (r) => r.slice(0, r.lastIndexOf("/") + 1), ot = async (r, t, e) => {
  const s = [];
  r.replace(t, (...l) => (s.push(l), null));
  const i = [];
  for (const l of s) i.push(await e(...l));
  return r.replace(t, () => i.shift());
}, fe = (r) => r.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), It = (r) => {
  for (const [e, s] of Object.entries(r))
    s == null ? delete r[e] : Array.isArray(s) ? (r[e] = s.filter((i) => i).map((i) => typeof i == "object" && !Array.isArray(i) ? It(i) : i), r[e].length ? r[e].length === 1 && (r[e] = r[e][0]) : delete r[e]) : typeof s == "object" && (r[e] = It(s), Object.keys(s).length || delete r[e]);
  const t = Object.keys(r);
  return t.length === 1 && t[0] === "name" ? r[t[0]] : r;
}, me = (r) => {
  const t = new Map(Object.entries(q)), e = r.documentElement.getAttributeNS(N.EPUB, "prefix") || r.documentElement.getAttribute("prefix");
  if (e) for (const [, s, i] of e.matchAll(/(.+): +(.+)[ \t\r\n]*/g)) t.set(s, i);
  return t;
}, Yt = (r, t) => {
  if (!r) return null;
  const [e, s] = r.split(":"), i = s ? e : null, l = s || e, c = t.get(i);
  return c ? c + l : null;
}, ge = (r) => {
  var $t, Ut, Nt, Rt, Tt, Ct, xt, Mt, Bt, Ot, kt, Pt, Dt, Ht, Ft, Xt, jt, qt, _t, zt, Wt, Vt, Gt;
  const { $: t } = dt(r, N.OPF), e = t(r.documentElement, "metadata"), s = Object.groupBy(
    e.children,
    (a) => a.namespaceURI === N.DC ? "dc" : a.namespaceURI === N.OPF && a.localName === "meta" ? a.hasAttribute("name") ? "legacyMeta" : "meta" : ""
  ), i = e.getAttribute("xml:lang") ?? r.documentElement.getAttribute("xml:lang") ?? "und", l = me(r), c = (a) => {
    const g = a.getAttribute("property"), E = a.getAttribute("scheme");
    return {
      property: Yt(g, l) ?? g,
      scheme: Yt(E, l) ?? E,
      lang: a.getAttribute("xml:lang"),
      value: j(a),
      props: u(a),
      // `opf:` attributes from EPUB 2 & EPUB 3.1 (removed in EPUB 3.2)
      attrs: Object.fromEntries(
        Array.from(a.attributes).filter((U) => U.namespaceURI === N.OPF).map((U) => [U.localName, U.value])
      )
    };
  }, h = Map.groupBy(s.meta ?? [], (a) => a.getAttribute("refines")), u = (a) => {
    const g = h.get(a ? "#" + a.getAttribute("id") : null);
    return g ? Object.groupBy(g.map(c), (E) => E.property) : null;
  }, d = Object.fromEntries(Object.entries(Object.groupBy(s.dc, (a) => a.localName)).map(([a, g]) => [a, g.map(c)])), p = u() ?? {}, m = Object.fromEntries((($t = s.legacyMeta) == null ? void 0 : $t.map((a) => [a.getAttribute("name"), a.getAttribute("content")])) ?? []), b = (a) => {
    var g;
    return (g = a == null ? void 0 : a[0]) == null ? void 0 : g.value;
  }, I = (a, g) => {
    var E;
    return b((E = a == null ? void 0 : a.props) == null ? void 0 : E[g]);
  }, w = (a) => {
    var C, nt;
    if (!a) return null;
    const g = ((C = a.props) == null ? void 0 : C["alternate-script"]) ?? [], E = a.attrs["alt-rep"];
    if (!g.length && (!a.lang || a.lang === i) && !E) return a.value;
    const U = { [a.lang ?? i]: a.value };
    E && (U[a.attrs["alt-rep-lang"]] = E);
    for (const tt of g) U[nt = tt.lang] ?? (U[nt] = tt.value);
    return U;
  }, n = (a) => {
    var g, E, U, C, nt;
    return a ? {
      name: w(a),
      sortAs: w((E = (g = a.props) == null ? void 0 : g["file-as"]) == null ? void 0 : E[0]) ?? a.attrs["file-as"],
      role: ((nt = (C = (U = a.props) == null ? void 0 : U.role) == null ? void 0 : C.filter((tt) => tt.scheme === q.marc + "relators")) == null ? void 0 : nt.map((tt) => tt.value)) ?? [a.attrs.role],
      code: I(a, "term") ?? a.attrs.term,
      scheme: I(a, "authority") ?? a.attrs.authority
    } : null;
  }, f = (a) => {
    var g;
    return {
      name: w(a),
      // NOTE: webpub requires number but EPUB allows values like "2.2.1"
      position: b((g = a.props) == null ? void 0 : g["group-position"])
    };
  }, S = (a) => {
    var U;
    const { value: g } = a;
    if (/^urn:/i.test(g)) return g;
    if (/^doi:/i.test(g)) return `urn:${g}`;
    const E = (U = a.props) == null ? void 0 : U["identifier-type"];
    if (!E) {
      const C = a.attrs.scheme;
      return C ? /^(doi|isbn|uuid)$/i.test(C) ? `urn:${C}:${g}` : { scheme: C, value: g } : g;
    }
    if (E.scheme === q.onix + "codelist5") {
      const C = le[E.value];
      if (C) return `urn:${C}:${g}`;
    }
    return g;
  }, M = Object.groupBy(
    p["belongs-to-collection"] ?? [],
    (a) => I(a, "collection-type") === "series" ? "series" : "collection"
  ), A = ((Ut = d.title) == null ? void 0 : Ut.find((a) => I(a, "title-type") === "main")) ?? ((Nt = d.title) == null ? void 0 : Nt[0]), R = {
    identifier: ee(r),
    title: w(A),
    sortAs: w((Tt = (Rt = A == null ? void 0 : A.props) == null ? void 0 : Rt["file-as"]) == null ? void 0 : Tt[0]) ?? ((Ct = A == null ? void 0 : A.attrs) == null ? void 0 : Ct["file-as"]) ?? (m == null ? void 0 : m["calibre:title_sort"]),
    subtitle: (Mt = (xt = d.title) == null ? void 0 : xt.find((a) => I(a, "title-type") === "subtitle")) == null ? void 0 : Mt.value,
    language: (Bt = d.language) == null ? void 0 : Bt.map((a) => a.value),
    description: b(d.description),
    publisher: n((Ot = d.publisher) == null ? void 0 : Ot[0]),
    published: ((Pt = (kt = d.date) == null ? void 0 : kt.find((a) => a.attrs.event === "publication")) == null ? void 0 : Pt.value) ?? b(d.date),
    modified: b(p[q.dcterms + "modified"]) ?? ((Ht = (Dt = d.date) == null ? void 0 : Dt.find((a) => a.attrs.event === "modification")) == null ? void 0 : Ht.value),
    subject: (Ft = d.subject) == null ? void 0 : Ft.map(n),
    belongsTo: {
      collection: (Xt = M.collection) == null ? void 0 : Xt.map(f),
      series: ((jt = M.series) == null ? void 0 : jt.map(f)) ?? (m == null ? void 0 : m["calibre:series"]) ? {
        name: m == null ? void 0 : m["calibre:series"],
        position: parseFloat(m == null ? void 0 : m["calibre:series_index"])
      } : null
    },
    altIdentifier: (qt = d.identifier) == null ? void 0 : qt.map(S),
    source: (_t = d.source) == null ? void 0 : _t.map(S),
    // NOTE: not in webpub schema
    rights: b(d.rights)
    // NOTE: not in webpub schema
  }, G = (a) => (g) => {
    var U;
    const E = new Set((U = g.role) == null ? void 0 : U.map((C) => ce[C] ?? a));
    return [E.size ? E : [a], g];
  };
  for (const [a, g] of [].concat(
    ((Wt = (zt = d.creator) == null ? void 0 : zt.map(n)) == null ? void 0 : Wt.map(G("author"))) ?? [],
    ((Gt = (Vt = d.contributor) == null ? void 0 : Vt.map(n)) == null ? void 0 : Gt.map(G("contributor"))) ?? []
  ))
    for (const E of a)
      R[E] ? R[E].push(g) : R[E] = [g];
  It(R), R.altIdentifier === R.identifier && delete R.altIdentifier;
  const rt = {}, it = {};
  for (const [a, g] of Object.entries(p))
    a.startsWith(q.rendition) ? rt[At(a.replace(q.rendition, ""))] = b(g) : a.startsWith(q.media) && (it[At(a.replace(q.media, ""))] = b(g));
  return it.duration && (it.duration = St(it.duration)), { metadata: R, rendition: rt, media: it };
}, ye = (r, t = (e) => e) => {
  var w;
  const { $: e, $$: s, $$$: i } = dt(r, N.XHTML), l = (n) => n ? decodeURI(t(n)) : null, c = (n) => (f) => {
    var rt;
    const S = e(f, "a") ?? e(f, "span"), M = e(f, "ol"), A = l(S == null ? void 0 : S.getAttribute("href")), G = { label: j(S) || (S == null ? void 0 : S.getAttribute("title")), href: A, subitems: h(M) };
    return n && (G.type = (rt = S == null ? void 0 : S.getAttributeNS(N.EPUB, "type")) == null ? void 0 : rt.split(/\s/)), G;
  }, h = (n, f) => n ? s(n, "li").map(c(f)) : null, u = (n, f) => h(e(n, "ol"), f), d = i(r, "nav");
  let p = null, m = null, b = null, I = [];
  for (const n of d) {
    const f = ((w = n.getAttributeNS(N.EPUB, "type")) == null ? void 0 : w.split(/\s/)) ?? [];
    f.includes("toc") ? p ?? (p = u(n)) : f.includes("page-list") ? m ?? (m = u(n)) : f.includes("landmarks") ? b ?? (b = u(n, !0)) : I.push({
      label: j(n.firstElementChild),
      type: f,
      list: u(n)
    });
  }
  return { toc: p, pageList: m, landmarks: b, others: I };
}, we = (r, t = (e) => e) => {
  if (!(r != null && r.documentElement)) return { toc: null, pageList: null, others: [] };
  const { $: e, $$: s } = dt(r, N.NCX), i = (u) => u ? decodeURI(t(u)) : null, l = (u) => {
    const d = e(u, "navLabel"), p = e(u, "content"), m = j(d), b = i(p.getAttribute("src"));
    if (u.localName === "navPoint") {
      const I = s(u, "navPoint");
      return { label: m, href: b, subitems: I.length ? I.map(l) : null };
    }
    return { label: m, href: b };
  }, c = (u, d) => s(u, d).map(l), h = (u, d) => {
    const p = e(r.documentElement, u);
    return p ? c(p, d) : null;
  };
  return {
    toc: h("navMap", "navPoint"),
    pageList: h("pageList", "pageTarget"),
    others: s(r.documentElement, "navList").map((u) => ({
      label: j(e(u, "navLabel")),
      list: c(u, "navTarget")
    }))
  };
}, St = (r) => {
  if (!r) return;
  const t = r.split(":").map((c) => parseFloat(c));
  if (t.length === 3) {
    const [c, h, u] = t;
    return c * 60 * 60 + h * 60 + u;
  }
  if (t.length === 2) {
    const [c, h] = t;
    return c * 60 + h;
  }
  const [e, s] = r.split(/(?=[^\d.])/), i = parseFloat(e), l = s === "h" ? 60 * 60 : s === "min" ? 60 : s === "ms" ? 1e-3 : 1;
  return i * l;
};
var _, at, Y, O, B, T, ct, lt, z, y, te, gt, J, K, yt, wt, Q, Et;
class be extends EventTarget {
  constructor(e, s) {
    super();
    L(this, y);
    L(this, _);
    L(this, at);
    L(this, Y);
    L(this, O);
    L(this, B);
    L(this, T);
    L(this, ct, 1);
    L(this, lt, 1);
    L(this, z);
    this.book = e, this.loadXML = s;
  }
  async start(e, s = () => !0) {
    var h;
    (h = o(this, T)) == null || h.pause();
    const i = this.book.sections[e], l = i == null ? void 0 : i.id;
    if (!l) return;
    const { mediaOverlay: c } = i;
    if (!c) return this.start(e + 1);
    $(this, Y, e), await v(this, y, te).call(this, c);
    for (let u = 0; u < o(this, _).length; u++) {
      const { items: d } = o(this, _)[u];
      for (let p = 0; p < d.length; p++)
        if (d[p].text.split("#")[0] === l && s(d[p], p, d)) return v(this, y, Q).call(this, u, p).catch((m) => v(this, y, K).call(this, m));
    }
  }
  pause() {
    var e;
    $(this, z, "paused"), (e = o(this, T)) == null || e.pause();
  }
  resume() {
    var e;
    $(this, z, "playing"), (e = o(this, T)) == null || e.play().catch((s) => v(this, y, K).call(this, s));
  }
  stop() {
    $(this, z, "stopped"), v(this, y, Et).call(this);
  }
  prev() {
    o(this, B) > 0 ? v(this, y, Q).call(this, o(this, O), o(this, B) - 1) : o(this, O) > 0 ? v(this, y, Q).call(this, o(this, O) - 1, o(this, _)[o(this, O) - 1].items.length - 1) : o(this, Y) > 0 && this.start(o(this, Y) - 1, (e, s, i) => s === i.length - 1);
  }
  next() {
    v(this, y, Q).call(this, o(this, O), o(this, B) + 1);
  }
  setVolume(e) {
    $(this, ct, e), o(this, T) && (o(this, T).volume = e);
  }
  setRate(e) {
    $(this, lt, e), o(this, T) && (o(this, T).playbackRate = e);
  }
}
_ = new WeakMap(), at = new WeakMap(), Y = new WeakMap(), O = new WeakMap(), B = new WeakMap(), T = new WeakMap(), ct = new WeakMap(), lt = new WeakMap(), z = new WeakMap(), y = new WeakSet(), te = async function(e) {
  if (o(this, at) === e) return;
  const s = await this.loadXML(e.href), i = (h) => h ? X(h, e.href) : null, { $: l, $$$: c } = dt(s, N.SMIL);
  $(this, O, -1), $(this, B, -1), $(this, _, c(s, "par").reduce((h, u) => {
    var n;
    const d = i((n = l(u, "text")) == null ? void 0 : n.getAttribute("src")), p = l(u, "audio");
    if (!d || !p) return h;
    const m = i(p.getAttribute("src")), b = St(p.getAttribute("clipBegin")), I = St(p.getAttribute("clipEnd")), w = h.at(-1);
    return (w == null ? void 0 : w.src) === m ? w.items.push({ text: d, begin: b, end: I }) : h.push({ src: m, items: [{ text: d, begin: b, end: I }] }), h;
  }, [])), $(this, at, e);
}, gt = function() {
  return o(this, _)[o(this, O)];
}, J = function() {
  var e, s;
  return (s = (e = o(this, y, gt)) == null ? void 0 : e.items) == null ? void 0 : s[o(this, B)];
}, K = function(e) {
  console.error(e), this.dispatchEvent(new CustomEvent("error", { detail: e }));
}, yt = function() {
  this.dispatchEvent(new CustomEvent("highlight", { detail: o(this, y, J) }));
}, wt = function() {
  this.dispatchEvent(new CustomEvent("unhighlight", { detail: o(this, y, J) }));
}, Q = async function(e, s) {
  var h;
  v(this, y, Et).call(this), $(this, O, e), $(this, B, s);
  const i = (h = o(this, y, gt)) == null ? void 0 : h.src;
  if (!i || !o(this, y, J)) return this.start(o(this, Y) + 1);
  const l = URL.createObjectURL(await this.book.loadBlob(i)), c = new Audio(l);
  $(this, T, c), c.volume = o(this, ct), c.playbackRate = o(this, lt), c.addEventListener("timeupdate", () => {
    var m, b;
    if (c.paused) return;
    const u = c.currentTime, { items: d } = o(this, y, gt);
    if (u > ((m = o(this, y, J)) == null ? void 0 : m.end) && (v(this, y, wt).call(this), o(this, B) === d.length - 1)) {
      v(this, y, Q).call(this, o(this, O) + 1, 0).catch((I) => v(this, y, K).call(this, I));
      return;
    }
    const p = o(this, B);
    for (; ((b = d[o(this, B) + 1]) == null ? void 0 : b.begin) <= u; ) Kt(this, B)._++;
    o(this, B) !== p && v(this, y, yt).call(this);
  }), c.addEventListener("error", () => v(this, y, K).call(this, new Error(`Failed to load ${i}`))), c.addEventListener("playing", () => v(this, y, yt).call(this)), c.addEventListener("ended", () => {
    v(this, y, wt).call(this), URL.revokeObjectURL(l), $(this, T, null), v(this, y, Q).call(this, e + 1, 0).catch((u) => v(this, y, K).call(this, u));
  }), o(this, z) === "paused" ? (v(this, y, yt).call(this), c.currentTime = o(this, y, J).begin ?? 0) : c.addEventListener(
    "canplaythrough",
    () => {
      c.currentTime = o(this, y, J).begin ?? 0, $(this, z, "playing"), c.play().catch((u) => v(this, y, K).call(this, u));
    },
    { once: !0 }
  );
}, Et = function() {
  o(this, T) && (o(this, T).pause(), URL.revokeObjectURL(o(this, T).src), $(this, T, null), v(this, y, wt).call(this));
};
const ve = /([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})/, Ae = (r) => {
  for (const t of r.getElementsByTagNameNS(N.DC, "identifier")) {
    const [e] = j(t).split(":").slice(-1);
    if (ve.test(e)) return e;
  }
  return "";
}, ee = (r) => j(r.getElementById(r.documentElement.getAttribute("unique-identifier")) ?? r.getElementsByTagNameNS(N.DC, "identifier")[0]), Zt = async (r, t, e) => {
  const s = new Uint8Array(await e.slice(0, t).arrayBuffer());
  t = Math.min(t, s.length);
  for (var i = 0; i < t; i++) s[i] = s[i] ^ r[i % r.length];
  return new Blob([s, e.slice(t)], { type: e.type });
}, Ie = async (r) => {
  const t = new TextEncoder().encode(r), e = await globalThis.crypto.subtle.digest("SHA-1", t);
  return new Uint8Array(e);
}, Se = (r = Ie) => ({
  "http://www.idpf.org/2008/embedding": {
    key: (t) => r(
      ee(t).replaceAll(/[\u0020\u0009\u000d\u000a]/g, "")
    ),
    decode: (t, e) => Zt(t, 1040, e)
  },
  "http://ns.adobe.com/pdf/enc#RC": {
    key: (t) => {
      const e = Ae(t).replaceAll("-", "");
      return Uint8Array.from({ length: 16 }, (s, i) => parseInt(e.slice(i * 2, i * 2 + 2), 16));
    },
    decode: (t, e) => Zt(t, 1024, e)
  }
});
var ht, et, ut;
class Ee {
  constructor(t) {
    L(this, ht, /* @__PURE__ */ new Map());
    L(this, et, /* @__PURE__ */ new Map());
    L(this, ut);
    $(this, ut, t);
  }
  async init(t, e) {
    if (!t) return;
    const s = Array.from(t.getElementsByTagNameNS(N.ENC, "EncryptedData"), (i) => {
      var l, c;
      return {
        algorithm: (l = i.getElementsByTagNameNS(N.ENC, "EncryptionMethod")[0]) == null ? void 0 : l.getAttribute("Algorithm"),
        uri: (c = i.getElementsByTagNameNS(N.ENC, "CipherReference")[0]) == null ? void 0 : c.getAttribute("URI")
      };
    });
    for (const { algorithm: i, uri: l } of s) {
      if (!o(this, et).has(i)) {
        const c = o(this, ut)[i];
        if (!c) {
          console.warn("Unknown encryption algorithm");
          continue;
        }
        const h = await c.key(e);
        o(this, et).set(i, (u) => c.decode(h, u));
      }
      o(this, ht).set(l, i);
    }
  }
  getDecoder(t) {
    return o(this, et).get(o(this, ht).get(t)) ?? ((e) => e);
  }
}
ht = new WeakMap(), et = new WeakMap(), ut = new WeakMap();
class Le {
  constructor({ opf: t, resolveHref: e }) {
    var p, m, b, I, w;
    this.opf = t;
    const { $: s, $$: i, $$$: l } = dt(t, N.OPF), c = s(t.documentElement, "manifest"), h = s(t.documentElement, "spine"), u = i(h, "itemref");
    this.manifest = i(c, "item").map(ft("href", "id", "media-type", "properties", "media-overlay")).map((n) => {
      var f;
      return n.href = e(n.href), n.properties = (f = n.properties) == null ? void 0 : f.split(/\s/), n;
    }), this.manifestById = new Map(this.manifest.map((n) => [n.id, n])), this.spine = u.map(ft("idref", "id", "linear", "properties")).map((n) => {
      var f;
      return n.properties = (f = n.properties) == null ? void 0 : f.split(/\s/), n;
    }), this.pageProgressionDirection = h.getAttribute("page-progression-direction"), this.navPath = (p = this.getItemByProperty("nav")) == null ? void 0 : p.href, this.ncxPath = (m = this.getItemByID(h.getAttribute("toc")) ?? this.manifest.find((n) => n.mediaType === x.NCX)) == null ? void 0 : m.href;
    const d = s(t.documentElement, "guide");
    d && (this.guide = i(d, "reference").map(ft("type", "title", "href")).map(({ type: n, title: f, href: S }) => ({
      label: f,
      type: n.split(/\s/),
      href: e(S)
    }))), this.cover = this.getItemByProperty("cover-image") ?? // EPUB 2 compat
    this.getItemByID((b = l(t, "meta").find(ue("name", "cover"))) == null ? void 0 : b.getAttribute("content")) ?? this.getItemByHref((w = (I = this.guide) == null ? void 0 : I.find((n) => n.type.includes("cover"))) == null ? void 0 : w.href), this.cfis = ne(u);
  }
  getItemByID(t) {
    return this.manifestById.get(t);
  }
  getItemByHref(t) {
    return this.manifest.find((e) => e.href === t);
  }
  getItemByProperty(t) {
    return this.manifest.find((e) => {
      var s;
      return (s = e.properties) == null ? void 0 : s.includes(t);
    });
  }
  resolveCFI(t) {
    const e = oe(t), s = (e.parent ?? e).shift();
    let i = Qt(this.opf, s);
    i && i.nodeName !== "idref" && (s.at(-1).id = null, i = Qt(this.opf, s));
    const l = i == null ? void 0 : i.getAttribute("idref");
    return { index: this.spine.findIndex((u) => u.idref === l), anchor: (u) => ae(u, e) };
  }
}
var H, F, P, W, Z, Lt, se;
class $e {
  constructor({ loadText: t, loadBlob: e, resources: s, getDirectUrl: i }) {
    L(this, Z);
    L(this, H, /* @__PURE__ */ new Map());
    L(this, F, /* @__PURE__ */ new Map());
    L(this, P, /* @__PURE__ */ new Map());
    L(this, W, null);
    // Function to get direct streaming URLs for lazy loading
    bt(this, "eventTarget", new EventTarget());
    this.loadText = t, this.loadBlob = e, this.manifest = s.manifest, this.assets = s.manifest, $(this, W, i ?? null);
  }
  async createURL(t, e, s, i) {
    if (!e) return "";
    const l = { data: e, type: s };
    Object.defineProperty(l, "name", { value: t });
    const c = new CustomEvent("data", { detail: l });
    this.eventTarget.dispatchEvent(c);
    const h = await c.detail.data, u = await c.detail.type, d = URL.createObjectURL(new Blob([h], { type: u }));
    if (o(this, H).set(t, d), o(this, P).set(t, 1), i) {
      const p = o(this, F).get(i);
      p ? p.push(t) : o(this, F).set(i, [t]);
    }
    return d;
  }
  ref(t, e) {
    const s = o(this, F).get(e);
    return s != null && s.includes(t) || (o(this, P).set(t, o(this, P).get(t) + 1), s ? s.push(t) : o(this, F).set(e, [t])), o(this, H).get(t);
  }
  unref(t) {
    if (!o(this, P).has(t)) return;
    const e = o(this, P).get(t) - 1;
    if (e < 1) {
      URL.revokeObjectURL(o(this, H).get(t)), o(this, H).delete(t), o(this, P).delete(t);
      const s = o(this, F).get(t);
      if (s) for (; s.length; ) this.unref(s.pop());
      o(this, F).delete(t);
    } else o(this, P).set(t, e);
  }
  // load manifest item, recursively loading all resources as needed
  async loadItem(t, e = []) {
    if (!t) return null;
    const { href: s, mediaType: i } = t, l = x.JS.test(t.mediaType), c = { type: i, isScript: l, allow: !0 }, h = new CustomEvent("load", { detail: c });
    if (this.eventTarget.dispatchEvent(h), !await h.detail.allow) return null;
    const d = e.at(-1);
    if (o(this, H).has(s)) return this.ref(s, d);
    if ((l || [x.XHTML, x.HTML, x.CSS, x.SVG].includes(i)) && // prevent circular references
    e.every((b) => b !== s)) return this.loadReplaced(t, e);
    const m = Promise.resolve().then(() => this.loadBlob(s));
    return this.createURL(s, m, i, d);
  }
  async loadHref(t, e, s = []) {
    if (mt(t)) return t;
    const i = X(t, e), l = this.manifest.find((c) => c.href === i);
    return l ? this.loadItem(l, s.concat(e)) : t;
  }
  async loadReplaced(t, e = []) {
    var u, d;
    const { href: s, mediaType: i } = t, l = e.at(-1);
    let c = "";
    try {
      c = await this.loadText(s);
    } catch (p) {
      return this.createURL(s, Promise.reject(p), i, l);
    }
    if (!c) return null;
    if ([x.XHTML, x.HTML, x.SVG].includes(i)) {
      let p = new DOMParser().parseFromString(c, i);
      if (i === x.XHTML && (p.querySelector("parsererror") || !((u = p.documentElement) != null && u.namespaceURI)) && (console.warn(((d = p.querySelector("parsererror")) == null ? void 0 : d.innerText) ?? "Invalid XHTML"), t.mediaType = x.HTML, p = new DOMParser().parseFromString(c, t.mediaType)), [x.XHTML, x.SVG].includes(t.mediaType)) {
        let n = p.firstChild;
        for (; n instanceof ProcessingInstruction; ) {
          if (n.data) {
            const f = await ot(
              n.data,
              /(?:^|\s*)(href\s*=\s*['"])([^'"]*)(['"])/i,
              (S, M, A, R) => this.loadHref(A, s, e).then((G) => `${M}${G}${R}`)
            );
            n.replaceWith(p.createProcessingInstruction(n.target, f));
          }
          n = n.nextSibling;
        }
      }
      const m = async (n, f) => n.setAttribute(f, await this.loadHref(n.getAttribute(f), s, e)), b = (n, f) => {
        if (!o(this, W)) return !1;
        const S = n.getAttribute(f);
        if (!S || mt(S)) return !1;
        const M = X(S, s), A = this.manifest.find((R) => R.href === M);
        return A && v(this, Z, Lt).call(this, A.mediaType);
      }, I = (n, f) => {
        const S = n.getAttribute(f), M = X(S, s), A = o(this, W).call(this, M);
        return A ? (n.setAttribute(f, A), !0) : !1;
      };
      for (const n of p.querySelectorAll("link[href]")) await m(n, "href");
      for (const n of p.querySelectorAll("[src]"))
        b(n, "src") ? I(n, "src") : await m(n, "src");
      for (const n of p.querySelectorAll("[poster]"))
        b(n, "poster") ? I(n, "poster") : await m(n, "poster");
      for (const n of p.querySelectorAll("object[data]")) await m(n, "data");
      for (const n of p.querySelectorAll("[*|href]:not([href])"))
        n.setAttributeNS(N.XLINK, "href", await this.loadHref(n.getAttributeNS(N.XLINK, "href"), s, e));
      for (const n of p.querySelectorAll("[srcset]"))
        n.setAttribute(
          "srcset",
          await ot(
            n.getAttribute("srcset"),
            /(\s*)(.+?)\s*((?:\s[\d.]+[wx])+\s*(?:,|$)|,\s+|$)/g,
            (f, S, M, A) => this.loadHref(M, s, e).then((R) => `${S}${R}${A}`)
          )
        );
      for (const n of p.querySelectorAll("style")) n.textContent && (n.textContent = await this.replaceCSS(n.textContent, s, e));
      for (const n of p.querySelectorAll("[style]")) n.setAttribute("style", await this.replaceCSS(n.getAttribute("style"), s, e));
      const w = new XMLSerializer().serializeToString(p);
      return this.createURL(s, w, t.mediaType, l);
    }
    const h = i === x.CSS ? await this.replaceCSS(c, s, e) : await this.replaceString(c, s, e);
    return this.createURL(s, h, i, l);
  }
  async replaceCSS(t, e, s = []) {
    const i = await ot(t, /url\(\s*["']?([^'"\n]*?)\s*["']?\s*\)/gi, async (c, h) => {
      if (mt(h)) return `url("${h}")`;
      const u = X(h, e), d = this.manifest.find((m) => m.href === u);
      if (o(this, W) && d && (v(this, Z, se).call(this, d.mediaType) || v(this, Z, Lt).call(this, d.mediaType))) {
        const m = o(this, W).call(this, u);
        if (m) return `url("${m}")`;
      }
      return `url("${await this.loadHref(h, e, s)}")`;
    });
    return (await ot(
      i,
      /@import\s*["']([^"'\n]*?)["']/gi,
      (c, h) => this.loadHref(h, e, s).then((u) => `@import "${u}"`)
    )).replace(/@font-face\s*\{([^}]*)\}/gi, (c, h) => /font-display\s*:/i.test(h) ? c : `@font-face {${h}font-display: swap;}`);
  }
  // find & replace all possible relative paths for all assets without parsing
  replaceString(t, e, s = []) {
    const i = /* @__PURE__ */ new Map(), l = this.assets.map((h) => {
      if (h.href === e) return;
      const u = pe(de(e), h.href), d = encodeURI(u), p = "/" + h.href, m = encodeURI(p), b = /* @__PURE__ */ new Set([u, d, p, m]);
      for (const I of b) i.set(I, h);
      return Array.from(b);
    }).flat().filter((h) => h);
    if (!l.length) return t;
    const c = new RegExp(l.map(fe).join("|"), "g");
    return ot(t, c, async (h) => this.loadItem(i.get(h.replace(/^\//, "")), s.concat(e)));
  }
  unloadItem(t) {
    this.unref(t == null ? void 0 : t.href);
  }
  destroy() {
    for (const t of o(this, H).values()) URL.revokeObjectURL(t);
  }
}
H = new WeakMap(), F = new WeakMap(), P = new WeakMap(), W = new WeakMap(), Z = new WeakSet(), // Check if a media type is an image
Lt = function(t) {
  return (t == null ? void 0 : t.startsWith("image/")) ?? !1;
}, // Check if a media type is a font
se = function(t) {
  return (t == null ? void 0 : t.includes("font")) || t === "application/vnd.ms-opentype" || t === "application/x-font-ttf" || t === "application/x-font-otf" || t === "application/x-font-woff" || t === "font/otf" || t === "font/ttf" || t === "font/woff" || t === "font/woff2";
};
const Ue = (r, t) => r.getElementById(t) ?? r.querySelector(`[name="${CSS.escape(t)}"]`), Ne = (r) => {
  for (const t of r) {
    if (t === "page-spread-left" || t === "rendition:page-spread-left") return "left";
    if (t === "page-spread-right" || t === "rendition:page-spread-right") return "right";
    if (t === "rendition:page-spread-center") return "center";
  }
}, Re = (r) => r ? {
  fixedLayout: j(r.querySelector('option[name="fixed-layout"]')),
  openToSpread: j(r.querySelector('option[name="open-to-spread"]'))
} : null;
var V, st, pt, k, D;
class xe {
  constructor({ loadText: t, loadBlob: e, getSize: s, getDirectUrl: i, sha1: l }) {
    L(this, k);
    bt(this, "parser", new DOMParser());
    L(this, V);
    L(this, st);
    L(this, pt, null);
    this.loadText = t, this.loadBlob = e, this.getSize = s, $(this, pt, i ?? null), $(this, st, new Ee(Se(l)));
  }
  async init() {
    var b, I;
    const t = await v(this, k, D).call(this, "META-INF/container.xml");
    if (!t) throw new Error("Failed to load container file");
    const e = Array.from(t.getElementsByTagNameNS(N.CONTAINER, "rootfile"), ft("full-path", "media-type")).filter(
      (w) => w.mediaType === "application/oebps-package+xml"
    );
    if (!e.length) throw new Error("No package document defined in container");
    const s = e[0].fullPath, i = await v(this, k, D).call(this, s);
    if (!i) throw new Error("Failed to load package document");
    const l = await v(this, k, D).call(this, "META-INF/encryption.xml");
    await o(this, st).init(l, i), this.resources = new Le({
      opf: i,
      resolveHref: (w) => X(w, s)
    }), $(this, V, new $e({
      loadText: this.loadText,
      loadBlob: (w) => Promise.resolve(this.loadBlob(w)).then(o(this, st).getDecoder(w)),
      resources: this.resources,
      getDirectUrl: o(this, pt)
    })), this.transformTarget = o(this, V).eventTarget, this.sections = this.resources.spine.map((w, n) => {
      const { idref: f, linear: S, properties: M = [] } = w, A = this.resources.getItemByID(f);
      return A ? {
        id: A.href,
        load: () => o(this, V).loadItem(A),
        unload: () => o(this, V).unloadItem(A),
        createDocument: () => this.loadDocument(A),
        size: this.getSize(A.href),
        cfi: this.resources.cfis[n],
        linear: S,
        pageSpread: Ne(M),
        resolveHref: (R) => X(R, A.href),
        mediaOverlay: A.mediaOverlay ? this.resources.getItemByID(A.mediaOverlay) : null
      } : (console.warn(`Could not find item with ID "${f}" in manifest`), null);
    }).filter((w) => w);
    const { navPath: c, ncxPath: h } = this.resources;
    if (c)
      try {
        const w = (f) => X(f, c), n = await v(this, k, D).call(this, c);
        if (n) {
          const f = ye(n, w);
          this.toc = f.toc, this.pageList = f.pageList, this.landmarks = f.landmarks;
        }
      } catch (w) {
        console.warn(w);
      }
    if (!this.toc && h)
      try {
        const w = (f) => X(f, h), n = await v(this, k, D).call(this, h);
        if (n) {
          const f = we(n, w);
          this.toc = f.toc, this.pageList = f.pageList;
        }
      } catch (w) {
        console.warn(w);
      }
    this.landmarks ?? (this.landmarks = this.resources.guide);
    const { metadata: u, rendition: d, media: p } = ge(i);
    this.metadata = u, this.rendition = d, this.media = p, this.dir = this.resources.pageProgressionDirection;
    const m = Re(
      await v(this, k, D).call(this, "META-INF/com.apple.ibooks.display-options.xml") ?? await v(this, k, D).call(this, "META-INF/com.kobobooks.display-options.xml")
    );
    return m && (m.fixedLayout === "true" && ((b = this.rendition).layout ?? (b.layout = "pre-paginated")), m.openToSpread === "false" && ((I = this.sections.find((w) => w.linear !== "no")).pageSpread ?? (I.pageSpread = this.dir === "rtl" ? "left" : "right"))), this;
  }
  async loadDocument(t) {
    const e = await this.loadText(t.href);
    if (!e) throw new Error(`Failed to load section document: ${t.href}`);
    return this.parser.parseFromString(e, t.mediaType);
  }
  getMediaOverlay() {
    return new be(this, v(this, k, D).bind(this));
  }
  resolveCFI(t) {
    return this.resources.resolveCFI(t);
  }
  resolveHref(t) {
    const [e, s] = t.split("#"), i = this.resources.getItemByHref(decodeURI(e));
    return i ? { index: this.resources.spine.findIndex(({ idref: h }) => h === i.id), anchor: s ? (h) => Ue(h, s) : () => 0 } : null;
  }
  splitTOCHref(t) {
    return (t == null ? void 0 : t.split("#")) ?? [];
  }
  getTOCFragment(t, e) {
    return t.getElementById(e) ?? t.querySelector(`[name="${CSS.escape(e)}"]`);
  }
  isExternal(t) {
    return mt(t);
  }
  async getCover() {
    var e;
    const t = (e = this.resources) == null ? void 0 : e.cover;
    return t != null && t.href ? new Blob([await this.loadBlob(t.href)], { type: t.mediaType }) : null;
  }
  async getCalibreBookmarks() {
    const t = await this.loadText("META-INF/calibre_bookmarks.txt"), e = "encoding=json+base64:";
    if (t != null && t.startsWith(e)) {
      const s = atob(t.slice(e.length));
      return JSON.parse(s);
    }
  }
  destroy() {
    var t;
    (t = o(this, V)) == null || t.destroy();
  }
}
V = new WeakMap(), st = new WeakMap(), pt = new WeakMap(), k = new WeakSet(), D = async function(t) {
  const e = await this.loadText(t);
  if (!e) return null;
  const s = this.parser.parseFromString(e, x.XML);
  if (s.querySelector("parsererror"))
    throw new Error(`XML parsing error: ${t}
${s.querySelector("parsererror").innerText}`);
  return s;
};
export {
  xe as EPUB
};
