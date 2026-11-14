var Gt = Object.defineProperty;
var At = (o) => {
  throw TypeError(o);
};
var Kt = (o, n, t) => n in o ? Gt(o, n, { enumerable: !0, configurable: !0, writable: !0, value: t }) : o[n] = t;
var Pt = (o, n, t) => Kt(o, typeof n != "symbol" ? n + "" : n, t), yt = (o, n, t) => n.has(o) || At("Cannot " + t);
var e = (o, n, t) => (yt(o, n, "read from private field"), t ? t.call(o) : n.get(o)), g = (o, n, t) => n.has(o) ? At("Cannot add the same private member more than once") : n instanceof WeakSet ? n.add(o) : n.set(o, t), m = (o, n, t, i) => (yt(o, n, "write to private field"), i ? i.call(o, t) : n.set(o, t), t), d = (o, n, t) => (yt(o, n, "access private method"), t);
const Yt = (o) => new Promise((n) => setTimeout(n, o)), Lt = (o, n, t) => {
  let i;
  return (...s) => {
    const r = () => {
      i = null, o(...s);
    };
    i && clearTimeout(i), i = setTimeout(r, n);
  };
}, xt = (o, n, t) => t * (n - o) + o, Jt = (o) => 1 - (1 - o) * (1 - o), Ut = (o, n, t, i, s) => new Promise((r) => {
  let l;
  const h = (c) => {
    if (document.hidden)
      return s(xt(o, n, 1)), r();
    l ?? (l = c);
    const u = Math.min(1, (c - l) / t);
    s(xt(o, n, i(u))), u < 1 ? requestAnimationFrame(h) : r();
  };
  if (document.hidden)
    return s(xt(o, n, 1)), r();
  requestAnimationFrame(h);
}), Zt = (o) => {
  if (!(o != null && o.collapsed)) return o;
  const { endOffset: n, endContainer: t } = o;
  if (t.nodeType === 1) {
    const i = t.childNodes[n];
    return (i == null ? void 0 : i.nodeType) === 1 ? i : t;
  }
  if (n + 1 < t.length) o.setEnd(t, n + 1);
  else if (n > 1) o.setStart(t, n - 1);
  else return t.parentNode;
  return o;
}, dt = (o, n, t, i = t) => {
  const s = o.createRange();
  return s.setStart(n, t), s.setEnd(n, i), s;
}, pt = (o, n, t, i = 0, s = n.nodeValue.length) => {
  if (s - i === 1)
    return t(dt(o, n, i), dt(o, n, s)) < 0 ? i : s;
  const r = Math.floor(i + (s - i) / 2), l = t(dt(o, n, i, r), dt(o, n, r, s));
  return l < 0 ? pt(o, n, t, i, r) : l > 0 ? pt(o, n, t, r, s) : r;
}, { SHOW_ELEMENT: te, SHOW_TEXT: ee, SHOW_CDATA_SECTION: ie, FILTER_ACCEPT: It, FILTER_REJECT: Vt, FILTER_SKIP: Bt } = NodeFilter, se = te | ee | ie, ut = (o) => {
  let n = 1 / 0, t = -1 / 0, i = 1 / 0, s = -1 / 0;
  for (const r of o.getClientRects())
    i = Math.min(i, r.left), n = Math.min(n, r.top), t = Math.max(t, r.right), s = Math.max(s, r.bottom);
  return new DOMRect(i, n, t - i, s - n);
}, Ft = (o, n, t, i) => {
  const s = (f) => {
    var x, w;
    const T = (x = f.localName) == null ? void 0 : x.toLowerCase();
    if (T === "script" || T === "style") return Vt;
    if (f.nodeType === 1) {
      const { left: S, right: L } = i(f.getBoundingClientRect());
      if (L < n || S > t) return Vt;
      if (S >= n && L <= t) return It;
    } else {
      if (!((w = f.nodeValue) != null && w.trim())) return Bt;
      const S = o.createRange();
      S.selectNodeContents(f);
      const { left: L, right: ct } = i(S.getBoundingClientRect());
      if (ct >= n && L <= t) return It;
    }
    return Bt;
  }, r = o.createTreeWalker(o.body, se, { acceptNode: s }), l = [];
  for (let f = r.nextNode(); f; f = r.nextNode()) l.push(f);
  const h = l[0] ?? o.body, c = l[l.length - 1] ?? h, u = h.nodeType === 1 ? 0 : pt(o, h, (f, T) => {
    const x = i(ut(f)), w = i(ut(T));
    return x.right < n && w.left > n ? 0 : w.left > n ? -1 : 1;
  }), v = c.nodeType === 1 ? 0 : pt(o, c, (f, T) => {
    const x = i(ut(f)), w = i(ut(T));
    return x.right < t && w.left > t ? 0 : w.left > t ? -1 : 1;
  }), y = o.createRange();
  return y.setStart(h, u), y.setEnd(c, v), y;
}, Nt = (o) => {
  const n = document.createRange();
  return n.setStart(o.anchorNode, o.anchorOffset), n.setEnd(o.focusNode, o.focusOffset), n.collapsed;
}, gt = (o, n) => {
  let t;
  if (o.startContainer ? t = o.cloneRange() : o.nodeType && (t = document.createRange(), t.selectNode(o)), t) {
    const i = t.startContainer.ownerDocument.defaultView.getSelection();
    i && (i.removeAllRanges(), n === -1 ? t.collapse(!0) : n === 1 && t.collapse(), i.addRange(t));
  }
}, ne = (o) => {
  const { defaultView: n } = o, { writingMode: t, direction: i } = n.getComputedStyle(o.body), s = t === "vertical-rl" || t === "vertical-lr", r = o.body.dir === "rtl" || i === "rtl" || o.documentElement.dir === "rtl";
  return { vertical: s, rtl: r };
}, vt = (o) => {
  const n = o.defaultView.getComputedStyle(o.body);
  return n.backgroundColor === "rgba(0, 0, 0, 0)" && n.backgroundImage === "none" ? o.defaultView.getComputedStyle(o.documentElement).background : n.background;
}, Ot = (o, n) => Array.from({ length: o }, () => {
  const t = document.createElement("div"), i = document.createElement("div");
  return t.append(i), i.setAttribute("part", n), t;
}), Z = (o, n) => {
  const { style: t } = o;
  for (const [i, s] of Object.entries(n)) t.setProperty(i, s, "important");
};
var it, k, b, st, E, _, nt, X, M, G;
class re {
  constructor({ container: n, onExpand: t }) {
    g(this, it, new ResizeObserver(() => this.expand()));
    g(this, k, document.createElement("div"));
    g(this, b, document.createElement("iframe"));
    g(this, st, document.createRange());
    g(this, E);
    g(this, _, !1);
    g(this, nt, !1);
    g(this, X, !0);
    g(this, M);
    g(this, G, {});
    this.container = n, this.onExpand = t, e(this, b).setAttribute("part", "filter"), e(this, k).append(e(this, b)), Object.assign(e(this, k).style, {
      boxSizing: "content-box",
      position: "relative",
      overflow: "hidden",
      flex: "0 0 auto",
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }), Object.assign(e(this, b).style, {
      overflow: "hidden",
      border: "0",
      display: "none",
      width: "100%",
      height: "100%"
    }), e(this, b).setAttribute("sandbox", "allow-same-origin allow-scripts"), e(this, b).setAttribute("scrolling", "no");
  }
  get element() {
    return e(this, k);
  }
  get document() {
    return e(this, b).contentDocument;
  }
  async load(n, t, i) {
    if (typeof n != "string") throw new Error(`${n} is not string`);
    return new Promise((s) => {
      e(this, b).addEventListener(
        "load",
        () => {
          const r = this.document;
          t == null || t(r), e(this, b).style.display = "block";
          const { vertical: l, rtl: h } = ne(r), c = vt(r);
          e(this, b).style.display = "none", m(this, _, l), m(this, nt, h), e(this, st).selectNodeContents(r.body);
          const u = i == null ? void 0 : i({ vertical: l, rtl: h, background: c });
          e(this, b).style.display = "block", this.render(u), e(this, it).observe(r.body), r.fonts.ready.then(() => this.expand()), s();
        },
        { once: !0 }
      ), e(this, b).src = n;
    });
  }
  render(n) {
    n && this.document && (m(this, X, n.flow !== "scrolled"), m(this, G, n), e(this, X) ? this.columnize(n) : this.scrolled(n));
  }
  scrolled({ gap: n, columnWidth: t }) {
    const i = e(this, _), s = this.document;
    Z(s.documentElement, {
      "box-sizing": "border-box",
      padding: i ? `${n}px 0` : `0 ${n}px`,
      "column-width": "auto",
      height: "auto",
      width: "auto"
    }), Z(s.body, {
      [i ? "max-height" : "max-width"]: `${t}px`,
      margin: "auto"
    }), this.setImageSize(), this.expand();
  }
  columnize({ width: n, height: t, gap: i, columnWidth: s }) {
    const r = e(this, _);
    m(this, M, r ? t : n);
    const l = this.document;
    Z(l.documentElement, {
      "box-sizing": "border-box",
      "column-width": `${Math.trunc(s)}px`,
      "column-gap": `${i}px`,
      "column-fill": "auto",
      ...r ? { width: `${n}px` } : { height: `${t}px` },
      padding: r ? `${i / 2}px 0` : `0 ${i / 2}px`,
      overflow: "hidden",
      // force wrap long words
      "overflow-wrap": "break-word",
      // reset some potentially problematic props
      position: "static",
      border: "0",
      margin: "0",
      "max-height": "none",
      "max-width": "none",
      "min-height": "none",
      "min-width": "none",
      // fix glyph clipping in WebKit
      "-webkit-line-box-contain": "block glyphs replaced"
    }), Z(l.body, {
      "max-height": "none",
      "max-width": "none",
      margin: "0"
    }), this.setImageSize(), this.expand();
  }
  setImageSize() {
    const { width: n, height: t, margin: i } = e(this, G), s = e(this, _), r = this.document;
    for (const l of r.body.querySelectorAll("img, svg, video")) {
      const { maxHeight: h, maxWidth: c } = r.defaultView.getComputedStyle(l);
      Z(l, {
        "max-height": s ? h !== "none" && h !== "0px" ? h : "100%" : `${t - i * 2}px`,
        "max-width": s ? `${n - i * 2}px` : c !== "none" && c !== "0px" ? c : "100%",
        "object-fit": "contain",
        "page-break-inside": "avoid",
        "break-inside": "avoid",
        "box-sizing": "border-box"
      });
    }
  }
  expand() {
    const { documentElement: n } = this.document;
    if (e(this, X)) {
      const t = e(this, _) ? "height" : "width", i = e(this, _) ? "width" : "height", s = e(this, st).getBoundingClientRect(), r = n.getBoundingClientRect(), h = (e(this, _) ? 0 : e(this, nt) ? r.right - s.right : s.left - r.left) + s[t], u = Math.ceil(h / e(this, M)) * e(this, M);
      e(this, k).style.padding = "0", e(this, b).style[t] = `${u}px`, e(this, k).style[t] = `${u + e(this, M) * 2}px`, e(this, b).style[i] = "100%", e(this, k).style[i] = "100%", n.style[t] = `${e(this, M)}px`, e(this, E) && (e(this, E).element.style.margin = "0", e(this, E).element.style.left = e(this, _) ? "0" : `${e(this, M)}px`, e(this, E).element.style.top = e(this, _) ? `${e(this, M)}px` : "0", e(this, E).element.style[t] = `${u}px`, e(this, E).redraw());
    } else {
      const t = e(this, _) ? "width" : "height", i = e(this, _) ? "height" : "width", r = n.getBoundingClientRect()[t], { margin: l } = e(this, G), h = e(this, _) ? `0 ${l}px` : `${l}px 0`;
      e(this, k).style.padding = h, e(this, b).style[t] = `${r}px`, e(this, k).style[t] = `${r}px`, e(this, b).style[i] = "100%", e(this, k).style[i] = "100%", e(this, E) && (e(this, E).element.style.margin = h, e(this, E).element.style.left = "0", e(this, E).element.style.top = "0", e(this, E).element.style[t] = `${r}px`, e(this, E).redraw());
    }
    this.onExpand();
  }
  set overlayer(n) {
    m(this, E, n), e(this, k).append(n.element);
  }
  get overlayer() {
    return e(this, E);
  }
  destroy() {
    this.document && e(this, it).unobserve(this.document.body);
  }
}
it = new WeakMap(), k = new WeakMap(), b = new WeakMap(), st = new WeakMap(), E = new WeakMap(), _ = new WeakMap(), nt = new WeakMap(), X = new WeakMap(), M = new WeakMap(), G = new WeakMap();
var I, rt, A, D, z, B, j, p, C, R, F, P, $, K, N, ot, at, ht, Y, O, W, J, lt, a, jt, wt, bt, Et, St, tt, Wt, q, H, Q, qt, et, _t, zt, Tt, mt, Ht, Qt, V, kt;
class Dt extends HTMLElement {
  constructor() {
    super();
    g(this, a);
    g(this, I, this.attachShadow({ mode: "closed" }));
    g(this, rt, new ResizeObserver(() => this.render()));
    g(this, A);
    g(this, D);
    g(this, z);
    g(this, B);
    g(this, j);
    g(this, p);
    g(this, C, !1);
    g(this, R, !1);
    g(this, F, 0);
    g(this, P, -1);
    g(this, $, 0);
    // anchor view to a fraction (0-1), Range, or Element
    g(this, K, !1);
    g(this, N, !1);
    // while true, prevent any further navigation
    g(this, ot);
    g(this, at, /* @__PURE__ */ new WeakMap());
    g(this, ht, matchMedia("(prefers-color-scheme: dark)"));
    g(this, Y);
    g(this, O);
    g(this, W);
    g(this, J);
    g(this, lt);
    e(this, I).innerHTML = `<style>
        :host {
            display: block;
            container-type: size;
        }
        :host, #top {
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            width: 100%;
            height: 100%;
        }
        #top {
            --_gap: 7%;
            --_margin-top: 48px;
            --_margin-bottom: 48px;
            --_margin-left: 48px;
            --_margin-right: 48px;
            --_max-inline-size: 720px;
            --_max-block-size: 1440px;
            --_max-column-count: 2;
            --_max-column-count-portrait: 1;
            --_max-column-count-spread: var(--_max-column-count);
            --_half-gap: calc(var(--_gap) / 2);
            --_max-width: calc(var(--_max-inline-size) * var(--_max-column-count-spread));
            --_max-height: var(--_max-block-size);
            display: grid;
            grid-template-columns:
                minmax(var(--_margin-left), 1fr)
                var(--_half-gap)
                minmax(0, calc(var(--_max-width) - var(--_gap)))
                var(--_half-gap)
                minmax(var(--_margin-right), 1fr);
            grid-template-rows:
                minmax(var(--_margin-top), 1fr)
                minmax(0, var(--_max-height))
                minmax(var(--_margin-bottom), 1fr);
            &.vertical {
                --_max-column-count-spread: var(--_max-column-count-portrait);
                --_max-width: var(--_max-block-size);
                --_max-height: calc(var(--_max-inline-size) * var(--_max-column-count-spread));
            }
            @container (orientation: portrait) {
                & {
                    --_max-column-count-spread: var(--_max-column-count-portrait);
                }
                &.vertical {
                    --_max-column-count-spread: var(--_max-column-count);
                }
            }
        }
        #background {
            grid-column: 1 / -1;
            grid-row: 1 / -1;
        }
        #container {
            grid-column: 2 / 5;
            grid-row: 2;
            overflow: hidden;
        }
        :host([flow="scrolled"]) #container {
            grid-column: 1 / -1;
            grid-row: 1 / -1;
            overflow: auto;
        }
        #header {
            grid-column: 3 / 4;
            grid-row: 1;
            height: var(--_margin-top);
        }
        #footer {
            grid-column: 3 / 4;
            grid-row: 3;
            align-self: end;
            height: var(--_margin-bottom);
        }
        :is(#header, #footer) {
            display: grid;
        }
        :is(#header, #footer) > * {
            display: flex;
            align-items: center;
            min-width: 0;
        }
        :is(#header, #footer) > * > * {
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            text-align: center;
            font-size: .75em;
            opacity: .6;
        }
        </style>
        <div id="top">
            <div id="background" part="filter"></div>
            <div id="header"></div>
            <div id="container"></div>
            <div id="footer"></div>
        </div>
        `, m(this, A, e(this, I).getElementById("top")), m(this, D, e(this, I).getElementById("background")), m(this, z, e(this, I).getElementById("container")), m(this, B, e(this, I).getElementById("header")), m(this, j, e(this, I).getElementById("footer")), e(this, rt).observe(e(this, z)), e(this, z).addEventListener("scroll", () => this.dispatchEvent(new Event("scroll"))), e(this, z).addEventListener(
      "scroll",
      Lt(() => {
        this.scrolled && (e(this, K) ? m(this, K, !1) : (d(this, a, et).call(this, "scroll"), d(this, a, _t).call(this)));
      }, 250)
    );
    const t = { passive: !1 };
    this.addEventListener("touchstart", d(this, a, bt).bind(this), t), this.addEventListener("touchmove", d(this, a, Et).bind(this), t), this.addEventListener("touchend", d(this, a, St).bind(this)), this.addEventListener("load", ({ detail: { doc: s } }) => {
      s.addEventListener("touchstart", d(this, a, bt).bind(this), t), s.addEventListener("touchmove", d(this, a, Et).bind(this), t), s.addEventListener("touchend", d(this, a, St).bind(this));
    }), this.addEventListener("relocate", ({ detail: s }) => {
      s.reason === "selection" ? gt(e(this, $), 0) : s.reason === "navigation" && (e(this, $) === 1 ? gt(s.range, 1) : typeof e(this, $) == "number" ? gt(s.range, -1) : gt(e(this, $), -1));
    });
    const i = Lt((s, r) => {
      if (!r.rangeCount) return;
      const l = r.getRangeAt(0), h = Nt(r);
      h && l.compareBoundaryPoints(Range.START_TO_START, s) < 0 ? this.prev() : !h && l.compareBoundaryPoints(Range.END_TO_END, s) > 0 && this.next();
    }, 700);
    this.addEventListener("load", ({ detail: { doc: s } }) => {
      let r = !1;
      s.addEventListener("pointerdown", () => r = !0), s.addEventListener("pointerup", () => r = !1);
      let l = !1;
      s.addEventListener("keydown", () => l = !0), s.addEventListener("keyup", () => l = !1), s.addEventListener("selectionchange", () => {
        if (this.scrolled) return;
        const h = e(this, lt);
        if (!h) return;
        const c = s.getSelection();
        if (c.rangeCount) {
          if (r && c.type === "Range") i(h, c);
          else if (l) {
            const u = c.getRangeAt(0).cloneRange();
            Nt(c) || u.collapse(), d(this, a, Q).call(this, u);
          }
        }
      }), s.addEventListener(
        "focusin",
        (h) => this.scrolled ? null : (
          // NOTE: `requestAnimationFrame` is needed in WebKit
          requestAnimationFrame(() => d(this, a, Q).call(this, h.target))
        )
      );
    }), m(this, Y, () => {
      e(this, p) && (e(this, D).style.background = vt(e(this, p).document));
    }), e(this, ht).addEventListener("change", e(this, Y));
  }
  attributeChangedCallback(t, i, s) {
    switch (t) {
      case "flow":
        this.render();
        break;
      case "gap":
      case "margin-top":
      case "margin-bottom":
      case "margin-left":
      case "margin-right":
      case "max-block-size":
      case "max-column-count":
        e(this, A).style.setProperty("--_" + t, s);
        break;
      case "max-inline-size":
        e(this, A).style.setProperty("--_" + t, s), this.render();
        break;
    }
  }
  open(t) {
    var i;
    this.bookDir = t.dir, this.sections = t.sections, (i = t.transformTarget) == null || i.addEventListener("data", ({ detail: s }) => {
      if (s.type !== "text/css") return;
      const r = innerWidth, l = innerHeight;
      s.data = Promise.resolve(s.data).then(
        (h) => h.replace(new RegExp("(?<=[{\\s;])-epub-", "gi"), "").replace(/(\d*\.?\d+)vw/gi, (c, u) => parseFloat(u) * r / 100 + "px").replace(/(\d*\.?\d+)vh/gi, (c, u) => parseFloat(u) * l / 100 + "px").replace(/page-break-(after|before|inside)\s*:/gi, (c, u) => `-webkit-column-break-${u}:`).replace(/break-(after|before|inside)\s*:\s*(avoid-)?page/gi, (c, u, v) => `break-${u}: ${v ?? ""}column`)
      );
    });
  }
  render() {
    e(this, p) && (e(this, p).render(
      d(this, a, wt).call(this, {
        vertical: e(this, C),
        rtl: e(this, R)
      })
    ), d(this, a, Q).call(this, e(this, $)));
  }
  get scrolled() {
    return this.getAttribute("flow") === "scrolled";
  }
  get scrollProp() {
    const { scrolled: t } = this;
    return e(this, C) ? t ? "scrollLeft" : "scrollTop" : t ? "scrollTop" : "scrollLeft";
  }
  get sideProp() {
    const { scrolled: t } = this;
    return e(this, C) ? t ? "width" : "height" : t ? "height" : "width";
  }
  get size() {
    return e(this, z).getBoundingClientRect()[this.sideProp];
  }
  get viewSize() {
    return e(this, p).element.getBoundingClientRect()[this.sideProp];
  }
  get start() {
    return Math.abs(e(this, z)[this.scrollProp]);
  }
  get end() {
    return this.start + this.size;
  }
  get page() {
    return Math.floor((this.start + this.end) / 2 / this.size);
  }
  get pages() {
    return Math.round(this.viewSize / this.size);
  }
  scrollBy(t, i) {
    const s = e(this, C) ? i : t, r = e(this, z), { scrollProp: l } = this, [h, c, u] = e(this, O), v = e(this, R), y = v ? h - u : h - c, f = v ? h + c : h + u;
    r[l] = Math.max(y, Math.min(f, r[l] + s));
  }
  snap(t, i) {
    const s = e(this, C) ? i : t, [r, l, h] = e(this, O), { start: c, end: u, pages: v, size: y } = this, f = Math.abs(r) - l, T = Math.abs(r) + h, x = s * (e(this, R) ? -y : y), w = Math.floor(Math.max(f, Math.min(T, (c + u) / 2 + (isNaN(x) ? 0 : x))) / y);
    d(this, a, H).call(this, w, "snap").then(() => {
      const S = w <= 0 ? -1 : w >= v - 1 ? 1 : null;
      if (S)
        return d(this, a, mt).call(this, {
          index: d(this, a, V).call(this, S),
          anchor: S < 0 ? () => 1 : () => 0
        });
    });
  }
  async scrollToAnchor(t, i) {
    return d(this, a, Q).call(this, t, i ? "selection" : "navigation");
  }
  async goTo(t) {
    if (e(this, N)) return;
    const i = await t;
    if (d(this, a, Tt).call(this, i.index)) return d(this, a, mt).call(this, i);
  }
  get atStart() {
    return d(this, a, V).call(this, -1) == null && this.page <= 1;
  }
  get atEnd() {
    return d(this, a, V).call(this, 1) == null && this.page >= this.pages - 2;
  }
  prev(t) {
    return d(this, a, kt).call(this, -1, t);
  }
  next(t) {
    return d(this, a, kt).call(this, 1, t);
  }
  prevSection() {
    return this.goTo({ index: d(this, a, V).call(this, -1) });
  }
  nextSection() {
    return this.goTo({ index: d(this, a, V).call(this, 1) });
  }
  firstSection() {
    const t = this.sections.findIndex((i) => i.linear !== "no");
    return this.goTo({ index: t });
  }
  lastSection() {
    const t = this.sections.findLastIndex((i) => i.linear !== "no");
    return this.goTo({ index: t });
  }
  getContents() {
    return e(this, p) ? [
      {
        index: e(this, P),
        overlayer: e(this, p).overlayer,
        doc: e(this, p).document
      }
    ] : [];
  }
  setStyles(t) {
    var l, h, c, u, v;
    m(this, ot, t);
    const i = e(this, at).get((l = e(this, p)) == null ? void 0 : l.document);
    if (!i) return;
    const [s, r] = i;
    if (Array.isArray(t)) {
      const [y, f] = t;
      s.textContent = y, r.textContent = f;
    } else r.textContent = t;
    requestAnimationFrame(() => e(this, D).style.background = vt(e(this, p).document)), (v = (u = (c = (h = e(this, p)) == null ? void 0 : h.document) == null ? void 0 : c.fonts) == null ? void 0 : u.ready) == null || v.then(() => e(this, p).expand());
  }
  focusView() {
    e(this, p).document.defaultView.focus();
  }
  destroy() {
    var t, i;
    e(this, rt).unobserve(this), e(this, p).destroy(), m(this, p, null), (i = (t = this.sections[e(this, P)]) == null ? void 0 : t.unload) == null || i.call(t), e(this, ht).removeEventListener("change", e(this, Y));
  }
}
I = new WeakMap(), rt = new WeakMap(), A = new WeakMap(), D = new WeakMap(), z = new WeakMap(), B = new WeakMap(), j = new WeakMap(), p = new WeakMap(), C = new WeakMap(), R = new WeakMap(), F = new WeakMap(), P = new WeakMap(), $ = new WeakMap(), K = new WeakMap(), N = new WeakMap(), ot = new WeakMap(), at = new WeakMap(), ht = new WeakMap(), Y = new WeakMap(), O = new WeakMap(), W = new WeakMap(), J = new WeakMap(), lt = new WeakMap(), a = new WeakSet(), jt = function() {
  return e(this, p) && (e(this, p).destroy(), e(this, z).removeChild(e(this, p).element)), m(this, p, new re({
    container: this,
    onExpand: () => d(this, a, Q).call(this, e(this, $))
  })), e(this, z).append(e(this, p).element), e(this, p);
}, wt = function({ vertical: t, rtl: i, background: s }) {
  m(this, C, t), m(this, R, i), e(this, A).classList.toggle("vertical", t), e(this, D).style.background = s;
  const { width: r, height: l } = e(this, z).getBoundingClientRect(), h = t ? l : r, c = getComputedStyle(e(this, A)), u = parseFloat(c.getPropertyValue("--_max-inline-size")), v = parseInt(c.getPropertyValue("--_max-column-count-spread")), y = parseFloat(c.getPropertyValue("--_margin-top")), f = parseFloat(c.getPropertyValue("--_margin-bottom")), T = parseFloat(c.getPropertyValue("--_margin-left")), x = parseFloat(c.getPropertyValue("--_margin-right")), w = t ? (T + x) / 2 : (y + f) / 2;
  m(this, F, w);
  const S = parseFloat(c.getPropertyValue("--_gap")) / 100, L = -S / (S - 1) * h, ct = this.getAttribute("flow");
  if (ct === "scrolled") {
    this.setAttribute("dir", t ? "rtl" : "ltr"), e(this, A).style.padding = `${y}px ${x}px ${f}px ${T}px`;
    const U = u;
    return this.heads = null, this.feet = null, e(this, B).replaceChildren(), e(this, j).replaceChildren(), { flow: ct, margin: w, gap: L, columnWidth: U };
  }
  e(this, A).style.padding = "";
  const Ct = Math.min(v, Math.ceil(h / u)), Xt = h / Ct - L;
  this.setAttribute("dir", i ? "rtl" : "ltr");
  const ft = t ? Math.min(2, Math.ceil(r / u)) : Ct, Rt = {
    gridTemplateColumns: `repeat(${ft}, 1fr)`,
    gap: `${L}px`,
    direction: this.bookDir === "rtl" ? "rtl" : "ltr"
  };
  Object.assign(e(this, B).style, Rt), Object.assign(e(this, j).style, Rt);
  const $t = Ot(ft, "head"), Mt = Ot(ft, "foot");
  return this.heads = $t.map((U) => U.children[0]), this.feet = Mt.map((U) => U.children[0]), e(this, B).replaceChildren(...$t), e(this, j).replaceChildren(...Mt), { height: l, width: r, margin: w, gap: L, columnWidth: Xt };
}, bt = function(t) {
  const i = t.changedTouches[0];
  m(this, W, {
    x: i == null ? void 0 : i.screenX,
    y: i == null ? void 0 : i.screenY,
    t: t.timeStamp,
    vx: 0,
    xy: 0
  });
}, Et = function(t) {
  const i = e(this, W);
  if (i.pinched || (i.pinched = globalThis.visualViewport.scale > 1, this.scrolled || i.pinched) || globalThis.__reactorNoSwipe) return;
  if (t.touches.length > 1) {
    e(this, J) && t.preventDefault();
    return;
  }
  t.preventDefault();
  const s = t.changedTouches[0], r = s.screenX, l = s.screenY, h = i.x - r, c = i.y - l, u = t.timeStamp - i.t;
  i.x = r, i.y = l, i.t = t.timeStamp, i.vx = h / u, i.vy = c / u, m(this, J, !0), this.scrollBy(h, c);
}, St = function() {
  if (m(this, J, !1), this.scrolled) {
    d(this, a, _t).call(this);
    return;
  }
  requestAnimationFrame(() => {
    globalThis.visualViewport.scale === 1 && this.snap(e(this, W).vx, e(this, W).vy);
  });
}, // allows one to process rects as if they were LTR and horizontal
tt = function() {
  if (this.scrolled) {
    const i = this.viewSize, s = e(this, F);
    return e(this, C) ? ({ left: r, right: l }) => ({ left: i - l - s, right: i - r - s }) : ({ top: r, bottom: l }) => ({ left: r + s, right: l + s });
  }
  const t = this.pages * this.size;
  return e(this, R) ? ({ left: i, right: s }) => ({ left: t - s, right: t - i }) : e(this, C) ? ({ top: i, bottom: s }) => ({ left: i, right: s }) : (i) => i;
}, Wt = async function(t, i) {
  if (this.scrolled) {
    const r = d(this, a, tt).call(this)(t).left - e(this, F);
    return d(this, a, q).call(this, r, i);
  }
  const s = d(this, a, tt).call(this)(t).left;
  return d(this, a, H).call(this, Math.floor(s / this.size) + (e(this, R) ? -1 : 1), i);
}, q = async function(t, i, s) {
  const r = e(this, z), { scrollProp: l, size: h } = this;
  if (r[l] === t) {
    m(this, O, [t, this.atStart ? 0 : h, this.atEnd ? 0 : h]), d(this, a, et).call(this, i);
    return;
  }
  if (this.scrolled && e(this, C) && (t = -t), (i === "snap" || s) && this.hasAttribute("animated"))
    return Ut(r[l], t, 300, Jt, (c) => r[l] = c).then(() => {
      m(this, O, [t, this.atStart ? 0 : h, this.atEnd ? 0 : h]), d(this, a, et).call(this, i);
    });
  r[l] = t, m(this, O, [t, this.atStart ? 0 : h, this.atEnd ? 0 : h]), d(this, a, et).call(this, i);
}, H = async function(t, i, s) {
  const r = this.size * (e(this, R) ? -t : t);
  return d(this, a, q).call(this, r, i, s);
}, Q = async function(t, i = "anchor") {
  var c, u;
  m(this, $, t);
  const s = (u = (c = Zt(t)) == null ? void 0 : c.getClientRects) == null ? void 0 : u.call(c);
  if (s) {
    const v = Array.from(s).find((y) => y.width > 0 && y.height > 0) || s[0];
    if (!v) return;
    await d(this, a, Wt).call(this, v, i);
    return;
  }
  if (this.scrolled) {
    await d(this, a, q).call(this, t * this.viewSize, i);
    return;
  }
  const { pages: r } = this;
  if (!r) return;
  const l = r - 2, h = Math.round(t * (l - 1));
  await d(this, a, H).call(this, h + 1, i);
}, qt = function() {
  if (this.scrolled) return Ft(e(this, p).document, this.start + e(this, F), this.end - e(this, F), d(this, a, tt).call(this));
  const t = e(this, R) ? -this.size : this.size;
  return Ft(e(this, p).document, this.start - t, this.end - t, d(this, a, tt).call(this));
}, et = function(t) {
  const i = d(this, a, qt).call(this);
  m(this, lt, i), t !== "selection" && t !== "navigation" && t !== "anchor" ? m(this, $, i) : m(this, K, !0);
  const s = e(this, P), r = { reason: t, range: i, index: s };
  if (this.scrolled) r.fraction = this.start / this.viewSize;
  else if (this.pages > 0) {
    const { page: l, pages: h } = this;
    e(this, B).style.visibility = l > 1 ? "visible" : "hidden", r.fraction = (l - 1) / (h - 2), r.size = 1 / (h - 2);
  }
  this.dispatchEvent(new CustomEvent("relocate", { detail: r }));
}, // In scrolled flow the container's native scroll has no way to carry on past the end of the
// loaded section on its own — the browser just stops at the bottom of that iframe's content,
// since the next section isn't in the DOM yet. Reuse the same "at the edge" check `next()`
// uses for an explicit page-turn so continuous scroll actually flows across section
// boundaries instead of dead-ending until something else forces a section load.
_t = function() {
  e(this, N) || this.start > 0 && this.viewSize - this.end <= 2 && d(this, a, V).call(this, 1) != null && this.next();
}, zt = async function(t) {
  var u, v;
  const { index: i, src: s, anchor: r, onLoad: l, select: h } = await t;
  m(this, P, i);
  const c = (v = (u = e(this, p)) == null ? void 0 : u.document) == null ? void 0 : v.hasFocus();
  if (s) {
    const y = d(this, a, jt).call(this), f = (x) => {
      if (x.head) {
        const w = x.createElement("style");
        x.head.prepend(w);
        const S = x.createElement("style");
        x.head.append(S), e(this, at).set(x, [w, S]);
      }
      l == null || l({ doc: x, index: i });
    }, T = d(this, a, wt).bind(this);
    await y.load(s, f, T), this.dispatchEvent(
      new CustomEvent("create-overlayer", {
        detail: {
          doc: y.document,
          index: i,
          attach: (x) => y.overlayer = x
        }
      })
    ), m(this, p, y);
  }
  await this.scrollToAnchor((typeof r == "function" ? r(e(this, p).document) : r) ?? 0, h), c && this.focusView();
}, Tt = function(t) {
  return t >= 0 && t <= this.sections.length - 1;
}, mt = async function({ index: t, anchor: i, select: s }) {
  if (t === e(this, P)) await d(this, a, zt).call(this, { index: t, anchor: i, select: s });
  else {
    const r = e(this, P), l = (h) => {
      var c, u;
      (u = (c = this.sections[r]) == null ? void 0 : c.unload) == null || u.call(c), this.setStyles(e(this, ot)), this.dispatchEvent(new CustomEvent("load", { detail: h }));
    };
    await d(this, a, zt).call(this, Promise.resolve(this.sections[t].load()).then((h) => {
      if (!h) throw new Error(`Failed to load section ${t}`);
      return { index: t, src: h, anchor: i, onLoad: l, select: s };
    }).catch((h) => {
      throw console.warn(h), console.warn(new Error(`Failed to load section ${t}`)), h;
    }));
  }
}, Ht = function(t) {
  if (!e(this, p)) return !0;
  if (this.scrolled)
    return this.start > 0 ? d(this, a, q).call(this, Math.max(0, this.start - (t ?? this.size)), null, !0) : !0;
  if (this.atStart) return;
  const i = this.page - 1;
  return d(this, a, H).call(this, i, "page", !0).then(() => i <= 0);
}, Qt = function(t) {
  if (!e(this, p)) return !0;
  if (this.scrolled)
    return this.viewSize - this.end > 2 ? d(this, a, q).call(this, Math.min(this.viewSize, t ? this.start + t : this.end), null, !0) : !0;
  if (this.atEnd) return;
  const i = this.page + 1, s = this.pages;
  return d(this, a, H).call(this, i, "page", !0).then(() => i >= s - 1);
}, V = function(t) {
  var i;
  for (let s = e(this, P) + t; d(this, a, Tt).call(this, s); s += t) if (((i = this.sections[s]) == null ? void 0 : i.linear) !== "no") return s;
}, kt = async function(t, i) {
  if (e(this, N)) return;
  m(this, N, !0);
  const s = t === -1, r = await (s ? d(this, a, Ht).call(this, i) : d(this, a, Qt).call(this, i));
  r && await d(this, a, mt).call(this, {
    index: d(this, a, V).call(this, t),
    anchor: s ? () => 1 : () => 0
  }), (r || !this.hasAttribute("animated")) && await Yt(100), m(this, N, !1);
}, // Stage 2: split the single `margin` attribute into four independent sides (top/bottom/left/
// right), so the host can give the page asymmetric margins (publisher margins are rarely
// symmetric). Each still behaves like the old `margin` did: a *minimum* inset, via
// `minmax(var(--_margin-*), 1fr)` in the grid below, with any extra space beyond the content's
// max-inline/max-block-size filled by the flexible `1fr` track for centering.
Pt(Dt, "observedAttributes", [
  "flow",
  "gap",
  "margin-top",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "max-inline-size",
  "max-block-size",
  "max-column-count"
]);
customElements.define("foliate-paginator", Dt);
export {
  Dt as Paginator
};
