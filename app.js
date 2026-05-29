// State Aplikasi
let supabaseClient = null;
let isDemoMode = false;
let isBendaharaMode = false;
let allTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
const itemsPerPage = 8;

// Instances Grafik
let cashFlowChartInstance = null;
let categoryChartInstance = null;

// Langkah Setup Wizard
let setupCurrentStep = 1;
let loadingTimeoutId = null;

// ==================== INITIALIZATION ====================

// Menjalankan inisialisasi aplikasi secara aman setelah DOM siap (mencegah race condition di mobile)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initApp() {
  try {
    // Inisialisasi Icons secara aman
    safeCreateIcons();
    
    // Terapkan Tema yang Disimpan
    initTheme();

    // Muat Informasi KKN dari Config
    loadKknInfo();

    // Muat Pilihan Kategori di Dropdown Filter & Modal Form
    initCategories();

    // Inisialisasi format ribuan live pada input nominal
    initAmountInputFormatter();

    // Periksa Koneksi Database Supabase
    checkDatabaseConnection();
  } catch (error) {
    console.error("Kritis: Gagal menginisialisasi aplikasi:", error);
    showLoading(false);
    showToast("Kesalahan Sistem", "Gagal memuat beberapa komponen aplikasi.", "error");
  }
}

// Wrapper aman untuk membuat ikon Lucide guna menghindari crash jika CDN lambat/gagal
function safeCreateIcons() {
  if (typeof lucide !== 'undefined') {
    try {
      lucide.createIcons();
    } catch (e) {
      console.warn("Gagal membuat ikon Lucide:", e);
    }
  } else {
    console.warn("Pustaka Lucide tidak termuat.");
  }
}

// Load Info KKN dari CONFIG
function loadKknInfo() {
  if (typeof CONFIG !== 'undefined' && CONFIG.KKN_INFO) {
    document.getElementById('kkn-title-nav').innerText = CONFIG.KKN_INFO.NAMA_KKN;
    document.getElementById('kkn-desc-nav').innerText = `Desa ${CONFIG.KKN_INFO.DESA}, Kec. ${CONFIG.KKN_INFO.KECAMATAN} - ${CONFIG.KKN_INFO.TAHUN}`;
    document.getElementById('kkn-header-name').innerText = `Laporan Keuangan - Desa ${CONFIG.KKN_INFO.DESA}`;
  }
}

// Inisialisasi Kategori
function initCategories() {
  updateFilterCategories();
}

// Inisialisasi & Ganti Tema
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  const body = document.body;
  const themeBtn = document.getElementById('btn-theme-toggle');

  if (savedTheme === 'dark') {
    body.classList.add('dark-theme');
    themeBtn.innerHTML = '<i data-lucide="sun"></i>';
  } else {
    body.classList.remove('dark-theme');
    themeBtn.innerHTML = '<i data-lucide="moon"></i>';
  }
  safeCreateIcons();

  themeBtn.addEventListener('click', () => {
    if (body.classList.contains('dark-theme')) {
      body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
      themeBtn.innerHTML = '<i data-lucide="moon"></i>';
    } else {
      body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
      themeBtn.innerHTML = '<i data-lucide="sun"></i>';
    }
    safeCreateIcons();
    // Re-render charts to adjust text colors
    renderCharts();
  });
}

// ==================== SUPABASE CONNECTION & SETUP ====================

async function checkDatabaseConnection() {
  showLoading(true, "Menghubungkan ke database...");
  
  let url = CONFIG.SUPABASE_URL;
  let key = CONFIG.SUPABASE_ANON_KEY;
  
  // Jika config kosong, coba baca dari localStorage
  if (!url || !key) {
    url = localStorage.getItem('supabase_url');
    key = localStorage.getItem('supabase_anon_key');
  }

  const demoModeFlag = localStorage.getItem('demo_mode') === 'true';

  if (demoModeFlag) {
    // Mode demo diaktifkan
    isDemoMode = true;
    showLoading(false);
    showToast("Mode Demo Aktif", "Menggunakan database lokal di browser Anda.", "warning");
    updateRoleBadgeUI();
    loadTransactions().catch(err => console.error("Gagal memuat transaksi demo:", err));
    return;
  }

  if (!url || !key) {
    // Tidak ada konfigurasi, buka Setup Wizard
    showLoading(false);
    openSetupWizard();
    return;
  }

  try {
    // Inisialisasi Supabase
    supabaseClient = supabase.createClient(url, key);
    
    // Langsung ambil data transaksi (sekaligus menguji koneksi) untuk menghemat 1 network roundtrip
    await loadTransactions();
    
    // Koneksi Sukses
    isDemoMode = false;
    showToast("Terhubung!", "Koneksi ke database Supabase berhasil.", "success");
    updateRoleBadgeUI();
  } catch (err) {
    console.error("Koneksi gagal:", err);
    showLoading(false);
    showToast("Koneksi Gagal", "Gagal menghubungi database. Periksa kredensial Anda.", "error");
    openSetupWizard();
  }
}

// Setup Wizard Modal Functions
function openSetupWizard() {
  document.getElementById('modal-setup-wizard').classList.add('active');
  setupCurrentStep = 1;
  showSetupStep(1);
}

function showSetupStep(step) {
  document.querySelectorAll('.setup-step').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
  
  // Update indicators
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.className = 'progress-dot';
    if (i < step) dot.classList.add('completed');
    if (i === step) dot.classList.add('active');
  }

  // Buttons
  document.getElementById('btn-setup-back').style.display = step > 1 ? 'block' : 'none';
  document.getElementById('btn-setup-next').innerText = step === 3 ? 'Hubungkan & Selesai' : 'Lanjut';
}

function setupNextStep() {
  if (setupCurrentStep < 3) {
    setupCurrentStep++;
    showSetupStep(setupCurrentStep);
  } else {
    // Simpan & Hubungkan
    saveSetupCredentials();
  }
}

function setupPrevStep() {
  if (setupCurrentStep > 1) {
    setupCurrentStep--;
    showSetupStep(setupCurrentStep);
  }
}

function copySqlScript() {
  const code = document.getElementById('sql-code-script').innerText;
  navigator.clipboard.writeText(code).then(() => {
    showToast("Disalin!", "Skrip SQL berhasil disalin ke clipboard.", "success");
  });
}

async function saveSetupCredentials() {
  const url = document.getElementById('setup-supabase-url').value.trim();
  const key = document.getElementById('setup-supabase-key').value.trim();

  if (!url || !key) {
    showToast("Error", "URL dan Key Supabase harus diisi!", "error");
    return;
  }

  showLoading(true, "Menguji koneksi database...");

  try {
    const client = supabase.createClient(url, key);
    const { data, error } = await client.from('transaksi').select('id').limit(1);

    if (error) throw error;

    // Sukses
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_anon_key', key);
    localStorage.removeItem('demo_mode');
    
    supabaseClient = client;
    isDemoMode = false;

    document.getElementById('modal-setup-wizard').classList.remove('active');
    showLoading(false);
    showToast("Berhasil Terhubung!", "Database Supabase berhasil dikonfigurasi.", "success");
    
    updateRoleBadgeUI();
    loadTransactions();
  } catch (err) {
    console.error("Gagal verifikasi setup:", err);
    showLoading(false);
    showToast("Koneksi Gagal", "Gagal terhubung dengan data tersebut. Cek URL/Key & pastikan SQL sudah di-Run.", "error");
  }
}

function switchToDemoMode() {
  localStorage.setItem('demo_mode', 'true');
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_anon_key');
  isDemoMode = true;
  supabaseClient = null;

  // Isi data contoh jika kosong di localStorage
  const savedDemo = localStorage.getItem('demo_transactions');
  if (!savedDemo) {
    const dummy = [
      { id: "1", tanggal: getOffsetDate(-10), tipe: "pemasukan", kategori: "Iuran Anggota", jumlah: 450000, keterangan: "Iuran kas KKN minggu pertama (15 anggota)", petugas: "Farhan" },
      { id: "2", tanggal: getOffsetDate(-9), tipe: "pemasukan", kategori: "Subsidi Kampus", jumlah: 1000000, keterangan: "Dana bantuan awal dari LPPM Universitas", petugas: "Farhan" },
      { id: "3", tanggal: getOffsetDate(-7), tipe: "pengeluaran", kategori: "Administrasi, Print & ATK", jumlah: 125000, keterangan: "Print proposal kegiatan dan beli map", petugas: "Farhan" },
      { id: "4", tanggal: getOffsetDate(-6), tipe: "pengeluaran", kategori: "Transportasi & Bensin", jumlah: 75000, keterangan: "Bensin motor untuk survei lokasi posko", petugas: "Budi" },
      { id: "5", tanggal: getOffsetDate(-5), tipe: "pengeluaran", kategori: "Konsumsi & Makanan", jumlah: 380000, keterangan: "Konsumsi rapat koordinasi dengan aparat desa Sukamaju", petugas: "Farhan" },
      { id: "6", tanggal: getOffsetDate(-3), tipe: "pemasukan", kategori: "Sponsor / Donatur", jumlah: 500000, keterangan: "Sponsorship dari Toko Kelontong Berkah", petugas: "Farhan" },
      { id: "7", tanggal: getOffsetDate(-2), tipe: "pengeluaran", kategori: "Program Kerja Utama", jumlah: 600000, keterangan: "Beli bibit pohon untuk program kerja penghijauan", petugas: "Siti" },
      { id: "8", tanggal: getOffsetDate(0), tipe: "pengeluaran", kategori: "Kesehatan & Obat-obatan", jumlah: 95000, keterangan: "Beli obat P3K posko KKN", petugas: "Siti" }
    ];
    localStorage.setItem('demo_transactions', JSON.stringify(dummy));
  }

  document.getElementById('modal-setup-wizard').classList.remove('active');
  showToast("Mode Demo Aktif", "Menjalankan aplikasi dalam mode demo offline.", "warning");
  updateRoleBadgeUI();
  loadTransactions();
}

function getOffsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Reset Database/Setup Connection
function resetConnectionSettings() {
  if (confirm("Apakah Anda ingin menghapus konfigurasi koneksi database Anda? Aplikasi akan kembali ke Setup Wizard.")) {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_anon_key');
    localStorage.removeItem('demo_mode');
    localStorage.removeItem('demo_transactions');
    location.reload();
  }
}

// ==================== ROLE & PIN VERIFICATION ====================

function openRoleModal() {
  if (isBendaharaMode) {
    // Logout dari mode bendahara ke anggota
    isBendaharaMode = false;
    updateRoleBadgeUI();
    showToast("Akses Ditutup", "Anda kembali sebagai Anggota (Viewer).", "info");
    loadTransactions(); // Reload agar tabel aksi hilang
  } else {
    // Tampilkan modal PIN
    document.getElementById('input-pin-auth').value = "";
    document.getElementById('auth-error-msg').style.display = "none";
    document.getElementById('modal-role-pin').classList.add('active');
    document.getElementById('input-pin-auth').focus();
  }
}

function closeRoleModal() {
  document.getElementById('modal-role-pin').classList.remove('active');
}

function verifyPin() {
  const pinInput = document.getElementById('input-pin-auth').value.trim();
  const correctPin = (typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_PIN : '1234');

  if (pinInput === correctPin) {
    isBendaharaMode = true;
    closeRoleModal();
    updateRoleBadgeUI();
    showToast("Akses Diberikan", "Mode Bendahara diaktifkan. Anda sekarang bisa mengubah data.", "success");
    loadTransactions(); // Reload agar tombol edit/hapus tampil
  } else {
    document.getElementById('auth-error-msg').style.display = "block";
    document.getElementById('input-pin-auth').value = "";
    document.getElementById('input-pin-auth').focus();
  }
}

// Update Tampilan Badge Role
function updateRoleBadgeUI() {
  const badge = document.getElementById('btn-role-badge');
  const roleText = document.getElementById('role-text');
  
  if (isBendaharaMode) {
    badge.className = 'role-badge bendahara';
    roleText.innerText = 'Bendahara (Editor)';
    badge.innerHTML = '<i data-lucide="shield-check"></i> <span id="role-text">Bendahara (Editor)</span>';
  } else {
    badge.className = 'role-badge';
    roleText.innerText = 'Anggota (Viewer)';
    badge.innerHTML = '<i data-lucide="user"></i> <span id="role-text">Anggota (Viewer)</span>';
  }
  safeCreateIcons();
}

// ==================== TRANSACTIONS CRUD ====================

async function loadTransactions() {
  showLoading(true, "Mengambil data transaksi...");

  try {
    if (isDemoMode) {
      const stored = localStorage.getItem('demo_transactions');
      allTransactions = stored ? JSON.parse(stored) : [];
    } else {
      // Ambil dari Supabase urut tanggal terbaru
      const { data, error } = await supabaseClient
        .from('transaksi')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      allTransactions = data || [];
    }

    // Perbarui pilihan kategori filter dari transaksi terbaru
    updateFilterCategories();

    applyFilters();
  } catch (err) {
    console.error("Gagal memuat transaksi:", err);
    showToast("Gagal Memuat Data", "Gagal mengambil riwayat transaksi dari database.", "error");
    throw err; // Lempar ulang agar ditangkap pemanggil (seperti checkDatabaseConnection)
  } finally {
    showLoading(false);
  }
}

// Filter, Search, & Pagination
function applyFilters() {
  const searchQuery = document.getElementById('filter-search').value.toLowerCase().trim();
  const selectedCat = document.getElementById('filter-category').value;
  const selectedType = document.getElementById('filter-type').value;
  const dateStart = document.getElementById('filter-date-start').value;
  const dateEnd = document.getElementById('filter-date-end').value;

  filteredTransactions = allTransactions.filter(tx => {
    // Search Filter
    const matchesSearch = searchQuery === "" || 
      (tx.keterangan && tx.keterangan.toLowerCase().includes(searchQuery)) ||
      (tx.petugas && tx.petugas.toLowerCase().includes(searchQuery)) ||
      (tx.kategori && tx.kategori.toLowerCase().includes(searchQuery));
    
    // Category Filter
    const matchesCategory = selectedCat === "all" || tx.kategori === selectedCat;
    
    // Type Filter
    const matchesType = selectedType === "all" || tx.tipe === selectedType;
    
    // Date Range Filter
    const matchesDateStart = !dateStart || tx.tanggal >= dateStart;
    const matchesDateEnd = !dateEnd || tx.tanggal <= dateEnd;

    return matchesSearch && matchesCategory && matchesType && matchesDateStart && matchesDateEnd;
  });

  // Urutkan data berdasarkan tanggal terbaru
  filteredTransactions.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  // Reset pagination ke halaman 1
  currentPage = 1;

  // Update Summary Dashboards
  updateSummaryMetrics();

  // Render Table
  renderTransactionsTable();

  // Render Visual Charts
  renderCharts();
}

function resetFilters() {
  document.getElementById('filter-search').value = "";
  document.getElementById('filter-category').value = "all";
  document.getElementById('filter-type').value = "all";
  document.getElementById('filter-date-start').value = "";
  document.getElementById('filter-date-end').value = "";
  applyFilters();
  showToast("Filter Direset", "Menampilkan semua transaksi keuangan.", "info");
}

function updateSummaryMetrics() {
  let totalIncome = 0;
  let totalExpense = 0;

  // Hitung dari filtered transaksi
  filteredTransactions.forEach(tx => {
    const jumlah = parseFloat(tx.jumlah);
    if (tx.tipe === 'pemasukan') {
      totalIncome += jumlah;
    } else {
      totalExpense += jumlah;
    }
  });

  const balance = totalIncome - totalExpense;

  // Render Text UI
  document.getElementById('val-total-income').innerText = formatRupiah(totalIncome);
  document.getElementById('val-total-expense').innerText = formatRupiah(totalExpense);
  document.getElementById('val-total-balance').innerText = formatRupiah(balance);

  // Wrapper style for Balance
  const balanceCard = document.getElementById('card-balance-wrapper');
  if (balance >= 0) {
    balanceCard.className = "summary-card card-balance positive";
  } else {
    balanceCard.className = "summary-card card-balance negative";
  }
}

function renderTransactionsTable() {
  const tbody = document.getElementById('transactions-list');
  tbody.innerHTML = '';

  const totalItems = filteredTransactions.length;

  if (totalItems === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 0;">
          <div class="empty-state">
            <div class="empty-state-icon">📂</div>
            <h3>Tidak Ada Transaksi</h3>
            <p>Tidak ditemukan data transaksi yang cocok dengan filter pencarian.</p>
          </div>
        </td>
      </tr>
    `;
    document.getElementById('pagination-info').innerText = "Menampilkan 0 dari 0 transaksi";
    document.getElementById('btn-prev-page').disabled = true;
    document.getElementById('btn-next-page').disabled = true;
    return;
  }

  // Calculate Pagination Page Items
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedItems = filteredTransactions.slice(startIndex, endIndex);

  // Render rows
  paginatedItems.forEach(tx => {
    const tr = document.createElement('tr');
    
    // Kolom Tanggal
    const colTanggal = document.createElement('td');
    colTanggal.setAttribute('data-label', 'Tanggal');
    colTanggal.innerText = formatDateIndo(tx.tanggal);
    tr.appendChild(colTanggal);

    // Kolom Tipe Badge
    const colTipe = document.createElement('td');
    colTipe.setAttribute('data-label', 'Tipe');
    const badgeType = tx.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';
    colTipe.innerHTML = `<span class="type-badge ${tx.tipe}">${badgeType}</span>`;
    tr.appendChild(colTipe);

    // Kolom Kategori
    const colKategori = document.createElement('td');
    colKategori.setAttribute('data-label', 'Kategori');
    colKategori.innerText = tx.kategori;
    tr.appendChild(colKategori);

    // Kolom Keterangan
    const colKeterangan = document.createElement('td');
    colKeterangan.setAttribute('data-label', 'Keterangan');
    colKeterangan.innerText = tx.keterangan || '-';
    tr.appendChild(colKeterangan);

    // Kolom Jumlah
    const colJumlah = document.createElement('td');
    colJumlah.setAttribute('data-label', 'Jumlah');
    colJumlah.style.textAlign = window.innerWidth > 768 ? 'right' : 'left';
    const amountClass = tx.tipe === 'pemasukan' ? 'text-amount-pemasukan' : 'text-amount-pengeluaran';
    const sign = tx.tipe === 'pemasukan' ? '+' : '-';
    colJumlah.innerHTML = `<span class="${amountClass}">${sign} ${formatRupiah(tx.jumlah)}</span>`;
    tr.appendChild(colJumlah);

    // Kolom Petugas
    const colPetugas = document.createElement('td');
    colPetugas.setAttribute('data-label', 'Petugas');
    colPetugas.innerText = tx.petugas || 'Bendahara';
    tr.appendChild(colPetugas);

    // Kolom Aksi (Bendahara Mode saja)
    const colAksi = document.createElement('td');
    colAksi.setAttribute('data-label', 'Aksi');
    colAksi.className = 'actions-cell';
    
    if (isBendaharaMode) {
      colAksi.innerHTML = `
        <button class="btn-table-icon" onclick="editTransaction('${tx.id}')" title="Edit Transaksi">
          <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
        </button>
        <button class="btn-table-icon btn-delete" onclick="deleteTransaction('${tx.id}')" title="Hapus Transaksi">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
        </button>
      `;
    } else {
      // Mode Viewer: Aksi tidak tersedia (disabled/locked)
      colAksi.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Locked 🔒</span>`;
    }
    tr.appendChild(colAksi);

    tbody.appendChild(tr);
  });

  // Re-create icons for table cell
  safeCreateIcons();

  // Update Pagination Controls
  document.getElementById('pagination-info').innerText = `Menampilkan ${startIndex + 1} - ${endIndex} dari ${totalItems} transaksi`;
  document.getElementById('page-num-display').innerText = currentPage;

  document.getElementById('btn-prev-page').disabled = currentPage === 1;
  document.getElementById('btn-next-page').disabled = endIndex >= totalItems;
}

// Pagination Controls
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTransactionsTable();
  }
}

function nextPage() {
  const totalItems = filteredTransactions.length;
  if (currentPage * itemsPerPage < totalItems) {
    currentPage++;
    renderTransactionsTable();
  }
}

// ==================== SAVE, EDIT, DELETE ACTIONS ====================

function openTransactionModal() {
  // Hanya ijinkan di mode bendahara
  if (!isBendaharaMode) {
    showToast("Akses Ditolak", "Silakan login sebagai Bendahara (klik tombol role di atas) terlebih dahulu.", "warning");
    openRoleModal();
    return;
  }

  // Reset Form
  document.getElementById('tx-id').value = '';
  document.getElementById('tx-tanggal').value = new Date().toISOString().split('T')[0];
  document.getElementById('tx-jumlah').value = '';
  document.getElementById('tx-kategori').value = '';
  document.getElementById('tx-petugas').value = CONFIG.KKN_INFO.BENDAHARA_NAMA || 'Bendahara';
  document.getElementById('tx-keterangan').value = '';
  
  // Set default type pemasukan
  setFormType('pemasukan');

  document.getElementById('transaction-modal-title').innerText = "Catat Transaksi Baru";
  document.getElementById('modal-transaction').classList.add('active');
}

function closeTransactionModal() {
  document.getElementById('modal-transaction').classList.remove('active');
}

function setFormType(type) {
  document.getElementById('tx-tipe').value = type;
  
  const optPemasukan = document.getElementById('type-opt-pemasukan');
  const optPengeluaran = document.getElementById('type-opt-pengeluaran');
  const datalist = document.getElementById('kategori-datalist');
  
  datalist.innerHTML = '';

  // Kategori default dari config
  const defaultCats = type === 'pemasukan' 
    ? CONFIG.KATEGORI.PEMASUKAN 
    : CONFIG.KATEGORI.PENGELUARAN;
    
  // Kategori riwayat yang sudah pernah diinput sebelumnya
  const historyCats = new Set();
  allTransactions
    .filter(tx => tx.tipe === type && tx.kategori)
    .forEach(tx => historyCats.add(tx.kategori));

  // Gabungkan default dan riwayat unik
  const mergedCats = new Set([...defaultCats, ...historyCats]);

  mergedCats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    datalist.appendChild(opt);
  });

  if (type === 'pemasukan') {
    optPemasukan.className = 'type-option active pemasukan';
    optPengeluaran.className = 'type-option pengeluaran';
  } else {
    optPemasukan.className = 'type-option pemasukan';
    optPengeluaran.className = 'type-option active pengeluaran';
  }
}

async function saveTransaction(event) {
  event.preventDefault();
  
  if (!isBendaharaMode) {
    showToast("Error", "Anda tidak memiliki izin mengedit data.", "error");
    return;
  }

  const txId = document.getElementById('tx-id').value;
  const tipe = document.getElementById('tx-tipe').value;
  const tanggal = document.getElementById('tx-tanggal').value;
  const rawJumlah = document.getElementById('tx-jumlah').value.replace(/\./g, '');
  const jumlah = parseFloat(rawJumlah);
  const kategori = document.getElementById('tx-kategori').value;
  const petugas = document.getElementById('tx-petugas').value.trim();
  const keterangan = document.getElementById('tx-keterangan').value.trim();

  if (!tanggal || isNaN(jumlah) || jumlah <= 0 || !kategori || !petugas) {
    showToast("Input Salah", "Mohon isi semua data formulir dengan valid.", "warning");
    return;
  }

  showLoading(true, "Menyimpan data...");

  const transactionData = {
    tanggal,
    tipe,
    kategori,
    jumlah,
    petugas,
    keterangan
  };

  try {
    if (isDemoMode) {
      // Simpan di LocalStorage
      let stored = JSON.parse(localStorage.getItem('demo_transactions') || '[]');
      
      if (txId) {
        // Mode Edit
        stored = stored.map(tx => tx.id === txId ? { ...tx, ...transactionData } : tx);
        showToast("Tersimpan", "Transaksi berhasil diperbarui (Offline).", "success");
      } else {
        // Mode Baru
        const newTx = {
          id: Math.random().toString(36).substring(2, 9),
          ...transactionData
        };
        stored.unshift(newTx);
        showToast("Tersimpan", "Transaksi baru dicatat (Offline).", "success");
      }
      localStorage.setItem('demo_transactions', JSON.stringify(stored));
    } else {
      // Simpan di Supabase
      if (txId) {
        // Mode Edit
        const { error } = await supabaseClient
          .from('transaksi')
          .update(transactionData)
          .eq('id', txId);
        
        if (error) throw error;
        showToast("Tersimpan", "Transaksi berhasil diperbarui di database.", "success");
      } else {
        // Mode Baru
        const { error } = await supabaseClient
          .from('transaksi')
          .insert([transactionData]);

        if (error) throw error;
        showToast("Tersimpan", "Transaksi baru dicatat di database.", "success");
      }
    }

    closeTransactionModal();
    loadTransactions(); // Reload data
  } catch (err) {
    console.error("Gagal menyimpan transaksi:", err);
    showToast("Gagal Menyimpan", "Gagal menyimpan transaksi ke database.", "error");
    showLoading(false);
  }
}

function editTransaction(id) {
  const tx = allTransactions.find(t => t.id === id);
  if (!tx) return;

  // Buka form modal
  openTransactionModal();
  
  // Set data
  document.getElementById('tx-id').value = tx.id;
  document.getElementById('tx-tanggal').value = tx.tanggal;
  document.getElementById('tx-jumlah').value = formatNumberWithDots(tx.jumlah.toString());
  document.getElementById('tx-petugas').value = tx.petugas || '';
  document.getElementById('tx-keterangan').value = tx.keterangan || '';
  
  // Set Tipe
  setFormType(tx.tipe);
  // Set Kategori sesuai tipenya
  document.getElementById('tx-kategori').value = tx.kategori;
  
  document.getElementById('transaction-modal-title').innerText = "Edit Catatan Transaksi";
}

async function deleteTransaction(id) {
  if (!isBendaharaMode) {
    showToast("Akses Ditolak", "Izin menghapus tidak tersedia.", "error");
    return;
  }

  if (!confirm("Apakah Anda yakin ingin menghapus catatan transaksi ini? Data yang terhapus tidak dapat dikembalikan.")) {
    return;
  }

  showLoading(true, "Menghapus data...");

  try {
    if (isDemoMode) {
      let stored = JSON.parse(localStorage.getItem('demo_transactions') || '[]');
      stored = stored.filter(tx => tx.id !== id);
      localStorage.setItem('demo_transactions', JSON.stringify(stored));
      showToast("Terhapus", "Transaksi telah dihapus (Offline).", "success");
    } else {
      const { error } = await supabaseClient
        .from('transaksi')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast("Terhapus", "Transaksi berhasil dihapus dari database.", "success");
    }

    loadTransactions();
  } catch (err) {
    console.error("Gagal menghapus transaksi:", err);
    showToast("Gagal Menghapus", "Terjadi kesalahan saat menghapus data di database.", "error");
    showLoading(false);
  }
}

// ==================== VISUAL CHARTS RENDERING ====================

function renderCharts() {
  const isDark = document.body.classList.contains('dark-theme');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#243049' : '#e2e8f0';

  // Hancurkan instansi grafik yang ada agar tidak tabrakan
  if (cashFlowChartInstance) cashFlowChartInstance.destroy();
  if (categoryChartInstance) categoryChartInstance.destroy();

  // --- 1. GRAFIK ALIRAN KAS (LINE/BAR CHART) ---
  // Kelompokkan data transaksi berdasarkan tanggal (terbatas 7 entri tanggal unik terbaru untuk estetik grafik)
  const dateTotals = {};
  
  // Kita urutkan dulu berdasarkan tanggal menaik khusus untuk chart
  const chronData = [...filteredTransactions].reverse();
  
  chronData.forEach(tx => {
    const key = formatDateChart(tx.tanggal);
    if (!dateTotals[key]) {
      dateTotals[key] = { pemasukan: 0, pengeluaran: 0 };
    }
    if (tx.tipe === 'pemasukan') {
      dateTotals[key].pemasukan += parseFloat(tx.jumlah);
    } else {
      dateTotals[key].pengeluaran += parseFloat(tx.jumlah);
    }
  });

  const labels = Object.keys(dateTotals).slice(-10); // Ambil maks 10 entri tanggal terakhir
  const pemasukanData = labels.map(l => dateTotals[l].pemasukan);
  const pengeluaranData = labels.map(l => dateTotals[l].pengeluaran);

  const ctxCashFlow = document.getElementById('cashflow-chart').getContext('2d');
  cashFlowChartInstance = new Chart(ctxCashFlow, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: pemasukanData,
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.75)' : 'rgba(16, 185, 129, 0.85)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 4
        },
        {
          label: 'Pengeluaran',
          data: pengeluaranData,
          backgroundColor: isDark ? 'rgba(244, 63, 94, 0.75)' : 'rgba(244, 63, 94, 0.85)',
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600' } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatRupiah(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' } },
          grid: { display: false }
        },
        y: {
          ticks: { 
            color: textColor,
            font: { family: 'Plus Jakarta Sans' },
            callback: function(value) { return 'Rp' + value.toLocaleString('id-ID'); }
          },
          grid: { color: gridColor }
        }
      }
    }
  });

  // --- 2. GRAFIK KATEGORI PENGELUARAN (PIE/DOUGHNUT) ---
  const expensesByCategory = {};
  filteredTransactions.filter(tx => tx.tipe === 'pengeluaran').forEach(tx => {
    if (!expensesByCategory[tx.kategori]) {
      expensesByCategory[tx.kategori] = 0;
    }
    expensesByCategory[tx.kategori] += parseFloat(tx.jumlah);
  });

  const catLabels = Object.keys(expensesByCategory);
  const catData = Object.values(expensesByCategory);

  const colorsPalette = [
    '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', 
    '#0d9488', '#ec4899', '#6366f1', '#64748b'
  ];

  const ctxCategory = document.getElementById('category-chart').getContext('2d');
  
  if (catData.length === 0) {
    // Tampilkan graf kosong / placeholder
    categoryChartInstance = new Chart(ctxCategory, {
      type: 'doughnut',
      data: {
        labels: ['Tidak Ada Pengeluaran'],
        datasets: [{
          data: [1],
          backgroundColor: [isDark ? '#243049' : '#e2e8f0'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor } },
          tooltip: { enabled: false }
        }
      }
    });
  } else {
    categoryChartInstance = new Chart(ctxCategory, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: colorsPalette.slice(0, catLabels.length),
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#151c2c' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: window.innerWidth > 480, // Sembunyikan legenda di HP agar chart tidak tergencet
            position: 'bottom',
            labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.raw;
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${context.label}: ${formatRupiah(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}

// ==================== UTILITY FUNCTIONS ====================

// Format Angka ke Rupiah
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Format Tanggal ISO ke Format Indonesia (Misal: 28 Mei 2026)
function formatDateIndo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('id-ID', options);
}

// Format Tanggal untuk Chart Labels (Misal: 28 Mei)
function formatDateChart(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const options = { day: 'numeric', month: 'short' };
  return date.toLocaleDateString('id-ID', options);
}

// Show/Hide Loading Overlay
function showLoading(show, message = "Memuat...") {
  const loader = document.getElementById('loading-overlay');
  const text = document.getElementById('loading-text');
  const fallback = document.getElementById('loading-fallback');
  
  if (show) {
    text.innerText = message;
    loader.style.opacity = '1';
    loader.style.pointerEvents = 'auto';
    
    // Sembunyikan fallback terlebih dahulu
    if (fallback) fallback.style.display = 'none';
    
    // Hapus timer timeout yang sudah ada
    if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
    
    // Tampilkan tombol fallback ke Mode Demo jika loading > 5 detik (antispasi koneksi lambat/terputus)
    loadingTimeoutId = setTimeout(() => {
      if (fallback) {
        fallback.style.display = 'block';
      }
    }, 5000);
  } else {
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    if (fallback) fallback.style.display = 'none';
    if (loadingTimeoutId) {
      clearTimeout(loadingTimeoutId);
      loadingTimeoutId = null;
    }
  }
}

// Toast System
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-triangle';
  if (type === 'warning') icon = 'alert-circle';

  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${icon}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);
  safeCreateIcons();

  // Hapus setelah 4 detik
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }, 4000);
}

// Inisialisasi format ribuan langsung pada input nominal
function initAmountInputFormatter() {
  const amountInput = document.getElementById('tx-jumlah');
  if (!amountInput) return;

  amountInput.addEventListener('input', (e) => {
    // Ambil nilai asli (hanya angka)
    let value = e.target.value.replace(/\D/g, '');
    
    if (value) {
      // Format dengan pemisah ribuan titik
      e.target.value = formatNumberWithDots(value);
    } else {
      e.target.value = '';
    }
  });
}

// Pemisah ribuan dengan titik
function formatNumberWithDots(numberStr) {
  return numberStr.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Perbarui daftar kategori pada filter pencarian
function updateFilterCategories() {
  const filterCatSelect = document.getElementById('filter-category');
  if (!filterCatSelect) return;
  
  const currentValue = filterCatSelect.value;
  filterCatSelect.innerHTML = '<option value="all">Semua Kategori</option>';

  // Kategori default
  const defaultCats = [...CONFIG.KATEGORI.PEMASUKAN, ...CONFIG.KATEGORI.PENGELUARAN];

  // Kategori dari database/transaksi yang sudah ada
  const historyCats = new Set();
  allTransactions.forEach(tx => {
    if (tx.kategori) historyCats.add(tx.kategori);
  });

  // Gabungkan
  const mergedCats = new Set([...defaultCats, ...historyCats]);

  mergedCats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    filterCatSelect.appendChild(opt);
  });

  // Pulihkan nilai filter jika masih ada di daftar baru
  if ([...mergedCats].includes(currentValue)) {
    filterCatSelect.value = currentValue;
  } else {
    filterCatSelect.value = 'all';
  }
}

// Toggle Dropdown Menu Ekspor
function toggleExportDropdown(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('export-dropdown-menu');
  if (menu) menu.classList.toggle('show');
}

// Event listener untuk menutup dropdown saat klik di luar area dropdown
document.addEventListener('click', () => {
  const menu = document.getElementById('export-dropdown-menu');
  if (menu && menu.classList.contains('show')) {
    menu.classList.remove('show');
  }
});
