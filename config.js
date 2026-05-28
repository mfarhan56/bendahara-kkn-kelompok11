// Konfigurasi Aplikasi Bendahara KKN
const CONFIG = {
  // Kredensial Supabase
  // Jika dikosongkan, aplikasi akan meminta pengguna mengisi melalui Setup Wizard di browser.
  // Nilai yang diisi di sini akan menjadi nilai default aplikasi.
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // PIN Keamanan untuk mengakses mode Bendahara (menambah, mengedit, menghapus transaksi)
  DEFAULT_PIN: "1234",

  // Informasi Kelompok KKN (Akan dicetak di Kop Surat Laporan PDF, Word, & Excel)
  KKN_INFO: {
    NAMA_KKN: "KKN KELOMPOK 11",
    DESA: "Kapalo Padang",
    KECAMATAN: "Sungai Garinggiang",
    KABUPATEN: "Padang Pariaman",
    UNIVERSITAS: "Universitas Pembangunan Nasional",
    TAHUN: "2026",
    BENDAHARA_NAMA: "Farhan"
  },

  // Daftar Kategori Transaksi
  KATEGORI: {
    PEMASUKAN: [
      "Iuran Anggota",
      "Sponsor / Donatur",
      "Subsidi Kampus",
      "Hasil Usaha Mandiri",
      "Lain-lain"
    ],
    PENGELUARAN: [
      "Konsumsi & Makanan",
      "Transportasi & Bensin",
      "Perlengkapan & Dekorasi",
      "Program Kerja Utama",
      "Administrasi, Print & ATK",
      "Kesehatan & Obat-obatan",
      "Sosial / Sumbangan",
      "Lain-lain"
    ]
  }
};
