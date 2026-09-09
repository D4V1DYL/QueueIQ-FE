# QueueIQ

Frontend demo dengan landing page animasi dan dashboard antrean request belanja.

## Menjalankan

Gunakan Node.js 22.13 atau lebih baru.

```sh
npm install
npm run dev
npm run build
node --experimental-strip-types tests/queue.test.ts
```

- `/`: landing page, animasi dengan tombol jeda dan dukungan reduced motion.
- `/dashboard`: membuat request, filter/pencarian, pagination, detail, proses, selesai, batalkan, ekspor CSV.
- Data contoh dibuat sekali, kemudian tersimpan di localStorage dengan kunci `queueiq-demo-v1`.
- Tidak ada autentikasi aplikasi, pembayaran, pemesanan eksternal, atau sinkronisasi server. Semua perubahan adalah simulasi pada browser yang sama.

## Integrasi backend berikutnya

Model domain dan validasi berada di `lib/queue.ts`. Dashboard memakai `commit()` untuk menyimpan hasil aksi domain ke localStorage. Ganti lapisan baca/simpan tersebut dengan adapter API, pertahankan validasi pada server, gunakan ID dari server, dan terapkan transaksi/concurrency control.

Kontrak yang disarankan (belum diimplementasikan): `GET /api/requests`, `POST /api/requests`, `PATCH /api/requests/:id/status`, dan `GET /api/activity`. Anggaran dalam rupiah. Status: Menunggu, Diproses, Selesai, Dibatalkan. Status terminal tidak bisa diproses kembali.

## Validasi

Tes domain memeriksa pembuatan request, validasi masukan, prioritas antrean, transisi status, pembatalan, serialisasi penyimpanan, dan penolakan data rusak. Browser visual/interaction QA belum dilakukan. WebMCP memakai feature detection; belum diverifikasi dalam runtime WebMCP yang mendukungnya.
