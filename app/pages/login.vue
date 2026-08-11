<script setup>
import { LogIn } from '@lucide/vue'

definePageMeta({
  layout: false,
})

const route = useRoute()
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const fieldErrors = reactive({
  username: false,
  password: false,
})

const currentYear = new Date().getFullYear()

const canSubmit = computed(
  () => username.value.trim().length > 0 && password.value.length > 0 && !loading.value,
)

function clearError() {
  errorMessage.value = ''
}

async function submitLogin() {
  clearError()
  fieldErrors.username = !username.value.trim()
  fieldErrors.password = !password.value

  if (fieldErrors.username || fieldErrors.password) {
    errorMessage.value = 'Lengkapi username dan password.'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      body: {
        username: username.value.trim(),
        password: password.value,
      },
    })

    // Confirm cookie is actually usable before leaving /login
    const me = await $fetch('/api/auth/me', { credentials: 'include' })
    if (!me?.user) {
      throw new Error(
        'Login berhasil tapi session cookie tidak tersimpan. Pastikan akses HTTP/HTTPS sesuai AUTH_COOKIE_SECURE.',
      )
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    const target = redirect.startsWith('/') ? redirect : '/'
    // Hard navigation avoids stale SSR request headers in route middleware
    window.location.assign(target)
  } catch (error) {
    errorMessage.value =
      error?.data?.statusMessage ||
      error?.statusMessage ||
      error?.message ||
      'Login gagal'
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
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
    </header>

    <main class="hero">
      <p class="eyebrow">Akses terbatas</p>
      <h1 class="brand-title">
        <img
          class="title-logo"
          src="/logo-lungs.png"
          alt=""
          width="48"
          height="48"
          aria-hidden="true"
        >
        Login
      </h1>
      <p class="lede">
        Masuk untuk mengelola download, editor, dan deploy DICOM Router.
      </p>

      <form class="panel" @submit.prevent="submitLogin">
        <label class="field">
          <span class="label">Email</span>
          <input
            v-model="username"
            class="text-input"
            :class="{ error: fieldErrors.username }"
            type="text"
            autocomplete="username"
            placeholder="email@example.com"
            @input="fieldErrors.username = false; clearError()"
          >
        </label>

        <label class="field">
          <span class="label">Password</span>
          <input
            v-model="password"
            class="text-input"
            :class="{ error: fieldErrors.password }"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            @input="fieldErrors.password = false; clearError()"
          >
        </label>

        <p v-if="errorMessage" class="alert alert-error" role="alert">
          {{ errorMessage }}
        </p>

        <button
          class="button-primary"
          type="submit"
          :disabled="!canSubmit"
          :aria-label="loading ? 'Sedang masuk' : 'Login'"
          :title="loading ? 'Sedang masuk…' : 'Login'"
        >
          <span v-if="loading" class="spinner" aria-hidden="true" />
          <LogIn v-else :size="20" :stroke-width="2" aria-hidden="true" />
          Login
        </button>

        <!-- <p class="fineprint">
          Default pertama kali: <code>admin</code> / <code>admin123</code>
          (ubah lewat <code>AUTH_USERNAME</code> &amp; <code>AUTH_PASSWORD</code>).
        </p> -->
      </form>
    </main>

    <footer class="site-footer">
      <p class="footer-meta">© {{ currentYear }} DICOM Router · SATUSEHAT</p>
    </footer>
  </div>
</template>

<style scoped>
.login-page {
  width: min(100%, 520px);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-xxl) var(--space-section);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-height: 56px;
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.brand-word {
  font-size: 14px;
  font-weight: 600;
}

.badge-code {
  margin-left: auto;
  background: var(--color-brand-blue-200);
  color: var(--color-brand-blue-deep);
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}

.hero {
  padding-top: clamp(40px, 8vw, 72px);
  flex: 1;
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
  font-size: clamp(36px, 7vw, 56px);
  font-weight: 600;
  letter-spacing: -1.5px;
}

.title-logo {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  object-fit: cover;
}

.lede {
  margin: var(--space-md) 0 0;
  color: var(--color-steel);
  font-size: 16px;
  line-height: 1.5;
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
}

.field {
  display: grid;
  gap: var(--space-xs);
}

.label {
  color: var(--color-charcoal);
  font-size: 13px;
  font-weight: 600;
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
  cursor: pointer;
}

.button-icon-only {
  width: 48px;
  height: 48px;
  min-height: 48px;
  padding: 0;
  justify-self: start;
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
}

.alert-error {
  background: #fff1f1;
  color: var(--color-error);
  border: 1px solid #f0c4c4;
}

.fineprint {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
}

.fineprint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: var(--color-surface);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
}

.site-footer {
  margin-top: var(--space-xxl);
  padding-top: var(--space-xl);
  border-top: 1px solid var(--color-hairline);
}

.footer-meta {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 767px) {
  .login-page {
    padding: var(--space-md);
  }

  .panel {
    padding: var(--space-xl);
  }

  .text-input {
    min-height: 44px;
    height: 44px;
  }

  .button-icon-only {
    width: 48px;
    height: 48px;
  }
}
</style>
