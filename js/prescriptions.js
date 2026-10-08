// ========================================
// HEALTHKART - PRESCRIPTIONS
// Doctor-issued digital prescriptions & file uploads
// ========================================

const STORAGE_KEY = "healthkartPrescriptions";
let digitalPrescriptions = [];

function getLoggedInUser() {
    try {
        const str = localStorage.getItem("healthkart_auth_user");
        return str ? JSON.parse(str) : { email: "priya@healthkart.com", name: "Patient" };
    } catch (e) {
        return { email: "priya@healthkart.com", name: "Patient" };
    }
}

async function loadPrescriptions() {
    const user = getLoggedInUser();
    const email = user ? user.email : "";

    try {
        const res = await fetch(`/api/prescriptions?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.success && data.prescriptions) {
            digitalPrescriptions = data.prescriptions;
        }
    } catch (err) {
        console.warn("Could not load digital prescriptions:", err);
    }

    renderDigitalPrescriptions();
    loadUploadedFiles();
}

function renderDigitalPrescriptions() {
    const container = document.getElementById("digitalRxList");
    const emptyState = document.getElementById("emptyPrescription");
    if (!container) return;

    if (digitalPrescriptions.length === 0) {
        container.innerHTML = "";
        if (emptyState) emptyState.style.display = "flex";
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    container.innerHTML = digitalPrescriptions.map(rx => {
        const dateStr = rx.createdAt ? new Date(rx.createdAt).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric"
        }) : "Recent";

        return `
            <div class="digital-rx-card" style="background:#fff; border:1px solid #dce8e2; border-radius:16px; padding:20px; box-shadow:0 4px 14px rgba(10,40,26,0.04); display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span style="font-size:11px; font-weight:800; background:#eefaf4; color:#0b9f6e; padding:3px 8px; border-radius:6px; display:inline-block; margin-bottom:4px;">
                            ${rx.id}
                        </span>
                        <h3 style="margin:0; font-size:17px; color:#172a22;">${rx.doctorName}</h3>
                        <p style="margin:2px 0 0; font-size:12.5px; color:#62756c;">${rx.doctorSpecialization} • ${rx.doctorHospital}</p>
                    </div>
                    <span style="font-size:12px; color:#788b82; font-weight:600;"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                </div>

                <div style="background:#f7faf8; border:1px solid #e2ece7; border-radius:10px; padding:12px; font-size:13px; color:#354a40;">
                    <strong>Diagnosis:</strong> ${rx.diagnosis}
                </div>

                <!-- Medicines List -->
                ${rx.medicines && rx.medicines.length ? `
                    <div>
                        <h4 style="margin:0 0 6px; font-size:12px; font-weight:800; color:#0b9f6e; text-transform:uppercase;">
                            <i class="fa-solid fa-pills"></i> Prescribed Medicines (Meal Timing):
                        </h4>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${rx.medicines.map(m => `
                                <div style="font-size:12.5px; color:#22362e; display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #eef3f0; border-radius:6px; padding:6px 10px;">
                                    <span><strong>${m.name}</strong> (${m.dosage || '1 Dose'})</span>
                                    <span style="font-size:11px; font-weight:700; color:#b45309; background:#fffbeb; padding:2px 6px; border-radius:4px;">
                                        <i class="fa-solid fa-utensils"></i> ${m.mealTiming || 'After food'}
                                    </span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                ` : ''}

                <!-- Yoga List -->
                ${rx.yogaRoutines && rx.yogaRoutines.length ? `
                    <div>
                        <h4 style="margin:0 0 6px; font-size:12px; font-weight:800; color:#0284c7; text-transform:uppercase;">
                            <i class="fa-solid fa-spa"></i> Prescribed Yoga & Lifestyle:
                        </h4>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${rx.yogaRoutines.map(y => `
                                <div style="font-size:12.5px; color:#22362e; display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #eef3f0; border-radius:6px; padding:6px 10px;">
                                    <span><strong>${y.poseName}</strong> (${y.duration || '15 mins'})</span>
                                    <span style="font-size:11px; font-weight:700; color:#0284c7; background:#e0f2fe; padding:2px 6px; border-radius:4px;">
                                        <i class="fa-regular fa-clock"></i> ${y.timing || 'Morning'}
                                    </span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                ` : ''}

                ${rx.advice ? `
                    <div style="font-size:12px; color:#607369; font-style:italic;">
                        <i class="fa-solid fa-quote-left" style="color:#0b9f6e; margin-right:4px;"></i>${rx.advice}
                    </div>
                ` : ''}

                <div style="display:flex; gap:10px; margin-top:4px;">
                    <button type="button" onclick="viewPrescriptionSlip('${rx.id}')" style="flex:1; padding:9px 12px; background:#0b9f6e; color:#fff; border:none; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer;">
                        <i class="fa-solid fa-eye"></i> View Official Slip
                    </button>
                    <button type="button" onclick="syncRxToReminders('${rx.id}')" style="padding:9px 12px; background:#eefaf4; color:#0b9f6e; border:1px solid #bce6d4; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer;" title="Ensure medicine eating & yoga reminders are scheduled in AI Agent">
                        <i class="fa-solid fa-rotate"></i> Sync AI Reminders
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

window.viewPrescriptionSlip = function(rxId) {
    const rx = digitalPrescriptions.find(p => p.id === rxId);
    if (!rx) return;

    const modal = document.getElementById("rxDetailModal");
    const hospEl = document.getElementById("slipDoctorHospital");
    const content = document.getElementById("rxSlipContent");

    if (hospEl) hospEl.textContent = `${rx.doctorName} • ${rx.doctorHospital}`;

    if (content) {
        content.innerHTML = `
            <div style="margin-bottom:14px; padding-bottom:12px; border-bottom:1px dashed #d5e2dc; display:flex; justify-content:space-between; font-size:13px; color:#42554d;">
                <div>
                    <div>Patient: <strong>${rx.patientName}</strong></div>
                    <div>Mobile: ${rx.patientMobile || '-'}</div>
                </div>
                <div style="text-align:right;">
                    <div>Prescription ID: <strong>${rx.id}</strong></div>
                    <div>Date: ${rx.createdAt ? new Date(rx.createdAt).toLocaleDateString() : 'Today'}</div>
                </div>
            </div>

            <div style="margin-bottom:14px;">
                <div style="font-size:12px; font-weight:800; color:#0b9f6e; text-transform:uppercase; margin-bottom:4px;">Diagnosis:</div>
                <div style="font-size:14px; font-weight:600; color:#172a22;">${rx.diagnosis}</div>
            </div>

            <!-- Medicines Table -->
            <div style="margin-bottom:16px;">
                <div style="font-size:12px; font-weight:800; color:#0b9f6e; text-transform:uppercase; margin-bottom:6px;">Rx Medications & Eating Schedule:</div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#f4f9f6; text-align:left; border-bottom:1px solid #cfe0d8;">
                            <th style="padding:8px;">Medicine</th>
                            <th style="padding:8px;">Dosage</th>
                            <th style="padding:8px;">Meal Timing</th>
                            <th style="padding:8px;">Frequency</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(rx.medicines || []).map(m => `
                            <tr style="border-bottom:1px solid #eef4f1;">
                                <td style="padding:8px; font-weight:700;">${m.name}</td>
                                <td style="padding:8px;">${m.dosage || '1 Dose'}</td>
                                <td style="padding:8px; color:#b45309; font-weight:700;">${m.mealTiming || 'After food'}</td>
                                <td style="padding:8px;">${m.frequency || 'Daily'}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>

            <!-- Yoga Routines -->
            <div style="margin-bottom:16px;">
                <div style="font-size:12px; font-weight:800; color:#0284c7; text-transform:uppercase; margin-bottom:6px;">Recommended Yoga & Lifestyle:</div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#f0f9ff; text-align:left; border-bottom:1px solid #bee3f8;">
                            <th style="padding:8px;">Pose / Routine</th>
                            <th style="padding:8px;">Timing</th>
                            <th style="padding:8px;">Duration</th>
                            <th style="padding:8px;">Benefit Focus</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(rx.yogaRoutines || []).map(y => `
                            <tr style="border-bottom:1px solid #eef7fc;">
                                <td style="padding:8px; font-weight:700;">${y.poseName}</td>
                                <td style="padding:8px;">${y.timing || '07:00 AM'}</td>
                                <td style="padding:8px;">${y.duration || '15 Mins'}</td>
                                <td style="padding:8px;">${y.targetBenefit || 'Mobility'}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>

            ${rx.advice ? `
                <div style="background:#f9fbfb; border:1px solid #e2ece7; border-radius:8px; padding:10px 14px; font-size:12.5px; color:#495d53;">
                    <strong>Physician Advice:</strong> ${rx.advice}
                </div>
            ` : ''}
        `;
    }

    if (modal) modal.style.display = "flex";
};

window.syncRxToReminders = async function(rxId) {
    const rx = digitalPrescriptions.find(p => p.id === rxId);
    if (!rx) return;

    if (window.HK_AI) {
        window.HK_AI.playChime("yoga");
        window.HK_AI.speak(`Synchronizing ${rx.doctorName}'s prescription. Medicine eating schedules and yoga reminders are fully active!`);
        window.HK_AI.loadData();
    }
    alert(`Prescription ${rx.id} synced with AI Health Agent!\nAll medicine eating times and yoga routines are active in your daily schedule.`);
};

// ========================================
// FILE UPLOAD FUNCTIONALITY
// ========================================
function loadUploadedFiles() {
    const list = document.getElementById("prescriptionList");
    if (!list) return;

    const files = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    list.innerHTML = "";

    files.forEach((f, idx) => {
        const card = document.createElement("div");
        card.className = "prescription-card";
        card.innerHTML = `
            <div class="prescription-card-header">
                <div class="prescription-file-icon">
                    <i class="fa-solid fa-file-medical"></i>
                </div>
                <div class="prescription-file-name">
                    <strong>${f.name}</strong>
                    <span>${f.size || '120 KB'} • Uploaded Document</span>
                </div>
                <button class="delete-prescription" type="button" title="Delete" onclick="deleteUploadedFile(${idx})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="prescription-card-footer">
                <span class="prescription-date">Uploaded ${f.date || 'Recently'}</span>
                <span class="view-prescription"><i class="fa-solid fa-check"></i> Verified</span>
            </div>
        `;
        list.appendChild(card);
    });
}

window.deleteUploadedFile = function(idx) {
    const files = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    files.splice(idx, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    loadUploadedFiles();
};

// Upload Modal Events
const uploadModal = document.getElementById("uploadModal");
const uploadBtn = document.getElementById("uploadPrescriptionButton");
const emptyUploadBtn = document.getElementById("emptyUploadButton");
const closeUploadBtn = document.getElementById("closeModal");
const fileInput = document.getElementById("prescriptionFile");
const selectedFileEl = document.getElementById("selectedFile");
const confirmUploadBtn = document.getElementById("confirmUpload");

if (uploadBtn) uploadBtn.onclick = () => { if (uploadModal) uploadModal.classList.add("show"); };
if (emptyUploadBtn) emptyUploadBtn.onclick = () => { if (uploadModal) uploadModal.classList.add("show"); };
if (closeUploadBtn) closeUploadBtn.onclick = () => { if (uploadModal) uploadModal.classList.remove("show"); };

if (fileInput) {
    fileInput.onchange = () => {
        if (fileInput.files[0] && selectedFileEl) {
            selectedFileEl.textContent = fileInput.files[0].name;
        }
    };
}

if (confirmUploadBtn) {
    confirmUploadBtn.onclick = () => {
        if (!fileInput.files[0]) {
            alert("Please select a file to upload.");
            return;
        }
        const file = fileInput.files[0];
        const files = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        files.unshift({
            name: file.name,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            date: new Date().toLocaleDateString("en-IN")
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
        alert("Prescription document uploaded successfully!");
        if (uploadModal) uploadModal.classList.remove("show");
        fileInput.value = "";
        if (selectedFileEl) selectedFileEl.textContent = "No file selected";
        loadUploadedFiles();
    };
}

// Socket updates
if (typeof io !== "undefined") {
    const socket = io();
    socket.on("new_prescription", () => loadPrescriptions());
}

document.addEventListener("DOMContentLoaded", () => {
    loadPrescriptions();
});