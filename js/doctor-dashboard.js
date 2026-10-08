// ========================================
// HEALTHKART - DOCTOR DASHBOARD
// Portal for doctors to view today's & upcoming
// consultations and start WebRTC calls.
// ========================================

const DOCTORS_META = {
    rahul: {
        name: "Dr. Rahul Sharma",
        specialization: "General Physician",
        hospital: "Max Super Speciality Hospital, New Delhi",
        image: "../images/doctors/rahul-sharma.jpg"
    },
    priya: {
        name: "Dr. Priya Mehta",
        specialization: "Dermatologist",
        hospital: "Apollo Spectra Hospitals, Mumbai",
        image: "../images/doctors/priya-mehta.jpg"
    },
    amit: {
        name: "Dr. Amit Verma",
        specialization: "Cardiologist",
        hospital: "Fortis Escorts Heart Institute, Bengaluru",
        image: "../images/doctors/amit-verma.jpg"
    },
    neha: {
        name: "Dr. Neha Kapoor",
        specialization: "Pediatrician",
        hospital: "Cloudnine Hospital, Gurugram",
        image: "../images/doctors/neha-kapoor.jpg"
    },
    arjun: {
        name: "Dr. Arjun Singh",
        specialization: "Orthopedic",
        hospital: "Manipal Hospital, Hyderabad",
        image: "../images/doctors/arjun-singh.jpg"
    },
    ananya: {
        name: "Dr. Ananya Gupta",
        specialization: "General Physician",
        hospital: "Artemis Hospital, Noida",
        image: "../images/doctors/ananya-gupta.jpg"
    }
};

import { db } from "./firebase-config.js";
import {
    collection,
    getDocs,
    onSnapshot,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let currentDoctorId = "rahul";
let doctorAppointments = [];
let activeTab = "upcoming";
let firestoreUnsubscribe = null;

function getLoggedInDoctorId() {
    try {
        const u = JSON.parse(localStorage.getItem("healthkart_auth_user"));
        if (u && u.role === "doctor" && u.doctorId) return u.doctorId;
    } catch (e) {}
    return "rahul";
}

async function loadDoctorDashboard(doctorId) {
    currentDoctorId = doctorId || getLoggedInDoctorId();

    const docMeta = DOCTORS_META[currentDoctorId] || DOCTORS_META.rahul;
    document.getElementById("dashDoctorName").textContent = docMeta.name;
    document.getElementById("dashDoctorHospital").textContent = `${docMeta.specialization} • ${docMeta.hospital}`;
    document.getElementById("dashDoctorAvatar").src = docMeta.image;
    document.getElementById("doctorSelectDropdown").value = currentDoctorId;

    // Fetch from Firestore
    let firestoreAppts = [];
    try {
        if (db) {
            const snap = await getDocs(collection(db, "appointments"));
            snap.forEach(d => {
                const item = d.data();
                if (item && item.doctorId === currentDoctorId) {
                    firestoreAppts.push(item);
                }
            });
        }
    } catch (fsErr) {
        console.warn("Could not fetch appointments from Firestore:", fsErr);
    }

    // Fetch from Backend
    let backendAppts = [];
    try {
        const res = await fetch(`/api/appointments/doctor/${currentDoctorId}`);
        const data = await res.json();
        if (data.success && data.all) {
            backendAppts = data.all;
        }
    } catch (err) {
        console.warn("Could not fetch doctor appointments from backend:", err);
    }

    // Merge cached, backend, and Firestore
    const cached = JSON.parse(localStorage.getItem("healthkartAppointments")) || [];
    const cachedAppts = cached.filter(a => a.doctorId === currentDoctorId);

    const merged = new Map();
    cachedAppts.forEach(a => { if (a && a.appointmentId) merged.set(a.appointmentId, a); });
    backendAppts.forEach(a => { if (a && a.appointmentId) merged.set(a.appointmentId, a); });
    firestoreAppts.forEach(a => { if (a && a.appointmentId) merged.set(a.appointmentId, a); });

    doctorAppointments = Array.from(merged.values());

    renderMetrics();
    renderTabAppointments();

    // Setup real-time listener on Firestore appointments
    setupRealtimeDoctorAppointments();
}

function setupRealtimeDoctorAppointments() {
    if (!db) return;
    if (firestoreUnsubscribe) firestoreUnsubscribe();

    try {
        firestoreUnsubscribe = onSnapshot(collection(db, "appointments"), (snapshot) => {
            let changed = false;
            snapshot.docChanges().forEach((change) => {
                const item = change.doc.data();
                if (item && item.doctorId === currentDoctorId) {
                    const idx = doctorAppointments.findIndex(a => a.appointmentId === item.appointmentId);
                    if (change.type === "added" || change.type === "modified") {
                        if (idx >= 0) {
                            doctorAppointments[idx] = item;
                        } else {
                            doctorAppointments.unshift(item);
                        }
                        changed = true;
                    } else if (change.type === "removed") {
                        if (idx >= 0) {
                            doctorAppointments.splice(idx, 1);
                            changed = true;
                        }
                    }
                }
            });
            if (changed) {
                renderMetrics();
                renderTabAppointments();
            }
        });
    } catch (e) {
        console.warn("Real-time Firestore listener unavailable:", e);
    }
}

function renderMetrics() {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayAppts = doctorAppointments.filter(a => a.appointmentDate === todayStr && a.status === "CONFIRMED");
    const upcomingAppts = doctorAppointments.filter(a => a.status === "CONFIRMED");

    document.getElementById("statTodayCount").textContent = todayAppts.length;
    document.getElementById("statUpcomingCount").textContent = upcomingAppts.length;
    document.getElementById("statTotalCount").textContent = doctorAppointments.length;
}

function renderTabAppointments() {
    const todayStr = new Date().toISOString().split("T")[0];
    let filtered = [];

    if (activeTab === "upcoming") {
        filtered = doctorAppointments.filter(a => a.status === "CONFIRMED");
    } else if (activeTab === "today") {
        filtered = doctorAppointments.filter(a => a.appointmentDate === todayStr);
    } else {
        filtered = doctorAppointments;
    }

    const container = document.getElementById("doctorApptList");
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="background:#fff; border:1px dashed #cfe0d8; border-radius:16px; padding:50px 20px; text-align:center; color:#687b72;">
                <i class="fa-regular fa-calendar-check" style="font-size:38px; color:#0b9f6e; margin-bottom:12px; display:block;"></i>
                <h3 style="margin:0 0 6px; font-size:17px; color:#1f332a;">No ${activeTab} consultations</h3>
                <p style="margin:0; font-size:13px;">There are no scheduled patient appointments in this view.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(a => {
        const isConfirmed = a.status === "CONFIRMED";

        return `
            <div class="doctor-appt-card">
                <div class="patient-cell">
                    <span style="font-size:10px; font-weight:800; color:#0b9f6e; background:#eefaf4; padding:2px 6px; border-radius:4px; display:inline-block; margin-bottom:4px;">
                        ${a.appointmentId}
                    </span>
                    <strong>${a.patientName}</strong>
                    <span>Phone: ${a.patientMobile} &bull; Email: ${a.patientEmail || '-'}</span>
                    <p style="margin:4px 0 0; font-size:12px; color:#52645b; font-style:italic;">
                        "${a.healthConcern || 'General Checkup'}"
                    </p>
                </div>

                <div class="date-cell">
                    <i class="fa-regular fa-calendar"></i>
                    ${a.appointmentDate}
                </div>

                <div class="time-cell">
                    <i class="fa-regular fa-clock"></i>
                    ${a.appointmentTime}
                </div>

                <div>
                    <span class="badge-status ${a.status.toLowerCase()}" style="font-size:11px; padding:4px 10px; border-radius:20px; font-weight:800;">
                        ${a.status}
                    </span>
                </div>

                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${isConfirmed ? `
                        <button
                            type="button"
                            class="btn-start-call"
                            onclick="joinAsDoctor('${a.appointmentId}')"
                            title="Join WebRTC Video Consultation Room"
                        >
                            <i class="fa-solid fa-video"></i> Start Consultation
                        </button>
                        <button
                            type="button"
                            class="btn-prescribe"
                            onclick="openDoctorPrescriptionModal('${a.appointmentId}')"
                            title="Write digital prescription for patient"
                        >
                            <i class="fa-solid fa-file-prescription"></i> Write Prescription
                        </button>
                    ` : `
                        <span style="font-size:12px; color:#84948c;">Completed</span>
                    `}
                </div>
            </div>
        `;
    }).join("");
}

window.joinAsDoctor = function(appointmentId) {
    // Save doctor auth session
    const docMeta = DOCTORS_META[currentDoctorId] || DOCTORS_META.rahul;
    const doctorUser = {
        uid: "doc_" + currentDoctorId,
        email: `dr.${currentDoctorId}@healthkart.com`,
        displayName: docMeta.name,
        name: docMeta.name,
        role: "doctor",
        doctorId: currentDoctorId
    };
    localStorage.setItem("healthkart_auth_user", JSON.stringify(doctorUser));

    // Open video consultation room with explicit doctor role
    window.location.href = `video-consultation.html?appointmentId=${appointmentId}&role=doctor`;
};

// ==========================================
// DOCTOR DASHBOARD PRESCRIPTION WRITING
// ==========================================
window.openDoctorPrescriptionModal = function(appointmentId) {
    const appt = doctorAppointments.find(a => a.appointmentId === appointmentId);
    if (!appt) return;

    const modal = document.getElementById("doctorDashboardRxModal");
    const subtitle = document.getElementById("rxModalSubtitle");
    if (subtitle) {
        subtitle.textContent = `Patient: ${appt.patientName} • Health Concern: "${appt.healthConcern || 'General Checkup'}"`;
    }

    document.getElementById("dashRxAppointmentId").value = appt.appointmentId;
    document.getElementById("dashRxPatientName").value = appt.patientName;
    document.getElementById("dashRxPatientEmail").value = appt.patientEmail || "priya@healthkart.com";
    document.getElementById("dashRxPatientMobile").value = appt.patientMobile || "";

    const medContainer = document.getElementById("dashRxMedicinesContainer");
    const yogaContainer = document.getElementById("dashRxYogaContainer");

    if (medContainer) {
        medContainer.innerHTML = "";
        addDashMedRow("Paracetamol 500mg", "1 Tablet (500mg)", "After Lunch");
        addDashMedRow("Amoxicillin 500mg", "1 Capsule (500mg)", "After Breakfast");
    }

    if (yogaContainer) {
        yogaContainer.innerHTML = "";
        addDashYogaRow("Surya Namaskar (Sun Salutations)", "07:00", "15 Mins", "Full body vitality & mobility");
        addDashYogaRow("Bhujangasana & Balasana", "18:30", "10 Mins", "Lower back posture strain relief");
    }

    if (modal) modal.style.display = "flex";
};

function addDashMedRow(name = "", dosage = "", mealTiming = "After Lunch") {
    const container = document.getElementById("dashRxMedicinesContainer");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "rx-item-row";
    row.innerHTML = `
        <input type="text" class="dash-med-name" placeholder="Medicine Name" value="${name}" required />
        <input type="text" class="dash-med-dosage" placeholder="Dosage" value="${dosage}" />
        <select class="dash-med-meal">
            <option value="After Lunch" ${mealTiming === "After Lunch" ? "selected" : ""}>After Lunch</option>
            <option value="Before Breakfast" ${mealTiming === "Before Breakfast" ? "selected" : ""}>Before Breakfast</option>
            <option value="After Breakfast" ${mealTiming === "After Breakfast" ? "selected" : ""}>After Breakfast</option>
            <option value="Before Lunch" ${mealTiming === "Before Lunch" ? "selected" : ""}>Before Lunch</option>
            <option value="After Dinner" ${mealTiming === "After Dinner" ? "selected" : ""}>After Dinner</option>
            <option value="Empty Stomach" ${mealTiming === "Empty Stomach" ? "selected" : ""}>Empty Stomach</option>
            <option value="Bedtime" ${mealTiming === "Bedtime" ? "selected" : ""}>At Bedtime</option>
        </select>
        <button type="button" class="rx-remove-btn" title="Remove" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(row);
}

function addDashYogaRow(poseName = "", timing = "07:00", duration = "15 Mins", benefit = "") {
    const container = document.getElementById("dashRxYogaContainer");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "rx-item-row";
    row.innerHTML = `
        <input type="text" class="dash-yoga-name" placeholder="Yoga Routine Name" value="${poseName}" required />
        <input type="time" class="dash-yoga-time" value="${timing}" />
        <input type="text" class="dash-yoga-benefit" placeholder="Benefit" value="${benefit}" />
        <button type="button" class="rx-remove-btn" title="Remove" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(row);
}

document.addEventListener("DOMContentLoaded", () => {
    // Modal buttons
    const closeBtn = document.getElementById("closeDashRxModalBtn");
    const cancelBtn = document.getElementById("cancelDashRxBtn");
    const modal = document.getElementById("doctorDashboardRxModal");

    if (closeBtn && modal) closeBtn.onclick = () => { modal.style.display = "none"; };
    if (cancelBtn && modal) cancelBtn.onclick = () => { modal.style.display = "none"; };

    const addMedBtn = document.getElementById("dashRxAddMedBtn");
    if (addMedBtn) addMedBtn.onclick = () => addDashMedRow();

    const addYogaBtn = document.getElementById("dashRxAddYogaBtn");
    if (addYogaBtn) addYogaBtn.onclick = () => addDashYogaRow();

    // Submit prescription
    const form = document.getElementById("dashDoctorRxForm");
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();

            const apptId = document.getElementById("dashRxAppointmentId").value;
            const patientName = document.getElementById("dashRxPatientName").value;
            const patientEmail = document.getElementById("dashRxPatientEmail").value;
            const patientMobile = document.getElementById("dashRxPatientMobile").value;
            const diagnosis = document.getElementById("dashRxDiagnosis").value.trim();
            const advice = document.getElementById("dashRxAdvice").value.trim();

            const medicines = [];
            document.querySelectorAll("#dashRxMedicinesContainer .rx-item-row").forEach(row => {
                const name = row.querySelector(".dash-med-name")?.value.trim();
                const dosage = row.querySelector(".dash-med-dosage")?.value.trim() || "1 Dose";
                const mealTiming = row.querySelector(".dash-med-meal")?.value || "After Lunch";
                if (name) {
                    medicines.push({ name, dosage, mealTiming, frequency: "Daily", duration: "5 Days" });
                }
            });

            const yogaRoutines = [];
            document.querySelectorAll("#dashRxYogaContainer .rx-item-row").forEach(row => {
                const poseName = row.querySelector(".dash-yoga-name")?.value.trim();
                const timing = row.querySelector(".dash-yoga-time")?.value || "07:00";
                const targetBenefit = row.querySelector(".dash-yoga-benefit")?.value.trim() || "Mobility";
                if (poseName) {
                    yogaRoutines.push({ poseName, timing, duration: "15 Mins", targetBenefit });
                }
            });

            const docMeta = DOCTORS_META[currentDoctorId] || DOCTORS_META.rahul;
            const submitBtn = document.getElementById("submitDashRxBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
            }

            try {
                const res = await fetch("/api/prescriptions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        appointmentId: apptId,
                        doctorId: currentDoctorId,
                        doctorName: docMeta.name,
                        doctorSpecialization: docMeta.specialization,
                        doctorHospital: docMeta.hospital,
                        patientName,
                        patientEmail,
                        patientMobile,
                        diagnosis,
                        medicines,
                        yogaRoutines,
                        advice
                    })
                });

                let rxRecord = data?.prescription || {
                    id: "RX-" + Date.now(),
                    appointmentId: apptId,
                    doctorId: currentDoctorId,
                    doctorName: docMeta.name,
                    doctorSpecialization: docMeta.specialization,
                    patientName,
                    patientEmail,
                    patientMobile,
                    diagnosis,
                    medicines,
                    yogaRoutines,
                    advice,
                    createdAt: new Date().toISOString()
                };

                // Save to Firestore prescriptions collection
                try {
                    if (db) {
                        await setDoc(doc(db, "prescriptions", rxRecord.id), {
                            ...rxRecord,
                            firestoreCreatedAt: serverTimestamp()
                        }, { merge: true });
                        console.log("Prescription synced to Firestore:", rxRecord.id);
                    }
                } catch (fsErr) {
                    console.warn("Could not save prescription to Firestore:", fsErr);
                }

                alert(`Prescription ${rxRecord.id} issued successfully!\nPatient's medicine eating times & yoga reminders have been automatically scheduled.`);
                if (modal) modal.style.display = "none";
                form.reset();

            } catch (err) {
                alert(err.message || "Failed to submit prescription");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Issue Prescription & Sync AI Reminders`;
                }
            }
        };
    }

    // Doctor dropdown switcher
    const selector = document.getElementById("doctorSelectDropdown");
    if (selector) {
        selector.addEventListener("change", (e) => {
            loadDoctorDashboard(e.target.value);
        });
    }

    // Tabs
    document.querySelectorAll(".dash-tab-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".dash-tab-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            activeTab = this.dataset.tab;
            renderTabAppointments();
        });
    });

    // Socket.io for live updates
    if (typeof io !== "undefined") {
        const socket = io();
        socket.on("slot_booked", () => loadDoctorDashboard(currentDoctorId));
        socket.on("slot_freed", () => loadDoctorDashboard(currentDoctorId));
    }

    loadDoctorDashboard();
});

