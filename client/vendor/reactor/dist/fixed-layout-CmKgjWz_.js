var G = Object.defineProperty;
var O = (h) => {
  throw TypeError(h);
};
var J = (h, n, t) => n in h ? G(h, n, { enumerable: !0, configurable: !0, writable: !0, value: t }) : h[n] = t;
var F = (h, n, t) => J(h, typeof n != "symbol" ? n + "" : n, t), q = (h, n, t) => n.has(h) || O("Cannot " + t);
var i = (h, n, t) => (q(h, n, "read from private field"), t ? t.call(h) : n.get(h)), w = (h, n, t) => n.has(h) ? O("Cannot add the same private member more than once") : n instanceof WeakSet ? n.add(h) : n.set(h, t), m = (h, n, t, e) => (q(h, n, "write to private field"), e ? e.call(h, t) : n.set(h, t), t), f = (h, n, t) => (q(h, n, "access private method"), t);
const W = (h) => {
  var n, t;
  return (t = (n = h == null ? void 0 : h.split(/[,;\s]/)) == null ? void 0 : n.filter((e) => e)) == null ? void 0 : t.map((e) => e.split("=").map((s) => s.trim()));
}, K = (h, n) => {
  var s, r;
  if (h.documentElement.localName === "svg") {
    const [, , d, a] = ((s = h.documentElement.getAttribute("viewBox")) == null ? void 0 : s.split(/\s/)) ?? [];
    return { width: d, height: a };
  }
  const t = W((r = h.querySelector('meta[name="viewport"]')) == null ? void 0 : r.getAttribute("content"));
  if (t) return Object.fromEntries(t);
  if (typeof n == "string") return W(n);
  if (n != null && n.width && n.height) return n;
  const e = h.querySelector("img");
  return e ? { width: e.naturalWidth, height: e.naturalHeight } : (console.warn(new Error("Missing viewport properties")), { width: 1e3, height: 2e3 });
};
var T, j, y, v, L, x, S, b, k, A, l, I, E, B, D, H, N;
class P extends HTMLElement {
  constructor() {
    super();
    w(this, l);
    w(this, T, this.attachShadow({ mode: "closed" }));
    w(this, j, new ResizeObserver(() => f(this, l, E).call(this)));
    w(this, y);
    w(this, v, -1);
    F(this, "defaultViewport");
    F(this, "spread");
    w(this, L, !1);
    w(this, x);
    w(this, S);
    w(this, b);
    w(this, k);
    w(this, A);
    const t = new CSSStyleSheet();
    i(this, T).adoptedStyleSheets = [t], t.replaceSync(`:host {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: auto;
        }`), i(this, j).observe(this);
  }
  attributeChangedCallback(t, e, s) {
    switch (t) {
      case "zoom":
        m(this, A, s !== "fit-width" && s !== "fit-page" ? parseFloat(s) : s), f(this, l, E).call(this);
        break;
    }
  }
  open(t) {
    this.book = t;
    const { rendition: e } = t;
    this.spread = e == null ? void 0 : e.spread, this.defaultViewport = e == null ? void 0 : e.viewport;
    const s = t.dir === "rtl", r = !s;
    this.rtl = s, (e == null ? void 0 : e.spread) === "none" ? m(this, y, t.sections.map((d) => ({ center: d }))) : m(this, y, t.sections.reduce(
      (d, a, c) => {
        const o = d[d.length - 1], { pageSpread: u } = a, p = () => {
          const g = {};
          return d.push(g), g;
        };
        if (u === "center") {
          const g = o.left || o.right ? p() : o;
          g.center = a;
        } else if (u === "left") {
          const g = o.center || o.left || r && c ? p() : o;
          g.left = a;
        } else if (u === "right") {
          const g = o.center || o.right || s && c ? p() : o;
          g.right = a;
        } else r ? o.center || o.right ? p().left = a : o.left || !c ? o.right = a : o.left = a : o.center || o.left ? p().right = a : o.right || !c ? o.left = a : o.right = a;
        return d;
      },
      [{}]
    ));
  }
  get index() {
    const t = i(this, y)[i(this, v)], e = (t == null ? void 0 : t.center) ?? (i(this, k) === "left" ? t.left ?? t.right : t.right ?? t.left);
    return this.book.sections.indexOf(e);
  }
  getSpreadOf(t) {
    const e = i(this, y);
    for (let s = 0; s < e.length; s++) {
      const { left: r, right: d, center: a } = e[s];
      if (r === t) return { index: s, side: "left" };
      if (d === t) return { index: s, side: "right" };
      if (a === t) return { index: s, side: "center" };
    }
  }
  async goToSpread(t, e, s) {
    var d, a, c, o, u, p;
    if (t < 0 || t > i(this, y).length - 1) return;
    if (t === i(this, v)) {
      f(this, l, E).call(this, e);
      return;
    }
    m(this, v, t);
    const r = i(this, y)[t];
    if (r.center) {
      const g = this.book.sections.indexOf(r.center), C = await ((a = (d = r.center) == null ? void 0 : d.load) == null ? void 0 : a.call(d));
      await f(this, l, B).call(this, { center: { index: g, src: C } });
    } else {
      const g = this.book.sections.indexOf(r.left), C = this.book.sections.indexOf(r.right), z = await ((o = (c = r.left) == null ? void 0 : c.load) == null ? void 0 : o.call(c)), M = await ((p = (u = r.right) == null ? void 0 : u.load) == null ? void 0 : p.call(u)), R = { index: g, src: z }, V = { index: C, src: M };
      await f(this, l, B).call(this, { left: R, right: V, side: e });
    }
    f(this, l, N).call(this, s);
  }
  async select(t) {
    await this.goTo(t);
  }
  async goTo(t) {
    const { book: e } = this, s = await t, r = e.sections[s.index];
    if (!r) return;
    const { index: d, side: a } = this.getSpreadOf(r);
    await this.goToSpread(d, a);
  }
  async next() {
    if (!(this.rtl ? f(this, l, D).call(this) : f(this, l, H).call(this))) return this.goToSpread(i(this, v) + 1, this.rtl ? "right" : "left", "page");
  }
  async prev() {
    if (!(this.rtl ? f(this, l, H).call(this) : f(this, l, D).call(this))) return this.goToSpread(i(this, v) - 1, this.rtl ? "left" : "right", "page");
  }
  getContents() {
    return Array.from(i(this, T).querySelectorAll("iframe"), (t) => ({
      doc: t.contentDocument,
      index: t.dataset.sectionIndex != null ? Number(t.dataset.sectionIndex) : void 0
      // TODO: overlayer
    }));
  }
  destroy() {
    i(this, j).unobserve(this);
  }
}
T = new WeakMap(), j = new WeakMap(), y = new WeakMap(), v = new WeakMap(), L = new WeakMap(), x = new WeakMap(), S = new WeakMap(), b = new WeakMap(), k = new WeakMap(), A = new WeakMap(), l = new WeakSet(), I = async function({ index: t, src: e }) {
  const s = typeof e == "string", r = s ? e : e == null ? void 0 : e.src, d = s ? null : e == null ? void 0 : e.onZoom, a = document.createElement("div");
  a.setAttribute("dir", "ltr");
  const c = document.createElement("iframe");
  return a.append(c), Object.assign(c.style, {
    border: "0",
    display: "none",
    overflow: "hidden"
  }), c.setAttribute("sandbox", "allow-same-origin allow-scripts"), c.setAttribute("scrolling", "no"), c.setAttribute("part", "filter"), typeof t == "number" && t >= 0 && (c.dataset.sectionIndex = String(t)), i(this, T).append(a), r ? new Promise((o) => {
    c.addEventListener(
      "load",
      () => {
        const u = c.contentDocument;
        this.dispatchEvent(new CustomEvent("load", { detail: { doc: u, index: t } }));
        const { width: p, height: g } = K(u, this.defaultViewport);
        o({
          element: a,
          iframe: c,
          width: parseFloat(p),
          height: parseFloat(g),
          onZoom: d
        });
      },
      { once: !0 }
    ), c.src = r;
  }) : { blank: !0, element: a, iframe: c };
}, E = function(t = i(this, k)) {
  if (!t) return;
  const e = i(this, x) ?? {}, s = i(this, b) ?? i(this, S) ?? {}, r = t === "left" ? e : s, { width: d, height: a } = this.getBoundingClientRect(), c = this.spread !== "both" && this.spread !== "portrait" && a > d;
  m(this, L, c);
  const o = e.width ?? s.width ?? 0, u = e.height ?? s.height ?? 0, p = typeof i(this, A) == "number" && !isNaN(i(this, A)) ? i(this, A) : (i(this, A) === "fit-width" ? c || i(this, b) ? d / (r.width ?? o) : d / ((e.width ?? o) + (s.width ?? o)) : c || i(this, b) ? Math.min(d / (r.width ?? o), a / (r.height ?? u)) : Math.min(
    d / ((e.width ?? o) + (s.width ?? o)),
    a / Math.max(e.height ?? u, s.height ?? u)
  )) || 1, g = (C) => {
    let { element: z, iframe: M, width: R, height: V, blank: _, onZoom: $ } = C;
    if (!M) return;
    $ && $({ doc: C.iframe.contentDocument, scale: p });
    const Z = $ ? p : 1;
    Object.assign(M.style, {
      width: `${R * Z}px`,
      height: `${V * Z}px`,
      transform: $ ? "none" : `scale(${p})`,
      transformOrigin: "top left",
      display: _ ? "none" : "block"
    }), Object.assign(z.style, {
      width: `${(R ?? o) * p}px`,
      height: `${(V ?? u) * p}px`,
      overflow: "hidden",
      display: "block",
      flexShrink: "0",
      marginBlock: "auto"
    }), c && C !== r && (z.style.display = "none");
  };
  i(this, b) ? g(i(this, b)) : (g(e), g(s));
}, B = async function({ left: t, right: e, center: s, side: r }) {
  i(this, T).replaceChildren(), m(this, x, null), m(this, S, null), m(this, b, null), s ? (m(this, b, await f(this, l, I).call(this, s)), m(this, k, "center"), f(this, l, E).call(this)) : (m(this, x, await f(this, l, I).call(this, t)), m(this, S, await f(this, l, I).call(this, e)), m(this, k, i(this, x).blank ? "right" : i(this, S).blank ? "left" : r), f(this, l, E).call(this));
}, D = function() {
  var t, e, s, r;
  if (!(i(this, b) || (t = i(this, x)) != null && t.blank) && i(this, L) && ((r = (s = (e = i(this, x)) == null ? void 0 : e.element) == null ? void 0 : s.style) == null ? void 0 : r.display) === "none")
    return m(this, k, "left"), f(this, l, E).call(this), f(this, l, N).call(this, "page"), !0;
}, H = function() {
  var t, e, s, r;
  if (!(i(this, b) || (t = i(this, S)) != null && t.blank) && i(this, L) && ((r = (s = (e = i(this, S)) == null ? void 0 : e.element) == null ? void 0 : s.style) == null ? void 0 : r.display) === "none")
    return m(this, k, "right"), f(this, l, E).call(this), f(this, l, N).call(this, "page"), !0;
}, N = function(t) {
  this.dispatchEvent(new CustomEvent("relocate", { detail: { reason: t, range: null, index: this.index, fraction: 0, size: 1 } }));
}, F(P, "observedAttributes", ["zoom"]);
customElements.define("foliate-fxl", P);
export {
  P as FixedLayout
};
