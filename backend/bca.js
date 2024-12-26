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
const upload = multer({ dest: uploadsDir });

// Route untuk upload file BCA
router.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Proses file BCA di sini
    res.json({ message: 'BCA file uploaded successfully' });
});

// Route untuk filtering data BCA
router.post('/filter', (req, res) => {
    // Proses filtering data sesuai kebutuhan Bank BCA
    res.json({ message: 'Data filtered for BCA' });
});

module.exports = router;


