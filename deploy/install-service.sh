#!/usr/bin/env bash
set -euo pipefail

# Install / update DICOM Router as a systemd service on Linux.
# Usage (as root):
#   ./deploy/install-service.sh [/opt/dicom-router]
#   NODE_BIN=/root/.nvm/versions/node/v22.19.0/bin/node ./deploy/install-service.sh /opt/dicom-router-downloader

APP_DIR="${1:-/opt/dicom-router}"
SERVICE_NAME="dicom-router"
SERVICE_USER="${SERVICE_USER:-dicom}"
SERVICE_GROUP="${SERVICE_GROUP:-dicom}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYSTEM_NODE_ROOT="${SYSTEM_NODE_ROOT:-/usr/local/lib/nodejs}"

resolve_node_bin() {
  if [[ -n "${NODE_BIN:-}" && -x "${NODE_BIN}" ]]; then
    echo "${NODE_BIN}"
    return 0
  fi

  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  local nvm_dirs=(
    "/root/.nvm/versions/node"
    "${HOME}/.nvm/versions/node"
  )

  for nvm_sh in /root/.nvm/nvm.sh "${HOME}/.nvm/nvm.sh"; do
    if [[ -f "${nvm_sh}" ]]; then
      # shellcheck disable=SC1090
      source "${nvm_sh}" >/dev/null 2>&1 || true
      if command -v node >/dev/null 2>&1; then
        command -v node
        return 0
      fi
    fi
  done

  for base in "${nvm_dirs[@]}"; do
    if [[ -d "${base}" ]]; then
      local latest
      latest="$(ls -1 "${base}" 2>/dev/null | sort -V | tail -n 1 || true)"
      if [[ -n "${latest}" && -x "${base}/${latest}/bin/node" ]]; then
        echo "${base}/${latest}/bin/node"
        return 0
      fi
    fi
  done

  for path in \
    /usr/local/bin/node \
    /usr/bin/node \
    /root/.nvm/versions/node/v22.19.0/bin/node
  do
    if [[ -x "${path}" ]]; then
      echo "${path}"
      return 0
    fi
  done

  return 1
}

# User `dicom` cannot execute binaries under /root (mode 700).
# Copy the NVM Node distribution to a world-traversable system path.
install_system_node_from_nvm() {
  local src_bin="$1"
  local src_prefix
  src_prefix="$(cd "$(dirname "${src_bin}")/.." && pwd)"
  local version
  version="$(basename "${src_prefix}")"
  local dest="${SYSTEM_NODE_ROOT}/${version}"

  echo "==> Menyalin Node ${version} dari NVM ke ${dest}"
  mkdir -p "${SYSTEM_NODE_ROOT}"
  rsync -a --delete "${src_prefix}/" "${dest}/"
  chmod -R a+rX "${dest}"

  ln -sfn "${dest}/bin/node" /usr/local/bin/node
  [[ -x "${dest}/bin/npm" ]] && ln -sfn "${dest}/bin/npm" /usr/local/bin/npm
  [[ -x "${dest}/bin/npx" ]] && ln -sfn "${dest}/bin/npx" /usr/local/bin/npx
  [[ -x "${dest}/bin/corepack" ]] && ln -sfn "${dest}/bin/corepack" /usr/local/bin/corepack

  echo "/usr/local/bin/node"
}

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Jalankan sebagai root: sudo $0 ${APP_DIR}" >&2
  exit 1
fi

NODE_BIN="$(resolve_node_bin || true)"
if [[ -z "${NODE_BIN}" || ! -x "${NODE_BIN}" ]]; then
  cat >&2 <<'EOF'
Node.js tidak ditemukan.

Opsi:
  sudo NODE_BIN=/root/.nvm/versions/node/v22.19.0/bin/node \
    ./deploy/install-service.sh /opt/dicom-router-downloader
EOF
  exit 1
fi

# Always prefer a system-visible Node for the service user
if [[ "${NODE_BIN}" == /root/* || "${NODE_BIN}" == /home/*/.nvm/* ]]; then
  NODE_BIN="$(install_system_node_from_nvm "${NODE_BIN}")"
fi

NODE_DIR="$(dirname "${NODE_BIN}")"
# Prefer the real prefix bin dir (not just /usr/local/bin symlink folder)
if [[ -L "${NODE_BIN}" ]]; then
  REAL_NODE="$(readlink -f "${NODE_BIN}" 2>/dev/null || readlink "${NODE_BIN}")"
  if [[ -n "${REAL_NODE}" && -x "${REAL_NODE}" ]]; then
    NODE_DIR="$(dirname "${REAL_NODE}")"
  fi
fi
export PATH="${NODE_DIR}:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI tidak ditemukan. Install Docker Engine + Compose plugin dulu." >&2
  exit 1
fi

echo "==> App dir: ${APP_DIR}"
echo "==> Node:    ${NODE_BIN} ($("${NODE_BIN}" -v))"
echo "==> PATH+:   ${NODE_DIR}"
echo "==> User:    ${SERVICE_USER}"

if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  echo "==> Membuat user ${SERVICE_USER}"
  useradd --system --create-home --home-dir "/var/lib/${SERVICE_USER}" \
    --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

if getent group docker >/dev/null 2>&1; then
  usermod -aG docker "${SERVICE_USER}"
fi

mkdir -p "${APP_DIR}"
echo "==> Sync source ke ${APP_DIR}"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.nuxt' \
  --exclude '.output' \
  --exclude '.data' \
  --exclude 'public/compose' \
  "${REPO_ROOT}/" "${APP_DIR}/"

mkdir -p "${APP_DIR}/.data" "${APP_DIR}/public/compose"
# Runtime write paths must stay owned by the service user
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}/.data" "${APP_DIR}/public/compose"
chmod -R u+rwX "${APP_DIR}/.data" "${APP_DIR}/public/compose"

if [[ ! -f "${APP_DIR}/.env" ]]; then
  if [[ -f "${APP_DIR}/.env.example" ]]; then
    cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
    echo "==> Dibuat ${APP_DIR}/.env dari .env.example — ubah AUTH_PASSWORD!"
  else
    cat > "${APP_DIR}/.env" <<'EOF'
AUTH_USERNAME=admin
AUTH_PASSWORD=admin123
EOF
    echo "==> Dibuat ${APP_DIR}/.env default — ubah AUTH_PASSWORD!"
  fi
fi

echo "==> Install dependencies + build"
cd "${APP_DIR}"

if [[ -x "${NODE_DIR}/corepack" ]]; then
  "${NODE_DIR}/corepack" enable >/dev/null 2>&1 || true
elif command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if [[ -x "${NODE_DIR}/npm" ]]; then
    "${NODE_DIR}/npm" install -g pnpm@11.15.1
  elif command -v npm >/dev/null 2>&1; then
    npm install -g pnpm@11.15.1
  else
    echo "pnpm/npm tidak ditemukan" >&2
    exit 1
  fi
fi

PNPM_BIN="$(command -v pnpm)"

chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}"
sudo -u "${SERVICE_USER}" -H env "PATH=${NODE_DIR}:/usr/local/bin:/usr/bin:/bin" bash -lc "
  set -euo pipefail
  cd '${APP_DIR}'
  '${PNPM_BIN}' install --frozen-lockfile
  '${PNPM_BIN}' build
"

UNIT_SRC="${APP_DIR}/deploy/dicom-router.service"
UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"
echo "==> Install unit ${UNIT_DST}"

NODE_BIN_ESC="$(escape_sed "${NODE_BIN}")"
NODE_DIR_ESC="$(escape_sed "${NODE_DIR}")"
APP_DIR_ESC="$(escape_sed "${APP_DIR}")"

sed \
  -e "s|/opt/dicom-router|${APP_DIR_ESC}|g" \
  -e "s|^User=dicom|User=${SERVICE_USER}|g" \
  -e "s|^Group=dicom|Group=${SERVICE_GROUP}|g" \
  -e "s|^ExecStart=/usr/bin/node|ExecStart=${NODE_BIN_ESC}|g" \
  -e "s|^Environment=PATH=.*|Environment=PATH=${NODE_DIR_ESC}:/usr/local/bin:/usr/bin:/bin|g" \
  "${UNIT_SRC}" > "${UNIT_DST}"

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service"
systemctl restart "${SERVICE_NAME}.service"

sleep 1
systemctl --no-pager --full status "${SERVICE_NAME}.service" || true

echo
echo "Selesai."
echo "  URL     : http://$(hostname -I 2>/dev/null | awk '{print $1}'):3000"
echo "  Status  : systemctl status ${SERVICE_NAME}"
echo "  Logs    : journalctl -u ${SERVICE_NAME} -f"
echo "  Restart : systemctl restart ${SERVICE_NAME}"
echo "  Env     : ${APP_DIR}/.env"
echo "  Node    : ${NODE_BIN}"
