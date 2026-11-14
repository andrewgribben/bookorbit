const p = async (a, r = fetch) => {
  const e = await r(`${a}entries.json`);
  if (!e.ok) throw new Error(`Failed to list local EPUB entries: ${e.status}`);
  const i = await e.json(), l = new Map(i.map((o) => [o.name, o])), s = (o) => `${a}entry/${o.split("/").map(encodeURIComponent).join("/")}`;
  return { loadText: async (o) => {
    if (!o || !l.has(o)) return null;
    try {
      const t = await r(s(o));
      return t.ok ? await t.text() : null;
    } catch (t) {
      return console.error(`Error loading local text ${o}:`, t), null;
    }
  }, loadBlob: async (o, t) => {
    if (!o || !l.has(o)) return null;
    try {
      const n = await r(s(o));
      if (!n.ok) return null;
      const c = await n.blob();
      return t ? new Blob([c], { type: t }) : c;
    } catch (n) {
      return console.error(`Error loading local blob ${o}:`, n), null;
    }
  }, getSize: (o) => {
    var t;
    return ((t = l.get(o)) == null ? void 0 : t.size) ?? 0;
  } };
};
export {
  p as default,
  p as makeLocalZipLoader
};
