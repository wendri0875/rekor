const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { parse } = require('json2csv');

const router = express.Router();
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const upload = multer({ dest: uploadsDir });


// Middleware untuk menangani JSON body
router.use(express.json());

// Route untuk upload file Mandiri
// Endpoint untuk meng-upload file Excel (Bank Mandiri)
router.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    const originalName = file.originalname;
    const baseName = path.parse(originalName).name; // Nama file tanpa ekstensi
    const csvFilename = `${baseName}.csv`; // Nama file CSV yang dihasilkan

    const filePath = path.join(uploadsDir, file.filename);

    try {
        // Membaca file Excel
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        // Pilih kolom yang diperlukan: Tanggal, Keterangan, Dana Masuk, Dana Keluar, Saldo
        const selectedColumns = data.map(row => {
            return [
                row[4], // Tanggal
                row[7], // Keterangan
                row[15], // Dana Masuk (IDR)
                row[18], // Dana Keluar (IDR)
                row[21], // Saldo (IDR)
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
    function formatDate(dateStr) {
        const months = {
            Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
            Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
        };

        const [day, month, year] = dateStr.split(' ');
        return `${year}-${months[month]}-${day.padStart(2, '0')}`;
    }

    function cleanNumber(value) {
        if (!value) return null; // Jika kolom kosong, tetap null
        return parseInt(value.replace(/\./g, '').replace(/,/g, '.')).toString();
    }

    const filteredRows = data.filter(row => {
        const isDate = /^\d{2}\s\w{3}\s\d{4}$/.test(row[0]); 
        return isDate;
    });

    const formattedRows = filteredRows.map(row => {
        if (row[0]) {
            row[0] = formatDate(row[0]); // Ubah format tanggal ke yyyy-mm-dd
        }
        row[2] = cleanNumber(row[2]);
        row[3] = cleanNumber(row[3]);
        row[4] = cleanNumber(row[4]);
        return row;
    });

    const header = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];

    return [header, ...formattedRows];
}

// Route untuk filtering data Mandiri
// Endpoint untuk menerima permintaan filter data berdasarkan rentang tanggal
router.post('/filter', (req, res) => {

    //console.log(req);
   
    const { startDate, endDate, data, csvFilename } = req.body;

    

    if (!startDate || !endDate || !data) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Filter data berdasarkan rentang tanggal
    const filteredData = data.filter(row => {
        const date = new Date(row[0]);
        return date >= new Date(startDate) && date <= new Date(endDate);
    });

    // Menambahkan header sebelum data yang difilter
    const header = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
    const csvData = [header, ...filteredData]; // Menggabungkan header dengan data yang difilter

    // Mengonversi data yang telah difilter ke CSV

    //menghilangkan double quote

    const json2csvParser = new parse({
        
        formatters: {
          string: stringFormatter({ quote: '' }),
        },
      });
      const csv = json2csvParser.parse(csvData);
      
      console.log(csv);
      

   /* const opts = {
        formatters: {
            string: stringFormatter({ quote: '' }),
        }
      };
      const parser = new parse(opts);
      
    const csv = parser(csvData, { header: false});*/
    console.log(csv);

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
