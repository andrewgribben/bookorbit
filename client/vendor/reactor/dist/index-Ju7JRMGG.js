var In = Object.defineProperty;
var Ut = (e) => {
  throw TypeError(e);
};
var Pn = (e, r, t) => r in e ? In(e, r, { enumerable: !0, configurable: !0, writable: !0, value: t }) : e[r] = t;
var T = (e, r, t) => Pn(e, typeof r != "symbol" ? r + "" : r, t), ut = (e, r, t) => r.has(e) || Ut("Cannot " + t);
var E = (e, r, t) => (ut(e, r, "read from private field"), t ? t.call(e) : r.get(e)), J = (e, r, t) => r.has(e) ? Ut("Cannot add the same private member more than once") : r instanceof WeakSet ? r.add(e) : r.set(e, t), Q = (e, r, t, o) => (ut(e, r, "write to private field"), o ? o.call(e, t) : r.set(e, t), t), q = (e, r, t) => (ut(e, r, "access private method"), t);
var Vt = (e, r, t, o) => ({
  set _(n) {
    Q(e, r, n, t);
  },
  get _() {
    return E(e, r, o);
  }
});
function he(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function j(e) {
  return typeof e == "string";
}
function ue(e) {
  return e === null || typeof e == "string";
}
function R(e) {
  return typeof e == "number" && Number.isFinite(e);
}
function et(e) {
  return e === null || R(e);
}
function pe(e) {
  return typeof e == "boolean";
}
function Fn(e) {
  return Array.isArray(e);
}
function Pe(e, r) {
  return Array.isArray(e) && e.every(r);
}
function Cr(e) {
  return e === "paginated" || e === "scrolled";
}
function Nt(e) {
  return he(e) ? R(e.fontSize) && R(e.lineHeight) && ue(e.fontFamily) && R(e.paragraphSpacing) && R(e.maxColumnCount) && R(e.gap) && R(e.maxInlineSize) && R(e.maxBlockSize) && pe(e.justify) && pe(e.hyphenate) && pe(e.isDark) && j(e.themeName) && Cr(e.flow) && pe(e.useBookLayout) && R(e.marginTop) && R(e.marginBottom) && R(e.marginLeft) && R(e.marginRight) && pe(e.linkSideMargins) && (e.letterSpacing === void 0 || R(e.letterSpacing)) && (e.wordSpacing === void 0 || R(e.wordSpacing)) && (e.textIndent === void 0 || R(e.textIndent)) && (e.fontWeight === void 0 || R(e.fontWeight)) : !1;
}
function $n(e) {
  return he(e) ? ue(e.format) && ue(e.cfi) && et(e.fraction) && (e.settings === null || e.settings === void 0 || Nt(e.settings)) && ue(e.previousCfi) : !1;
}
const Mn = [
  "goTo",
  "goToFraction",
  "prev",
  "next",
  "historyBack",
  "historyForward",
  "setSwipe",
  "applyStyles",
  "setAnnotations",
  "clearSelection",
  "search",
  "clearSearch",
  "narrationPrepare",
  "narrationCancelPrepare",
  "narrationHighlight",
  "narrationUnhighlight"
];
function Rn(e) {
  return he(e) && j(e.cfi) && j(e.color) && j(e.style);
}
const Ar = {
  goTo: (e) => j(e.target),
  goToFraction: (e) => R(e.value),
  prev: () => !0,
  next: () => !0,
  historyBack: () => !0,
  historyForward: () => !0,
  setSwipe: (e) => pe(e.enabled),
  applyStyles: (e) => Nt(e.settings),
  setAnnotations: (e) => Fn(e.items) && e.items.every(Rn),
  clearSelection: () => !0,
  search: (e) => j(e.query),
  clearSearch: () => !0,
  narrationPrepare: (e) => R(e.generation),
  narrationCancelPrepare: () => !0,
  narrationHighlight: (e) => j(e.textHref),
  narrationUnhighlight: () => !0
};
function Tr(e) {
  if (!he(e) || !j(e.type)) return !1;
  const r = Ar[e.type];
  return r !== void 0 && r(e);
}
function On(e) {
  let r;
  try {
    r = JSON.parse(e);
  } catch {
    return null;
  }
  return Tr(r) ? r : null;
}
const _n = [
  "ready",
  "loaded",
  "relocate",
  "history",
  "error",
  "tap",
  "selection",
  "selectionCleared",
  "searchResults",
  "searchProgress",
  "searchDone",
  "annotationTap",
  "narrationTimeline",
  "narrationTimelineError"
];
function Lr(e) {
  return he(e) && j(e.label) && ue(e.href) && Pe(e.subitems, Lr);
}
function Nr(e) {
  return he(e) && R(e.left) && R(e.top) && R(e.right) && R(e.bottom);
}
function Hn(e) {
  return e === null || Nr(e);
}
function Dn(e) {
  return he(e) && j(e.cfi) && j(e.pre) && j(e.match) && j(e.post);
}
function Gn(e) {
  return he(e) && R(e.sectionIndex) && j(e.textHref) && R(e.beginSec) && et(e.endSec) && R(e.audioIndex);
}
function jn(e) {
  return j(e) ? !0 : he(e) && Object.values(e).every(j);
}
function Wn(e) {
  return e === null || jn(e);
}
function Un(e) {
  return e === null || j(e) || Pe(e, j);
}
const Br = {
  ready: () => !0,
  loaded: (e) => Pe(e.toc, Lr) && he(e.metadata) && Wn(e.metadata.title) && Un(e.metadata.language) && pe(e.hasMediaOverlay) && pe(e.isRtl),
  relocate: (e) => ue(e.cfi) && et(e.fraction) && ue(e.chapterTitle) && ue(e.reason) && pe(e.restoring) && ue(e.narrationFragment) && et(e.narrationSectionIndex),
  history: (e) => pe(e.canGoBack) && pe(e.canGoForward),
  error: (e) => j(e.message),
  tap: (e) => R(e.x) && R(e.y),
  selection: (e) => j(e.text) && ue(e.cfi) && Nr(e.rect),
  selectionCleared: () => !0,
  searchResults: (e) => j(e.label) && Pe(e.items, Dn),
  searchProgress: (e) => R(e.progress),
  searchDone: (e) => R(e.total) && pe(e.capped),
  annotationTap: (e) => ue(e.cfi) && Hn(e.rect),
  narrationTimeline: (e) => R(e.generation) && Pe(e.audioSrcs, j) && Pe(e.items, Gn) && j(e.activeClass) && ue(e.playbackActiveClass) && j(e.startTextHref),
  narrationTimelineError: (e) => R(e.generation) && j(e.message)
};
function zr(e) {
  if (!he(e) || !j(e.type)) return !1;
  const r = Br[e.type];
  return r !== void 0 && r(e);
}
function Vn(e) {
  let r;
  try {
    r = JSON.parse(e);
  } catch {
    return null;
  }
  return zr(r) ? r : null;
}
function Ir(e) {
  return he(e) && j(e.name) && R(e.size);
}
function qn(e) {
  return Array.isArray(e) && e.every(Ir);
}
const Kn = "entries.json", Pr = "entry/";
function Yn(e) {
  return Pr + e.split("/").map(encodeURIComponent).join("/");
}
const Xn = {
  /** `(metaJson: string) => void` - begins a streamed open; see ./meta.ts for the payload. */
  begin: "__readerBegin",
  /** `(base64: string) => void` - one chunk of the file started by `begin`. */
  chunk: "__readerChunk",
  /** `() => void` - finishes the transfer started by `begin`/`chunk`* and opens it. */
  commit: "__readerCommit",
  /** `(metaJson: string, baseUrl: string) => void` - lazy zip open; see ./http.ts for `baseUrl`'s
   * shape. */
  openLocal: "__readerOpenLocal",
  /** `(commandJson: string) => void` - everything else; see ./commands.ts. */
  command: "__readerCommand"
}, Pi = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  LOCAL_EPUB_ENTRIES_PATH: Kn,
  LOCAL_EPUB_ENTRY_PATH_PREFIX: Pr,
  READER_COMMAND_TYPES: Mn,
  READER_EVENT_TYPES: _n,
  READER_GLOBALS: Xn,
  isLocalEpubEntry: Ir,
  isLocalEpubEntryList: qn,
  isReaderCommand: Tr,
  isReaderEvent: zr,
  isReaderFlow: Cr,
  isReaderOpenMeta: $n,
  isReaderSettings: Nt,
  localEpubEntryPath: Yn,
  parseReaderCommand: On,
  parseReaderEvent: Vn,
  readerCommandValidators: Ar,
  readerEventValidators: Br
}, Symbol.toStringTag, { value: "Module" })), Zn = (e, r) => e.map((t, o, n) => r(t, o, n) ? o : null).filter((t) => t != null), Fr = (e, r) => [-1, ...r, e.length].reduce(({ xs: t, a: o }, n) => ({ xs: (t == null ? void 0 : t.concat([e.slice(o + 1, n)])) ?? [], a: n }), {}).xs, Jn = (e, r) => e.slice(0, -1).concat([e[e.length - 1].concat(r[0])]).concat(r.slice(1)), pt = /\d/, at = /^epubcfi\((.*)\)$/, qt = (e) => e.replace(/[\^[\](),;=]/g, "^$&"), $r = (e) => at.test(e) ? e : `epubcfi(${e})`, Qn = (e) => {
  var r;
  return ((r = e.match(at)) == null ? void 0 : r[1]) ?? e;
}, eo = (e) => (...r) => `epubcfi(${e(...r.map((t) => {
  var o;
  return ((o = t.match(at)) == null ? void 0 : o[1]) ?? t;
}))})`, to = eo((...e) => e.join("!")), ro = (e) => {
  const r = [];
  let t, o, n = "";
  const s = (a) => (r.push(a), t = null, n = ""), i = (a) => (n += a, o = !1);
  for (const a of Array.from(e.trim()).concat("")) {
    if (a === "^" && !o) {
      o = !0;
      continue;
    }
    if (t === "!") s(["!"]);
    else if (t === ",") s([","]);
    else if (t === "/" || t === ":")
      if (pt.test(a)) {
        i(a);
        continue;
      } else s([t, parseInt(n)]);
    else if (t === "~")
      if (pt.test(a) || a === ".") {
        i(a);
        continue;
      } else s(["~", parseFloat(n)]);
    else if (t === "@") {
      if (a === ":") {
        s(["@", parseFloat(n)]), t = "@";
        continue;
      }
      if (pt.test(a) || a === ".") {
        i(a);
        continue;
      } else s(["@", parseFloat(n)]);
    } else if (t === "[") {
      a === ";" && !o ? (s(["[", n]), t = ";") : a === "," && !o ? (s(["[", n]), t = "[") : a === "]" && !o ? s(["[", n]) : i(a);
      continue;
    } else if (t != null && t.startsWith(";")) {
      a === "=" && !o ? (t = `;${n}`, n = "") : a === ";" && !o ? (s([t, n]), t = ";") : a === "]" && !o ? s([t, n]) : i(a);
      continue;
    }
    (a === "/" || a === ":" || a === "~" || a === "@" || a === "[" || a === "!" || a === ",") && (t = a);
  }
  return r;
}, Mr = (e, r) => Zn(e, ([t]) => t === r), no = (e) => {
  const r = [];
  let t;
  for (const [o, n] of e) {
    if (o === "/") r.push({ index: n });
    else {
      const s = r[r.length - 1];
      if (o === ":") s.offset = n;
      else if (o === "~") s.temporal = n;
      else if (o === "@") s.spatial = (s.spatial ?? []).concat(n);
      else if (o === ";s") s.side = n;
      else if (o === "[")
        if (t === "/" && n) s.id = n;
        else {
          s.text = (s.text ?? []).concat(n);
          continue;
        }
    }
    t = o;
  }
  return r;
}, Kt = (e) => Fr(e, Mr(e, "!")).map(no), Me = (e) => {
  const r = ro(Qn(e)), t = Mr(r, ",");
  if (!t.length) return Kt(r);
  const [o, n, s] = Fr(r, t).map(Kt);
  return { parent: o, start: n, end: s };
}, oo = ({ index: e, id: r, offset: t, temporal: o, spatial: n, text: s, side: i }) => {
  var l;
  const a = i ? `;s=${i}` : "";
  return `/${e}` + (r ? `[${qt(r)}${a}]` : "") + // "CFI expressions [..] SHOULD include an explicit character offset"
  (t != null && e % 2 ? `:${t}` : "") + (o ? `~${o}` : "") + (n ? `@${n.join(":")}` : "") + (s || !r && i ? "[" + (((l = s == null ? void 0 : s.map(qt)) == null ? void 0 : l.join(",")) ?? "") + a + "]" : "");
}, Rr = (e) => e.parent ? [e.parent, e.start, e.end].map(Rr).join(",") : e.map((r) => r.map(oo).join("")).join("!"), lt = (e) => $r(Rr(e)), ae = (e, r) => typeof e == "string" ? lt(ae(Me(e), r)) : e.parent ? Jn(e.parent, e[r ? "end" : "start"]) : e, so = (e, r) => {
  typeof e == "string" && (e = Me(e)), typeof r == "string" && (r = Me(r)), e = ae(e), r = ae(r, !0);
  const t = e[e.length - 1], o = r[r.length - 1], n = [], s = [], i = [];
  let a = !0;
  const l = Math.max(t.length, o.length);
  for (let d = 0; d < l; d++) {
    const u = t[d], h = o[d];
    a && (a = (u == null ? void 0 : u.index) === (h == null ? void 0 : h.index) && !(u != null && u.offset) && !(h != null && h.offset)), a ? n.push(u) : (u && s.push(u), h && i.push(h));
  }
  const c = e.slice(0, -1).concat([n]);
  return lt({ parent: c, start: [s], end: [i] });
}, tt = (e, r) => {
  if (typeof e == "string" && (e = Me(e)), typeof r == "string" && (r = Me(r)), e.start || r.start) return tt(ae(e), ae(r)) || tt(ae(e, !0), ae(r, !0));
  for (let t = 0; t < Math.max(e.length, r.length); t++) {
    const o = e[t] ?? [], n = r[t] ?? [], s = Math.max(o.length, n.length) - 1;
    for (let i = 0; i <= s; i++) {
      const a = o[i], l = n[i];
      if (!a) return -1;
      if (!l || a.index > l.index) return 1;
      if (a.index < l.index) return -1;
      if (i === s) {
        if (a.offset > l.offset) return 1;
        if (a.offset < l.offset) return -1;
      }
    }
  }
  return 0;
}, xt = ({ nodeType: e }) => e === 3 || e === 4, Ye = ({ nodeType: e }) => e === 1, Or = (e, r) => {
  const t = Array.from(e.childNodes).filter((o) => xt(o) || Ye(o));
  return r ? t.map((o) => {
    const n = r(o);
    return n === NodeFilter.FILTER_REJECT ? null : n === NodeFilter.FILTER_SKIP ? Or(o, r) : o;
  }).flat().filter((o) => o) : t;
}, Bt = (e, r) => {
  const t = Or(e, r).reduce((o, n) => {
    let s = o[o.length - 1];
    return s ? xt(n) ? Array.isArray(s) ? s.push(n) : xt(s) ? o[o.length - 1] = [s, n] : o.push(n) : Ye(s) ? o.push(null, n) : o.push(n) : o.push(n), o;
  }, []);
  return Ye(t[0]) && t.unshift("first"), Ye(t[t.length - 1]) && t.push("last"), t.unshift("before"), t.push("after"), t;
}, yt = (e, r, t) => {
  const { id: o } = r[r.length - 1];
  if (o) {
    const i = e.ownerDocument.getElementById(o);
    if (i) return { node: i, offset: 0 };
  }
  for (const { index: i } of r) {
    const a = e ? Bt(e, t)[i] : null;
    if (a === "first") return { node: e.firstChild ?? e };
    if (a === "last") return { node: e.lastChild ?? e };
    if (a === "before") return { node: e, before: !0 };
    if (a === "after") return { node: e, after: !0 };
    e = a;
  }
  const { offset: n } = r[r.length - 1];
  if (!Array.isArray(e)) return { node: e, offset: n };
  let s = 0;
  for (const i of e) {
    const { length: a } = i.nodeValue;
    if (s + a >= n) return { node: i, offset: n - s };
    s += a;
  }
}, rt = (e, r, t) => {
  const { parentNode: o, id: n } = e, s = Bt(o, t), i = s.findIndex((c) => Array.isArray(c) ? c.some((d) => d === e) : c === e), a = s[i];
  if (Array.isArray(a)) {
    let c = 0;
    for (const d of a)
      if (d === e) {
        c += r;
        break;
      } else c += d.nodeValue.length;
    r = c;
  }
  const l = { id: n, index: i, offset: r };
  return (o !== e.ownerDocument.documentElement ? rt(o, null, t).concat(l) : [l]).filter((c) => c.index !== -1);
}, io = (e, r) => {
  const { startContainer: t, startOffset: o, endContainer: n, endOffset: s } = e, i = rt(t, o, r);
  if (e.collapsed) return lt([i]);
  const a = rt(n, s, r);
  return so([i], [a]);
}, ao = (e, r, t) => {
  const o = ae(r), n = ae(r, !0), s = e.documentElement, i = yt(s, o[0], t), a = yt(s, n[0], t), l = e.createRange();
  return i.before ? l.setStartBefore(i.node) : i.after ? l.setStartAfter(i.node) : l.setStart(i.node, i.offset), a.before ? l.setEndBefore(a.node) : a.after ? l.setEndAfter(a.node) : l.setEnd(a.node, a.offset), l;
}, Fi = (e) => {
  const r = [], { parentNode: t } = e[0], o = rt(t);
  for (const [n, s] of Bt(t).entries()) {
    const i = e[r.length];
    s === i && r.push(lt([o.concat({ id: i.id, index: n })]));
  }
  return r;
}, $i = (e, r) => yt(e.documentElement, ae(r)).node, Yt = {
  fromIndex: (e) => $r(`/6/${(e + 1) * 2}`),
  toIndex: (e) => (e == null ? void 0 : e.at(-1).index) / 2 - 1
}, lo = (e) => {
  let r = 0;
  const t = (o) => {
    if (o.id = r++, o.subitems) for (const n of o.subitems) t(n);
  };
  for (const o of e) t(o);
  return e;
}, _r = (e) => e.map((r) => {
  var t;
  return (t = r.subitems) != null && t.length ? [r, _r(r.subitems)].flat() : r;
}).flat();
class Xt {
  async init({ toc: r, ids: t, splitHref: o, getFragment: n }) {
    lo(r);
    const s = _r(r), i = /* @__PURE__ */ new Map();
    for (const [l, c] of s.entries()) {
      const [d, u] = await o(c == null ? void 0 : c.href) ?? [], h = { fragment: u, item: c };
      i.has(d) ? i.get(d).items.push(h) : i.set(d, { prev: s[l - 1], items: [h] });
    }
    const a = /* @__PURE__ */ new Map();
    for (const [l, c] of t.entries())
      i.has(c) ? a.set(c, i.get(c)) : a.set(c, a.get(t[l - 1]));
    this.ids = t, this.map = a, this.getFragment = n;
  }
  getProgress(r, t) {
    var l;
    if (!this.ids) return;
    const o = this.ids[r], n = this.map.get(o);
    if (!n) return null;
    const { prev: s, items: i } = n;
    if (!i) return s;
    if (!t || i.length === 1 && !i[0].fragment) return i[0].item;
    const a = t.startContainer.getRootNode();
    for (const [c, { fragment: d }] of i.entries()) {
      const u = this.getFragment(a, d);
      if (u && t.comparePoint(u, 0) > 0)
        return ((l = i[c - 1]) == null ? void 0 : l.item) ?? s;
    }
    return i[i.length - 1].item;
  }
}
var ot, Hr;
class co {
  constructor(r, t, o) {
    J(this, ot);
    this.sizes = r.map((n) => n.linear != "no" && n.size > 0 ? n.size : 0), this.sizePerLoc = t, this.sizePerTimeUnit = o, this.sizeTotal = this.sizes.reduce((n, s) => n + s, 0), this.sectionFractions = q(this, ot, Hr).call(this);
  }
  // get progress given index of and fractions within a section
  getProgress(r, t, o = 0) {
    const { sizes: n, sizePerLoc: s, sizePerTimeUnit: i, sizeTotal: a } = this, l = n[r] ?? 0, d = n.slice(0, r).reduce((g, b) => g + b, 0) + t * l, u = d + o * l, h = a - d, p = (1 - t) * l;
    return {
      fraction: u / a,
      section: {
        current: r,
        total: n.length
      },
      location: {
        current: Math.floor(d / s),
        next: Math.floor(u / s),
        total: Math.ceil(a / s)
      },
      time: {
        section: p / i,
        total: h / i
      }
    };
  }
  // the inverse of `getProgress`
  // get index of and fraction in section based on total fraction
  getSection(r) {
    if (r <= 0) return [0, 0];
    if (r >= 1) return [this.sizes.length - 1, 1];
    r = r + Number.EPSILON;
    const { sizeTotal: t } = this;
    let o = this.sectionFractions.findIndex((s) => s > r) - 1;
    if (o < 0) return [0, 0];
    for (; !this.sizes[o]; ) o++;
    const n = (r - this.sectionFractions[o]) / (this.sizes[o] / t);
    return [o, n];
  }
}
ot = new WeakSet(), Hr = function() {
  const { sizeTotal: r } = this, t = [0];
  let o = 0;
  for (const n of this.sizes) t.push((o += n) / r);
  return t;
};
const oe = (e) => document.createElementNS("http://www.w3.org/2000/svg", e);
var xe, ye;
class Zt {
  constructor() {
    J(this, xe, oe("svg"));
    J(this, ye, /* @__PURE__ */ new Map());
    Object.assign(E(this, xe).style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none"
    });
  }
  get element() {
    return E(this, xe);
  }
  add(r, t, o, n) {
    E(this, ye).has(r) && this.remove(r), typeof t == "function" && (t = t(E(this, xe).getRootNode()));
    const s = t.getClientRects(), i = o(s, n);
    E(this, xe).append(i), E(this, ye).set(r, { range: t, draw: o, options: n, element: i, rects: s });
  }
  remove(r) {
    E(this, ye).has(r) && (E(this, xe).removeChild(E(this, ye).get(r).element), E(this, ye).delete(r));
  }
  redraw() {
    for (const r of E(this, ye).values()) {
      const { range: t, draw: o, options: n, element: s } = r;
      E(this, xe).removeChild(s);
      const i = t.getClientRects(), a = o(i, n);
      E(this, xe).append(a), r.element = a, r.rects = i;
    }
  }
  hitTest({ x: r, y: t }) {
    const o = Array.from(E(this, ye).entries());
    for (let n = o.length - 1; n >= 0; n--) {
      const [s, i] = o[n];
      for (const { left: a, top: l, right: c, bottom: d } of i.rects) if (l <= t && a <= r && d > t && c > r) return [s, i.range];
    }
    return [];
  }
  static underline(r, t = {}) {
    const { color: o = "red", width: n = 2, writingMode: s } = t, i = oe("g");
    if (i.setAttribute("fill", o), s === "vertical-rl" || s === "vertical-lr")
      for (const { right: a, top: l, height: c } of r) {
        const d = oe("rect");
        d.setAttribute("x", a - n), d.setAttribute("y", l), d.setAttribute("height", c), d.setAttribute("width", n), i.append(d);
      }
    else
      for (const { left: a, bottom: l, width: c } of r) {
        const d = oe("rect");
        d.setAttribute("x", a), d.setAttribute("y", l - n), d.setAttribute("height", n), d.setAttribute("width", c), i.append(d);
      }
    return i;
  }
  static strikethrough(r, t = {}) {
    const { color: o = "red", width: n = 2, writingMode: s } = t, i = oe("g");
    if (i.setAttribute("fill", o), s === "vertical-rl" || s === "vertical-lr")
      for (const { right: a, left: l, top: c, height: d } of r) {
        const u = oe("rect");
        u.setAttribute("x", (a + l) / 2), u.setAttribute("y", c), u.setAttribute("height", d), u.setAttribute("width", n), i.append(u);
      }
    else
      for (const { left: a, top: l, bottom: c, width: d } of r) {
        const u = oe("rect");
        u.setAttribute("x", a), u.setAttribute("y", (l + c) / 2), u.setAttribute("height", n), u.setAttribute("width", d), i.append(u);
      }
    return i;
  }
  static squiggly(r, t = {}) {
    const { color: o = "red", width: n = 2, writingMode: s } = t, i = oe("g");
    i.setAttribute("fill", "none"), i.setAttribute("stroke", o), i.setAttribute("stroke-width", n);
    const a = n * 1.5;
    if (s === "vertical-rl" || s === "vertical-lr")
      for (const { right: l, top: c, height: d } of r) {
        const u = oe("path"), h = Math.round(d / a / 1.5), p = d / h, g = Array.from({ length: h }, (b, m) => `l${m % 2 ? -a : a} ${p}`).join("");
        u.setAttribute("d", `M${l} ${c}${g}`), i.append(u);
      }
    else
      for (const { left: l, bottom: c, width: d } of r) {
        const u = oe("path"), h = Math.round(d / a / 1.5), p = d / h, g = Array.from({ length: h }, (b, m) => `l${p} ${m % 2 ? a : -a}`).join("");
        u.setAttribute("d", `M${l} ${c}${g}`), i.append(u);
      }
    return i;
  }
  static highlight(r, t = {}) {
    const { color: o = "red" } = t, n = oe("g");
    n.setAttribute("fill", o), n.style.opacity = "var(--overlayer-highlight-opacity, .3)", n.style.mixBlendMode = "var(--overlayer-highlight-blend-mode, normal)";
    for (const { left: s, top: i, height: a, width: l } of r) {
      const c = oe("rect");
      c.setAttribute("x", s), c.setAttribute("y", i), c.setAttribute("height", a), c.setAttribute("width", l), n.append(c);
    }
    return n;
  }
  static outline(r, t = {}) {
    const { color: o = "red", width: n = 3, radius: s = 3 } = t, i = oe("g");
    i.setAttribute("fill", "none"), i.setAttribute("stroke", o), i.setAttribute("stroke-width", n);
    for (const { left: a, top: l, height: c, width: d } of r) {
      const u = oe("rect");
      u.setAttribute("x", a), u.setAttribute("y", l), u.setAttribute("height", c), u.setAttribute("width", d), u.setAttribute("rx", s), i.append(u);
    }
    return i;
  }
  // make an exact copy of an image in the overlay
  // one can then apply filters to the entire element, without affecting them;
  // it's a bit silly and probably better to just invert images twice
  // (though the color will be off in that case if you do heu-rotate)
  static copyImage([r], t = {}) {
    const { src: o } = t, n = oe("image"), { left: s, top: i, height: a, width: l } = r;
    return n.setAttribute("href", o), n.setAttribute("x", s), n.setAttribute("y", i), n.setAttribute("height", a), n.setAttribute("width", l), n;
  }
}
xe = new WeakMap(), ye = new WeakMap();
const uo = (e, r) => {
  const t = [];
  for (let o = r.currentNode; o; o = r.nextNode()) {
    const n = e.comparePoint(o, 0);
    if (n === 0) t.push(o);
    else if (n > 0) break;
  }
  return t;
}, po = (e, r) => {
  const t = [];
  for (let o = r.nextNode(); o; o = r.nextNode()) t.push(o);
  return t;
}, ho = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_CDATA_SECTION, fo = (e) => {
  if (e.nodeType === 1) {
    const r = e.tagName.toLowerCase();
    return r === "script" || r === "style" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
  }
  return NodeFilter.FILTER_ACCEPT;
}, Jt = function* (e, r, t) {
  const o = e.commonAncestorContainer ?? e.body ?? e, n = document.createTreeWalker(o, ho, { acceptNode: t || fo }), i = (e.commonAncestorContainer ? uo : po)(e, n), a = i.map((c) => c.nodeValue), l = (c, d, u, h) => {
    const p = document.createRange();
    return p.setStart(i[c], d), p.setEnd(i[u], h), p;
  };
  for (const c of r(a, l)) yield c;
}, go = (e, r, t, o = null, n = null, s = null) => {
  const i = /* @__PURE__ */ new Set([
    "META-INF/encryption.xml",
    "META-INF/com.apple.ibooks.display-options.xml",
    "META-INF/com.kobobooks.display-options.xml",
    "META-INF/calibre_bookmarks.txt"
  ]), a = (f) => i.has(f) || /(^|\/)toc\.ncx$/i.test(f), l = Array.isArray(t == null ? void 0 : t.optionalFiles), c = l ? new Set(t.optionalFiles) : null, d = (f) => l && i.has(f) && !c.has(f), u = new Map(t.manifest.map((f) => [f.href, f])), h = (f) => {
    if (!f) return null;
    const v = f.split("/").map(encodeURIComponent).join("/");
    let w = `${r}/${e}/file/${v}`;
    const N = new URLSearchParams();
    n && N.append("bookType", n), s != null && N.append("fileId", String(s));
    const L = N.toString();
    return L && (w += `?${L}`), w;
  }, p = () => o ? {
    headers: {
      Authorization: `Bearer ${o}`
    }
  } : {};
  return {
    loadText: async (f) => {
      if (!f || d(f)) return null;
      try {
        const v = h(f), w = await fetch(v, p());
        return w.ok ? await w.text() : (w.status === 404 && !u.has(f) || w.status === 404 && a(f) || console.warn(`Failed to load text: ${f}`, w.status), null);
      } catch (v) {
        return console.error(`Error loading text ${f}:`, v), null;
      }
    },
    loadBlob: async (f, v) => {
      if (!f) return null;
      try {
        const w = h(f), N = await fetch(w, p());
        if (!N.ok)
          return console.warn(`Failed to load blob: ${f}`, N.status), null;
        const L = await N.blob();
        return v ? new Blob([L], { type: v }) : L;
      } catch (w) {
        return console.error(`Error loading blob ${f}:`, w), null;
      }
    },
    getSize: (f) => {
      if (!f) return 0;
      const v = u.get(f);
      return (v == null ? void 0 : v.size) ?? 0;
    },
    // getDirectUrl intentionally omitted: browser-initiated fetches from inside a
    // sandboxed blob-URL iframe are blocked by Cross-Origin-Resource-Policy headers.
    // Images go through loadBlob (JS fetch with Authorization header) instead.
    _bookInfo: t,
    _manifestMap: u
  };
}, Oe = "foliate-search:", bo = (e) => typeof e == "number" && Number.isFinite(e) ? Math.max(0, Math.min(100, e * 100)) : null, Qt = (e) => e ? e.nodeType === 1 ? e : e.parentElement ?? null : null, Dr = (e) => {
  var r, t;
  return e ? ((r = e.startContainer) == null ? void 0 : r.nodeType) === 3 ? { node: e.startContainer, offset: e.startOffset } : ((t = e.endContainer) == null ? void 0 : t.nodeType) === 3 ? { node: e.endContainer, offset: e.endOffset } : { node: e.startContainer, offset: e.startOffset } : null;
}, mo = (e) => {
  var s, i, a, l, c;
  if (!e) return null;
  const r = Dr(e), t = (i = (s = Qt(r == null ? void 0 : r.node)) == null ? void 0 : s.closest) == null ? void 0 : i.call(s, '.koboSpan[id^="kobo."]');
  if (t != null && t.id) return t.id;
  const o = ((a = e.commonAncestorContainer) == null ? void 0 : a.ownerDocument) ?? ((l = Qt(e.commonAncestorContainer)) == null ? void 0 : l.ownerDocument), n = ((c = o == null ? void 0 : o.querySelectorAll) == null ? void 0 : c.call(o, '.koboSpan[id^="kobo."]')) ?? [];
  for (const d of n)
    try {
      if (e.intersectsNode(d)) return d.id;
    } catch {
    }
  return null;
}, je = (e) => e ? e.nodeType === 3 ? "text()" : e.nodeType === 1 && e.localName ? e.localName : null : null, xo = (e) => {
  const r = je(e);
  if (!r) return 1;
  const o = It(ct(e)).filter((n) => n.type === "element" && je(n.node) === r).findIndex((n) => n.node === e);
  return o >= 0 ? o + 1 : 1;
}, yo = (e) => {
  const r = je(e);
  return r && It(ct(e)).filter((t) => t.type === "element" && je(t.node) === r).length || 1;
}, vo = (e) => {
  const r = je(e);
  return r ? yo(e) > 1 ? `${r}[${xo(e)}]` : r : null;
}, ko = (e) => (e == null ? void 0 : e.nodeType) === 1 && (e.id === "book-columns" || e.id === "book-inner"), wo = (e) => {
  var r;
  return (e == null ? void 0 : e.nodeType) === 1 && ((r = e.classList) == null ? void 0 : r.contains("koboSpan")) && /^kobo\./.test(e.id ?? "");
}, zt = (e) => ko(e) || wo(e), ct = (e) => {
  let r = (e == null ? void 0 : e.parentNode) ?? null;
  for (; zt(r); ) r = r.parentNode;
  return r;
}, Gr = (e, r) => {
  if (r) {
    if (zt(r)) {
      for (const t of r.childNodes) Gr(e, t);
      return;
    }
    if (r.nodeType === 3) {
      const t = e.at(-1);
      if ((t == null ? void 0 : t.type) === "text") {
        t.nodes.push(r);
        return;
      }
      e.push({ type: "text", nodes: [r] });
      return;
    }
    r.nodeType === 1 && e.push({ type: "element", node: r });
  }
}, It = (e) => {
  const r = [];
  for (const t of (e == null ? void 0 : e.childNodes) ?? []) Gr(r, t);
  return r;
}, So = (e) => {
  if (!e) return null;
  const r = e.ownerDocument ?? (e.nodeType === 9 ? e : null), t = r == null ? void 0 : r.body;
  if (!t) return null;
  const o = [];
  let n = e;
  for (; n; ) {
    if (n === t)
      return o.unshift("body"), `/${o.join("/")}`;
    if (!zt(n)) {
      const s = vo(n);
      if (!s) return null;
      o.unshift(s);
    }
    n = ct(n);
  }
  return null;
}, Eo = (e) => {
  var o, n;
  if (((o = e == null ? void 0 : e.node) == null ? void 0 : o.nodeType) !== 3) return null;
  const r = ct(e.node);
  if (!r) return null;
  const t = It(r).filter((s) => s.type === "text");
  for (const [s, i] of t.entries()) {
    let a = 0;
    for (const l of i.nodes) {
      if (l === e.node)
        return {
          parent: r,
          index: s + 1,
          count: t.length,
          offset: a + (Number.isFinite(e.offset) ? e.offset : 0)
        };
      a += ((n = l.nodeValue) == null ? void 0 : n.length) ?? 0;
    }
  }
  return null;
}, Co = (e) => typeof (e == null ? void 0 : e.id) != "string" ? null : e.id.split(/[?#]/)[0].split("/").pop() ?? null, er = (e) => Co(e) === "kepubify-titlepage-dummy.xhtml", Ao = (e, r) => {
  if (!Array.isArray(e) || typeof r != "number") return null;
  const t = e[r];
  if (!t || er(t)) return null;
  let o = 0;
  for (let n = 0; n <= r && n < e.length; n += 1)
    er(e[n]) || (o += 1);
  return o || null;
}, To = (e, r) => {
  if (!r || typeof e != "number") return null;
  const t = Dr(r);
  if (!t) return null;
  const o = Eo(t);
  if (!o) return null;
  const n = So(o.parent);
  if (!n) return null;
  const s = o.count > 1 ? `text()[${o.index}]` : "text()";
  return `/body/DocFragment[${e}]${n}/${s}.${o.offset}`;
}, Lo = async (e) => {
  const r = new Uint8Array(await e.slice(0, 4).arrayBuffer());
  return r[0] === 80 && r[1] === 75 && r[2] === 3 && r[3] === 4;
}, No = async (e) => {
  const r = new Uint8Array(await e.slice(0, 5).arrayBuffer());
  return r[0] === 37 && r[1] === 80 && r[2] === 68 && r[3] === 70 && r[4] === 45;
}, Bo = ({ name: e, type: r }) => r === "application/vnd.comicbook+zip" || e.endsWith(".cbz"), zo = async (e) => {
  const { name: r, type: t } = e;
  if (console.log("[isFB2] name:", r, "type:", t), t === "application/x-fictionbook+xml" || r && r.endsWith(".fb2"))
    return !0;
  try {
    const o = new Uint8Array(await e.slice(0, 5).arrayBuffer());
    if (o[0] === 60 && o[1] === 63 && o[2] === 120 && o[3] === 109 && o[4] === 108)
      return console.log("[isFB2] Detected FB2 XML signature in file content"), !0;
  } catch (o) {
    console.error("[isFB2] Error reading file content:", o);
  }
  return !1;
}, Io = ({ name: e, type: r }) => r === "application/x-zip-compressed-fb2" || e.endsWith(".fb2.zip") || e.endsWith(".fbz"), Po = async (e) => {
  const { configure: r, ZipReader: t, BlobReader: o, TextWriter: n, BlobWriter: s } = await import("./zip-DYE5jiUF.js");
  r({ useWebWorkers: !1 });
  const a = await new t(new o(e)).getEntries(), l = new Map(a.map((p) => [p.filename, p])), c = (p) => (g, ...b) => l.has(g) ? p(l.get(g), ...b) : null, d = c((p) => p.getData(new n())), u = c((p, g) => p.getData(new s(g)));
  return { entries: a, loadText: d, loadBlob: u, getSize: (p) => {
    var g;
    return ((g = l.get(p)) == null ? void 0 : g.uncompressedSize) ?? 0;
  } };
}, jr = async (e) => e.isFile ? e : (await Promise.all(
  Array.from(
    await new Promise(
      (r, t) => e.createReader().readEntries(
        (o) => r(o),
        (o) => t(o)
      )
    ),
    jr
  )
)).flat(), Fo = async (e) => {
  const r = await jr(e), t = await Promise.all(
    r.map(
      (d) => new Promise(
        (u, h) => d.file(
          (p) => u([p, d.fullPath]),
          (p) => h(p)
        )
      )
    )
  ), o = new Map(t.map(([d, u]) => [u.replace(e.fullPath + "/", ""), d])), n = new TextDecoder(), s = (d) => d ? n.decode(d) : null, i = (d) => {
    var u;
    return ((u = o.get(d)) == null ? void 0 : u.arrayBuffer()) ?? null;
  };
  return { loadText: async (d) => s(await i(d)), loadBlob: (d) => o.get(d), getSize: (d) => {
    var u;
    return ((u = o.get(d)) == null ? void 0 : u.size) ?? 0;
  } };
};
class $o extends Error {
}
class Mo extends Error {
}
class Ro extends Error {
}
const Oo = async (e) => {
  const r = await fetch(e);
  if (!r.ok) throw new $o(`${r.status} ${r.statusText}`, { cause: r });
  return new File([await r.blob()], new URL(r.url).pathname);
}, _o = async (e) => {
  typeof e == "string" && (e = await Oo(e));
  let r;
  if (e.isDirectory) {
    const t = await Fo(e), { EPUB: o } = await import("./epub-DevfktxG.js");
    r = await new o(t).init();
  } else if (e.size) if (await Lo(e)) {
    const t = await Po(e);
    if (Bo(e)) {
      const { makeComicBook: o } = await import("./comic-book-CFGkssgs.js");
      r = o(t, e);
    } else if (Io(e)) {
      const { makeFB2: o } = await import("./fb2-C35PDn_9.js"), { entries: n } = t, s = n.find((a) => a.filename.endsWith(".fb2")), i = await t.loadBlob((s ?? n[0]).filename);
      r = await o(i);
    } else {
      const { EPUB: o } = await import("./epub-DevfktxG.js");
      r = await new o(t).init();
    }
  } else if (await No(e)) {
    const t = "./pdf.js", { makePDF: o } = await import(t);
    r = await o(e);
  } else {
    const { isMOBI: t, MOBI: o } = await import("./mobi-BTL-eN-z.js");
    if (await t(e)) {
      const n = await import("./fflate-Cq_OVrsP.js");
      r = await new o({ unzlib: n.unzlibSync }).open(e);
    } else if (zo(e)) {
      const { makeFB2: n } = await import("./fb2-C35PDn_9.js");
      r = await n(e);
    }
  }
  else throw new Mo("File not found");
  if (!r) throw new Ro("File type not supported");
  return r;
}, Ho = async (e, r, t, o = null, n = null, s = null) => {
  const i = go(e, r, t, o, n, s), { EPUB: a } = await import("./epub-DevfktxG.js");
  return new a(i).init();
};
var $e, Be, We, ce;
const Rt = class Rt {
  constructor(r, t, o = {}) {
    J(this, $e);
    J(this, Be);
    J(this, We);
    J(this, ce);
    Q(this, Be, r), Q(this, We, t), Q(this, ce, o), E(this, ce).hidden && this.hide(), E(this, Be).addEventListener(
      "mousemove",
      ({ screenX: n, screenY: s }) => {
        n === E(this, ce).x && s === E(this, ce).y || (E(this, ce).x = n, E(this, ce).y = s, this.show(), E(this, $e) && clearTimeout(E(this, $e)), t() && Q(this, $e, setTimeout(this.hide.bind(this), 1e3)));
      },
      !1
    );
  }
  cloneFor(r) {
    return new Rt(r, E(this, We), E(this, ce));
  }
  hide() {
    E(this, Be).style.cursor = "none", E(this, ce).hidden = !0;
  }
  show() {
    E(this, Be).style.removeProperty("cursor"), E(this, ce).hidden = !1;
  }
};
$e = new WeakMap(), Be = new WeakMap(), We = new WeakMap(), ce = new WeakMap();
let vt = Rt;
var de, ie;
class Do extends EventTarget {
  constructor() {
    super(...arguments);
    J(this, de, []);
    J(this, ie, -1);
  }
  pushState(t) {
    const o = E(this, de)[E(this, ie)];
    o === t || o != null && o.fraction && o.fraction === t.fraction || (E(this, de)[++Vt(this, ie)._] = t, E(this, de).length = E(this, ie) + 1, this.dispatchEvent(new Event("index-change")));
  }
  replaceState(t) {
    const o = E(this, ie);
    E(this, de)[o] = t;
  }
  back() {
    const t = E(this, ie);
    if (t <= 0) return;
    const o = { state: E(this, de)[t - 1] };
    Q(this, ie, t - 1), this.dispatchEvent(new CustomEvent("popstate", { detail: o })), this.dispatchEvent(new Event("index-change"));
  }
  forward() {
    const t = E(this, ie);
    if (t >= E(this, de).length - 1) return;
    const o = { state: E(this, de)[t + 1] };
    Q(this, ie, t + 1), this.dispatchEvent(new CustomEvent("popstate", { detail: o })), this.dispatchEvent(new Event("index-change"));
  }
  get canGoBack() {
    return E(this, ie) > 0;
  }
  get canGoForward() {
    return E(this, ie) < E(this, de).length - 1;
  }
  clear() {
    Q(this, de, []), Q(this, ie, -1);
  }
}
de = new WeakMap(), ie = new WeakMap();
const Go = (e) => {
  var r, t;
  if (!e) return {};
  try {
    const o = Intl.getCanonicalLocales(e)[0], n = new Intl.Locale(o), s = ["zh", "ja", "kr"].includes(n.language), i = (t = ((r = n.getTextInfo) == null ? void 0 : r.call(n)) ?? n.textInfo) == null ? void 0 : t.direction;
    return { canonical: o, locale: n, isCJK: s, direction: i };
  } catch (o) {
    return console.warn(o), {};
  }
};
var st, Ce, fe, Ne, Ae, it, G, Ee, Wr, Ur, Vr, Xe, qr, Kr, Yr;
class jo extends HTMLElement {
  constructor() {
    super();
    J(this, G);
    J(this, st, this.attachShadow({ mode: "closed" }));
    J(this, Ce);
    J(this, fe);
    J(this, Ne);
    J(this, Ae, /* @__PURE__ */ new Map());
    J(this, it, new vt(this, () => this.hasAttribute("autohide-cursor")));
    T(this, "isFixedLayout", !1);
    T(this, "lastLocation");
    T(this, "history", new Do());
    this.history.addEventListener("popstate", ({ detail: t }) => {
      const o = this.resolveNavigation(t.state);
      this.renderer.goTo(o);
    });
  }
  async open(t) {
    var o, n;
    if ((typeof t == "string" || typeof t.arrayBuffer == "function" || t.isDirectory) && (t = await _o(t)), this.book = t, this.language = Go((o = t.metadata) == null ? void 0 : o.language), t.splitTOCHref && t.getTOCFragment) {
      const s = t.sections.map((l) => l.id);
      Q(this, Ce, new co(t.sections, 1500, 1600));
      const i = t.splitTOCHref.bind(t), a = t.getTOCFragment.bind(t);
      Q(this, fe, new Xt()), await E(this, fe).init({
        toc: t.toc ?? [],
        ids: s,
        splitHref: i,
        getFragment: a
      }), Q(this, Ne, new Xt()), await E(this, Ne).init({
        toc: t.pageList ?? [],
        ids: s,
        splitHref: i,
        getFragment: a
      });
    }
    if (this.isFixedLayout = ((n = this.book.rendition) == null ? void 0 : n.layout) === "pre-paginated", this.isFixedLayout ? (await import("./fixed-layout-CmKgjWz_.js"), this.renderer = document.createElement("foliate-fxl")) : (await import("./paginator-mWbe4Oik.js"), this.renderer = document.createElement("foliate-paginator")), this.renderer.setAttribute("exportparts", "head,foot,filter"), this.renderer.addEventListener("load", (s) => q(this, G, Ur).call(this, s.detail)), this.renderer.addEventListener("relocate", (s) => q(this, G, Wr).call(this, s.detail)), this.renderer.addEventListener("create-overlayer", (s) => s.detail.attach(q(this, G, qr).call(this, s.detail))), this.renderer.open(t), E(this, st).append(this.renderer), t.sections.some((s) => s.mediaOverlay)) {
      const s = t.media.activeClass, i = t.media.playbackActiveClass;
      this.mediaOverlay = t.getMediaOverlay();
      let a;
      this.mediaOverlay.addEventListener("highlight", (l) => {
        const c = this.resolveNavigation(l.detail.text), d = () => {
          const u = this.renderer.getContents().find((p) => p.index === c.index);
          if (!u) return;
          const h = c.anchor(u.doc);
          h.classList.add(s), i && h.ownerDocument.documentElement.classList.add(i), a = new WeakRef(h);
        };
        if (this.pauseNarrationFollow) {
          d();
          return;
        }
        this._narrationNav = !0, this.renderer.goTo(c).then(d).catch(() => {
        }).finally(() => {
          this._narrationNav = !1;
        });
      }), this.mediaOverlay.addEventListener("unhighlight", () => {
        const l = a == null ? void 0 : a.deref();
        l && (l.classList.remove(s), i && l.ownerDocument.documentElement.classList.remove(i));
      });
    }
  }
  close() {
    var t, o;
    (t = this.renderer) == null || t.destroy(), (o = this.renderer) == null || o.remove(), Q(this, Ce, null), Q(this, fe, null), Q(this, Ne, null), Q(this, Ae, /* @__PURE__ */ new Map()), this.lastLocation = null, this.history.clear(), this.tts = null, this.mediaOverlay = null;
  }
  goToTextStart() {
    var t, o;
    return this.goTo(
      ((o = (t = this.book.landmarks) == null ? void 0 : t.find((n) => n.type.includes("bodymatter") || n.type.includes("text"))) == null ? void 0 : o.href) ?? this.book.sections.findIndex((n) => n.linear !== "no")
    );
  }
  async init({ lastLocation: t, showTextStart: o }) {
    const n = t ? this.resolveNavigation(t) : null;
    n ? (await this.renderer.goTo(n), this.history.pushState(t)) : o ? await this.goToTextStart() : (this.history.pushState(0), await this.next());
  }
  async addAnnotation(t, o) {
    var c;
    const { value: n } = t;
    if (n.startsWith(Oe)) {
      const d = n.replace(Oe, ""), { index: u, anchor: h } = await this.resolveNavigation(d), p = q(this, G, Xe).call(this, u);
      if (p) {
        const { overlayer: g, doc: b } = p;
        if (o) {
          g.remove(n);
          return;
        }
        const m = b ? h(b) : h;
        g.add(n, m, Zt.outline);
      }
      return;
    }
    const { index: s, anchor: i } = await this.resolveNavigation(n), a = q(this, G, Xe).call(this, s);
    if (a) {
      const { overlayer: d, doc: u } = a;
      if (d.remove(n), !o) {
        const h = u ? i(u) : i, p = (g, b) => d.add(n, h, g, b);
        q(this, G, Ee).call(this, "draw-annotation", { draw: p, annotation: t, doc: u, range: h });
      }
    }
    const l = ((c = E(this, fe).getProgress(s)) == null ? void 0 : c.label) ?? "";
    return { index: s, label: l };
  }
  deleteAnnotation(t) {
    return this.addAnnotation(t, !0);
  }
  async showAnnotation(t) {
    const { value: o } = t, n = await this.goTo(o);
    if (n) {
      const { index: s, anchor: i } = n, { doc: a } = q(this, G, Xe).call(this, s), l = i(a);
      q(this, G, Ee).call(this, "show-annotation", { value: o, index: s, range: l });
    }
  }
  getCFI(t, o) {
    const n = this.book.sections[t].cfi ?? Yt.fromIndex(t);
    return o ? to(n, io(o)) : n;
  }
  resolveCFI(t) {
    if (this.book.resolveCFI) return this.book.resolveCFI(t);
    {
      const o = Me(t);
      return { index: Yt.toIndex((o.parent ?? o).shift()), anchor: (i) => ao(i, o) };
    }
  }
  resolveNavigation(t) {
    try {
      if (typeof t == "number") return { index: t };
      if (typeof t.fraction == "number") {
        const [o, n] = E(this, Ce).getSection(t.fraction);
        return { index: o, anchor: n };
      }
      return at.test(t) ? this.resolveCFI(t) : this.book.resolveHref(t);
    } catch (o) {
      console.error(o), console.error(`Could not resolve target ${t}`);
    }
  }
  async goTo(t) {
    var i, a;
    const o = this.resolveNavigation(t), n = (l) => {
      var d, u;
      const c = ((u = (d = this.renderer).getContents) == null ? void 0 : u.call(d)) ?? [];
      return c.length ? typeof (l == null ? void 0 : l.index) != "number" ? !0 : c.some((h) => (h == null ? void 0 : h.index) === l.index) : !1;
    }, s = async (l) => {
      try {
        return await this.renderer.goTo(l), n(l);
      } catch (c) {
        return console.warn(c), !1;
      }
    };
    try {
      let l = await s(o), c = t, d = o;
      if (!l && typeof (o == null ? void 0 : o.index) == "number") {
        const u = ((a = (i = this.book) == null ? void 0 : i.sections) == null ? void 0 : a.length) ?? 0;
        for (let h = o.index + 1; h < u; h++)
          if (l = await s({ index: h }), l) {
            c = h, d = { index: h }, console.warn(`Skipped unreadable section ${o.index}, opened section ${h}`);
            break;
          }
        if (!l) {
          for (let h = o.index - 1; h >= 0; h--)
            if (l = await s({ index: h }), l) {
              c = h, d = { index: h }, console.warn(`Skipped unreadable section ${o.index}, opened section ${h}`);
              break;
            }
        }
      }
      if (!l) throw new Error(`Could not open section for target ${t}`);
      return this.history.pushState(c), d;
    } catch (l) {
      console.error(l), console.error(`Could not go to ${t}`);
    }
  }
  async goToFraction(t) {
    const [o, n] = E(this, Ce).getSection(t);
    await this.renderer.goTo({ index: o, anchor: n }), this.history.pushState({ fraction: t });
  }
  async select(t) {
    try {
      const o = await this.resolveNavigation(t);
      await this.renderer.goTo({ ...o, select: !0 }), this.history.pushState(t);
    } catch (o) {
      console.error(o), console.error(`Could not go to ${t}`);
    }
  }
  deselect() {
    for (const { doc: t } of this.renderer.getContents()) t.defaultView.getSelection().removeAllRanges();
  }
  getSectionFractions() {
    var t;
    return (((t = E(this, Ce)) == null ? void 0 : t.sectionFractions) ?? []).map((o) => o + Number.EPSILON);
  }
  getProgressOf(t, o) {
    var i, a;
    const n = (i = E(this, fe)) == null ? void 0 : i.getProgress(t, o), s = (a = E(this, Ne)) == null ? void 0 : a.getProgress(t, o);
    return { tocItem: n, pageItem: s };
  }
  async getTOCItemOf(t) {
    try {
      const { index: o, anchor: n } = await this.resolveNavigation(t), s = await this.book.sections[o].createDocument(), i = n(s), a = i instanceof Range, l = a ? i : s.createRange();
      return a || l.selectNodeContents(i), E(this, fe).getProgress(o, l);
    } catch (o) {
      console.error(o), console.error(`Could not get ${t}`);
    }
  }
  async prev(t) {
    await this.renderer.prev(t);
  }
  async next(t) {
    await this.renderer.next(t);
  }
  goLeft() {
    return this.book.dir === "rtl" ? this.next() : this.prev();
  }
  goRight() {
    return this.book.dir === "rtl" ? this.prev() : this.next();
  }
  async *search(t) {
    var c;
    this.clearSearch();
    const { searchMatcher: o } = await import("./search-B5o8p515.js"), { query: n, index: s } = t, i = o(Jt, { defaultLocale: this.language, ...t }), a = s != null ? q(this, G, Kr).call(this, i, n, s) : q(this, G, Yr).call(this, i, n), l = [];
    E(this, Ae).set(s, l);
    for await (const d of a)
      if (d.subitems) {
        const u = d.subitems.map(({ cfi: h }) => ({ value: Oe + h }));
        E(this, Ae).set(d.index, u);
        for (const h of u) this.addAnnotation(h);
        yield {
          label: ((c = E(this, fe).getProgress(d.index)) == null ? void 0 : c.label) ?? "",
          subitems: d.subitems
        };
      } else {
        if (d.cfi) {
          const u = { value: Oe + d.cfi };
          l.push(u), this.addAnnotation(u);
        }
        yield d;
      }
    yield "done";
  }
  clearSearch() {
    for (const t of E(this, Ae).values()) for (const o of t) this.deleteAnnotation(o);
    E(this, Ae).clear();
  }
  async initTTS(t = "word", o) {
    const n = this.renderer.getContents()[0].doc;
    if (this.tts && this.tts.doc === n) return;
    const { TTS: s } = await import("./tts-CwKuZ_aa.js");
    this.tts = new s(n, Jt, o || ((i) => this.renderer.scrollToAnchor(i, !0)), t);
  }
  startMediaOverlay() {
    const { index: t } = this.renderer.getContents()[0];
    return this.mediaOverlay.start(t);
  }
}
st = new WeakMap(), Ce = new WeakMap(), fe = new WeakMap(), Ne = new WeakMap(), Ae = new WeakMap(), it = new WeakMap(), G = new WeakSet(), Ee = function(t, o, n) {
  return this.dispatchEvent(new CustomEvent(t, { detail: o, cancelable: n }));
}, Wr = function({ reason: t, range: o, index: n, fraction: s, size: i }) {
  var f, v, w, N;
  const a = ((f = E(this, Ce)) == null ? void 0 : f.getProgress(n, s, i)) ?? {}, l = (v = E(this, fe)) == null ? void 0 : v.getProgress(n, o), c = (w = E(this, Ne)) == null ? void 0 : w.getProgress(n, o), d = this.getCFI(n, o), u = ((N = this.book.sections[n]) == null ? void 0 : N.id) ?? null, h = bo(s), p = mo(o), g = p ? "KoboSpan" : null, b = Ao(this.book.sections, n), m = To(b, o);
  this.lastLocation = {
    ...a,
    tocItem: l,
    pageItem: c,
    cfi: d,
    range: o,
    source: u,
    koboLocationType: g,
    koboLocationValue: p,
    contentSourceProgressPercent: h,
    koreaderProgress: m
  }, (t === "snap" || t === "page" || t === "scroll") && this.history.replaceState(d), q(this, G, Ee).call(this, "relocate", this.lastLocation);
}, Ur = function({ doc: t, index: o }) {
  var n, s;
  (n = t.documentElement).lang || (n.lang = this.language.canonical ?? ""), this.language.isCJK || (s = t.documentElement).dir || (s.dir = this.language.direction ?? ""), q(this, G, Vr).call(this, t, o), E(this, it).cloneFor(t.documentElement), q(this, G, Ee).call(this, "load", { doc: t, index: o });
}, Vr = function(t, o) {
  const { book: n } = this, s = n.sections[o];
  t.addEventListener("click", (i) => {
    var d, u;
    const a = i.target.closest("a[href]");
    if (!a) return;
    i.preventDefault();
    const l = a.getAttribute("href"), c = ((d = s == null ? void 0 : s.resolveHref) == null ? void 0 : d.call(s, l)) ?? l;
    (u = n == null ? void 0 : n.isExternal) != null && u.call(n, c) ? Promise.resolve(q(this, G, Ee).call(this, "external-link", { a, href: c }, !0)).then((h) => h ? globalThis.open(c, "_blank") : null).catch((h) => console.error(h)) : Promise.resolve(q(this, G, Ee).call(this, "link", { a, href: c }, !0)).then((h) => h ? this.goTo(c) : null).catch((h) => console.error(h));
  });
}, Xe = function(t) {
  return this.renderer.getContents().find((o) => o.index === t && o.overlayer);
}, qr = function({ doc: t, index: o }) {
  const n = new Zt();
  t.addEventListener(
    "click",
    (i) => {
      const [a, l] = n.hitTest(i);
      a && !a.startsWith(Oe) && q(this, G, Ee).call(this, "show-annotation", { value: a, index: o, range: l });
    },
    !1
  );
  const s = E(this, Ae).get(o);
  if (s) for (const i of s) this.addAnnotation(i);
  return q(this, G, Ee).call(this, "create-overlay", { index: o }), n;
}, Kr = async function* (t, o, n) {
  const s = await this.book.sections[n].createDocument();
  for (const { range: i, excerpt: a } of t(s, o)) yield { cfi: this.getCFI(n, i), excerpt: a };
}, Yr = async function* (t, o) {
  const { sections: n } = this.book;
  for (const [s, { createDocument: i }] of n.entries()) {
    if (!i) continue;
    const a = await i(), l = Array.from(t(a, o), ({ range: d, excerpt: u }) => ({ cfi: this.getCFI(s, d), excerpt: u }));
    yield { progress: (s + 1) / n.length }, l.length && (yield { index: s, subitems: l });
  }
};
customElements.define("foliate-view", jo);
window.makeStreamingBook = Ho;
function Pt(e) {
  return Array.isArray(e) ? e.map((r) => ({
    label: typeof (r == null ? void 0 : r.label) == "string" ? r.label.trim() : "",
    href: (r == null ? void 0 : r.href) ?? null,
    subitems: Pt(r == null ? void 0 : r.subitems)
  })) : [];
}
const dt = "-epub-media-overlay-active", Ft = "rgba(255, 214, 10, 0.4)", Xr = 1e4, Zr = "data-reactor-narration", Wo = "http://www.w3.org/ns/SMIL", tr = 6;
function kt(e) {
  if (!e) return;
  const r = e.split(":").map((i) => parseFloat(i));
  if (r.length === 3) {
    const [i, a, l] = r;
    return i * 60 * 60 + a * 60 + l;
  }
  if (r.length === 2) {
    const [i, a] = r;
    return i * 60 + a;
  }
  const t = /^([\d.]+)([a-z]*)$/i.exec(e);
  if (!t) return parseFloat(e) || 0;
  const o = parseFloat(t[1] ?? ""), n = t[2], s = n === "h" ? 60 * 60 : n === "min" ? 60 : n === "ms" ? 1e-3 : 1;
  return o * s;
}
function wt(e, r) {
  if (!e) return null;
  try {
    if (r.includes(":")) return new URL(e, r).href;
    const t = "https://invalid.invalid/", o = new URL(e, t + r);
    return o.search = "", decodeURI(o.href.replace(t, ""));
  } catch {
    return e;
  }
}
async function St(e, r) {
  const t = r == null ? void 0 : r.mediaOverlay;
  if (!(t != null && t.href)) return [];
  let o;
  try {
    o = await e.loadText(t.href);
  } catch {
    return [];
  }
  if (!o) return [];
  let n;
  try {
    n = new DOMParser().parseFromString(o, "application/xml");
  } catch {
    return [];
  }
  if (n.getElementsByTagName("parsererror").length) return [];
  let s = [...n.getElementsByTagNameNS(Wo, "par")];
  s.length === 0 && (s = [...n.getElementsByTagName("par")]);
  const i = [];
  for (const a of s) {
    const l = [...a.children], c = l.find((m) => m.localName === "text"), d = l.find((m) => m.localName === "audio");
    if (!c || !d) continue;
    const u = wt(c.getAttribute("src"), t.href), h = wt(d.getAttribute("src"), t.href);
    if (!u || !h) continue;
    const p = kt(d.getAttribute("clipBegin")) ?? 0, g = d.getAttribute("clipEnd"), b = g ? kt(g) ?? null : null;
    i.push({ textHref: u, audioSrc: h, beginSec: p, endSec: b });
  }
  return i;
}
class Jr {
  constructor() {
    T(this, "sectionSmilCache", /* @__PURE__ */ new WeakMap());
    T(this, "prepareToken", 0);
    T(this, "lastManualNavAt", -1 / 0);
  }
  /** Bumps on a new `narrationPrepare` or a `narrationCancelPrepare`; the returned token lets the
   * caller detect a `buildTimeline` run abandoned by a newer prepare/cancel before it resolves. */
  nextPrepareToken() {
    return ++this.prepareToken;
  }
  cancelPrepare() {
    this.prepareToken++;
  }
  isCurrentPrepareToken(r) {
    return r === this.prepareToken;
  }
  markManualNav(r) {
    this.lastManualNavAt = r;
  }
  /** Whether narration's auto-follow should stay paused given `now` (performance.now()-like). */
  isFollowPaused(r) {
    return r - this.lastManualNavAt < Xr;
  }
  /** Builds the whole book's narration timeline by parsing every section's SMIL file, in natural
   * reading order. Results are assembled in section order regardless of fetch completion order. */
  async buildTimeline(r) {
    var u, h, p, g, b, m;
    const { book: t } = r, o = t.sections ?? [], n = [], s = /* @__PURE__ */ new Map(), i = [];
    for (let f = 0; f < o.length; f++)
      (h = (u = o[f]) == null ? void 0 : u.mediaOverlay) != null && h.href && i.push(f);
    const a = /* @__PURE__ */ new Map();
    for (let f = 0; f < i.length; f += tr) {
      const v = i.slice(f, f + tr), w = await Promise.all(v.map((N) => St(t, o[N])));
      v.forEach((N, L) => a.set(N, w[L] ?? []));
    }
    const l = [];
    for (const f of i)
      for (const v of a.get(f) ?? []) {
        let w = s.get(v.audioSrc);
        w === void 0 && (w = n.length, n.push(v.audioSrc), s.set(v.audioSrc, w)), l.push({ sectionIndex: f, textHref: v.textHref, beginSec: v.beginSec, endSec: v.endSec, audioIndex: w });
      }
    if (l.length === 0 || n.length === 0) return null;
    const c = r.currentSectionHref ? o.findIndex((f) => f.id === r.currentSectionHref) : -1;
    let d = c >= 0 ? Et(l, c, r.currentRange) : null;
    if (!d && c >= 0)
      for (let f = c; f < o.length && !d; f++)
        d = ((p = l.find((v) => v.sectionIndex === f)) == null ? void 0 : p.textHref) ?? null;
    return d || (d = ((g = l[0]) == null ? void 0 : g.textHref) ?? ""), {
      audioSrcs: n,
      items: l,
      activeClass: ((b = t.media) == null ? void 0 : b.activeClass) || dt,
      playbackActiveClass: ((m = t.media) == null ? void 0 : m.playbackActiveClass) || null,
      startTextHref: d
    };
  }
  /** `{ fragment, sectionIndex }` of the first narrated sentence on the page in [range], or null
   * for a section without media overlays. */
  async narrationLocator(r, t, o) {
    var a, l;
    const n = typeof t == "number" ? (a = r.sections) == null ? void 0 : a[t] : void 0;
    if (!((l = n == null ? void 0 : n.mediaOverlay) != null && l.href)) return null;
    let s = this.sectionSmilCache.get(n);
    s || (s = (await St(r, n)).map((c) => ({ ...c, sectionIndex: t })), this.sectionSmilCache.set(n, s));
    const i = Et(s, t, o);
    return i ? { fragment: i, sectionIndex: t } : null;
  }
}
function Et(e, r, t) {
  var n;
  const o = (n = t == null ? void 0 : t.startContainer) == null ? void 0 : n.ownerDocument;
  if (!t || !o) return null;
  for (const s of e) {
    if (s.sectionIndex !== r) continue;
    const i = s.textHref.indexOf("#");
    if (i < 0) continue;
    const a = o.getElementById(decodeURIComponent(s.textHref.slice(i + 1)));
    if (a)
      try {
        if (t.comparePoint(a, a.childNodes.length) >= 0) return s.textHref;
      } catch {
      }
  }
  return null;
}
function Qr(e) {
  return [...new Set([dt, e].filter((t) => !!t))].map((t) => `.${CSS.escape(t)}`).join(", ");
}
function en(e, r) {
  var t;
  if (!(!r || !e))
    try {
      if ([...e.styleSheets].some((s) => {
        try {
          return [...s.cssRules].some(
            (i) => typeof i.selectorText == "string" && i.selectorText.includes(`.${r}`)
          );
        } catch {
          return !1;
        }
      })) return;
      const n = e.createElement("style");
      n.setAttribute(Zr, "1"), n.textContent = `.${r} { background-color: ${Ft}; border-radius: 2px; }`, (t = e.head) == null || t.appendChild(n);
    } catch {
    }
}
const Ct = [
  { name: "default", light: { fg: "#000000", bg: "#ffffff", link: "#0066cc" }, dark: { fg: "#e0e0e0", bg: "#222222", link: "#77bbee" } },
  { name: "gray", light: { fg: "#222222", bg: "#e0e0e0", link: "#4488cc" }, dark: { fg: "#c6c6c6", bg: "#444444", link: "#88ccee" } },
  { name: "sepia", light: { fg: "#5b4636", bg: "#f1e8d0", link: "#008b8b" }, dark: { fg: "#ffd595", bg: "#342e25", link: "#48d1cc" } },
  { name: "crimson", light: { fg: "#2f1f25", bg: "#fdf1f4", link: "#dd0031" }, dark: { fg: "#f3dbe2", bg: "#3a252d", link: "#ff5a86" } },
  { name: "meadow", light: { fg: "#232c16", bg: "#d7dbbd", link: "#177b4d" }, dark: { fg: "#d8deba", bg: "#333627", link: "#a6d608" } },
  { name: "rosewood", light: { fg: "#4e1609", bg: "#f0d1d5", link: "#de3838" }, dark: { fg: "#e5c4c8", bg: "#462f32", link: "#ff646e" } },
  { name: "azure", light: { fg: "#262d48", bg: "#cedef5", link: "#2d53e5" }, dark: { fg: "#babee1", bg: "#282e47", link: "#ff646e" } },
  { name: "dawnlight", light: { fg: "#586e75", bg: "#fdf6e3", link: "#268bd2" }, dark: { fg: "#93a1a1", bg: "#002b36", link: "#268bd2" } },
  { name: "ember", light: { fg: "#3c3836", bg: "#fbf1c7", link: "#076678" }, dark: { fg: "#ebdbb2", bg: "#282828", link: "#83a598" } },
  { name: "aurora", light: { fg: "#2e3440", bg: "#eceff4", link: "#5e81ac" }, dark: { fg: "#d8dee9", bg: "#2e3440", link: "#88c0d0" } },
  { name: "ocean", light: { fg: "#0a4d4d", bg: "#e0f7fa", link: "#00838f" }, dark: { fg: "#b2dfdb", bg: "#263238", link: "#4dd0e1" } },
  { name: "mist", light: { fg: "#4a148c", bg: "#f3e5f5", link: "#7b1fa2" }, dark: { fg: "#c7b6dd", bg: "#3a3150", link: "#b39ddb" } },
  { name: "amoled", light: { fg: "#000000", bg: "#ffffff", link: "#0066cc" }, dark: { fg: "#ffffff", bg: "#000000", link: "#77bbee" } }
], tn = {
  fontSize: 16,
  lineHeight: 1.5,
  fontFamily: null,
  paragraphSpacing: 0,
  maxColumnCount: 2,
  gap: 0.05,
  maxInlineSize: 720,
  maxBlockSize: 1440,
  justify: !0,
  hyphenate: !0,
  isDark: !1,
  themeName: "default",
  flow: "paginated",
  useBookLayout: !0,
  marginTop: 40,
  marginBottom: 40,
  marginLeft: 40,
  marginRight: 40,
  linkSideMargins: !0
};
function Ze(e, r) {
  return { ...tn, ...e ?? r ?? {} };
}
function rn(e) {
  return Ct.find((r) => r.name === e) ?? Ct[0];
}
function nn(e, r) {
  const t = rn(e.themeName), o = e.isDark || e.themeName === "amoled", n = o ? t.dark : t.light, s = o || t.light.bg !== "#ffffff";
  return `
    @namespace epub "http://www.idpf.org/2007/ops";
    @media print { html { column-width: auto !important; height: auto !important; width: auto !important; } }
    @media screen {
      html { color-scheme: ${o ? "dark" : "light"}; color: ${n.fg}; }
      a:any-link { color: ${n.link}; text-underline-offset: .1em; }
      aside[epub|type~="footnote"] { display: none; }
    }
    ${s ? `html, body { color: ${n.fg} !important; background: none !important; }
           /* A dark color-scheme iframe in a light host gets Chromium's opaque #121212 canvas, which shows in the column padding. */
           html { background: ${n.bg} !important; }
           body * { color: inherit !important; border-color: currentColor !important; background-color: ${n.bg} !important; }
           a:any-link { color: ${n.link} !important; }
           svg, img { background-color: transparent !important; ${o ? "" : "mix-blend-mode: multiply;"} }
           /* The forced body * background above hides the publisher's read-aloud highlight, so these themes deliberately draw ours instead. */
           ${Qr(r)} { background-color: ${Ft} !important; }` : ""}
    ::selection { background-color: rgba(128, 128, 128, 0.3); }
  `;
}
function on(e) {
  const r = e.fontFamily ? `body { font-family: ${e.fontFamily} !important; } body * { font-family: inherit !important; }` : "", t = e.paragraphSpacing ? `p, li, blockquote, dd { margin-bottom: ${e.paragraphSpacing}em !important; }` : "", o = `
    @media screen {
      ${r}
    }
    html { line-height: ${e.lineHeight}; hanging-punctuation: allow-end last; orphans: 2; widows: 2; }
    [align="left"] { text-align: left; } [align="right"] { text-align: right; }
    [align="center"] { text-align: center; } [align="justify"] { text-align: justify; }
    :is(hgroup, header) p { text-align: unset; hyphens: unset; }
    h1, h2, h3, h4, h5, h6, hgroup, th { text-wrap: balance; }
    pre { white-space: pre-wrap !important; tab-size: 2; }
    p, li, blockquote, dd { line-height: ${e.lineHeight}; text-align: ${e.justify ? "justify" : "start"} !important; hyphens: ${e.hyphenate ? "auto" : "none"}; }
    ${t}
  `, n = [
    e.letterSpacing ? `body, body * { letter-spacing: ${e.letterSpacing}em !important; }` : "",
    e.wordSpacing ? `body, body * { word-spacing: ${e.wordSpacing}em !important; }` : "",
    e.textIndent ? `p { text-indent: ${e.textIndent}em !important; }` : "",
    e.fontWeight ? `body, body * { font-weight: ${e.fontWeight} !important; }` : ""
  ].filter(Boolean).join(`
`);
  return n ? `${o}
${n}` : o;
}
function sn(e) {
  return `@media screen { html { font-size: ${e.fontSize}px; } }`;
}
function an(e, r) {
  return nn(e, r) + sn(e) + (e.useBookLayout ? "" : on(e));
}
function $t(e) {
  var n, s, i;
  const r = e.getBoundingClientRect(), t = (i = (s = (n = e.startContainer) == null ? void 0 : n.ownerDocument) == null ? void 0 : s.defaultView) == null ? void 0 : i.frameElement, o = t ? t.getBoundingClientRect() : { left: 0, top: 0 };
  return { left: r.left + o.left, top: r.top + o.top, right: r.right + o.left, bottom: r.bottom + o.top };
}
function ln(e) {
  var r, t, o, n;
  for (const s of ((r = e == null ? void 0 : e.getContents) == null ? void 0 : r.call(e)) ?? []) (n = (o = (t = s.doc) == null ? void 0 : t.getSelection) == null ? void 0 : o.call(t)) == null || n.removeAllRanges();
}
function cn(e, r) {
  let t = !1, o = null;
  const n = () => {
    const a = e.getSelection();
    t = !!a && !a.isCollapsed;
  }, s = (a) => {
    var g, b;
    if (t) {
      t = !1;
      return;
    }
    const l = a.target;
    if ((g = l == null ? void 0 : l.closest) != null && g.call(l, "a[href]")) return;
    const c = e.getSelection();
    if (c && !c.isCollapsed) return;
    const d = (b = e.defaultView) == null ? void 0 : b.frameElement, u = d ? d.getBoundingClientRect() : { left: 0, top: 0 }, h = (u.left + a.clientX) / window.innerWidth, p = (u.top + a.clientY) / window.innerHeight;
    setTimeout(() => {
      r.now() - r.lastAnnotationHitAt() < 50 || r.onTap(h, p);
    }, 0);
  }, i = () => {
    o && clearTimeout(o), o = setTimeout(() => {
      const a = e.getSelection();
      if (!a || a.isCollapsed || a.rangeCount === 0) {
        r.onSelectionCleared();
        return;
      }
      const l = a.getRangeAt(0), c = l.toString().trim();
      if (!c) return;
      const d = r.getCFI(l);
      r.onSelection(c, d, $t(l));
    }, 300);
  };
  return e.addEventListener("pointerdown", n, !0), e.addEventListener("click", s), e.addEventListener("selectionchange", i), () => {
    e.removeEventListener("pointerdown", n, !0), e.removeEventListener("click", s), e.removeEventListener("selectionchange", i), o && clearTimeout(o);
  };
}
function dn(e, r, t) {
  var o;
  try {
    const n = (o = e.lastLocation) == null ? void 0 : o.cfi;
    if (n) {
      const s = ae(r);
      if (tt(s, ae(n)) >= 0 && tt(s, ae(n, !0)) <= 0) return;
    }
  } catch {
  }
  e.history.clear(), e.history.pushState(r), e.history.pushState(t);
}
const un = 200;
class pn {
  constructor() {
    T(this, "token", 0);
  }
  clear(r) {
    var t;
    this.token++;
    try {
      (t = r == null ? void 0 : r.clearSearch) == null || t.call(r);
    } catch {
    }
  }
  async run(r, t, o) {
    var a;
    const n = ++this.token;
    try {
      (a = r == null ? void 0 : r.clearSearch) == null || a.call(r);
    } catch {
    }
    if (!r || !t) {
      o.onDone(0, !1);
      return;
    }
    let s = 0, i = !1;
    try {
      for await (const l of r.search({ query: t })) {
        if (n !== this.token) return;
        if (l === "done") break;
        if (l.subitems) {
          const c = l.subitems.map((d) => {
            var u, h, p;
            return {
              cfi: d.cfi,
              pre: ((u = d.excerpt) == null ? void 0 : u.pre) ?? "",
              match: ((h = d.excerpt) == null ? void 0 : h.match) ?? "",
              post: ((p = d.excerpt) == null ? void 0 : p.post) ?? ""
            };
          });
          if (s += c.length, o.onResults(l.label ?? "", c), s >= un) {
            i = !0;
            break;
          }
        } else typeof l.progress == "number" && o.onProgress(l.progress);
      }
    } catch {
    }
    n === this.token && o.onDone(s, i);
  }
}
function me(e) {
  return document.createElementNS("http://www.w3.org/2000/svg", e);
}
function Mt(e) {
  switch (e) {
    case "underline":
      return (r, { color: t = "red" } = {}) => {
        const o = me("g");
        o.setAttribute("fill", t);
        for (const { left: n, bottom: s, width: i } of Array.from(r)) {
          const a = me("rect");
          a.setAttribute("x", String(n)), a.setAttribute("y", String(s - 2)), a.setAttribute("height", "2"), a.setAttribute("width", String(i)), o.append(a);
        }
        return o;
      };
    case "strikethrough":
      return (r, { color: t = "red" } = {}) => {
        const o = me("g");
        o.setAttribute("fill", t);
        for (const { left: n, top: s, bottom: i, width: a } of Array.from(r)) {
          const l = me("rect");
          l.setAttribute("x", String(n)), l.setAttribute("y", String((s + i) / 2)), l.setAttribute("height", "2"), l.setAttribute("width", String(a)), o.append(l);
        }
        return o;
      };
    case "invert":
      return (r, { color: t = "#FFFFFF" } = {}) => {
        const o = me("g");
        o.setAttribute("fill", t), o.style.mixBlendMode = "difference";
        for (const { left: n, top: s, height: i, width: a } of Array.from(r)) {
          const l = me("rect");
          l.setAttribute("x", String(n)), l.setAttribute("y", String(s)), l.setAttribute("height", String(i)), l.setAttribute("width", String(a)), o.append(l);
        }
        return o;
      };
    case "squiggly":
      return (r, { color: t = "red" } = {}) => {
        const o = me("g");
        o.setAttribute("fill", "none"), o.setAttribute("stroke", t), o.setAttribute("stroke-width", "2");
        const n = 3;
        for (const { left: s, bottom: i, width: a } of Array.from(r)) {
          const l = me("path"), c = Math.max(1, Math.round(a / n / 1.5)), d = a / c, u = Array.from({ length: c }, (h, p) => `l${d} ${p % 2 ? n : -n}`).join("");
          l.setAttribute("d", `M${s} ${i}${u}`), o.append(l);
        }
        return o;
      };
    default:
      return (r, { color: t = "yellow" } = {}) => {
        const o = me("g");
        o.setAttribute("fill", t), o.style.opacity = "0.3", o.style.mixBlendMode = "multiply";
        for (const { left: n, top: s, height: i, width: a } of Array.from(r)) {
          const l = me("rect");
          l.setAttribute("x", String(n)), l.setAttribute("y", String(s)), l.setAttribute("height", String(i)), l.setAttribute("width", String(a)), o.append(l);
        }
        return o;
      };
  }
}
class hn {
  constructor() {
    T(this, "styles", /* @__PURE__ */ new Map());
  }
  getStyle(r) {
    return this.styles.get(r);
  }
  getDrawFunctionFor(r) {
    const t = this.styles.get(r);
    return t ? Mt(t.style) : null;
  }
  keys() {
    return Array.from(this.styles.keys());
  }
  reset() {
    this.styles.clear();
  }
  /** Erases removed CFIs, (re)draws new or changed ones. Unchanged CFIs are left alone - this
   * is the behaviour that makes `setAnnotations` safe to call on every host-side edit without
   * redrawing the whole set each time. */
  setAnnotations(r, t) {
    const o = /* @__PURE__ */ new Map();
    for (const n of Array.isArray(r) ? r : [])
      n != null && n.cfi && o.set(n.cfi, { color: n.color, style: n.style });
    for (const n of Array.from(this.styles.keys()))
      o.has(n) || (this.styles.delete(n), t.erase(n));
    for (const [n, s] of o) {
      const i = this.styles.get(n);
      this.styles.set(n, s), (!i || i.color !== s.color || i.style !== s.style) && t.draw(n);
    }
  }
}
const Fe = "rx-glossary-term", rr = "data-reactor-glossary-marked", nr = "data-reactor-glossary-style", Uo = "http://www.idpf.org/2007/ops", or = 8;
function At(e) {
  return (e.textContent ?? "").replace(/\s+/g, " ").trim();
}
function Vo(e) {
  return e.getAttributeNS(Uo, "type") ?? e.getAttribute("epub:type") ?? "";
}
function qo(e) {
  return /\bglossary\b/i.test(Vo(e));
}
function Ko(e) {
  const r = [];
  let t = null;
  for (const o of Array.from(e.children)) {
    const n = o.tagName.toLowerCase();
    if (n === "dt")
      t = At(o);
    else if (n === "dd") {
      if (t) {
        const s = At(o);
        s && r.push({ term: t, definition: s });
      }
      t = null;
    }
  }
  return r;
}
function fn(e) {
  const r = [], t = Array.from(e.querySelectorAll("*")).filter(qo);
  for (const o of t) {
    const n = o.tagName.toLowerCase() === "dl" ? [o] : Array.from(o.querySelectorAll("dl"));
    for (const s of n) r.push(...Ko(s));
  }
  for (const o of Array.from(e.querySelectorAll("dfn"))) {
    const n = At(o), s = (o.getAttribute("title") ?? "").trim();
    n && s && r.push({ term: n, definition: s });
  }
  return r;
}
function Yo(e) {
  const r = /* @__PURE__ */ new Map();
  for (const t of e) {
    const o = t.term.toLowerCase();
    r.has(o) || r.set(o, t);
  }
  return Array.from(r.values()).sort((t, o) => t.term.localeCompare(o.term));
}
async function gn(e) {
  const r = e.sections ?? [], t = [];
  for (let o = 0; o < r.length; o += or) {
    const n = r.slice(o, o + or), s = await Promise.all(
      n.map(async (i) => {
        if (typeof i.createDocument != "function") return [];
        try {
          const a = await i.createDocument();
          return fn(a);
        } catch {
          return [];
        }
      })
    );
    for (const i of s) t.push(...i);
  }
  return Yo(t);
}
function sr(e) {
  return e.getBoundingClientRect();
}
function Xo(e) {
  var s, i;
  const r = sr(e);
  let t = r.left, o = r.top, n = ((s = e.ownerDocument) == null ? void 0 : s.defaultView) ?? null;
  for (; n != null && n.frameElement; ) {
    const a = sr(n.frameElement);
    t += a.left, o += a.top, n = ((i = n.frameElement.ownerDocument) == null ? void 0 : i.defaultView) ?? null;
  }
  return { left: t, top: o, bottom: o + r.height, width: r.width, height: r.height };
}
function nt(e, r, t) {
  var d;
  if (!r.length || !e.body || e.body.hasAttribute(rr)) return;
  e.body.setAttribute(rr, "1"), bn(e);
  const o = [...new Set(r.map((u) => u.term))].sort((u, h) => h.length - u.length);
  if (!o.length) return;
  const n = o.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), s = new RegExp(`\\b(${n.join("|")})\\b`, "i"), i = e.createTreeWalker(
    e.body,
    4
    /* NodeFilter.SHOW_TEXT */
  ), a = [];
  let l;
  for (; l = i.nextNode(); ) a.push(l);
  for (const u of a) {
    const h = u.parentElement;
    if (!h || h.closest(`.${Fe}, a, dfn`)) continue;
    const p = u.textContent ?? "", g = s.exec(p);
    if (!(g != null && g[1])) continue;
    const b = g[1], m = p.slice(0, g.index), f = p.slice(g.index + b.length), v = e.createElement("span");
    v.className = Fe, v.setAttribute("tabindex", "0"), v.setAttribute("role", "button"), v.setAttribute("data-gloss-term", b), v.textContent = b;
    const w = e.createDocumentFragment();
    m && w.appendChild(e.createTextNode(m)), w.appendChild(v), f && w.appendChild(e.createTextNode(f)), (d = u.parentNode) == null || d.replaceChild(w, u);
  }
  function c(u) {
    const h = u.getAttribute("data-gloss-term");
    h && t(h, Xo(u));
  }
  e.addEventListener("click", (u) => {
    var p, g;
    const h = (g = (p = u.target) == null ? void 0 : p.closest) == null ? void 0 : g.call(p, `.${Fe}`);
    h && c(h);
  }), e.addEventListener("keydown", (u) => {
    var g;
    const h = u, p = h.target;
    (g = p == null ? void 0 : p.classList) != null && g.contains(Fe) && (h.key === "Enter" || h.key === " ") && (h.preventDefault(), c(p));
  });
}
function bn(e) {
  var t;
  if (e.querySelector(`[${nr}]`)) return;
  const r = e.createElement("style");
  r.setAttribute(nr, "1"), r.textContent = `.${Fe} { text-decoration: underline; text-decoration-style: dotted; text-decoration-color: currentColor; text-decoration-thickness: 1px; cursor: pointer; }`, (t = e.head) == null || t.appendChild(r);
}
function mn(e, r, t = {}) {
  const o = document.createElement("foliate-view");
  o.setAttribute("id", "foliate-secondary"), o.style.cssText = "width:100%;height:100%;display:block;", e.appendChild(o);
  const n = /* @__PURE__ */ new Set();
  let s = null, i = !1;
  function a(c) {
    if (!i)
      for (const d of n) d(c);
  }
  o.addEventListener("relocate", (c) => {
    var u;
    const d = c.detail ?? {};
    s = d.cfi ?? null, a({
      type: "relocate",
      cfi: s,
      fraction: typeof d.fraction == "number" ? d.fraction : null,
      chapterTitle: ((u = d.tocItem) == null ? void 0 : u.label) ?? null
    });
  }), o.addEventListener("error", (c) => {
    const d = c.detail;
    a({ type: "error", cfi: null, fraction: null, chapterTitle: null, message: (d == null ? void 0 : d.message) ?? "Reader error" });
  }), o.addEventListener("load", (c) => {
    var h;
    setTimeout(() => {
      var p;
      (p = o.renderer) != null && p.setAttribute && (o.renderer.setAttribute("flow", "scrolled"), o.renderer.setAttribute("margin-top", "16px"), o.renderer.setAttribute("margin-bottom", "16px"), o.renderer.setAttribute("margin-left", "16px"), o.renderer.setAttribute("margin-right", "16px"), o.renderer.setAttribute("max-inline-size", "9999px"), o.renderer.setAttribute("max-column-count", "1"));
    }, 0);
    const d = c.detail, u = ((h = t.getGlossaryTerms) == null ? void 0 : h.call(t)) ?? [];
    d != null && d.doc && u.length && t.onGlossaryTermTap && nt(d.doc, u, t.onGlossaryTermTap);
  });
  const l = o.open(r).catch((c) => {
    a({ type: "error", cfi: null, fraction: null, chapterTitle: null, message: (c == null ? void 0 : c.message) ?? "Failed to open book" });
  });
  return {
    async goTo(c) {
      if (await l, !i)
        try {
          await o.goTo(c);
        } catch {
        }
    },
    getCurrentCfi() {
      return s;
    },
    on(c) {
      return n.add(c), () => n.delete(c);
    },
    destroy() {
      i || (i = !0, n.clear(), o.remove());
    }
  };
}
const xn = {
  epub: "application/epub+zip",
  mobi: "application/x-mobipocket-ebook",
  azw3: "application/vnd.amazon.ebook",
  azw: "application/vnd.amazon.ebook",
  fb2: "application/x-fictionbook+xml",
  cbz: "application/vnd.comicbook+zip",
  cbr: "application/vnd.comicbook-rar"
};
class yn {
  constructor(r) {
    T(this, "container");
    T(this, "listeners", /* @__PURE__ */ new Set());
    T(this, "currentSettings", null);
    T(this, "view", null);
    T(this, "pending", null);
    T(this, "narrationActiveClass", null);
    T(this, "narrationPlaybackActiveClass", null);
    T(this, "narration", new Jr());
    T(this, "restoringPosition", !1);
    T(this, "relocateChain", Promise.resolve());
    T(this, "annotations", new hn());
    T(this, "lastAnnotationHitAt", 0);
    T(this, "search", new pn());
    T(this, "glossaryTerms", []);
    T(this, "glossaryPromise", null);
    /** Memoizes CFI -> chapter label lookups for the Notes tab (U5 Defect B fix); cleared on
     * every new book so a stale title from a previous book never leaks through. */
    T(this, "chapterTitleCache", /* @__PURE__ */ new Map());
    T(this, "glossaryTapListeners", /* @__PURE__ */ new Set());
    /** R-G7: extra CSS a host injects alongside `generateCSS`'s output (e.g. a web client's
     * user-uploaded custom @font-face rules). Additive only: null/empty changes nothing, and
     * every existing host that never calls `setExtraCss` sees exactly the CSS it always did. */
    T(this, "extraCss", null);
    this.container = r;
  }
  /** Subscribes to every emitted v1 event; returns an unsubscribe function. */
  on(r) {
    return this.listeners.add(r), () => this.listeners.delete(r);
  }
  emit(r) {
    for (const t of this.listeners) t(r);
  }
  emitError(r) {
    this.emit({ type: "error", message: String(r ?? "Reader error") });
  }
  /* --------------------------------------------------------------- open paths */
  /** Begins a streamed open (mirrors `__readerBegin`'s payload handling). Byte decoding from the
   * wire (e.g. base64) is a host adapter concern; this takes already-decoded bytes. */
  beginOpen(r) {
    this.pending = { meta: r, parts: [] }, r.settings && (this.currentSettings = Ze(r.settings, null));
  }
  /** One chunk of the file started by `beginOpen` (mirrors `__readerChunk`). */
  pushChunk(r) {
    this.pending && this.pending.parts.push(r);
  }
  /** Finishes the transfer started by `beginOpen`/`pushChunk`* and opens it (mirrors `__readerCommit`). */
  async commitOpen() {
    if (!this.pending) return;
    const { meta: r, parts: t } = this.pending;
    this.pending = null, await this.openChunks(r, t);
  }
  async openChunks(r, t) {
    try {
      this.createView();
      const o = (r.format ?? "epub").toLowerCase(), n = new Blob(t, { type: xn[o] ?? "application/octet-stream" }), s = new File([n], `book.${o}`, { type: n.type });
      await this.view.open(s), await this.finishOpen(r);
    } catch (o) {
      this.emitError((o == null ? void 0 : o.message) ?? "Failed to open book");
    }
  }
  /** Lazy local-EPUB open: fetches zip entries one at a time from `baseUrl` (mirrors
   * `__readerOpenLocal`). Keeps peak memory proportional to the current section, not the whole
   * book - see src/vendor/foliate/local-zip-loader.js.
   *
   * `fetcher` (R-G5) is an optional caller-supplied replacement for the global `fetch` used to
   * read `baseUrl`'s entries; a host behind auth (e.g. a web client) can pass one that adds an
   * `Authorization` header. Omitting it keeps every existing same-origin caller's behaviour
   * byte-identical - it still ends up calling plain `fetch`, exactly as before this parameter
   * existed. */
  async openLocal(r, t, o) {
    r.settings && (this.currentSettings = Ze(r.settings, null));
    try {
      this.createView();
      const { makeLocalZipLoader: n } = await import("./local-zip-loader-DkW60oo9.js"), { EPUB: s } = await import("./epub-DevfktxG.js"), i = await n(t, o), a = await new s(i).init();
      await this.view.open(a), await this.finishOpen(r);
    } catch (n) {
      this.emitError((n == null ? void 0 : n.message) ?? "Failed to open local book");
    }
  }
  // Shared tail of opening a book, whichever open path produced it: apply styles, report the
  // TOC/metadata, then navigate to the requested position (CFI, else fraction, else start).
  async finishOpen(r) {
    var s, i, a, l, c, d, u, h, p, g, b, m;
    const t = this.view, o = !!((i = (s = t.book) == null ? void 0 : s.sections) != null && i.some((f) => f.mediaOverlay));
    this.narrationActiveClass = o ? ((l = (a = t.book) == null ? void 0 : a.media) == null ? void 0 : l.activeClass) || dt : null, this.narrationPlaybackActiveClass = o && ((d = (c = t.book) == null ? void 0 : c.media) == null ? void 0 : d.playbackActiveClass) || null, this.annotations.reset(), this.glossaryTerms = [], this.glossaryPromise = null, this.chapterTitleCache.clear(), this.applyStyles(r.settings ?? this.currentSettings), this.emit({
      type: "loaded",
      toc: Pt((u = t.book) == null ? void 0 : u.toc),
      hasMediaOverlay: o,
      isRtl: ((h = t.book) == null ? void 0 : h.dir) === "rtl",
      metadata: {
        title: ((g = (p = t.book) == null ? void 0 : p.metadata) == null ? void 0 : g.title) ?? null,
        language: ((m = (b = t.book) == null ? void 0 : b.metadata) == null ? void 0 : m.language) ?? null
      }
    });
    let n = !1;
    if (r.cfi) {
      this.restoringPosition = !0;
      try {
        await t.goTo(r.cfi), n = !0;
      } catch {
        this.restoringPosition = !1, n = !1;
      }
    }
    if (!n && typeof r.fraction == "number" && r.fraction > 0 && typeof t.goToFraction == "function") {
      this.restoringPosition = !0;
      try {
        t.goToFraction(r.fraction), n = !0;
      } catch {
        this.restoringPosition = !1, n = !1;
      }
    }
    if (!n)
      try {
        await t.goTo(0);
      } catch {
      }
    n && r.cfi && r.previousCfi && dn(t, r.previousCfi, r.cfi), setTimeout(() => {
      this.restoringPosition = !1;
    }, 0), this.postHistory();
  }
  /* ----------------------------------------------------------------- view creation */
  createView() {
    if (this.view) return this.view;
    const r = document.createElement("foliate-view");
    return r.setAttribute("id", "foliate"), r.style.cssText = "width:100%;height:100%;display:block;", this.container.appendChild(r), this.view = r, r.history.addEventListener("index-change", () => this.postHistory()), r.addEventListener("load", () => {
      setTimeout(() => this.applyStyles(this.currentSettings), 0);
    }), r.addEventListener("load", (t) => {
      const o = t.detail, n = o == null ? void 0 : o.doc, s = o == null ? void 0 : o.index;
      n && typeof s == "number" && this.attachHandlersForDoc(n, s), n && en(n, this.narrationActiveClass), n && this.glossaryTerms.length && nt(n, this.glossaryTerms, (i, a) => this.emitGlossaryTermTap(i, a));
    }), r.addEventListener("draw-annotation", (t) => {
      var i;
      const o = t.detail, n = (i = o == null ? void 0 : o.annotation) == null ? void 0 : i.value, s = n ? this.annotations.getStyle(n) : void 0;
      !(o != null && o.draw) || !s || o.draw(Mt(s.style), { color: s.color });
    }), r.addEventListener("create-overlay", () => {
      setTimeout(() => {
        for (const t of this.annotations.keys()) this.drawAnnotation(t);
      }, 100);
    }), r.addEventListener("show-annotation", (t) => {
      this.lastAnnotationHitAt = performance.now();
      const o = t.detail;
      this.emit({ type: "annotationTap", cfi: (o == null ? void 0 : o.value) ?? null, rect: o != null && o.range ? $t(o.range) : null });
    }), r.addEventListener("relocate", (t) => {
      const o = t.detail ?? {};
      r._narrationNav || this.narration.markManualNav(performance.now());
      const n = this.restoringPosition;
      this.restoringPosition = !1, this.relocateChain = this.relocateChain.then(() => {
        var s, i;
        return (s = this.view) != null && s.book ? this.narration.narrationLocator(this.view.book, (i = o.section) == null ? void 0 : i.current, o.range) : null;
      }).catch(() => null).then((s) => {
        var i;
        this.emit({
          type: "relocate",
          cfi: o.cfi ?? null,
          fraction: typeof o.fraction == "number" ? o.fraction : null,
          chapterTitle: ((i = o.tocItem) == null ? void 0 : i.label) ?? null,
          location: o.location ?? null,
          reason: o.reason ?? null,
          restoring: n,
          narrationFragment: (s == null ? void 0 : s.fragment) ?? null,
          narrationSectionIndex: (s == null ? void 0 : s.sectionIndex) ?? null
        });
      });
    }), r.addEventListener("error", (t) => {
      const o = t.detail;
      this.emitError((o == null ? void 0 : o.message) ?? "Reader error");
    }), r;
  }
  attachHandlersForDoc(r, t) {
    cn(r, {
      getCFI: (o) => {
        try {
          return this.view.getCFI(t, o);
        } catch {
          return null;
        }
      },
      onTap: (o, n) => this.emit({ type: "tap", x: o, y: n }),
      onSelection: (o, n, s) => this.emit({ type: "selection", text: o, cfi: n, rect: s }),
      onSelectionCleared: () => this.emit({ type: "selectionCleared" }),
      lastAnnotationHitAt: () => this.lastAnnotationHitAt,
      now: () => performance.now()
    });
  }
  postHistory() {
    var r, t, o, n;
    this.emit({ type: "history", canGoBack: !!((t = (r = this.view) == null ? void 0 : r.history) != null && t.canGoBack), canGoForward: !!((n = (o = this.view) == null ? void 0 : o.history) != null && n.canGoForward) });
  }
  /* ------------------------------------------------------------------- styles */
  applyStyles(r) {
    if (!this.view) return;
    this.currentSettings = Ze(r, this.currentSettings);
    const t = this.currentSettings, o = this.view.renderer;
    o && (o.setAttribute("max-column-count", String(t.maxColumnCount)), o.setAttribute("gap", `${t.gap * 100}%`), o.setAttribute("max-inline-size", `${t.maxInlineSize}px`), o.setAttribute("max-block-size", `${t.maxBlockSize}px`), o.setAttribute("margin-top", `${t.marginTop}px`), o.setAttribute("margin-bottom", `${t.marginBottom}px`), o.setAttribute("margin-left", `${t.marginLeft}px`), o.setAttribute("margin-right", `${t.marginRight}px`), o.setAttribute("flow", t.flow), typeof o.setStyles == "function" && o.setStyles(an(t, this.narrationActiveClass) + (this.extraCss ?? "")));
  }
  /** R-G7: sets (or clears, with null/empty) extra CSS injected into every section alongside
   * `generateCSS`'s output - e.g. a web host's user-uploaded custom @font-face rules. Re-applies
   * immediately if a book is open; otherwise takes effect on the next `applyStyles`/open.
   * Additive-only: a host that never calls this sees exactly the CSS it always did. */
  setExtraCss(r) {
    this.extraCss = r || null, this.applyStyles(this.currentSettings);
  }
  /* -------------------------------------------------------------- annotations */
  drawAnnotation(r) {
    var t, o, n, s;
    (s = (n = (o = (t = this.view) == null ? void 0 : t.addAnnotation) == null ? void 0 : o.call(t, { value: r })) == null ? void 0 : n.catch) == null || s.call(n, () => {
    });
  }
  eraseAnnotation(r) {
    var t, o, n, s;
    (s = (n = (o = (t = this.view) == null ? void 0 : t.deleteAnnotation) == null ? void 0 : o.call(t, { value: r })) == null ? void 0 : n.catch) == null || s.call(n, () => {
    });
  }
  setAnnotations(r) {
    this.annotations.setAnnotations(r, {
      draw: (t) => this.drawAnnotation(t),
      erase: (t) => this.eraseAnnotation(t)
    });
  }
  clearSelection() {
    var r;
    ln((r = this.view) == null ? void 0 : r.renderer);
  }
  /* -------------------------------------------------------------------- search */
  runSearch(r) {
    this.search.run(this.view, String(r ?? ""), {
      onResults: (t, o) => this.emit({ type: "searchResults", label: t, items: o }),
      onProgress: (t) => this.emit({ type: "searchProgress", progress: t }),
      onDone: (t, o) => this.emit({ type: "searchDone", total: t, capped: o })
    });
  }
  clearSearch() {
    this.search.clear(this.view);
  }
  /* ------------------------------------------------------------------ navigation */
  goTo(r) {
    var t;
    (t = this.view) == null || t.goTo(r).catch(() => {
    });
  }
  goToFraction(r) {
    var t;
    typeof ((t = this.view) == null ? void 0 : t.goToFraction) == "function" && this.view.goToFraction(r);
  }
  prev() {
    var r, t;
    (t = (r = this.view) == null ? void 0 : r.prev) == null || t.call(r);
  }
  next() {
    var r, t;
    (t = (r = this.view) == null ? void 0 : r.next) == null || t.call(r);
  }
  historyBack() {
    var r, t;
    (t = (r = this.view) == null ? void 0 : r.history) == null || t.back();
  }
  historyForward() {
    var r, t;
    (t = (r = this.view) == null ? void 0 : r.history) == null || t.forward();
  }
  setSwipe(r) {
    globalThis.__reactorNoSwipe = !r;
  }
  /* ------------------------------------------------------------------- narration */
  narrationPrepare(r) {
    var n, s;
    const t = this.narration.nextPrepareToken(), o = this.view;
    o != null && o.book && this.narration.buildTimeline({ book: o.book, currentSectionHref: ((n = o.lastLocation) == null ? void 0 : n.source) ?? null, currentRange: (s = o.lastLocation) == null ? void 0 : s.range }).then((i) => {
      this.narration.isCurrentPrepareToken(t) && (i ? this.emit({ type: "narrationTimeline", generation: r, ...i }) : this.emit({ type: "narrationTimelineError", generation: r, message: "Couldn't read this book's narration" }));
    }).catch((i) => {
      this.narration.isCurrentPrepareToken(t) && this.emit({ type: "narrationTimelineError", generation: r, message: (i == null ? void 0 : i.message) ?? "Couldn't read this book's narration" });
    });
  }
  narrationCancelPrepare() {
    this.narration.cancelPrepare();
  }
  narrationHighlight(r) {
    const t = this.view;
    r && (t != null && t.mediaOverlay) && (t.pauseNarrationFollow = this.narration.isFollowPaused(performance.now()), t.mediaOverlay.dispatchEvent(new CustomEvent("highlight", { detail: { text: r } })));
  }
  narrationUnhighlight() {
    var r, t;
    (t = (r = this.view) == null ? void 0 : r.mediaOverlay) == null || t.dispatchEvent(new CustomEvent("unhighlight"));
  }
  /* --------------------------------------------------------------------- dispatch */
  /** Dispatches a parsed `ReaderCommand`, mirroring `__readerCommand`'s switch exactly. */
  dispatch(r) {
    if (this.view)
      switch (r.type) {
        case "goTo":
          this.goTo(r.target);
          break;
        case "goToFraction":
          this.goToFraction(r.value);
          break;
        case "prev":
          this.prev();
          break;
        case "next":
          this.next();
          break;
        case "historyBack":
          this.historyBack();
          break;
        case "historyForward":
          this.historyForward();
          break;
        case "setSwipe":
          this.setSwipe(r.enabled);
          break;
        case "applyStyles":
          this.applyStyles(r.settings);
          break;
        case "setAnnotations":
          this.setAnnotations(r.items);
          break;
        case "clearSelection":
          this.clearSelection();
          break;
        case "search":
          this.runSearch(r.query);
          break;
        case "clearSearch":
          this.clearSearch();
          break;
        case "narrationPrepare":
          this.narrationPrepare(r.generation);
          break;
        case "narrationCancelPrepare":
          this.narrationCancelPrepare();
          break;
        case "narrationHighlight":
          this.narrationHighlight(r.textHref);
          break;
        case "narrationUnhighlight":
          this.narrationUnhighlight();
          break;
      }
  }
  emitReady() {
    this.emit({ type: "ready" });
  }
  /* --------------------------------------------------------- secondary view (U3, SPEC.md D8) */
  /** The currently open book instance, or null before a book has opened. Exposed only so a
   * second content view (Context mini-reader) can share it rather than opening a second `EPUB`
   * instance - see docs/spikes/S2-two-views.md. */
  getOpenBook() {
    var r;
    return ((r = this.view) == null ? void 0 : r.book) ?? null;
  }
  /** Creates a second content view over the same open book inside `container`. Returns null
   * when no book is open yet. The caller owns the returned handle's lifecycle (`destroy()`). */
  createSecondaryView(r) {
    const t = this.getOpenBook();
    return t ? mn(r, t, {
      getGlossaryTerms: () => this.glossaryTerms,
      onGlossaryTermTap: (o, n) => this.emitGlossaryTermTap(o, n)
    }) : null;
  }
  /* ----------------------------------------------------------------- glossary (U4, SPEC.md D7) */
  /** Resolves this book's glossary terms (D7: `epub:type="glossary"` dl/dt/dd pairs and
   * `<dfn title>` markers only - no server glossary, no user-added terms in v1). Extraction is
   * lazy and memoized per open book: nothing is scanned until the first call, so a reader who
   * never opens the Glossary tab never pays for it. Resolves to `[]` before a book is open, and
   * for a book that ships none - the empty state D7 requires. */
  getGlossaryTerms() {
    var t;
    const r = (t = this.view) == null ? void 0 : t.book;
    return r ? (this.glossaryPromise || (this.glossaryPromise = gn(r).then((o) => (this.glossaryTerms = o, this.remarkLoadedDocs(), o))), this.glossaryPromise) : Promise.resolve([]);
  }
  /** Resolves a note/annotation CFI to its chapter label, the same `tocItem.label` the
   * `relocate` event reports for the live reading position (U5 Defect B: a note row must never
   * show a raw CFI to the user). Memoized per CFI and bounded by the caller to the visible
   * window only (src/shell/notes/mount.ts) - this must never be run over a whole note list,
   * which can be thousands of rows (WORKTREE_BRIEF.md hard rule 5). Resolves to `null` if no
   * book is open or the lookup fails (e.g. a synthetic/invalid CFI), letting the caller fall
   * back to the annotation type label only. */
  async getChapterTitleForCfi(r) {
    if (this.chapterTitleCache.has(r)) return this.chapterTitleCache.get(r);
    const t = this.view;
    if (!t || typeof t.getTOCItemOf != "function") return null;
    let o = null;
    try {
      const n = await t.getTOCItemOf(r);
      o = typeof (n == null ? void 0 : n.label) == "string" && n.label.trim() ? n.label.trim() : null;
    } catch {
      o = null;
    }
    return this.chapterTitleCache.set(r, o), o;
  }
  /** Subscribes to inline glossary term activations (tap, or Enter/Space while focused) in the
   * main view or a Context mini-reader created via `createSecondaryView`. Not a protocol v1/v2
   * message: this is a same-process shell<->core hook, same class of addition as
   * `createSecondaryView` (WORKTREE_BRIEF.md rule 2/4 - no private access, but Reactor's own
   * shell and core share one JS runtime, unlike the host boundary the wire protocol crosses). */
  onGlossaryTermTap(r) {
    return this.glossaryTapListeners.add(r), () => this.glossaryTapListeners.delete(r);
  }
  emitGlossaryTermTap(r, t) {
    for (const o of this.glossaryTapListeners) o(r, t);
  }
  /** Re-marks whichever sections are already rendered once extraction resolves, so a page that
   * loaded before the glossary promise settled still gets its terms underlined without waiting
   * for the next page turn. */
  remarkLoadedDocs() {
    var t, o, n;
    if (!this.glossaryTerms.length) return;
    const r = ((n = (o = (t = this.view) == null ? void 0 : t.renderer) == null ? void 0 : o.getContents) == null ? void 0 : n.call(o)) ?? [];
    for (const s of r)
      s.doc && nt(s.doc, this.glossaryTerms, (i, a) => this.emitGlossaryTermTap(i, a));
  }
}
const Mi = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ContentCore: yn,
  DEFAULT_ACTIVE_CLASS: dt,
  DEFAULT_SETTINGS: tn,
  GLOSSARY_INLINE_CLASS: Fe,
  MIME: xn,
  NARRATION_FOLLOW_PAUSE_MS: Xr,
  NARRATION_HIGHLIGHT: Ft,
  NARRATION_STYLE_ATTR: Zr,
  NarrationController: Jr,
  SEARCH_MAX_RESULTS: un,
  SearchController: pn,
  THEMES: Ct,
  attachDocHandlers: cn,
  clearSelection: ln,
  createSecondaryView: mn,
  extractGlossaryFromBook: gn,
  extractGlossaryFromDocument: fn,
  firstVisibleTextHref: Et,
  fontSizeCSS: sn,
  generateCSS: an,
  injectDefaultNarrationStyle: en,
  injectGlossaryInlineStyle: bn,
  markGlossaryTermsInDoc: nt,
  mergeSettings: Ze,
  narrationHighlightSelector: Qr,
  offerUndoTo: dn,
  overrideCSS: on,
  parseSectionSmil: St,
  parseSmilClock: kt,
  resolveSmilRef: wt,
  serializeToc: Pt,
  themeCSS: nn,
  themeFor: rn,
  viewportRect: $t
}, Symbol.toStringTag, { value: "Module" })), Ri = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AnnotationManager: hn,
  getDrawFunction: Mt
}, Symbol.toStringTag, { value: "Module" })), Zo = {
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  bookmark: '<path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  panel_right: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  forward: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'
};
function Jo(e) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${Zo[e]}</svg>`;
}
function ze(e, r, t = !1) {
  const o = document.createElement("button");
  return o.type = "button", o.className = "rx-icon-btn", o.setAttribute("aria-label", e), o.innerHTML = Jo(r), t && o.setAttribute("aria-pressed", "false"), o;
}
function Qo(e) {
  e.classList.add("reader-shell");
  const r = document.createElement("div");
  r.className = "rx-zones";
  const t = document.createElement("div");
  t.className = "rx-zone rx-zone-left", t.setAttribute("role", "button"), t.setAttribute("tabindex", "0"), t.setAttribute("aria-label", "Previous page");
  const o = document.createElement("div");
  o.className = "rx-zone rx-zone-centre", o.setAttribute("role", "button"), o.setAttribute("tabindex", "0"), o.setAttribute("aria-label", "Toggle bars");
  const n = document.createElement("div");
  n.className = "rx-zone rx-zone-right", n.setAttribute("role", "button"), n.setAttribute("tabindex", "0"), n.setAttribute("aria-label", "Next page"), r.append(t, o, n);
  const s = document.createElement("div");
  s.className = "rx-bar rx-bar-top", s.setAttribute("role", "toolbar");
  const i = ze("Table of contents", "menu", !0), a = ze("Bookmark", "bookmark", !0), l = ze("Text settings", "settings", !0), c = ze("Open context panel", "panel_right", !0), d = document.createElement("div");
  d.className = "rx-bar-spacer", s.append(i, a, d, l, c);
  const u = document.createElement("div");
  u.className = "rx-bar rx-bar-bottom";
  const h = document.createElement("div");
  h.className = "rx-status-row", h.setAttribute("aria-live", "polite");
  const p = ze("Back", "back");
  p.disabled = !0;
  const g = document.createElement("span");
  g.className = "rx-chapter-label";
  const b = ze("Forward", "forward");
  b.disabled = !0, h.append(p, g, b);
  const m = document.createElement("input");
  return m.type = "range", m.className = "rx-scrubber", m.min = "0", m.max = "1000", m.step = "1", m.value = "0", m.setAttribute("aria-label", "Reading position"), u.append(h, m), e.append(r, s, u), {
    root: e,
    zones: r,
    zoneLeft: t,
    zoneCentre: o,
    zoneRight: n,
    topBar: s,
    bottomBar: u,
    contentsBtn: i,
    bookmarkBtn: a,
    settingsBtn: l,
    contextBtn: c,
    historyBackBtn: p,
    historyForwardBtn: b,
    chapterLabel: g,
    scrubber: m
  };
}
const es = `
.reader-shell {
  --rx-ground: #fbfbfa;
  --rx-ink: #17181a;
  --rx-accent: #3b6ef0;
  --rx-accent-ink: #ffffff;
  --rx-surface: #ffffff;
  --rx-surface-2: #f1f2f4;
  --rx-border: #e2e4e8;
  --rx-muted: #70747c;

  --rx-font-sans: -apple-system, 'Segoe UI', Roboto, 'Inter', Arial, sans-serif;
  --rx-font-serif: Georgia, 'Iowan Old Style', 'Times New Roman', serif;

  --rx-radius: 10px;
  --rx-space-1: 4px;
  --rx-space-2: 8px;
  --rx-space-3: 14px;
  --rx-space-4: 24px;
  --rx-elevation: 0 10px 24px rgba(20, 20, 30, 0.14);

  --rx-motion-fast: 140ms;
  --rx-motion-bar: 200ms ease;

  /* Protocol v2 configure.insets (A3): status bar / nav bar padding a host reports. Default
   * 0px so a v1-only host (never sends configure) sees no change at all - src/shell/insets.ts
   * sets these on the root, mount.ts re-applies them on every later configure. */
  --rx-inset-top: 0px;
  --rx-inset-right: 0px;
  --rx-inset-bottom: 0px;
  --rx-inset-left: 0px;

  position: relative;
  width: 100%;
  height: 100%;
  /* clip, not hidden: off-canvas overlay panels (left/right sidebars, this file's own settings
   * sheet) sit permanently translated outside the 0..100% box via transform, which still
   * counts towards this element's scrollWidth. overflow: hidden lets a focus() call on any of
   * them still shift scrollLeft via the browser's native scroll-into-view (hidden only suppresses
   * the scrollbar and user-driven scrolling, not programmatic/focus-triggered scrolling) and
   * visibly uncover whichever panel is off-canvas. clip disallows scrolling outright (CSS
   * Overflow Module Level 3), which is what a chrome root that must never scroll actually needs. */
  overflow: clip;
  background: var(--rx-ground);
  color: var(--rx-ink);
  font-family: var(--rx-font-sans);
  box-sizing: border-box;
}
.reader-shell.theme-dark {
  --rx-ground: #0b0f1a;
  --rx-ink: #e7ecf7;
  --rx-surface: #12172a;
  --rx-surface-2: #1a2036;
  --rx-border: #2a3250;
  --rx-muted: #9aa3bd;
}
/* E-ink (SHELL.md fixes #2-#4): opaque surfaces, square corners, no shadow, no hiding chrome. */
.reader-shell.e-ink {
  --rx-ground: #ffffff;
  --rx-ink: #000000;
  --rx-accent: #000000;
  --rx-accent-ink: #ffffff;
  --rx-surface: #ffffff;
  --rx-surface-2: #f2f2f2;
  --rx-border: #000000;
  --rx-muted: #3a3a3a;
  --rx-radius: 0px;
  --rx-elevation: none;
}
.reader-shell.e-ink *,
.reader-shell.reduced-motion * {
  transition: none !important;
  animation: none !important;
}

.reader-shell * {
  box-sizing: border-box;
}

/* Zone overlay (SHELL.md z-layer 20): pointer-events: none always - core's own doc handlers
 * see every pointer event directly (src/core/selection.ts), so an opaque overlay here would
 * block native text selection. Zones exist as real elements only for keyboard/switch-access
 * parity and the optional debug visualisation. */
.rx-zones {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  pointer-events: none;
}
.rx-zone {
  height: 100%;
  pointer-events: none;
}
.rx-zone-left,
.rx-zone-right {
  width: 30%;
}
.rx-zone-centre {
  width: 40%;
  flex: 1 1 auto;
}
.reader-shell.show-zones .rx-zone {
  background: color-mix(in srgb, var(--rx-accent) 12%, transparent);
  outline: 1px dashed var(--rx-accent);
}
.reader-shell.e-ink.show-zones .rx-zone {
  background: none;
  outline: 2px dashed var(--rx-ink);
}

.rx-bar {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: var(--rx-space-2);
  padding: var(--rx-space-2) calc(var(--rx-space-3) + var(--rx-inset-right)) var(--rx-space-2) calc(var(--rx-space-3) + var(--rx-inset-left));
  background: color-mix(in srgb, var(--rx-surface) 92%, transparent);
  border-color: var(--rx-border);
  transition: transform var(--rx-motion-bar);
}
.reader-shell.e-ink .rx-bar {
  background: var(--rx-surface);
}
/* E-ink forces an opaque, bordered edge on the bars instead of blur or elevation (SHELL.md
 * fix #3): a device accessibility requirement, not a general-purpose decorative line. */
.reader-shell.e-ink .rx-bar-top {
  border-bottom: 1px solid var(--rx-ink); /* taste-skill-ignore: e-ink has no shadow to separate the bar, needs a real border */
}
.reader-shell.e-ink .rx-bar-bottom {
  border-top: 1px solid var(--rx-ink); /* taste-skill-ignore: e-ink has no shadow to separate the bar, needs a real border */
}
.rx-bar-top {
  top: 0;
  padding-top: calc(var(--rx-space-2) + var(--rx-inset-top));
  box-shadow: var(--rx-elevation); /* taste-skill-ignore: real sticky overlay bar, not an at-rest element */
  transform: translateY(-100%);
}
.rx-bar-bottom {
  bottom: 0;
  padding-bottom: calc(var(--rx-space-2) + var(--rx-inset-bottom));
  box-shadow: 0 -10px 24px rgba(20, 20, 30, 0.14); /* taste-skill-ignore: real sticky overlay bar, not an at-rest element */
  flex-direction: column;
  align-items: stretch;
  gap: var(--rx-space-1);
  /* U7's bottom override in src/shell/playback/stylesheet.ts lifts this bar above a docked
   * playback bar while visible; the hidden offset has to add the same inset back on top of its
   * own height, or sliding down by only 100% lands this bar inside the reserved playback-bar
   * strip instead of fully below the viewport (U7 review: stray Forward arrow ghosting over the
   * playback bar's position readout). */
  transform: translateY(calc(100% + var(--rx-book-inset-bottom, 0px)));
}
.reader-shell.ui-visible .rx-bar-top,
.reader-shell.ui-visible .rx-bar-bottom {
  transform: translateY(0);
}

.rx-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  border: none;
  background: none;
  color: var(--rx-ink);
  border-radius: var(--rx-radius);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.rx-icon-btn:hover {
  background: var(--rx-surface-2);
}
.rx-icon-btn[aria-pressed='true'] {
  color: var(--rx-accent);
}
.rx-icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.rx-icon-btn:focus-visible,
.rx-zone:focus-visible {
  outline: 2px solid var(--rx-accent);
  outline-offset: 2px;
}
.rx-icon-btn svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rx-bar-spacer {
  flex: 1 1 auto;
}

.rx-status-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--rx-space-2);
  font-size: 13px;
  color: var(--rx-muted);
  min-height: 20px;
}

.rx-scrubber {
  appearance: none;
  width: 100%;
  height: 48px;
  margin: 0;
  background: transparent;
}
.rx-scrubber::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--rx-border);
  border-radius: 2px;
}
.rx-scrubber::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -6px;
  border-radius: 50%;
  background: var(--rx-accent);
}
.reader-shell.e-ink .rx-scrubber::-webkit-slider-thumb {
  border-radius: 0;
}

/* Size classes (SHELL.md section 2): layout hooks for later U tasks; U1 itself only needs the
 * class present on the root for its own and future components to read. */
.reader-shell.size-phone {
}
.reader-shell.size-fold-tablet {
}
.reader-shell.size-desktop {
}

.rx-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
`, ts = 599, rs = 1200;
function Je(e) {
  return e <= ts ? "phone" : e <= rs ? "fold-tablet" : "desktop";
}
const Tt = 0.3;
function vn(e, r) {
  const t = Math.min(1, Math.max(0, e));
  return t < Tt ? r ? "next" : "prev" : t > 1 - Tt ? r ? "prev" : "next" : "toggle";
}
const ns = /* @__PURE__ */ new Set(["ArrowRight", "ArrowDown", "PageDown", " "]), os = /* @__PURE__ */ new Set(["ArrowLeft", "ArrowUp", "PageUp"]);
function kn(e) {
  return e.ctrlKey || e.metaKey || e.altKey ? null : ns.has(e.key) ? "next" : os.has(e.key) ? "prev" : e.key === "m" || e.key === "M" ? "toggleBars" : e.key === "Escape" ? "escape" : null;
}
function wn(e) {
  return e === "next" || e === "prev";
}
const ss = '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>', is = '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>';
function ir(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = "rx-icon-btn", t.setAttribute("aria-label", e), t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${r}</svg>`, t;
}
function as(e) {
  const r = document.createElement("div");
  r.className = "rx-left-sidebar", r.setAttribute("aria-label", "Table of contents"), r.tabIndex = -1;
  const t = document.createElement("div");
  t.className = "rx-left-sidebar-scrim";
  const o = document.createElement("div");
  o.className = "rx-sidebar-head";
  const n = ir("Back", ss), s = document.createElement("h3");
  s.className = "rx-sidebar-title", s.textContent = "Contents";
  const i = ir("Close contents", is);
  i.classList.add("rx-left-sidebar-close"), o.append(n, s, i);
  const a = document.createElement("div");
  a.className = "rx-left-sidebar-tabs", a.setAttribute("role", "tablist");
  function l(N, L) {
    const A = document.createElement("button");
    return A.type = "button", A.className = "rx-left-sidebar-tab", A.setAttribute("role", "tab"), A.setAttribute("aria-selected", "false"), A.setAttribute("data-tab", L), A.id = `rx-tab-${L}`, A.textContent = N, A;
  }
  const c = l("Contents", "contents"), d = l("Starred", "starred"), u = l("Related", "related");
  a.append(c, d, u);
  const h = document.createElement("div");
  h.className = "rx-left-sidebar-body";
  function p(N) {
    const L = document.createElement("div");
    return L.className = "rx-sidebar-panel", L.setAttribute("role", "tabpanel"), L.setAttribute("data-panel", N), L.setAttribute("aria-labelledby", `rx-tab-${N}`), L.hidden = !0, L;
  }
  const g = p("contents"), b = document.createElement("div");
  b.className = "rx-toc-scroll";
  const m = document.createElement("div");
  m.className = "rx-toc-spacer";
  const f = document.createElement("div");
  f.className = "rx-toc-window", f.setAttribute("role", "list"), m.appendChild(f), b.appendChild(m), g.appendChild(b);
  const v = p("starred"), w = p("related");
  return h.append(g, v, w), r.append(o, a, h), e.append(t, r), {
    root: r,
    scrim: t,
    backBtn: n,
    closeBtn: i,
    title: s,
    tablist: a,
    tabContents: c,
    tabStarred: d,
    tabRelated: u,
    body: h,
    panelContents: g,
    tocScroll: b,
    tocSpacer: m,
    tocWindow: f,
    panelStarred: v,
    panelRelated: w
  };
}
const ls = `
.rx-left-sidebar {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  width: 88%;
  max-width: 340px;
  background: var(--rx-surface);
  border-right: 1px solid var(--rx-border);
  transform: translateX(-100%);
  transition: transform var(--rx-motion-bar, 200ms ease);
}
.reader-shell.size-fold-tablet .rx-left-sidebar {
  width: 78%;
  max-width: 320px;
}
/* SHELL.md U2 row: "desktop ... pushes book column". The sidebar itself stays absolutely
 * positioned (inset 0 auto 0 0, same as the overlay rule above) even on desktop: the shell root
 * is not a flex container, so a non-absolute "docked" sidebar would sit in normal block flow and
 * push every element after it - including the book column - down the page instead of beside it.
 * The actual column push is done in JS by the shared setBookInsets helper (src/shell/layout.ts,
 * also used by U3's right sidebar), which reserves the space as padding on the shell root - no
 * CSS !important fight with core's own inline style. */
.reader-shell.size-desktop .rx-left-sidebar {
  width: 280px;
  max-width: 280px;
  transform: none;
}
.reader-shell.size-desktop .rx-left-sidebar.closed {
  display: none;
}
.rx-left-sidebar.open {
  transform: translateX(0);
  box-shadow: var(--rx-elevation); /* taste-skill-ignore: real overlay dialog while narrow, not an at-rest element */
}
.reader-shell.size-desktop .rx-left-sidebar.open {
  box-shadow: none; /* taste-skill-ignore: docked (non-modal) presentation carries no shadow */
}
.reader-shell.e-ink .rx-left-sidebar {
  box-shadow: none; /* taste-skill-ignore: e-ink never carries a shadow (SHELL.md fix #2) */
  border-right: 1px solid var(--rx-ink); /* taste-skill-ignore: e-ink has no shadow to separate the docked/overlay panel, needs a real border */
}

/* Docked layouts only (SHELL.md section 2: Desktop docks the left sidebar and pushes the book
 * column; Fold unfolded/Tablet overlays it instead, so mount.ts's updateBookInsets only ever sets
 * a nonzero --rx-book-inset-left on desktop - this rule is a no-op anywhere else). A docked
 * sidebar is not behind a scrim, so without pulling the bars/zones in by the same reserved width,
 * their own controls (Contents, Bookmark) would sit under the panel: visible but unreachable to a
 * real pointer click. Mirrors U3's identical rule for the right sidebar
 * (src/shell/right-sidebar/stylesheet.ts), both reading the one shared inset helper. */
.reader-shell.rx-left-sidebar-open:not(.size-phone) .rx-bar,
.reader-shell.rx-left-sidebar-open:not(.size-phone) .rx-zones {
  left: var(--rx-book-inset-left, 0px);
}

/* Named distinctly from the right sidebar's own .rx-sidebar-scrim (src/shell/right-sidebar/
 * stylesheet.ts): both modules are mounted into the same shell root, so a shared class name here
 * would let one module's rules (display-toggled) cascade onto the other's element (opacity-based)
 * since CSS only matches by class, not by owning module. */
.rx-left-sidebar-scrim {
  position: absolute;
  inset: 0;
  z-index: 35;
  background: color-mix(in srgb, #000 40%, transparent);
  display: none;
}
.reader-shell.e-ink .rx-left-sidebar-scrim {
  background: #000;
}
.rx-left-sidebar-scrim.visible {
  display: block;
}
.reader-shell.size-desktop .rx-left-sidebar-scrim {
  display: none !important;
}

.rx-sidebar-head {
  display: flex;
  align-items: center;
  gap: var(--rx-space-2);
  padding: var(--rx-space-2) var(--rx-space-2);
  border-bottom: 1px solid var(--rx-border); /* taste-skill-ignore: fixed chrome header above a scrolling list, not a decorative divider */
  flex: 0 0 auto;
}
.rx-sidebar-title {
  flex: 1 1 auto;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.rx-left-sidebar-close {
  display: none;
}
.reader-shell:not(.size-desktop) .rx-left-sidebar-close {
  display: inline-flex;
}

.rx-left-sidebar-tabs {
  display: flex;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--rx-border); /* taste-skill-ignore: tablist/tabpanel boundary (role=tablist), not a decorative divider */
}
.rx-left-sidebar-tab {
  flex: 1 1 0;
  min-height: 48px;
  border: none;
  background: none;
  color: var(--rx-muted);
  font-size: 13px;
  font-family: var(--rx-font-sans);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.rx-left-sidebar-tab[aria-selected='true'] {
  color: var(--rx-ink);
  border-bottom-color: var(--rx-accent);
  font-weight: 600;
}
.rx-left-sidebar-tab:focus-visible {
  outline: 2px solid var(--rx-accent);
  outline-offset: -2px;
}

.rx-left-sidebar-body {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}
.rx-sidebar-panel {
  position: absolute;
  inset: 0;
  overflow: auto;
}
.rx-sidebar-panel[hidden] {
  display: none;
}

.rx-toc-scroll {
  height: 100%;
  overflow-y: auto;
}
.rx-toc-spacer {
  position: relative;
}
.rx-toc-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}
.rx-toc-row {
  display: flex;
  align-items: center;
  min-height: 48px;
  gap: var(--rx-space-1);
}
.rx-toc-row.is-current {
  background: var(--rx-surface-2);
}
.rx-toc-toggle,
.rx-toc-toggle-spacer {
  flex: 0 0 44px;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--rx-muted);
  cursor: pointer;
  font-size: 11px;
}
.rx-toc-label {
  flex: 1 1 auto;
  text-align: left;
  border: none;
  background: none;
  color: var(--rx-ink);
  font-family: var(--rx-font-sans);
  font-size: 14px;
  min-height: 48px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
  padding: var(--rx-space-1) 0;
}
.rx-toc-row.is-current .rx-toc-label {
  color: var(--rx-accent);
  font-weight: 600;
}
.rx-toc-star {
  flex: 0 0 48px;
  min-width: 48px;
  min-height: 48px;
  border: none;
  background: none;
  color: var(--rx-muted);
  cursor: pointer;
  font-size: 16px;
}
.rx-toc-star[aria-pressed='true'] {
  color: var(--rx-accent);
}

.rx-sidebar-empty {
  padding: var(--rx-space-4) var(--rx-space-3);
  color: var(--rx-muted);
  font-size: 13px;
}

.rx-starred-row,
.rx-related-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  gap: var(--rx-space-2);
  padding: var(--rx-space-2) var(--rx-space-3);
  border: none;
  background: none;
  color: var(--rx-ink);
  font-family: var(--rx-font-sans);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.rx-starred-row:hover,
.rx-related-row:hover {
  background: var(--rx-surface-2);
}
.rx-related-cover {
  flex: 0 0 44px;
  width: 44px;
  height: 60px;
  object-fit: cover;
  background: var(--rx-surface-2);
}
.rx-related-cover-empty {
  border: 1px solid var(--rx-border);
}
.rx-related-text {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
}
.rx-related-title {
  font-weight: 500;
}
.rx-related-subtitle {
  color: var(--rx-muted);
  font-size: 12px;
}
.rx-related-badge {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--rx-muted);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  padding: 2px 6px;
}
`;
function Sn(e, r = null, t = 0) {
  const o = [];
  for (let n = 0; n < e.length; n++) {
    const s = e[n], i = r === null ? String(n) : `${r}.${n}`;
    o.push({
      id: i,
      label: s.label,
      href: s.href,
      depth: t,
      hasChildren: s.subitems.length > 0,
      parentId: r
    }), s.subitems.length > 0 && o.push(...Sn(s.subitems, i, t + 1));
  }
  return o;
}
function cs(e, r) {
  if (r.size === 0) return e;
  const t = /* @__PURE__ */ new Set(), o = [];
  for (const n of e) {
    if (n.parentId !== null && (t.has(n.parentId) || r.has(n.parentId))) {
      t.add(n.id);
      continue;
    }
    o.push(n);
  }
  return o;
}
function ds(e, r) {
  if (!r) return null;
  const t = ar(r);
  let o = null;
  for (const n of e)
    if (n.href) {
      if (n.href === r) return n.id;
      o === null && ar(n.href) === t && (o = n);
    }
  return (o == null ? void 0 : o.id) ?? null;
}
function us(e, r) {
  if (!r) return null;
  for (const t of e)
    if (t.label === r) return t.id;
  return null;
}
function ar(e) {
  const r = e.indexOf("#");
  return r === -1 ? e : e.slice(0, r);
}
function ps(e, r, t, o, n = 8) {
  if (o === 0 || r <= 0) return { start: 0, end: -1 };
  const s = Math.floor(e / r), i = Math.ceil(t / r), a = Math.max(0, s - n), l = Math.min(o - 1, s + i + n);
  return { start: a, end: l };
}
const ht = 48;
function hs(e, r, t, o) {
  const n = document.createElement("div");
  if (n.className = "rx-toc-row", n.setAttribute("role", "listitem"), n.style.paddingLeft = `${12 + e.depth * 18}px`, o && n.classList.add("is-current"), e.hasChildren) {
    const l = document.createElement("button");
    l.type = "button", l.className = "rx-toc-toggle";
    const c = !r.collapsed.has(e.id);
    l.setAttribute("aria-expanded", String(c)), l.setAttribute("aria-label", `${c ? "Collapse" : "Expand"} ${e.label}`), l.textContent = c ? "▾" : "▸", l.addEventListener("click", (d) => {
      d.stopPropagation(), t.onToggleExpand(e);
    }), n.appendChild(l);
  } else {
    const l = document.createElement("span");
    l.className = "rx-toc-toggle-spacer", n.appendChild(l);
  }
  const s = document.createElement("button");
  s.type = "button", s.className = "rx-toc-label", s.setAttribute("aria-label", e.label), o && s.setAttribute("aria-current", "true"), s.textContent = e.label, s.addEventListener("click", () => t.onActivate(e)), n.appendChild(s);
  const i = document.createElement("button");
  i.type = "button", i.className = "rx-toc-star";
  const a = e.href ? r.starred.has(e.href) : !1;
  return i.setAttribute("aria-pressed", String(a)), i.setAttribute("aria-label", `${a ? "Unstar" : "Star"} ${e.label}`), i.textContent = a ? "★" : "☆", i.addEventListener("click", (l) => {
    l.stopPropagation(), t.onToggleStar(e);
  }), n.appendChild(i), n;
}
function fs(e, r, t, o, n) {
  const s = cs(o.flat, o.collapsed), i = ds(s, o.currentHref) ?? us(s, o.currentChapterTitle);
  r.style.height = `${s.length * ht}px`;
  const a = e.clientHeight || 1, { start: l, end: c } = ps(e.scrollTop, ht, a, s.length);
  t.replaceChildren(), t.style.transform = `translateY(${l * ht}px)`;
  for (let d = l; d <= c; d++) {
    const u = s[d];
    u && t.appendChild(hs(u, o, n, u.id === i));
  }
}
function gs(e, r, t) {
  if (e.replaceChildren(), r.length === 0) {
    const n = document.createElement("p");
    n.className = "rx-sidebar-empty", n.textContent = "No starred chapters yet. Star a chapter in Contents to find it here.", e.appendChild(n);
    return;
  }
  const o = document.createElement("div");
  o.setAttribute("role", "list");
  for (const n of r) {
    const s = document.createElement("button");
    s.type = "button", s.className = "rx-starred-row", s.setAttribute("role", "listitem"), s.textContent = n.label, s.addEventListener("click", () => t(n)), o.appendChild(s);
  }
  e.appendChild(o);
}
function bs(e, r, t) {
  if (e.replaceChildren(), r.length === 0) {
    const n = document.createElement("p");
    n.className = "rx-sidebar-empty", n.textContent = "No related books yet.", e.appendChild(n);
    return;
  }
  const o = document.createElement("div");
  o.setAttribute("role", "list");
  for (const n of r) {
    const s = document.createElement("button");
    s.type = "button", s.className = "rx-related-row", s.setAttribute("role", "listitem");
    const i = `${n.title}${n.subtitle ? `, ${n.subtitle}` : ""}${n.read ? ", read" : ""}`;
    if (s.setAttribute("aria-label", i), n.coverUrl) {
      const c = document.createElement("img");
      c.className = "rx-related-cover", c.src = n.coverUrl, c.alt = "", s.appendChild(c);
    } else {
      const c = document.createElement("div");
      c.className = "rx-related-cover rx-related-cover-empty", s.appendChild(c);
    }
    const a = document.createElement("div");
    a.className = "rx-related-text";
    const l = document.createElement("span");
    if (l.className = "rx-related-title", l.textContent = n.title, a.appendChild(l), n.subtitle) {
      const c = document.createElement("span");
      c.className = "rx-related-subtitle", c.textContent = n.subtitle, a.appendChild(c);
    }
    if (s.appendChild(a), n.read) {
      const c = document.createElement("span");
      c.className = "rx-related-badge", c.textContent = "Read", s.appendChild(c);
    }
    s.addEventListener("click", () => t(n)), o.appendChild(s);
  }
  e.appendChild(o);
}
function ms(e, r) {
  return En(e, r, 1);
}
function xs(e, r) {
  return En(e, r, -1);
}
function En(e, r, t) {
  if (e.length === 0) return r;
  const o = e.indexOf(r);
  if (o === -1) return e[0];
  const n = (o + t + e.length) % e.length;
  return e[n];
}
const ys = 40;
function vs(e, r) {
  return Math.abs(e) >= ys && Math.abs(e) > Math.abs(r);
}
function ks(e, r, t, o) {
  return vs(r, t) ? e === "sidebar" ? { action: r < 0 ? "cycle-next" : "cycle-prev" } : e === "book" && o ? { action: "close" } : { action: null } : { action: null };
}
function ws(e, r, t) {
  return e && r.contains(e) ? "sidebar" : e && t.contains(e) && !r.contains(e) ? "book" : "other";
}
function Ss(e) {
  return Array.from(e.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((t) => t.offsetParent !== null || t === e);
}
function Es(e) {
  let r = !1;
  function t(o) {
    if (!r || o.key !== "Tab") return;
    const n = Ss(e);
    if (n.length === 0) {
      o.preventDefault(), e.focus();
      return;
    }
    const s = n[0], i = n[n.length - 1], a = e.ownerDocument.activeElement;
    o.shiftKey && a === s ? (o.preventDefault(), i.focus()) : !o.shiftKey && a === i && (o.preventDefault(), s.focus());
  }
  return e.addEventListener("keydown", t), {
    activate() {
      r = !0;
    },
    deactivate() {
      r = !1, e.removeEventListener("keydown", t);
    }
  };
}
const lr = "reactor-left-sidebar-stylesheet";
function Cs(e) {
  if (e.getElementById(lr)) return;
  const r = e.createElement("style");
  r.id = lr, r.textContent = ls, e.head.appendChild(r);
}
function As(e, r, t = {}) {
  var ee, Z;
  const o = e.ownerDocument ?? document;
  Cs(o);
  const n = as(e);
  n.root.classList.add("closed");
  const s = ["contents", "starred"];
  (ee = t.capabilities) != null && ee.related && s.push("related"), n.tabRelated.hidden = !((Z = t.capabilities) != null && Z.related);
  let i = "contents", a = !1, l = !1, c = [];
  const d = /* @__PURE__ */ new Set();
  let u = null, h = null;
  const p = /* @__PURE__ */ new Set();
  let g = [], b = [];
  const m = Es(n.root);
  let f = null;
  function v() {
    return !e.classList.contains("size-desktop");
  }
  function w(S) {
    return S === "contents" ? n.panelContents : S === "starred" ? n.panelStarred : n.panelRelated;
  }
  function N(S) {
    return S === "contents" ? n.tabContents : S === "starred" ? n.tabStarred : n.tabRelated;
  }
  function L() {
    i === "contents" ? fs(
      n.tocScroll,
      n.tocSpacer,
      n.tocWindow,
      { flat: c, collapsed: d, currentHref: u, currentChapterTitle: h, starred: p },
      {
        onActivate: (S) => {
          S.href && r(S.href), v() && F();
        },
        onToggleExpand: (S) => {
          d.has(S.id) ? d.delete(S.id) : d.add(S.id), L();
        },
        onToggleStar: (S) => {
          var le;
          if (!S.href) return;
          const H = !p.has(S.href);
          H ? p.add(S.href) : p.delete(S.href), (le = t.onStarToggle) == null || le.call(t, S.href, S.label, H), L();
        }
      }
    ) : i === "starred" ? gs(n.panelStarred, g, (S) => {
      r(S.href), v() && F();
    }) : bs(n.panelRelated, b, (S) => {
      var H;
      (H = t.onOpenRelated) == null || H.call(t, S.id), v() && F();
    });
  }
  function A(S) {
    S !== i && (N(i).setAttribute("aria-selected", "false"), w(i).hidden = !0, i = S, N(i).setAttribute("aria-selected", "true"), w(i).hidden = !1, L());
  }
  function P(S) {
    const H = S === 1 ? ms(s, i) : xs(s, i);
    A(H);
  }
  n.tabContents.addEventListener("click", () => A("contents")), n.tabStarred.addEventListener("click", () => A("starred")), n.tabRelated.addEventListener("click", () => A("related")), A("contents"), N("contents").setAttribute("aria-selected", "true"), w("contents").hidden = !1;
  function D() {
    var H;
    if (a) return;
    a = !0, f = o.activeElement ?? null, n.root.classList.add("open"), n.root.classList.remove("closed"), e.classList.add("rx-left-sidebar-open"), n.scrim.classList.toggle("visible", v());
    const S = v();
    n.root.setAttribute("role", S ? "dialog" : "complementary"), S ? n.root.setAttribute("aria-modal", "true") : n.root.removeAttribute("aria-modal"), S && (m.activate(), n.root.focus()), (H = t.onSidebarChange) == null || H.call(t, !0);
  }
  function F() {
    var S, H;
    a && (a = !1, n.root.classList.remove("open"), n.root.classList.add("closed"), e.classList.remove("rx-left-sidebar-open"), n.scrim.classList.remove("visible"), m.deactivate(), (S = f == null ? void 0 : f.focus) == null || S.call(f), f = null, (H = t.onSidebarChange) == null || H.call(t, !1));
  }
  n.closeBtn.addEventListener("click", F), n.scrim.addEventListener("click", F), n.backBtn.addEventListener("click", () => {
    var S;
    return (S = t.onBack) == null ? void 0 : S.call(t);
  });
  let W = 0, $ = 0, V = "other", M = !1;
  function U(S) {
    S.pointerType !== "pen" && (W = S.clientX, $ = S.clientY, V = ws(S.target, n.root, e), M = V !== "other");
  }
  function B(S) {
    if (!M) return;
    M = !1;
    const H = S.clientX - W, le = S.clientY - $, K = ks(V, H, le, v());
    !a && K.action !== null || (K.action === "cycle-next" ? P(1) : K.action === "cycle-prev" ? P(-1) : K.action === "close" && F());
  }
  e.addEventListener("pointerdown", U), e.addEventListener("pointerup", B);
  function y(S) {
    c = Sn(S), d.clear(), i === "contents" && L();
  }
  function I(S) {
    g = S, p.clear();
    for (const H of S) p.add(H.href);
    (i === "starred" || i === "contents") && L();
  }
  function _(S) {
    b = S, i === "related" && L();
  }
  function re(S) {
    u = S, i === "contents" && L();
  }
  function ne(S) {
    h = S, i === "contents" && L();
  }
  function X() {
    l || (l = !0, e.removeEventListener("pointerdown", U), e.removeEventListener("pointerup", B), n.closeBtn.removeEventListener("click", F), n.scrim.removeEventListener("click", F), m.deactivate(), e.classList.remove("rx-left-sidebar-open"), n.root.remove(), n.scrim.remove());
  }
  return {
    open: D,
    close: F,
    isOpen: () => a,
    cycleTab: P,
    getActiveTab: () => i,
    setToc: y,
    setStarred: I,
    setRelated: _,
    setCurrentHref: re,
    setCurrentChapterTitle: ne,
    destroy: X
  };
}
function ft(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = "rx-sidebar-tab", t.textContent = e, t.setAttribute("role", "tab"), t.setAttribute("aria-selected", String(r)), r && t.classList.add("active"), t;
}
function Ts(e) {
  const r = e.createElement("div");
  r.className = "rx-right-sidebar", r.setAttribute("role", "complementary"), r.setAttribute("aria-label", "Context panel");
  const t = e.createElement("div");
  t.className = "rx-sidebar-resize", t.setAttribute("role", "separator"), t.setAttribute("aria-orientation", "vertical"), t.setAttribute("aria-label", "Resize context panel"), t.setAttribute("tabindex", "0");
  const o = e.createElement("div");
  o.className = "rx-sidebar-tabs", o.setAttribute("role", "tablist");
  const n = ft("Context", !0), s = ft("Glossary", !1), i = ft("Notes", !1);
  i.disabled = !0;
  const a = e.createElement("button");
  a.type = "button", a.className = "rx-icon-btn rx-sidebar-close", a.setAttribute("aria-label", "Close panel"), a.textContent = "✕", o.append(n, s, i, a);
  const l = e.createElement("div");
  l.className = "rx-ctx-searchbar", l.setAttribute("role", "search");
  const c = e.createElement("input");
  c.type = "search", c.className = "rx-ctx-search-input", c.placeholder = "Search this book", c.setAttribute("aria-label", "Search this book");
  const d = e.createElement("button");
  d.type = "button", d.className = "rx-icon-btn rx-ctx-openmain", d.setAttribute("aria-label", "Open in main window"), d.disabled = !0, d.textContent = "↗";
  const u = e.createElement("div");
  u.className = "rx-ctx-crumbs", u.setAttribute("aria-live", "polite"), l.append(c, d, u);
  const h = e.createElement("div");
  h.className = "rx-sidebar-body";
  const p = e.createElement("div");
  p.className = "rx-ctx-results";
  const g = e.createElement("div");
  g.className = "rx-ctx-page", g.hidden = !0;
  const b = e.createElement("div");
  b.className = "rx-notes-body", b.hidden = !0;
  const m = e.createElement("div");
  return m.className = "rx-glossary-panel-mount", m.hidden = !0, h.append(p, g, b, m), r.append(t, o, l, h), {
    root: r,
    resizeHandle: t,
    tabsRow: o,
    contextTabBtn: n,
    glossaryTabBtn: s,
    notesTabBtn: i,
    closeBtn: a,
    searchBar: l,
    searchInput: c,
    openInMainBtn: d,
    breadcrumb: u,
    body: h,
    resultsScroller: p,
    contextPage: g,
    notesBody: b,
    glossaryPanelMount: m
  };
}
const Ls = `
.rx-right-sidebar {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  width: var(--rx-ctx-width, 340px);
  background: var(--rx-surface);
  border-left: 1px solid var(--rx-border);
  transform: translateX(105%);
  transition: transform var(--rx-motion-bar), width var(--rx-motion-bar);
}
.reader-shell.right-sidebar-open .rx-right-sidebar {
  transform: translateX(0);
}
.reader-shell.right-sidebar-resizing .rx-right-sidebar {
  transition: none;
}
.reader-shell.size-phone .rx-right-sidebar {
  width: min(88%, 340px);
  box-shadow: var(--rx-elevation); /* taste-skill-ignore: a real overlay panel on top of the book, not an at-rest surface */
}
.reader-shell.e-ink.size-phone .rx-right-sidebar {
  box-shadow: none; /* taste-skill-ignore: already shadow-free; e-ink override */
  border-left: 1px solid var(--rx-ink);
}

.rx-sidebar-scrim {
  position: absolute;
  inset: 0;
  z-index: 35;
  background: var(--rx-ink);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--rx-motion-bar);
}
.reader-shell.size-phone.right-sidebar-open .rx-sidebar-scrim {
  opacity: 0.32;
  pointer-events: auto;
}
.reader-shell.e-ink .rx-sidebar-scrim {
  opacity: 0; /* no translucent scrim under eink (hard rule 8) - see mount.ts, phone close still works via the close button */
}

.rx-sidebar-resize {
  position: absolute;
  left: -6px;
  top: 0;
  bottom: 0;
  width: 12px;
  z-index: 1; /* paints above the panel body (results/page), which otherwise covers its right half */
  cursor: col-resize;
  touch-action: none;
}
.reader-shell.size-phone .rx-sidebar-resize {
  display: none;
}

/* Docked layouts (SHELL.md section 2: Fold unfolded/Tablet and Desktop get a "docked, resizable"
 * right sidebar, phone gets an overlay). The book-column push itself is done in JS via
 * setBookInsets (src/shell/layout.ts, shared with U2's left sidebar), which reserves the space as
 * padding on the shell root; these rules just pull the top/bottom bars and tap zones in by the
 * same reserved amount so their controls (Settings, Context) stay reachable instead of sitting
 * under the panel. */
.reader-shell.right-sidebar-open:not(.size-phone) .rx-bar,
.reader-shell.right-sidebar-open:not(.size-phone) .rx-zones {
  right: var(--rx-book-inset-right, 0px);
}
.rx-sidebar-resize:focus-visible {
  outline: 2px solid var(--rx-accent);
  outline-offset: -2px;
}

.rx-sidebar-tabs {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--rx-border);
  flex: 0 0 auto;
}
.rx-sidebar-tab {
  flex: 1 1 auto;
  min-height: 48px;
  border: none;
  background: none;
  color: var(--rx-muted);
  font-size: 13px;
  cursor: pointer;
}
.rx-sidebar-tab.active {
  color: var(--rx-ink);
  box-shadow: inset 0 -2px 0 var(--rx-accent); /* taste-skill-ignore: active-tab indicator, not a resting shadow */
}
.rx-sidebar-tab:disabled {
  opacity: 0.4;
  cursor: default;
}
.rx-sidebar-close {
  display: none;
  flex: 0 0 48px;
}
.reader-shell.size-phone .rx-sidebar-close {
  display: flex;
}

.rx-ctx-searchbar {
  display: flex;
  align-items: center;
  gap: var(--rx-space-2);
  padding: var(--rx-space-2) var(--rx-space-3);
  border-bottom: 1px solid var(--rx-border);
  flex: 0 0 auto;
  flex-wrap: wrap;
}
.rx-ctx-searchbar[hidden] {
  /* U4's Glossary tab hides this bar via the hidden attribute; override the class rule above,
     which otherwise beats the UA [hidden] display:none rule by specificity. */
  display: none;
}
.rx-ctx-search-input {
  flex: 1 1 auto;
  min-height: 48px;
  padding: 0 var(--rx-space-2);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-ground);
  color: var(--rx-ink);
  font-size: 14px;
}
.rx-ctx-crumbs {
  flex: 0 0 100%;
  font-size: 12px;
  color: var(--rx-muted);
  display: flex;
  align-items: center;
  gap: var(--rx-space-1);
}
.rx-ctx-crumbs button {
  background: var(--rx-surface-2);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  color: var(--rx-ink);
  font-size: 13px;
  font-weight: 500;
  min-height: 48px;
  padding: 0 var(--rx-space-3);
  cursor: pointer;
}
.rx-ctx-crumbs button:hover:not(:disabled) {
  background: var(--rx-surface);
  border-color: var(--rx-accent);
}
.rx-ctx-crumbs button:disabled {
  color: var(--rx-muted);
  background: none;
  border-color: var(--rx-border);
  cursor: default;
}

.rx-sidebar-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}
.rx-ctx-results {
  position: absolute;
  inset: 0;
  overflow-y: auto;
}
.rx-wlist-spacer {
  flex: 0 0 auto;
}
.rx-wlist-rows {
  display: flex;
  flex-direction: column;
}
.rx-ctx-group-header {
  padding: var(--rx-space-2) var(--rx-space-3);
  min-height: 48px;
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--rx-muted);
  background: var(--rx-surface-2);
  box-sizing: border-box;
}
.rx-ctx-result {
  padding: var(--rx-space-2) var(--rx-space-3);
  min-height: 48px;
  border-bottom: 1px solid var(--rx-border);
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  text-align: left;
  color: var(--rx-ink);
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  width: 100%;
}
.rx-ctx-result:hover {
  background: var(--rx-surface-2);
}
.rx-ctx-result mark {
  background: none;
  color: var(--rx-accent);
  font-weight: 600;
}

.rx-ctx-page {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--rx-ground);
}

/* The Notes tab's own panel (U5) - a sibling of the Context results/page, same absolute-fill
 * geometry as .rx-ctx-page so switching tabs is a plain hidden-attribute toggle, no reflow. */
.rx-notes-body {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.rx-glossary-panel-mount {
  position: absolute;
  inset: 0;
}
`;
class Ns {
  constructor() {
    T(this, "rows", []);
    T(this, "headerAt", /* @__PURE__ */ new Map());
  }
  reset() {
    this.rows = [], this.headerAt.clear();
  }
  addGroup(r, t) {
    if (t.length !== 0) {
      this.headerAt.has(r) || (this.headerAt.set(r, this.rows.length), this.rows.push({ kind: "header", label: r }));
      for (const o of t) this.rows.push({ kind: "item", item: o, groupLabel: r });
    }
  }
  get rowCount() {
    return this.rows.length;
  }
  rowAt(r) {
    return this.rows[r];
  }
  get isEmpty() {
    return this.rows.length === 0;
  }
}
class Cn {
  constructor(r) {
    T(this, "container");
    T(this, "rowHeight");
    T(this, "buffer");
    T(this, "opts");
    T(this, "topSpacer");
    T(this, "bottomSpacer");
    T(this, "rowsEl");
    T(this, "onScroll");
    T(this, "destroyed", !1);
    this.opts = r, this.container = r.container, this.rowHeight = r.rowHeight, this.buffer = r.buffer ?? 6, this.topSpacer = document.createElement("div"), this.topSpacer.className = "rx-wlist-spacer", this.bottomSpacer = document.createElement("div"), this.bottomSpacer.className = "rx-wlist-spacer", this.rowsEl = document.createElement("div"), this.rowsEl.className = "rx-wlist-rows", this.rowsEl.setAttribute("role", "list"), this.container.replaceChildren(this.topSpacer, this.rowsEl, this.bottomSpacer), this.onScroll = () => this.render(), this.container.addEventListener("scroll", this.onScroll);
  }
  /** The row index range currently rendered, inclusive-exclusive - exposed only for tests that
   * want to assert bounded node counts without depending on DOM child counts specifically. */
  visibleRange() {
    const r = this.opts.rowCount(), t = this.container.clientHeight || 1, o = this.container.scrollTop || 0, n = Math.max(0, Math.floor(o / this.rowHeight) - this.buffer), s = Math.ceil(t / this.rowHeight) + this.buffer * 2, i = Math.min(r, n + s);
    return { first: n, last: i };
  }
  render() {
    if (this.destroyed) return;
    const r = this.opts.rowCount(), { first: t, last: o } = this.visibleRange();
    this.topSpacer.style.height = `${t * this.rowHeight}px`, this.bottomSpacer.style.height = `${Math.max(0, r - o) * this.rowHeight}px`, this.rowsEl.replaceChildren();
    for (let n = t; n < o; n++) this.rowsEl.appendChild(this.opts.renderRow(n));
  }
  destroy() {
    this.destroyed || (this.destroyed = !0, this.container.removeEventListener("scroll", this.onScroll), this.container.replaceChildren());
  }
}
function Bs(e, r) {
  return e.kind !== r.kind ? !1 : e.kind === "page" && r.kind === "page" ? e.target === r.target : !0;
}
class zs {
  constructor() {
    T(this, "stack", [{ kind: "blank" }]);
    T(this, "index", 0);
  }
  get current() {
    return this.stack[this.index] ?? { kind: "blank" };
  }
  get canGoBack() {
    return this.index > 0;
  }
  get canGoForward() {
    return this.index < this.stack.length - 1;
  }
  /** Pushes a new entry, discarding any forward history (normal browser-style navigation). A
   * push that repeats the current entry is a no-op, so re-opening the same result twice doesn't
   * pad the stack. */
  push(r) {
    Bs(this.current, r) || (this.stack = this.stack.slice(0, this.index + 1), this.stack.push(r), this.index = this.stack.length - 1);
  }
  back() {
    return this.canGoBack ? (this.index -= 1, this.current) : null;
  }
  forward() {
    return this.canGoForward ? (this.index += 1, this.current) : null;
  }
  /** Back to the pre-search blank state, dropping all forward history (closing the panel or
   * clearing search both reset to blank per SHELL.md's breadcrumb order: page -> results ->
   * blank). */
  reset() {
    this.stack = [{ kind: "blank" }], this.index = 0;
  }
}
const Is = {
  "fold-tablet": 320,
  desktop: 340
}, Qe = 240, cr = 16, Ps = {
  "fold-tablet": 0.6,
  desktop: 0.7
};
function Fs(e, r, t) {
  const o = Ps[t], n = Math.max(Qe, r * o);
  return e < Qe ? Qe : e > n ? n : e;
}
const An = /* @__PURE__ */ new WeakMap();
function gt(e) {
  return An.get(e) ?? { left: 0, right: 0, bottom: 0 };
}
function Le(e, r) {
  const t = {
    left: Math.max(0, r.left ?? gt(e).left),
    right: Math.max(0, r.right ?? gt(e).right),
    bottom: Math.max(0, r.bottom ?? gt(e).bottom)
  };
  return An.set(e, t), e.style.setProperty("--rx-book-inset-left", `${t.left}px`), e.style.setProperty("--rx-book-inset-right", `${t.right}px`), e.style.setProperty("--rx-book-inset-bottom", `${t.bottom}px`), e.style.paddingLeft = t.left ? `${t.left}px` : "", e.style.paddingRight = t.right ? `${t.right}px` : "", e.style.paddingBottom = t.bottom ? `${t.bottom}px` : "", t;
}
const $s = [
  { id: "all", label: "All" },
  { id: "highlight", label: "Highlight" },
  { id: "underline", label: "Underline" },
  { id: "note", label: "Typed note" },
  { id: "handwritten", label: "Handwritten" },
  { id: "bookmark", label: "Bookmark" }
], Ms = [
  { id: "position", label: "Position in book" },
  { id: "date", label: "Date" },
  { id: "colour", label: "Colour" },
  { id: "type", label: "Type" }
];
function Rs(e) {
  const r = e.createElement("div");
  r.className = "rx-notes-panel";
  const t = e.createElement("div");
  t.className = "rx-notes-searchbar", t.setAttribute("role", "search");
  const o = e.createElement("input");
  o.type = "search", o.className = "rx-notes-search-input", o.placeholder = "Search notes", o.setAttribute("aria-label", "Search notes"), t.append(o);
  const n = e.createElement("select");
  n.className = "rx-notes-sort", n.setAttribute("aria-label", "Sort notes by");
  for (const { id: c, label: d } of Ms) {
    const u = e.createElement("option");
    u.value = c, u.textContent = d, n.append(u);
  }
  t.append(n);
  const s = e.createElement("div");
  s.className = "rx-notes-filters", s.setAttribute("role", "group"), s.setAttribute("aria-label", "Filter notes by type");
  const i = {};
  for (const { id: c, label: d } of $s) {
    const u = e.createElement("button");
    u.type = "button", u.className = "rx-notes-chip", u.textContent = d, u.setAttribute("aria-pressed", String(c === "all")), c === "all" && u.classList.add("active"), u.dataset.filter = c, s.append(u), i[c] = u;
  }
  const a = e.createElement("div");
  a.className = "rx-notes-banner", a.hidden = !0, a.textContent = "No annotation store connected. Notes made in this session are not saved.";
  const l = e.createElement("div");
  return l.className = "rx-notes-list", r.append(t, s, a, l), { root: r, searchBar: t, searchInput: o, filterRow: s, filterButtons: i, sortSelect: n, capabilityBanner: a, listScroller: l };
}
const Os = `
.rx-notes-panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--rx-ground);
}
.rx-notes-searchbar {
  display: flex;
  gap: var(--rx-space-2);
  padding: var(--rx-space-2) var(--rx-space-3);
  border-bottom: 1px solid var(--rx-border);
  flex: 0 0 auto;
}
.rx-notes-search-input {
  flex: 1 1 auto;
  min-height: 48px;
  padding: 0 var(--rx-space-2);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-surface);
  color: var(--rx-ink);
  font-size: 14px;
}
.rx-notes-sort {
  min-height: 48px;
  min-width: 44px;
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-surface);
  color: var(--rx-ink);
  font-size: 13px;
}
.rx-notes-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rx-space-2);
  padding: var(--rx-space-2) var(--rx-space-3);
  border-bottom: 1px solid var(--rx-border);
  flex: 0 0 auto;
}
.rx-notes-chip {
  min-height: 44px;
  padding: 0 var(--rx-space-3);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-surface);
  color: var(--rx-muted);
  font-size: 13px;
  cursor: pointer;
}
.rx-notes-chip.active {
  color: var(--rx-ink);
  border-color: var(--rx-accent);
  background: var(--rx-surface-2);
}
.rx-notes-banner {
  padding: var(--rx-space-2) var(--rx-space-3);
  font-size: 12px;
  color: var(--rx-muted);
  background: var(--rx-surface-2);
  flex: 0 0 auto;
}
.rx-notes-list {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.rx-notes-row {
  display: flex;
  align-items: center;
  gap: var(--rx-space-2);
  min-height: 48px;
  padding: var(--rx-space-2) var(--rx-space-3);
  border-bottom: 1px solid var(--rx-border);
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  text-align: left;
  color: var(--rx-ink);
  font-size: 13px;
  width: 100%;
  cursor: pointer;
}
.rx-notes-row:hover {
  background: var(--rx-surface-2);
}
.rx-notes-row-swatch {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--rx-notes-row-color, var(--rx-muted));
}
.reader-shell.e-ink .rx-notes-row-swatch {
  border-radius: 0;
  border: 1px solid var(--rx-ink);
}
.rx-notes-row-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.rx-notes-row-snippet {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rx-notes-row-meta {
  font-size: 11px;
  color: var(--rx-muted);
}
.rx-notes-loading-row {
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 0 var(--rx-space-3);
  color: var(--rx-muted);
  font-size: 12px;
}
.rx-notes-empty {
  padding: var(--rx-space-4);
  color: var(--rx-muted);
  font-size: 13px;
  text-align: center;
}
`, _s = 100, Hs = 20;
function Ds(e) {
  return e === "all" ? null : e;
}
class Gs {
  constructor(r) {
    T(this, "total", 0);
    T(this, "offset", 0);
    T(this, "items", []);
    T(this, "state", { filter: "all", sort: "position", query: null });
    T(this, "lastRequestedOffset", null);
    T(this, "everRequested", !1);
    this.hostChannel = r;
  }
  getState() {
    return this.state;
  }
  /** Resets the window and re-requests page 0 under a new filter/sort/search combination. */
  setState(r) {
    this.state = { ...this.state, ...r }, this.total = 0, this.offset = 0, this.items = [], this.lastRequestedOffset = null, this.requestPage(0);
  }
  /** Requests the first page once, the first time the tab is activated - idempotent so
   * re-activating an already-loaded tab never re-fetches. */
  ensureInitialLoad() {
    this.everRequested || this.requestPage(0);
  }
  rowCount() {
    return this.total;
  }
  rowAt(r) {
    const t = r - this.offset;
    if (!(t < 0 || t >= this.items.length))
      return this.items[t];
  }
  /** Called by the renderer with the currently visible row range; requests a new window only
   * when some of that range isn't already loaded (never requests "all of them" at once). */
  ensureLoaded(r, t) {
    const o = Math.max(r, t - 1);
    if (this.rowAt(r) && this.rowAt(o)) return;
    const n = Math.max(0, r - Hs);
    this.lastRequestedOffset !== n && this.requestPage(n);
  }
  requestPage(r) {
    this.everRequested = !0, this.lastRequestedOffset = r, this.hostChannel.emitIntent({
      type: "notesPageRequest",
      offset: r,
      limit: _s,
      filter: Ds(this.state.filter),
      sort: this.state.sort,
      query: this.state.query
    });
  }
  applyWindow(r) {
    this.total = r.total, this.offset = r.offset, this.items = r.items, this.lastRequestedOffset = null;
  }
}
const dr = "reactor-notes-stylesheet", js = 48, Ws = 200, ur = {
  highlight: "Highlight",
  underline: "Underline",
  note: "Typed note",
  bookmark: "Bookmark"
};
function Us(e, r) {
  return r ? `${ur[e]} · ${r}` : ur[e];
}
function Vs({ container: e, core: r, hostChannel: t, options: o = {} }) {
  const n = e.ownerDocument ?? document;
  if (!n.getElementById(dr)) {
    const A = n.createElement("style");
    A.id = dr, A.textContent = Os, n.head.appendChild(A);
  }
  const s = Rs(n);
  e.append(s.root);
  const i = new Gs(t);
  let a = !1, l = null;
  const c = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Set();
  function u(A) {
    c.has(A) || d.has(A) || typeof r.getChapterTitleForCfi == "function" && (d.add(A), r.getChapterTitleForCfi(A).then((P) => {
      c.set(A, P);
    }).catch(() => {
      c.set(A, null);
    }).finally(() => {
      d.delete(A), !a && p.render();
    }));
  }
  function h(A) {
    i.ensureLoaded(A, A + 1);
    const P = i.rowAt(A);
    if (!P) {
      const B = n.createElement("div");
      return B.className = "rx-notes-loading-row", B.setAttribute("role", "listitem"), B.textContent = "Loading…", B;
    }
    const D = n.createElement("button");
    D.type = "button", D.className = "rx-notes-row";
    const F = n.createElement("span");
    F.className = "rx-notes-row-swatch", P.color && F.style.setProperty("--rx-notes-row-color", P.color);
    const W = n.createElement("span");
    W.className = "rx-notes-row-body";
    const $ = n.createElement("span");
    $.className = "rx-notes-row-snippet", $.textContent = P.note ?? P.text ?? "";
    const V = n.createElement("span");
    V.className = "rx-notes-row-meta";
    const M = c.get(P.cfi);
    V.textContent = Us(P.kind, M ?? null), W.append($, V), D.append(F, W), D.setAttribute("aria-label", `${V.textContent}: ${$.textContent}`), M === void 0 && u(P.cfi), D.addEventListener("click", () => r.goTo(P.cfi));
    const U = n.createElement("div");
    return U.setAttribute("role", "listitem"), U.appendChild(D), U;
  }
  const p = new Cn({
    container: s.listScroller,
    rowHeight: js,
    rowCount: () => i.rowCount(),
    renderRow: h
  });
  function g(A) {
    const P = A.currentTarget, D = P.dataset.filter ?? "all";
    for (const F of Object.values(s.filterButtons))
      F.classList.toggle("active", F === P), F.setAttribute("aria-pressed", String(F === P));
    i.setState({ filter: D }), p.render();
  }
  for (const A of Object.values(s.filterButtons)) A.addEventListener("click", g);
  function b() {
    i.setState({ sort: s.sortSelect.value }), p.render();
  }
  s.sortSelect.addEventListener("change", b);
  function m() {
    l && clearTimeout(l), l = setTimeout(() => {
      i.setState({ query: s.searchInput.value.trim() || null }), p.render();
    }, Ws);
  }
  s.searchInput.addEventListener("input", m);
  function f(A) {
    A.type === "setNotes" && (i.applyWindow(A), p.render());
  }
  const v = t.onCommand(f);
  function w() {
    var A;
    s.capabilityBanner.hidden = ((A = t.getConfig()) == null ? void 0 : A.capabilities.notes) !== !1, i.ensureInitialLoad(), p.render();
  }
  function N() {
    p.render();
  }
  function L() {
    if (!a) {
      a = !0, l && clearTimeout(l), v();
      for (const A of Object.values(s.filterButtons)) A.removeEventListener("click", g);
      s.sortSelect.removeEventListener("change", b), s.searchInput.removeEventListener("input", m), p.destroy(), s.root.remove();
    }
  }
  return { onActivate: w, refresh: N, destroy: L };
}
function qs(e) {
  const r = e.createElement("div");
  r.className = "rx-glossary-panel", r.style.position = "absolute", r.style.inset = "0";
  const t = e.createElement("div");
  t.className = "rx-glossary-search", t.setAttribute("role", "search");
  const o = e.createElement("input");
  o.type = "search", o.className = "rx-glossary-search-input", o.placeholder = "Search glossary", o.setAttribute("aria-label", "Search glossary"), t.appendChild(o);
  const n = e.createElement("div");
  return n.className = "rx-glossary-list", n.setAttribute("role", "list"), r.append(t, n), { root: r, searchInput: o, list: n };
}
const Ks = 900;
function Ys(e) {
  const r = e.ownerDocument ?? document, t = qs(r);
  e.appendChild(t.root);
  let o = [], n = "", s = !1;
  function i() {
    const h = n.trim().toLowerCase();
    return [...h ? o.filter((g) => g.term.toLowerCase().includes(h)) : o].sort((g, b) => g.term.localeCompare(b.term));
  }
  function a() {
    if (s) return;
    const h = i();
    if (t.list.replaceChildren(), !o.length) {
      const p = r.createElement("div");
      p.className = "rx-glossary-empty", p.textContent = "This book has no glossary.", t.list.appendChild(p);
      return;
    }
    if (!h.length) {
      const p = r.createElement("div");
      p.className = "rx-glossary-empty", p.textContent = `No terms match "${n}".`, t.list.appendChild(p);
      return;
    }
    for (const p of h) {
      let g = function() {
        const v = b.classList.toggle("expanded");
        m.setAttribute("aria-expanded", String(v));
      };
      const b = r.createElement("div");
      b.className = "rx-glossary-item", b.setAttribute("role", "listitem"), b.setAttribute("data-term", p.term);
      const m = r.createElement("button");
      m.type = "button", m.className = "rx-glossary-term-row", m.setAttribute("role", "button"), m.setAttribute("aria-expanded", "false"), m.textContent = p.term;
      const f = r.createElement("div");
      f.className = "rx-glossary-def", f.textContent = p.definition, m.addEventListener("click", g), b.append(m, f), t.list.appendChild(b);
    }
  }
  function l() {
    n = t.searchInput.value, a();
  }
  t.searchInput.addEventListener("input", l), a();
  function c(h) {
    o = h, a();
  }
  function d(h) {
    var g, b;
    n && (n = "", t.searchInput.value = "", a());
    const p = t.list.querySelector(`.rx-glossary-item[data-term="${CSS.escape(h)}"]`);
    p && (p.classList.add("expanded"), (g = p.querySelector(".rx-glossary-term-row")) == null || g.setAttribute("aria-expanded", "true"), (b = p.scrollIntoView) == null || b.call(p, { block: "center" }), p.classList.add("flash"), setTimeout(() => p.classList.remove("flash"), Ks));
  }
  function u() {
    s || (s = !0, t.searchInput.removeEventListener("input", l), t.root.remove());
  }
  return { setTerms: c, scrollToAndFlash: d, destroy: u };
}
const pr = 9, _e = 8, hr = 16;
function Xs(e, r, t, o) {
  const n = e.top + e.height;
  let s = e.left;
  s = Math.min(Math.max(_e, s), Math.max(_e, r.width - t - _e));
  let i = n + pr, a = !1;
  if (i + o > r.height - _e) {
    const c = e.top - o - pr;
    i = Math.max(_e, c), a = !0;
  }
  const l = Math.max(hr, Math.min(t - hr, e.left + e.width / 2 - s));
  return { left: s, top: i, above: a, arrowX: l };
}
const Zs = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
function Js(e, r, t) {
  const o = e.ownerDocument ?? document;
  let n = null, s = !1;
  function i() {
    n == null || n.remove(), n = null;
  }
  function a(p, g) {
    i();
    const b = o.createElement("div");
    b.className = "rx-glossary-popover", b.setAttribute("role", "dialog"), b.setAttribute("aria-label", `${p.term} definition`), b.innerHTML = `
      <div class="rx-glossary-popover-head">
        <h4 class="rx-glossary-popover-term"></h4>
        <button type="button" class="rx-icon-btn rx-glossary-popover-open" aria-label="Open in glossary" title="Open in glossary">${Zs}</button>
      </div>
      <p class="rx-glossary-popover-def"></p>
    `, b.querySelector(".rx-glossary-popover-term").textContent = p.term, b.querySelector(".rx-glossary-popover-def").textContent = p.definition, e.appendChild(b), n = b;
    const m = e.getBoundingClientRect(), f = { left: g.left - m.left, top: g.top - m.top, width: g.width, height: g.height }, v = { width: m.width, height: m.height }, w = Xs(f, v, b.offsetWidth, b.offsetHeight || 120);
    b.style.left = `${w.left}px`, b.style.top = `${w.top}px`, b.classList.toggle("above", w.above), b.style.setProperty("--arrow-x", `${w.arrowX}px`), b.querySelector(".rx-glossary-popover-open").addEventListener("click", (N) => {
      N.stopPropagation(), i(), t.onOpenInGlossary(p.term);
    });
  }
  async function l(p, g) {
    const b = await r.getGlossaryTerms();
    if (s) return;
    const m = b.find((f) => f.term.toLowerCase() === p.toLowerCase());
    m && a(m, g);
  }
  const c = r.onGlossaryTermTap(l);
  function d(p) {
    var b;
    if (!n) return;
    const g = p.target;
    (b = g == null ? void 0 : g.closest) != null && b.call(g, ".rx-glossary-popover") || i();
  }
  function u(p) {
    p.key === "Escape" && n && i();
  }
  o.addEventListener("click", d), o.addEventListener("keydown", u);
  function h() {
    s || (s = !0, c(), o.removeEventListener("click", d), o.removeEventListener("keydown", u), i());
  }
  return { destroy: h };
}
const Qs = `
.rx-glossary-search {
  display: flex;
  align-items: center;
  padding: var(--rx-space-2) var(--rx-space-3);
  border-bottom: 1px solid var(--rx-border);
  flex: 0 0 auto;
}
.rx-glossary-search-input {
  flex: 1 1 auto;
  min-height: 48px;
  padding: 0 var(--rx-space-2);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-ground);
  color: var(--rx-ink);
  font-size: 14px;
}
.rx-glossary-list {
  position: absolute;
  inset: 0;
  top: 65px; /* below the fixed-height search bar */
  overflow-y: auto;
}
.rx-glossary-item {
  padding: var(--rx-space-2) var(--rx-space-3);
  border-bottom: 1px solid var(--rx-border);
}
.rx-glossary-term-row {
  min-height: 48px;
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--rx-ink);
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  padding: 0;
}
.rx-glossary-def {
  font-size: 12px;
  color: var(--rx-muted);
  margin-top: 3px;
  line-height: 1.45;
  display: none;
}
.rx-glossary-item.expanded .rx-glossary-def {
  display: block;
}
.rx-glossary-empty {
  padding: var(--rx-space-4) var(--rx-space-3);
  text-align: center;
  font-size: 13px;
  color: var(--rx-muted);
}
.rx-glossary-item.flash {
  background: var(--rx-surface-2);
}

.rx-glossary-popover {
  position: absolute;
  z-index: 90;
  background: var(--rx-surface);
  color: var(--rx-ink);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  box-shadow: var(--rx-elevation); /* taste-skill-ignore: a true floater (role=dialog popover), the app-screens shadow exception */
  padding: var(--rx-space-2) var(--rx-space-3) var(--rx-space-3);
  width: max-content;
  min-width: 168px;
  max-width: min(288px, calc(100% - 16px));
  animation: rx-glossary-pop-in var(--rx-motion-fast) ease;
}
.reader-shell.e-ink .rx-glossary-popover,
.reader-shell.reduced-motion .rx-glossary-popover {
  animation: none;
}
@keyframes rx-glossary-pop-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.rx-glossary-popover-head {
  display: flex;
  align-items: center;
  gap: var(--rx-space-2);
}
.rx-glossary-popover-term {
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}
.rx-glossary-popover-def {
  margin: var(--rx-space-1) 0 0;
  font-size: 14px;
  line-height: 1.45;
}
.rx-glossary-popover-open {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  color: var(--rx-accent);
}
`, fr = "reactor-right-sidebar-stylesheet", gr = "reactor-glossary-stylesheet", ei = 48, ti = 200;
function ri(e) {
  if (!e.getElementById(fr)) {
    const r = e.createElement("style");
    r.id = fr, r.textContent = Ls, e.head.appendChild(r);
  }
  if (!e.getElementById(gr)) {
    const r = e.createElement("style");
    r.id = gr, r.textContent = Qs, e.head.appendChild(r);
  }
}
function ni(e) {
  const r = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `${r(e.pre)}<mark>${r(e.match)}</mark>${r(e.post)}`;
}
function Tn(e, r, t) {
  var Re, Ue;
  const o = e.ownerDocument ?? document;
  ri(o);
  const n = Ts(o), s = o.createElement("div");
  s.className = "rx-sidebar-scrim", e.append(s, n.root);
  const i = new Ns(), a = new zs(), l = Ys(n.glossaryPanelMount);
  let c = "context", d = null, u = !1, h = !1, p = null;
  const g = !!t.hostChannel && ((Re = t.hostChannel.getConfig()) == null ? void 0 : Re.capabilities.notes) !== !1;
  n.notesTabBtn.disabled = !g;
  const b = g ? Vs({ container: n.notesBody, core: r, hostChannel: t.hostChannel }) : null;
  ((Ue = t.capabilities) == null ? void 0 : Ue.glossary) === !1 && (n.glossaryTabBtn.hidden = !0);
  function m(k) {
    k !== c && (c = k, n.contextTabBtn.classList.toggle("active", k === "context"), n.contextTabBtn.setAttribute("aria-selected", String(k === "context")), n.glossaryTabBtn.classList.toggle("active", k === "glossary"), n.glossaryTabBtn.setAttribute("aria-selected", String(k === "glossary")), n.notesTabBtn.classList.toggle("active", k === "notes"), n.notesTabBtn.setAttribute("aria-selected", String(k === "notes")), n.searchBar.hidden = k !== "context", n.glossaryPanelMount.hidden = k !== "glossary", n.notesBody.hidden = k !== "notes", k === "context" ? $(a.current) : k === "glossary" ? (n.resultsScroller.hidden = !0, n.contextPage.hidden = !0, r.getGlossaryTerms().then((O) => l.setTerms(O))) : (n.resultsScroller.hidden = !0, n.contextPage.hidden = !0, b == null || b.onActivate()));
  }
  const f = () => m("context"), v = () => m("glossary"), w = () => m("notes");
  n.contextTabBtn.addEventListener("click", f), n.glossaryTabBtn.addEventListener("click", v), n.notesTabBtn.addEventListener("click", w);
  function N(k) {
    const O = i.rowAt(k);
    if (!O) return o.createElement("div");
    if (O.kind === "header") {
      const Se = o.createElement("div");
      return Se.className = "rx-ctx-group-header", Se.setAttribute("role", "listitem"), Se.textContent = O.label, Se;
    }
    const se = o.createElement("button");
    se.type = "button", se.className = "rx-ctx-result", se.setAttribute("role", "listitem"), se.innerHTML = ni(O.item), se.addEventListener("click", () => U(O.item, O.groupLabel));
    const be = o.createElement("div");
    return be.setAttribute("role", "listitem"), be.appendChild(se), be;
  }
  const L = new Cn({
    container: n.resultsScroller,
    rowHeight: ei,
    rowCount: () => i.rowCount,
    renderRow: N
  });
  function A() {
    n.breadcrumb.replaceChildren();
    const k = o.createElement("button");
    k.type = "button", k.textContent = "Back", k.disabled = !a.canGoBack, k.setAttribute("aria-label", "Back"), k.addEventListener("click", V);
    const O = o.createElement("button");
    O.type = "button", O.textContent = "Forward", O.disabled = !a.canGoForward, O.setAttribute("aria-label", "Forward"), O.addEventListener("click", M), n.breadcrumb.append(k, O), n.openInMainBtn.disabled = a.current.kind !== "page";
  }
  function P() {
    n.resultsScroller.hidden = !1, n.contextPage.hidden = !0, L.render();
  }
  function D() {
    n.resultsScroller.hidden = !1, n.contextPage.hidden = !0, L.render();
  }
  function F() {
    return d || (d = r.createSecondaryView(n.contextPage), d);
  }
  function W(k) {
    n.resultsScroller.hidden = !0, n.contextPage.hidden = !1;
    const O = F();
    O && O.goTo(k);
  }
  function $(k) {
    k.kind === "blank" ? D() : k.kind === "results" ? P() : W(k.target), A();
  }
  function V() {
    const k = a.back();
    k && $(k);
  }
  function M() {
    const k = a.forward();
    k && $(k);
  }
  function U(k, O) {
    a.push({ kind: "page", target: k.cfi, label: O }), $(a.current);
  }
  function B() {
    const k = n.searchInput.value.trim();
    i.reset(), k ? a.current.kind !== "results" && a.push({ kind: "results" }) : a.reset(), $(a.current), p && clearTimeout(p), k && (p = setTimeout(() => r.runSearch(k), ti));
  }
  n.searchInput.addEventListener("input", B);
  function y(k) {
    k.type === "searchResults" ? (i.addGroup(k.label, k.items), a.current.kind === "results" && L.render()) : k.type === "loaded" && l.setTerms([]);
  }
  const I = r.on(y);
  function _() {
    const k = a.current;
    k.kind === "page" && (r.goTo(k.target), t.getSizeClass() === "phone" && x());
  }
  n.openInMainBtn.addEventListener("click", _);
  function re() {
    x();
  }
  n.closeBtn.addEventListener("click", re);
  const ne = () => x();
  s.addEventListener("click", ne);
  function X() {
    const k = getComputedStyle(e).getPropertyValue("--rx-ctx-width"), O = parseFloat(k);
    if (!Number.isNaN(O) && O > 0) return O;
    const se = t.getSizeClass();
    return se === "phone" ? Qe : Is[se];
  }
  function ee(k, O) {
    var Se;
    const se = t.getSizeClass();
    if (se === "phone") return;
    const be = Fs(k, e.clientWidth || 1200, se);
    e.style.setProperty("--rx-ctx-width", `${be}px`), n.resizeHandle.setAttribute("aria-valuenow", String(Math.round(be))), u && Le(e, { right: be }), O && ((Se = t.onWidthChange) == null || Se.call(t, be));
  }
  let Z = !1, S = 0, H = 0;
  function le(k) {
    Z = !0, S = k.clientX, H = X(), e.classList.add("right-sidebar-resizing"), o.addEventListener("pointermove", K), o.addEventListener("pointerup", ve);
  }
  function K(k) {
    Z && ee(H - (k.clientX - S), !1);
  }
  function ve() {
    Z && (Z = !1, e.classList.remove("right-sidebar-resizing"), o.removeEventListener("pointermove", K), o.removeEventListener("pointerup", ve), ee(X(), !0));
  }
  function ke(k) {
    k.key === "ArrowLeft" ? (k.preventDefault(), ee(X() + cr, !0)) : k.key === "ArrowRight" && (k.preventDefault(), ee(X() - cr, !0));
  }
  n.resizeHandle.addEventListener("pointerdown", le), n.resizeHandle.addEventListener("keydown", ke);
  function we() {
    u || (u = !0, e.classList.add("right-sidebar-open"), ee(X(), !1), L.render(), c === "notes" && (b == null || b.refresh()));
  }
  function x() {
    var k;
    u && (u = !1, e.classList.remove("right-sidebar-open"), Le(e, { right: 0 }), (k = t.onClose) == null || k.call(t));
  }
  function z() {
    u ? x() : we();
  }
  function te(k) {
    u || we(), m("glossary"), r.getGlossaryTerms().then((O) => {
      l.setTerms(O), l.scrollToAndFlash(k);
    });
  }
  function ge() {
    u && (t.getSizeClass() === "phone" ? Le(e, { right: 0 }) : Le(e, { right: X() }));
  }
  $(a.current);
  function Te() {
    h || (h = !0, p && clearTimeout(p), I(), n.searchInput.removeEventListener("input", B), n.openInMainBtn.removeEventListener("click", _), n.closeBtn.removeEventListener("click", re), s.removeEventListener("click", ne), n.resizeHandle.removeEventListener("pointerdown", le), o.removeEventListener("pointermove", K), o.removeEventListener("pointerup", ve), n.resizeHandle.removeEventListener("keydown", ke), n.contextTabBtn.removeEventListener("click", f), n.notesTabBtn.removeEventListener("click", w), b == null || b.destroy(), n.glossaryTabBtn.removeEventListener("click", v), l.destroy(), L.destroy(), d == null || d.destroy(), e.classList.remove("right-sidebar-open", "right-sidebar-resizing"), Le(e, { right: 0 }), n.root.remove(), s.remove());
  }
  return { open: we, close: x, toggle: z, isOpen: () => u, destroy: Te, refreshLayout: ge, openGlossaryTerm: te };
}
function qe(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = r, t.setAttribute("aria-label", e), t;
}
function oi(e) {
  const r = e.createElement("div");
  r.className = "rx-playback-bar", r.setAttribute("role", "group"), r.setAttribute("aria-label", "Narration transport");
  const t = qe("Skip back 15 seconds", "rx-playback-icon-btn rx-playback-skip-back");
  t.textContent = "⏪";
  const o = qe("Play", "rx-playback-icon-btn rx-playback-play-pause");
  o.setAttribute("aria-pressed", "false"), o.textContent = "▶";
  const n = qe("Skip forward 15 seconds", "rx-playback-icon-btn rx-playback-skip-forward");
  n.textContent = "⏩";
  const s = qe("Playback speed", "rx-playback-rate-btn");
  s.textContent = "1x";
  const i = e.createElement("div");
  i.className = "rx-playback-info", i.setAttribute("aria-live", "polite");
  const a = e.createElement("span");
  a.className = "rx-playback-chapter";
  const l = e.createElement("span");
  return l.className = "rx-playback-position", l.textContent = "0:00", i.append(a, l), r.append(t, o, n, i, s), { root: r, skipBackBtn: t, playPauseBtn: o, skipForwardBtn: n, rateBtn: s, chapterLabel: a, positionLabel: l };
}
const si = `
.rx-playback-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: var(--rx-space-2);
  padding: var(--rx-space-2) var(--rx-space-3);
  background: color-mix(in srgb, var(--rx-surface) 92%, transparent);
  border-top: 1px solid var(--rx-border); /* taste-skill-ignore: fixed transport bar above the reading surface, not a decorative divider */
  box-shadow: 0 -10px 24px rgba(20, 20, 30, 0.14); /* taste-skill-ignore: real sticky overlay bar, not an at-rest element */
}
.reader-shell.e-ink .rx-playback-bar,
.rx-playback-bar.e-ink {
  background: var(--rx-surface);
  border-top: 1px solid var(--rx-ink); /* taste-skill-ignore: e-ink has no shadow to separate the bar, needs a real border */
  box-shadow: none; /* taste-skill-ignore: disables the one real shadow above for e-ink, not a new one */
}

.rx-playback-icon-btn,
.rx-playback-rate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  min-height: 48px;
  border: none;
  background: none;
  color: var(--rx-ink);
  border-radius: var(--rx-radius);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.rx-playback-rate-btn {
  font-size: 13px;
  font-weight: 600;
  padding: 0 var(--rx-space-2);
}
.rx-playback-icon-btn:hover,
.rx-playback-rate-btn:hover {
  background: var(--rx-surface-2);
}
.rx-playback-play-pause[aria-pressed='true'] {
  color: var(--rx-accent);
}
.rx-playback-icon-btn:focus-visible,
.rx-playback-rate-btn:focus-visible {
  outline: 2px solid var(--rx-accent);
  outline-offset: 2px;
}

.rx-playback-info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  color: var(--rx-muted);
}
.rx-playback-chapter {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rx-ink);
  font-size: 13px;
}
.rx-playback-position {
  font-variant-numeric: tabular-nums;
}

/* U1's own reading bottom bar (chapter/scrubber) sits at bottom:0 too (src/shell/stylesheet.ts);
 * once this bar reserves space via setBookInsets (src/shell/layout.ts), shift that bar up by the
 * same amount so the two stack instead of overlapping. Defaults to 0 (no-op) whenever the
 * playback bar isn't mounted, same pattern U2/U3 use for their own book-inset CSS variables. */
.reader-shell .rx-bar-bottom {
  bottom: var(--rx-book-inset-bottom, 0px);
}
`;
class ii {
  constructor() {
    T(this, "timeline", null);
    T(this, "activeAudioIndex", 0);
  }
  setTimeline(r) {
    this.timeline = r, this.activeAudioIndex = 0;
  }
  clear() {
    this.timeline = null, this.activeAudioIndex = 0;
  }
  hasTimeline() {
    return this.timeline !== null;
  }
  /** The narrated item whose `[beginSec, endSec)` window contains `positionSec`, or null if the
   * position falls outside every item (silence, credits, before/after the narrated audio). */
  itemFor(r) {
    const t = this.timeline;
    if (!t) return null;
    const o = (s) => s.beginSec <= r && (s.endSec === null || r < s.endSec);
    let n = t.items.filter((s) => s.audioIndex === this.activeAudioIndex && o(s));
    if (n.length === 0) {
      n = t.items.filter(o);
      const s = n[0];
      s && (this.activeAudioIndex = s.audioIndex);
    }
    return n.length === 0 ? null : n.reduce((s, i) => i.beginSec > s.beginSec ? i : s);
  }
  textHrefFor(r) {
    var t;
    return ((t = this.itemFor(r)) == null ? void 0 : t.textHref) ?? null;
  }
}
const br = "reactor-playback-stylesheet", mr = 15, Ge = [0.75, 1, 1.25, 1.5, 1.75, 2];
function ai(e) {
  if (e.getElementById(br)) return;
  const r = e.createElement("style");
  r.id = br, r.textContent = si, e.head.appendChild(r);
}
function li(e) {
  const r = Number.isFinite(e) && e > 0 ? e : 0, t = Math.floor(r), o = Math.floor(t / 60), n = t % 60;
  return `${o}:${String(n).padStart(2, "0")}`;
}
function xr(e) {
  return Ge.reduce((r, t) => Math.abs(t - e) < Math.abs(r - e) ? t : r, Ge[0] ?? 1);
}
function Ln(e, r, t, o = {}) {
  const n = e.ownerDocument ?? document;
  ai(n);
  let s = null, i = !1, a = !1, l = !1, c = !1, d = 0, u = 1, h = !1, p = 0;
  const g = new ii();
  function b(B, y = null, I = null) {
    t.emitIntent({ type: "playback", action: B, positionSec: y, rate: I });
  }
  const m = () => b(c ? "pause" : "play"), f = () => b("seek", Math.max(0, d - mr)), v = () => b("seek", d + mr), w = () => {
    const B = Ge.indexOf(xr(u)), y = Ge[(B + 1) % Ge.length] ?? 1;
    b("rateChange", null, y);
  };
  function N() {
    s && (s.playPauseBtn.setAttribute("aria-pressed", String(c)), s.playPauseBtn.setAttribute("aria-label", c ? "Pause" : "Play"), s.playPauseBtn.textContent = c ? "⏸" : "▶", s.positionLabel.textContent = li(d), s.rateBtn.textContent = `${xr(u)}x`);
  }
  function L(B) {
    s && (s.chapterLabel.textContent = B ?? "");
  }
  function A() {
    i || a || (i = !0, s = oi(n), s.root.classList.toggle("e-ink", !!o.eink), e.appendChild(s.root), s.playPauseBtn.addEventListener("click", m), s.skipBackBtn.addEventListener("click", f), s.skipForwardBtn.addEventListener("click", v), s.rateBtn.addEventListener("click", w), Le(e, { bottom: s.root.offsetHeight || 56 }), N(), P());
  }
  function P() {
    !i || !h || (p += 1, r.narrationPrepare(p));
  }
  function D() {
    if (!i || !h) return;
    const B = g.textHrefFor(d);
    B ? r.narrationHighlight(B) : r.narrationUnhighlight();
  }
  function F(B) {
    switch (B.type) {
      case "loaded":
        h = B.hasMediaOverlay, g.clear(), P();
        break;
      case "relocate":
        L(B.chapterTitle);
        break;
      case "narrationTimeline":
        B.generation === p && (g.setTimeline(B), D());
        break;
      case "narrationTimelineError":
        B.generation === p && g.clear();
        break;
    }
  }
  const W = r.on(F);
  function $(B) {
    if (B.type === "configure") {
      if (l) return;
      l = !0, B.capabilities.playback && A();
    } else if (B.type === "setPlaybackState") {
      if (!i) return;
      c = B.playing, d = B.positionSec, u = B.rate, N(), D();
    }
  }
  const V = t.onCommand($), M = t.getConfig();
  M && $(M);
  function U() {
    a || (a = !0, W(), V(), s && (s.playPauseBtn.removeEventListener("click", m), s.skipBackBtn.removeEventListener("click", f), s.skipForwardBtn.removeEventListener("click", v), s.rateBtn.removeEventListener("click", w), s.root.remove(), Le(e, { bottom: 0 })));
  }
  return {
    isVisible: () => i,
    destroy: U
  };
}
const Nn = [
  { id: "yellow", label: "Yellow", value: "#FACC15" },
  { id: "green", label: "Green", value: "#34D399" },
  { id: "blue", label: "Blue", value: "#2f7dd0" },
  { id: "pink", label: "Pink", value: "#F472B6" }
], bt = Nn[0].value, mt = {
  highlight: "Highlight",
  underline: "Underline",
  strikethrough: "Strikethrough",
  squiggly: "Squiggly underline"
};
function ci(e) {
  const r = e.createElement("div");
  r.className = "rx-anno-popover", r.setAttribute("role", "dialog"), r.setAttribute("aria-label", "Annotation"), r.hidden = !0;
  const t = e.createElement("div");
  t.className = "rx-anno-status", t.setAttribute("aria-live", "polite");
  const o = e.createElement("button");
  o.type = "button", o.className = "rx-icon-btn rx-anno-close", o.setAttribute("aria-label", "Close"), o.textContent = "✕";
  const n = e.createElement("div");
  n.className = "rx-anno-header", n.append(t, o);
  const s = e.createElement("div");
  s.className = "rx-anno-colors", s.setAttribute("role", "radiogroup"), s.setAttribute("aria-label", "Colour");
  const i = Nn.map((m) => {
    const f = e.createElement("button");
    return f.type = "button", f.className = "rx-anno-swatch", f.style.setProperty("--rx-anno-swatch-color", m.value), f.setAttribute("role", "radio"), f.setAttribute("aria-checked", "false"), f.setAttribute("aria-label", m.label), f.dataset.color = m.value, s.append(f), f;
  }), a = e.createElement("div");
  a.className = "rx-anno-styles", a.setAttribute("role", "group"), a.setAttribute("aria-label", "Mark style");
  const l = {};
  for (const m of Object.keys(mt)) {
    const f = e.createElement("button");
    f.type = "button", f.className = `rx-anno-style rx-anno-style-${m}`, f.textContent = mt[m], f.setAttribute("aria-label", mt[m]), f.dataset.style = m, a.append(f), l[m] = f;
  }
  const c = e.createElement("button");
  c.type = "button", c.className = "rx-anno-note-toggle", c.textContent = "Note", c.setAttribute("aria-expanded", "false");
  const d = e.createElement("div");
  d.className = "rx-anno-note-form", d.hidden = !0;
  const u = e.createElement("textarea");
  u.className = "rx-anno-note-textarea", u.setAttribute("aria-label", "Note text"), u.rows = 3;
  const h = e.createElement("div");
  h.className = "rx-anno-note-actions";
  const p = e.createElement("button");
  p.type = "button", p.className = "rx-anno-note-save", p.textContent = "Save";
  const g = e.createElement("button");
  g.type = "button", g.className = "rx-anno-note-cancel", g.textContent = "Cancel", h.append(g, p), d.append(u, h);
  const b = e.createElement("button");
  return b.type = "button", b.className = "rx-anno-delete", b.textContent = "Delete", b.hidden = !0, r.append(n, s, a, c, d, b), {
    root: r,
    colorRow: s,
    colorButtons: i,
    styleRow: a,
    styleButtons: l,
    noteToggleBtn: c,
    noteForm: d,
    noteTextarea: u,
    noteSaveBtn: p,
    noteCancelBtn: g,
    deleteBtn: b,
    closeBtn: o,
    statusLabel: t
  };
}
const di = `
.rx-anno-popover {
  position: absolute;
  z-index: 70;
  width: min(280px, 92vw);
  background: var(--rx-surface);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  box-shadow: var(--rx-elevation); /* taste-skill-ignore: a real floating popover, not an at-rest surface */
  padding: var(--rx-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--rx-space-2);
}
.rx-anno-popover[hidden] {
  display: none;
}
.reader-shell.e-ink .rx-anno-popover {
  border: 1px solid var(--rx-ink);
}
.rx-anno-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rx-space-2);
}
.rx-anno-status {
  font-size: 13px;
  color: var(--rx-muted);
}
.rx-anno-close {
  flex: 0 0 auto;
}
.rx-anno-colors {
  display: flex;
  gap: var(--rx-space-2);
}
.rx-anno-swatch {
  width: 40px;
  height: 48px;
  min-width: 40px;
  border: 2px solid transparent;
  border-radius: var(--rx-radius);
  background: var(--rx-surface-2);
  cursor: pointer;
  position: relative;
}
.rx-anno-swatch::before {
  content: '';
  position: absolute;
  inset: 12px;
  border-radius: 50%;
  background: var(--rx-anno-swatch-color);
}
.reader-shell.e-ink .rx-anno-swatch::before {
  border-radius: 0;
}
.rx-anno-swatch[aria-checked='true'] {
  border-color: var(--rx-accent);
}
.rx-anno-styles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rx-space-2);
}
.rx-anno-style,
.rx-anno-note-toggle,
.rx-anno-note-save,
.rx-anno-note-cancel,
.rx-anno-delete {
  min-height: 48px;
  padding: 0 var(--rx-space-3);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-surface-2);
  color: var(--rx-ink);
  font-size: 13px;
  cursor: pointer;
}
.rx-anno-style[aria-pressed='true'] {
  border-color: var(--rx-accent);
  color: var(--rx-accent);
}
.rx-anno-delete {
  color: #c0392b;
  border-color: #c0392b;
}
.rx-anno-note-form {
  display: flex;
  flex-direction: column;
  gap: var(--rx-space-2);
}
.rx-anno-note-textarea {
  min-height: 72px;
  padding: var(--rx-space-2);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-ground);
  color: var(--rx-ink);
  font: inherit;
  resize: vertical;
}
.rx-anno-note-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--rx-space-2);
}

.rx-anno-selection-hint {
  position: absolute;
  z-index: 70;
  background: var(--rx-surface);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  box-shadow: var(--rx-elevation); /* taste-skill-ignore: floating selection menu */
  padding: var(--rx-space-1);
}
`, yr = "reactor-annotations-stylesheet";
function ui(e) {
  return e === "underline" || e === "squiggly" ? "underline" : "highlight";
}
class pi {
  constructor(r = 500) {
    T(this, "map", /* @__PURE__ */ new Map());
    this.cap = r;
  }
  get(r) {
    return this.map.get(r);
  }
  addAll(r) {
    for (const t of r)
      for (this.map.delete(t.cfi), this.map.set(t.cfi, t); this.map.size > this.cap; ) {
        const o = this.map.keys().next().value;
        if (o === void 0) break;
        this.map.delete(o);
      }
  }
}
function hi({ shellRoot: e, core: r, hostChannel: t, options: o = {} }) {
  const n = e.ownerDocument ?? document;
  if (!n.getElementById(yr)) {
    const y = n.createElement("style");
    y.id = yr, y.textContent = di, n.head.appendChild(y);
  }
  const s = ci(n);
  e.append(s.root);
  const i = new pi();
  let a = bt, l = !1, c = null, d = null;
  function u() {
    c = null, d = null, s.root.hidden = !0, s.noteForm.hidden = !0, s.noteToggleBtn.setAttribute("aria-expanded", "false");
  }
  function h(y) {
    const I = e.getBoundingClientRect(), _ = y ? y.left - I.left : (e.clientWidth || 300) / 2 - 140, re = y ? y.bottom - I.top + 8 : 60, ne = Math.max(0, (e.clientWidth || 300) - 288);
    s.root.style.left = `${Math.min(Math.max(0, _), ne)}px`, s.root.style.top = `${Math.max(0, re)}px`;
  }
  function p(y) {
    a = y;
    for (const I of s.colorButtons) I.setAttribute("aria-checked", String(I.dataset.color === y));
  }
  function g(y) {
    for (const [I, _] of Object.entries(s.styleButtons)) _.setAttribute("aria-pressed", String(I === y));
  }
  function b(y, I, _) {
    c = { kind: "create", cfi: y, text: I }, s.statusLabel.textContent = "Add mark", s.deleteBtn.hidden = !0, s.noteForm.hidden = !0, s.noteTextarea.value = "", p(a), g(null), s.root.hidden = !1, h(_);
  }
  function m(y, I) {
    c = { kind: "edit", note: y }, s.statusLabel.textContent = "Edit mark", s.deleteBtn.hidden = !1, s.noteForm.hidden = !0, s.noteTextarea.value = y.note ?? "", p(y.color ?? bt), g(y.style ?? (y.kind === "underline" ? "underline" : "highlight")), s.root.hidden = !1, h(I);
  }
  function f(y, I) {
    c = null, d = y, s.statusLabel.textContent = "Loading…", s.deleteBtn.hidden = !0, s.noteForm.hidden = !0, s.root.hidden = !1, h(I), t.emitIntent({ type: "notesPageRequest", offset: 0, limit: 1, filter: null, sort: null, query: `cfi:${y}` });
  }
  function v(y) {
    if (y.type === "selection" && y.cfi)
      b(y.cfi, y.text, y.rect);
    else if (y.type === "selectionCleared")
      (c == null ? void 0 : c.kind) === "create" && u();
    else if (y.type === "annotationTap") {
      if (!y.cfi) return;
      const I = i.get(y.cfi);
      I ? m(I, y.rect) : f(y.cfi, y.rect);
    }
  }
  const w = r.on(v);
  function N(y) {
    if (y.type === "setNotes" && (i.addAll(y.items), d)) {
      const I = y.items.find((_) => _.cfi === d);
      if (I) {
        const _ = s.root.hidden ? null : { left: parseFloat(s.root.style.left || "0"), top: parseFloat(s.root.style.top || "0"), bottom: 0 };
        m(I, _);
      } else
        u();
    }
  }
  const L = t.onCommand(N);
  function A(y) {
    (c == null ? void 0 : c.kind) === "create" && (t.emitIntent({
      type: "annotationCreate",
      cfi: c.cfi,
      kind: ui(y),
      color: a,
      style: y,
      text: c.text,
      note: null
    }), r.clearSelection(), u());
  }
  function P(y) {
    (c == null ? void 0 : c.kind) === "edit" && (t.emitIntent({ type: "annotationUpdate", id: c.note.id, color: a, style: y, note: c.note.note }), u());
  }
  function D(y) {
    const _ = y.currentTarget.dataset.color ?? bt;
    p(_), (c == null ? void 0 : c.kind) === "edit" && t.emitIntent({ type: "annotationUpdate", id: c.note.id, color: _, style: c.note.style, note: c.note.note });
  }
  for (const y of s.colorButtons) y.addEventListener("click", D);
  const F = {
    highlight: () => (c == null ? void 0 : c.kind) === "create" ? A("highlight") : P("highlight"),
    underline: () => (c == null ? void 0 : c.kind) === "create" ? A("underline") : P("underline"),
    strikethrough: () => (c == null ? void 0 : c.kind) === "create" ? A("strikethrough") : P("strikethrough"),
    squiggly: () => (c == null ? void 0 : c.kind) === "create" ? A("squiggly") : P("squiggly")
  };
  for (const [y, I] of Object.entries(s.styleButtons)) I.addEventListener("click", F[y]);
  function W() {
    const y = s.noteForm.hidden;
    s.noteForm.hidden = !y, s.noteToggleBtn.setAttribute("aria-expanded", String(y)), y && s.noteTextarea.focus();
  }
  s.noteToggleBtn.addEventListener("click", W);
  function $() {
    s.noteForm.hidden = !0, s.noteToggleBtn.setAttribute("aria-expanded", "false");
  }
  s.noteCancelBtn.addEventListener("click", $);
  function V() {
    const y = s.noteTextarea.value.trim() || null;
    (c == null ? void 0 : c.kind) === "create" ? (t.emitIntent({
      type: "annotationCreate",
      cfi: c.cfi,
      kind: "note",
      color: a,
      style: null,
      text: c.text,
      note: y
    }), r.clearSelection(), u()) : (c == null ? void 0 : c.kind) === "edit" && (t.emitIntent({ type: "annotationUpdate", id: c.note.id, color: c.note.color, style: c.note.style, note: y }), u());
  }
  s.noteSaveBtn.addEventListener("click", V);
  function M() {
    (c == null ? void 0 : c.kind) === "edit" && (t.emitIntent({ type: "annotationDelete", id: c.note.id }), u());
  }
  s.deleteBtn.addEventListener("click", M);
  const U = () => u();
  s.closeBtn.addEventListener("click", U);
  function B() {
    if (!l) {
      l = !0, w(), L();
      for (const y of s.colorButtons) y.removeEventListener("click", D);
      for (const [y, I] of Object.entries(s.styleButtons)) I.removeEventListener("click", F[y]);
      s.noteToggleBtn.removeEventListener("click", W), s.noteCancelBtn.removeEventListener("click", $), s.noteSaveBtn.removeEventListener("click", V), s.deleteBtn.removeEventListener("click", M), s.closeBtn.removeEventListener("click", U), s.root.remove();
    }
  }
  return { destroy: B };
}
const fi = '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>';
function gi(e, r, t) {
  const o = document.createElement("button");
  return o.type = "button", o.className = t, o.setAttribute("aria-label", e), o.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${r}</svg>`, o;
}
function He(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = "rx-settings-toggle", t.setAttribute("aria-pressed", "false"), t.setAttribute("data-setting", r), t.textContent = e, t;
}
function Ke(e, r, t) {
  const o = document.createElement("div");
  o.className = `rx-settings-pills ${t}`, o.setAttribute("role", "radiogroup"), o.setAttribute("aria-label", e);
  for (const n of r) {
    const s = document.createElement("button");
    s.type = "button", s.className = "rx-settings-pill", s.setAttribute("role", "radio"), s.setAttribute("aria-checked", "false"), s.setAttribute("data-value", n.id), s.textContent = n.label, o.appendChild(s);
  }
  return o;
}
function Ie(e, r, t, o) {
  const n = document.createElement("div");
  n.className = "rx-settings-slider-row";
  const s = document.createElement("div");
  s.className = "rx-settings-slider-label";
  const i = document.createElement("span");
  i.textContent = e;
  const a = document.createElement("span");
  a.className = "rx-settings-slider-value", s.append(i, a);
  const l = document.createElement("input");
  return l.type = "range", l.className = "rx-settings-slider", l.min = String(r), l.max = String(t), l.step = String(o), l.setAttribute("aria-label", e), n.append(s, l), { row: n, input: l, value: a };
}
function bi(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = "rx-settings-tab", t.setAttribute("role", "tab"), t.setAttribute("aria-selected", "false"), t.setAttribute("data-tab", e), t.id = `rx-settings-tab-${e}`, t.textContent = r, t;
}
function De(e) {
  const r = document.createElement("div");
  return r.className = "rx-settings-panel", r.setAttribute("role", "tabpanel"), r.setAttribute("data-panel", e), r.setAttribute("aria-labelledby", `rx-settings-tab-${e}`), r.hidden = !0, r;
}
function mi(e) {
  const r = document.createElement("div");
  r.className = "rx-settings-scrim";
  const t = document.createElement("div");
  t.className = "rx-settings-sheet", t.setAttribute("role", "dialog"), t.setAttribute("aria-label", "Text settings"), t.tabIndex = -1;
  const o = document.createElement("div");
  o.className = "rx-settings-head";
  const n = document.createElement("h3");
  n.className = "rx-settings-title", n.textContent = "Text settings";
  const s = gi("Close settings", fi, "rx-icon-btn rx-settings-close");
  o.append(n, s);
  const i = document.createElement("div");
  i.className = "rx-settings-scope", i.setAttribute("role", "radiogroup"), i.setAttribute("aria-label", "Settings scope");
  const a = document.createElement("button");
  a.type = "button", a.className = "rx-settings-scope-btn", a.setAttribute("role", "radio"), a.setAttribute("aria-checked", "true"), a.setAttribute("data-scope", "global"), a.textContent = "Global";
  const l = document.createElement("button");
  l.type = "button", l.className = "rx-settings-scope-btn", l.setAttribute("role", "radio"), l.setAttribute("aria-checked", "false"), l.setAttribute("data-scope", "book"), l.textContent = "This book", i.append(a, l);
  const c = document.createElement("div");
  c.className = "rx-settings-tabs", c.setAttribute("role", "tablist");
  const d = [
    ["typography", "Typography"],
    ["layout", "Layout"],
    ["theme", "Theme"],
    ["controls", "Controls"],
    ["playback", "Playback"]
  ], u = {};
  for (const [X, ee] of d) {
    const Z = bi(X, ee);
    u[X] = Z, c.appendChild(Z);
  }
  const h = document.createElement("div");
  h.className = "rx-settings-body";
  const p = De("typography"), g = Ie("Font size", 13, 28, 1), b = Ie("Paragraph spacing", 0, 2, 0.1), m = Ke("Typeface", [], "rx-settings-font-pills");
  p.append(g.row, m, b.row);
  const f = De("layout"), v = Ke(
    "Reading mode",
    [
      { id: "paginated", label: "Paginated" },
      { id: "scrolled", label: "Scrolling" }
    ],
    "rx-settings-flow-pills"
  ), w = Ke(
    "Columns",
    [
      { id: "1", label: "1 column" },
      { id: "2", label: "2 columns" }
    ],
    "rx-settings-columns-pills"
  ), N = Ie("Margins", 0, 96, 4), L = Ie("Line spacing", 1.2, 1.95, 0.05), A = He("Justify text", "justify"), P = He("Hyphenate", "hyphenate"), D = He("Use book's own styling", "useBookLayout");
  f.append(v, w, N.row, L.row, A, P, D);
  const F = De("theme"), W = document.createElement("div");
  W.className = "rx-settings-swatches", W.setAttribute("role", "radiogroup"), W.setAttribute("aria-label", "Theme"), F.append(W);
  const $ = De("controls"), V = He("Swipe to turn pages", "swipe"), M = Ke(
    "Tap zone size",
    [
      { id: "standard", label: "Standard" },
      { id: "wide", label: "Wide" }
    ],
    "rx-settings-tapzone-pills"
  ), U = document.createElement("div");
  U.className = "rx-settings-volumekeys", U.hidden = !0;
  const B = He("Volume keys turn pages", "volumeKeys");
  U.append(B), $.append(V, M, U);
  const y = De("playback"), I = document.createElement("p");
  I.className = "rx-settings-empty", I.textContent = "No narration provider for this book.";
  const _ = document.createElement("div");
  _.className = "rx-settings-playback-controls", _.hidden = !0;
  const re = Ie("Narration speed", 0.5, 3, 0.1), ne = Ie("Skip forward (seconds)", 5, 60, 5);
  return _.append(re.row, ne.row), y.append(I, _), h.append(p, f, F, $, y), t.append(o, i, c, h), e.append(r, t), {
    root: t,
    scrim: r,
    closeBtn: s,
    scopeGlobalBtn: a,
    scopeBookBtn: l,
    tabsRow: c,
    tabButtons: u,
    panels: {
      typography: p,
      layout: f,
      theme: F,
      controls: $,
      playback: y
    },
    fontSizeInput: g.input,
    fontSizeValue: g.value,
    paragraphSpacingInput: b.input,
    paragraphSpacingValue: b.value,
    fontFamilyPills: m,
    flowPills: v,
    columnsPills: w,
    marginInput: N.input,
    marginValue: N.value,
    lineHeightInput: L.input,
    lineHeightValue: L.value,
    justifyToggle: A,
    hyphenateToggle: P,
    useBookLayoutToggle: D,
    themeSwatches: W,
    swipeToggle: V,
    tapZonePills: M,
    volumeKeysRow: U,
    volumeKeysToggle: B,
    playbackEmpty: I,
    playbackControls: _,
    narrationSpeedInput: re.input,
    narrationSpeedValue: re.value,
    skipForwardInput: ne.input,
    skipForwardValue: ne.value
  };
}
const xi = `
.rx-settings-scrim {
  position: absolute;
  inset: 0;
  z-index: 49;
  background: color-mix(in srgb, #000 40%, transparent);
  display: none;
}
.reader-shell.e-ink .rx-settings-scrim {
  background: #000;
}
.rx-settings-scrim.visible {
  display: block;
}

/* z-index 50 (SHELL.md section 1.4: "settings sheet | 50 (own stack, sits over sidebars"). */
.rx-settings-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  max-height: 78%;
  display: flex;
  flex-direction: column;
  background: var(--rx-surface);
  border-top: 1px solid var(--rx-border);
  border-radius: var(--rx-radius) var(--rx-radius) 0 0;
  box-shadow: var(--rx-elevation); /* taste-skill-ignore: a real overlay sheet while open, not an at-rest surface */
  transform: translateY(105%);
  transition: transform var(--rx-motion-bar);
}
.reader-shell.settings-open .rx-settings-sheet {
  transform: translateY(0);
}
.reader-shell.e-ink .rx-settings-sheet {
  box-shadow: none; /* taste-skill-ignore: e-ink never carries a shadow (SHELL.md fix #2) */
  border: 1px solid var(--rx-ink);
}

/* Desktop: a centered/docked panel, not a full-width bottom sheet (SHELL.md section 2: "desktop
 * has no thumb-reach constraint... U6 decides the exact desktop presentation but must keep the
 * same tab set and Global/This book scope control"). */
.reader-shell.size-desktop .rx-settings-sheet {
  left: 50%;
  right: auto;
  bottom: 50%;
  width: min(480px, 90%);
  max-height: 80%;
  border-radius: var(--rx-radius);
  border: 1px solid var(--rx-border);
  transform: translate(-50%, 50%) scale(0.98);
  opacity: 0;
  pointer-events: none;
}
.reader-shell.size-desktop.settings-open .rx-settings-sheet {
  transform: translate(-50%, 50%) scale(1);
  opacity: 1;
  pointer-events: auto;
}

.rx-settings-head {
  display: flex;
  align-items: center;
  gap: var(--rx-space-2);
  padding: var(--rx-space-3) var(--rx-space-2) var(--rx-space-3) var(--rx-space-3);
  border-bottom: 1px solid var(--rx-border); /* taste-skill-ignore: fixed chrome header above scrolling content, not a decorative divider */
  flex: 0 0 auto;
}
.rx-settings-title {
  flex: 1 1 auto;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.rx-settings-scope {
  display: flex;
  flex: 0 0 auto;
  gap: var(--rx-space-1);
  padding: 0 var(--rx-space-3) var(--rx-space-2);
}
.rx-settings-scope-btn {
  flex: 1 1 0;
  min-height: 48px;
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-ground);
  color: var(--rx-ink);
  font-family: var(--rx-font-sans);
  font-size: 13px;
  cursor: pointer;
}
.rx-settings-scope-btn[aria-checked='true'] {
  background: var(--rx-accent);
  color: var(--rx-accent-ink);
  border-color: var(--rx-accent);
}

.rx-settings-tabs {
  display: flex;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--rx-border); /* taste-skill-ignore: tablist/tabpanel boundary (role=tablist), not a decorative divider */
  overflow-x: auto;
}
.rx-settings-tab {
  flex: 1 1 0;
  min-height: 48px;
  min-width: 72px;
  border: none;
  background: none;
  color: var(--rx-muted);
  font-size: 12px;
  font-family: var(--rx-font-sans);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  padding: 0 var(--rx-space-2);
}
.rx-settings-tab[aria-selected='true'] {
  color: var(--rx-ink);
  border-bottom-color: var(--rx-accent);
  font-weight: 600;
}

.rx-settings-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--rx-space-3);
}
.rx-settings-panel[hidden] {
  display: none;
}
.rx-settings-panel {
  display: flex;
  flex-direction: column;
  gap: var(--rx-space-3);
}

.rx-settings-slider-row {
  display: flex;
  flex-direction: column;
  gap: var(--rx-space-1);
}
.rx-settings-slider-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--rx-ink);
}
.rx-settings-slider-value {
  color: var(--rx-muted);
}
.rx-settings-slider {
  appearance: none;
  width: 100%;
  min-height: 48px;
  margin: 0;
  background: transparent;
}
.rx-settings-slider::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--rx-border);
  border-radius: 2px;
}
.rx-settings-slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: -8px;
  border-radius: 50%;
  background: var(--rx-accent);
}
.reader-shell.e-ink .rx-settings-slider::-webkit-slider-thumb {
  border-radius: 0;
}

.rx-settings-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rx-space-1);
}
.rx-settings-pill {
  min-height: 44px;
  min-width: 48px;
  padding: 0 var(--rx-space-3);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-ground);
  color: var(--rx-ink);
  font-family: var(--rx-font-sans);
  font-size: 13px;
  cursor: pointer;
}
.rx-settings-pill[aria-checked='true'] {
  background: var(--rx-accent);
  color: var(--rx-accent-ink);
  border-color: var(--rx-accent);
}

.rx-settings-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 var(--rx-space-2);
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius);
  background: var(--rx-ground);
  color: var(--rx-ink);
  font-family: var(--rx-font-sans);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.rx-settings-toggle[aria-pressed='true'] {
  border-color: var(--rx-accent);
  color: var(--rx-accent);
  font-weight: 600;
}

.rx-settings-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rx-space-3);
}
.rx-settings-swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rx-space-1);
  min-width: 48px;
  min-height: 48px;
  padding: var(--rx-space-1);
  border: none;
  background: none;
  cursor: pointer;
  font-size: 11px;
  color: var(--rx-muted);
  font-family: var(--rx-font-sans);
}
.rx-settings-swatch-dot {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--rx-border);
}
.rx-settings-swatch[aria-checked='true'] .rx-settings-swatch-dot {
  border-color: var(--rx-accent);
  box-shadow: 0 0 0 2px var(--rx-accent); /* taste-skill-ignore: selection ring on a control, not a resting decoration */
}
.reader-shell.e-ink .rx-settings-swatch-dot {
  border-radius: 0;
}

.rx-settings-empty {
  margin: 0;
  color: var(--rx-muted);
  font-size: 13px;
}

.rx-settings-volumekeys[hidden],
.rx-settings-playback-controls[hidden] {
  display: none;
}
`, vr = {
  fontSize: 16,
  lineHeight: 1.5,
  fontFamily: null,
  paragraphSpacing: 0,
  maxColumnCount: 2,
  gap: 0.05,
  maxInlineSize: 720,
  maxBlockSize: 1440,
  justify: !0,
  hyphenate: !0,
  isDark: !1,
  themeName: "default",
  flow: "paginated",
  useBookLayout: !0,
  marginTop: 40,
  marginBottom: 40,
  marginLeft: 40,
  marginRight: 40,
  linkSideMargins: !0
}, Lt = [
  { id: "light", label: "Light", themeName: "default", isDark: !1, swatchBg: "#ffffff", swatchFg: "#000000" },
  { id: "sepia", label: "Sepia", themeName: "sepia", isDark: !1, swatchBg: "#f1e8d0", swatchFg: "#5b4636" },
  { id: "dark", label: "Dark", themeName: "default", isDark: !0, swatchBg: "#222222", swatchFg: "#e0e0e0" },
  { id: "amoled", label: "AMOLED", themeName: "amoled", isDark: !0, swatchBg: "#000000", swatchFg: "#ffffff" }
];
function yi(e, r) {
  return Lt.find((t) => t.themeName === e && t.isDark === r) ?? Lt.find((t) => t.id === (r ? "dark" : "light"));
}
const kr = [
  { id: "publisher", label: "Publisher", value: null },
  { id: "serif", label: "Serif", value: 'Georgia, "Iowan Old Style", "Times New Roman", serif' },
  { id: "sans", label: "Sans-serif", value: '-apple-system, "Segoe UI", Roboto, Arial, sans-serif' },
  { id: "mono", label: "Monospace", value: '"Courier New", monospace' }
];
function vi(e) {
  return Array.from(e.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((t) => t.offsetParent !== null || t === e);
}
function ki(e) {
  let r = !1;
  function t(o) {
    if (!r || o.key !== "Tab") return;
    const n = vi(e);
    if (n.length === 0) {
      o.preventDefault(), e.focus();
      return;
    }
    const s = n[0], i = n[n.length - 1], a = e.ownerDocument.activeElement;
    o.shiftKey && a === s ? (o.preventDefault(), i.focus()) : !o.shiftKey && a === i && (o.preventDefault(), s.focus());
  }
  return e.addEventListener("keydown", t), {
    activate() {
      r = !0;
    },
    deactivate() {
      r = !1, e.removeEventListener("keydown", t);
    }
  };
}
const wr = "reactor-settings-stylesheet", wi = ["typography", "layout", "theme", "controls", "playback"];
function Si(e) {
  if (e.getElementById(wr)) return;
  const r = e.createElement("style");
  r.id = wr, r.textContent = xi, e.head.appendChild(r);
}
function Bn(e, r, t) {
  var ve, ke, we;
  const o = e.ownerDocument ?? document;
  Si(o);
  const n = mi(e), s = ki(n.root), i = {
    global: { ...vr },
    book: { ...vr }
  };
  let a = "global", l = "typography", c = !1, d = !1, u = ((ke = (ve = t.hostChannel) == null ? void 0 : ve.getConfig()) == null ? void 0 : ke.capabilities.playback) ?? !1, h = null;
  n.volumeKeysRow.hidden = !t.volumeKeysCapability;
  function p() {
    return i[a];
  }
  function g() {
    const x = p().fontFamily;
    for (const z of Array.from(n.fontFamilyPills.children)) {
      const te = kr.find((ge) => ge.id === z.dataset.value);
      z.setAttribute("aria-checked", String((te == null ? void 0 : te.value) === x));
    }
  }
  function b() {
    const x = yi(p().themeName, p().isDark);
    for (const z of Array.from(n.themeSwatches.children))
      z.setAttribute("aria-checked", String(z.dataset.value === x.id));
  }
  function m(x, z) {
    for (const te of Array.from(x.children))
      te.setAttribute("aria-checked", String(te.dataset.value === z));
  }
  function f() {
    n.playbackEmpty.hidden = u, n.playbackControls.hidden = !u;
  }
  function v() {
    const x = p();
    n.fontSizeInput.value = String(x.fontSize), n.fontSizeInput.setAttribute("aria-valuetext", `${x.fontSize}px`), n.fontSizeValue.textContent = `${x.fontSize}px`, n.paragraphSpacingInput.value = String(x.paragraphSpacing), n.paragraphSpacingValue.textContent = `${x.paragraphSpacing}em`, g(), m(n.flowPills, x.flow), m(n.columnsPills, String(x.maxColumnCount)), n.marginInput.value = String(x.marginTop), n.marginValue.textContent = `${x.marginTop}px`, n.lineHeightInput.value = String(x.lineHeight), n.lineHeightValue.textContent = x.lineHeight.toFixed(2), n.justifyToggle.setAttribute("aria-pressed", String(x.justify)), n.hyphenateToggle.setAttribute("aria-pressed", String(x.hyphenate)), n.useBookLayoutToggle.setAttribute("aria-pressed", String(x.useBookLayout)), b(), f(), n.scopeGlobalBtn.setAttribute("aria-checked", String(a === "global")), n.scopeBookBtn.setAttribute("aria-checked", String(a === "book"));
  }
  function w(x) {
    var z;
    i[a] = { ...i[a], ...x }, v(), r.applyStyles(i[a]), (z = t.hostChannel) == null || z.emitIntent({ type: "settingsChange", scope: a, settings: i[a] });
  }
  function N() {
    w({ fontSize: Number(n.fontSizeInput.value) });
  }
  n.fontSizeInput.addEventListener("change", N);
  function L() {
    w({ paragraphSpacing: Number(n.paragraphSpacingInput.value) });
  }
  n.paragraphSpacingInput.addEventListener("change", L);
  for (const x of kr) {
    const z = document.createElement("button");
    z.type = "button", z.className = "rx-settings-pill", z.setAttribute("role", "radio"), z.setAttribute("aria-checked", "false"), z.setAttribute("data-value", x.id), z.textContent = x.label, z.addEventListener("click", () => w({ fontFamily: x.value })), n.fontFamilyPills.appendChild(z);
  }
  function A(x) {
    const z = x.currentTarget.dataset.value;
    w({ flow: z });
  }
  for (const x of Array.from(n.flowPills.children)) x.addEventListener("click", A);
  function P(x) {
    const z = Number(x.currentTarget.dataset.value);
    w({ maxColumnCount: z });
  }
  for (const x of Array.from(n.columnsPills.children)) x.addEventListener("click", P);
  function D() {
    const x = Number(n.marginInput.value);
    w({ marginTop: x, marginBottom: x, marginLeft: x, marginRight: x });
  }
  n.marginInput.addEventListener("change", D);
  function F() {
    w({ lineHeight: Number(n.lineHeightInput.value) });
  }
  n.lineHeightInput.addEventListener("change", F);
  function W() {
    w({ justify: !p().justify });
  }
  n.justifyToggle.addEventListener("click", W);
  function $() {
    w({ hyphenate: !p().hyphenate });
  }
  n.hyphenateToggle.addEventListener("click", $);
  function V() {
    w({ useBookLayout: !p().useBookLayout });
  }
  n.useBookLayoutToggle.addEventListener("click", V);
  for (const x of Lt) {
    const z = document.createElement("button");
    z.type = "button", z.className = "rx-settings-swatch", z.setAttribute("role", "radio"), z.setAttribute("aria-checked", "false"), z.setAttribute("aria-label", x.label), z.setAttribute("data-value", x.id);
    const te = document.createElement("span");
    te.className = "rx-settings-swatch-dot", te.style.background = x.swatchBg;
    const ge = document.createElement("span");
    ge.textContent = x.label, z.append(te, ge), z.addEventListener("click", () => w({ themeName: x.themeName, isDark: x.isDark })), n.themeSwatches.appendChild(z);
  }
  let M = !0;
  function U() {
    M = !M, n.swipeToggle.setAttribute("aria-pressed", String(M)), r.setSwipe(M);
  }
  n.swipeToggle.addEventListener("click", U), n.swipeToggle.setAttribute("aria-pressed", String(M));
  let B = "standard";
  function y(x) {
    B = x.currentTarget.dataset.value ?? "standard", m(n.tapZonePills, B);
  }
  for (const x of Array.from(n.tapZonePills.children)) x.addEventListener("click", y);
  m(n.tapZonePills, B);
  let I = !1;
  function _() {
    I = !I, n.volumeKeysToggle.setAttribute("aria-pressed", String(I));
  }
  n.volumeKeysToggle.addEventListener("click", _);
  function re() {
    var z;
    const x = Number(n.narrationSpeedInput.value);
    n.narrationSpeedValue.textContent = `${x.toFixed(1)}x`, (z = t.hostChannel) == null || z.emitIntent({ type: "playback", action: "rateChange", positionSec: null, rate: x });
  }
  n.narrationSpeedInput.addEventListener("input", () => {
    n.narrationSpeedValue.textContent = `${Number(n.narrationSpeedInput.value).toFixed(1)}x`;
  }), n.narrationSpeedInput.addEventListener("change", re);
  function ne() {
    n.skipForwardValue.textContent = `${n.skipForwardInput.value}s`;
  }
  n.skipForwardInput.addEventListener("input", ne), n.narrationSpeedInput.value = "1", n.narrationSpeedValue.textContent = "1.0x", n.skipForwardInput.value = "30", n.skipForwardValue.textContent = "30s";
  function X(x) {
    x !== l && (n.tabButtons[l].setAttribute("aria-selected", "false"), n.panels[l].hidden = !0, l = x, n.tabButtons[l].setAttribute("aria-selected", "true"), n.panels[l].hidden = !1);
  }
  for (const x of wi)
    n.tabButtons[x].addEventListener("click", () => X(x));
  X("typography"), n.tabButtons.typography.setAttribute("aria-selected", "true"), n.panels.typography.hidden = !1;
  function ee(x) {
    x !== a && (a = x, v(), r.applyStyles(i[a]));
  }
  n.scopeGlobalBtn.addEventListener("click", () => ee("global")), n.scopeBookBtn.addEventListener("click", () => ee("book"));
  const Z = (we = t.hostChannel) == null ? void 0 : we.onCommand((x) => {
    x.type === "setSettingsScope" ? (i[x.scope] = x.settings, x.scope === a && (v(), r.applyStyles(i[a]))) : x.type === "configure" && (u = x.capabilities.playback, f());
  });
  function S() {
    var x;
    c || (c = !0, h = o.activeElement ?? null, e.classList.add("settings-open"), n.scrim.classList.add("visible"), s.activate(), n.root.focus({ preventScroll: !0 }), (x = t.onOpenChange) == null || x.call(t, !0));
  }
  function H() {
    var x, z;
    c && (c = !1, e.classList.remove("settings-open"), n.scrim.classList.remove("visible"), s.deactivate(), (x = h == null ? void 0 : h.focus) == null || x.call(h), h = null, (z = t.onOpenChange) == null || z.call(t, !1));
  }
  function le() {
    c ? H() : S();
  }
  n.closeBtn.addEventListener("click", H), n.scrim.addEventListener("click", H), v();
  function K() {
    d || (d = !0, Z == null || Z(), s.deactivate(), e.classList.remove("settings-open"), n.root.remove(), n.scrim.remove());
  }
  return {
    open: S,
    close: H,
    toggle: le,
    isOpen: () => c,
    getActiveSettings: () => p(),
    getActiveScope: () => a,
    destroy: K
  };
}
const Ei = { top: 0, right: 0, bottom: 0, left: 0 };
function Sr(e, r) {
  e.style.setProperty("--rx-inset-top", `${Math.max(0, r.top)}px`), e.style.setProperty("--rx-inset-right", `${Math.max(0, r.right)}px`), e.style.setProperty("--rx-inset-bottom", `${Math.max(0, r.bottom)}px`), e.style.setProperty("--rx-inset-left", `${Math.max(0, r.left)}px`);
}
const Ci = 280, Er = "reactor-shell-stylesheet";
function Ai(e) {
  if (e.getElementById(Er)) return;
  const r = e.createElement("style");
  r.id = Er, r.textContent = es, e.head.appendChild(r);
}
function Ti() {
  return typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function Li() {
  const e = /* @__PURE__ */ new Set();
  return {
    getChromeState: () => ({ barsVisible: !1, sidebar: "none" }),
    onChromeState: (r) => (e.add(r), () => e.delete(r)),
    setBarsVisible: () => {
    },
    refreshSizeClass: () => {
    },
    destroy: () => {
      e.clear();
    }
  };
}
function Ni(e, r, t = {}) {
  var Ot, _t, Ht, Dt, Gt, jt, Wt;
  if ((t.chrome ?? "reactor") === "host") return Li();
  const n = e.ownerDocument ?? document;
  Ai(n);
  const s = Qo(e), i = s.root;
  let a = !1, l = !1, c = "none", d = !1, u = !1, h = null;
  const p = /* @__PURE__ */ new Set();
  function g() {
    var Y;
    if (u) return;
    const C = { barsVisible: l, sidebar: c };
    for (const Ve of p) Ve(C);
    (Y = t.hostChannel) == null || Y.emitIntent({ type: "chromeState", barsVisible: l, sidebar: c });
  }
  function b(C) {
    l !== C && (l = C, i.classList.toggle("ui-visible", l), g());
  }
  function m() {
    b(!l);
  }
  const f = As(i, (C) => r.goTo(C), {
    eink: t.eink,
    // The sidebar header's "Back" control (protocol v2 README: the host's own navigation
    // action, kept distinct from `close`) - silently dropped by HostChannel until a host
    // opts in with `configure`.
    onBack: () => {
      var C;
      return (C = t.hostChannel) == null ? void 0 : C.emitIntent({ type: "back" });
    },
    onSidebarChange: (C) => {
      c = C ? "left" : "none", s.contentsBtn.setAttribute("aria-pressed", String(C)), g(), N();
    }
  });
  function v() {
    return i.classList.contains("size-desktop");
  }
  function w() {
    if (f.isOpen()) {
      f.close();
      return;
    }
    v() || K.close(), Te.close(), f.open();
  }
  s.contentsBtn.addEventListener("click", w);
  function N() {
    const C = i.classList.contains("size-desktop");
    Le(i, { left: C && f.isOpen() ? Ci : 0 });
  }
  function L() {
    i.classList.toggle("reduced-motion", P || Ti());
  }
  function A() {
    i.classList.toggle("e-ink", P);
  }
  let P = ((_t = (Ot = t.hostChannel) == null ? void 0 : Ot.getConfig()) == null ? void 0 : _t.eink) ?? !!t.eink;
  A(), L(), Sr(i, ((Dt = (Ht = t.hostChannel) == null ? void 0 : Ht.getConfig()) == null ? void 0 : Dt.insets) ?? Ei);
  const D = (Gt = t.hostChannel) == null ? void 0 : Gt.onCommand((C) => {
    C.type === "configure" && (P = C.eink, A(), L(), Sr(i, C.insets));
  });
  function F() {
    const C = e.clientWidth || i.clientWidth, Y = Je(C);
    i.classList.remove("size-phone", "size-fold-tablet", "size-desktop"), i.classList.add(`size-${Y}`), N();
  }
  F();
  function W() {
    F(), K.refreshLayout();
  }
  const $ = typeof ResizeObserver == "function" ? new ResizeObserver(() => W()) : null;
  $ == null || $.observe(e);
  const V = () => W();
  $ || window.addEventListener("resize", V);
  const M = typeof matchMedia == "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null, U = () => L();
  (jt = M == null ? void 0 : M.addEventListener) == null || jt.call(M, "change", U);
  function B(C, Y) {
    const Ve = vn(C, a);
    Ve === "prev" ? r.prev() : Ve === "next" ? r.next() : m();
  }
  function y(C) {
    C === "prev" ? r.prev() : C === "next" ? r.next() : m();
  }
  function I(C, Y) {
    Y.key !== "Enter" && Y.key !== " " || (Y.preventDefault(), y(C));
  }
  const _ = () => y(a ? "next" : "prev"), re = () => y(a ? "prev" : "next"), ne = () => y("toggle"), X = (C) => I(a ? "next" : "prev", C), ee = (C) => I(a ? "prev" : "next", C), Z = (C) => I("toggle", C);
  s.zoneLeft.addEventListener("click", _), s.zoneRight.addEventListener("click", re), s.zoneCentre.addEventListener("click", ne), s.zoneLeft.addEventListener("keydown", X), s.zoneRight.addEventListener("keydown", ee), s.zoneCentre.addEventListener("keydown", Z);
  function S(C) {
    const Y = kn(C);
    Y && (wn(Y) && C.preventDefault(), Y === "next" ? r.next() : Y === "prev" ? r.prev() : Y === "toggleBars" ? m() : Y === "escape" && (f.isOpen() ? f.close() : b(!1)));
  }
  n.addEventListener("keydown", S);
  const H = () => r.historyBack(), le = () => r.historyForward();
  s.historyBackBtn.addEventListener("click", H), s.historyForwardBtn.addEventListener("click", le);
  const K = Tn(i, r, {
    getSizeClass: () => Je(e.clientWidth || i.clientWidth),
    onWidthChange: t.onContextWidthChange,
    hostChannel: t.hostChannel,
    onClose: () => {
      c = "none", s.contextBtn.setAttribute("aria-pressed", "false"), g();
    }
  });
  function ve() {
    c === "right" ? (K.close(), c = "none") : (v() || f.close(), Te.close(), K.open(), c = "right"), s.contextBtn.setAttribute("aria-pressed", String(c === "right")), g();
  }
  s.contextBtn.addEventListener("click", ve);
  const ke = t.hostChannel ? Ln(i, r, t.hostChannel, { eink: t.eink }) : null;
  let we = /* @__PURE__ */ new Set();
  function x() {
    s.bookmarkBtn.setAttribute("aria-pressed", String(!!h && we.has(h)));
  }
  function z() {
    !t.hostChannel || !h || t.hostChannel.emitIntent({ type: "bookmarkToggle", cfi: h });
  }
  const te = (Wt = t.hostChannel) == null ? void 0 : Wt.onCommand((C) => {
    C.type === "setBookmarks" && (we = new Set(C.items.map((Y) => Y.cfi)), x());
  });
  s.bookmarkBtn.addEventListener("click", z);
  const ge = t.hostChannel ? hi({ shellRoot: i, core: r, hostChannel: t.hostChannel, options: { eink: t.eink } }) : null, Te = Bn(i, r, {
    getSizeClass: () => Je(e.clientWidth || i.clientWidth),
    eink: t.eink,
    hostChannel: t.hostChannel,
    volumeKeysCapability: t.volumeKeysCapability,
    onOpenChange: (C) => {
      s.settingsBtn.setAttribute("aria-pressed", String(C));
    }
  });
  function Re() {
    if (Te.isOpen()) {
      Te.close();
      return;
    }
    f.close(), K.close(), c = "none", s.contentsBtn.setAttribute("aria-pressed", "false"), s.contextBtn.setAttribute("aria-pressed", "false"), g(), Te.open();
  }
  s.settingsBtn.addEventListener("click", Re);
  const Ue = Js(i, r, {
    onOpenInGlossary: (C) => {
      K.openGlossaryTerm(C), c = "right", s.contextBtn.setAttribute("aria-pressed", "true"), g();
    }
  }), k = () => {
    d = !0;
  }, O = () => {
    d = !1, r.goToFraction(Number(s.scrubber.value) / 1e3);
  };
  s.scrubber.addEventListener("pointerdown", k), s.scrubber.addEventListener("change", O);
  function se(C) {
    switch (C.type) {
      case "loaded":
        a = C.isRtl, i.classList.toggle("is-rtl", a), f.setToc(C.toc), N();
        break;
      case "relocate":
        h = C.cfi ?? null, s.chapterLabel && (s.chapterLabel.textContent = C.chapterTitle ?? ""), !d && typeof C.fraction == "number" && (s.scrubber.value = String(Math.round(C.fraction * 1e3))), f.setCurrentChapterTitle(C.chapterTitle), x();
        break;
      case "history":
        s.historyBackBtn.disabled = !C.canGoBack, s.historyForwardBtn.disabled = !C.canGoForward;
        break;
      case "tap":
        B(C.x, C.y);
        break;
    }
  }
  const be = r.on(se);
  function Se() {
    F();
  }
  function zn() {
    var C;
    u || (u = !0, be(), $ == null || $.disconnect(), $ || window.removeEventListener("resize", V), (C = M == null ? void 0 : M.removeEventListener) == null || C.call(M, "change", U), n.removeEventListener("keydown", S), s.zoneLeft.removeEventListener("click", _), s.zoneRight.removeEventListener("click", re), s.zoneCentre.removeEventListener("click", ne), s.zoneLeft.removeEventListener("keydown", X), s.zoneRight.removeEventListener("keydown", ee), s.zoneCentre.removeEventListener("keydown", Z), s.historyBackBtn.removeEventListener("click", H), s.historyForwardBtn.removeEventListener("click", le), s.contextBtn.removeEventListener("click", ve), s.bookmarkBtn.removeEventListener("click", z), te == null || te(), D == null || D(), ge == null || ge.destroy(), K.destroy(), ke == null || ke.destroy(), s.settingsBtn.removeEventListener("click", Re), Te.destroy(), Ue.destroy(), s.scrubber.removeEventListener("pointerdown", k), s.scrubber.removeEventListener("change", O), s.contentsBtn.removeEventListener("click", w), f.destroy(), p.clear(), i.classList.remove(
      "reader-shell",
      "ui-visible",
      "e-ink",
      "reduced-motion",
      "is-rtl",
      "size-phone",
      "size-fold-tablet",
      "size-desktop",
      "settings-open"
    ), s.zones.remove(), s.topBar.remove(), s.bottomBar.remove());
  }
  return {
    getChromeState: () => ({ barsVisible: l, sidebar: c }),
    onChromeState: (C) => (p.add(C), () => p.delete(C)),
    setBarsVisible: b,
    refreshSizeClass: Se,
    destroy: zn
  };
}
const Oi = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ZONE_FRACTION: Tt,
  computeSizeClass: Je,
  isPreventableKey: wn,
  mountPlaybackBar: Ln,
  mountRightSidebar: Tn,
  mountSettingsPanel: Bn,
  mountShell: Ni,
  resolveKeyboardAction: kn,
  resolveTapZone: vn
}, Symbol.toStringTag, { value: "Module" }));
function Bi() {
  const e = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
  let t = null, o = null;
  function n(l) {
    let c = l;
    l.type === "configure" && (t ? (c = { ...l, capabilities: t.capabilities, locale: t.locale }, t = c) : t = l), l.type === "setNotes" && (o = l);
    for (const d of e) d(c);
  }
  function s(l) {
    return e.add(l), () => e.delete(l);
  }
  function i(l) {
    if (t)
      for (const c of r) c(l);
  }
  function a(l) {
    return r.add(l), () => r.delete(l);
  }
  return {
    dispatch: n,
    onCommand: s,
    emitIntent: i,
    onIntent: a,
    isV2Enabled: () => t !== null,
    getConfig: () => t,
    getNotesWindow: () => o
  };
}
function zi(e, r = {}) {
  const t = new yn(e), o = r.v2 ? Bi() : void 0;
  let n = !1;
  function s() {
    if (n) throw new Error("createWebHost: host already destroyed");
  }
  return {
    core: t,
    hostChannel: o,
    on: (i) => t.on(i),
    dispatch: (i) => {
      s(), t.dispatch(i);
    },
    beginOpen: (i) => {
      s(), t.beginOpen(i);
    },
    pushChunk: (i) => {
      s(), t.pushChunk(i);
    },
    commitOpen: () => (s(), t.commitOpen()),
    openLocal: (i, a, l) => (s(), t.openLocal(i, a, l)),
    setExtraCss: (i) => {
      s(), t.setExtraCss(i);
    },
    destroy: () => {
      n || (n = !0, e.replaceChildren());
    }
  };
}
const _i = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createWebHost: zi
}, Symbol.toStringTag, { value: "Module" })), Hi = "0.0.1";
export {
  Hi as R,
  ao as a,
  Ri as b,
  Pi as c,
  Oi as d,
  _i as e,
  Fi as f,
  Mi as i,
  Me as p,
  $i as t
};
