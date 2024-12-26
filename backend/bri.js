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

// Route untuk upload file BRI
router.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Proses file BRI di sini
    res.json({ message: 'BRI file uploaded successfully' });
});

// Route untuk filtering data BRI
router.post('/filter', (req, res) => {
    // Proses filtering data sesuai kebutuhan Bank BRI
    res.json({ message: 'Data filtered for BRI' });
});

module.exports = router;
