const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const router = express.Router();
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Validasi tipe file dan ukuran maksimum (2 MB)
const upload = multer({
    dest: uploadsDir,
    limits: { fileSize: 2 * 1024 * 1024 }, // Maksimal 2 MB
    fileFilter: (req, file, cb) => {
        const filetypes = /\.(xls|xlsx)$/; // Hanya file Excel
        if (!filetypes.test(file.originalname.toLowerCase())) {
            return cb(new Error('Hanya file Excel yang diizinkan!'));
        }
        cb(null, true);
    }
});

// Middleware untuk menangani JSON body
router.use(express.json());

// Route untuk upload file Kas
router.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    const originalName = file.originalname;
    const baseName = path.parse(originalName).name; // Nama file tanpa ekstensi
    const csvFilename = `mm_${baseName}.csv`; // Nama file CSV yang dihasilkan

    const filePath = path.join(uploadsDir, file.filename);

    try {
        // Membaca file Excel
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        // Pilih kolom yang diperlukan: Tanggal, Keterangan, Dana Masuk, Dana Keluar, Saldo
        const selectedColumns = data.map(row => {
            return [
                row[0], // Tanggal
                row[2], // Keterangan 1
                row[4], // Keterangan 2
                row[5], // Dana
                row[6], // DBCR
            ];
        });

        // Filter dan format data tanpa format tanggal
        const filteredData = filterAndFormatRows(selectedColumns);

        // Ambil tanggal pertama dan terakhir dari data
        const startDate = filteredData[1] ? filteredData[1][0] : '';
        const endDate = filteredData[filteredData.length - 1] ? filteredData[filteredData.length - 1][0] : '';

        // Kirim data JSON ke pengguna
        res.json({
            message: 'File berhasil diunggah',
            data: filteredData.slice(1), // Kirim data tanpa header
            csvFilename: csvFilename, // Nama file CSV yang dihasilkan
            startDate: startDate, // Tanggal mulai
            endDate: endDate, // Tanggal akhir
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        fs.unlinkSync(filePath); // Hapus file setelah digunakan
    }
});

// Fungsi untuk filter dan format data tanpa format tanggal
function filterAndFormatRows(data) {
    function formatExcelDate(excelDate) {
       
        if (excelDate < 61) excelDate += 1; // lotus123 bugfix
        const utc = new Date((excelDate - 25569) * 8.64e7);
   
           const year= utc.getUTCFullYear();
           const month= utc.getUTCMonth() + 1;
           const day= utc.getUTCDate();
          

        return `${year}-${month}-${day}`;
    }

    function cleanNumber(value) {
        if (!value) return null; // Jika kolom kosong, tetap null
        return parseInt(value.replace(/\./g, '').replace(/,/g, '.')).toString();
    }

    const filteredRows = data.filter(row => {
        const dt =formatExcelDate(row[0]);
        const isDate =  /^(\d{4})\-(\d{2})\-(\d{2})$/.test(dt);
        return isDate;
    });

    const formattedRows = filteredRows.map(row => {
        row[0] = formatExcelDate(row[0]); // Ubah format tanggal ke yyyy-mm-dd 
        row[1] = row[1].replace(/[\r\n\t,]/g, ' ') + '. ' + row[2].replace(/[\r\n\t,]/g, ' ');; // Ganti enter, tab, dan koma menjadi spasi
        row[2] = (row[4] =='Pengeluaran')? row[3]:0;
        row[3] = (row[4] =='Pendapatan')? row[3]:0;
        return row;
    });

    function removeEmoticons(text) {
        // Regex untuk mencocokkan semua emotikon
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F018}-\u{1F270}]|[\u{1F1E6}-\u{1F1FF}]/gu;
    
        // Hapus semua emotikon dari teks
        return text.replace(emojiRegex, '');
    }

    const fnlformattedRows =formattedRows.map(row => {
        return [
            row[0], // Tanggal
            removeEmoticons(row[1]), // Keterangan
            row[2], // Jumlah
            row[3], // DBCR

        ];
    });  

    // Urutkan berdasarkan tanggal (kolom pertama)
    const sortedRows = fnlformattedRows.sort((a, b) => {
        const dateA = new Date(a[0]); // Konversi string tanggal ke objek Date
        const dateB = new Date(b[0]);
        return dateA - dateB; // Urutkan dari kecil ke besar
    });

    const header = ['Date', 'Description', 'Debit', 'Credit'];

    return [header, ...sortedRows];
}

// Route untuk filtering data Kas
router.post('/filter', (req, res) => {
    const { startDate, endDate, data, csvFilename } = req.body;

    if (!startDate || !endDate || !data) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const filteredData = data.filter(row => {
        const date = new Date(row[0]);
        return date >= new Date(startDate) && date <= new Date(endDate);
    });

    const header = ['Date', 'Description', 'Debit', 'Credit'];
    const csvData = [header, ...filteredData];

    const { Parser, formatters: { string: stringFormatter } } = require('json2csv');

    const json2csvParser = new Parser({
        header: false,
        formatters: {
            string: stringFormatter({ quote: '' }),
        },
    });
    const csv = json2csvParser.parse(csvData);

    const csvPath = path.join(uploadsDir, csvFilename);
    fs.writeFileSync(csvPath, csv);

    res.json({
        message: 'File filtered and saved successfully',
        filename: csvFilename,
    });
});

// Endpoint untuk mendownload file CSV
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                res.status(500).send({ error: 'Terjadi kesalahan saat mengunduh file' });
            } else {
                fs.unlinkSync(filePath);
            }
        });
    } else {
        res.status(404).send({ error: 'File tidak ditemukan' });
    }
});

module.exports = router;
