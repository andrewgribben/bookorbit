import { ref } from 'vue'

import type { ReaderImportResult } from '@bookorbit/types'
import { api } from '@/lib/api'

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { message?: unknown } | null
  return typeof payload?.message === 'string' ? payload.message : fallback
}

export function useReaderBackupImport() {
  const file = ref<File | null>(null)
  const result = ref<ReaderImportResult | null>(null)
  const busy = ref(false)
  const error = ref<string | null>(null)

  function selectFile(selected: File | null) {
    file.value = selected
    result.value = null
    error.value = null
  }

  // The file is sent again on apply so the server never holds an unconfirmed plan.
  async function run(apply: boolean): Promise<boolean> {
    if (!file.value || busy.value) return false
    busy.value = true
    error.value = null
    try {
      const body = new FormData()
      body.append('file', file.value)
      const res = await api(`/api/v1/reader-import/mihon${apply ? '?apply=true' : ''}`, { method: 'POST', body })
      if (!res.ok) throw new Error(await errorMessage(res, `Import failed: ${res.status}`))
      result.value = (await res.json()) as ReaderImportResult
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      busy.value = false
    }
  }

  return { file, result, busy, error, selectFile, preview: () => run(false), apply: () => run(true) }
}
