# DICOM Router Downloader

Tool sederhana berbasis **Nuxt 4 (JavaScript)** untuk mengunduh `docker-compose.zip` terbaru DICOM Router SATUSEHAT tanpa Postman.

## Fitur v1

- Pilih environment: Sandbox / Production
- Input Client ID + Client Secret
- Server meminta OAuth token lalu mengunduh file dari API SATUSEHAT
- Credential tidak disimpan

## Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## API

`POST /api/download`

```json
{
  "environment": "sandbox",
  "clientId": "...",
  "clientSecret": "..."
}
```

Response: file zip (`docker-compose.zip`).

## Design

UI mengikuti `DESIGN.md` (template MiniMax dari getdesign.md).
