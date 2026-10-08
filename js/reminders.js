// ========================================
// HEALTHKART - MEDICINE EATING & YOGA REMINDERS
// Real-time reminders with meal timing,
// doctor prescription sync, audio chimes,
// and status updates.
// ========================================

const STORAGE_KEY = "healthkartMedicineReminders";
let remindersList = [];
let activeFilter = "all";

function getLoggedInUser() {
    try {
        const str = localStorage.getItem("healthkart_auth_user");
        return str ? JSON.parse(str) : { email: "priya@healthkart.com", name: "Patient" };
    } catch (e) {
        return { email: "priya@healthkart.com", name: "Patient" };
    }
}

// Load reminders from server / cache
async function loadReminders() {
    const user = getLoggedInUser();
    const email = user ? user.email : "";

    try {
        const res = await fetch(`/api/reminders?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.success && data.reminders) {
            remindersList = data.reminders;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remindersList));
        } else {
            remindersList = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        }
    } catch (err) {
        console.warn("Using offline reminders cache:", err);
        remindersList = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    }

    renderSummaryMetrics();
    renderReminders();
}

function renderSummaryMetrics() {
    const todayCount = document.getElementById("todayCount");
    const medicineCount = document.getElementById("medicineCount");
    const yogaCount = document.getElementById("yogaCount");
    const doctorRxCount = document.getElementById("doctorRxCount");

    const total = remindersList.length;
    const meds = remindersList.filter(r => r.type === "medicine" || !r.type).length;
    const yogas = remindersList.filter(r => r.type === "yoga").length;
    const rx = remindersList.filter(r => !!r.prescriptionId).length;

    if (todayCount) todayCount.textContent = total;
    if (medicineCount) medicineCount.textContent = meds;
    if (yogaCount) yogaCount.textContent = yogas;
    if (doctorRxCount) doctorRxCount.textContent = rx;
}

function renderReminders() {
    const container = document.getElementById("reminderList");
    const emptyState = document.getElementById("emptyReminder");
    if (!container) return;

    let filtered = remindersList;
    if (activeFilter === "medicine") {
        filtered = remindersList.filter(r => r.type === "medicine" || !r.type);
    } else if (activeFilter === "yoga") {
        filtered = remindersList.filter(r => r.type === "yoga");
    } else if (activeFilter === "prescribed") {
        filtered = remindersList.filter(r => !!r.prescriptionId);
    }

    if (filtered.length === 0) {
        container.innerHTML = "";
        if (emptyState) emptyState.style.display = "flex";
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    container.innerHTML = filtered.map(item => {
        const isYoga = item.type === "yoga";
        const isTaken = item.status === "TAKEN" || item.status === "COMPLETED";

        const title = isYoga ? (item.yogaName || "Yoga Routine") : (item.medicineName || "Medicine");
        const badgeClass = isYoga ? "yoga-badge" : "medicine-badge";
        const badgeText = isYoga ? "Yoga & Pranayama" : "Medicine (Eating)";

        return `
            <div class="reminder-card ${isYoga ? 'card-yoga' : 'card-medicine'}" style="background:#fff; border:1px solid #e1ebe5; border-radius:16px; padding:20px; margin-bottom:14px; box-shadow:0 2px 8px rgba(0,0,0,0.03); display:flex; flex-direction:column; gap:12px; border-left: 5px solid ${isYoga ? '#0284c7' : '#0b9f6e'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; padding:3px 8px; border-radius:6px; background:${isYoga ? '#e0f2fe; color:#0284c7;' : '#eefaf4; color:#0b9f6e;'}">
                                ${badgeText}
                            </span>
                            ${item.prescriptionId ? `
                                <span style="font-size:10.5px; font-weight:800; background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:6px;">
                                    <i class="fa-solid fa-file-prescription"></i> Dr. Prescribed (${item.prescriptionId})
                                </span>
                            ` : ''}
                        </div>
                        <h3 style="margin:0 0 4px; font-size:17px; color:#1a2e26;">
                            <i class="${isYoga ? 'fa-solid fa-spa' : 'fa-solid fa-capsules'}" style="color:${isYoga ? '#0284c7' : '#0b9f6e'}; margin-right:6px;"></i>
                            ${escapeHTML(title)}
                        </h3>
                    </div>

                    <button type="button" onclick="deleteReminder('${item.id}')" title="Delete" style="background:none; border:none; color:#9baea5; cursor:pointer; font-size:15px; padding:4px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:14px; font-size:13px; color:#556960; background:#f8faf9; padding:10px 14px; border-radius:10px;">
                    <div><i class="fa-regular fa-clock" style="color:#0b9f6e;"></i> <strong>${item.reminderTime || 'Daily'}</strong></div>
                    ${!isYoga && item.dosage ? `<div><i class="fa-solid fa-prescription-bottle-medical"></i> Dose: <strong>${item.dosage}</strong></div>` : ''}
                    ${!isYoga && item.mealTiming ? `<div><i class="fa-solid fa-utensils" style="color:#d97706;"></i> Meal: <strong style="color:#b45309;">${item.mealTiming}</strong></div>` : ''}
                    ${isYoga && item.duration ? `<div><i class="fa-solid fa-stopwatch" style="color:#0284c7;"></i> Duration: <strong>${item.duration}</strong></div>` : ''}
                    ${isYoga && item.targetBenefit ? `<div><i class="fa-solid fa-heart-pulse"></i> Focus: <strong>${item.targetBenefit}</strong></div>` : ''}
                </div>

                ${item.instructions ? `
                    <p style="margin:0; font-size:12.5px; color:#687b72; font-style:italic;">
                        <i class="fa-solid fa-circle-info" style="color:#0b9f6e; margin-right:4px;"></i> ${item.instructions}
                    </p>
                ` : ''}

                <div style="display:flex; gap:10px; margin-top:4px;">
                    <button
                        type="button"
                        onclick="toggleReminderDone('${item.id}', ${isTaken})"
                        style="flex:1; padding:9px 14px; border:none; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; background:${isTaken ? '#e2ebe6; color:#3b5247;' : (isYoga ? '#0284c7; color:#fff;' : '#0b9f6e; color:#fff;')}"
                    >
                        <i class="fa-solid ${isTaken ? 'fa-check-double' : 'fa-check'}"></i>
                        ${isTaken ? (isYoga ? 'Yoga Completed Today' : 'Medicine Taken Today') : (isYoga ? 'Mark Completed' : 'Mark Taken')}
                    </button>
                    ${!isTaken ? `
                        <button
                            type="button"
                            onclick="snoozeReminderLocal('${item.id}')"
                            style="padding:9px 14px; background:#f0f5f2; color:#4d6056; border:1px solid #d8e2dc; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer;"
                        >
                            <i class="fa-solid fa-bell-slash"></i> Snooze 10m
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join("");
}

window.toggleReminderDone = async function(id, currentlyTaken) {
    const nextStatus = currentlyTaken ? "ACTIVE" : "TAKEN";
    try {
        await fetch(`/api/reminders/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus, updatedAt: new Date().toISOString() })
        });
        const rem = remindersList.find(r => r.id === id);
        if (rem) rem.status = nextStatus;

        if (window.HK_AI) {
            window.HK_AI.playChime("normal");
            if (nextStatus === "TAKEN") {
                window.HK_AI.speak("Marked as taken. Well done on keeping consistent with your health routine!");
            }
        }
        renderReminders();
    } catch (e) {
        console.warn("Update error:", e);
    }
};

window.snoozeReminderLocal = function(id) {
    const rem = remindersList.find(r => r.id === id);
    if (rem && rem.reminderTime) {
        const [h, m] = rem.reminderTime.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m + 10);
        rem.reminderTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        renderReminders();
        if (window.HK_AI) {
            window.HK_AI.speak("Reminder snoozed for 10 minutes.");
        }
    }
};

window.deleteReminder = async function(id) {
    if (!confirm("Are you sure you want to remove this health reminder?")) return;
    try {
        await fetch(`/api/reminders/${id}`, { method: "DELETE" });
        remindersList = remindersList.filter(r => r.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remindersList));
        renderSummaryMetrics();
        renderReminders();
    } catch (e) {
        console.warn("Delete error:", e);
    }
};

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Modal open & close
const modal = document.getElementById("reminderModal");
const addBtn = document.getElementById("addReminderButton");
const emptyAddBtn = document.getElementById("emptyAddButton");
const closeBtn = document.getElementById("closeReminderModal");
const testAudioBtn = document.getElementById("testAudioReminderBtn");

function openModal() {
    if (modal) modal.style.display = "flex";
}
function closeModal() {
    if (modal) modal.style.display = "none";
}

if (addBtn) addBtn.onclick = openModal;
if (emptyAddBtn) emptyAddBtn.onclick = openModal;
if (closeBtn) closeBtn.onclick = closeModal;

if (testAudioBtn) {
    testAudioBtn.onclick = () => {
        if (window.HK_AI) {
            window.HK_AI.playChime("yoga");
            window.HK_AI.speak("Testing audio chime and voice notification. Your real-time health reminders are fully operational.");
        } else {
            alert("Reminder Chime Test: Audio chime is active.");
        }
    };
}

// Medicine vs Yoga form switch
const typeTabMedicine = document.getElementById("typeTabMedicine");
const typeTabYoga = document.getElementById("typeTabYoga");
const medGroup = document.getElementById("medicineFieldsGroup");
const yogaGroup = document.getElementById("yogaFieldsGroup");
const reminderTypeInput = document.getElementById("reminderType");

if (typeTabMedicine && typeTabYoga) {
    typeTabMedicine.onclick = () => {
        typeTabMedicine.style.background = "#0b9f6e";
        typeTabMedicine.style.color = "#fff";
        typeTabYoga.style.background = "transparent";
        typeTabYoga.style.color = "#51665c";
        medGroup.style.display = "block";
        yogaGroup.style.display = "none";
        reminderTypeInput.value = "medicine";
    };

    typeTabYoga.onclick = () => {
        typeTabYoga.style.background = "#0284c7";
        typeTabYoga.style.color = "#fff";
        typeTabMedicine.style.background = "transparent";
        typeTabMedicine.style.color = "#51665c";
        medGroup.style.display = "none";
        yogaGroup.style.display = "block";
        reminderTypeInput.value = "yoga";
    };
}

// Form Submit
const form = document.getElementById("reminderForm");
if (form) {
    form.onsubmit = async (e) => {
        e.preventDefault();

        const type = reminderTypeInput.value;
        const reminderTime = document.getElementById("reminderTime").value;
        const frequency = document.getElementById("frequency").value;
        const instructions = document.getElementById("reminderInstructions").value.trim();
        const user = getLoggedInUser();

        let payload = {
            type,
            reminderTime,
            frequency,
            instructions,
            userEmail: user ? user.email : "priya@healthkart.com"
        };

        if (type === "medicine") {
            const medicineName = document.getElementById("medicineName").value.trim();
            const dosage = document.getElementById("dosage").value.trim() || "1 Dose";
            const mealTiming = document.getElementById("mealTiming").value;

            if (!medicineName) {
                alert("Please enter medicine name.");
                return;
            }

            payload = {
                ...payload,
                medicineName,
                dosage,
                mealTiming,
                instructions: instructions || `Take ${mealTiming.toLowerCase()} with a glass of water.`
            };
        } else {
            const yogaName = document.getElementById("yogaName").value.trim();
            const yogaDuration = document.getElementById("yogaDuration").value.trim() || "15 Mins";
            const yogaBenefit = document.getElementById("yogaBenefit").value.trim() || "Energy and posture relief";

            if (!yogaName) {
                alert("Please enter yoga routine name.");
                return;
            }

            payload = {
                ...payload,
                yogaName,
                duration: yogaDuration,
                targetBenefit: yogaBenefit,
                instructions: instructions || "Practice on an empty stomach with deep mindful breathing."
            };
        }

        try {
            const res = await fetch("/api/reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save reminder");

            alert(`${type === "yoga" ? "Yoga" : "Medicine"} reminder scheduled successfully!`);
            closeModal();
            form.reset();
            loadReminders();

            if (window.HK_AI) {
                window.HK_AI.playChime("normal");
                window.HK_AI.loadData();
            }
        } catch (err) {
            console.error("Save error:", err);
            alert(err.message || "Failed to save reminder.");
        }
    };
}

// Filter Tab Buttons
document.querySelectorAll(".tab-filter-btn").forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll(".tab-filter-btn").forEach(b => {
            b.classList.remove("active");
            b.style.background = "#fff";
            b.style.color = "#31473d";
        });
        this.classList.add("active");
        this.style.background = "#0b9f6e";
        this.style.color = "#fff";
        activeFilter = this.dataset.filter;
        renderReminders();
    };
});

// Socket updates
if (typeof io !== "undefined") {
    const socket = io();
    socket.on("reminders_updated", () => loadReminders());
    socket.on("new_prescription", () => loadReminders());
}

document.addEventListener("DOMContentLoaded", () => {
    loadReminders();
});