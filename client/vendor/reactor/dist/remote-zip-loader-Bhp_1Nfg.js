class d extends Error {
  constructor(e, t = null) {
    super(e), this.name = "RangeUnsupportedError", this.blob = t;
  }
}
function w(o) {
  if (!o) return 0;
  const e = /\/(\d+)$/.exec(o.trim());
  return e ? Number(e[1]) : 0;
}
const g = 65536;
class p {
  constructor(e, t, r, s) {
    this.url = e, this.fetcher = t, this.size = r ?? 0, this.initialized = !1, this.stats = s;
  }
  // zip.js reads a whole entry's bytes through this stream (set up with offset/size assigned
  // onto it afterwards, mirroring zip.js's own Reader base class), not just through
  // `readUint8Array` directly - entry extraction needs both. Chunked so one entry read never
  // buffers more than `chunkSize` bytes at a time, same shape as the whole-book bound.
  get readable() {
    const e = this, t = new ReadableStream({
      start() {
        this.chunkOffset = 0;
      },
      async pull(r) {
        const s = e.chunkSize || g, { offset: a = 0, size: h = 0 } = t, { chunkOffset: c } = this;
        r.enqueue(await e.readUint8Array(a + c, Math.min(s, h - c))), c + s >= h ? r.close() : this.chunkOffset += s;
      }
    });
    return t;
  }
  async init() {
    if (!this.initialized) {
      if (!this.size) {
        const e = await this.fetcher(this.url, { headers: { Range: "bytes=0-0" } });
        if (e.status === 206) {
          const t = w(e.headers.get("Content-Range")), r = await e.arrayBuffer();
          if (this.stats.bytesTransferred += r.byteLength, !t) throw new d("Range response missing a usable Content-Range total");
          this.size = t;
        } else if (e.status === 200) {
          const t = await e.blob();
          throw this.stats.bytesTransferred += t.size, new d("Server ignored the Range request header (got 200)", t);
        } else
          throw new Error(`Failed to probe remote EPUB size: ${e.status}`);
      }
      this.initialized = !0;
    }
  }
  async readUint8Array(e, t) {
    const r = e + t - 1, s = await this.fetcher(this.url, { headers: { Range: `bytes=${e}-${r}` } });
    if (s.status !== 206) throw new d(`Server did not answer Range with 206 (got ${s.status})`);
    const a = await s.arrayBuffer();
    return this.stats.bytesTransferred += a.byteLength, new Uint8Array(a);
  }
}
function f(o, { TextWriter: e, BlobWriter: t }, r) {
  const s = new Map(o.map((n) => [n.filename, n])), a = (n) => (i, ...l) => s.has(i) ? n(s.get(i), ...l) : null, h = a((n) => n.getData(new e())), c = a((n, i) => n.getData(new t(i)));
  return { entries: o, loadText: h, loadBlob: c, getSize: (n) => {
    var i;
    return ((i = s.get(n)) == null ? void 0 : i.uncompressedSize) ?? 0;
  }, bytesTransferred: () => r.bytesTransferred };
}
async function R(o, e, t, r, s) {
  let a = r;
  if (!a) {
    const u = await e(o);
    if (!u.ok) throw new Error(`Failed to fetch remote EPUB: ${u.status}`);
    a = await u.blob(), t.bytesTransferred += a.size;
  }
  const c = await new s.ZipReader(new s.BlobReader(a)).getEntries();
  return f(c, s, t);
}
const y = async (o, e = fetch, t) => {
  const r = { bytesTransferred: 0 }, { configure: s, ZipReader: a, BlobReader: h, TextWriter: c, BlobWriter: u } = await import("./zip-DYE5jiUF.js");
  s({ useWebWorkers: !1 });
  const n = { ZipReader: a, BlobReader: h, TextWriter: c, BlobWriter: u };
  try {
    const i = new p(o, e, t, r), b = await new a(i).getEntries();
    return f(b, n, r);
  } catch (i) {
    if (!(i instanceof d)) throw i;
    return R(o, e, r, i.blob, n);
  }
};
export {
  d as RangeUnsupportedError,
  y as default,
  y as makeRemoteZipLoader
};
