// Exporter Library untuk Laporan Keuangan KKN
// Terintegrasi dengan SheetJS (Excel), jsPDF + AutoTable (PDF), dan Word MIME Export

// Helper to load external scripts dynamically (Lazy Loading)
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => {
      reject(new Error(`Gagal memuat script: ${src}`));
    };
    document.head.appendChild(script);
  });
}

// Helper untuk format rupiah polos tanpa Rp (untuk angka di Excel)
function parseRawNumber(val) {
  return parseFloat(val);
}

// Get Current Date in Indonesian Format (e.g. Sukamaju, 28 Mei 2026)
function getPlaceDateString() {
  const desa = (typeof CONFIG !== 'undefined' && CONFIG.KKN_INFO) ? CONFIG.KKN_INFO.DESA : 'Posko';
  const today = new Date();
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const dateStr = today.toLocaleDateString('id-ID', options);
  return `${desa}, ${dateStr}`;
}

// ==================== 1. EXPORT TO PDF ====================
async function exportPDF() {
  if (filteredTransactions.length === 0) {
    showToast("Gagal Ekspor", "Tidak ada data transaksi untuk diekspor.", "warning");
    return;
  }

  showToast("Mempersiapkan PDF", "Mengunduh modul PDF... (Mohon tunggu)", "info");

  try {
    // Lazy load jsPDF & AutoTable
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4'); // A4 Portrait
    
    // KKN Info
    const kknInfo = (typeof CONFIG !== 'undefined' && CONFIG.KKN_INFO) ? CONFIG.KKN_INFO : {
      NAMA_KKN: "KKN KELOMPOK 11",
      DESA: "Kapalo Padang",
      KECAMATAN: "Sungai Garinggiang",
      KABUPATEN: "Padang Pariaman",
      UNIVERSITAS: "Universitas Pembangunan Nasional",
      TAHUN: "2026",
      BENDAHARA_NAMA: "Farhan"
    };

    // --- KOP SURAT (LETTERHEAD) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(kknInfo.UNIVERSITAS.toUpperCase(), 105, 15, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`PANITIA KULIAH KERJA NYATA (KKN) - ${kknInfo.NAMA_KKN}`, 105, 21, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Alamat: Desa ${kknInfo.DESA}, Kec. ${kknInfo.KECAMATAN}, Kab. ${kknInfo.KABUPATEN} - Tahun ${kknInfo.TAHUN}`, 105, 26, { align: "center" });
    
    // Garis Kop Surat
    doc.setLineWidth(0.8);
    doc.line(15, 29, 195, 29);
    doc.setLineWidth(0.2);
    doc.line(15, 30.2, 195, 30.2);

    // --- JUDUL LAPORAN ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("LAPORAN RENCANA & AKTIVITAS KEUANGAN KKN", 105, 40, { align: "center" });
    
    // Rentang Tanggal Filter Laporan
    const dateStart = document.getElementById('filter-date-start').value;
    const dateEnd = document.getElementById('filter-date-end').value;
    let rentangWaktu = "Semua Periode";
    if (dateStart && dateEnd) {
      rentangWaktu = `${formatDateIndo(dateStart)} s/d ${formatDateIndo(dateEnd)}`;
    } else if (dateStart) {
      rentangWaktu = `Sejak ${formatDateIndo(dateStart)}`;
    } else if (dateEnd) {
      rentangWaktu = `Hingga ${formatDateIndo(dateEnd)}`;
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Periode: ${rentangWaktu}`, 105, 45, { align: "center" });

    // --- KOTAK METRIK RINGKASAN ---
    let totIn = 0;
    let totOut = 0;
    filteredTransactions.forEach(t => {
      const amt = parseFloat(t.jumlah);
      if (t.tipe === 'pemasukan') totIn += amt;
      else totOut += amt;
    });
    const sisaKas = totIn - totOut;

    doc.setFont("helvetica", "normal");
    doc.setDrawColor(226, 232, 240); // #e2e8f0
    doc.setFillColor(248, 250, 252); // #f8fafc
    doc.roundedRect(15, 52, 180, 18, 2, 2, "FD"); // Background box

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Text muted
    doc.text("TOTAL PEMASUKAN", 20, 58);
    doc.text("TOTAL PENGELUARAN", 80, 58);
    doc.text("SALDO SISA KAS", 140, 58);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70); // Success green
    doc.text(formatRupiah(totIn), 20, 64);
    doc.setTextColor(159, 18, 57); // Danger red
    doc.text(formatRupiah(totOut), 80, 64);
    doc.setTextColor(79, 70, 229); // Primary indigo
    doc.text(formatRupiah(sisaKas), 140, 64);

    // Reset warna teks
    doc.setTextColor(15, 23, 42); // Default dark

    // --- TABEL TRANSAKSI ---
    const headers = [["Tanggal", "Tipe", "Kategori", "Keterangan", "Petugas", "Jumlah"]];
    const dataRows = filteredTransactions.map(tx => [
      formatDateIndo(tx.tanggal),
      tx.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
      tx.kategori,
      tx.keterangan || '-',
      tx.petugas || 'Bendahara',
      tx.tipe === 'pemasukan' ? `+ ${formatRupiah(tx.jumlah)}` : `- ${formatRupiah(tx.jumlah)}`
    ]);

    doc.autoTable({
      startY: 76,
      head: headers,
      body: dataRows,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229], // Primary Indigo
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 9
      },
      columnStyles: {
        5: { halign: 'right', fontStyle: 'bold' } // Jumlah kolom kanan
      },
      styles: {
        fontSize: 8.5,
        font: 'helvetica',
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 15, right: 15 }
    });

    // --- TANDA TANGAN (SIGN-OFF) ---
    const finalY = doc.lastAutoTable.finalY + 15;
    
    // Mencegah tanda tangan gantung di halaman kosong baru
    if (finalY > 260) {
      doc.addPage();
    }
    
    const pageHeight = doc.internal.pageSize.height;
    const signY = finalY > 260 ? 30 : finalY;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    // Tanggal Tanda Tangan
    doc.text(getPlaceDateString(), 195, signY, { align: "right" });
    doc.text("Mengetahui & Menyetujui,", 195, signY + 6, { align: "right" });
    doc.text("Bendahara KKN Kelompok,", 195, signY + 12, { align: "right" });
    
    // Tanda Tangan Line Space
    doc.setFont("helvetica", "bold");
    doc.text(kknInfo.BENDAHARA_NAMA, 195, signY + 32, { align: "right" });
    
    doc.setFont("helvetica", "normal");
    doc.setLineWidth(0.3);
    doc.line(140, signY + 34, 195, signY + 34); // Garis bawah nama
    
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`NIM / Anggota KKN`, 195, signY + 38, { align: "right" });

    // Save File PDF
    const filename = `Laporan_Keuangan_KKN_${kknInfo.NAMA_KKN.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    showToast("PDF Berhasil", "Berkas PDF terunduh.", "success");
  } catch (error) {
    console.error("PDF Export Error:", error);
    showToast("Gagal Cetak PDF", "Pustaka PDF mengalami kendala saat memuat.", "error");
  }
}

// ==================== 2. EXPORT TO EXCEL ====================
async function exportExcel() {
  if (filteredTransactions.length === 0) {
    showToast("Gagal Ekspor", "Tidak ada data transaksi untuk diekspor.", "warning");
    return;
  }

  showToast("Mempersiapkan Excel", "Mengunduh modul Excel... (Mohon tunggu)", "info");

  try {
    // Lazy load SheetJS
    await loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");

    const kknInfo = (typeof CONFIG !== 'undefined' && CONFIG.KKN_INFO) ? CONFIG.KKN_INFO : {
      NAMA_KKN: "KKN KELOMPOK 11",
      DESA: "Kapalo Padang",
      KECAMATAN: "Sungai Garinggiang",
      KABUPATEN: "Padang Pariaman",
      UNIVERSITAS: "Universitas Pembangunan Nasional",
      TAHUN: "2026"
    };

    // Hitung Ringkasan
    let totIn = 0;
    let totOut = 0;
    filteredTransactions.forEach(t => {
      const amt = parseFloat(t.jumlah);
      if (t.tipe === 'pemasukan') totIn += amt;
      else totOut += amt;
    });

    // Susun Struktur Baris untuk Excel (Array of Arrays)
    const dataAOA = [
      [`LAPORAN KEUANGAN KKN - ${kknInfo.NAMA_KKN}`],
      [kknInfo.UNIVERSITAS],
      [`Posko: Desa ${kknInfo.DESA}, Kec. ${kknInfo.KECAMATAN}, Kab. ${kknInfo.KABUPATEN}`],
      [`Dicetak pada: ${getPlaceDateString()}`],
      [], // Baris Kosong
      ["RINGKASAN KAS"],
      ["Total Pemasukan", totIn],
      ["Total Pengeluaran", totOut],
      ["Saldo Sisa Kas", totIn - totOut],
      [], // Baris Kosong
      ["RIWAYAT DETAIL TRANSAKSI"],
      ["Tanggal", "Tipe Kas", "Kategori", "Keterangan", "Petugas", "Jumlah (Rupiah)"] // Headers Tabel
    ];

    // Masukkan data transaksi
    filteredTransactions.forEach(tx => {
      dataAOA.push([
        tx.tanggal, // Format tanggal mentah yyyy-mm-dd agar Excel bisa sorting/filter bawaan
        tx.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
        tx.kategori,
        tx.keterangan || '-',
        tx.petugas || 'Bendahara',
        tx.tipe === 'pemasukan' ? parseFloat(tx.jumlah) : -parseFloat(tx.jumlah) // Pemasukan positif, Pengeluaran negatif
      ]);
    });

    // Buat Workbook & Worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dataAOA);

    // Tambahkan Auto-Width Kolom Sederhana
    const maxCols = 6;
    const wscols = [];
    for (let i = 0; i < maxCols; i++) {
      wscols.push({ wch: 18 }); // Set rata lebar kolom 18 karakter
    }
    wscols[3] = { wch: 30 }; // Kolom keterangan dibuat lebih lebar (30 karakter)
    ws['!cols'] = wscols;

    // Gabungkan workbook
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Kas KKN");

    // Download File
    const filename = `Laporan_Keuangan_KKN_${kknInfo.NAMA_KKN.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast("Excel Berhasil", "Berkas Excel (.xlsx) terunduh.", "success");
  } catch (error) {
    console.error("Excel Export Error:", error);
    showToast("Gagal Cetak Excel", "Gagal mengekspor data ke Excel.", "error");
  }
}

// ==================== 3. EXPORT TO WORD (HTML MIME TYPE) ====================
function exportWord() {
  if (filteredTransactions.length === 0) {
    showToast("Gagal Ekspor", "Tidak ada data transaksi untuk diekspor.", "warning");
    return;
  }

  showToast("Mempersiapkan Word", "Sedang membuat dokumen MS Word...", "info");

  try {
    const kknInfo = (typeof CONFIG !== 'undefined' && CONFIG.KKN_INFO) ? CONFIG.KKN_INFO : {
      NAMA_KKN: "KKN KELOMPOK 11",
      DESA: "Kapalo Padang",
      KECAMATAN: "Sungai Garinggiang",
      KABUPATEN: "Padang Pariaman",
      UNIVERSITAS: "Universitas Pembangunan Nasional",
      TAHUN: "2026",
      BENDAHARA_NAMA: "Farhan"
    };

    // Hitung Ringkasan
    let totIn = 0;
    let totOut = 0;
    filteredTransactions.forEach(t => {
      const amt = parseFloat(t.jumlah);
      if (t.tipe === 'pemasukan') totIn += amt;
      else totOut += amt;
    });
    const sisaKas = totIn - totOut;

    // Buat template tabel HTML
    let tableRowsHtml = "";
    filteredTransactions.forEach(tx => {
      const amountColor = tx.tipe === 'pemasukan' ? '#10b981' : '#f43f5e';
      const amountSign = tx.tipe === 'pemasukan' ? '+' : '-';
      tableRowsHtml += `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${formatDateIndo(tx.tanggal)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${tx.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${tx.kategori}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${tx.keterangan || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${tx.petugas || 'Bendahara'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: ${amountColor};">
            ${amountSign} ${formatRupiah(tx.jumlah)}
          </td>
        </tr>
      `;
    });

    // Struktur HTML Laporan Word dengan XML Namespace MS Word agar terbaca format halamannya
    const wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Laporan Keuangan KKN</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          body {
            font-family: 'Arial', sans-serif;
            color: #0f172a;
            line-height: 1.4;
          }
          .kop-title {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0;
          }
          .kop-subtitle {
            text-align: center;
            font-size: 12pt;
            font-weight: bold;
            margin: 2px 0;
          }
          .kop-desc {
            text-align: center;
            font-size: 9pt;
            margin: 0;
            color: #475569;
          }
          .divider {
            border-bottom: 2px solid #000000;
            margin-top: 10px;
            margin-bottom: 20px;
          }
          .report-title {
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .report-subtitle {
            text-align: center;
            font-size: 10pt;
            font-style: italic;
            margin-bottom: 20px;
            color: #475569;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background-color: #f8fafc;
          }
          .summary-cell {
            padding: 10px;
            border: 1px solid #e2e8f0;
            width: 33.33%;
          }
          .table-data {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .table-data th {
            background-color: #4f46e5;
            color: #ffffff;
            font-weight: bold;
            padding: 10px 8px;
            border: 1px solid #cbd5e1;
            text-align: left;
            font-size: 10pt;
          }
          .signature-container {
            margin-top: 40px;
            float: right;
            width: 250px;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <!-- Kop Surat -->
        <p class="kop-title">${kknInfo.UNIVERSITAS}</p>
        <p class="kop-subtitle">PANITIA KULIAH KERJA NYATA (KKN) - ${kknInfo.NAMA_KKN}</p>
        <p class="kop-desc">Posko: Desa ${kknInfo.DESA}, Kecamatan ${kknInfo.KECAMATAN}, Kabupaten ${kknInfo.KABUPATEN} - ${kknInfo.TAHUN}</p>
        <div class="divider"></div>

        <!-- Judul -->
        <p class="report-title">LAPORAN REKAPITULASI KAS KEUANGAN KKN</p>
        <p class="report-subtitle">Dicetak pada: ${getPlaceDateString()}</p>

        <!-- Tabel Ringkasan Kas -->
        <table class="summary-table">
          <tr>
            <td class="summary-cell">
              <span style="font-size: 8pt; color: #64748b; font-weight: bold;">TOTAL PEMASUKAN</span><br/>
              <span style="font-size: 12pt; font-weight: bold; color: #065f46;">${formatRupiah(totIn)}</span>
            </td>
            <td class="summary-cell">
              <span style="font-size: 8pt; color: #64748b; font-weight: bold;">TOTAL PENGELUARAN</span><br/>
              <span style="font-size: 12pt; font-weight: bold; color: #9f1239;">${formatRupiah(totOut)}</span>
            </td>
            <td class="summary-cell">
              <span style="font-size: 8pt; color: #64748b; font-weight: bold;">SALDO SISA KAS</span><br/>
              <span style="font-size: 12pt; font-weight: bold; color: #4f46e5;">${formatRupiah(sisaKas)}</span>
            </td>
          </tr>
        </table>

        <!-- Tabel Detail Keuangan -->
        <h4 style="margin-bottom: 10px;">Riwayat Transaksi Keuangan</h4>
        <table class="table-data">
          <thead>
            <tr>
              <th style="width: 15%;">Tanggal</th>
              <th style="width: 12%;">Tipe</th>
              <th style="width: 18%;">Kategori</th>
              <th style="width: 25%;">Keterangan</th>
              <th style="width: 15%;">Petugas</th>
              <th style="width: 15%; text-align: right;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <!-- Area Tanda Tangan -->
        <div class="signature-container">
          <p style="margin: 0;">${getPlaceDateString()}</p>
          <p style="margin: 0; margin-top: 5px;">Mengetahui & Menyetujui,</p>
          <p style="margin: 0; font-weight: bold; margin-bottom: 60px;">Bendahara KKN,</p>
          
          <p style="margin: 0; font-weight: bold; text-decoration: underline;">${kknInfo.BENDAHARA_NAMA}</p>
          <p style="margin: 0; font-size: 8.5pt; color: #64748b;">NIM. Anggota Kelompok</p>
        </div>
      </body>
      </html>
    `;

    // Buat Blob dan trigger download berkas Word (.doc agar kompatibel dengan word engine lama & baru)
    const blob = new Blob(['\ufeff' + wordContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Keuangan_KKN_${kknInfo.NAMA_KKN.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Word Berhasil", "Berkas Word (.doc) terunduh.", "success");
  } catch (error) {
    console.error("Word Export Error:", error);
    showToast("Gagal Cetak Word", "Gagal mengekspor data ke Word.", "error");
  }
}
