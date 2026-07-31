# Kasir · Cahaya Putra Fiberglass

Aplikasi kasir untuk jasa custom & cetak fiberglass. Data transaksi tersimpan permanen di Supabase.

## 1. Buat tabel di Supabase

Buka project Supabase kamu → menu **SQL Editor** → jalankan query ini:

```sql
create table transaksi (
  id bigint generated always as identity primary key,
  no_struk bigint,
  items jsonb,
  subtotal numeric,
  discount_pct numeric,
  discount_amt numeric,
  total numeric,
  metode_bayar text,
  cash numeric,
  kembalian numeric,
  created_at timestamptz default now()
);

alter table transaksi enable row level security;

create policy "allow all access"
on transaksi
for all
using (true)
with check (true);
```

> Catatan keamanan: policy di atas mengizinkan siapa saja dengan anon key membaca & menulis tabel ini — cukup untuk toko internal, tapi jangan sebar anon key ke publik luas. Kalau butuh login kasir/keamanan lebih ketat, bisa ditambah Supabase Auth belakangan.

## 2. Isi kredensial

Salin `.env.example` jadi `.env`, lalu isi dengan **Project URL** dan **anon public key** dari Supabase (menu Settings → API):

```
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=isi-dengan-anon-public-key-kamu
```

## 3. Coba jalankan di komputer sendiri (opsional)

```bash
npm install
npm run dev
```

Buka alamat yang muncul di terminal (biasanya `http://localhost:5173`).

## 4. Upload ke GitHub

1. Buat repository baru di github.com
2. Upload semua file folder ini ke repository tersebut (drag & drop lewat web, atau `git push` kalau familiar)

## 5. Deploy ke Vercel

1. Daftar/masuk ke vercel.com pakai akun GitHub
2. **Add New → Project** → pilih repository yang tadi diupload
3. Di bagian **Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (isi sama seperti di file `.env`)
4. Klik **Deploy**

Setelah selesai, kamu dapat alamat website sendiri (contoh: `kasir-cahaya-putra.vercel.app`) yang bisa dibuka dari HP atau laptop mana saja, dan semua transaksi tersimpan permanen di Supabase.
