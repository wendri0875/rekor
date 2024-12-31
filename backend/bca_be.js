const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser'); // Untuk parsing CSV
const { Parser } = require('json2csv'); // Untuk konversi JSON ke CSV

const router = express.Router();
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Membuat folder uploads jika belum ada
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Validasi tipe file dan ukuran maksimum (2 MB)
const upload = multer({
    dest: uploadsDir,
    limits: { fileSize: 2 * 1024 * 1024 }, // Maksimal 2 MB
    fileFilter: (req, file, cb) => {
        const filetypes = /\.csv$/; // Hanya file CSV
        if (!filetypes.test(file.originalname.toLowerCase())) {
            return cb(new Error('Hanya file CSV yang diizinkan!'));
        }
        cb(null, true);
    }
});

// Middleware untuk menangani JSON body
router.use(express.json());

// Route untuk upload file CSV
router.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    const originalName = file.originalname;
    const baseName = path.parse(originalName).name; // Nama file tanpa ekstensi
    const csvFilename = `bca_to_import_${baseName}.csv`; // Nama file CSV yang dihasilkan

    const filePath = path.join(uploadsDir, file.filename);

    try {
        const rows = [];
        // Membaca dan memproses file CSV
        fs.createReadStream(filePath)
            .pipe(csv()) // Parse CSV ke format JSON
            .on('data', (row) => {
                rows.push(row); // Menambahkan setiap baris ke array
            })
            .on('end', () => {
                // Mengubah JSON ke array 2D (misalnya array of arrays)
                const data = rows.map(row => Object.values(row));


             // Pilih kolom yang diperlukan: Tanggal, Keterangan, Dana Masuk, Dana Keluar, Saldo
        const selectedColumns = data.map(row => {
            return [
                row[0], // Tanggal
                row[1], // Keterangan
                row[2], // Cabang
                row[3], // Jumlah
                row[4], // DBCR
                row[5], // Saldo (IDR)
            ];
        });    


                // Simpan file JSON hasil konversi
                const csvPath = path.join(uploadsDir, csvFilename);

 // Filter dan format data tanpa format tanggal
        const filteredData = filterAndFormatRows(selectedColumns);

        // Ambil tanggal pertama dan terakhir dari data
        const startDate = filteredData[1] ? filteredData[1][0] : '';
        const endDate = filteredData[filteredData.length - 1] ? filteredData[filteredData.length - 1][0] : '';




                // Kirim respons ke pengguna
                res.json({
                    message: 'File berhasil diunggah',
                    data: filteredData.slice(1), // Kirim data tanpa header
                    csvFilename: csvFilename, // Nama file CSV yang dihasilkan
                    startDate: startDate, // Tanggal mulai
                    endDate: endDate, // Tanggal akhir
                });

                // Hapus file sementara setelah diproses
                fs.unlinkSync(filePath);
            })
            .on('error', (err) => {
                res.status(500).json({ error: 'Terjadi kesalahan saat memproses file CSV' });
                fs.unlinkSync(filePath); // Hapus file sementara jika ada error
            });

            
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fungsi untuk filter dan format data tanpa format tanggal
function filterAndFormatRows(data) {
    function formatDate(dateStr) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
    }

    function cleanNumber(value) {
        if (!value) return null; // Jika kolom kosong, tetap null
        return parseInt(value.replace(/\./g, '').replace(/,/g, '.')).toString();
    }

    // Mengubah regex sesuai permintaan menjadi dd/mm/yyyy
    const filteredRows = data.filter(row => {
        const isDate = /^'(\d{2})\/(\d{2})\/(\d{4})$/.test(row[0]);
        return isDate;
    });

    const formattedRows = filteredRows.map(row => {
        if (row[0]) {
            const cleanDate = row[0].startsWith("'") ? row[0].slice(1) : row[0];
            row[0] = formatDate(cleanDate); // Ubah format tanggal ke yyyy-mm-dd
        }
        row[1] = row[1].replace(/[\r\n\t,]/g, ' '); // Ganti enter, tab, dan koma menjadi spasi
        row[2]=  (row[4] =='DB')? row[3]:0;
        row[3]=  (row[4] =='CR')? row[3]:0;    
        row[4] = row[5];
        return row;
    });

    const header = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];

    const fnlformattedRows =formattedRows.map(row => {
        return [
            row[0], // Tanggal
            row[1], // Keterangan
            row[2], // Jumlah
            row[3], // DBCR
            row[4], // Saldo (IDR)
        ];
    });    

    return [header, ...fnlformattedRows];
}

// Route untuk filtering data BCA
router.post('/filter', (req, res) => {
    const { startDate, endDate, data, csvFilename } = req.body;

    if (!startDate || !endDate || !data) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const filteredData = data.filter(row => {
        const date = new Date(row[0]);
        return date >= new Date(startDate) && date <= new Date(endDate);
    });

    const header = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
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

// Endpoint untuk mendownload file csv
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                res.status(500).send({ error: 'Terjadi kesalahan saat mengunduh file' });
            } else {
                fs.unlinkSync(filePath); // Hapus file setelah diunduh
            }
        });
    } else {
        res.status(404).send({ error: 'File tidak ditemukan' });
    }
});

// Endpoint untuk mendownload file CSV
router.get('/download-csv/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                res.status(500).send({ error: 'Terjadi kesalahan saat mengunduh file' });
            } else {
                fs.unlinkSync(filePath); // Hapus file setelah diunduh
            }
        });
    } else {
        res.status(404).send({ error: 'File tidak ditemukan' });
    }
});

module.exports = router;