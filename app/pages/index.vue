<script setup>
const environment = ref('sandbox')
const clientId = ref('')
const clientSecret = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const fieldErrors = reactive({
  clientId: false,
  clientSecret: false,
})

const environments = [
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'production', label: 'Production' },
]

const canSubmit = computed(
  () => clientId.value.trim().length > 0 && clientSecret.value.trim().length > 0 && !loading.value,
)

function clearFeedback() {
  errorMessage.value = ''
  successMessage.value = ''
}

function validate() {
  fieldErrors.clientId = !clientId.value.trim()
  fieldErrors.clientSecret = !clientSecret.value.trim()
  return !fieldErrors.clientId && !fieldErrors.clientSecret
}

async function downloadCompose() {
  clearFeedback()

  if (!validate()) {
    errorMessage.value = 'Lengkapi Client ID dan Client Secret terlebih dahulu.'
    return
  }

  loading.value = true

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/zip, application/json',
      },
      body: JSON.stringify({
        environment: environment.value,
        clientId: clientId.value.trim(),
        clientSecret: clientSecret.value.trim(),
      }),
    })

    if (!response.ok) {
      let message = `Download gagal (HTTP ${response.status})`
      try {
        const payload = await response.json()
        message = payload?.statusMessage || payload?.message || message
      } catch {
        // keep default
      }
      throw new Error(message)
    }

    const blob = await response.blob()
    const disposition = response.headers.get('content-disposition') || ''
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)
    const filename = match?.[1]
      ? decodeURIComponent(match[1].replace(/"/g, '').trim())
      : 'docker-compose.zip'

    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)

    successMessage.value = `Berhasil mengunduh ${filename}`
  } catch (error) {
    errorMessage.value = error.message || 'Terjadi kesalahan saat mengunduh.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand-mark" aria-hidden="true" />
      <span class="brand-word">DICOM Router</span>
      <span class="badge-code">SATUSEHAT</span>
    </header>

    <main class="hero">
      <p class="eyebrow">Downloader</p>
      <h1 class="brand-title">DICOM Router</h1>
      <p class="lede">
        Ambil <code>docker-compose.zip</code> terbaru dari API SATUSEHAT tanpa Postman.
      </p>

      <form class="panel" @submit.prevent="downloadCompose">
        <div class="field">
          <span class="label">Environment</span>
          <div class="pill-tabs" role="tablist" aria-label="Environment">
            <button
              v-for="item in environments"
              :key="item.id"
              type="button"
              role="tab"
              class="pill-tab"
              :class="{ active: environment === item.id }"
              :aria-selected="environment === item.id"
              @click="environment = item.id; clearFeedback()"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <label class="field">
          <span class="label">Client ID</span>
          <input
            v-model="clientId"
            class="text-input"
            :class="{ error: fieldErrors.clientId }"
            type="text"
            autocomplete="username"
            placeholder="client-id-satusehat"
            @input="fieldErrors.clientId = false; clearFeedback()"
          >
        </label>

        <label class="field">
          <span class="label">Client Secret</span>
          <input
            v-model="clientSecret"
            class="text-input"
            :class="{ error: fieldErrors.clientSecret }"
            type="password"
            autocomplete="current-password"
            placeholder="client-secret-satusehat"
            @input="fieldErrors.clientSecret = false; clearFeedback()"
          >
        </label>

        <p v-if="errorMessage" class="alert alert-error" role="alert">
          {{ errorMessage }}
        </p>
        <p v-else-if="successMessage" class="alert alert-success" role="status">
          {{ successMessage }}
        </p>

        <button class="button-primary" type="submit" :disabled="!canSubmit">
          <span v-if="loading" class="spinner" aria-hidden="true" />
          {{ loading ? 'Mengunduh…' : 'Download docker-compose' }}
        </button>

        <p class="fineprint">
          Credential hanya dipakai di server untuk meminta token, lalu mengunduh file.
          Tidak disimpan.
        </p>
      </form>
    </main>
  </div>
</template>

<style scoped>
.page {
  width: min(100%, 720px);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-xxl) var(--space-section);
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-height: 56px;
  animation: rise 420ms ease both;
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background:
    linear-gradient(135deg, var(--color-brand-coral) 0%, var(--color-brand-magenta) 48%, var(--color-brand-blue) 100%);
}

.brand-word {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.2px;
}

.badge-code {
  margin-left: auto;
  background: var(--color-brand-blue-200);
  color: var(--color-brand-blue-deep);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}

.hero {
  padding-top: clamp(40px, 8vw, var(--space-hero));
  animation: rise 520ms ease both;
  animation-delay: 60ms;
}

.eyebrow {
  margin: 0 0 var(--space-sm);
  color: var(--color-steel);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.brand-title {
  margin: 0;
  color: var(--color-ink-strong);
  font-size: clamp(40px, 8vw, 80px);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -2px;
}

.lede {
  margin: var(--space-md) 0 0;
  max-width: 34rem;
  color: var(--color-steel);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.5;
}

.lede code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  background: var(--color-surface);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
}

.panel {
  margin-top: var(--space-xxxl);
  display: grid;
  gap: var(--space-xl);
  padding: var(--space-xxl);
  background: var(--color-canvas);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  box-shadow: rgba(0, 0, 0, 0.04) 0 1px 2px 0;
  animation: rise 620ms ease both;
  animation-delay: 120ms;
}

.field {
  display: grid;
  gap: var(--space-xs);
}

.label {
  color: var(--color-charcoal);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.pill-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.pill-tab {
  appearance: none;
  border: 1px solid var(--color-hairline);
  background: var(--color-canvas);
  color: var(--color-steel);
  border-radius: var(--radius-full);
  padding: var(--space-xs) var(--space-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  cursor: pointer;
  transition:
    background var(--ease-quick),
    color var(--ease-quick),
    border-color var(--ease-quick),
    transform var(--ease-quick);
}

.pill-tab.active {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-color: var(--color-primary);
}

.pill-tab:active {
  transform: scale(0.98);
}

.text-input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background: var(--color-canvas);
  color: var(--color-ink);
  padding: var(--space-sm) var(--space-md);
  outline: none;
  transition: border-color var(--ease-quick), box-shadow var(--ease-quick);
}

.text-input::placeholder {
  color: var(--color-muted);
}

.text-input:focus {
  border: 2px solid var(--color-brand-blue-deep);
  padding: calc(var(--space-sm) - 1px) calc(var(--space-md) - 1px);
}

.text-input.error {
  border-color: var(--color-error);
}

.button-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-height: 40px;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-on-primary);
  padding: 11px 24px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  transition: background var(--ease-quick), transform var(--ease-quick);
}

.button-primary:active:not(:disabled) {
  background: var(--color-charcoal);
  transform: scale(0.985);
}

.button-primary:disabled {
  background: var(--color-hairline);
  color: var(--color-muted);
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

.alert {
  margin: 0;
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  font-size: 14px;
  line-height: 1.5;
  animation: rise 220ms ease both;
}

.alert-error {
  background: #fff1f1;
  color: var(--color-error);
  border: 1px solid #f0c4c4;
}

.alert-success {
  background: var(--color-success-bg);
  color: var(--color-success-text);
  border: 1px solid #b9ebc8;
}

.fineprint {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 767px) {
  .page {
    padding: var(--space-md) var(--space-md) var(--space-section-sm);
  }

  .panel {
    padding: var(--space-xl);
  }

  .text-input,
  .button-primary {
    min-height: 44px;
    height: 44px;
  }
}
</style>
