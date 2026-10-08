// ========================================
// HEALTHKART - MY APPOINTMENTS
// Manage bookings, launch WebRTC video call,
// cancel appointments, filter by status.
// ========================================

import { confirmDialog, toast } from "./ui.js";
import { db } from "./firebase-config.js";
import {
    collection,
    getDocs,
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let userAppointments = [];
let activeTab = "upcoming";

function getLoggedInUser() {
    try {
        const str = localStorage.getItem("healthkart_auth_user");
        return str ? JSON.parse(str) : null;
    } catch (e) {
        return null;
    }
}

async function loadAppointments() {
    const list = document.getElementById("appointmentsList");
    const user = getLoggedInUser();
    const email = user ? (user.email || "").toLowerCase() : "";

    let firestoreList = [];
    try {
        if (db) {
            const querySnapshot = await getDocs(collection(db, "appointments"));
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data) {
                    if (!email || !data.patientEmail || data.patientEmail.toLowerCase() === email) {
                        firestoreList.push(data);
                    }
                }
            });
        }
    } catch (fsErr) {
        console.warn("Could not read appointments from Firestore:", fsErr);
    }

    let backendList = [];
    try {
        const res = await fetch(`/api/appointments/my?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.success && data.appointments) {
            backendList = data.appointments;
        }
    } catch (err) {
        console.warn("Backend appointments API unavailable:", err);
    }

    const cachedList = JSON.parse(localStorage.getItem("healthkartAppointments")) || [];

    // Merge all lists uniquely by appointmentId
    const mergedMap = new Map();
    // 1. Cached appointments
    cachedList.forEach(a => { if (a && a.appointmentId) mergedMap.set(a.appointmentId, a); });
    // 2. Backend appointments
    backendList.forEach(a => { if (a && a.appointmentId) mergedMap.set(a.appointmentId, a); });
    // 3. Firestore appointments (highest priority source of truth)
    firestoreList.forEach(a => { if (a && a.appointmentId) mergedMap.set(a.appointmentId, a); });

    userAppointments = Array.from(mergedMap.values());
    renderTabs();
    setupRealtimeAppointments();
}

let firestoreUserUnsub = null;
function setupRealtimeAppointments() {
    if (!db) return;
    if (firestoreUserUnsub) firestoreUserUnsub();
    try {
        const user = getLoggedInUser();
        const email = user ? (user.email || "").toLowerCase() : "";
        firestoreUserUnsub = onSnapshot(collection(db, "appointments"), (snapshot) => {
            let changed = false;
            snapshot.docChanges().forEach((change) => {
                const item = change.doc.data();
                if (item && (!email || !item.patientEmail || item.patientEmail.toLowerCase() === email)) {
                    const idx = userAppointments.findIndex(a => a.appointmentId === item.appointmentId);
                    if (change.type === "added" || change.type === "modified") {
                        if (idx >= 0) userAppointments[idx] = item;
                        else userAppointments.unshift(item);
                        changed = true;
                    } else if (change.type === "removed" && idx >= 0) {
                        userAppointments.splice(idx, 1);
                        changed = true;
                    }
                }
            });
            if (changed) renderTabs();
        });
    } catch (e) {
        console.warn("Real-time appointments snapshot unavailable:", e);
    }
}

function renderTabs() {
    const upcoming = userAppointments.filter(a => a.status === "CONFIRMED");
    const completed = userAppointments.filter(a => a.status === "COMPLETED");
    const cancelled = userAppointments.filter(a => a.status === "CANCELLED");

    document.getElementById("countUpcoming").textContent = upcoming.length;
    document.getElementById("countCompleted").textContent = completed.length;
    document.getElementById("countCancelled").textContent = cancelled.length;

    let displayList = [];
    if (activeTab === "upcoming") displayList = upcoming;
    else if (activeTab === "completed") displayList = completed;
    else if (activeTab === "cancelled") displayList = cancelled;

    renderList(displayList);
}

function formatDate(dateStr) {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }
    return dateStr;
}

function renderList(items) {
    const container = document.getElementById("appointmentsList");
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-appts">
                <i class="fa-regular fa-calendar-xmark"></i>
                <h3>No ${activeTab} appointments</h3>
                <p>You don't have any ${activeTab} doctor appointments right now.</p>
                ${activeTab === 'upcoming' ? `
                    <a href="doctors.html" class="book-new-btn">
                        <i class="fa-solid fa-user-doctor"></i> Find a Doctor & Book Now
                    </a>
                ` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(appt => {
        const docImg = appt.doctorImage || "../images/doctors/rahul-sharma.jpg";
        const isUpcoming = appt.status === "CONFIRMED";

        return `
            <article class="appointment-card-item">
                <div class="doctor-thumb">
                    <img
                        src="${docImg}"
                        alt="${appt.doctorName}"
                        onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600';"
                    >
                </div>

                <div class="appointment-info">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                        <span style="font-size:11px; font-weight:800; background:#f0faf6; color:#0b9f6e; padding:3px 8px; border-radius:6px;">
                            ID: ${appt.appointmentId}
                        </span>
                        <span style="font-size:12px; color:#718279;">Patient: <strong>${appt.patientName}</strong></span>
                    </div>

                    <h3>${appt.doctorName}</h3>
                    <p class="doctor-spec">${appt.specialization} &bull; ${appt.clinicHospital || 'Partner Clinic'}</p>

                    <div class="appointment-meta">
                        <span><i class="fa-regular fa-calendar"></i> ${formatDate(appt.appointmentDate)}</span>
                        <span><i class="fa-regular fa-clock"></i> ${appt.appointmentTime}</span>
                        <span><i class="fa-solid fa-video"></i> ${appt.consultationType || 'Video Consultation'}</span>
                        <span><i class="fa-solid fa-indian-rupee-sign"></i> ₹${appt.consultationFee}</span>
                    </div>

                    ${appt.healthConcern ? `
                        <p style="margin:8px 0 0; font-size:12px; color:#687b72; font-style:italic;">
                            Reason: "${appt.healthConcern}"
                        </p>
                    ` : ''}
                </div>

                <div class="appointment-status-col">
                    <span class="badge-status ${appt.status.toLowerCase()}">
                        <i class="fa-solid fa-circle" style="font-size:6px;"></i> ${appt.status}
                    </span>

                    ${isUpcoming ? `
                        <div class="action-buttons">
                            <a
                                href="video-consultation.html?appointmentId=${appt.appointmentId}&role=patient"
                                class="btn-video-call"
                                title="Launch WebRTC Video Consultation"
                            >
                                <i class="fa-solid fa-video"></i> Start Video Consultation
                            </a>
                            <button
                                type="button"
                                class="btn-cancel-appt"
                                onclick="cancelAppointment('${appt.appointmentId}')"
                            >
                                <i class="fa-solid fa-xmark"></i> Cancel
                            </button>
                        </div>
                    ` : ''}
                </div>
            </article>
        `;
    }).join("");
}

// Cancel Appointment Handler (Requirement 12)
window.cancelAppointment = async function(appointmentId) {
    const confirmed = await confirmDialog({
        title: "Cancel Appointment",
        message: "Are you sure you want to cancel this appointment? Your booked time slot will become available for other patients.",
        confirmText: "Yes, Cancel Booking",
        danger: true
    });

    if (!confirmed) return;

    try {
        // 1. Update in Firestore
        try {
            if (db) {
                await updateDoc(doc(db, "appointments", appointmentId), {
                    status: "CANCELLED",
                    cancelledAt: serverTimestamp()
                });
                console.log("Appointment status cancelled in Firestore:", appointmentId);
            }
        } catch (fsErr) {
            console.warn("Could not cancel in Firestore directly:", fsErr);
        }

        // 2. Call backend cancellation API
        try {
            const res = await fetch(`/api/appointments/${appointmentId}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "Cancelled by patient" })
            });
            const data = await res.json();
            if (!res.ok) console.warn("Backend cancel response:", data);
        } catch (beErr) {
            console.warn("Backend cancel error:", beErr);
        }

        toast("Appointment cancelled successfully. The slot is now available again.", "success");

        // 3. Update local appointment state
        const appt = userAppointments.find(a => a.appointmentId === appointmentId);
        if (appt) {
            appt.status = "CANCELLED";
        }

        // 4. Update localStorage cache
        try {
            const cached = JSON.parse(localStorage.getItem("healthkartAppointments")) || [];
            const updated = cached.map(a => a.appointmentId === appointmentId ? { ...a, status: "CANCELLED" } : a);
            localStorage.setItem("healthkartAppointments", JSON.stringify(updated));
        } catch (e) {}

        renderTabs();

    } catch (err) {
        console.error("Cancel failed:", err);
        toast(err.message || "Could not cancel appointment.", "error");
    }
};

// Tabs Switching
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            activeTab = this.dataset.tab;
            renderTabs();
        });
    });

    loadAppointments();
});
