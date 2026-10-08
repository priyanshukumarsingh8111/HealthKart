const HEALTH_RECORDS_KEY = "healthkartHealthRecords";

const recordsContainer = document.getElementById("recordsContainer");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const recordModal = document.getElementById("recordModal");
const recordForm = document.getElementById("recordForm");

function getRecords() {
    return JSON.parse(localStorage.getItem(HEALTH_RECORDS_KEY)) || [];
}

function saveRecords(records) {
    localStorage.setItem(
        HEALTH_RECORDS_KEY,
        JSON.stringify(records)
    );
}

function generateRecordId() {
    return "REC-" + Date.now();
}

function openRecordModal() {
    if (!recordModal) return;

    recordModal.classList.add("show");

    if (recordForm) {
        recordForm.reset();
    }
}

function closeRecordModal() {
    if (!recordModal) return;

    recordModal.classList.remove("show");
}

function addHealthRecord(event) {
    event.preventDefault();

    const recordName = document
        .getElementById("recordName")
        .value
        .trim();

    const doctorName = document
        .getElementById("doctorName")
        .value
        .trim();

    const recordDate = document
        .getElementById("recordDate")
        .value;

    const notes = document
        .getElementById("recordNotes")
        .value
        .trim();

    if (!recordName || !recordDate) {
        alert("Please fill the required fields.");
        return;
    }

    const records = getRecords();

    const newRecord = {
        id: generateRecordId(),
        name: recordName,
        doctor: doctorName || "Not specified",
        date: recordDate,
        notes: notes || "No notes added.",
        createdAt: new Date().toISOString()
    };

    records.unshift(newRecord);

    saveRecords(records);

    closeRecordModal();
    renderRecords();

    alert("Health record added successfully! ✅");
}

function renderRecords(searchTerm = "") {
    if (!recordsContainer || !emptyState) return;

    const records = getRecords();

    const filteredRecords = records.filter(function(record) {
        const searchText = searchTerm.toLowerCase();

        return (
            record.name.toLowerCase().includes(searchText) ||
            record.doctor.toLowerCase().includes(searchText) ||
            record.notes.toLowerCase().includes(searchText)
        );
    });

    recordsContainer.innerHTML = "";

    if (filteredRecords.length === 0) {
        emptyState.style.display = "block";
        return;
    }

    emptyState.style.display = "none";

    filteredRecords.forEach(function(record) {
        const card = createRecordCard(record);
        recordsContainer.appendChild(card);
    });
}

function createRecordCard(record) {
    const card = document.createElement("div");

    card.className = "record-card";

    card.innerHTML = `
        <div class="record-icon">
            <i class="fa-solid fa-file-medical"></i>
        </div>

        <div class="record-content">

            <h3>${escapeHTML(record.name)}</h3>

            <p class="record-doctor">
                <i class="fa-solid fa-user-doctor"></i>
                ${escapeHTML(record.doctor)}
            </p>

            <p class="record-date">
                <i class="fa-regular fa-calendar"></i>
                ${formatDate(record.date)}
            </p>

            <p class="record-notes">
                ${escapeHTML(record.notes)}
            </p>

            <div class="record-actions">

                <button
                    class="view-record"
                    type="button"
                    onclick="viewRecord('${record.id}')"
                >
                    <i class="fa-regular fa-eye"></i>
                    View
                </button>

                <button
                    class="delete-record"
                    type="button"
                    onclick="deleteRecord('${record.id}')"
                >
                    <i class="fa-solid fa-trash"></i>
                    Delete
                </button>

            </div>

        </div>
    `;

    return card;
}

function viewRecord(recordId) {
    const records = getRecords();

    const record = records.find(function(item) {
        return item.id === recordId;
    });

    if (!record) {
        alert("Record not found.");
        return;
    }

    alert(
        "Health Record\n\n" +
        "Record: " + record.name + "\n" +
        "Doctor/Hospital: " + record.doctor + "\n" +
        "Date: " + formatDate(record.date) + "\n\n" +
        "Notes:\n" + record.notes
    );
}

function deleteRecord(recordId) {
    const records = getRecords();

    const record = records.find(function(item) {
        return item.id === recordId;
    });

    if (!record) return;

    const confirmed = confirm(
        "Are you sure you want to delete this health record?"
    );

    if (!confirmed) return;

    const updatedRecords = records.filter(function(item) {
        return item.id !== recordId;
    });

    saveRecords(updatedRecords);

    renderRecords(
        searchInput ? searchInput.value.trim() : ""
    );

    alert("Health record deleted successfully.");
}

function formatDate(dateString) {
    if (!dateString) return "Date not available";

    const date = new Date(dateString + "T00:00:00");

    if (isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

if (recordForm) {
    recordForm.addEventListener(
        "submit",
        addHealthRecord
    );
}

if (searchInput) {
    searchInput.addEventListener(
        "input",
        function() {
            renderRecords(this.value.trim());
        }
    );
}

window.openRecordModal = openRecordModal;
window.closeRecordModal = closeRecordModal;
window.viewRecord = viewRecord;
window.deleteRecord = deleteRecord;

renderRecords();