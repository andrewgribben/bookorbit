var R = (n) => {
  throw TypeError(n);
};
var v = (n, t, e) => t.has(n) || R("Cannot " + e);
var s = (n, t, e) => (v(n, t, "read from private field"), e ? e.call(n) : t.get(n)), S = (n, t, e) => t.has(n) ? R("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(n) : t.set(n, e), c = (n, t, e, i) => (v(n, t, "write to private field"), i ? i.call(n, e) : t.set(n, e), e), x = (n, t, e) => (v(n, t, "access private method"), e);
const l = {
  XML: "http://www.w3.org/XML/1998/namespace",
  SSML: "http://www.w3.org/2001/10/synthesis"
}, D = /* @__PURE__ */ new Set([
  "article",
  "aside",
  "audio",
  "blockquote",
  "caption",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "dd",
  "figure",
  "footer",
  "form",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "math",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "tr"
]), _ = (n) => {
  var e;
  const t = n.lang || ((e = n == null ? void 0 : n.getAttributeNS) == null ? void 0 : e.call(n, l.XML, "lang"));
  return t || (n.parentElement ? _(n.parentElement) : null);
}, O = (n) => {
  var e;
  const t = (e = n == null ? void 0 : n.getAttributeNS) == null ? void 0 : e.call(n, l.XML, "lang");
  return t || (n.parentElement ? O(n.parentElement) : null);
}, q = (n = "en", t = "word") => {
  const e = new Intl.Segmenter(n, { granularity: t }), i = t === "word";
  return function* (r, o) {
    const g = r.join("");
    let b = 0, a = -1, u = 0;
    for (const { index: M, segment: E, isWordLike: w } of e.segment(g)) {
      if (i && !w) continue;
      for (; u <= M; ) u += r[++a].length;
      const N = a, W = M - (u - r[a].length), I = M + E.length - 1;
      if (I < g.length) for (; u <= I; ) u += r[++a].length;
      const z = a, B = I - (u - r[a].length) + 1;
      yield [(b++).toString(), o(N, W, z, B)];
    }
  };
}, F = (n, t) => {
  const e = document.implementation.createDocument(l.SSML, "speak"), { lang: i } = t;
  i && e.documentElement.setAttributeNS(l.XML, "lang", i);
  const r = (o, g, b) => {
    if (!o) return;
    if (o.nodeType === 3) return e.createTextNode(o.textContent);
    if (o.nodeType === 4) return e.createCDATASection(o.textContent);
    if (o.nodeType !== 1) return;
    let a;
    const u = o.nodeName.toLowerCase();
    u === "foliate-mark" ? (a = e.createElementNS(l.SSML, "mark"), a.setAttribute("name", o.dataset.name)) : u === "br" ? a = e.createElementNS(l.SSML, "break") : (u === "em" || u === "strong") && (a = e.createElementNS(l.SSML, "emphasis"));
    const M = o.lang || o.getAttributeNS(l.XML, "lang");
    M && (a || (a = e.createElementNS(l.SSML, "lang")), a.setAttributeNS(l.XML, "lang", M));
    const E = o.getAttributeNS(l.SSML, "alphabet") || b;
    if (!a) {
      const N = o.getAttributeNS(l.SSML, "ph");
      N && (a = e.createElementNS(l.SSML, "phoneme"), E && a.setAttribute("alphabet", E), a.setAttribute("ph", N));
    }
    a || (a = g);
    let w = o.firstChild;
    for (; w; ) {
      const N = r(w, a, E);
      N && a !== N && a.append(N), w = w.nextSibling;
    }
    return a;
  };
  return r(n.firstChild, e.documentElement, t.alphabet), e;
}, P = (n, t, e) => {
  const i = _(n.commonAncestorContainer), r = O(n.commonAncestorContainer), o = q(i, e), g = n.cloneContents(), b = [...t(n, o)], a = [...t(g, o)];
  for (const [M, E] of a) {
    const w = document.createElement("foliate-mark");
    w.dataset.name = M, E.insertNode(w);
  }
  const u = F(g, { lang: i, alphabet: r });
  return { entries: b, ssml: u };
}, X = (n) => !n.toString().trim();
function* j(n) {
  let t;
  const e = n.createTreeWalker(n.body, NodeFilter.SHOW_ELEMENT);
  for (let i = e.nextNode(); i; i = e.nextNode()) {
    const r = i.tagName.toLowerCase();
    D.has(r) && (t && (t.setEndBefore(i), X(t) || (yield t)), t = n.createRange(), t.setStart(i, 0));
  }
  t || (t = n.createRange(), t.setStart(n.body.firstChild ?? n.body, 0)), t.setEndAfter(n.body.lastChild ?? n.body), X(t) || (yield t);
}
var h, k, m, d;
class H {
  constructor(t, e = (i) => i) {
    S(this, h, []);
    S(this, k);
    S(this, m, -1);
    S(this, d);
    c(this, k, t), c(this, d, e);
  }
  current() {
    if (s(this, h)[s(this, m)]) return s(this, d).call(this, s(this, h)[s(this, m)]);
  }
  first() {
    if (s(this, h)[0])
      return c(this, m, 0), s(this, d).call(this, s(this, h)[0]);
  }
  prev() {
    const t = s(this, m) - 1;
    if (s(this, h)[t])
      return c(this, m, t), s(this, d).call(this, s(this, h)[t]);
  }
  next() {
    const t = s(this, m) + 1;
    if (s(this, h)[t])
      return c(this, m, t), s(this, d).call(this, s(this, h)[t]);
    for (; ; ) {
      const { done: e, value: i } = s(this, k).next();
      if (e) break;
      if (s(this, h).push(i), s(this, h)[t])
        return c(this, m, t), s(this, d).call(this, s(this, h)[t]);
    }
  }
  find(t) {
    const e = s(this, h).findIndex((i) => t(i));
    if (e > -1)
      return c(this, m, e), s(this, d).call(this, s(this, h)[e]);
    for (; ; ) {
      const { done: i, value: r } = s(this, k).next();
      if (i) break;
      if (s(this, h).push(r), t(r))
        return c(this, m, s(this, h).length - 1), s(this, d).call(this, r);
    }
  }
}
h = new WeakMap(), k = new WeakMap(), m = new WeakMap(), d = new WeakMap();
var L, A, p, y, f, C, T;
class G {
  constructor(t, e, i, r) {
    S(this, f);
    S(this, L);
    S(this, A);
    S(this, p);
    S(this, y, new XMLSerializer());
    this.doc = t, this.highlight = i, c(this, L, new H(j(t), (o) => {
      const { entries: g, ssml: b } = P(o, e, r);
      return c(this, A, new Map(g)), [b, o];
    }));
  }
  start() {
    c(this, p, null);
    const [t] = s(this, L).first() ?? [];
    return t ? x(this, f, T).call(this, t, (e) => x(this, f, C).call(this, e, s(this, p))) : this.next();
  }
  resume() {
    const [t] = s(this, L).current() ?? [];
    return t ? x(this, f, T).call(this, t, (e) => x(this, f, C).call(this, e, s(this, p))) : this.next();
  }
  prev(t) {
    c(this, p, null);
    const [e, i] = s(this, L).prev() ?? [];
    return t && i && this.highlight(i.cloneRange()), x(this, f, T).call(this, e);
  }
  next(t) {
    c(this, p, null);
    const [e, i] = s(this, L).next() ?? [];
    return t && i && this.highlight(i.cloneRange()), x(this, f, T).call(this, e);
  }
  from(t) {
    c(this, p, null);
    const [e] = s(this, L).find((r) => t.compareBoundaryPoints(Range.END_TO_START, r) <= 0);
    let i;
    for (const [r, o] of s(this, A).entries())
      if (t.compareBoundaryPoints(Range.START_TO_START, o) <= 0) {
        i = r;
        break;
      }
    return x(this, f, T).call(this, e, (r) => x(this, f, C).call(this, r, i));
  }
  setMark(t) {
    const e = s(this, A).get(t);
    e && (c(this, p, t), this.highlight(e.cloneRange()));
  }
}
L = new WeakMap(), A = new WeakMap(), p = new WeakMap(), y = new WeakMap(), f = new WeakSet(), C = function(t, e) {
  return e ? t.querySelector(`mark[name="${CSS.escape(e)}"`) : null;
}, T = function(t, e) {
  var o, g;
  if (!t) return;
  if (!e) return s(this, y).serializeToString(t);
  const i = document.implementation.createDocument(l.SSML, "speak");
  i.documentElement.replaceWith(i.importNode(t.documentElement, !0));
  let r = (o = e(i)) == null ? void 0 : o.previousSibling;
  for (; r; ) {
    const b = r.previousSibling ?? ((g = r.parentNode) == null ? void 0 : g.previousSibling);
    r.parentNode.removeChild(r), r = b;
  }
  return s(this, y).serializeToString(i);
};
export {
  G as TTS
};
