# Deploy sebagai systemd service (Linux)

## Prasyarat server

- Linux (Ubuntu/Debian/RHEL-like)
- Node.js 22+
- pnpm (atau script akan install via npm)
- Docker Engine + Compose plugin
- User service harus masuk group `docker` (script mengatur ini)

## Install cepat

Dari mesin yang sudah berisi source code:

```bash
sudo ./deploy/install-service.sh /opt/dicom-router
```

Jika Node terinstall via **nvm**, script akan menyalin Node ke
`/usr/local/lib/nodejs/...` + symlink `/usr/local/bin/node` agar user service
(`dicom`) bisa mengeksekusinya (binary di `/root/.nvm` tidak bisa diakses user lain).

```bash
sudo NODE_BIN=/root/.nvm/versions/node/v22.19.0/bin/node \
  ./deploy/install-service.sh /opt/dicom-router-downloader
```

### Perbaikan cepat (tanpa jalankan ulang install penuh)

Di server sebagai root:

```bash
NODE_SRC=/root/.nvm/versions/node/v22.19.0
rsync -a "$NODE_SRC/" /usr/local/lib/nodejs/v22.19.0/
chmod -R a+rX /usr/local/lib/nodejs/v22.19.0
ln -sfn /usr/local/lib/nodejs/v22.19.0/bin/node /usr/local/bin/node

# update unit
sed -i 's|ExecStart=/root/.nvm/versions/node/v22.19.0/bin/node|ExecStart=/usr/local/bin/node|' \
  /etc/systemd/system/dicom-router.service
sed -i 's|^ProtectHome=.*|ProtectHome=true|' /etc/systemd/system/dicom-router.service || true

systemctl daemon-reload
systemctl restart dicom-router
systemctl status dicom-router
```

Script akan:

1. Membuat user `dicom` (jika belum ada) + masukkan ke group `docker`
2. Sync project ke target dir
3. `pnpm install` + `pnpm build`
4. Pasang unit `/etc/systemd/system/dicom-router.service` (ExecStart pakai absolute Node path)
5. `enable` + `restart` service

## Perintah operasional

```bash
sudo systemctl status dicom-router
sudo systemctl restart dicom-router
sudo systemctl stop dicom-router
sudo journalctl -u dicom-router -f
```

## Konfigurasi

File env: `/opt/dicom-router/.env`

```env
AUTH_USERNAME=admin
AUTH_PASSWORD=ganti-password-kuat
AUTH_COOKIE_SECURE=false
```

`AUTH_COOKIE_SECURE=true` hanya jika akses via HTTPS. Di HTTP (LAN/IP:3000) biarkan `false`, kalau tidak cookie login tidak tersimpan dan halaman tetap di `/login`.

Setelah ubah `.env` yang dipakai **seeding pertama**, hapus DB lalu restart jika user belum terbuat ulang:

```bash
sudo systemctl stop dicom-router
sudo rm -f /opt/dicom-router/.data/auth.sqlite
sudo systemctl start dicom-router
```

## Manual (tanpa script)

```bash
sudo mkdir -p /opt/dicom-router
sudo rsync -a ./ /opt/dicom-router/ --exclude node_modules --exclude .output --exclude .nuxt
cd /opt/dicom-router
pnpm install --frozen-lockfile
pnpm build

sudo cp deploy/dicom-router.service /etc/systemd/system/
# sesuaikan path Node/User di unit bila perlu
sudo systemctl daemon-reload
sudo systemctl enable --now dicom-router
```

## Permission runtime (`public/compose`)

Service jalan sebagai user `dicom`. Folder ini harus writable:

```bash
sudo mkdir -p /opt/dicom-router-downloader/public/compose \
              /opt/dicom-router-downloader/.data
sudo chown -R dicom:dicom \
  /opt/dicom-router-downloader/public/compose \
  /opt/dicom-router-downloader/.data
sudo chmod -R u+rwX \
  /opt/dicom-router-downloader/public/compose \
  /opt/dicom-router-downloader/.data
```

Kalau muncul `EACCES: permission denied, open '.../public/compose/...'`, jalankan perintah di atas lalu retry di app.
