const u = ({ entries: i, loadBlob: a, getSize: l }, d) => {
  const s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), f = async (e) => {
    if (s.has(e)) return s.get(e);
    const t = URL.createObjectURL(await a(e)), r = URL.createObjectURL(
      new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin: 0"><img src="${t}"></body></html>`], {
        type: "text/html"
      })
    );
    return c.set(e, [t, r]), s.set(e, r), r;
  }, p = (e) => {
    var t, r;
    (r = (t = c.get(e)) == null ? void 0 : t.forEach) == null || r.call(t, (h) => URL.revokeObjectURL(h)), c.delete(e), s.delete(e);
  }, g = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".jxl", ".avif"], n = i.map((e) => e.filename).filter((e) => g.some((t) => e.endsWith(t))).sort();
  if (!n.length) throw new Error("No supported image files in archive");
  const o = {};
  return o.getCover = () => a(n[0]), o.metadata = { title: d.name }, o.sections = n.map((e) => ({
    id: e,
    load: () => f(e),
    unload: () => p(e),
    size: l(e)
  })), o.toc = n.map((e) => ({ label: e, href: e })), o.rendition = { layout: "pre-paginated" }, o.resolveHref = (e) => ({ index: o.sections.findIndex((t) => t.id === e) }), o.splitTOCHref = (e) => [e, null], o.getTOCFragment = (e) => e.documentElement, o.destroy = () => {
    for (const e of c.values()) for (const t of e) URL.revokeObjectURL(t);
  }, o;
};
export {
  u as makeComicBook
};
