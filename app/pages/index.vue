<script setup>
import { LogOut } from '@lucide/vue'

const currentYear = new Date().getFullYear()
const { data: meData, refresh: refreshMe } = await useFetch('/api/auth/me')
const currentUser = computed(() => meData.value?.user || null)
const loggingOut = ref(false)
const mainTab = ref('downloader')
const environment = ref('sandbox')
const clientId = ref('')
const clientSecret = ref('')
const loading = ref(false)
const saving = ref(false)
const deploying = ref(false)
const statusBusy = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const fieldErrors = reactive({
  clientId: false,
  clientSecret: false,
})

const composeFile = ref('')
const routerConfFile = ref('')
const yamlContent = ref('')
const routerConfContent = ref('')
const activeEditor = ref('compose')
const composeReady = ref(false)
const deployOutput = ref('')
const services = ref([])
const containerLogs = ref('')
const statusMessage = ref('')
const statusError = ref('')

const environments = [
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'production', label: 'Production' },
]

const mainTabs = [
  { id: 'downloader', label: 'Downloader' },
  { id: 'editor', label: 'Editor' },
  { id: 'status', label: 'Status' },
]

const editorTabs = computed(() => [
  {
    id: 'compose',
    label: 'docker-compose.yml',
    available: Boolean(composeFile.value),
  },
  {
    id: 'router',
    label: 'router.conf',
    available: Boolean(routerConfFile.value) || composeReady.value,
  },
])

const canSubmit = computed(
  () => clientId.value.trim().length > 0 && clientSecret.value.trim().length > 0 && !loading.value,
)

const canSave = computed(
  () =>
    composeReady.value &&
    yamlContent.value.trim().length > 0 &&
    routerConfContent.value.trim().length > 0 &&
    !saving.value,
)

const canDeploy = computed(
  () =>
    composeReady.value &&
    yamlContent.value.trim().length > 0 &&
    routerConfContent.value.trim().length > 0 &&
    !deploying.value &&
    !saving.value,
)

const hasRunning = computed(() =>
  services.value.some((s) => /running/i.test(serviceState(s))),
)

const hasPaused = computed(() =>
  services.value.some((s) => /paused/i.test(serviceState(s))),
)

const hasStopped = computed(() =>
  services.value.some((s) => /exited|created|stopped/i.test(serviceState(s))),
)

function clearFeedback() {
  errorMessage.value = ''
  successMessage.value = ''
}

function clearStatusFeedback() {
  statusMessage.value = ''
  statusError.value = ''
}

function validate() {
  fieldErrors.clientId = !clientId.value.trim()
  fieldErrors.clientSecret = !clientSecret.value.trim()
  return !fieldErrors.clientId && !fieldErrors.clientSecret
}

async function readErrorMessage(response, fallback) {
  let message = fallback
  try {
    const payload = await response.json()
    message =
      payload?.data?.stderr ||
      payload?.statusMessage ||
      payload?.message ||
      message
  } catch {
    // keep default
  }
  return message
}

function applyConfigPayload(payload) {
  composeFile.value = payload.composeFile || ''
  routerConfFile.value = payload.routerConfFile || ''
  yamlContent.value = payload.composeContent ?? payload.content ?? ''
  routerConfContent.value = payload.routerConfContent ?? ''
  composeReady.value = Boolean(composeFile.value || routerConfFile.value)

  if (activeEditor.value === 'router' && !routerConfFile.value && !routerConfContent.value) {
    activeEditor.value = 'compose'
  }
}

async function loadCompose() {
  try {
    const response = await fetch('/api/compose')
    if (!response.ok) {
      if (response.status === 404) {
        composeReady.value = false
        composeFile.value = ''
        routerConfFile.value = ''
        yamlContent.value = ''
        routerConfContent.value = ''
        return
      }
      throw new Error(await readErrorMessage(response, `Gagal memuat config (HTTP ${response.status})`))
    }

    applyConfigPayload(await response.json())
  } catch (error) {
    errorMessage.value = error.message || 'Gagal memuat file konfigurasi.'
  }
}

async function loadDeployStatus() {
  try {
    const response = await fetch('/api/deploy')
    if (!response.ok) {
      if (response.status === 404) {
        services.value = []
        return
      }
      statusError.value = await readErrorMessage(response, 'Gagal memuat status container')
      return
    }
    const payload = await response.json()
    services.value = Array.isArray(payload.services) ? payload.services : []
  } catch {
    // status is optional
  }
}

async function loadLogs() {
  try {
    const response = await fetch('/api/container/logs?tail=50')
    if (!response.ok) {
      if (response.status === 404) {
        containerLogs.value = ''
        return
      }
      throw new Error(await readErrorMessage(response, `Gagal mengambil logs (HTTP ${response.status})`))
    }
    const payload = await response.json()
    containerLogs.value = payload.logs || '(tidak ada log)'
  } catch (error) {
    statusError.value = error.message || 'Gagal mengambil docker logs.'
  }
}

async function refreshStatus() {
  clearStatusFeedback()
  statusBusy.value = true
  try {
    await Promise.all([loadDeployStatus(), loadLogs()])
  } finally {
    statusBusy.value = false
  }
}

async function runContainerAction(action, path) {
  clearStatusFeedback()
  statusBusy.value = true

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(
        payload?.data?.stderr ||
          payload?.statusMessage ||
          payload?.message ||
          `${action} gagal (HTTP ${response.status})`,
      )
    }

    statusMessage.value = `Container ${action} berhasil.`
    await loadDeployStatus()
    await loadLogs()
  } catch (error) {
    statusError.value = error.message || `Gagal ${action} container.`
  } finally {
    statusBusy.value = false
  }
}

async function saveConfig() {
  const response = await fetch('/api/compose', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      composeFile: composeFile.value || undefined,
      composeContent: yamlContent.value,
      routerConfFile: routerConfFile.value || undefined,
      routerConfContent: routerConfContent.value,
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Gagal menyimpan (HTTP ${response.status})`))
  }

  const payload = await response.json()
  applyConfigPayload(payload)
  return payload
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
        Accept: 'application/json',
      },
      body: JSON.stringify({
        environment: environment.value,
        clientId: clientId.value.trim(),
        clientSecret: clientSecret.value.trim(),
      }),
    })

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, `Download gagal (HTTP ${response.status})`))
    }

    const payload = await response.json()
    successMessage.value = payload.composeFile
      ? `Disimpan di public/compose. Lanjut ke tab Editor.`
      : 'Zip disimpan & di-unzip. File compose belum terdeteksi — periksa public/compose.'

    await loadCompose()
    if (routerConfFile.value) activeEditor.value = 'router'
    if (composeReady.value) mainTab.value = 'editor'
  } catch (error) {
    errorMessage.value = error.message || 'Terjadi kesalahan saat mengunduh.'
  } finally {
    loading.value = false
  }
}

async function saveYaml() {
  clearFeedback()

  if (!canSave.value) {
    errorMessage.value = 'docker-compose.yml dan router.conf wajib diisi.'
    return
  }

  saving.value = true

  try {
    await saveConfig()
    successMessage.value = `Tersimpan: ${composeFile.value || '-'} & ${routerConfFile.value || 'router.conf'}`
  } catch (error) {
    errorMessage.value = error.message || 'Gagal menyimpan konfigurasi.'
  } finally {
    saving.value = false
  }
}

async function deployCompose() {
  clearFeedback()
  deployOutput.value = ''

  if (!canDeploy.value) {
    errorMessage.value = 'Ambil dan edit docker-compose.yml + router.conf dulu sebelum deploy.'
    return
  }

  deploying.value = true

  try {
    await saveConfig()

    const response = await fetch('/api/deploy', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const detail =
        payload?.data?.stderr ||
        payload?.statusMessage ||
        payload?.message ||
        `Deploy gagal (HTTP ${response.status})`
      deployOutput.value = [payload?.data?.stdout, payload?.data?.stderr].filter(Boolean).join('\n') || detail
      throw new Error(detail)
    }

    deployOutput.value = [payload?.stdout, payload?.stderr].filter(Boolean).join('\n')
    successMessage.value = 'Deploy berhasil. Buka tab Status untuk monitor.'
    mainTab.value = 'status'
    await refreshStatus()
  } catch (error) {
    errorMessage.value = error.message || 'Gagal deploy compose.'
  } finally {
    deploying.value = false
  }
}

function serviceLabel(service) {
  return service.Name || service.Service || service.ID || 'service'
}

function serviceState(service) {
  return service.State || service.Status || '-'
}

function serviceHealth(service) {
  return service.Health || service.Status || ''
}

async function selectMainTab(id) {
  mainTab.value = id
  clearFeedback()
  clearStatusFeedback()
  if (id === 'editor') {
    await loadCompose()
  }
  if (id === 'status') {
    await refreshStatus()
  }
}

async function logout() {
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await navigateTo('/login')
  } catch {
    await navigateTo('/login')
  } finally {
    loggingOut.value = false
  }
}

onMounted(async () => {
  await refreshMe()
  await loadCompose()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <img
        class="brand-mark"
        src="/logo-lungs.png"
        alt=""
        width="28"
        height="28"
        aria-hidden="true"
      >
      <span class="brand-word">DICOM Router</span>
      <span class="badge-code">SATUSEHAT</span>
      <div class="topbar-user">
        <span v-if="currentUser" class="user-chip">{{ currentUser.username }}</span>
        <button
          type="button"
          class="button-secondary button-icon-only"
          :disabled="loggingOut"
          :aria-label="loggingOut ? 'Sedang logout' : 'Logout'"
          :title="loggingOut ? 'Sedang logout…' : 'Logout'"
          @click="logout"
        >
          <span v-if="loggingOut" class="spinner spinner-dark" aria-hidden="true" />
          <LogOut v-else :size="18" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </header>

    <main class="hero">
      <p class="eyebrow">Downloader &amp; Deploy</p>
      <h1 class="brand-title">
        <img
          class="title-logo"
          src="/logo-lungs.png"
          alt=""
          width="56"
          height="56"
          aria-hidden="true"
        >
        DICOM Router
      </h1>
      <p class="lede">
        Ambil zip SATUSEHAT, edit konfigurasi, lalu deploy &amp; monitor container Docker.
      </p>

      <nav class="main-tabs" role="tablist" aria-label="Bag aplikasi">
        <button
          v-for="tab in mainTabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="main-tab"
          :class="{ active: mainTab === tab.id }"
          :aria-selected="mainTab === tab.id"
          @click="selectMainTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- Downloader -->
      <section v-show="mainTab === 'downloader'" class="panel" role="tabpanel">
        <form class="form-grid" @submit.prevent="downloadCompose">
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
            {{ loading ? 'Mengambil…' : 'Ambil compose' }}
          </button>

          <p class="fineprint">
            Credential dipakai di server untuk token SATUSEHAT, lalu zip disimpan &amp; di-unzip ke
            <code>public/compose</code>. Lanjut edit di tab Editor.
          </p>
        </form>
      </section>

      <!-- Editor -->
      <section v-show="mainTab === 'editor'" class="panel" role="tabpanel">
        <template v-if="!composeReady">
          <p class="empty-state">
            Belum ada file compose. Ambil dulu dari tab <strong>Downloader</strong>.
          </p>
        </template>

        <template v-else>
          <div class="editor-header">
            <div>
              <span class="label">Config editor</span>
              <p class="editor-meta">
                Edit <code>docker-compose.yml</code> &amp; <code>router.conf</code>
              </p>
            </div>
            <div class="editor-actions">
              <button
                type="button"
                class="button-secondary"
                :disabled="!canSave"
                @click="saveYaml"
              >
                <span v-if="saving" class="spinner spinner-dark" aria-hidden="true" />
                {{ saving ? 'Menyimpan…' : 'Simpan' }}
              </button>
              <button
                type="button"
                class="button-primary"
                :disabled="!canDeploy"
                @click="deployCompose"
              >
                <span v-if="deploying" class="spinner" aria-hidden="true" />
                {{ deploying ? 'Deploying…' : 'Deploy' }}
              </button>
            </div>
          </div>

          <p v-if="errorMessage" class="alert alert-error" role="alert">
            {{ errorMessage }}
          </p>
          <p v-else-if="successMessage" class="alert alert-success" role="status">
            {{ successMessage }}
          </p>

          <div class="pill-tabs" role="tablist" aria-label="File editor">
            <button
              v-for="tab in editorTabs"
              :key="tab.id"
              type="button"
              role="tab"
              class="pill-tab"
              :class="{ active: activeEditor === tab.id }"
              :aria-selected="activeEditor === tab.id"
              :disabled="!tab.available && tab.id === 'compose'"
              @click="activeEditor = tab.id; clearFeedback()"
            >
              {{ tab.label }}
            </button>
          </div>

          <label v-show="activeEditor === 'compose'" class="field">
            <span class="label">
              <code>{{ composeFile || 'docker-compose.yml' }}</code>
            </span>
            <textarea
              v-model="yamlContent"
              class="yaml-editor"
              spellcheck="false"
              rows="18"
              @input="clearFeedback()"
            />
          </label>

          <label v-show="activeEditor === 'router'" class="field">
            <span class="label">
              <code>{{ routerConfFile || 'router.conf' }}</code>
              — isi <code>organization_id</code>, <code>client_key</code>, <code>secret_key</code>
            </span>
            <textarea
              v-model="routerConfContent"
              class="yaml-editor"
              spellcheck="false"
              rows="22"
              @input="clearFeedback()"
            />
          </label>

          <div v-if="deployOutput" class="output-block">
            <span class="label">Output deploy</span>
            <pre class="output-pre">{{ deployOutput }}</pre>
          </div>
        </template>
      </section>

      <!-- Status -->
      <section v-show="mainTab === 'status'" class="panel" role="tabpanel">
        <div class="editor-header">
          <div>
            <span class="label">Container status</span>
            <p class="editor-meta">
              Stop / pause / unpause / start + logs 50 baris terakhir
            </p>
          </div>
          <div class="editor-actions">
            <button
              type="button"
              class="button-secondary"
              :disabled="statusBusy"
              @click="refreshStatus"
            >
              <span v-if="statusBusy" class="spinner spinner-dark" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        <p v-if="statusError" class="alert alert-error" role="alert">
          {{ statusError }}
        </p>
        <p v-else-if="statusMessage" class="alert alert-success" role="status">
          {{ statusMessage }}
        </p>

        <div class="action-row">
          <button
            type="button"
            class="button-secondary button-icon"
            :disabled="statusBusy || !hasRunning"
            title="Pause"
            aria-label="Pause"
            @click="runContainerAction('pause', '/api/container/pause')"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
            </svg>
            Pause
          </button>
          <button
            type="button"
            class="button-secondary button-icon"
            :disabled="statusBusy || !hasPaused"
            title="Unpause"
            aria-label="Unpause"
            @click="runContainerAction('unpause', '/api/container/unpause')"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
            </svg>
            Unpause
          </button>
          <button
            type="button"
            class="button-secondary button-icon"
            :disabled="statusBusy || (!hasRunning && !hasPaused)"
            title="Stop"
            aria-label="Stop"
            @click="runContainerAction('stop', '/api/container/stop')"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
            </svg>
            Stop
          </button>
          <button
            type="button"
            class="button-primary button-icon"
            :disabled="statusBusy || !hasStopped"
            title="Start"
            aria-label="Start"
            @click="runContainerAction('start', '/api/container/start')"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
            </svg>
            Start
          </button>
        </div>

        <div class="status-block">
          <span class="label">Services</span>
          <p v-if="!services.length" class="empty-state compact">
            Belum ada container. Deploy dulu dari tab Editor.
          </p>
          <ul v-else class="service-list">
            <li v-for="(service, index) in services" :key="index">
              <div>
                <strong>{{ serviceLabel(service) }}</strong>
                <span class="service-sub">{{ serviceHealth(service) }}</span>
              </div>
              <span class="state-pill" :data-state="String(serviceState(service)).toLowerCase()">
                {{ serviceState(service) }}
              </span>
            </li>
          </ul>
        </div>

        <div class="output-block">
          <div class="logs-header">
            <span class="label">Docker logs (tail 50)</span>
            <button
              type="button"
              class="button-secondary button-small"
              :disabled="statusBusy"
              @click="loadLogs"
            >
              Ambil logs
            </button>
          </div>
          <pre class="output-pre logs-pre">{{ containerLogs || 'Belum ada logs.' }}</pre>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="footer-brand">
        <img
          src="/logo-lungs.png"
          alt=""
          width="22"
          height="22"
          aria-hidden="true"
        >
        <span>DICOM Router</span>
      </div>
      <p class="footer-copy">
        Tool internal untuk unduh, edit, dan deploy DICOM Router SATUSEHAT.
        Credential &amp; config disimpan lokal di server — batasi akses jaringan.
      </p>
      <p class="footer-meta">
        © {{ currentYear }} SIMRS BROS · MBX
      </p>
    </footer>
  </div>
</template>

<style scoped>
.page {
  width: min(100%, 880px);
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
  object-fit: cover;
  display: block;
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

.topbar-user {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.user-chip {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-steel);
  padding: 2px 8px;
}

.hero {
  padding-top: clamp(32px, 6vw, 64px);
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
  display: flex;
  align-items: center;
  gap: var(--space-md);
  color: var(--color-ink-strong);
  font-size: clamp(36px, 7vw, 64px);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -2px;
}

.title-logo {
  width: clamp(40px, 7vw, 56px);
  height: clamp(40px, 7vw, 56px);
  border-radius: var(--radius-lg);
  object-fit: cover;
  flex-shrink: 0;
}

.lede {
  margin: var(--space-md) 0 0;
  max-width: 40rem;
  color: var(--color-steel);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.5;
}

.lede code,
.fineprint code,
.field code,
.editor-meta code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  background: var(--color-surface);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
}

.main-tabs {
  margin-top: var(--space-xxl);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-full);
  width: fit-content;
  max-width: 100%;
}

.main-tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--color-steel);
  border-radius: var(--radius-full);
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ease-quick), color var(--ease-quick);
}

.main-tab.active {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.panel {
  margin-top: var(--space-xl);
  display: grid;
  gap: var(--space-xl);
  padding: var(--space-xxl);
  background: var(--color-canvas);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  box-shadow: rgba(0, 0, 0, 0.04) 0 1px 2px 0;
  animation: rise 420ms ease both;
}

.form-grid {
  display: grid;
  gap: var(--space-xl);
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

.pill-tab:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

.editor-header,
.logs-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.editor-meta {
  margin: 4px 0 0;
  color: var(--color-muted);
  font-size: 12px;
}

.editor-actions,
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.yaml-editor {
  width: 100%;
  min-height: 360px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background: #0f1419;
  color: #e8eef5;
  padding: var(--space-md);
  outline: none;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  tab-size: 2;
}

.yaml-editor:focus {
  border: 2px solid var(--color-brand-blue-deep);
  padding: calc(var(--space-md) - 1px);
}

.button-primary,
.button-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-height: 40px;
  border-radius: var(--radius-full);
  padding: 11px 24px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  transition: background var(--ease-quick), transform var(--ease-quick), border-color var(--ease-quick);
}

.button-primary {
  border: 0;
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.button-primary:active:not(:disabled) {
  background: var(--color-charcoal);
  transform: scale(0.985);
}

.button-primary:disabled,
.button-secondary:disabled {
  background: var(--color-hairline);
  color: var(--color-muted);
  border-color: var(--color-hairline);
  cursor: not-allowed;
}

.button-secondary {
  border: 1px solid var(--color-hairline);
  background: var(--color-canvas);
  color: var(--color-charcoal);
}

.button-secondary:active:not(:disabled) {
  transform: scale(0.985);
}

.button-small {
  min-height: 32px;
  padding: 6px 14px;
  font-size: 12px;
  width: fit-content;
}

.button-icon {
  gap: 8px;
}

.button-icon-only {
  width: 36px;
  height: 36px;
  min-height: 36px;
  padding: 0;
  border-radius: var(--radius-full);
}

.btn-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: block;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

.spinner-dark {
  border-color: rgba(0, 0, 0, 0.15);
  border-top-color: var(--color-charcoal);
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

.fineprint,
.empty-state {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.5;
}

.empty-state.compact {
  font-size: 12px;
}

.output-block,
.status-block {
  display: grid;
  gap: var(--space-xs);
}

.output-pre {
  margin: 0;
  max-height: 280px;
  overflow: auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-hairline);
  background: var(--color-surface);
  padding: var(--space-md);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.logs-pre {
  background: #0f1419;
  color: #e8eef5;
  max-height: 360px;
}

.service-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: var(--space-xs);
}

.service-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  font-size: 13px;
}

.service-sub {
  display: block;
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 11px;
}

.state-pill {
  flex-shrink: 0;
  border-radius: var(--radius-full);
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-surface);
  color: var(--color-steel);
  text-transform: lowercase;
}

.state-pill[data-state*='running'] {
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.state-pill[data-state*='paused'] {
  background: #fff7e6;
  color: #b7791f;
}

.state-pill[data-state*='exited'],
.state-pill[data-state*='stopped'] {
  background: #fff1f1;
  color: var(--color-error);
}

.site-footer {
  margin-top: var(--space-section);
  padding-top: var(--space-xl);
  border-top: 1px solid var(--color-hairline);
  display: grid;
  gap: var(--space-sm);
  animation: rise 520ms ease both;
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-charcoal);
}

.footer-brand img {
  border-radius: var(--radius-sm);
}

.footer-copy,
.footer-meta {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
  max-width: 36rem;
}

.footer-meta {
  margin-top: var(--space-xs);
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

  .main-tabs {
    width: 100%;
  }

  .main-tab {
    flex: 1;
    text-align: center;
  }

  .text-input,
  .button-primary:not(.button-icon-only),
  .button-secondary:not(.button-icon-only) {
    min-height: 44px;
    height: 44px;
  }

  .button-icon-only {
    width: 40px;
    height: 40px;
    min-height: 40px;
  }

  .button-small {
    height: auto;
  }

  .editor-actions,
  .action-row {
    width: 100%;
  }

  .editor-actions > *,
  .action-row > * {
    flex: 1;
  }
}
</style>
