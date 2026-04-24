# BRIEFING: Phase 3 - Paper Trading & System Integrity

**Tujuan**: Memvalidasi strategi trading (Short Squeeze Trap) melalui simulasi paper trading yang akurat, lengkap dengan manajemen risiko (TP/SL) dan transparansi data pada Dashboard.

---

## 1. STATUS PENCAPAIAN TERBARU (PROGRESS)
*   **[DONE] Institutional Raw Data Capture**: Implementasi \`raw_metrics_snapshot\` pada tabel sinyal, memungkinkan audit penuh terhadap data pasar persis saat entry dilakukan.
*   **[DONE] PhD Risk Optimization**: Stabilisasi penempatan SL/TP menggunakan **14-period Rolling ATR** dan penguatan keyakinan sinyal melalui **Institutional Intensity Multiplier (Z-Score)**.
*   **[DONE] Data Freshness Enforcement**: Sistem sekarang mendeteksi data basi (*stale*) dan memberikan penalti 50% pada skor konfluensi jika data lebih lama dari 30 menit.
*   **[DONE] Quantitative Post-Mortem**: Analisis kegagalan menyimpulkan adanya "Early Bullish Bias" pada AI; solusi berupa pengetatan filter tren sedang disiapkan.
*   **[DONE] PhD Strategic Foundation**: Pembuatan dokumen \`METRICS_QUANT_FOUNDATION.md\` sebagai landasan akademis pemilihan fitur trading.
*   **[DONE] Migration Utility**: Implementasi \`migrate-old-trades.ts\` untuk mengonversi data transaksi lama ke format finansial baru.
*   **[DONE] Dynamic Date Statistics**: Audit statistik (\`getWinRateAudit\`) kini menggunakan filter waktu dinamis.
*   **[DONE] Multi-Currency Visibility**: Dashboard telah diperbarui untuk menampilkan performa dalam format Nominal ($) dan Persentase (%).
*   **[DONE] AI Rich Context Feeding**: AI Strategic Advisor kini menerima data yang jauh lebih lengkap (ATR, Volume, OI Delta, Rekt Intensity).
*   **[DONE] Symmetric Confluence Score**: Mesin kuantitatif dan prompt AI telah diseimbangkan untuk peluang Long dan Short.
*   **[DONE] UI Transparency**: Kolom TP dan SL telah ditambahkan ke tabel riwayat.
*   **[DONE] Retroactive Scan Logic**: Sistem mampu mendeteksi TP/SL yang tersentuh saat server offline.

---

## 2. STANDAR TEKNIS (ENGINEERING PROTOCOL)
*   **PhD Rigor**: Setiap fitur baru wajib memiliki landasan ekonomi/fundamental (Whale DNA) dan melalui proses normalisasi (Z-Score/Deviation).
*   **Data Integrity**: Kebijakan "Zero-Undefined" dan penyimpanan snapshot metrik mentah untuk setiap sinyal.
*   **Risk Management**: Keluar posisi menggunakan Rolling ATR 14-period (2 * ATR untuk SL, 4 * ATR untuk TP).
*   **Confidence Threshold**: (NEW) Sinyal di bawah 0.7 akan dianulir kecuali terdeteksi anomali volume institusional yang sangat besar.

---

## 3. RENCANA KERJA SAAT INI (IN PROGRESS)
*   **Trend Confirmation Filter**: Implementasi EMA 200/Momentum filter untuk mencegah entry melawan arus tren besar (mengatasi Early Bullish Bias).
*   **Phase 4 Preparation**: Menyiapkan infrastruktur untuk eksekusi live (Kill Switches & API Security).

---

## 4. DAFTAR TUGAS MENDATANG (BACKLOG)
1.  **[TASK D] Database Housekeeping**: Script auto-purge untuk data \`whale_trades\`.
2.  **[TASK G] Dashboard PnL Visualization**: Implementasi grafik garis (Equity Curve).

---
*Dokumen ini diperbarui secara otomatis sebagai catatan kemajuan fase pengembangan saat ini.*
