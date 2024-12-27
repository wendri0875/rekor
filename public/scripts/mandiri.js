
document.getElementById('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        showAlert('Silakan pilih file untuk diunggah!', 'danger');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    // Show loader during file upload
    showLoader(true);
    showAlert('Mengunggah file...', 'info');

    const response = await fetch('mandiri/upload', {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();
    showLoader(false);

    if (response.ok) {
        window.uploadedData = result.data;
        window.csvFilename = result.csvFilename;

        const formatToDateInput = (dateStr) => {
            const [year, month, day] = dateStr.split('-');
            return `${year}-${month}-${day}`;
        };

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        startDateInput.value = formatToDateInput(result.startDate);
        endDateInput.value = formatToDateInput(result.endDate);

        document.getElementById('dateFilterForm').style.display = 'block';
        showAlert('File berhasil diupload! Sekarang pilih range tanggal untuk filter data.', 'success');

        // Display data preview
        showDataPreview(result.data);
    } else {
        showAlert('Error uploading file: ' + result.error, 'danger');
    }
});

document.getElementById('filterButton').addEventListener('click', async () => {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    // Validasi tanggal
    if (!startDate || !endDate) {
        showAlert('Harap isi kedua tanggal dengan benar!', 'danger');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        showAlert('Tanggal akhir tidak boleh lebih kecil dari tanggal mulai!', 'danger');
        return;
    }

    showLoader(true);
    showAlert('Filtering data...', 'info');
    
    const response = await fetch('mandiri/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            startDate: startDate,
            endDate: endDate,
            data: window.uploadedData,
            csvFilename: window.csvFilename,
        }               
    ),
    });

    const result = await response.json();
    showLoader(false);

    if (response.ok) {
        showAlert('File CSV untuk Manager.io sudah dibuat. Tunggu sebentar, lalu unduh.', 'success');
        setTimeout(() => {
            window.location.href = `mandiri/download/${result.filename}`;
        }, 1500);
    } else {
        showAlert('Error filtering file: ' + result.error, 'danger');
    }
});

function showDataPreview(data) {
    const previewContainer = document.getElementById('dataPreview');
    const previewTableBody = document.getElementById('previewTableBody');
    previewTableBody.innerHTML = ''; // Reset isi tabel sebelumnya

    if (data.length > 6) {
        const topData = data.slice(0, 3);
        const bottomData = data.slice(-3);

        // Menambahkan baris data teratas
        topData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item[0]}</td>
                <td>${item[1]}</td>
                <td>${item[2]}</td>
                <td>${item[3]}</td>
                <td>${item[4]}</td>
            `;
            previewTableBody.appendChild(row);
        });

        // Menambahkan baris penanda bahwa data terpotong
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="6" class="text-center">...data terpotong...</td>
        `;
        previewTableBody.appendChild(row);

        // Menambahkan baris data terbawah
        bottomData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${topData.length + index + 1}</td>
                <td>${item[0]}</td>
                <td>${item[1]}</td>
                <td>${item[2]}</td>
                <td>${item[3]}</td>
                <td>${item[4]}</td>
            `;
            previewTableBody.appendChild(row);
        });
    } else {
        // Jika data tidak terpotong, tampilkan semua
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item[0]}</td>
                <td>${item[1]}</td>
                <td>${item[2]}</td>
                <td>${item[3]}</td>
                <td>${item[4]}</td>
            `;
            previewTableBody.appendChild(row);
        });
    }

    previewContainer.style.display = 'block';

    // Menggeser halaman ke bawah ke bagian preview
    window.scrollTo({
        top: previewContainer.offsetTop, 
        behavior: 'smooth'
    });
}

function showAlert(message, type) {
    const alertDiv = document.getElementById('alertMessage');
    const alertText = document.getElementById('alertText');
    alertDiv.style.display = 'block';
    alertText.textContent = message;
    alertDiv.className = `alert alert-${type}`;
}

function showLoader(show) {
    const loader = document.getElementById('loader');
    loader.style.display = show ? 'inline-block' : 'none';
}
