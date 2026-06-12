# Coffee Shop QR Ordering + Supabase + Midtrans QRIS

Aplikasi React TS + Vite untuk order coffee shop berbasis QR, validasi radius lokasi, CRUD produk, dashboard barista realtime, dan pembayaran QRIS dinamis Midtrans.

## Fitur

- Customer order dari halaman `/`
- Validasi radius GPS customer
- CRUD produk di `/products`
- Dashboard barista di `/barista`
- QR halaman outlet di `/qr`
- Pembayaran QRIS dinamis Midtrans di `/payment/:id`
- Webhook Midtrans untuk update otomatis `payment_status = paid`

## Setup Frontend

```bash
cp .env.example .env
npm install
npm run dev
```

Isi `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_STORE_NAME=Kopi Radius
VITE_STORE_LAT=-6.200000
VITE_STORE_LNG=106.816666
VITE_ACCESS_RADIUS_METER=150
VITE_ADMIN_PIN=123456
```

## Setup Database Supabase

Jalankan file berikut di Supabase SQL Editor:

```bash
supabase/schema.sql
```

Aktifkan Realtime untuk tabel:

- `orders`
- `order_items`

## Setup Supabase Edge Function Midtrans

Install Supabase CLI, login, lalu link project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Set secret function:

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set MIDTRANS_SERVER_KEY=SB-Mid-server-YOUR_SANDBOX_SERVER_KEY
supabase secrets set MIDTRANS_IS_PRODUCTION=false
supabase secrets set MIDTRANS_QRIS_ACQUIRER=gopay
supabase secrets set MIDTRANS_NOTIFICATION_URL=https://YOUR_PROJECT.supabase.co/functions/v1/midtrans-webhook
```

Deploy function:

```bash
supabase functions deploy midtrans-create-qris --no-verify-jwt
supabase functions deploy midtrans-webhook --no-verify-jwt
```

Webhook URL yang dipakai Midtrans:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/midtrans-webhook
```

Function `midtrans-create-qris` membuat transaksi QRIS Midtrans. Function `midtrans-webhook` menerima notifikasi Midtrans, validasi signature, lalu update order menjadi `paid`, `unpaid`, atau `rejected`.

## Flow Payment

1. Customer membuat order.
2. Customer diarahkan ke `/payment/:id`.
3. Frontend memanggil Supabase Edge Function `midtrans-create-qris`.
4. Edge Function membuat charge QRIS ke Midtrans.
5. Customer scan QRIS dan bayar.
6. Midtrans mengirim webhook ke `midtrans-webhook`.
7. Supabase update `payment_status` otomatis.
8. Dashboard barista menerima update realtime.

## Production Notes

- Jangan taruh `MIDTRANS_SERVER_KEY` di frontend.
- Gunakan `MIDTRANS_IS_PRODUCTION=true` hanya setelah akun Midtrans production aktif.
- Pastikan QRIS sudah aktif di dashboard Midtrans.
- Pastikan URL function dapat diakses publik.
- Untuk production, perketat RLS/policy sesuai role user.
