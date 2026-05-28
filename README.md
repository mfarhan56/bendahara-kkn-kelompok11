# Aplikasi Bendahara KKN (Keuangan Digital)

Aplikasi pencatatan keuangan KKN berbasis web yang modern, responsif, dan terhubung langsung ke database **Supabase**. Aplikasi ini dibuat menggunakan HTML, CSS (Vanilla), dan JavaScript murni, sehingga sangat ringan dan dapat langsung di-host di **GitHub Pages** secara gratis.

## Fitur Utama

- 📱 **Desain Sangat Responsif**: Optimal dibuka dari HP (Android/iOS) maupun laptop.
- 📊 **Dasbor Visual & Statistik**: Grafik aliran kas bulanan/harian serta kontribusi pengeluaran berdasarkan kategori.
- 🔒 **Sistem Hak Akses (Role)**:
  - **Anggota (Viewer)**: Bisa memantau saldo, melihat riwayat transaksi, melakukan filter, dan mencetak laporan tanpa perlu login.
  - **Bendahara (Editor)**: Bisa mengelola transaksi (Tambah, Edit, Hapus) menggunakan keamanan PIN.
- 📥 **Ekspor Laporan Lengkap**: Cetak laporan instan ke format **PDF (Kop Surat & Tanda Tangan)**, **Excel (XLSX)**, dan **Word (DOCX)**.
- ⚙️ **Setup Wizard**: Memudahkan konfigurasi Supabase langsung dari browser tanpa perlu mengedit file kode.

---

## Panduan Setup Database Supabase

Untuk menghubungkan aplikasi ini ke database Anda sendiri, ikuti langkah mudah berikut:

### 1. Buat Proyek Supabase Baru
1. Masuk ke [Supabase Dashboard](https://supabase.com) (Masuk dengan akun GitHub Anda).
2. Klik **New Project** dan pilih Organisasi Anda.
3. Masukkan nama proyek (misal: `Bendahara KKN`), tentukan kata sandi database Anda, dan pilih lokasi server terdekat (misalnya `Singapore`).
4. Klik **Create new project** dan tunggu beberapa menit hingga proses inisialisasi selesai.

### 2. Membuat Tabel Database
Setelah proyek siap, kita perlu membuat tabel `transaksi`.
1. Di menu sidebar kiri Supabase, klik **SQL Editor**.
2. Klik **New query** (atau tanda `+`).
3. Tempelkan (Copy-Paste) kode SQL di bawah ini:

```sql
-- Membuat tabel transaksi keuangan KKN
create table transaksi (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  tanggal date default current_date not null,
  tipe text not null check (tipe in ('pemasukan', 'pengeluaran')),
  kategori text not null,
  jumlah numeric not null check (jumlah > 0),
  keterangan text,
  petugas text default 'Bendahara'
);

-- Mengaktifkan Row Level Security (RLS)
alter table transaksi enable row level security;

-- Kebijakan RLS 1: Izinkan siapa saja (publik/anggota) untuk membaca data transaksi
create policy "Izinkan baca publik"
on transaksi for select
to anon
using (true);

-- Kebijakan RLS 2: Izinkan siapa saja dengan Anon Key untuk melakukan CRUD data transaksi
-- (Keamanan di sisi aplikasi akan menggunakan verifikasi PIN Bendahara)
create policy "Izinkan CRUD publik dengan anon key"
on transaksi for all
to anon
using (true)
with check (true);
```

4. Klik tombol **Run** di kanan bawah SQL Editor. Pastikan muncul tulisan `Success`.

### 3. Dapatkan Kredensial Supabase
1. Klik ikon **Settings** (roda gigi) di menu sidebar kiri bawah Supabase.
2. Pilih tab **API**.
3. Cari bagian **Project API Keys**:
   - Salin nilai **Project URL**.
   - Salin nilai **Project API Key (anon/public)**.
4. Anda dapat menempelkan URL dan Key ini langsung di file `config.js` pada kolom `SUPABASE_URL` dan `SUPABASE_ANON_KEY`, ATAU memasukkannya nanti melalui halaman web Setup Wizard saat pertama kali dibuka.

---

## Panduan Upload ke GitHub Pages (Hosting Gratis)

Setelah Anda memodifikasi file konfigurasi atau ingin mengunggah langsung dari repositori Anda:

1. Buat Repositori Baru di GitHub (misalnya beri nama `bendahara-kkn`).
2. Unggah file-file proyek ini (`index.html`, `style.css`, `config.js`, `app.js`, `export.js`) ke repositori tersebut.
3. Di halaman repositori GitHub Anda, buka menu **Settings** (Pengaturan).
4. Di sidebar kiri, klik menu **Pages**.
5. Pada bagian **Build and deployment**:
   - Di bawah **Source**, pilih **Deploy from a branch**.
   - Di bawah **Branch**, pilih branch utama Anda (biasanya `main` atau `master`), lalu folder `/ (root)`.
6. Klik **Save**.
7. Tunggu sekitar 1-2 menit. Segarkan halaman, dan GitHub akan memberikan tautan web Anda (misal: `https://username.github.io/bendahara-kkn/`).

Selesai! Sekarang seluruh anggota kelompok KKN Anda bisa membuka link tersebut langsung dari HP masing-masing untuk memantau keuangan secara real-time.
