/** Stub for Reactor's vendored `vendor/foliate/pdf.js` (W1-B2). Reactor's `view.js` dynamically
 * imports `./pdf.js` for its own PDF support, but that module was never vendored into Reactor
 * v0.2.1's build output - the import is unresolvable at bundle time. BookOrbit never opens a PDF
 * through Reactor (its EPUB-only `useReactor.ts` never calls `view.open()` with a PDF file; PDFs
 * use the separate `@embedpdf` reader), so this stub only needs to exist for the bundler to
 * resolve the import; it is never expected to execute. Aliased in `vite.config.ts`.
 */
export function makePDF(): never {
  throw new Error('Reactor PDF support is not vendored into BookOrbit; PDFs use the embedpdf reader instead.')
}
