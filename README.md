# DICOM Router Downloader

Tool berbasis **Nuxt 4 (JavaScript)** untuk mengunduh, mengedit, dan men-deploy `docker-compose` DICOM Router SATUSEHAT tanpa Postman.

## Fitur

- Login sederhana (SQLite + session cookie)
- Pilih environment: Sandbox / Production
- Input Client ID + Client Secret → server minta OAuth token lalu unduh zip
- Simpan & unzip ke `public/compose` (di-gitignore)
- Editor di UI untuk `docker-compose.yml` **dan** `router.conf`
- Deploy dengan `docker compose up -d` di host yang sama
- Status container: pause / unpause / stop / start + logs

## Prasyarat

- Node.js + pnpm
- Docker Engine + plugin Compose di mesin yang sama dengan Nuxt
- Proses Node harus punya akses ke Docker socket (`/var/run/docker.sock`)

## Menjalankan (dev)

```bash
cp .env.example .env   # opsional, ubah password default
pnpm install
pnpm dev
```

Buka `http://localhost:3000` → login.

## Menjalankan sebagai service (Linux production)

Unit systemd + installer ada di folder [`deploy/`](deploy/):

```bash
sudo ./deploy/install-service.sh /opt/dicom-router
```

Detail: [`deploy/README.md`](deploy/README.md).

```bash
sudo systemctl status dicom-router
sudo journalctl -u dicom-router -f
```

Production manual:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start   # node .output/server/index.mjs
```

Default user (hanya saat DB kosong pertama kali):

- username: `admin`
- password: `admin123`

User disimpan di `.data/auth.sqlite`. Untuk reset user, hapus file itu lalu restart app.

## API

Semua endpoint (kecuali `/api/auth/*`) membutuhkan session login.

### Auth

- `POST /api/auth/login` `{ "username", "password" }`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### `POST /api/download`

Default: simpan zip ke `public/compose` lalu unzip (response JSON).

```json
{
  "environment": "sandbox",
  "clientId": "...",
  "clientSecret": "..."
}
```

Opsional `"mode": "browser"` untuk unduh zip ke browser.

### `GET /api/compose` / `PUT /api/compose`

Baca / simpan `docker-compose.yml` dan `router.conf`.

### `POST /api/deploy` / `GET /api/deploy`

Deploy dan cek status container.

### Container control

- `POST /api/container/stop|pause|unpause|start`
- `GET /api/container/logs?tail=50`

## Keamanan

- Login wajib untuk UI dan API.
- `public/compose` di-gitignore dan diblokir dari static HTTP (`/compose/**` → 404).
- Password di-hash (scrypt). Session httpOnly cookie, 7 hari.
- Tetap batasi akses jaringan ke server.

## Design

UI mengikuti `DESIGN.md` (template MiniMax dari getdesign.md).
