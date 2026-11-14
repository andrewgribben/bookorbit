// Build-time EPUB reader engine flag (W1-B2, docs/plans/W1.md section 5/9). Read in exactly one
// place: `ReaderView.vue` imports `READER_ENGINE`/`isReactorEngine` from here instead of reading
// `import.meta.env.VITE_READER_ENGINE` itself, so there is a single source of truth for which
// engine composable (`useFoliate` vs `useReactor`) backs the EPUB reader.
//
// Unset (the default): 'foliate'. The reader is byte-for-byte the existing code path - nothing
// about `useFoliate`'s call site changes when this flag is off.
export type ReaderEngine = 'foliate' | 'reactor'

export const READER_ENGINE: ReaderEngine = import.meta.env.VITE_READER_ENGINE === 'reactor' ? 'reactor' : 'foliate'

export function isReactorEngine(): boolean {
  return READER_ENGINE === 'reactor'
}
