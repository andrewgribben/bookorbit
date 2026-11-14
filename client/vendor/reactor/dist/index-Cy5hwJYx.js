var Mn = Object.defineProperty;
var qt = (e) => {
  throw TypeError(e);
};
var $n = (e, r, t) => r in e ? Mn(e, r, { enumerable: !0, configurable: !0, writable: !0, value: t }) : e[r] = t;
var L = (e, r, t) => $n(e, typeof r != "symbol" ? r + "" : r, t), pt = (e, r, t) => r.has(e) || qt("Cannot " + t);
var E = (e, r, t) => (pt(e, r, "read from private field"), t ? t.call(e) : r.get(e)), X = (e, r, t) => r.has(e) ? qt("Cannot add the same private member more than once") : r instanceof WeakSet ? r.add(e) : r.set(e, t), Z = (e, r, t, o) => (pt(e, r, "write to private field"), o ? o.call(e, t) : r.set(e, t), t), K = (e, r, t) => (pt(e, r, "access private method"), t);
var Kt = (e, r, t, o) => ({
  set _(n) {
    Z(e, r, n, t);
  },
  get _() {
    return E(e, r, o);
  }
});
function ge(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function j(e) {
  return typeof e == "string";
}
function he(e) {
  return e === null || typeof e == "string";
}
function $(e) {
  return typeof e == "number" && Number.isFinite(e);
}
function tt(e) {
  return e === null || $(e);
}
function fe(e) {
  return typeof e == "boolean";
}
function Rn(e) {
  return Array.isArray(e);
}
function Fe(e, r) {
  return Array.isArray(e) && e.every(r);
}
function Tr(e) {
  return e === "paginated" || e === "scrolled";
}
function Bt(e) {
  return ge(e) ? $(e.fontSize) && $(e.lineHeight) && he(e.fontFamily) && $(e.paragraphSpacing) && $(e.maxColumnCount) && $(e.gap) && $(e.maxInlineSize) && $(e.maxBlockSize) && fe(e.justify) && fe(e.hyphenate) && fe(e.isDark) && j(e.themeName) && Tr(e.flow) && fe(e.useBookLayout) && $(e.marginTop) && $(e.marginBottom) && $(e.marginLeft) && $(e.marginRight) && fe(e.linkSideMargins) && (e.letterSpacing === void 0 || $(e.letterSpacing)) && (e.wordSpacing === void 0 || $(e.wordSpacing)) && (e.textIndent === void 0 || $(e.textIndent)) && (e.fontWeight === void 0 || $(e.fontWeight)) : !1;
}
function _n(e) {
  return ge(e) ? he(e.format) && he(e.cfi) && tt(e.fraction) && (e.settings === null || e.settings === void 0 || Bt(e.settings)) && he(e.previousCfi) : !1;
}
const Hn = [
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
function Dn(e) {
  return ge(e) && j(e.cfi) && j(e.color) && j(e.style);
}
const Lr = {
  goTo: (e) => j(e.target),
  goToFraction: (e) => $(e.value),
  prev: () => !0,
  next: () => !0,
  historyBack: () => !0,
  historyForward: () => !0,
  setSwipe: (e) => fe(e.enabled),
  applyStyles: (e) => Bt(e.settings),
  setAnnotations: (e) => Rn(e.items) && e.items.every(Dn),
  clearSelection: () => !0,
  search: (e) => j(e.query),
  clearSearch: () => !0,
  narrationPrepare: (e) => $(e.generation),
  narrationCancelPrepare: () => !0,
  narrationHighlight: (e) => j(e.textHref),
  narrationUnhighlight: () => !0
};
function Nr(e) {
  if (!ge(e) || !j(e.type)) return !1;
  const r = Lr[e.type];
  return r !== void 0 && r(e);
}
function Gn(e) {
  let r;
  try {
    r = JSON.parse(e);
  } catch {
    return null;
  }
  return Nr(r) ? r : null;
}
const jn = [
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
function Br(e) {
  return ge(e) && j(e.label) && he(e.href) && Fe(e.subitems, Br);
}
function zr(e) {
  return ge(e) && $(e.left) && $(e.top) && $(e.right) && $(e.bottom);
}
function Wn(e) {
  return e === null || zr(e);
}
function Un(e) {
  return ge(e) && j(e.cfi) && j(e.pre) && j(e.match) && j(e.post);
}
function Vn(e) {
  return ge(e) && $(e.sectionIndex) && j(e.textHref) && $(e.beginSec) && tt(e.endSec) && $(e.audioIndex);
}
function qn(e) {
  return j(e) ? !0 : ge(e) && Object.values(e).every(j);
}
function Kn(e) {
  return e === null || qn(e);
}
function Yn(e) {
  return e === null || j(e) || Fe(e, j);
}
const Ir = {
  ready: () => !0,
  loaded: (e) => Fe(e.toc, Br) && ge(e.metadata) && Kn(e.metadata.title) && Yn(e.metadata.language) && fe(e.hasMediaOverlay) && fe(e.isRtl),
  relocate: (e) => he(e.cfi) && tt(e.fraction) && he(e.chapterTitle) && he(e.reason) && fe(e.restoring) && he(e.narrationFragment) && tt(e.narrationSectionIndex),
  history: (e) => fe(e.canGoBack) && fe(e.canGoForward),
  error: (e) => j(e.message),
  tap: (e) => $(e.x) && $(e.y),
  selection: (e) => j(e.text) && he(e.cfi) && zr(e.rect),
  selectionCleared: () => !0,
  searchResults: (e) => j(e.label) && Fe(e.items, Un),
  searchProgress: (e) => $(e.progress),
  searchDone: (e) => $(e.total) && fe(e.capped),
  annotationTap: (e) => he(e.cfi) && Wn(e.rect),
  narrationTimeline: (e) => $(e.generation) && Fe(e.audioSrcs, j) && Fe(e.items, Vn) && j(e.activeClass) && he(e.playbackActiveClass) && j(e.startTextHref),
  narrationTimelineError: (e) => $(e.generation) && j(e.message)
};
function Pr(e) {
  if (!ge(e) || !j(e.type)) return !1;
  const r = Ir[e.type];
  return r !== void 0 && r(e);
}
function Xn(e) {
  let r;
  try {
    r = JSON.parse(e);
  } catch {
    return null;
  }
  return Pr(r) ? r : null;
}
function Fr(e) {
  return ge(e) && j(e.name) && $(e.size);
}
function Zn(e) {
  return Array.isArray(e) && e.every(Fr);
}
const Jn = "entries.json", Or = "entry/";
function Qn(e) {
  return Or + e.split("/").map(encodeURIComponent).join("/");
}
const eo = {
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
}, Mi = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  LOCAL_EPUB_ENTRIES_PATH: Jn,
  LOCAL_EPUB_ENTRY_PATH_PREFIX: Or,
  READER_COMMAND_TYPES: Hn,
  READER_EVENT_TYPES: jn,
  READER_GLOBALS: eo,
  isLocalEpubEntry: Fr,
  isLocalEpubEntryList: Zn,
  isReaderCommand: Nr,
  isReaderEvent: Pr,
  isReaderFlow: Tr,
  isReaderOpenMeta: _n,
  isReaderSettings: Bt,
  localEpubEntryPath: Qn,
  parseReaderCommand: Gn,
  parseReaderEvent: Xn,
  readerCommandValidators: Lr,
  readerEventValidators: Ir
}, Symbol.toStringTag, { value: "Module" })), to = (e, r) => e.map((t, o, n) => r(t, o, n) ? o : null).filter((t) => t != null), Mr = (e, r) => [-1, ...r, e.length].reduce(({ xs: t, a: o }, n) => ({ xs: (t == null ? void 0 : t.concat([e.slice(o + 1, n)])) ?? [], a: n }), {}).xs, ro = (e, r) => e.slice(0, -1).concat([e[e.length - 1].concat(r[0])]).concat(r.slice(1)), ht = /\d/, lt = /^epubcfi\((.*)\)$/, Yt = (e) => e.replace(/[\^[\](),;=]/g, "^$&"), $r = (e) => lt.test(e) ? e : `epubcfi(${e})`, no = (e) => {
  var r;
  return ((r = e.match(lt)) == null ? void 0 : r[1]) ?? e;
}, oo = (e) => (...r) => `epubcfi(${e(...r.map((t) => {
  var o;
  return ((o = t.match(lt)) == null ? void 0 : o[1]) ?? t;
}))})`, so = oo((...e) => e.join("!")), io = (e) => {
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
      if (ht.test(a)) {
        i(a);
        continue;
      } else s([t, parseInt(n)]);
    else if (t === "~")
      if (ht.test(a) || a === ".") {
        i(a);
        continue;
      } else s(["~", parseFloat(n)]);
    else if (t === "@") {
      if (a === ":") {
        s(["@", parseFloat(n)]), t = "@";
        continue;
      }
      if (ht.test(a) || a === ".") {
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
}, Rr = (e, r) => to(e, ([t]) => t === r), ao = (e) => {
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
}, Xt = (e) => Mr(e, Rr(e, "!")).map(ao), $e = (e) => {
  const r = io(no(e)), t = Rr(r, ",");
  if (!t.length) return Xt(r);
  const [o, n, s] = Mr(r, t).map(Xt);
  return { parent: o, start: n, end: s };
}, lo = ({ index: e, id: r, offset: t, temporal: o, spatial: n, text: s, side: i }) => {
  var l;
  const a = i ? `;s=${i}` : "";
  return `/${e}` + (r ? `[${Yt(r)}${a}]` : "") + // "CFI expressions [..] SHOULD include an explicit character offset"
  (t != null && e % 2 ? `:${t}` : "") + (o ? `~${o}` : "") + (n ? `@${n.join(":")}` : "") + (s || !r && i ? "[" + (((l = s == null ? void 0 : s.map(Yt)) == null ? void 0 : l.join(",")) ?? "") + a + "]" : "");
}, _r = (e) => e.parent ? [e.parent, e.start, e.end].map(_r).join(",") : e.map((r) => r.map(lo).join("")).join("!"), ct = (e) => $r(_r(e)), de = (e, r) => typeof e == "string" ? ct(de($e(e), r)) : e.parent ? ro(e.parent, e[r ? "end" : "start"]) : e, co = (e, r) => {
  typeof e == "string" && (e = $e(e)), typeof r == "string" && (r = $e(r)), e = de(e), r = de(r, !0);
  const t = e[e.length - 1], o = r[r.length - 1], n = [], s = [], i = [];
  let a = !0;
  const l = Math.max(t.length, o.length);
  for (let d = 0; d < l; d++) {
    const u = t[d], p = o[d];
    a && (a = (u == null ? void 0 : u.index) === (p == null ? void 0 : p.index) && !(u != null && u.offset) && !(p != null && p.offset)), a ? n.push(u) : (u && s.push(u), p && i.push(p));
  }
  const c = e.slice(0, -1).concat([n]);
  return ct({ parent: c, start: [s], end: [i] });
}, rt = (e, r) => {
  if (typeof e == "string" && (e = $e(e)), typeof r == "string" && (r = $e(r)), e.start || r.start) return rt(de(e), de(r)) || rt(de(e, !0), de(r, !0));
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
}, yt = ({ nodeType: e }) => e === 3 || e === 4, Ze = ({ nodeType: e }) => e === 1, Hr = (e, r) => {
  const t = Array.from(e.childNodes).filter((o) => yt(o) || Ze(o));
  return r ? t.map((o) => {
    const n = r(o);
    return n === NodeFilter.FILTER_REJECT ? null : n === NodeFilter.FILTER_SKIP ? Hr(o, r) : o;
  }).flat().filter((o) => o) : t;
}, zt = (e, r) => {
  const t = Hr(e, r).reduce((o, n) => {
    let s = o[o.length - 1];
    return s ? yt(n) ? Array.isArray(s) ? s.push(n) : yt(s) ? o[o.length - 1] = [s, n] : o.push(n) : Ze(s) ? o.push(null, n) : o.push(n) : o.push(n), o;
  }, []);
  return Ze(t[0]) && t.unshift("first"), Ze(t[t.length - 1]) && t.push("last"), t.unshift("before"), t.push("after"), t;
}, vt = (e, r, t) => {
  const { id: o } = r[r.length - 1];
  if (o) {
    const i = e.ownerDocument.getElementById(o);
    if (i) return { node: i, offset: 0 };
  }
  for (const { index: i } of r) {
    const a = e ? zt(e, t)[i] : null;
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
}, nt = (e, r, t) => {
  const { parentNode: o, id: n } = e, s = zt(o, t), i = s.findIndex((c) => Array.isArray(c) ? c.some((d) => d === e) : c === e), a = s[i];
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
  return (o !== e.ownerDocument.documentElement ? nt(o, null, t).concat(l) : [l]).filter((c) => c.index !== -1);
}, uo = (e, r) => {
  const { startContainer: t, startOffset: o, endContainer: n, endOffset: s } = e, i = nt(t, o, r);
  if (e.collapsed) return ct([i]);
  const a = nt(n, s, r);
  return co([i], [a]);
}, po = (e, r, t) => {
  const o = de(r), n = de(r, !0), s = e.documentElement, i = vt(s, o[0], t), a = vt(s, n[0], t), l = e.createRange();
  return i.before ? l.setStartBefore(i.node) : i.after ? l.setStartAfter(i.node) : l.setStart(i.node, i.offset), a.before ? l.setEndBefore(a.node) : a.after ? l.setEndAfter(a.node) : l.setEnd(a.node, a.offset), l;
}, $i = (e) => {
  const r = [], { parentNode: t } = e[0], o = nt(t);
  for (const [n, s] of zt(t).entries()) {
    const i = e[r.length];
    s === i && r.push(ct([o.concat({ id: i.id, index: n })]));
  }
  return r;
}, Ri = (e, r) => vt(e.documentElement, de(r)).node, Zt = {
  fromIndex: (e) => $r(`/6/${(e + 1) * 2}`),
  toIndex: (e) => (e == null ? void 0 : e.at(-1).index) / 2 - 1
}, ho = (e) => {
  let r = 0;
  const t = (o) => {
    if (o.id = r++, o.subitems) for (const n of o.subitems) t(n);
  };
  for (const o of e) t(o);
  return e;
}, Dr = (e) => e.map((r) => {
  var t;
  return (t = r.subitems) != null && t.length ? [r, Dr(r.subitems)].flat() : r;
}).flat();
class Jt {
  async init({ toc: r, ids: t, splitHref: o, getFragment: n }) {
    ho(r);
    const s = Dr(r), i = /* @__PURE__ */ new Map();
    for (const [l, c] of s.entries()) {
      const [d, u] = await o(c == null ? void 0 : c.href) ?? [], p = { fragment: u, item: c };
      i.has(d) ? i.get(d).items.push(p) : i.set(d, { prev: s[l - 1], items: [p] });
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
var st, Gr;
class fo {
  constructor(r, t, o) {
    X(this, st);
    this.sizes = r.map((n) => n.linear != "no" && n.size > 0 ? n.size : 0), this.sizePerLoc = t, this.sizePerTimeUnit = o, this.sizeTotal = this.sizes.reduce((n, s) => n + s, 0), this.sectionFractions = K(this, st, Gr).call(this);
  }
  // get progress given index of and fractions within a section
  getProgress(r, t, o = 0) {
    const { sizes: n, sizePerLoc: s, sizePerTimeUnit: i, sizeTotal: a } = this, l = n[r] ?? 0, d = n.slice(0, r).reduce((f, b) => f + b, 0) + t * l, u = d + o * l, p = a - d, h = (1 - t) * l;
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
        section: h / i,
        total: p / i
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
st = new WeakSet(), Gr = function() {
  const { sizeTotal: r } = this, t = [0];
  let o = 0;
  for (const n of this.sizes) t.push((o += n) / r);
  return t;
};
const se = (e) => document.createElementNS("http://www.w3.org/2000/svg", e);
var we, Se;
class Qt {
  constructor() {
    X(this, we, se("svg"));
    X(this, Se, /* @__PURE__ */ new Map());
    Object.assign(E(this, we).style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none"
    });
  }
  get element() {
    return E(this, we);
  }
  add(r, t, o, n) {
    E(this, Se).has(r) && this.remove(r), typeof t == "function" && (t = t(E(this, we).getRootNode()));
    const s = t.getClientRects(), i = o(s, n);
    E(this, we).append(i), E(this, Se).set(r, { range: t, draw: o, options: n, element: i, rects: s });
  }
  remove(r) {
    E(this, Se).has(r) && (E(this, we).removeChild(E(this, Se).get(r).element), E(this, Se).delete(r));
  }
  redraw() {
    for (const r of E(this, Se).values()) {
      const { range: t, draw: o, options: n, element: s } = r;
      E(this, we).removeChild(s);
      const i = t.getClientRects(), a = o(i, n);
      E(this, we).append(a), r.element = a, r.rects = i;
    }
  }
  hitTest({ x: r, y: t }) {
    const o = Array.from(E(this, Se).entries());
    for (let n = o.length - 1; n >= 0; n--) {
      const [s, i] = o[n];
      for (const { left: a, top: l, right: c, bottom: d } of i.rects) if (l <= t && a <= r && d > t && c > r) return [s, i.range];
    }
    return [];
  }
  static underline(r, t = {}) {
    const { color: o = "red", width: n = 2, writingMode: s } = t, i = se("g");
    if (i.setAttribute("fill", o), s === "vertical-rl" || s === "vertical-lr")
      for (const { right: a, top: l, height: c } of r) {
        const d = se("rect");
        d.setAttribute("x", a - n), d.setAttribute("y", l), d.setAttribute("height", c), d.setAttribute("width", n), i.append(d);
      }
    else
      for (const { left: a, bottom: l, width: c } of r) {
        const d = se("rect");
        d.setAttribute("x", a), d.setAttribute("y", l - n), d.setAttribute("height", n), d.setAttribute("width", c), i.append(d);
      }
    return i;
  }
  static strikethrough(r, t = {}) {
    const { color: o = "red", width: n = 2, writingMode: s } = t, i = se("g");
    if (i.setAttribute("fill", o), s === "vertical-rl" || s === "vertical-lr")
      for (const { right: a, left: l, top: c, height: d } of r) {
        const u = se("rect");
        u.setAttribute("x", (a + l) / 2), u.setAttribute("y", c), u.setAttribute("height", d), u.setAttribute("width", n), i.append(u);
      }
    else
      for (const { left: a, top: l, bottom: c, width: d } of r) {
        const u = se("rect");
        u.setAttribute("x", a), u.setAttribute("y", (l + c) / 2), u.setAttribute("height", n), u.setAttribute("width", d), i.append(u);
      }
    return i;
  }
  static squiggly(r, t = {}) {
    const { color: o = "red", width: n = 2, writingMode: s } = t, i = se("g");
    i.setAttribute("fill", "none"), i.setAttribute("stroke", o), i.setAttribute("stroke-width", n);
    const a = n * 1.5;
    if (s === "vertical-rl" || s === "vertical-lr")
      for (const { right: l, top: c, height: d } of r) {
        const u = se("path"), p = Math.round(d / a / 1.5), h = d / p, f = Array.from({ length: p }, (b, m) => `l${m % 2 ? -a : a} ${h}`).join("");
        u.setAttribute("d", `M${l} ${c}${f}`), i.append(u);
      }
    else
      for (const { left: l, bottom: c, width: d } of r) {
        const u = se("path"), p = Math.round(d / a / 1.5), h = d / p, f = Array.from({ length: p }, (b, m) => `l${h} ${m % 2 ? a : -a}`).join("");
        u.setAttribute("d", `M${l} ${c}${f}`), i.append(u);
      }
    return i;
  }
  static highlight(r, t = {}) {
    const { color: o = "red" } = t, n = se("g");
    n.setAttribute("fill", o), n.style.opacity = "var(--overlayer-highlight-opacity, .3)", n.style.mixBlendMode = "var(--overlayer-highlight-blend-mode, normal)";
    for (const { left: s, top: i, height: a, width: l } of r) {
      const c = se("rect");
      c.setAttribute("x", s), c.setAttribute("y", i), c.setAttribute("height", a), c.setAttribute("width", l), n.append(c);
    }
    return n;
  }
  static outline(r, t = {}) {
    const { color: o = "red", width: n = 3, radius: s = 3 } = t, i = se("g");
    i.setAttribute("fill", "none"), i.setAttribute("stroke", o), i.setAttribute("stroke-width", n);
    for (const { left: a, top: l, height: c, width: d } of r) {
      const u = se("rect");
      u.setAttribute("x", a), u.setAttribute("y", l), u.setAttribute("height", c), u.setAttribute("width", d), u.setAttribute("rx", s), i.append(u);
    }
    return i;
  }
  // make an exact copy of an image in the overlay
  // one can then apply filters to the entire element, without affecting them;
  // it's a bit silly and probably better to just invert images twice
  // (though the color will be off in that case if you do heu-rotate)
  static copyImage([r], t = {}) {
    const { src: o } = t, n = se("image"), { left: s, top: i, height: a, width: l } = r;
    return n.setAttribute("href", o), n.setAttribute("x", s), n.setAttribute("y", i), n.setAttribute("height", a), n.setAttribute("width", l), n;
  }
}
we = new WeakMap(), Se = new WeakMap();
const go = (e, r) => {
  const t = [];
  for (let o = r.currentNode; o; o = r.nextNode()) {
    const n = e.comparePoint(o, 0);
    if (n === 0) t.push(o);
    else if (n > 0) break;
  }
  return t;
}, bo = (e, r) => {
  const t = [];
  for (let o = r.nextNode(); o; o = r.nextNode()) t.push(o);
  return t;
}, mo = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_CDATA_SECTION, xo = (e) => {
  if (e.nodeType === 1) {
    const r = e.tagName.toLowerCase();
    return r === "script" || r === "style" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
  }
  return NodeFilter.FILTER_ACCEPT;
}, er = function* (e, r, t) {
  const o = e.commonAncestorContainer ?? e.body ?? e, n = document.createTreeWalker(o, mo, { acceptNode: t || xo }), i = (e.commonAncestorContainer ? go : bo)(e, n), a = i.map((c) => c.nodeValue), l = (c, d, u, p) => {
    const h = document.createRange();
    return h.setStart(i[c], d), h.setEnd(i[u], p), h;
  };
  for (const c of r(a, l)) yield c;
}, yo = (e, r, t, o = null, n = null, s = null) => {
  const i = /* @__PURE__ */ new Set([
    "META-INF/encryption.xml",
    "META-INF/com.apple.ibooks.display-options.xml",
    "META-INF/com.kobobooks.display-options.xml",
    "META-INF/calibre_bookmarks.txt"
  ]), a = (g) => i.has(g) || /(^|\/)toc\.ncx$/i.test(g), l = Array.isArray(t == null ? void 0 : t.optionalFiles), c = l ? new Set(t.optionalFiles) : null, d = (g) => l && i.has(g) && !c.has(g), u = new Map(t.manifest.map((g) => [g.href, g])), p = (g) => {
    if (!g) return null;
    const v = g.split("/").map(encodeURIComponent).join("/");
    let A = `${r}/${e}/file/${v}`;
    const T = new URLSearchParams();
    n && T.append("bookType", n), s != null && T.append("fileId", String(s));
    const N = T.toString();
    return N && (A += `?${N}`), A;
  }, h = () => o ? {
    headers: {
      Authorization: `Bearer ${o}`
    }
  } : {};
  return {
    loadText: async (g) => {
      if (!g || d(g)) return null;
      try {
        const v = p(g), A = await fetch(v, h());
        return A.ok ? await A.text() : (A.status === 404 && !u.has(g) || A.status === 404 && a(g) || console.warn(`Failed to load text: ${g}`, A.status), null);
      } catch (v) {
        return console.error(`Error loading text ${g}:`, v), null;
      }
    },
    loadBlob: async (g, v) => {
      if (!g) return null;
      try {
        const A = p(g), T = await fetch(A, h());
        if (!T.ok)
          return console.warn(`Failed to load blob: ${g}`, T.status), null;
        const N = await T.blob();
        return v ? new Blob([N], { type: v }) : N;
      } catch (A) {
        return console.error(`Error loading blob ${g}:`, A), null;
      }
    },
    getSize: (g) => {
      if (!g) return 0;
      const v = u.get(g);
      return (v == null ? void 0 : v.size) ?? 0;
    },
    // getDirectUrl intentionally omitted: browser-initiated fetches from inside a
    // sandboxed blob-URL iframe are blocked by Cross-Origin-Resource-Policy headers.
    // Images go through loadBlob (JS fetch with Authorization header) instead.
    _bookInfo: t,
    _manifestMap: u
  };
}, _e = "foliate-search:", vo = (e) => typeof e == "number" && Number.isFinite(e) ? Math.max(0, Math.min(100, e * 100)) : null, tr = (e) => e ? e.nodeType === 1 ? e : e.parentElement ?? null : null, jr = (e) => {
  var r, t;
  return e ? ((r = e.startContainer) == null ? void 0 : r.nodeType) === 3 ? { node: e.startContainer, offset: e.startOffset } : ((t = e.endContainer) == null ? void 0 : t.nodeType) === 3 ? { node: e.endContainer, offset: e.endOffset } : { node: e.startContainer, offset: e.startOffset } : null;
}, ko = (e) => {
  var s, i, a, l, c;
  if (!e) return null;
  const r = jr(e), t = (i = (s = tr(r == null ? void 0 : r.node)) == null ? void 0 : s.closest) == null ? void 0 : i.call(s, '.koboSpan[id^="kobo."]');
  if (t != null && t.id) return t.id;
  const o = ((a = e.commonAncestorContainer) == null ? void 0 : a.ownerDocument) ?? ((l = tr(e.commonAncestorContainer)) == null ? void 0 : l.ownerDocument), n = ((c = o == null ? void 0 : o.querySelectorAll) == null ? void 0 : c.call(o, '.koboSpan[id^="kobo."]')) ?? [];
  for (const d of n)
    try {
      if (e.intersectsNode(d)) return d.id;
    } catch {
    }
  return null;
}, Ve = (e) => e ? e.nodeType === 3 ? "text()" : e.nodeType === 1 && e.localName ? e.localName : null : null, wo = (e) => {
  const r = Ve(e);
  if (!r) return 1;
  const o = Pt(dt(e)).filter((n) => n.type === "element" && Ve(n.node) === r).findIndex((n) => n.node === e);
  return o >= 0 ? o + 1 : 1;
}, So = (e) => {
  const r = Ve(e);
  return r && Pt(dt(e)).filter((t) => t.type === "element" && Ve(t.node) === r).length || 1;
}, Eo = (e) => {
  const r = Ve(e);
  return r ? So(e) > 1 ? `${r}[${wo(e)}]` : r : null;
}, Co = (e) => (e == null ? void 0 : e.nodeType) === 1 && (e.id === "book-columns" || e.id === "book-inner"), Ao = (e) => {
  var r;
  return (e == null ? void 0 : e.nodeType) === 1 && ((r = e.classList) == null ? void 0 : r.contains("koboSpan")) && /^kobo\./.test(e.id ?? "");
}, It = (e) => Co(e) || Ao(e), dt = (e) => {
  let r = (e == null ? void 0 : e.parentNode) ?? null;
  for (; It(r); ) r = r.parentNode;
  return r;
}, Wr = (e, r) => {
  if (r) {
    if (It(r)) {
      for (const t of r.childNodes) Wr(e, t);
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
}, Pt = (e) => {
  const r = [];
  for (const t of (e == null ? void 0 : e.childNodes) ?? []) Wr(r, t);
  return r;
}, To = (e) => {
  if (!e) return null;
  const r = e.ownerDocument ?? (e.nodeType === 9 ? e : null), t = r == null ? void 0 : r.body;
  if (!t) return null;
  const o = [];
  let n = e;
  for (; n; ) {
    if (n === t)
      return o.unshift("body"), `/${o.join("/")}`;
    if (!It(n)) {
      const s = Eo(n);
      if (!s) return null;
      o.unshift(s);
    }
    n = dt(n);
  }
  return null;
}, Lo = (e) => {
  var o, n;
  if (((o = e == null ? void 0 : e.node) == null ? void 0 : o.nodeType) !== 3) return null;
  const r = dt(e.node);
  if (!r) return null;
  const t = Pt(r).filter((s) => s.type === "text");
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
}, No = (e) => typeof (e == null ? void 0 : e.id) != "string" ? null : e.id.split(/[?#]/)[0].split("/").pop() ?? null, rr = (e) => No(e) === "kepubify-titlepage-dummy.xhtml", Bo = (e, r) => {
  if (!Array.isArray(e) || typeof r != "number") return null;
  const t = e[r];
  if (!t || rr(t)) return null;
  let o = 0;
  for (let n = 0; n <= r && n < e.length; n += 1)
    rr(e[n]) || (o += 1);
  return o || null;
}, zo = (e, r) => {
  if (!r || typeof e != "number") return null;
  const t = jr(r);
  if (!t) return null;
  const o = Lo(t);
  if (!o) return null;
  const n = To(o.parent);
  if (!n) return null;
  const s = o.count > 1 ? `text()[${o.index}]` : "text()";
  return `/body/DocFragment[${e}]${n}/${s}.${o.offset}`;
}, Io = async (e) => {
  const r = new Uint8Array(await e.slice(0, 4).arrayBuffer());
  return r[0] === 80 && r[1] === 75 && r[2] === 3 && r[3] === 4;
}, Po = async (e) => {
  const r = new Uint8Array(await e.slice(0, 5).arrayBuffer());
  return r[0] === 37 && r[1] === 80 && r[2] === 68 && r[3] === 70 && r[4] === 45;
}, Fo = ({ name: e, type: r }) => r === "application/vnd.comicbook+zip" || e.endsWith(".cbz"), Oo = async (e) => {
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
}, Mo = ({ name: e, type: r }) => r === "application/x-zip-compressed-fb2" || e.endsWith(".fb2.zip") || e.endsWith(".fbz"), $o = async (e) => {
  const { configure: r, ZipReader: t, BlobReader: o, TextWriter: n, BlobWriter: s } = await import("./zip-DYE5jiUF.js");
  r({ useWebWorkers: !1 });
  const a = await new t(new o(e)).getEntries(), l = new Map(a.map((h) => [h.filename, h])), c = (h) => (f, ...b) => l.has(f) ? h(l.get(f), ...b) : null, d = c((h) => h.getData(new n())), u = c((h, f) => h.getData(new s(f)));
  return { entries: a, loadText: d, loadBlob: u, getSize: (h) => {
    var f;
    return ((f = l.get(h)) == null ? void 0 : f.uncompressedSize) ?? 0;
  } };
}, Ur = async (e) => e.isFile ? e : (await Promise.all(
  Array.from(
    await new Promise(
      (r, t) => e.createReader().readEntries(
        (o) => r(o),
        (o) => t(o)
      )
    ),
    Ur
  )
)).flat(), Ro = async (e) => {
  const r = await Ur(e), t = await Promise.all(
    r.map(
      (d) => new Promise(
        (u, p) => d.file(
          (h) => u([h, d.fullPath]),
          (h) => p(h)
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
class _o extends Error {
}
class Ho extends Error {
}
class Do extends Error {
}
const Go = async (e) => {
  const r = await fetch(e);
  if (!r.ok) throw new _o(`${r.status} ${r.statusText}`, { cause: r });
  return new File([await r.blob()], new URL(r.url).pathname);
}, jo = async (e) => {
  typeof e == "string" && (e = await Go(e));
  let r;
  if (e.isDirectory) {
    const t = await Ro(e), { EPUB: o } = await import("./epub-DbQ1x9X0.js");
    r = await new o(t).init();
  } else if (e.size) if (await Io(e)) {
    const t = await $o(e);
    if (Fo(e)) {
      const { makeComicBook: o } = await import("./comic-book-CFGkssgs.js");
      r = o(t, e);
    } else if (Mo(e)) {
      const { makeFB2: o } = await import("./fb2-C35PDn_9.js"), { entries: n } = t, s = n.find((a) => a.filename.endsWith(".fb2")), i = await t.loadBlob((s ?? n[0]).filename);
      r = await o(i);
    } else {
      const { EPUB: o } = await import("./epub-DbQ1x9X0.js");
      r = await new o(t).init();
    }
  } else if (await Po(e)) {
    const { makePDF: t } = await Promise.reject(new Error("PDF is not supported by Reactor"));
    r = await t(e);
  } else {
    const { isMOBI: t, MOBI: o } = await import("./mobi-BTL-eN-z.js");
    if (await t(e)) {
      const n = await import("./fflate-Cq_OVrsP.js");
      r = await new o({ unzlib: n.unzlibSync }).open(e);
    } else if (Oo(e)) {
      const { makeFB2: n } = await import("./fb2-C35PDn_9.js");
      r = await n(e);
    }
  }
  else throw new Ho("File not found");
  if (!r) throw new Do("File type not supported");
  return r;
}, Wo = async (e, r, t, o = null, n = null, s = null) => {
  const i = yo(e, r, t, o, n, s), { EPUB: a } = await import("./epub-DbQ1x9X0.js");
  return new a(i).init();
};
var Me, ze, qe, ue;
const Rt = class Rt {
  constructor(r, t, o = {}) {
    X(this, Me);
    X(this, ze);
    X(this, qe);
    X(this, ue);
    Z(this, ze, r), Z(this, qe, t), Z(this, ue, o), E(this, ue).hidden && this.hide(), E(this, ze).addEventListener(
      "mousemove",
      ({ screenX: n, screenY: s }) => {
        n === E(this, ue).x && s === E(this, ue).y || (E(this, ue).x = n, E(this, ue).y = s, this.show(), E(this, Me) && clearTimeout(E(this, Me)), t() && Z(this, Me, setTimeout(this.hide.bind(this), 1e3)));
      },
      !1
    );
  }
  cloneFor(r) {
    return new Rt(r, E(this, qe), E(this, ue));
  }
  hide() {
    E(this, ze).style.cursor = "none", E(this, ue).hidden = !0;
  }
  show() {
    E(this, ze).style.removeProperty("cursor"), E(this, ue).hidden = !1;
  }
};
Me = new WeakMap(), ze = new WeakMap(), qe = new WeakMap(), ue = new WeakMap();
let kt = Rt;
var pe, le;
class Uo extends EventTarget {
  constructor() {
    super(...arguments);
    X(this, pe, []);
    X(this, le, -1);
  }
  pushState(t) {
    const o = E(this, pe)[E(this, le)];
    o === t || o != null && o.fraction && o.fraction === t.fraction || (E(this, pe)[++Kt(this, le)._] = t, E(this, pe).length = E(this, le) + 1, this.dispatchEvent(new Event("index-change")));
  }
  replaceState(t) {
    const o = E(this, le);
    E(this, pe)[o] = t;
  }
  back() {
    const t = E(this, le);
    if (t <= 0) return;
    const o = { state: E(this, pe)[t - 1] };
    Z(this, le, t - 1), this.dispatchEvent(new CustomEvent("popstate", { detail: o })), this.dispatchEvent(new Event("index-change"));
  }
  forward() {
    const t = E(this, le);
    if (t >= E(this, pe).length - 1) return;
    const o = { state: E(this, pe)[t + 1] };
    Z(this, le, t + 1), this.dispatchEvent(new CustomEvent("popstate", { detail: o })), this.dispatchEvent(new Event("index-change"));
  }
  get canGoBack() {
    return E(this, le) > 0;
  }
  get canGoForward() {
    return E(this, le) < E(this, pe).length - 1;
  }
  clear() {
    Z(this, pe, []), Z(this, le, -1);
  }
}
pe = new WeakMap(), le = new WeakMap();
const Vo = (e) => {
  var r, t;
  if (!e) return {};
  try {
    const o = Intl.getCanonicalLocales(e)[0], n = new Intl.Locale(o), s = ["zh", "ja", "kr"].includes(n.language), i = (t = ((r = n.getTextInfo) == null ? void 0 : r.call(n)) ?? n.textInfo) == null ? void 0 : t.direction;
    return { canonical: o, locale: n, isCJK: s, direction: i };
  } catch (o) {
    return console.warn(o), {};
  }
};
var it, Te, ye, Be, Le, at, G, Ae, Vr, qr, Kr, Je, Yr, Xr, Zr;
class qo extends HTMLElement {
  constructor() {
    super();
    X(this, G);
    X(this, it, this.attachShadow({ mode: "closed" }));
    X(this, Te);
    X(this, ye);
    X(this, Be);
    X(this, Le, /* @__PURE__ */ new Map());
    X(this, at, new kt(this, () => this.hasAttribute("autohide-cursor")));
    L(this, "isFixedLayout", !1);
    L(this, "lastLocation");
    L(this, "history", new Uo());
    this.history.addEventListener("popstate", ({ detail: t }) => {
      const o = this.resolveNavigation(t.state);
      this.renderer.goTo(o);
    });
  }
  async open(t) {
    var o, n;
    if ((typeof t == "string" || typeof t.arrayBuffer == "function" || t.isDirectory) && (t = await jo(t)), this.book = t, this.language = Vo((o = t.metadata) == null ? void 0 : o.language), t.splitTOCHref && t.getTOCFragment) {
      const s = t.sections.map((l) => l.id);
      Z(this, Te, new fo(t.sections, 1500, 1600));
      const i = t.splitTOCHref.bind(t), a = t.getTOCFragment.bind(t);
      Z(this, ye, new Jt()), await E(this, ye).init({
        toc: t.toc ?? [],
        ids: s,
        splitHref: i,
        getFragment: a
      }), Z(this, Be, new Jt()), await E(this, Be).init({
        toc: t.pageList ?? [],
        ids: s,
        splitHref: i,
        getFragment: a
      });
    }
    if (this.isFixedLayout = ((n = this.book.rendition) == null ? void 0 : n.layout) === "pre-paginated", this.isFixedLayout ? (await import("./fixed-layout-CmKgjWz_.js"), this.renderer = document.createElement("foliate-fxl")) : (await import("./paginator-mWbe4Oik.js"), this.renderer = document.createElement("foliate-paginator")), this.renderer.setAttribute("exportparts", "head,foot,filter"), this.renderer.addEventListener("load", (s) => K(this, G, qr).call(this, s.detail)), this.renderer.addEventListener("relocate", (s) => K(this, G, Vr).call(this, s.detail)), this.renderer.addEventListener("create-overlayer", (s) => s.detail.attach(K(this, G, Yr).call(this, s.detail))), this.renderer.open(t), E(this, it).append(this.renderer), t.sections.some((s) => s.mediaOverlay)) {
      const s = t.media.activeClass, i = t.media.playbackActiveClass;
      this.mediaOverlay = t.getMediaOverlay();
      let a;
      this.mediaOverlay.addEventListener("highlight", (l) => {
        const c = this.resolveNavigation(l.detail.text), d = () => {
          const u = this.renderer.getContents().find((h) => h.index === c.index);
          if (!u) return;
          const p = c.anchor(u.doc);
          p.classList.add(s), i && p.ownerDocument.documentElement.classList.add(i), a = new WeakRef(p);
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
    (t = this.renderer) == null || t.destroy(), (o = this.renderer) == null || o.remove(), Z(this, Te, null), Z(this, ye, null), Z(this, Be, null), Z(this, Le, /* @__PURE__ */ new Map()), this.lastLocation = null, this.history.clear(), this.tts = null, this.mediaOverlay = null;
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
    if (n.startsWith(_e)) {
      const d = n.replace(_e, ""), { index: u, anchor: p } = await this.resolveNavigation(d), h = K(this, G, Je).call(this, u);
      if (h) {
        const { overlayer: f, doc: b } = h;
        if (o) {
          f.remove(n);
          return;
        }
        const m = b ? p(b) : p;
        f.add(n, m, Qt.outline);
      }
      return;
    }
    const { index: s, anchor: i } = await this.resolveNavigation(n), a = K(this, G, Je).call(this, s);
    if (a) {
      const { overlayer: d, doc: u } = a;
      if (d.remove(n), !o) {
        const p = u ? i(u) : i, h = (f, b) => d.add(n, p, f, b);
        K(this, G, Ae).call(this, "draw-annotation", { draw: h, annotation: t, doc: u, range: p });
      }
    }
    const l = ((c = E(this, ye).getProgress(s)) == null ? void 0 : c.label) ?? "";
    return { index: s, label: l };
  }
  deleteAnnotation(t) {
    return this.addAnnotation(t, !0);
  }
  async showAnnotation(t) {
    const { value: o } = t, n = await this.goTo(o);
    if (n) {
      const { index: s, anchor: i } = n, { doc: a } = K(this, G, Je).call(this, s), l = i(a);
      K(this, G, Ae).call(this, "show-annotation", { value: o, index: s, range: l });
    }
  }
  getCFI(t, o) {
    const n = this.book.sections[t].cfi ?? Zt.fromIndex(t);
    return o ? so(n, uo(o)) : n;
  }
  resolveCFI(t) {
    if (this.book.resolveCFI) return this.book.resolveCFI(t);
    {
      const o = $e(t);
      return { index: Zt.toIndex((o.parent ?? o).shift()), anchor: (i) => po(i, o) };
    }
  }
  resolveNavigation(t) {
    try {
      if (typeof t == "number") return { index: t };
      if (typeof t.fraction == "number") {
        const [o, n] = E(this, Te).getSection(t.fraction);
        return { index: o, anchor: n };
      }
      return lt.test(t) ? this.resolveCFI(t) : this.book.resolveHref(t);
    } catch (o) {
      console.error(o), console.error(`Could not resolve target ${t}`);
    }
  }
  async goTo(t) {
    var i, a;
    const o = this.resolveNavigation(t), n = (l) => {
      var d, u;
      const c = ((u = (d = this.renderer).getContents) == null ? void 0 : u.call(d)) ?? [];
      return c.length ? typeof (l == null ? void 0 : l.index) != "number" ? !0 : c.some((p) => (p == null ? void 0 : p.index) === l.index) : !1;
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
        for (let p = o.index + 1; p < u; p++)
          if (l = await s({ index: p }), l) {
            c = p, d = { index: p }, console.warn(`Skipped unreadable section ${o.index}, opened section ${p}`);
            break;
          }
        if (!l) {
          for (let p = o.index - 1; p >= 0; p--)
            if (l = await s({ index: p }), l) {
              c = p, d = { index: p }, console.warn(`Skipped unreadable section ${o.index}, opened section ${p}`);
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
    const [o, n] = E(this, Te).getSection(t);
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
    return (((t = E(this, Te)) == null ? void 0 : t.sectionFractions) ?? []).map((o) => o + Number.EPSILON);
  }
  getProgressOf(t, o) {
    var i, a;
    const n = (i = E(this, ye)) == null ? void 0 : i.getProgress(t, o), s = (a = E(this, Be)) == null ? void 0 : a.getProgress(t, o);
    return { tocItem: n, pageItem: s };
  }
  async getTOCItemOf(t) {
    try {
      const { index: o, anchor: n } = await this.resolveNavigation(t), s = await this.book.sections[o].createDocument(), i = n(s), a = i instanceof Range, l = a ? i : s.createRange();
      return a || l.selectNodeContents(i), E(this, ye).getProgress(o, l);
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
    const { searchMatcher: o } = await import("./search-B5o8p515.js"), { query: n, index: s } = t, i = o(er, { defaultLocale: this.language, ...t }), a = s != null ? K(this, G, Xr).call(this, i, n, s) : K(this, G, Zr).call(this, i, n), l = [];
    E(this, Le).set(s, l);
    for await (const d of a)
      if (d.subitems) {
        const u = d.subitems.map(({ cfi: p }) => ({ value: _e + p }));
        E(this, Le).set(d.index, u);
        for (const p of u) this.addAnnotation(p);
        yield {
          label: ((c = E(this, ye).getProgress(d.index)) == null ? void 0 : c.label) ?? "",
          subitems: d.subitems
        };
      } else {
        if (d.cfi) {
          const u = { value: _e + d.cfi };
          l.push(u), this.addAnnotation(u);
        }
        yield d;
      }
    yield "done";
  }
  clearSearch() {
    for (const t of E(this, Le).values()) for (const o of t) this.deleteAnnotation(o);
    E(this, Le).clear();
  }
  async initTTS(t = "word", o) {
    const n = this.renderer.getContents()[0].doc;
    if (this.tts && this.tts.doc === n) return;
    const { TTS: s } = await import("./tts-CwKuZ_aa.js");
    this.tts = new s(n, er, o || ((i) => this.renderer.scrollToAnchor(i, !0)), t);
  }
  startMediaOverlay() {
    const { index: t } = this.renderer.getContents()[0];
    return this.mediaOverlay.start(t);
  }
}
it = new WeakMap(), Te = new WeakMap(), ye = new WeakMap(), Be = new WeakMap(), Le = new WeakMap(), at = new WeakMap(), G = new WeakSet(), Ae = function(t, o, n) {
  return this.dispatchEvent(new CustomEvent(t, { detail: o, cancelable: n }));
}, Vr = function({ reason: t, range: o, index: n, fraction: s, size: i }) {
  var g, v, A, T;
  const a = ((g = E(this, Te)) == null ? void 0 : g.getProgress(n, s, i)) ?? {}, l = (v = E(this, ye)) == null ? void 0 : v.getProgress(n, o), c = (A = E(this, Be)) == null ? void 0 : A.getProgress(n, o), d = this.getCFI(n, o), u = ((T = this.book.sections[n]) == null ? void 0 : T.id) ?? null, p = vo(s), h = ko(o), f = h ? "KoboSpan" : null, b = Bo(this.book.sections, n), m = zo(b, o);
  this.lastLocation = {
    ...a,
    tocItem: l,
    pageItem: c,
    cfi: d,
    range: o,
    source: u,
    koboLocationType: f,
    koboLocationValue: h,
    contentSourceProgressPercent: p,
    koreaderProgress: m
  }, (t === "snap" || t === "page" || t === "scroll") && this.history.replaceState(d), K(this, G, Ae).call(this, "relocate", this.lastLocation);
}, qr = function({ doc: t, index: o }) {
  var n, s;
  (n = t.documentElement).lang || (n.lang = this.language.canonical ?? ""), this.language.isCJK || (s = t.documentElement).dir || (s.dir = this.language.direction ?? ""), K(this, G, Kr).call(this, t, o), E(this, at).cloneFor(t.documentElement), K(this, G, Ae).call(this, "load", { doc: t, index: o });
}, Kr = function(t, o) {
  const { book: n } = this, s = n.sections[o];
  t.addEventListener("click", (i) => {
    var d, u;
    const a = i.target.closest("a[href]");
    if (!a) return;
    i.preventDefault();
    const l = a.getAttribute("href"), c = ((d = s == null ? void 0 : s.resolveHref) == null ? void 0 : d.call(s, l)) ?? l;
    (u = n == null ? void 0 : n.isExternal) != null && u.call(n, c) ? Promise.resolve(K(this, G, Ae).call(this, "external-link", { a, href: c }, !0)).then((p) => p ? globalThis.open(c, "_blank") : null).catch((p) => console.error(p)) : Promise.resolve(K(this, G, Ae).call(this, "link", { a, href: c }, !0)).then((p) => p ? this.goTo(c) : null).catch((p) => console.error(p));
  });
}, Je = function(t) {
  return this.renderer.getContents().find((o) => o.index === t && o.overlayer);
}, Yr = function({ doc: t, index: o }) {
  const n = new Qt();
  t.addEventListener(
    "click",
    (i) => {
      const [a, l] = n.hitTest(i);
      a && !a.startsWith(_e) && K(this, G, Ae).call(this, "show-annotation", { value: a, index: o, range: l });
    },
    !1
  );
  const s = E(this, Le).get(o);
  if (s) for (const i of s) this.addAnnotation(i);
  return K(this, G, Ae).call(this, "create-overlay", { index: o }), n;
}, Xr = async function* (t, o, n) {
  const s = await this.book.sections[n].createDocument();
  for (const { range: i, excerpt: a } of t(s, o)) yield { cfi: this.getCFI(n, i), excerpt: a };
}, Zr = async function* (t, o) {
  const { sections: n } = this.book;
  for (const [s, { createDocument: i }] of n.entries()) {
    if (!i) continue;
    const a = await i(), l = Array.from(t(a, o), ({ range: d, excerpt: u }) => ({ cfi: this.getCFI(s, d), excerpt: u }));
    yield { progress: (s + 1) / n.length }, l.length && (yield { index: s, subitems: l });
  }
};
customElements.define("foliate-view", qo);
window.makeStreamingBook = Wo;
function Ft(e) {
  return Array.isArray(e) ? e.map((r) => ({
    label: typeof (r == null ? void 0 : r.label) == "string" ? r.label.trim() : "",
    href: (r == null ? void 0 : r.href) ?? null,
    subitems: Ft(r == null ? void 0 : r.subitems)
  })) : [];
}
const ut = "-epub-media-overlay-active", Ot = "rgba(255, 214, 10, 0.4)", Jr = 1e4, Qr = "data-reactor-narration", Ko = "http://www.w3.org/ns/SMIL", nr = 6;
function wt(e) {
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
function St(e, r) {
  if (!e) return null;
  try {
    if (r.includes(":")) return new URL(e, r).href;
    const t = "https://invalid.invalid/", o = new URL(e, t + r);
    return o.search = "", decodeURI(o.href.replace(t, ""));
  } catch {
    return e;
  }
}
async function Et(e, r) {
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
  let s = [...n.getElementsByTagNameNS(Ko, "par")];
  s.length === 0 && (s = [...n.getElementsByTagName("par")]);
  const i = [];
  for (const a of s) {
    const l = [...a.children], c = l.find((m) => m.localName === "text"), d = l.find((m) => m.localName === "audio");
    if (!c || !d) continue;
    const u = St(c.getAttribute("src"), t.href), p = St(d.getAttribute("src"), t.href);
    if (!u || !p) continue;
    const h = wt(d.getAttribute("clipBegin")) ?? 0, f = d.getAttribute("clipEnd"), b = f ? wt(f) ?? null : null;
    i.push({ textHref: u, audioSrc: p, beginSec: h, endSec: b });
  }
  return i;
}
class en {
  constructor() {
    L(this, "sectionSmilCache", /* @__PURE__ */ new WeakMap());
    L(this, "prepareToken", 0);
    L(this, "lastManualNavAt", -1 / 0);
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
    return r - this.lastManualNavAt < Jr;
  }
  /** Builds the whole book's narration timeline by parsing every section's SMIL file, in natural
   * reading order. Results are assembled in section order regardless of fetch completion order. */
  async buildTimeline(r) {
    var u, p, h, f, b, m;
    const { book: t } = r, o = t.sections ?? [], n = [], s = /* @__PURE__ */ new Map(), i = [];
    for (let g = 0; g < o.length; g++)
      (p = (u = o[g]) == null ? void 0 : u.mediaOverlay) != null && p.href && i.push(g);
    const a = /* @__PURE__ */ new Map();
    for (let g = 0; g < i.length; g += nr) {
      const v = i.slice(g, g + nr), A = await Promise.all(v.map((T) => Et(t, o[T])));
      v.forEach((T, N) => a.set(T, A[N] ?? []));
    }
    const l = [];
    for (const g of i)
      for (const v of a.get(g) ?? []) {
        let A = s.get(v.audioSrc);
        A === void 0 && (A = n.length, n.push(v.audioSrc), s.set(v.audioSrc, A)), l.push({ sectionIndex: g, textHref: v.textHref, beginSec: v.beginSec, endSec: v.endSec, audioIndex: A });
      }
    if (l.length === 0 || n.length === 0) return null;
    const c = r.currentSectionHref ? o.findIndex((g) => g.id === r.currentSectionHref) : -1;
    let d = c >= 0 ? Ct(l, c, r.currentRange) : null;
    if (!d && c >= 0)
      for (let g = c; g < o.length && !d; g++)
        d = ((h = l.find((v) => v.sectionIndex === g)) == null ? void 0 : h.textHref) ?? null;
    return d || (d = ((f = l[0]) == null ? void 0 : f.textHref) ?? ""), {
      audioSrcs: n,
      items: l,
      activeClass: ((b = t.media) == null ? void 0 : b.activeClass) || ut,
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
    s || (s = (await Et(r, n)).map((c) => ({ ...c, sectionIndex: t })), this.sectionSmilCache.set(n, s));
    const i = Ct(s, t, o);
    return i ? { fragment: i, sectionIndex: t } : null;
  }
}
function Ct(e, r, t) {
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
function tn(e) {
  return [...new Set([ut, e].filter((t) => !!t))].map((t) => `.${CSS.escape(t)}`).join(", ");
}
function rn(e, r) {
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
      n.setAttribute(Qr, "1"), n.textContent = `.${r} { background-color: ${Ot}; border-radius: 2px; }`, (t = e.head) == null || t.appendChild(n);
    } catch {
    }
}
const At = [
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
], nn = {
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
function je(e, r) {
  return { ...nn, ...e ?? r ?? {} };
}
function on(e) {
  return At.find((r) => r.name === e) ?? At[0];
}
function sn(e, r) {
  const t = on(e.themeName), o = e.isDark || e.themeName === "amoled", n = o ? t.dark : t.light, s = o || t.light.bg !== "#ffffff";
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
           ${tn(r)} { background-color: ${Ot} !important; }` : ""}
    ::selection { background-color: rgba(128, 128, 128, 0.3); }
  `;
}
function an(e) {
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
function ln(e) {
  return `@media screen { html { font-size: ${e.fontSize}px; } }`;
}
function cn(e, r) {
  return sn(e, r) + ln(e) + (e.useBookLayout ? "" : an(e));
}
function Mt(e) {
  var n, s, i;
  const r = e.getBoundingClientRect(), t = (i = (s = (n = e.startContainer) == null ? void 0 : n.ownerDocument) == null ? void 0 : s.defaultView) == null ? void 0 : i.frameElement, o = t ? t.getBoundingClientRect() : { left: 0, top: 0 };
  return { left: r.left + o.left, top: r.top + o.top, right: r.right + o.left, bottom: r.bottom + o.top };
}
function dn(e) {
  var r, t, o, n;
  for (const s of ((r = e == null ? void 0 : e.getContents) == null ? void 0 : r.call(e)) ?? []) (n = (o = (t = s.doc) == null ? void 0 : t.getSelection) == null ? void 0 : o.call(t)) == null || n.removeAllRanges();
}
function un(e, r) {
  let t = !1, o = null;
  const n = () => {
    const a = e.getSelection();
    t = !!a && !a.isCollapsed;
  }, s = (a) => {
    var f, b;
    if (t) {
      t = !1;
      return;
    }
    const l = a.target;
    if ((f = l == null ? void 0 : l.closest) != null && f.call(l, "a[href]")) return;
    const c = e.getSelection();
    if (c && !c.isCollapsed) return;
    const d = (b = e.defaultView) == null ? void 0 : b.frameElement, u = d ? d.getBoundingClientRect() : { left: 0, top: 0 }, p = (u.left + a.clientX) / window.innerWidth, h = (u.top + a.clientY) / window.innerHeight;
    setTimeout(() => {
      r.now() - r.lastAnnotationHitAt() < 50 || r.onTap(p, h);
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
      r.onSelection(c, d, Mt(l));
    }, 300);
  };
  return e.addEventListener("pointerdown", n, !0), e.addEventListener("click", s), e.addEventListener("selectionchange", i), () => {
    e.removeEventListener("pointerdown", n, !0), e.removeEventListener("click", s), e.removeEventListener("selectionchange", i), o && clearTimeout(o);
  };
}
function pn(e, r, t) {
  var o;
  try {
    const n = (o = e.lastLocation) == null ? void 0 : o.cfi;
    if (n) {
      const s = de(r);
      if (rt(s, de(n)) >= 0 && rt(s, de(n, !0)) <= 0) return;
    }
  } catch {
  }
  e.history.clear(), e.history.pushState(r), e.history.pushState(t);
}
const hn = 200;
class fn {
  constructor() {
    L(this, "token", 0);
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
            var u, p, h;
            return {
              cfi: d.cfi,
              pre: ((u = d.excerpt) == null ? void 0 : u.pre) ?? "",
              match: ((p = d.excerpt) == null ? void 0 : p.match) ?? "",
              post: ((h = d.excerpt) == null ? void 0 : h.post) ?? ""
            };
          });
          if (s += c.length, o.onResults(l.label ?? "", c), s >= hn) {
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
function ke(e) {
  return document.createElementNS("http://www.w3.org/2000/svg", e);
}
function $t(e) {
  switch (e) {
    case "underline":
      return (r, { color: t = "red" } = {}) => {
        const o = ke("g");
        o.setAttribute("fill", t);
        for (const { left: n, bottom: s, width: i } of Array.from(r)) {
          const a = ke("rect");
          a.setAttribute("x", String(n)), a.setAttribute("y", String(s - 2)), a.setAttribute("height", "2"), a.setAttribute("width", String(i)), o.append(a);
        }
        return o;
      };
    case "strikethrough":
      return (r, { color: t = "red" } = {}) => {
        const o = ke("g");
        o.setAttribute("fill", t);
        for (const { left: n, top: s, bottom: i, width: a } of Array.from(r)) {
          const l = ke("rect");
          l.setAttribute("x", String(n)), l.setAttribute("y", String((s + i) / 2)), l.setAttribute("height", "2"), l.setAttribute("width", String(a)), o.append(l);
        }
        return o;
      };
    case "invert":
      return (r, { color: t = "#FFFFFF" } = {}) => {
        const o = ke("g");
        o.setAttribute("fill", t), o.style.mixBlendMode = "difference";
        for (const { left: n, top: s, height: i, width: a } of Array.from(r)) {
          const l = ke("rect");
          l.setAttribute("x", String(n)), l.setAttribute("y", String(s)), l.setAttribute("height", String(i)), l.setAttribute("width", String(a)), o.append(l);
        }
        return o;
      };
    case "squiggly":
      return (r, { color: t = "red" } = {}) => {
        const o = ke("g");
        o.setAttribute("fill", "none"), o.setAttribute("stroke", t), o.setAttribute("stroke-width", "2");
        const n = 3;
        for (const { left: s, bottom: i, width: a } of Array.from(r)) {
          const l = ke("path"), c = Math.max(1, Math.round(a / n / 1.5)), d = a / c, u = Array.from({ length: c }, (p, h) => `l${d} ${h % 2 ? n : -n}`).join("");
          l.setAttribute("d", `M${s} ${i}${u}`), o.append(l);
        }
        return o;
      };
    default:
      return (r, { color: t = "yellow" } = {}) => {
        const o = ke("g");
        o.setAttribute("fill", t), o.style.opacity = "0.3", o.style.mixBlendMode = "multiply";
        for (const { left: n, top: s, height: i, width: a } of Array.from(r)) {
          const l = ke("rect");
          l.setAttribute("x", String(n)), l.setAttribute("y", String(s)), l.setAttribute("height", String(i)), l.setAttribute("width", String(a)), o.append(l);
        }
        return o;
      };
  }
}
class gn {
  constructor() {
    L(this, "styles", /* @__PURE__ */ new Map());
  }
  getStyle(r) {
    return this.styles.get(r);
  }
  getDrawFunctionFor(r) {
    const t = this.styles.get(r);
    return t ? $t(t.style) : null;
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
const Oe = "rx-glossary-term", or = "data-reactor-glossary-marked", sr = "data-reactor-glossary-style", Yo = "http://www.idpf.org/2007/ops", ir = 8;
function Tt(e) {
  return (e.textContent ?? "").replace(/\s+/g, " ").trim();
}
function Xo(e) {
  return e.getAttributeNS(Yo, "type") ?? e.getAttribute("epub:type") ?? "";
}
function Zo(e) {
  return /\bglossary\b/i.test(Xo(e));
}
function Jo(e) {
  const r = [];
  let t = null;
  for (const o of Array.from(e.children)) {
    const n = o.tagName.toLowerCase();
    if (n === "dt")
      t = Tt(o);
    else if (n === "dd") {
      if (t) {
        const s = Tt(o);
        s && r.push({ term: t, definition: s });
      }
      t = null;
    }
  }
  return r;
}
function bn(e) {
  const r = [], t = Array.from(e.querySelectorAll("*")).filter(Zo);
  for (const o of t) {
    const n = o.tagName.toLowerCase() === "dl" ? [o] : Array.from(o.querySelectorAll("dl"));
    for (const s of n) r.push(...Jo(s));
  }
  for (const o of Array.from(e.querySelectorAll("dfn"))) {
    const n = Tt(o), s = (o.getAttribute("title") ?? "").trim();
    n && s && r.push({ term: n, definition: s });
  }
  return r;
}
function Qo(e) {
  const r = /* @__PURE__ */ new Map();
  for (const t of e) {
    const o = t.term.toLowerCase();
    r.has(o) || r.set(o, t);
  }
  return Array.from(r.values()).sort((t, o) => t.term.localeCompare(o.term));
}
async function mn(e) {
  const r = e.sections ?? [], t = [];
  for (let o = 0; o < r.length; o += ir) {
    const n = r.slice(o, o + ir), s = await Promise.all(
      n.map(async (i) => {
        if (typeof i.createDocument != "function") return [];
        try {
          const a = await i.createDocument();
          return bn(a);
        } catch {
          return [];
        }
      })
    );
    for (const i of s) t.push(...i);
  }
  return Qo(t);
}
function ar(e) {
  return e.getBoundingClientRect();
}
function es(e) {
  var s, i;
  const r = ar(e);
  let t = r.left, o = r.top, n = ((s = e.ownerDocument) == null ? void 0 : s.defaultView) ?? null;
  for (; n != null && n.frameElement; ) {
    const a = ar(n.frameElement);
    t += a.left, o += a.top, n = ((i = n.frameElement.ownerDocument) == null ? void 0 : i.defaultView) ?? null;
  }
  return { left: t, top: o, bottom: o + r.height, width: r.width, height: r.height };
}
function ot(e, r, t) {
  var d;
  if (!r.length || !e.body || e.body.hasAttribute(or)) return;
  e.body.setAttribute(or, "1"), xn(e);
  const o = [...new Set(r.map((u) => u.term))].sort((u, p) => p.length - u.length);
  if (!o.length) return;
  const n = o.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), s = new RegExp(`\\b(${n.join("|")})\\b`, "i"), i = e.createTreeWalker(
    e.body,
    4
    /* NodeFilter.SHOW_TEXT */
  ), a = [];
  let l;
  for (; l = i.nextNode(); ) a.push(l);
  for (const u of a) {
    const p = u.parentElement;
    if (!p || p.closest(`.${Oe}, a, dfn`)) continue;
    const h = u.textContent ?? "", f = s.exec(h);
    if (!(f != null && f[1])) continue;
    const b = f[1], m = h.slice(0, f.index), g = h.slice(f.index + b.length), v = e.createElement("span");
    v.className = Oe, v.setAttribute("tabindex", "0"), v.setAttribute("role", "button"), v.setAttribute("data-gloss-term", b), v.textContent = b;
    const A = e.createDocumentFragment();
    m && A.appendChild(e.createTextNode(m)), A.appendChild(v), g && A.appendChild(e.createTextNode(g)), (d = u.parentNode) == null || d.replaceChild(A, u);
  }
  function c(u) {
    const p = u.getAttribute("data-gloss-term");
    p && t(p, es(u));
  }
  e.addEventListener("click", (u) => {
    var h, f;
    const p = (f = (h = u.target) == null ? void 0 : h.closest) == null ? void 0 : f.call(h, `.${Oe}`);
    p && c(p);
  }), e.addEventListener("keydown", (u) => {
    var f;
    const p = u, h = p.target;
    (f = h == null ? void 0 : h.classList) != null && f.contains(Oe) && (p.key === "Enter" || p.key === " ") && (p.preventDefault(), c(h));
  });
}
function xn(e) {
  var t;
  if (e.querySelector(`[${sr}]`)) return;
  const r = e.createElement("style");
  r.setAttribute(sr, "1"), r.textContent = `.${Oe} { text-decoration: underline; text-decoration-style: dotted; text-decoration-color: currentColor; text-decoration-thickness: 1px; cursor: pointer; }`, (t = e.head) == null || t.appendChild(r);
}
function yn(e, r, t = {}) {
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
    var p;
    setTimeout(() => {
      var h;
      (h = o.renderer) != null && h.setAttribute && (o.renderer.setAttribute("flow", "scrolled"), o.renderer.setAttribute("margin-top", "16px"), o.renderer.setAttribute("margin-bottom", "16px"), o.renderer.setAttribute("margin-left", "16px"), o.renderer.setAttribute("margin-right", "16px"), o.renderer.setAttribute("max-inline-size", "9999px"), o.renderer.setAttribute("max-column-count", "1"));
    }, 0);
    const d = c.detail, u = ((p = t.getGlossaryTerms) == null ? void 0 : p.call(t)) ?? [];
    d != null && d.doc && u.length && t.onGlossaryTermTap && ot(d.doc, u, t.onGlossaryTermTap);
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
const vn = {
  epub: "application/epub+zip",
  mobi: "application/x-mobipocket-ebook",
  azw3: "application/vnd.amazon.ebook",
  azw: "application/vnd.amazon.ebook",
  fb2: "application/x-fictionbook+xml",
  cbz: "application/vnd.comicbook+zip",
  cbr: "application/vnd.comicbook-rar"
};
class kn {
  constructor(r) {
    L(this, "container");
    L(this, "listeners", /* @__PURE__ */ new Set());
    L(this, "currentSettings", null);
    L(this, "view", null);
    L(this, "pending", null);
    L(this, "narrationActiveClass", null);
    L(this, "narrationPlaybackActiveClass", null);
    L(this, "narration", new en());
    L(this, "restoringPosition", !1);
    L(this, "relocateChain", Promise.resolve());
    L(this, "annotations", new gn());
    L(this, "lastAnnotationHitAt", 0);
    L(this, "search", new fn());
    L(this, "glossaryTerms", []);
    L(this, "glossaryPromise", null);
    /** Memoizes CFI -> chapter label lookups for the Notes tab (U5 Defect B fix); cleared on
     * every new book so a stale title from a previous book never leaks through. */
    L(this, "chapterTitleCache", /* @__PURE__ */ new Map());
    L(this, "glossaryTapListeners", /* @__PURE__ */ new Set());
    /** R-G7: extra CSS a host injects alongside `generateCSS`'s output (e.g. a web client's
     * user-uploaded custom @font-face rules). Additive only: null/empty changes nothing, and
     * every existing host that never calls `setExtraCss` sees exactly the CSS it always did. */
    L(this, "extraCss", null);
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
    this.pending = { meta: r, parts: [] }, r.settings && (this.currentSettings = je(r.settings, null));
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
      const o = (r.format ?? "epub").toLowerCase(), n = new Blob(t, { type: vn[o] ?? "application/octet-stream" }), s = new File([n], `book.${o}`, { type: n.type });
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
    r.settings && (this.currentSettings = je(r.settings, null));
    try {
      this.createView();
      const { makeLocalZipLoader: n } = await import("./local-zip-loader-DkW60oo9.js"), { EPUB: s } = await import("./epub-DbQ1x9X0.js"), i = await n(t, o), a = await new s(i).init();
      await this.view.open(a), await this.finishOpen(r);
    } catch (n) {
      this.emitError((n == null ? void 0 : n.message) ?? "Failed to open local book");
    }
  }
  /** Lazy remote-EPUB open (BO-41): same memory shape as `openLocal`, but for a plain EPUB URL
   * with no server-side entries manifest - reads the zip's own central directory and entries
   * via HTTP Range requests (see src/vendor/foliate/remote-zip-loader.js), falling back to one
   * whole-file fetch only when the server does not honour Range with 206.
   *
   * `fetcher` (mirrors R-G5) is an optional caller-supplied replacement for the global `fetch`,
   * so a host behind auth can add headers (e.g. `Authorization`) on every Range request.
   * `size`, if the caller already knows the file's byte length, skips the one-time size probe. */
  async openRemote(r, t, o, n) {
    r.settings && (this.currentSettings = je(r.settings, null));
    try {
      this.createView();
      const { makeRemoteZipLoader: s } = await import("./remote-zip-loader-Bhp_1Nfg.js"), { EPUB: i } = await import("./epub-DbQ1x9X0.js"), a = await s(t, o, n), l = await new i(a).init();
      await this.view.open(l), await this.finishOpen(r);
    } catch (s) {
      this.emitError((s == null ? void 0 : s.message) ?? "Failed to open remote book");
    }
  }
  // Shared tail of opening a book, whichever open path produced it: apply styles, report the
  // TOC/metadata, then navigate to the requested position (CFI, else fraction, else start).
  async finishOpen(r) {
    var s, i, a, l, c, d, u, p, h, f, b, m;
    const t = this.view, o = !!((i = (s = t.book) == null ? void 0 : s.sections) != null && i.some((g) => g.mediaOverlay));
    this.narrationActiveClass = o ? ((l = (a = t.book) == null ? void 0 : a.media) == null ? void 0 : l.activeClass) || ut : null, this.narrationPlaybackActiveClass = o && ((d = (c = t.book) == null ? void 0 : c.media) == null ? void 0 : d.playbackActiveClass) || null, this.annotations.reset(), this.glossaryTerms = [], this.glossaryPromise = null, this.chapterTitleCache.clear(), this.applyStyles(r.settings ?? this.currentSettings), this.emit({
      type: "loaded",
      toc: Ft((u = t.book) == null ? void 0 : u.toc),
      hasMediaOverlay: o,
      isRtl: ((p = t.book) == null ? void 0 : p.dir) === "rtl",
      metadata: {
        title: ((f = (h = t.book) == null ? void 0 : h.metadata) == null ? void 0 : f.title) ?? null,
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
    n && r.cfi && r.previousCfi && pn(t, r.previousCfi, r.cfi), setTimeout(() => {
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
      n && typeof s == "number" && this.attachHandlersForDoc(n, s), n && rn(n, this.narrationActiveClass), n && this.glossaryTerms.length && ot(n, this.glossaryTerms, (i, a) => this.emitGlossaryTermTap(i, a));
    }), r.addEventListener("draw-annotation", (t) => {
      var i;
      const o = t.detail, n = (i = o == null ? void 0 : o.annotation) == null ? void 0 : i.value, s = n ? this.annotations.getStyle(n) : void 0;
      !(o != null && o.draw) || !s || o.draw($t(s.style), { color: s.color });
    }), r.addEventListener("create-overlay", () => {
      setTimeout(() => {
        for (const t of this.annotations.keys()) this.drawAnnotation(t);
      }, 100);
    }), r.addEventListener("show-annotation", (t) => {
      this.lastAnnotationHitAt = performance.now();
      const o = t.detail;
      this.emit({ type: "annotationTap", cfi: (o == null ? void 0 : o.value) ?? null, rect: o != null && o.range ? Mt(o.range) : null });
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
    un(r, {
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
    this.currentSettings = je(r, this.currentSettings);
    const t = this.currentSettings, o = this.view.renderer;
    o && (o.setAttribute("max-column-count", String(t.maxColumnCount)), o.setAttribute("gap", `${t.gap * 100}%`), o.setAttribute("max-inline-size", `${t.maxInlineSize}px`), o.setAttribute("max-block-size", `${t.maxBlockSize}px`), o.setAttribute("margin-top", `${t.marginTop}px`), o.setAttribute("margin-bottom", `${t.marginBottom}px`), o.setAttribute("margin-left", `${t.marginLeft}px`), o.setAttribute("margin-right", `${t.marginRight}px`), o.setAttribute("flow", t.flow), typeof o.setStyles == "function" && o.setStyles(cn(t, this.narrationActiveClass) + (this.extraCss ?? "")));
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
    dn((r = this.view) == null ? void 0 : r.renderer);
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
    return t ? yn(r, t, {
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
    return r ? (this.glossaryPromise || (this.glossaryPromise = mn(r).then((o) => (this.glossaryTerms = o, this.remarkLoadedDocs(), o))), this.glossaryPromise) : Promise.resolve([]);
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
      s.doc && ot(s.doc, this.glossaryTerms, (i, a) => this.emitGlossaryTermTap(i, a));
  }
}
const _i = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ContentCore: kn,
  DEFAULT_ACTIVE_CLASS: ut,
  DEFAULT_SETTINGS: nn,
  GLOSSARY_INLINE_CLASS: Oe,
  MIME: vn,
  NARRATION_FOLLOW_PAUSE_MS: Jr,
  NARRATION_HIGHLIGHT: Ot,
  NARRATION_STYLE_ATTR: Qr,
  NarrationController: en,
  SEARCH_MAX_RESULTS: hn,
  SearchController: fn,
  THEMES: At,
  attachDocHandlers: un,
  clearSelection: dn,
  createSecondaryView: yn,
  extractGlossaryFromBook: mn,
  extractGlossaryFromDocument: bn,
  firstVisibleTextHref: Ct,
  fontSizeCSS: ln,
  generateCSS: cn,
  injectDefaultNarrationStyle: rn,
  injectGlossaryInlineStyle: xn,
  markGlossaryTermsInDoc: ot,
  mergeSettings: je,
  narrationHighlightSelector: tn,
  offerUndoTo: pn,
  overrideCSS: an,
  parseSectionSmil: Et,
  parseSmilClock: wt,
  resolveSmilRef: St,
  serializeToc: Ft,
  themeCSS: sn,
  themeFor: on,
  viewportRect: Mt
}, Symbol.toStringTag, { value: "Module" })), Hi = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AnnotationManager: gn,
  getDrawFunction: $t
}, Symbol.toStringTag, { value: "Module" })), ts = {
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  bookmark: '<path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  panel_right: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  forward: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  // Playback transport (U9 follow-up fix: these replaced emoji glyphs - U+23EA/U+23E9/U+23F8 -
  // which several platforms render as colour emoji, "blue square" fallback boxes rather than a
  // themed, currentColor icon). Same Lucide-style stroke paths as the set above.
  skip_back: '<polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/>',
  skip_forward: '<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
};
function We(e) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ts[e]}</svg>`;
}
function Ie(e, r, t = !1) {
  const o = document.createElement("button");
  return o.type = "button", o.className = "rx-icon-btn", o.setAttribute("aria-label", e), o.innerHTML = We(r), t && o.setAttribute("aria-pressed", "false"), o;
}
function rs(e) {
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
  const i = Ie("Table of contents", "menu", !0), a = Ie("Bookmark", "bookmark", !0), l = Ie("Text settings", "settings", !0), c = Ie("Open context panel", "panel_right", !0), d = document.createElement("div");
  d.className = "rx-bar-spacer", s.append(i, a, d, l, c);
  const u = document.createElement("div");
  u.className = "rx-bar rx-bar-bottom";
  const p = document.createElement("div");
  p.className = "rx-status-row", p.setAttribute("aria-live", "polite");
  const h = Ie("Back", "back");
  h.disabled = !0;
  const f = document.createElement("span");
  f.className = "rx-chapter-label";
  const b = Ie("Forward", "forward");
  b.disabled = !0, p.append(h, f, b);
  const m = document.createElement("input");
  return m.type = "range", m.className = "rx-scrubber", m.min = "0", m.max = "1000", m.step = "1", m.value = "0", m.setAttribute("aria-label", "Reading position"), u.append(p, m), e.append(r, s, u), {
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
    historyBackBtn: h,
    historyForwardBtn: b,
    chapterLabel: f,
    scrubber: m
  };
}
const ns = `
.reader-shell {
  --rx-ground: #fbfbfa;
  --rx-ink: #17181a;
  --rx-accent: #356aef;
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
  /* A dark background needs a lighter accent than the light theme's #356aef to read as text
   * at 4.5:1 (axe color-contrast on the Settings toggle pills, U9 fix); accent-ink flips to
   * black to match, since that same lighter blue fails as a background under white text. */
  --rx-accent: #7aa2ff;
  --rx-accent-ink: #000000;
}
/* AMOLED chrome (U6 Theme tab swatch, U9 contrast pass): true black ground/surface so an
 * AMOLED panel can switch pixels off, with the same 4.5:1-minimum muted tone as theme-dark
 * rather than theme-dark's own muted (9aa3bd is still >=4.5:1 on pure black, kept identical). */
.reader-shell.theme-amoled {
  --rx-ground: #000000;
  --rx-ink: #ffffff;
  --rx-surface: #000000;
  --rx-surface-2: #0a0a0a;
  --rx-border: #2a2a2a;
  --rx-muted: #a6a6a6;
  --rx-accent: #7aa2ff;
  --rx-accent-ink: #000000;
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
`, os = 599, ss = 1200;
function Qe(e) {
  return e <= os ? "phone" : e <= ss ? "fold-tablet" : "desktop";
}
const Lt = 0.3;
function wn(e, r) {
  const t = Math.min(1, Math.max(0, e));
  return t < Lt ? r ? "next" : "prev" : t > 1 - Lt ? r ? "prev" : "next" : "toggle";
}
const is = /* @__PURE__ */ new Set(["ArrowRight", "ArrowDown", "PageDown", " "]), as = /* @__PURE__ */ new Set(["ArrowLeft", "ArrowUp", "PageUp"]);
function Sn(e) {
  return e.ctrlKey || e.metaKey || e.altKey ? null : is.has(e.key) ? "next" : as.has(e.key) ? "prev" : e.key === "m" || e.key === "M" ? "toggleBars" : e.key === "Escape" ? "escape" : null;
}
function En(e) {
  return e === "next" || e === "prev";
}
const ls = '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>', cs = '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>';
function lr(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = "rx-icon-btn", t.setAttribute("aria-label", e), t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${r}</svg>`, t;
}
function ds(e) {
  const r = document.createElement("div");
  r.className = "rx-left-sidebar", r.setAttribute("aria-label", "Table of contents"), r.tabIndex = -1;
  const t = document.createElement("div");
  t.className = "rx-left-sidebar-scrim";
  const o = document.createElement("div");
  o.className = "rx-sidebar-head";
  const n = lr("Back", ls), s = document.createElement("h3");
  s.className = "rx-sidebar-title", s.textContent = "Contents";
  const i = lr("Close contents", cs);
  i.classList.add("rx-left-sidebar-close"), o.append(n, s, i);
  const a = document.createElement("div");
  a.className = "rx-left-sidebar-tabs", a.setAttribute("role", "tablist");
  function l(T, N) {
    const C = document.createElement("button");
    return C.type = "button", C.className = "rx-left-sidebar-tab", C.setAttribute("role", "tab"), C.setAttribute("aria-selected", "false"), C.setAttribute("data-tab", N), C.id = `rx-tab-${N}`, C.textContent = T, C;
  }
  const c = l("Contents", "contents"), d = l("Starred", "starred"), u = l("Related", "related");
  a.append(c, d, u);
  const p = document.createElement("div");
  p.className = "rx-left-sidebar-body";
  function h(T) {
    const N = document.createElement("div");
    return N.className = "rx-sidebar-panel", N.setAttribute("role", "tabpanel"), N.setAttribute("data-panel", T), N.setAttribute("aria-labelledby", `rx-tab-${T}`), N.hidden = !0, N;
  }
  const f = h("contents"), b = document.createElement("div");
  b.className = "rx-toc-scroll";
  const m = document.createElement("div");
  m.className = "rx-toc-spacer";
  const g = document.createElement("div");
  g.className = "rx-toc-window", g.setAttribute("role", "list"), m.appendChild(g), b.appendChild(m), f.appendChild(b);
  const v = h("starred"), A = h("related");
  return p.append(f, v, A), r.append(o, a, p), e.append(t, r), {
    root: r,
    scrim: t,
    backBtn: n,
    closeBtn: i,
    title: s,
    tablist: a,
    tabContents: c,
    tabStarred: d,
    tabRelated: u,
    body: p,
    panelContents: f,
    tocScroll: b,
    tocSpacer: m,
    tocWindow: g,
    panelStarred: v,
    panelRelated: A
  };
}
const us = `
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
function Cn(e, r = null, t = 0) {
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
    }), s.subitems.length > 0 && o.push(...Cn(s.subitems, i, t + 1));
  }
  return o;
}
function ps(e, r) {
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
function hs(e, r) {
  if (!r) return null;
  const t = cr(r);
  let o = null;
  for (const n of e)
    if (n.href) {
      if (n.href === r) return n.id;
      o === null && cr(n.href) === t && (o = n);
    }
  return (o == null ? void 0 : o.id) ?? null;
}
function fs(e, r) {
  if (!r) return null;
  for (const t of e)
    if (t.label === r) return t.id;
  return null;
}
function cr(e) {
  const r = e.indexOf("#");
  return r === -1 ? e : e.slice(0, r);
}
function gs(e, r, t, o, n = 8) {
  if (o === 0 || r <= 0) return { start: 0, end: -1 };
  const s = Math.floor(e / r), i = Math.ceil(t / r), a = Math.max(0, s - n), l = Math.min(o - 1, s + i + n);
  return { start: a, end: l };
}
const ft = 48;
function bs(e, r, t, o) {
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
function ms(e, r, t, o, n) {
  const s = ps(o.flat, o.collapsed), i = hs(s, o.currentHref) ?? fs(s, o.currentChapterTitle);
  r.style.height = `${s.length * ft}px`;
  const a = e.clientHeight || 1, { start: l, end: c } = gs(e.scrollTop, ft, a, s.length);
  t.replaceChildren(), t.style.transform = `translateY(${l * ft}px)`;
  for (let d = l; d <= c; d++) {
    const u = s[d];
    u && t.appendChild(bs(u, o, n, u.id === i));
  }
}
function xs(e, r, t) {
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
function ys(e, r, t) {
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
function vs(e, r) {
  return An(e, r, 1);
}
function ks(e, r) {
  return An(e, r, -1);
}
function An(e, r, t) {
  if (e.length === 0) return r;
  const o = e.indexOf(r);
  if (o === -1) return e[0];
  const n = (o + t + e.length) % e.length;
  return e[n];
}
const ws = 40;
function Ss(e, r) {
  return Math.abs(e) >= ws && Math.abs(e) > Math.abs(r);
}
function Es(e, r, t, o) {
  return Ss(r, t) ? e === "sidebar" ? { action: r < 0 ? "cycle-next" : "cycle-prev" } : e === "book" && o ? { action: "close" } : { action: null } : { action: null };
}
function Cs(e, r, t) {
  return e && r.contains(e) ? "sidebar" : e && t.contains(e) && !r.contains(e) ? "book" : "other";
}
function As(e) {
  return Array.from(e.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((t) => t.offsetParent !== null || t === e);
}
function Ts(e) {
  let r = !1;
  function t(o) {
    if (!r || o.key !== "Tab") return;
    const n = As(e);
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
const dr = "reactor-left-sidebar-stylesheet";
function Ls(e) {
  if (e.getElementById(dr)) return;
  const r = e.createElement("style");
  r.id = dr, r.textContent = us, e.head.appendChild(r);
}
function Ns(e, r, t = {}) {
  var J, Q;
  const o = e.ownerDocument ?? document;
  Ls(o);
  const n = ds(e);
  n.root.classList.add("closed");
  const s = ["contents", "starred"];
  (J = t.capabilities) != null && J.related && s.push("related"), n.tabRelated.hidden = !((Q = t.capabilities) != null && Q.related);
  let i = "contents", a = !1, l = !1, c = [];
  const d = /* @__PURE__ */ new Set();
  let u = null, p = null;
  const h = /* @__PURE__ */ new Set();
  let f = [], b = [];
  const m = Ts(n.root);
  let g = null;
  function v() {
    return !e.classList.contains("size-desktop");
  }
  function A(w) {
    return w === "contents" ? n.panelContents : w === "starred" ? n.panelStarred : n.panelRelated;
  }
  function T(w) {
    return w === "contents" ? n.tabContents : w === "starred" ? n.tabStarred : n.tabRelated;
  }
  function N() {
    i === "contents" ? ms(
      n.tocScroll,
      n.tocSpacer,
      n.tocWindow,
      { flat: c, collapsed: d, currentHref: u, currentChapterTitle: p, starred: h },
      {
        onActivate: (w) => {
          w.href && r(w.href), v() && F();
        },
        onToggleExpand: (w) => {
          d.has(w.id) ? d.delete(w.id) : d.add(w.id), N();
        },
        onToggleStar: (w) => {
          var ne;
          if (!w.href) return;
          const W = !h.has(w.href);
          W ? h.add(w.href) : h.delete(w.href), (ne = t.onStarToggle) == null || ne.call(t, w.href, w.label, W), N();
        }
      }
    ) : i === "starred" ? xs(n.panelStarred, f, (w) => {
      r(w.href), v() && F();
    }) : ys(n.panelRelated, b, (w) => {
      var W;
      (W = t.onOpenRelated) == null || W.call(t, w.id), v() && F();
    });
  }
  function C(w) {
    w !== i && (T(i).setAttribute("aria-selected", "false"), A(i).hidden = !0, i = w, T(i).setAttribute("aria-selected", "true"), A(i).hidden = !1, N());
  }
  function P(w) {
    const W = w === 1 ? vs(s, i) : ks(s, i);
    C(W);
  }
  n.tabContents.addEventListener("click", () => C("contents")), n.tabStarred.addEventListener("click", () => C("starred")), n.tabRelated.addEventListener("click", () => C("related")), C("contents"), T("contents").setAttribute("aria-selected", "true"), A("contents").hidden = !1;
  function D() {
    var W;
    if (a) return;
    a = !0, g = o.activeElement ?? null, n.root.classList.add("open"), n.root.classList.remove("closed"), e.classList.add("rx-left-sidebar-open"), n.scrim.classList.toggle("visible", v());
    const w = v();
    n.root.setAttribute("role", w ? "dialog" : "complementary"), w ? n.root.setAttribute("aria-modal", "true") : n.root.removeAttribute("aria-modal"), w && (m.activate(), n.root.focus()), (W = t.onSidebarChange) == null || W.call(t, !0);
  }
  function F() {
    var w, W;
    a && (a = !1, n.root.classList.remove("open"), n.root.classList.add("closed"), e.classList.remove("rx-left-sidebar-open"), n.scrim.classList.remove("visible"), m.deactivate(), (w = g == null ? void 0 : g.focus) == null || w.call(g), g = null, (W = t.onSidebarChange) == null || W.call(t, !1));
  }
  n.closeBtn.addEventListener("click", F), n.scrim.addEventListener("click", F), n.backBtn.addEventListener("click", () => {
    var w;
    return (w = t.onBack) == null ? void 0 : w.call(t);
  });
  let U = 0, O = 0, V = "other", R = !1;
  function H(w) {
    w.pointerType !== "pen" && (U = w.clientX, O = w.clientY, V = Cs(w.target, n.root, e), R = V !== "other");
  }
  function z(w) {
    if (!R) return;
    R = !1;
    const W = w.clientX - U, ne = w.clientY - O, ce = Es(V, W, ne, v());
    !a && ce.action !== null || (ce.action === "cycle-next" ? P(1) : ce.action === "cycle-prev" ? P(-1) : ce.action === "close" && F());
  }
  e.addEventListener("pointerdown", H), e.addEventListener("pointerup", z);
  function x(w) {
    c = Cn(w), d.clear(), i === "contents" && N();
  }
  function I(w) {
    f = w, h.clear();
    for (const W of w) h.add(W.href);
    (i === "starred" || i === "contents") && N();
  }
  function _(w) {
    b = w, i === "related" && N();
  }
  function te(w) {
    u = w, i === "contents" && N();
  }
  function re(w) {
    p = w, i === "contents" && N();
  }
  function Y() {
    l || (l = !0, e.removeEventListener("pointerdown", H), e.removeEventListener("pointerup", z), n.closeBtn.removeEventListener("click", F), n.scrim.removeEventListener("click", F), m.deactivate(), e.classList.remove("rx-left-sidebar-open"), n.root.remove(), n.scrim.remove());
  }
  return {
    open: D,
    close: F,
    isOpen: () => a,
    cycleTab: P,
    getActiveTab: () => i,
    setToc: x,
    setStarred: I,
    setRelated: _,
    setCurrentHref: te,
    setCurrentChapterTitle: re,
    destroy: Y
  };
}
function gt(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = "rx-sidebar-tab", t.textContent = e, t.setAttribute("role", "tab"), t.setAttribute("aria-selected", String(r)), r && t.classList.add("active"), t;
}
function Bs(e) {
  const r = e.createElement("div");
  r.className = "rx-right-sidebar", r.setAttribute("role", "complementary"), r.setAttribute("aria-label", "Context panel");
  const t = e.createElement("div");
  t.className = "rx-sidebar-resize", t.setAttribute("role", "separator"), t.setAttribute("aria-orientation", "vertical"), t.setAttribute("aria-label", "Resize context panel"), t.setAttribute("tabindex", "0");
  const o = e.createElement("div");
  o.className = "rx-sidebar-tabs";
  const n = e.createElement("div");
  n.className = "rx-sidebar-tablist", n.setAttribute("role", "tablist");
  const s = gt("Context", !0), i = gt("Glossary", !1), a = gt("Notes", !1);
  a.disabled = !0;
  const l = e.createElement("button");
  l.type = "button", l.className = "rx-icon-btn rx-sidebar-close", l.setAttribute("aria-label", "Close panel"), l.textContent = "✕", n.append(s, i, a), o.append(n, l);
  const c = e.createElement("div");
  c.className = "rx-ctx-searchbar", c.setAttribute("role", "search");
  const d = e.createElement("input");
  d.type = "search", d.className = "rx-ctx-search-input", d.placeholder = "Search this book", d.setAttribute("aria-label", "Search this book");
  const u = e.createElement("button");
  u.type = "button", u.className = "rx-icon-btn rx-ctx-openmain", u.setAttribute("aria-label", "Open in main window"), u.disabled = !0, u.textContent = "↗";
  const p = e.createElement("div");
  p.className = "rx-ctx-crumbs", p.setAttribute("aria-live", "polite"), c.append(d, u, p);
  const h = e.createElement("div");
  h.className = "rx-sidebar-body";
  const f = e.createElement("div");
  f.className = "rx-ctx-results";
  const b = e.createElement("div");
  b.className = "rx-ctx-page", b.hidden = !0;
  const m = e.createElement("div");
  m.className = "rx-notes-body", m.hidden = !0;
  const g = e.createElement("div");
  return g.className = "rx-glossary-panel-mount", g.hidden = !0, h.append(f, b, m, g), r.append(t, o, c, h), {
    root: r,
    resizeHandle: t,
    tabsRow: o,
    contextTabBtn: s,
    glossaryTabBtn: i,
    notesTabBtn: a,
    closeBtn: l,
    searchBar: c,
    searchInput: d,
    openInMainBtn: u,
    breadcrumb: p,
    body: h,
    resultsScroller: f,
    contextPage: b,
    notesBody: m,
    glossaryPanelMount: g
  };
}
const zs = `
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
.rx-sidebar-tablist {
  display: flex;
  align-items: stretch;
  flex: 1 1 auto;
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
class Is {
  constructor() {
    L(this, "rows", []);
    L(this, "headerAt", /* @__PURE__ */ new Map());
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
class Tn {
  constructor(r) {
    L(this, "container");
    L(this, "rowHeight");
    L(this, "buffer");
    L(this, "opts");
    L(this, "topSpacer");
    L(this, "bottomSpacer");
    L(this, "rowsEl");
    L(this, "onScroll");
    L(this, "destroyed", !1);
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
function Ps(e, r) {
  return e.kind !== r.kind ? !1 : e.kind === "page" && r.kind === "page" ? e.target === r.target : !0;
}
class Fs {
  constructor() {
    L(this, "stack", [{ kind: "blank" }]);
    L(this, "index", 0);
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
    Ps(this.current, r) || (this.stack = this.stack.slice(0, this.index + 1), this.stack.push(r), this.index = this.stack.length - 1);
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
const Os = {
  "fold-tablet": 320,
  desktop: 340
}, et = 240, ur = 16, Ms = {
  "fold-tablet": 0.6,
  desktop: 0.7
};
function $s(e, r, t) {
  const o = Ms[t], n = Math.max(et, r * o);
  return e < et ? et : e > n ? n : e;
}
const Ln = /* @__PURE__ */ new WeakMap();
function bt(e) {
  return Ln.get(e) ?? { left: 0, right: 0, bottom: 0 };
}
function Ne(e, r) {
  const t = {
    left: Math.max(0, r.left ?? bt(e).left),
    right: Math.max(0, r.right ?? bt(e).right),
    bottom: Math.max(0, r.bottom ?? bt(e).bottom)
  };
  return Ln.set(e, t), e.style.setProperty("--rx-book-inset-left", `${t.left}px`), e.style.setProperty("--rx-book-inset-right", `${t.right}px`), e.style.setProperty("--rx-book-inset-bottom", `${t.bottom}px`), e.style.paddingLeft = t.left ? `${t.left}px` : "", e.style.paddingRight = t.right ? `${t.right}px` : "", e.style.paddingBottom = t.bottom ? `${t.bottom}px` : "", t;
}
const Rs = [
  { id: "all", label: "All" },
  { id: "highlight", label: "Highlight" },
  { id: "underline", label: "Underline" },
  { id: "note", label: "Typed note" },
  { id: "handwritten", label: "Handwritten" },
  { id: "bookmark", label: "Bookmark" }
], _s = [
  { id: "position", label: "Position in book" },
  { id: "date", label: "Date" },
  { id: "colour", label: "Colour" },
  { id: "type", label: "Type" }
];
function Hs(e) {
  const r = e.createElement("div");
  r.className = "rx-notes-panel";
  const t = e.createElement("div");
  t.className = "rx-notes-searchbar", t.setAttribute("role", "search");
  const o = e.createElement("input");
  o.type = "search", o.className = "rx-notes-search-input", o.placeholder = "Search notes", o.setAttribute("aria-label", "Search notes"), t.append(o);
  const n = e.createElement("select");
  n.className = "rx-notes-sort", n.setAttribute("aria-label", "Sort notes by");
  for (const { id: c, label: d } of _s) {
    const u = e.createElement("option");
    u.value = c, u.textContent = d, n.append(u);
  }
  t.append(n);
  const s = e.createElement("div");
  s.className = "rx-notes-filters", s.setAttribute("role", "group"), s.setAttribute("aria-label", "Filter notes by type");
  const i = {};
  for (const { id: c, label: d } of Rs) {
    const u = e.createElement("button");
    u.type = "button", u.className = "rx-notes-chip", u.textContent = d, u.setAttribute("aria-pressed", String(c === "all")), c === "all" && u.classList.add("active"), u.dataset.filter = c, s.append(u), i[c] = u;
  }
  const a = e.createElement("div");
  a.className = "rx-notes-banner", a.hidden = !0, a.textContent = "No annotation store connected. Notes made in this session are not saved.";
  const l = e.createElement("div");
  return l.className = "rx-notes-list", r.append(t, s, a, l), { root: r, searchBar: t, searchInput: o, filterRow: s, filterButtons: i, sortSelect: n, capabilityBanner: a, listScroller: l };
}
const Ds = `
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
`, Gs = 100, js = 20;
function Ws(e) {
  return e === "all" ? null : e;
}
class Us {
  constructor(r) {
    L(this, "total", 0);
    L(this, "offset", 0);
    L(this, "items", []);
    L(this, "state", { filter: "all", sort: "position", query: null });
    L(this, "lastRequestedOffset", null);
    L(this, "everRequested", !1);
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
    const n = Math.max(0, r - js);
    this.lastRequestedOffset !== n && this.requestPage(n);
  }
  requestPage(r) {
    this.everRequested = !0, this.lastRequestedOffset = r, this.hostChannel.emitIntent({
      type: "notesPageRequest",
      offset: r,
      limit: Gs,
      filter: Ws(this.state.filter),
      sort: this.state.sort,
      query: this.state.query
    });
  }
  applyWindow(r) {
    this.total = r.total, this.offset = r.offset, this.items = r.items, this.lastRequestedOffset = null;
  }
}
const pr = "reactor-notes-stylesheet", Vs = 48, qs = 200, hr = {
  highlight: "Highlight",
  underline: "Underline",
  note: "Typed note",
  bookmark: "Bookmark"
};
function Ks(e, r) {
  return r ? `${hr[e]} · ${r}` : hr[e];
}
function Ys({ container: e, core: r, hostChannel: t, options: o = {} }) {
  const n = e.ownerDocument ?? document;
  if (!n.getElementById(pr)) {
    const C = n.createElement("style");
    C.id = pr, C.textContent = Ds, n.head.appendChild(C);
  }
  const s = Hs(n);
  e.append(s.root);
  const i = new Us(t);
  let a = !1, l = null;
  const c = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Set();
  function u(C) {
    c.has(C) || d.has(C) || typeof r.getChapterTitleForCfi == "function" && (d.add(C), r.getChapterTitleForCfi(C).then((P) => {
      c.set(C, P);
    }).catch(() => {
      c.set(C, null);
    }).finally(() => {
      d.delete(C), !a && h.render();
    }));
  }
  function p(C) {
    i.ensureLoaded(C, C + 1);
    const P = i.rowAt(C);
    if (!P) {
      const z = n.createElement("div");
      return z.className = "rx-notes-loading-row", z.setAttribute("role", "listitem"), z.textContent = "Loading…", z;
    }
    const D = n.createElement("button");
    D.type = "button", D.className = "rx-notes-row";
    const F = n.createElement("span");
    F.className = "rx-notes-row-swatch", P.color && F.style.setProperty("--rx-notes-row-color", P.color);
    const U = n.createElement("span");
    U.className = "rx-notes-row-body";
    const O = n.createElement("span");
    O.className = "rx-notes-row-snippet", O.textContent = P.note ?? P.text ?? "";
    const V = n.createElement("span");
    V.className = "rx-notes-row-meta";
    const R = c.get(P.cfi);
    V.textContent = Ks(P.kind, R ?? null), U.append(O, V), D.append(F, U), D.setAttribute("aria-label", `${V.textContent}: ${O.textContent}`), R === void 0 && u(P.cfi), D.addEventListener("click", () => r.goTo(P.cfi));
    const H = n.createElement("div");
    return H.setAttribute("role", "listitem"), H.appendChild(D), H;
  }
  const h = new Tn({
    container: s.listScroller,
    rowHeight: Vs,
    rowCount: () => i.rowCount(),
    renderRow: p
  });
  function f(C) {
    const P = C.currentTarget, D = P.dataset.filter ?? "all";
    for (const F of Object.values(s.filterButtons))
      F.classList.toggle("active", F === P), F.setAttribute("aria-pressed", String(F === P));
    i.setState({ filter: D }), h.render();
  }
  for (const C of Object.values(s.filterButtons)) C.addEventListener("click", f);
  function b() {
    i.setState({ sort: s.sortSelect.value }), h.render();
  }
  s.sortSelect.addEventListener("change", b);
  function m() {
    l && clearTimeout(l), l = setTimeout(() => {
      i.setState({ query: s.searchInput.value.trim() || null }), h.render();
    }, qs);
  }
  s.searchInput.addEventListener("input", m);
  function g(C) {
    C.type === "setNotes" && (i.applyWindow(C), h.render());
  }
  const v = t.onCommand(g);
  function A() {
    var C;
    s.capabilityBanner.hidden = ((C = t.getConfig()) == null ? void 0 : C.capabilities.notes) !== !1, i.ensureInitialLoad(), h.render();
  }
  function T() {
    h.render();
  }
  function N() {
    if (!a) {
      a = !0, l && clearTimeout(l), v();
      for (const C of Object.values(s.filterButtons)) C.removeEventListener("click", f);
      s.sortSelect.removeEventListener("change", b), s.searchInput.removeEventListener("input", m), h.destroy(), s.root.remove();
    }
  }
  return { onActivate: A, refresh: T, destroy: N };
}
function Xs(e) {
  const r = e.createElement("div");
  r.className = "rx-glossary-panel", r.style.position = "absolute", r.style.inset = "0";
  const t = e.createElement("div");
  t.className = "rx-glossary-search", t.setAttribute("role", "search");
  const o = e.createElement("input");
  o.type = "search", o.className = "rx-glossary-search-input", o.placeholder = "Search glossary", o.setAttribute("aria-label", "Search glossary"), t.appendChild(o);
  const n = e.createElement("div");
  return n.className = "rx-glossary-list", n.setAttribute("role", "list"), r.append(t, n), { root: r, searchInput: o, list: n };
}
const Zs = 900;
function Js(e) {
  const r = e.ownerDocument ?? document, t = Xs(r);
  e.appendChild(t.root);
  let o = [], n = "", s = !1;
  function i() {
    const p = n.trim().toLowerCase();
    return [...p ? o.filter((f) => f.term.toLowerCase().includes(p)) : o].sort((f, b) => f.term.localeCompare(b.term));
  }
  function a() {
    if (s) return;
    const p = i();
    if (t.list.replaceChildren(), !o.length) {
      t.list.removeAttribute("role");
      const h = r.createElement("div");
      h.className = "rx-glossary-empty", h.textContent = "This book has no glossary.", t.list.appendChild(h);
      return;
    }
    if (!p.length) {
      t.list.removeAttribute("role");
      const h = r.createElement("div");
      h.className = "rx-glossary-empty", h.textContent = `No terms match "${n}".`, t.list.appendChild(h);
      return;
    }
    t.list.setAttribute("role", "list");
    for (const h of p) {
      let f = function() {
        const v = b.classList.toggle("expanded");
        m.setAttribute("aria-expanded", String(v));
      };
      const b = r.createElement("div");
      b.className = "rx-glossary-item", b.setAttribute("role", "listitem"), b.setAttribute("data-term", h.term);
      const m = r.createElement("button");
      m.type = "button", m.className = "rx-glossary-term-row", m.setAttribute("role", "button"), m.setAttribute("aria-expanded", "false"), m.textContent = h.term;
      const g = r.createElement("div");
      g.className = "rx-glossary-def", g.textContent = h.definition, m.addEventListener("click", f), b.append(m, g), t.list.appendChild(b);
    }
  }
  function l() {
    n = t.searchInput.value, a();
  }
  t.searchInput.addEventListener("input", l), a();
  function c(p) {
    o = p, a();
  }
  function d(p) {
    var f, b;
    n && (n = "", t.searchInput.value = "", a());
    const h = t.list.querySelector(`.rx-glossary-item[data-term="${CSS.escape(p)}"]`);
    h && (h.classList.add("expanded"), (f = h.querySelector(".rx-glossary-term-row")) == null || f.setAttribute("aria-expanded", "true"), (b = h.scrollIntoView) == null || b.call(h, { block: "center" }), h.classList.add("flash"), setTimeout(() => h.classList.remove("flash"), Zs));
  }
  function u() {
    s || (s = !0, t.searchInput.removeEventListener("input", l), t.root.remove());
  }
  return { setTerms: c, scrollToAndFlash: d, destroy: u };
}
const fr = 9, He = 8, gr = 16;
function Qs(e, r, t, o) {
  const n = e.top + e.height;
  let s = e.left;
  s = Math.min(Math.max(He, s), Math.max(He, r.width - t - He));
  let i = n + fr, a = !1;
  if (i + o > r.height - He) {
    const c = e.top - o - fr;
    i = Math.max(He, c), a = !0;
  }
  const l = Math.max(gr, Math.min(t - gr, e.left + e.width / 2 - s));
  return { left: s, top: i, above: a, arrowX: l };
}
const ei = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
function ti(e, r, t) {
  const o = e.ownerDocument ?? document;
  let n = null, s = !1;
  function i() {
    var h;
    const p = !!n;
    n == null || n.remove(), n = null, p && ((h = e.querySelector("iframe")) == null || h.focus());
  }
  function a(p, h) {
    var A;
    i();
    const f = o.createElement("div");
    f.className = "rx-glossary-popover", f.setAttribute("role", "dialog"), f.setAttribute("aria-label", `${p.term} definition`), f.innerHTML = `
      <div class="rx-glossary-popover-head">
        <h4 class="rx-glossary-popover-term"></h4>
        <button type="button" class="rx-icon-btn rx-glossary-popover-open" aria-label="Open in glossary" title="Open in glossary">${ei}</button>
      </div>
      <p class="rx-glossary-popover-def"></p>
    `, f.querySelector(".rx-glossary-popover-term").textContent = p.term, f.querySelector(".rx-glossary-popover-def").textContent = p.definition, e.appendChild(f), n = f;
    const b = e.getBoundingClientRect(), m = { left: h.left - b.left, top: h.top - b.top, width: h.width, height: h.height }, g = { width: b.width, height: b.height }, v = Qs(m, g, f.offsetWidth, f.offsetHeight || 120);
    f.style.left = `${v.left}px`, f.style.top = `${v.top}px`, f.classList.toggle("above", v.above), f.style.setProperty("--arrow-x", `${v.arrowX}px`), f.querySelector(".rx-glossary-popover-open").addEventListener("click", (T) => {
      T.stopPropagation(), i(), t.onOpenInGlossary(p.term);
    }), (A = f.querySelector(".rx-glossary-popover-open")) == null || A.focus();
  }
  async function l(p, h) {
    const f = await r.getGlossaryTerms();
    if (s) return;
    const b = f.find((m) => m.term.toLowerCase() === p.toLowerCase());
    b && a(b, h);
  }
  const c = r.onGlossaryTermTap(l);
  function d(p) {
    var f;
    if (!n) return;
    const h = p.target;
    (f = h == null ? void 0 : h.closest) != null && f.call(h, ".rx-glossary-popover") || i();
  }
  o.addEventListener("click", d);
  function u() {
    s || (s = !0, c(), o.removeEventListener("click", d), i());
  }
  return { isOpen: () => n !== null, close: i, destroy: u };
}
const ri = `
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
`, br = "reactor-right-sidebar-stylesheet", mr = "reactor-glossary-stylesheet", ni = 48, oi = 200;
function si(e) {
  if (!e.getElementById(br)) {
    const r = e.createElement("style");
    r.id = br, r.textContent = zs, e.head.appendChild(r);
  }
  if (!e.getElementById(mr)) {
    const r = e.createElement("style");
    r.id = mr, r.textContent = ri, e.head.appendChild(r);
  }
}
function ii(e) {
  const r = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `${r(e.pre)}<mark>${r(e.match)}</mark>${r(e.post)}`;
}
function Nn(e, r, t) {
  var me, Re;
  const o = e.ownerDocument ?? document;
  si(o);
  const n = Bs(o), s = o.createElement("div");
  s.className = "rx-sidebar-scrim", e.append(s, n.root);
  const i = new Is(), a = new Fs(), l = Js(n.glossaryPanelMount);
  let c = "context", d = null, u = !1, p = !1, h = null;
  const f = !!t.hostChannel && ((me = t.hostChannel.getConfig()) == null ? void 0 : me.capabilities.notes) !== !1;
  n.notesTabBtn.disabled = !f;
  const b = f ? Ys({ container: n.notesBody, core: r, hostChannel: t.hostChannel }) : null;
  ((Re = t.capabilities) == null ? void 0 : Re.glossary) === !1 && (n.glossaryTabBtn.hidden = !0);
  function m(k) {
    k !== c && (c = k, n.contextTabBtn.classList.toggle("active", k === "context"), n.contextTabBtn.setAttribute("aria-selected", String(k === "context")), n.glossaryTabBtn.classList.toggle("active", k === "glossary"), n.glossaryTabBtn.setAttribute("aria-selected", String(k === "glossary")), n.notesTabBtn.classList.toggle("active", k === "notes"), n.notesTabBtn.setAttribute("aria-selected", String(k === "notes")), n.searchBar.hidden = k !== "context", n.glossaryPanelMount.hidden = k !== "glossary", n.notesBody.hidden = k !== "notes", k === "context" ? O(a.current) : k === "glossary" ? (n.resultsScroller.hidden = !0, n.contextPage.hidden = !0, r.getGlossaryTerms().then((M) => l.setTerms(M))) : (n.resultsScroller.hidden = !0, n.contextPage.hidden = !0, b == null || b.onActivate()));
  }
  const g = () => m("context"), v = () => m("glossary"), A = () => m("notes");
  n.contextTabBtn.addEventListener("click", g), n.glossaryTabBtn.addEventListener("click", v), n.notesTabBtn.addEventListener("click", A);
  function T(k) {
    const M = i.rowAt(k);
    if (!M) return o.createElement("div");
    if (M.kind === "header") {
      const Ce = o.createElement("div");
      return Ce.className = "rx-ctx-group-header", Ce.setAttribute("role", "listitem"), Ce.textContent = M.label, Ce;
    }
    const oe = o.createElement("button");
    oe.type = "button", oe.className = "rx-ctx-result", oe.setAttribute("role", "listitem"), oe.innerHTML = ii(M.item), oe.addEventListener("click", () => H(M.item, M.groupLabel));
    const xe = o.createElement("div");
    return xe.setAttribute("role", "listitem"), xe.appendChild(oe), xe;
  }
  const N = new Tn({
    container: n.resultsScroller,
    rowHeight: ni,
    rowCount: () => i.rowCount,
    renderRow: T
  });
  function C() {
    n.breadcrumb.replaceChildren();
    const k = o.createElement("button");
    k.type = "button", k.textContent = "Back", k.disabled = !a.canGoBack, k.setAttribute("aria-label", "Back"), k.addEventListener("click", V);
    const M = o.createElement("button");
    M.type = "button", M.textContent = "Forward", M.disabled = !a.canGoForward, M.setAttribute("aria-label", "Forward"), M.addEventListener("click", R), n.breadcrumb.append(k, M), n.openInMainBtn.disabled = a.current.kind !== "page";
  }
  function P() {
    n.resultsScroller.hidden = !1, n.contextPage.hidden = !0, N.render();
  }
  function D() {
    n.resultsScroller.hidden = !1, n.contextPage.hidden = !0, N.render();
  }
  function F() {
    return d || (d = r.createSecondaryView(n.contextPage), d);
  }
  function U(k) {
    n.resultsScroller.hidden = !0, n.contextPage.hidden = !1;
    const M = F();
    M && M.goTo(k);
  }
  function O(k) {
    k.kind === "blank" ? D() : k.kind === "results" ? P() : U(k.target), C();
  }
  function V() {
    const k = a.back();
    k && O(k);
  }
  function R() {
    const k = a.forward();
    k && O(k);
  }
  function H(k, M) {
    a.push({ kind: "page", target: k.cfi, label: M }), O(a.current);
  }
  function z() {
    const k = n.searchInput.value.trim();
    i.reset(), k ? a.current.kind !== "results" && a.push({ kind: "results" }) : a.reset(), O(a.current), h && clearTimeout(h), k && (h = setTimeout(() => r.runSearch(k), oi));
  }
  n.searchInput.addEventListener("input", z);
  function x(k) {
    k.type === "searchResults" ? (i.addGroup(k.label, k.items), a.current.kind === "results" && N.render()) : k.type === "loaded" && l.setTerms([]);
  }
  const I = r.on(x);
  function _() {
    const k = a.current;
    k.kind === "page" && (r.goTo(k.target), t.getSizeClass() === "phone" && be());
  }
  n.openInMainBtn.addEventListener("click", _);
  function te() {
    be();
  }
  n.closeBtn.addEventListener("click", te);
  const re = () => be();
  s.addEventListener("click", re);
  function Y() {
    const k = getComputedStyle(e).getPropertyValue("--rx-ctx-width"), M = parseFloat(k);
    if (!Number.isNaN(M) && M > 0) return M;
    const oe = t.getSizeClass();
    return oe === "phone" ? et : Os[oe];
  }
  n.resizeHandle.setAttribute("aria-valuenow", String(Math.round(Y())));
  function J(k, M) {
    var Ce;
    const oe = t.getSizeClass();
    if (oe === "phone") return;
    const xe = $s(k, e.clientWidth || 1200, oe);
    e.style.setProperty("--rx-ctx-width", `${xe}px`), n.resizeHandle.setAttribute("aria-valuenow", String(Math.round(xe))), u && Ne(e, { right: xe }), M && ((Ce = t.onWidthChange) == null || Ce.call(t, xe));
  }
  let Q = !1, w = 0, W = 0;
  function ne(k) {
    Q = !0, w = k.clientX, W = Y(), e.classList.add("right-sidebar-resizing"), o.addEventListener("pointermove", ce), o.addEventListener("pointerup", ie);
  }
  function ce(k) {
    Q && J(W - (k.clientX - w), !1);
  }
  function ie() {
    Q && (Q = !1, e.classList.remove("right-sidebar-resizing"), o.removeEventListener("pointermove", ce), o.removeEventListener("pointerup", ie), J(Y(), !0));
  }
  function Ee(k) {
    k.key === "ArrowLeft" ? (k.preventDefault(), J(Y() + ur, !0)) : k.key === "ArrowRight" && (k.preventDefault(), J(Y() - ur, !0));
  }
  n.resizeHandle.addEventListener("pointerdown", ne), n.resizeHandle.addEventListener("keydown", Ee);
  function ve() {
    u || (u = !0, e.classList.add("right-sidebar-open"), J(Y(), !1), N.render(), c === "notes" && (b == null || b.refresh()));
  }
  function be() {
    var k;
    u && (u = !1, e.classList.remove("right-sidebar-open"), Ne(e, { right: 0 }), (k = t.onClose) == null || k.call(t));
  }
  function y() {
    u ? be() : ve();
  }
  function B(k) {
    u || ve(), m("glossary"), r.getGlossaryTerms().then((M) => {
      l.setTerms(M), l.scrollToAndFlash(k);
    });
  }
  function ee() {
    u && (t.getSizeClass() === "phone" ? Ne(e, { right: 0 }) : Ne(e, { right: Y() }));
  }
  O(a.current);
  function ae() {
    p || (p = !0, h && clearTimeout(h), I(), n.searchInput.removeEventListener("input", z), n.openInMainBtn.removeEventListener("click", _), n.closeBtn.removeEventListener("click", te), s.removeEventListener("click", re), n.resizeHandle.removeEventListener("pointerdown", ne), o.removeEventListener("pointermove", ce), o.removeEventListener("pointerup", ie), n.resizeHandle.removeEventListener("keydown", Ee), n.contextTabBtn.removeEventListener("click", g), n.notesTabBtn.removeEventListener("click", A), b == null || b.destroy(), n.glossaryTabBtn.removeEventListener("click", v), l.destroy(), N.destroy(), d == null || d.destroy(), e.classList.remove("right-sidebar-open", "right-sidebar-resizing"), Ne(e, { right: 0 }), n.root.remove(), s.remove());
  }
  return { open: ve, close: be, toggle: y, isOpen: () => u, destroy: ae, refreshLayout: ee, openGlossaryTerm: B };
}
function Ye(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = r, t.setAttribute("aria-label", e), t;
}
function ai(e) {
  const r = e.createElement("div");
  r.className = "rx-playback-bar", r.setAttribute("role", "group"), r.setAttribute("aria-label", "Narration transport");
  const t = Ye("Skip back 15 seconds", "rx-playback-icon-btn rx-playback-skip-back");
  t.innerHTML = We("skip_back");
  const o = Ye("Play", "rx-playback-icon-btn rx-playback-play-pause");
  o.setAttribute("aria-pressed", "false"), o.innerHTML = We("play");
  const n = Ye("Skip forward 15 seconds", "rx-playback-icon-btn rx-playback-skip-forward");
  n.innerHTML = We("skip_forward");
  const s = Ye("Playback speed", "rx-playback-rate-btn");
  s.textContent = "1x";
  const i = e.createElement("div");
  i.className = "rx-playback-info";
  const a = e.createElement("span");
  a.className = "rx-playback-chapter", a.setAttribute("aria-live", "polite");
  const l = e.createElement("span");
  return l.className = "rx-playback-position", l.textContent = "0:00", i.append(a, l), r.append(t, o, n, i, s), { root: r, skipBackBtn: t, playPauseBtn: o, skipForwardBtn: n, rateBtn: s, chapterLabel: a, positionLabel: l };
}
const li = `
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
.rx-playback-icon-btn svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
  stroke: none;
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
class ci {
  constructor() {
    L(this, "timeline", null);
    L(this, "activeAudioIndex", 0);
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
const xr = "reactor-playback-stylesheet", yr = 15, Ue = [0.75, 1, 1.25, 1.5, 1.75, 2];
function di(e) {
  if (e.getElementById(xr)) return;
  const r = e.createElement("style");
  r.id = xr, r.textContent = li, e.head.appendChild(r);
}
function ui(e) {
  const r = Number.isFinite(e) && e > 0 ? e : 0, t = Math.floor(r), o = Math.floor(t / 60), n = t % 60;
  return `${o}:${String(n).padStart(2, "0")}`;
}
function vr(e) {
  return Ue.reduce((r, t) => Math.abs(t - e) < Math.abs(r - e) ? t : r, Ue[0] ?? 1);
}
function Bn(e, r, t, o = {}) {
  const n = e.ownerDocument ?? document;
  di(n);
  let s = null, i = !1, a = !1, l = !1, c = !1, d = 0, u = 1, p = !1, h = 0;
  const f = new ci();
  function b(z, x = null, I = null) {
    t.emitIntent({ type: "playback", action: z, positionSec: x, rate: I });
  }
  const m = () => b(c ? "pause" : "play"), g = () => b("seek", Math.max(0, d - yr)), v = () => b("seek", d + yr), A = () => {
    const z = Ue.indexOf(vr(u)), x = Ue[(z + 1) % Ue.length] ?? 1;
    b("rateChange", null, x);
  };
  function T() {
    s && (s.playPauseBtn.setAttribute("aria-pressed", String(c)), s.playPauseBtn.setAttribute("aria-label", c ? "Pause" : "Play"), s.playPauseBtn.innerHTML = We(c ? "pause" : "play"), s.positionLabel.textContent = ui(d), s.rateBtn.textContent = `${vr(u)}x`);
  }
  function N(z) {
    s && s.chapterLabel.textContent !== (z ?? "") && (s.chapterLabel.textContent = z ?? "");
  }
  function C() {
    i || a || (i = !0, s = ai(n), s.root.classList.toggle("e-ink", !!o.eink), e.appendChild(s.root), s.playPauseBtn.addEventListener("click", m), s.skipBackBtn.addEventListener("click", g), s.skipForwardBtn.addEventListener("click", v), s.rateBtn.addEventListener("click", A), Ne(e, { bottom: s.root.offsetHeight || 56 }), T(), P());
  }
  function P() {
    !i || !p || (h += 1, r.narrationPrepare(h));
  }
  function D() {
    if (!i || !p) return;
    const z = f.textHrefFor(d);
    z ? r.narrationHighlight(z) : r.narrationUnhighlight();
  }
  function F(z) {
    switch (z.type) {
      case "loaded":
        p = z.hasMediaOverlay, f.clear(), P();
        break;
      case "relocate":
        N(z.chapterTitle);
        break;
      case "narrationTimeline":
        z.generation === h && (f.setTimeline(z), D());
        break;
      case "narrationTimelineError":
        z.generation === h && f.clear();
        break;
    }
  }
  const U = r.on(F);
  function O(z) {
    if (z.type === "configure") {
      if (l) return;
      l = !0, z.capabilities.playback && C();
    } else if (z.type === "setPlaybackState") {
      if (!i) return;
      c = z.playing, d = z.positionSec, u = z.rate, T(), D();
    }
  }
  const V = t.onCommand(O), R = t.getConfig();
  R && O(R);
  function H() {
    a || (a = !0, U(), V(), s && (s.playPauseBtn.removeEventListener("click", m), s.skipBackBtn.removeEventListener("click", g), s.skipForwardBtn.removeEventListener("click", v), s.rateBtn.removeEventListener("click", A), s.root.remove(), Ne(e, { bottom: 0 })));
  }
  return {
    isVisible: () => i,
    destroy: H
  };
}
const zn = [
  { id: "yellow", label: "Yellow", value: "#FACC15" },
  { id: "green", label: "Green", value: "#34D399" },
  { id: "blue", label: "Blue", value: "#2f7dd0" },
  { id: "pink", label: "Pink", value: "#F472B6" }
], mt = zn[0].value, xt = {
  highlight: "Highlight",
  underline: "Underline",
  strikethrough: "Strikethrough",
  squiggly: "Squiggly underline"
};
function pi(e) {
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
  const i = zn.map((m) => {
    const g = e.createElement("button");
    return g.type = "button", g.className = "rx-anno-swatch", g.style.setProperty("--rx-anno-swatch-color", m.value), g.setAttribute("role", "radio"), g.setAttribute("aria-checked", "false"), g.setAttribute("aria-label", m.label), g.dataset.color = m.value, s.append(g), g;
  }), a = e.createElement("div");
  a.className = "rx-anno-styles", a.setAttribute("role", "group"), a.setAttribute("aria-label", "Mark style");
  const l = {};
  for (const m of Object.keys(xt)) {
    const g = e.createElement("button");
    g.type = "button", g.className = `rx-anno-style rx-anno-style-${m}`, g.textContent = xt[m], g.setAttribute("aria-label", xt[m]), g.dataset.style = m, a.append(g), l[m] = g;
  }
  const c = e.createElement("button");
  c.type = "button", c.className = "rx-anno-note-toggle", c.textContent = "Note", c.setAttribute("aria-expanded", "false");
  const d = e.createElement("div");
  d.className = "rx-anno-note-form", d.hidden = !0;
  const u = e.createElement("textarea");
  u.className = "rx-anno-note-textarea", u.setAttribute("aria-label", "Note text"), u.rows = 3;
  const p = e.createElement("div");
  p.className = "rx-anno-note-actions";
  const h = e.createElement("button");
  h.type = "button", h.className = "rx-anno-note-save", h.textContent = "Save";
  const f = e.createElement("button");
  f.type = "button", f.className = "rx-anno-note-cancel", f.textContent = "Cancel", p.append(f, h), d.append(u, p);
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
    noteSaveBtn: h,
    noteCancelBtn: f,
    deleteBtn: b,
    closeBtn: o,
    statusLabel: t
  };
}
const hi = `
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
`, kr = "reactor-annotations-stylesheet";
function fi(e) {
  return e === "underline" || e === "squiggly" ? "underline" : "highlight";
}
class gi {
  constructor(r = 500) {
    L(this, "map", /* @__PURE__ */ new Map());
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
function bi({ shellRoot: e, core: r, hostChannel: t, options: o = {} }) {
  const n = e.ownerDocument ?? document;
  if (!n.getElementById(kr)) {
    const x = n.createElement("style");
    x.id = kr, x.textContent = hi, n.head.appendChild(x);
  }
  const s = pi(n);
  e.append(s.root);
  const i = new gi();
  let a = mt, l = !1, c = null, d = null;
  function u() {
    c = null, d = null, s.root.hidden = !0, s.noteForm.hidden = !0, s.noteToggleBtn.setAttribute("aria-expanded", "false");
  }
  function p(x) {
    const I = e.getBoundingClientRect(), _ = x ? x.left - I.left : (e.clientWidth || 300) / 2 - 140, te = x ? x.bottom - I.top + 8 : 60, re = Math.max(0, (e.clientWidth || 300) - 288);
    s.root.style.left = `${Math.min(Math.max(0, _), re)}px`, s.root.style.top = `${Math.max(0, te)}px`;
  }
  function h(x) {
    a = x;
    for (const I of s.colorButtons) I.setAttribute("aria-checked", String(I.dataset.color === x));
  }
  function f(x) {
    for (const [I, _] of Object.entries(s.styleButtons)) _.setAttribute("aria-pressed", String(I === x));
  }
  function b(x, I, _) {
    c = { kind: "create", cfi: x, text: I }, s.statusLabel.textContent = "Add mark", s.deleteBtn.hidden = !0, s.noteForm.hidden = !0, s.noteTextarea.value = "", h(a), f(null), s.root.hidden = !1, p(_);
  }
  function m(x, I) {
    c = { kind: "edit", note: x }, s.statusLabel.textContent = "Edit mark", s.deleteBtn.hidden = !1, s.noteForm.hidden = !0, s.noteTextarea.value = x.note ?? "", h(x.color ?? mt), f(x.style ?? (x.kind === "underline" ? "underline" : "highlight")), s.root.hidden = !1, p(I);
  }
  function g(x, I) {
    c = null, d = x, s.statusLabel.textContent = "Loading…", s.deleteBtn.hidden = !0, s.noteForm.hidden = !0, s.root.hidden = !1, p(I), t.emitIntent({ type: "notesPageRequest", offset: 0, limit: 1, filter: null, sort: null, query: `cfi:${x}` });
  }
  function v(x) {
    if (x.type === "selection" && x.cfi)
      b(x.cfi, x.text, x.rect);
    else if (x.type === "selectionCleared")
      (c == null ? void 0 : c.kind) === "create" && u();
    else if (x.type === "annotationTap") {
      if (!x.cfi) return;
      const I = i.get(x.cfi);
      I ? m(I, x.rect) : g(x.cfi, x.rect);
    }
  }
  const A = r.on(v);
  function T(x) {
    if (x.type === "setNotes" && (i.addAll(x.items), d)) {
      const I = x.items.find((_) => _.cfi === d);
      if (I) {
        const _ = s.root.hidden ? null : { left: parseFloat(s.root.style.left || "0"), top: parseFloat(s.root.style.top || "0"), bottom: 0 };
        m(I, _);
      } else
        u();
    }
  }
  const N = t.onCommand(T);
  function C(x) {
    (c == null ? void 0 : c.kind) === "create" && (t.emitIntent({
      type: "annotationCreate",
      cfi: c.cfi,
      kind: fi(x),
      color: a,
      style: x,
      text: c.text,
      note: null
    }), r.clearSelection(), u());
  }
  function P(x) {
    (c == null ? void 0 : c.kind) === "edit" && (t.emitIntent({ type: "annotationUpdate", id: c.note.id, color: a, style: x, note: c.note.note }), u());
  }
  function D(x) {
    const _ = x.currentTarget.dataset.color ?? mt;
    h(_), (c == null ? void 0 : c.kind) === "edit" && t.emitIntent({ type: "annotationUpdate", id: c.note.id, color: _, style: c.note.style, note: c.note.note });
  }
  for (const x of s.colorButtons) x.addEventListener("click", D);
  const F = {
    highlight: () => (c == null ? void 0 : c.kind) === "create" ? C("highlight") : P("highlight"),
    underline: () => (c == null ? void 0 : c.kind) === "create" ? C("underline") : P("underline"),
    strikethrough: () => (c == null ? void 0 : c.kind) === "create" ? C("strikethrough") : P("strikethrough"),
    squiggly: () => (c == null ? void 0 : c.kind) === "create" ? C("squiggly") : P("squiggly")
  };
  for (const [x, I] of Object.entries(s.styleButtons)) I.addEventListener("click", F[x]);
  function U() {
    const x = s.noteForm.hidden;
    s.noteForm.hidden = !x, s.noteToggleBtn.setAttribute("aria-expanded", String(x)), x && s.noteTextarea.focus();
  }
  s.noteToggleBtn.addEventListener("click", U);
  function O() {
    s.noteForm.hidden = !0, s.noteToggleBtn.setAttribute("aria-expanded", "false");
  }
  s.noteCancelBtn.addEventListener("click", O);
  function V() {
    const x = s.noteTextarea.value.trim() || null;
    (c == null ? void 0 : c.kind) === "create" ? (t.emitIntent({
      type: "annotationCreate",
      cfi: c.cfi,
      kind: "note",
      color: a,
      style: null,
      text: c.text,
      note: x
    }), r.clearSelection(), u()) : (c == null ? void 0 : c.kind) === "edit" && (t.emitIntent({ type: "annotationUpdate", id: c.note.id, color: c.note.color, style: c.note.style, note: x }), u());
  }
  s.noteSaveBtn.addEventListener("click", V);
  function R() {
    (c == null ? void 0 : c.kind) === "edit" && (t.emitIntent({ type: "annotationDelete", id: c.note.id }), u());
  }
  s.deleteBtn.addEventListener("click", R);
  const H = () => u();
  s.closeBtn.addEventListener("click", H);
  function z() {
    if (!l) {
      l = !0, A(), N();
      for (const x of s.colorButtons) x.removeEventListener("click", D);
      for (const [x, I] of Object.entries(s.styleButtons)) I.removeEventListener("click", F[x]);
      s.noteToggleBtn.removeEventListener("click", U), s.noteCancelBtn.removeEventListener("click", O), s.noteSaveBtn.removeEventListener("click", V), s.deleteBtn.removeEventListener("click", R), s.closeBtn.removeEventListener("click", H), s.root.remove();
    }
  }
  return { isOpen: () => !s.root.hidden, close: u, destroy: z };
}
const mi = '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>';
function xi(e, r, t) {
  const o = document.createElement("button");
  return o.type = "button", o.className = t, o.setAttribute("aria-label", e), o.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${r}</svg>`, o;
}
function De(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = "rx-settings-toggle", t.setAttribute("aria-pressed", "false"), t.setAttribute("data-setting", r), t.textContent = e, t;
}
function Xe(e, r, t) {
  const o = document.createElement("div");
  o.className = `rx-settings-pills ${t}`, o.setAttribute("role", "radiogroup"), o.setAttribute("aria-label", e);
  for (const n of r) {
    const s = document.createElement("button");
    s.type = "button", s.className = "rx-settings-pill", s.setAttribute("role", "radio"), s.setAttribute("aria-checked", "false"), s.setAttribute("data-value", n.id), s.textContent = n.label, o.appendChild(s);
  }
  return o;
}
function Pe(e, r, t, o) {
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
function yi(e, r) {
  const t = document.createElement("button");
  return t.type = "button", t.className = "rx-settings-tab", t.setAttribute("role", "tab"), t.setAttribute("aria-selected", "false"), t.setAttribute("data-tab", e), t.id = `rx-settings-tab-${e}`, t.textContent = r, t;
}
function Ge(e) {
  const r = document.createElement("div");
  return r.className = "rx-settings-panel", r.setAttribute("role", "tabpanel"), r.setAttribute("data-panel", e), r.setAttribute("aria-labelledby", `rx-settings-tab-${e}`), r.hidden = !0, r;
}
function vi(e) {
  const r = document.createElement("div");
  r.className = "rx-settings-scrim";
  const t = document.createElement("div");
  t.className = "rx-settings-sheet", t.setAttribute("role", "dialog"), t.setAttribute("aria-label", "Text settings"), t.tabIndex = -1;
  const o = document.createElement("div");
  o.className = "rx-settings-head";
  const n = document.createElement("h3");
  n.className = "rx-settings-title", n.textContent = "Text settings";
  const s = xi("Close settings", mi, "rx-icon-btn rx-settings-close");
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
  for (const [Y, J] of d) {
    const Q = yi(Y, J);
    u[Y] = Q, c.appendChild(Q);
  }
  const p = document.createElement("div");
  p.className = "rx-settings-body";
  const h = Ge("typography"), f = Pe("Font size", 13, 28, 1), b = Pe("Paragraph spacing", 0, 2, 0.1), m = Xe("Typeface", [], "rx-settings-font-pills");
  h.append(f.row, m, b.row);
  const g = Ge("layout"), v = Xe(
    "Reading mode",
    [
      { id: "paginated", label: "Paginated" },
      { id: "scrolled", label: "Scrolling" }
    ],
    "rx-settings-flow-pills"
  ), A = Xe(
    "Columns",
    [
      { id: "1", label: "1 column" },
      { id: "2", label: "2 columns" }
    ],
    "rx-settings-columns-pills"
  ), T = Pe("Margins", 0, 96, 4), N = Pe("Line spacing", 1.2, 1.95, 0.05), C = De("Justify text", "justify"), P = De("Hyphenate", "hyphenate"), D = De("Use book's own styling", "useBookLayout");
  g.append(v, A, T.row, N.row, C, P, D);
  const F = Ge("theme"), U = document.createElement("div");
  U.className = "rx-settings-swatches", U.setAttribute("role", "radiogroup"), U.setAttribute("aria-label", "Theme"), F.append(U);
  const O = Ge("controls"), V = De("Swipe to turn pages", "swipe"), R = Xe(
    "Tap zone size",
    [
      { id: "standard", label: "Standard" },
      { id: "wide", label: "Wide" }
    ],
    "rx-settings-tapzone-pills"
  ), H = document.createElement("div");
  H.className = "rx-settings-volumekeys", H.hidden = !0;
  const z = De("Volume keys turn pages", "volumeKeys");
  H.append(z), O.append(V, R, H);
  const x = Ge("playback"), I = document.createElement("p");
  I.className = "rx-settings-empty", I.textContent = "No narration provider for this book.";
  const _ = document.createElement("div");
  _.className = "rx-settings-playback-controls", _.hidden = !0;
  const te = Pe("Narration speed", 0.5, 3, 0.1), re = Pe("Skip forward (seconds)", 5, 60, 5);
  return _.append(te.row, re.row), x.append(I, _), p.append(h, g, F, O, x), t.append(o, i, c, p), e.append(r, t), {
    root: t,
    scrim: r,
    closeBtn: s,
    scopeGlobalBtn: a,
    scopeBookBtn: l,
    tabsRow: c,
    tabButtons: u,
    panels: {
      typography: h,
      layout: g,
      theme: F,
      controls: O,
      playback: x
    },
    fontSizeInput: f.input,
    fontSizeValue: f.value,
    paragraphSpacingInput: b.input,
    paragraphSpacingValue: b.value,
    fontFamilyPills: m,
    flowPills: v,
    columnsPills: A,
    marginInput: T.input,
    marginValue: T.value,
    lineHeightInput: N.input,
    lineHeightValue: N.value,
    justifyToggle: C,
    hyphenateToggle: P,
    useBookLayoutToggle: D,
    themeSwatches: U,
    swipeToggle: V,
    tapZonePills: R,
    volumeKeysRow: H,
    volumeKeysToggle: z,
    playbackEmpty: I,
    playbackControls: _,
    narrationSpeedInput: te.input,
    narrationSpeedValue: te.value,
    skipForwardInput: re.input,
    skipForwardValue: re.value
  };
}
const ki = `
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
`, wr = {
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
}, Nt = [
  { id: "light", label: "Light", themeName: "default", isDark: !1, swatchBg: "#ffffff", swatchFg: "#000000" },
  { id: "sepia", label: "Sepia", themeName: "sepia", isDark: !1, swatchBg: "#f1e8d0", swatchFg: "#5b4636" },
  { id: "dark", label: "Dark", themeName: "default", isDark: !0, swatchBg: "#222222", swatchFg: "#e0e0e0" },
  { id: "amoled", label: "AMOLED", themeName: "amoled", isDark: !0, swatchBg: "#000000", swatchFg: "#ffffff" }
];
function wi(e, r) {
  return Nt.find((t) => t.themeName === e && t.isDark === r) ?? Nt.find((t) => t.id === (r ? "dark" : "light"));
}
const Sr = [
  { id: "publisher", label: "Publisher", value: null },
  { id: "serif", label: "Serif", value: 'Georgia, "Iowan Old Style", "Times New Roman", serif' },
  { id: "sans", label: "Sans-serif", value: '-apple-system, "Segoe UI", Roboto, Arial, sans-serif' },
  { id: "mono", label: "Monospace", value: '"Courier New", monospace' }
];
function Si(e) {
  return Array.from(e.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((t) => t.offsetParent !== null || t === e);
}
function Ei(e) {
  let r = !1;
  function t(o) {
    if (!r || o.key !== "Tab") return;
    const n = Si(e);
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
const Er = "reactor-settings-stylesheet", Ci = ["typography", "layout", "theme", "controls", "playback"];
function Ai(e) {
  if (e.getElementById(Er)) return;
  const r = e.createElement("style");
  r.id = Er, r.textContent = ki, e.head.appendChild(r);
}
function In(e, r, t) {
  var Ee, ve, be;
  const o = e.ownerDocument ?? document;
  Ai(o);
  const n = vi(e), s = Ei(n.root), i = {
    global: { ...wr },
    book: { ...wr }
  };
  let a = "global", l = "typography", c = !1, d = !1, u = ((ve = (Ee = t.hostChannel) == null ? void 0 : Ee.getConfig()) == null ? void 0 : ve.capabilities.playback) ?? !1, p = null;
  n.volumeKeysRow.hidden = !t.volumeKeysCapability;
  function h(y) {
    e.classList.remove("theme-dark", "theme-amoled"), y.themeName === "amoled" ? e.classList.add("theme-amoled") : y.isDark && e.classList.add("theme-dark");
  }
  function f() {
    return i[a];
  }
  function b() {
    const y = f().fontFamily;
    for (const B of Array.from(n.fontFamilyPills.children)) {
      const ee = Sr.find((ae) => ae.id === B.dataset.value);
      B.setAttribute("aria-checked", String((ee == null ? void 0 : ee.value) === y));
    }
  }
  function m() {
    const y = wi(f().themeName, f().isDark);
    for (const B of Array.from(n.themeSwatches.children))
      B.setAttribute("aria-checked", String(B.dataset.value === y.id));
  }
  function g(y, B) {
    for (const ee of Array.from(y.children))
      ee.setAttribute("aria-checked", String(ee.dataset.value === B));
  }
  function v() {
    n.playbackEmpty.hidden = u, n.playbackControls.hidden = !u;
  }
  function A() {
    const y = f();
    n.fontSizeInput.value = String(y.fontSize), n.fontSizeInput.setAttribute("aria-valuetext", `${y.fontSize}px`), n.fontSizeValue.textContent = `${y.fontSize}px`, n.paragraphSpacingInput.value = String(y.paragraphSpacing), n.paragraphSpacingValue.textContent = `${y.paragraphSpacing}em`, b(), g(n.flowPills, y.flow), g(n.columnsPills, String(y.maxColumnCount)), n.marginInput.value = String(y.marginTop), n.marginValue.textContent = `${y.marginTop}px`, n.lineHeightInput.value = String(y.lineHeight), n.lineHeightValue.textContent = y.lineHeight.toFixed(2), n.justifyToggle.setAttribute("aria-pressed", String(y.justify)), n.hyphenateToggle.setAttribute("aria-pressed", String(y.hyphenate)), n.useBookLayoutToggle.setAttribute("aria-pressed", String(y.useBookLayout)), m(), v(), n.scopeGlobalBtn.setAttribute("aria-checked", String(a === "global")), n.scopeBookBtn.setAttribute("aria-checked", String(a === "book"));
  }
  function T(y) {
    var B;
    i[a] = { ...i[a], ...y }, A(), r.applyStyles(i[a]), h(i[a]), (B = t.hostChannel) == null || B.emitIntent({ type: "settingsChange", scope: a, settings: i[a] });
  }
  function N() {
    T({ fontSize: Number(n.fontSizeInput.value) });
  }
  n.fontSizeInput.addEventListener("change", N);
  function C() {
    T({ paragraphSpacing: Number(n.paragraphSpacingInput.value) });
  }
  n.paragraphSpacingInput.addEventListener("change", C);
  for (const y of Sr) {
    const B = document.createElement("button");
    B.type = "button", B.className = "rx-settings-pill", B.setAttribute("role", "radio"), B.setAttribute("aria-checked", "false"), B.setAttribute("data-value", y.id), B.textContent = y.label, B.addEventListener("click", () => T({ fontFamily: y.value })), n.fontFamilyPills.appendChild(B);
  }
  function P(y) {
    const B = y.currentTarget.dataset.value;
    T({ flow: B });
  }
  for (const y of Array.from(n.flowPills.children)) y.addEventListener("click", P);
  function D(y) {
    const B = Number(y.currentTarget.dataset.value);
    T({ maxColumnCount: B });
  }
  for (const y of Array.from(n.columnsPills.children)) y.addEventListener("click", D);
  function F() {
    const y = Number(n.marginInput.value);
    T({ marginTop: y, marginBottom: y, marginLeft: y, marginRight: y });
  }
  n.marginInput.addEventListener("change", F);
  function U() {
    T({ lineHeight: Number(n.lineHeightInput.value) });
  }
  n.lineHeightInput.addEventListener("change", U);
  function O() {
    T({ justify: !f().justify });
  }
  n.justifyToggle.addEventListener("click", O);
  function V() {
    T({ hyphenate: !f().hyphenate });
  }
  n.hyphenateToggle.addEventListener("click", V);
  function R() {
    T({ useBookLayout: !f().useBookLayout });
  }
  n.useBookLayoutToggle.addEventListener("click", R);
  for (const y of Nt) {
    const B = document.createElement("button");
    B.type = "button", B.className = "rx-settings-swatch", B.setAttribute("role", "radio"), B.setAttribute("aria-checked", "false"), B.setAttribute("aria-label", y.label), B.setAttribute("data-value", y.id);
    const ee = document.createElement("span");
    ee.className = "rx-settings-swatch-dot", ee.style.background = y.swatchBg;
    const ae = document.createElement("span");
    ae.textContent = y.label, B.append(ee, ae), B.addEventListener("click", () => T({ themeName: y.themeName, isDark: y.isDark })), n.themeSwatches.appendChild(B);
  }
  let H = !0;
  function z() {
    H = !H, n.swipeToggle.setAttribute("aria-pressed", String(H)), r.setSwipe(H);
  }
  n.swipeToggle.addEventListener("click", z), n.swipeToggle.setAttribute("aria-pressed", String(H));
  let x = "standard";
  function I(y) {
    x = y.currentTarget.dataset.value ?? "standard", g(n.tapZonePills, x);
  }
  for (const y of Array.from(n.tapZonePills.children)) y.addEventListener("click", I);
  g(n.tapZonePills, x);
  let _ = !1;
  function te() {
    _ = !_, n.volumeKeysToggle.setAttribute("aria-pressed", String(_));
  }
  n.volumeKeysToggle.addEventListener("click", te);
  function re() {
    var B;
    const y = Number(n.narrationSpeedInput.value);
    n.narrationSpeedValue.textContent = `${y.toFixed(1)}x`, (B = t.hostChannel) == null || B.emitIntent({ type: "playback", action: "rateChange", positionSec: null, rate: y });
  }
  n.narrationSpeedInput.addEventListener("input", () => {
    n.narrationSpeedValue.textContent = `${Number(n.narrationSpeedInput.value).toFixed(1)}x`;
  }), n.narrationSpeedInput.addEventListener("change", re);
  function Y() {
    n.skipForwardValue.textContent = `${n.skipForwardInput.value}s`;
  }
  n.skipForwardInput.addEventListener("input", Y), n.narrationSpeedInput.value = "1", n.narrationSpeedValue.textContent = "1.0x", n.skipForwardInput.value = "30", n.skipForwardValue.textContent = "30s";
  function J(y) {
    y !== l && (n.tabButtons[l].setAttribute("aria-selected", "false"), n.panels[l].hidden = !0, l = y, n.tabButtons[l].setAttribute("aria-selected", "true"), n.panels[l].hidden = !1);
  }
  for (const y of Ci)
    n.tabButtons[y].addEventListener("click", () => J(y));
  J("typography"), n.tabButtons.typography.setAttribute("aria-selected", "true"), n.panels.typography.hidden = !1;
  function Q(y) {
    y !== a && (a = y, A(), r.applyStyles(i[a]), h(i[a]));
  }
  n.scopeGlobalBtn.addEventListener("click", () => Q("global")), n.scopeBookBtn.addEventListener("click", () => Q("book"));
  const w = (be = t.hostChannel) == null ? void 0 : be.onCommand((y) => {
    y.type === "setSettingsScope" ? (i[y.scope] = y.settings, y.scope === a && (A(), r.applyStyles(i[a]), h(i[a]))) : y.type === "configure" && (u = y.capabilities.playback, v());
  });
  function W() {
    var y;
    c || (c = !0, p = o.activeElement ?? null, e.classList.add("settings-open"), n.scrim.classList.add("visible"), s.activate(), n.root.focus({ preventScroll: !0 }), (y = t.onOpenChange) == null || y.call(t, !0));
  }
  function ne() {
    var y, B;
    c && (c = !1, e.classList.remove("settings-open"), n.scrim.classList.remove("visible"), s.deactivate(), (y = p == null ? void 0 : p.focus) == null || y.call(p), p = null, (B = t.onOpenChange) == null || B.call(t, !1));
  }
  function ce() {
    c ? ne() : W();
  }
  n.closeBtn.addEventListener("click", ne), n.scrim.addEventListener("click", ne), A();
  function ie() {
    d || (d = !0, w == null || w(), s.deactivate(), e.classList.remove("settings-open"), n.root.remove(), n.scrim.remove());
  }
  return {
    open: W,
    close: ne,
    toggle: ce,
    isOpen: () => c,
    getActiveSettings: () => f(),
    getActiveScope: () => a,
    destroy: ie
  };
}
const Ti = { top: 0, right: 0, bottom: 0, left: 0 };
function Cr(e, r) {
  e.style.setProperty("--rx-inset-top", `${Math.max(0, r.top)}px`), e.style.setProperty("--rx-inset-right", `${Math.max(0, r.right)}px`), e.style.setProperty("--rx-inset-bottom", `${Math.max(0, r.bottom)}px`), e.style.setProperty("--rx-inset-left", `${Math.max(0, r.left)}px`);
}
const Li = 280, Ar = "reactor-shell-stylesheet";
function Ni(e) {
  if (e.getElementById(Ar)) return;
  const r = e.createElement("style");
  r.id = Ar, r.textContent = ns, e.head.appendChild(r);
}
function Bi() {
  return typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function zi() {
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
function Ii(e, r, t = {}) {
  var _t, Ht, Dt, Gt, jt, Wt, Ut, Vt;
  if ((t.chrome ?? "reactor") === "host") return zi();
  const n = e.ownerDocument ?? document;
  Ni(n);
  const s = rs(e), i = s.root;
  let a = !1, l = !1, c = "none", d = !1, u = !1, p = null;
  const h = /* @__PURE__ */ new Set();
  function f() {
    var q;
    if (u) return;
    const S = { barsVisible: l, sidebar: c };
    for (const Ke of h) Ke(S);
    (q = t.hostChannel) == null || q.emitIntent({ type: "chromeState", barsVisible: l, sidebar: c });
  }
  function b(S) {
    l !== S && (l = S, i.classList.toggle("ui-visible", l), f());
  }
  function m() {
    b(!l);
  }
  const g = Ns(i, (S) => r.goTo(S), {
    eink: t.eink,
    // The sidebar header's "Back" control (protocol v2 README: the host's own navigation
    // action, kept distinct from `close`) - silently dropped by HostChannel until a host
    // opts in with `configure`.
    onBack: () => {
      var S;
      return (S = t.hostChannel) == null ? void 0 : S.emitIntent({ type: "back" });
    },
    onSidebarChange: (S) => {
      c = S ? "left" : "none", s.contentsBtn.setAttribute("aria-pressed", String(S)), f(), T();
    }
  });
  function v() {
    return i.classList.contains("size-desktop");
  }
  function A() {
    if (g.isOpen()) {
      g.close();
      return;
    }
    v() || ie.close(), me.close(), g.open();
  }
  s.contentsBtn.addEventListener("click", A);
  function T() {
    const S = i.classList.contains("size-desktop");
    Ne(i, { left: S && g.isOpen() ? Li : 0 });
  }
  function N() {
    i.classList.toggle("reduced-motion", P || Bi());
  }
  function C() {
    i.classList.toggle("e-ink", P);
  }
  let P = ((Ht = (_t = t.hostChannel) == null ? void 0 : _t.getConfig()) == null ? void 0 : Ht.eink) ?? !!t.eink;
  C(), N(), Cr(i, ((Gt = (Dt = t.hostChannel) == null ? void 0 : Dt.getConfig()) == null ? void 0 : Gt.insets) ?? Ti);
  const D = (jt = t.hostChannel) == null ? void 0 : jt.onCommand((S) => {
    S.type === "configure" && (P = S.eink, C(), N(), Cr(i, S.insets));
  });
  function F() {
    const S = e.clientWidth || i.clientWidth, q = Qe(S);
    i.classList.remove("size-phone", "size-fold-tablet", "size-desktop"), i.classList.add(`size-${q}`), T();
  }
  F();
  function U() {
    F(), ie.refreshLayout();
  }
  const O = typeof ResizeObserver == "function" ? new ResizeObserver(() => U()) : null;
  O == null || O.observe(e);
  const V = () => U();
  O || window.addEventListener("resize", V);
  const R = typeof matchMedia == "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null, H = () => N();
  (Wt = R == null ? void 0 : R.addEventListener) == null || Wt.call(R, "change", H);
  function z(S, q) {
    const Ke = wn(S, a);
    Ke === "prev" ? r.prev() : Ke === "next" ? r.next() : m();
  }
  function x(S) {
    S === "prev" ? r.prev() : S === "next" ? r.next() : m();
  }
  function I(S, q) {
    q.key !== "Enter" && q.key !== " " || (q.preventDefault(), x(S));
  }
  const _ = () => x(a ? "next" : "prev"), te = () => x(a ? "prev" : "next"), re = () => x("toggle"), Y = (S) => I(a ? "next" : "prev", S), J = (S) => I(a ? "prev" : "next", S), Q = (S) => I("toggle", S);
  s.zoneLeft.addEventListener("click", _), s.zoneRight.addEventListener("click", te), s.zoneCentre.addEventListener("click", re), s.zoneLeft.addEventListener("keydown", Y), s.zoneRight.addEventListener("keydown", J), s.zoneCentre.addEventListener("keydown", Q);
  function w() {
    return me.isOpen() ? (me.close(), !0) : ae != null && ae.isOpen() ? (ae.close(), !0) : k.isOpen() ? (k.close(), !0) : ie.isOpen() ? (Ee(), !0) : g.isOpen() ? (g.close(), !0) : l ? (b(!1), !0) : !1;
  }
  function W(S) {
    const q = Sn(S);
    q && (En(q) && S.preventDefault(), q === "next" ? r.next() : q === "prev" ? r.prev() : q === "toggleBars" ? m() : q === "escape" && w());
  }
  n.addEventListener("keydown", W);
  const ne = () => r.historyBack(), ce = () => r.historyForward();
  s.historyBackBtn.addEventListener("click", ne), s.historyForwardBtn.addEventListener("click", ce);
  const ie = Nn(i, r, {
    getSizeClass: () => Qe(e.clientWidth || i.clientWidth),
    onWidthChange: t.onContextWidthChange,
    hostChannel: t.hostChannel,
    onClose: () => {
      c = "none", s.contextBtn.setAttribute("aria-pressed", "false"), f();
    }
  });
  function Ee() {
    c === "right" ? (ie.close(), c = "none") : (v() || g.close(), me.close(), ie.open(), c = "right"), s.contextBtn.setAttribute("aria-pressed", String(c === "right")), f();
  }
  s.contextBtn.addEventListener("click", Ee);
  const ve = t.hostChannel ? Bn(i, r, t.hostChannel, { eink: t.eink }) : null;
  let be = /* @__PURE__ */ new Set();
  function y() {
    s.bookmarkBtn.setAttribute("aria-pressed", String(!!p && be.has(p)));
  }
  function B() {
    !t.hostChannel || !p || t.hostChannel.emitIntent({ type: "bookmarkToggle", cfi: p });
  }
  const ee = (Ut = t.hostChannel) == null ? void 0 : Ut.onCommand((S) => {
    S.type === "setBookmarks" && (be = new Set(S.items.map((q) => q.cfi)), y());
  });
  s.bookmarkBtn.addEventListener("click", B);
  const ae = t.hostChannel ? bi({ shellRoot: i, core: r, hostChannel: t.hostChannel, options: { eink: t.eink } }) : null, me = In(i, r, {
    getSizeClass: () => Qe(e.clientWidth || i.clientWidth),
    eink: t.eink,
    hostChannel: t.hostChannel,
    volumeKeysCapability: t.volumeKeysCapability,
    onOpenChange: (S) => {
      s.settingsBtn.setAttribute("aria-pressed", String(S));
    }
  });
  function Re() {
    if (me.isOpen()) {
      me.close();
      return;
    }
    g.close(), ie.close(), c = "none", s.contentsBtn.setAttribute("aria-pressed", "false"), s.contextBtn.setAttribute("aria-pressed", "false"), f(), me.open();
  }
  s.settingsBtn.addEventListener("click", Re);
  const k = ti(i, r, {
    onOpenInGlossary: (S) => {
      ie.openGlossaryTerm(S), c = "right", s.contextBtn.setAttribute("aria-pressed", "true"), f();
    }
  }), M = (Vt = t.hostChannel) == null ? void 0 : Vt.onCommand((S) => {
    var q;
    S.type === "dismiss" && !w() && ((q = t.hostChannel) == null || q.emitIntent({ type: "back" }));
  }), oe = () => {
    d = !0;
  }, xe = () => {
    d = !1, r.goToFraction(Number(s.scrubber.value) / 1e3);
  };
  s.scrubber.addEventListener("pointerdown", oe), s.scrubber.addEventListener("change", xe);
  function Ce(S) {
    switch (S.type) {
      case "loaded":
        a = S.isRtl, i.classList.toggle("is-rtl", a), g.setToc(S.toc), T();
        break;
      case "relocate":
        p = S.cfi ?? null, s.chapterLabel && s.chapterLabel.textContent !== (S.chapterTitle ?? "") && (s.chapterLabel.textContent = S.chapterTitle ?? ""), !d && typeof S.fraction == "number" && (s.scrubber.value = String(Math.round(S.fraction * 1e3))), g.setCurrentChapterTitle(S.chapterTitle), y();
        break;
      case "history":
        s.historyBackBtn.disabled = !S.canGoBack, s.historyForwardBtn.disabled = !S.canGoForward;
        break;
      case "tap":
        z(S.x, S.y);
        break;
    }
  }
  const Pn = r.on(Ce);
  function Fn() {
    F();
  }
  function On() {
    var S;
    u || (u = !0, Pn(), O == null || O.disconnect(), O || window.removeEventListener("resize", V), (S = R == null ? void 0 : R.removeEventListener) == null || S.call(R, "change", H), n.removeEventListener("keydown", W), s.zoneLeft.removeEventListener("click", _), s.zoneRight.removeEventListener("click", te), s.zoneCentre.removeEventListener("click", re), s.zoneLeft.removeEventListener("keydown", Y), s.zoneRight.removeEventListener("keydown", J), s.zoneCentre.removeEventListener("keydown", Q), s.historyBackBtn.removeEventListener("click", ne), s.historyForwardBtn.removeEventListener("click", ce), s.contextBtn.removeEventListener("click", Ee), s.bookmarkBtn.removeEventListener("click", B), ee == null || ee(), M == null || M(), D == null || D(), ae == null || ae.destroy(), ie.destroy(), ve == null || ve.destroy(), s.settingsBtn.removeEventListener("click", Re), me.destroy(), k.destroy(), s.scrubber.removeEventListener("pointerdown", oe), s.scrubber.removeEventListener("change", xe), s.contentsBtn.removeEventListener("click", A), g.destroy(), h.clear(), i.classList.remove(
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
    onChromeState: (S) => (h.add(S), () => h.delete(S)),
    setBarsVisible: b,
    refreshSizeClass: Fn,
    destroy: On
  };
}
const Di = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ZONE_FRACTION: Lt,
  computeSizeClass: Qe,
  isPreventableKey: En,
  mountPlaybackBar: Bn,
  mountRightSidebar: Nn,
  mountSettingsPanel: In,
  mountShell: Ii,
  resolveKeyboardAction: Sn,
  resolveTapZone: wn
}, Symbol.toStringTag, { value: "Module" }));
function Pi() {
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
function Fi(e, r = {}) {
  const t = new kn(e), o = r.v2 ? Pi() : void 0;
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
    openRemote: (i, a, l, c) => (s(), t.openRemote(i, a, l, c)),
    setExtraCss: (i) => {
      s(), t.setExtraCss(i);
    },
    destroy: () => {
      n || (n = !0, e.replaceChildren());
    }
  };
}
const Gi = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createWebHost: Fi
}, Symbol.toStringTag, { value: "Module" })), ji = "0.0.1";
export {
  ji as R,
  po as a,
  Hi as b,
  Mi as c,
  Di as d,
  Gi as e,
  $i as f,
  _i as i,
  $e as p,
  Ri as t
};
