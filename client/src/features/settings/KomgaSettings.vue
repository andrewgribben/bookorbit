<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Plus, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/clipboard'
import SettingsSection from './components/SettingsSection.vue'

const { t } = useI18n()

const baseUrl = `${window.location.origin}/komga`
const keys = ref<Array<{ id: number; label: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null }>>([])
const showCreateForm = ref(false)
const newLabel = ref('')
const creating = ref(false)
const newKeyRevealed = ref<string | null>(null)

async function loadKeys() {
  try {
    const response = await api('/api/v1/user/api-keys')
    if (!response.ok) throw new Error(t('settings.reader.komga.loadFailed'))
    keys.value = await response.json()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t('settings.reader.komga.loadFailed'))
  }
}

onMounted(loadKeys)

async function createKey() {
  if (!newLabel.value.trim()) return
  creating.value = true
  try {
    const response = await api('/api/v1/user/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.value.trim() }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(((body as Record<string, unknown>).message as string) ?? t('settings.reader.komga.createKeyFailed'))
    }
    const created = await response.json()
    keys.value.unshift({ id: created.id, label: created.label, keyPrefix: created.keyPrefix, createdAt: created.createdAt, lastUsedAt: null })
    newKeyRevealed.value = created.key
    newLabel.value = ''
    showCreateForm.value = false
    setTimeout(() => {
      newKeyRevealed.value = null
    }, 30000)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t('settings.reader.komga.createKeyFailed'))
  } finally {
    creating.value = false
  }
}

async function deleteKey(id: number) {
  try {
    const response = await api(`/api/v1/user/api-keys/${id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error(t('settings.reader.komga.deleteKeyFailed'))
    keys.value = keys.value.filter((k) => k.id !== id)
    toast.success(t('settings.reader.komga.keyDeleted'))
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t('settings.reader.komga.deleteKeyFailed'))
  }
}

function cancelCreate() {
  showCreateForm.value = false
  newLabel.value = ''
}

function startCreate() {
  showCreateForm.value = true
}

async function copyBaseUrl() {
  const copied = await copyToClipboard(baseUrl)
  if (copied) toast.success(t('settings.reader.komga.urlCopied'))
  else toast.error(t('settings.reader.komga.urlCopyFailed'))
}

async function copyRevealedKey() {
  const value = newKeyRevealed.value
  if (!value) return
  const copied = await copyToClipboard(value)
  if (copied) toast.success(t('settings.reader.komga.keyCopied'))
  else toast.error(t('settings.reader.komga.keyCopyFailed'))
}
</script>

<template>
  <div>
    <!-- API URL -->
    <SettingsSection :title="t('settings.reader.komga.endpoint')" class="mb-6">
      <div class="flex items-center gap-2">
        <code class="flex-1 px-3 py-2 bg-muted rounded text-sm font-mono break-all">{{ baseUrl }}</code>
        <Button variant="outline" size="sm" class="shrink-0" @click="copyBaseUrl">
          <Copy :size="12" />
          {{ t('settings.reader.komga.copy') }}
        </Button>
      </div>
      <p class="text-sm text-muted-foreground mt-2">{{ t('settings.reader.komga.endpointHint') }}</p>
    </SettingsSection>

    <!-- API Keys -->
    <SettingsSection :title="t('settings.reader.komga.apiKeys')">
      <!-- Create form -->
      <div v-if="showCreateForm" class="border border-border rounded-lg p-4 md:p-5 bg-card mb-4 space-y-4">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('settings.reader.komga.keyLabel') }}</label>
          <input v-model="newLabel" type="text" :placeholder="t('settings.reader.komga.keyLabelPlaceholder')" class="input-field w-full" />
        </div>
        <div class="flex gap-2">
          <Button :disabled="creating || !newLabel.trim()" @click="createKey">
            <Plus class="size-4 mr-1" />
            {{ creating ? t('settings.reader.komga.creating') : t('settings.reader.komga.createKey') }}
          </Button>
          <Button variant="ghost" @click="cancelCreate">{{ t('common.cancel') }}</Button>
        </div>
      </div>

      <!-- New key revealed -->
      <div v-if="newKeyRevealed" class="border-2 border-primary/30 rounded-lg p-4 bg-primary/5 mb-4">
        <p class="text-sm font-medium text-primary mb-1">{{ t('settings.reader.komga.keyCreated') }}</p>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-muted rounded text-sm font-mono">{{ newKeyRevealed }}</code>
          <Button variant="outline" size="sm" class="shrink-0" @click="copyRevealedKey">
            <Copy :size="12" />
            {{ t('settings.reader.komga.copy') }}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground mt-1">{{ t('settings.reader.komga.keyCreatedHint') }}</p>
      </div>

      <!-- Keys list -->
      <div
        v-if="keys.length === 0 && !showCreateForm"
        class="border border-dashed border-border rounded-lg px-5 py-8 text-center text-muted-foreground"
      >
        {{ t('settings.reader.komga.noKeys') }}
      </div>

      <div v-else class="space-y-2">
        <div v-for="key in keys" :key="key.id" class="flex items-center justify-between px-4 py-3 bg-card rounded-lg border border-border">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ key.label }}</p>
            <p class="text-xs text-muted-foreground font-mono">{{ key.keyPrefix }}</p>
          </div>
          <Button variant="ghost" size="icon" class="text-destructive" :aria-label="t('common.delete')" @click="deleteKey(key.id)">
            <Trash2 class="size-4" />
          </Button>
        </div>
      </div>

      <Button v-if="!showCreateForm" size="sm" @click="startCreate">
        <Plus class="size-4 mr-1" />
        {{ t('settings.reader.komga.addKey') }}
      </Button>
    </SettingsSection>
  </div>
</template>
