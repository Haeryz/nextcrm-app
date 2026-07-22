seluruh sistem Logistics yang sudah dibuat, ternyata adalah sistem "Receiving". Sistem ynag dimana itu digunakan untuk terima barang dari supplier.
Ternyata, PO itu, kita (pihak Mektek) itu, mengirimkan Item/SParepart ke USER. Kurang lebih, sistemnya hampir sama seperti receiving. 
Kemudian, pada page Logistics (monitoring PO), itu semisal habis buat PO baru, meskipun dia open/close, surat jalan tetap bisa tampil, nah, jadi, ketika PO dibuat, maka surat jalan langsung otomatis terbuat. Untuk template menyesuaikan GAMBAR.
untuk submenu, dibikin 1 saja Logistics yang dimana ketika di hover ada 3 menu lagi yaitu : Catalog/Item, Monitoring PO (/en/mektek/logistics), dan Receiving.
Pada bagian Catalog/Item, semua hal itu tersambung ke Monitoring PO dan Receiving.
Catalog/Item tidak usah ada fitur tambah sparepart. Stok dari Catalog/Item itu mengikuti item item yang sudah ditambahkan atau dikurangi melalui Monitoring PO dan juga Receiving.
Pada bagian spreadsheet inventory, ketika menambahkan Catat Mutasi Stok, maka nanti Stok nya akan terhubung kedalam Catalog/Item. Jadi, keseluruhan sistem untuk barang barang yang ada di mektek itu semuanya integrated jadi satu.
Pada bagian Spreadsheet PO, itu belum ada export excel, itu belum ada Export Excel. Tambahkan export excel yang bisa dikustomisasi di export bulan apa saja, gunakan best practice.
Kemudian, bagian receiving (PO ke Supplier), tidak usah ada Surat Jalan. JADI INTINYA, JIKA PO itu (MEKTEK KIRIM BARANG KE USER), JIKA RECEIVING itu (MEKTEK PESAN KE SUPPLIER)
tanda tangan di surat PO Receiving itu ada 3. Paling kiri itu Finance Accounting, Tengah itu Departement Purchasing, Kanan itu pihak yang Order (Purchasing Admin)
pada spreadsheet inventory, pada kartu stok sparepart itu ada tombol menu untuk memilih bulan, kemudian, filter spreadsheet nya itu jadikan 1 di kartu stok sparepart, UNTUK UI UX NYA IKUTILAH BEST PRACTICE YANG SUDAH ADA AGAR TIDAK MEMBINGUNGKAN
pada kartu stok sparepart, seluruh catalog/item nya tetep terintegrasi, TETAPI tetap bisa diedit untuk quantity setiap item nya (di cek mutasi itu)
