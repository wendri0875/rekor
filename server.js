const express = require('express');
const path = require('path');
const multer = require('multer');
const mandiri = require('./backend/mandiri_be');
const bca = require('./backend/bca_be');
const bri = require('./backend/bri_be');
const kas = require('./backend/kas_be');

// Setup aplikasi Express
const app = express();
const port = 3000;

// Middleware untuk menangani file statis (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Menyajikan file statis dari folder 'images'
//app.use(express.static(path.join(__dirname, 'images')));

// Route utama yang mengarahkan ke halaman pilihan bank
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'bank-converter', 'index.html'));
});

// Route untuk setiap bank
app.use('/mandiri', mandiri);
app.use('/bca', bca);
app.use('/bri', bri);
app.use('/kas', kas);


// Route untuk halaman masing-masing bank
app.get('/mandiri.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'bank-converter', 'mandiri.html'));
});
app.get('/bca.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'bank-converter', 'bca.html'));
});
app.get('/bri.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'bank-converter', 'bri.html'));
});
app.get('/kas.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'bank-converter', 'kas.html'));
});

// Menjalankan server pada port 3000
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
