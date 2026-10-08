/* =========================================
   HEALTHKART APPOINTMENT SYSTEM
   - Sunday appointments disabled (Calendar + API)
   - Real-time slot locking and double-booking protection
   - Real-time Socket.IO notifications
   - Uniqueness based on: doctorId + appointmentDate + appointmentTime
   - Direct Firebase Firestore Sync (appointments collection)
========================================= */

import { db } from "./firebase-config.js";
import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const appointmentDoctors = {
    rahul: {
        id: "rahul",
        name: "Dr. Rahul Sharma",
        specialization: "General Physician",
        qualification: "MBBS, MD - General Medicine",
        rating: "4.8",
        fee: 499,
        clinicHospital: "Max Super Speciality Hospital, New Delhi",
        image: "../images/doctors/rahul-sharma.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600"
    },
    priya: {
        id: "priya",
        name: "Dr. Priya Mehta",
        specialization: "Dermatologist",
        qualification: "MBBS, MD - Dermatology",
        rating: "4.9",
        fee: 599,
        clinicHospital: "Apollo Spectra Hospitals, Mumbai",
        image: "../images/doctors/priya-mehta.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=600"
    },
    amit: {
        id: "amit",
        name: "Dr. Amit Verma",
        specialization: "Cardiologist",
        qualification: "MBBS, MD, DM - Cardiology",
        rating: "4.7",
        fee: 799,
        clinicHospital: "Fortis Escorts Heart Institute, Bengaluru",
        image: "../images/doctors/amit-verma.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600"
    },
    neha: {
        id: "neha",
        name: "Dr. Neha Kapoor",
        specialization: "Pediatrician",
        qualification: "MBBS, MD - Pediatrics",
        rating: "4.8",
        fee: 549,
        clinicHospital: "Cloudnine Hospital, Gurugram",
        image: "../images/doctors/neha-kapoor.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600"
    },
    arjun: {
        id: "arjun",
        name: "Dr. Arjun Singh",
        specialization: "Orthopedic",
        qualification: "MBBS, MS - Orthopedics",
        rating: "4.6",
        fee: 699,
        clinicHospital: "Manipal Hospital, Hyderabad",
        image: "../images/doctors/arjun-singh.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600"
    },
    ananya: {
        id: "ananya",
        name: "Dr. Ananya Gupta",
        specialization: "General Physician",
        qualification: "MBBS, MD - General Medicine",
        rating: "4.9",
        fee: 449,
        clinicHospital: "Artemis Hospital, Noida",
        image: "../images/doctors/ananya-gupta.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=600"
    }
};

let selectedDoctor = null;
let selectedDate = null;
let selectedTime = null;
let selectedConsultation = "Video Consultation";
let socket = null;
const myBookedSlots = new Set();
let lastConfirmedAppointmentId = null;

// Helper: Detect if running on Live Server / other static port and route to HealthKart server on 3000
function getApiBaseUrl() {
    if (window.location.protocol === "file:" || (window.location.port && window.location.port !== "3000")) {
        return "http://localhost:3000";
    }
    return "";
}

// Connect to Socket.io for live slot synchronization
function initAppointmentSocket() {
    if (typeof io !== "undefined") {
        const socketTarget = getApiBaseUrl() || undefined;
        socket = io(socketTarget);

        // When another user books a slot, lock it in real-time without refresh!
        socket.on("slot_booked", ({ doctorId, date, time, appointmentId }) => {
            const currentDocId = getDoctorId();
            const slotKey = `${doctorId}_${date}_${time}`;

            if (doctorId === currentDocId && date === selectedDate) {
                markSlotAsBooked(time);

                // If this slot was booked by the current user, ignore warning
                if (myBookedSlots.has(slotKey) || (lastConfirmedAppointmentId && lastConfirmedAppointmentId === appointmentId)) {
                    return;
                }

                // If this patient currently had this slot selected, alert and clear selection
                if (selectedTime === time) {
                    selectedTime = null;
                    updateSummary();
                    showBookingAlert("warning", "The slot you selected was just booked by another patient. Please select an alternate slot.");
                }
            }
        });

        // When a slot is freed up by cancellation
        socket.on("slot_freed", ({ doctorId, date, time }) => {
            const currentDocId = getDoctorId();
            if (doctorId === currentDocId && date === selectedDate) {
                markSlotAsAvailable(time);
            }
        });
    }
}

function getDoctorId() {
    const params = new URLSearchParams(window.location.search);
    let raw = params.get("id") || params.get("doctorId") || params.get("doctor") || localStorage.getItem("selectedDoctorId") || "rahul";
    if (typeof raw !== "string") return "rahul";

    let clean = raw.toLowerCase().trim()
        .replace(/^dr[-_.\s]*/, "")
        .replace(/^doctor[-_.\s]*/, "");

    if (appointmentDoctors[clean]) return clean;

    for (const key of Object.keys(appointmentDoctors)) {
        if (clean.includes(key) || appointmentDoctors[key].name.toLowerCase().includes(clean)) {
            return key;
        }
    }

    return "rahul";
}

function loadDoctor() {
    const doctorId = getDoctorId();
    selectedDoctor = appointmentDoctors[doctorId] || appointmentDoctors.rahul;

    // Doctor information on left card
    const nameEl = document.getElementById("selectedDoctorName");
    if (nameEl) nameEl.textContent = selectedDoctor.name;

    const specEl = document.getElementById("selectedDoctorSpecialization");
    if (specEl) specEl.textContent = selectedDoctor.specialization;

    const ratingEl = document.getElementById("selectedDoctorRating");
    if (ratingEl) ratingEl.textContent = selectedDoctor.rating;

    // Doctor Photos
    const miniAvatar = document.querySelector(".doctor-mini-avatar");
    if (miniAvatar) {
        miniAvatar.innerHTML = `
            <img
                src="${selectedDoctor.image}"
                alt="${selectedDoctor.name}"
                style="width:100%; height:100%; max-width:100%; max-height:100%; object-fit:cover; border-radius:50%; display:block;"
                onerror="this.onerror=null; this.src='${selectedDoctor.fallbackImage}';"
            >
        `;
    }

    const summaryAvatar = document.querySelector(".summary-avatar");
    if (summaryAvatar) {
        summaryAvatar.innerHTML = `
            <img
                src="${selectedDoctor.image}"
                alt="${selectedDoctor.name}"
                style="width:100%; height:100%; max-width:100%; max-height:100%; object-fit:cover; border-radius:50%; display:block;"
                onerror="this.onerror=null; this.src='${selectedDoctor.fallbackImage}';"
            >
        `;
    }

    // Right summary card
    const sumName = document.getElementById("summaryDoctorName");
    if (sumName) sumName.textContent = selectedDoctor.name;

    const sumSpec = document.getElementById("summarySpecialization");
    if (sumSpec) sumSpec.textContent = selectedDoctor.specialization;

    const sumFee = document.getElementById("summaryFee");
    if (sumFee) sumFee.textContent = "₹" + selectedDoctor.fee;

    const sumTotal = document.getElementById("summaryTotal");
    if (sumTotal) sumTotal.textContent = "₹" + selectedDoctor.fee;

    localStorage.setItem("selectedDoctorId", doctorId);
    localStorage.setItem("selectedDoctor", selectedDoctor.name);
}

// Prefill Patient Form with Logged-in User Data if Available
function prefillUserData() {
    try {
        const userStr = localStorage.getItem("healthkart_auth_user");
        if (userStr) {
            const user = JSON.parse(userStr);
            const nameInput = document.getElementById("patientName");
            const emailInput = document.getElementById("patientEmail");
            const mobileInput = document.getElementById("patientMobile");
            if (nameInput && !nameInput.value) {
                nameInput.value = user.displayName || user.name || "";
            }
            if (emailInput && !emailInput.value) {
                emailInput.value = user.email || "";
            }
            if (mobileInput && !mobileInput.value && (user.mobile || user.phone)) {
                mobileInput.value = (user.mobile || user.phone).replace(/\D/g, "").slice(-10);
            }
        }
    } catch (e) {}
}

// =========================================
// CALENDAR & SUNDAY RESTRICTION (Requirement 4)
// =========================================

function generateDates() {
    const container = document.getElementById("dateOptions");
    if (!container) return;
    container.innerHTML = "";

    const today = new Date();
    let firstAvailableDate = null;

    // Generate dates for next 7 days
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const isSun = date.getDay() === 0; // 0 = Sunday
        const dayName = date.toLocaleDateString("en-IN", { weekday: "short" });
        const monthName = date.toLocaleDateString("en-IN", { month: "short" });
        const dateNumber = date.getDate();

        // Format YYYY-MM-DD using local time
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const fullDate = `${year}-${month}-${day}`;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "date-btn";
        button.dataset.date = fullDate;

        if (isSun) {
            // Requirement 4: Sunday must appear disabled in the calendar
            button.classList.add("sunday-disabled");
            button.setAttribute("aria-disabled", "true");
            button.title = "Appointments are not available on Sundays";
            button.innerHTML = `
                <span class="date-day">${i === 0 ? "Today" : dayName}</span>
                <span class="date-number">${dateNumber}</span>
                <span class="date-month">${monthName}</span>
                <span class="sunday-tag">Closed</span>
            `;

            // Clicking Sunday gives clear required notice
            button.addEventListener("click", () => {
                showSundayNotice();
            });
        } else {
            // Available Day
            button.innerHTML = `
                <span class="date-day">${i === 0 ? "Today" : dayName}</span>
                <span class="date-number">${dateNumber}</span>
                <span class="date-month">${monthName}</span>
            `;

            // Track first valid day to select by default
            if (!firstAvailableDate) {
                firstAvailableDate = fullDate;
                button.classList.add("selected");
                selectedDate = fullDate;
            }

            button.addEventListener("click", function () {
                hideSundayNotice();
                document.querySelectorAll(".date-btn").forEach(btn => btn.classList.remove("selected"));
                this.classList.add("selected");
                selectedDate = fullDate;
                selectedTime = null; // reset selected slot on date change
                updateSummary();
                fetchSlotsForDate(getDoctorId(), selectedDate);
            });
        }

        container.appendChild(button);
    }

    updateSummary();
    if (selectedDate) {
        fetchSlotsForDate(getDoctorId(), selectedDate);
    }
}

// Sunday notice banner
function showSundayNotice() {
    let banner = document.getElementById("sundayNoticeBanner");
    if (!banner) {
        const timeSection = document.querySelector(".time-section") || document.getElementById("dateOptions").parentElement;
        banner = document.createElement("div");
        banner.id = "sundayNoticeBanner";
        banner.style.cssText = "padding:12px 16px; background:#fff2f2; border:1px solid #fed7d7; border-radius:9px; color:#c53030; font-size:13px; font-weight:700; margin-bottom:14px; display:flex; align-items:center; gap:8px;";
        timeSection.parentElement.insertBefore(banner, timeSection);
    }
    banner.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Appointments are not available on Sundays. Please select another day.`;
    banner.style.display = "flex";

    // Clear any slot display
    renderSlotsMessage("Appointments are not available on Sundays. Please choose Monday through Saturday.");
}

function hideSundayNotice() {
    const banner = document.getElementById("sundayNoticeBanner");
    if (banner) banner.style.display = "none";
}

// =========================================
// DYNAMIC SLOTS & DOUBLE BOOKING PREVENTION (Requirement 3)
// =========================================

async function fetchSlotsForDate(doctorId, dateStr) {
    const timeOptionsContainer = document.querySelector(".time-options") || document.getElementById("timeOptions");
    if (!timeOptionsContainer) return;

    timeOptionsContainer.innerHTML = `
        <div style="padding:16px; color:#607369; font-size:12px;">
            <i class="fa-solid fa-spinner fa-spin"></i> Checking slot availability...
        </div>
    `;

    try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/appointments/slots?doctorId=${doctorId}&date=${dateStr}`);
        const contentType = res.headers.get("content-type") || "";
        let data = null;
        if (contentType.includes("application/json")) {
            data = await res.json();
        }

        if (data && !res.ok) {
            if (data.isSunday) {
                showSundayNotice();
                return;
            }
            throw new Error(data.error || "Failed to fetch slots");
        }

        if (data && data.slots) {
            renderSlots(data.slots || []);
            return;
        }
        throw new Error("No slots returned");
    } catch (err) {
        console.warn("Using offline slot generator:", err);
        // Fallback default slots
        const defaultSlots = [
            { time: "09:00 AM", isBooked: false },
            { time: "09:30 AM", isBooked: false },
            { time: "10:00 AM", isBooked: false },
            { time: "10:30 AM", isBooked: false },
            { time: "11:00 AM", isBooked: false },
            { time: "11:30 AM", isBooked: false },
            { time: "04:00 PM", isBooked: false },
            { time: "04:30 PM", isBooked: false },
            { time: "05:00 PM", isBooked: false },
            { time: "05:30 PM", isBooked: false }
        ];
        renderSlots(defaultSlots);
    }
}

function renderSlots(slots) {
    const timeContainer = document.querySelector(".time-section");
    if (!timeContainer) return;

    hideSundayNotice();

    timeContainer.innerHTML = `
        <h4 style="margin: 0 0 10px; font-size:12px; color:#526359;">Available Consultation Slots</h4>
        <div class="time-options" id="timeOptionsGrid" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
    `;

    const grid = document.getElementById("timeOptionsGrid");
    if (!grid) return;

    if (slots.length === 0) {
        grid.innerHTML = `<p style="font-size:12px; color:#78867f;">No slots available for this date.</p>`;
        return;
    }

    let firstAvailableBtn = null;
    let firstAvailableTime = null;

    slots.forEach(slot => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "time-btn";
        button.dataset.time = slot.time;

        if (slot.isBooked) {
            button.classList.add("booked");
            button.disabled = true;
            button.innerHTML = `${slot.time} <span style="font-size:9px; font-weight:700; margin-left:3px;">(Booked)</span>`;
            button.title = "This appointment slot has already been booked";
        } else {
            button.textContent = slot.time;
            if (!firstAvailableBtn) {
                firstAvailableBtn = button;
                firstAvailableTime = slot.time;
            }
            button.addEventListener("click", function () {
                document.querySelectorAll(".time-btn").forEach(b => b.classList.remove("selected"));
                this.classList.add("selected");
                selectedTime = slot.time;
                updateSummary();
            });
        }

        grid.appendChild(button);
    });

    // Auto-select first available slot if none currently selected
    if (!selectedTime && firstAvailableBtn) {
        firstAvailableBtn.classList.add("selected");
        selectedTime = firstAvailableTime;
        updateSummary();
    } else if (selectedTime) {
        const matchingBtn = grid.querySelector(`.time-btn[data-time="${selectedTime}"]:not(.booked)`);
        if (matchingBtn) {
            matchingBtn.classList.add("selected");
        } else if (firstAvailableBtn) {
            firstAvailableBtn.classList.add("selected");
            selectedTime = firstAvailableTime;
            updateSummary();
        }
    }
}

function renderSlotsMessage(msg) {
    const timeContainer = document.querySelector(".time-section");
    if (timeContainer) {
        timeContainer.innerHTML = `<div style="padding:16px 0; color:#84948c; font-size:13px;"><i class="fa-regular fa-clock" style="margin-right:6px;"></i>${msg}</div>`;
    }
}

function markSlotAsBooked(timeStr) {
    const btn = document.querySelector(`.time-btn[data-time="${timeStr}"]`);
    if (btn) {
        btn.classList.add("booked");
        btn.classList.remove("selected");
        btn.disabled = true;
        btn.innerHTML = `${timeStr} <span style="font-size:9px; font-weight:700; margin-left:3px;">(Booked)</span>`;
    }
}

function markSlotAsAvailable(timeStr) {
    const btn = document.querySelector(`.time-btn[data-time="${timeStr}"]`);
    if (btn) {
        btn.classList.remove("booked");
        btn.disabled = false;
        btn.textContent = timeStr;
    }
}

// =========================================
// CONSULTATION OPTIONS & SUMMARY
// =========================================

function setupConsultationOptions() {
    const options = document.querySelectorAll(".consultation-option");
    options.forEach(option => {
        option.addEventListener("click", function () {
            options.forEach(item => item.classList.remove("selected"));
            this.classList.add("selected");
            const radio = this.querySelector("input");
            if (radio) {
                radio.checked = true;
                selectedConsultation = radio.value;
            }
            updateSummary();
        });
    });
}

function formatDate(dateString) {
    if (!dateString) return "Select date";
    const parts = dateString.split("-");
    if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }
    return dateString;
}

function updateSummary() {
    const summaryConsultation = document.getElementById("summaryConsultation");
    const summaryDate = document.getElementById("summaryDate");
    const summaryTime = document.getElementById("summaryTime");

    if (summaryConsultation) summaryConsultation.textContent = selectedConsultation;
    if (summaryDate) summaryDate.textContent = formatDate(selectedDate);
    if (summaryTime) summaryTime.textContent = selectedTime || "Select time";
}

function showBookingAlert(type, message) {
    let alertBox = document.getElementById("bookingAlertBox");
    if (!alertBox) {
        const confirmSection = document.querySelector(".confirm-section");
        alertBox = document.createElement("div");
        alertBox.id = "bookingAlertBox";
        if (confirmSection) {
            confirmSection.insertBefore(alertBox, confirmSection.firstChild);
        }
    }
    const bg = type === "error" ? "#fff2f2" : type === "warning" ? "#fffbeb" : "#edfdf5";
    const border = type === "error" ? "#fecaca" : type === "warning" ? "#fde68a" : "#bbf7d0";
    const text = type === "error" ? "#b91c1c" : type === "warning" ? "#92400e" : "#15803d";

    alertBox.style.cssText = `padding:12px 16px; background:${bg}; border:1px solid ${border}; border-radius:9px; color:${text}; font-size:13px; font-weight:700; margin-bottom:14px;`;
    alertBox.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="margin-right:6px;"></i> ${message}`;
    alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearBookingAlert() {
    const alertBox = document.getElementById("bookingAlertBox");
    if (alertBox) alertBox.remove();
}

function validateForm() {
    clearBookingAlert();

    const nameInput = document.getElementById("patientName");
    const mobileInput = document.getElementById("patientMobile");
    const emailInput = document.getElementById("patientEmail");
    const concernInput = document.getElementById("healthConcern");

    const name = nameInput?.value.trim();
    let mobile = mobileInput?.value.trim() || "";
    const email = emailInput?.value.trim();
    let concern = concernInput?.value.trim();

    if (!name) {
        showBookingAlert("error", "Please enter patient full name.");
        return false;
    }

    const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
    if (cleanMobile.length !== 10) {
        showBookingAlert("error", "Please enter a valid 10-digit mobile number.");
        return false;
    }
    if (mobileInput) {
        mobileInput.value = cleanMobile;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showBookingAlert("error", "Please enter a valid email address.");
        return false;
    }
    if (!selectedDate) {
        showBookingAlert("error", "Please select an appointment date.");
        return false;
    }

    // Check Sunday (Requirement 4)
    const dateParts = selectedDate.split("-");
    const testDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    if (testDate.getDay() === 0) {
        showBookingAlert("error", "Appointments are not available on Sundays. Please select another day.");
        return false;
    }

    if (!selectedTime) {
        const availableBtn = document.querySelector(".time-btn:not(.booked)");
        if (availableBtn && availableBtn.dataset.time) {
            availableBtn.classList.add("selected");
            selectedTime = availableBtn.dataset.time;
            updateSummary();
        } else {
            showBookingAlert("error", "Please select an available appointment time slot.");
            return false;
        }
    }

    if (!concern) {
        concern = "General Consultation";
        if (concernInput) concernInput.value = concern;
    }

    return true;
}

// =========================================
// CONFIRM APPOINTMENT & SERVER VALIDATION
// =========================================

window.confirmAppointment = async function () {
    if (!validateForm()) return;

    const patientName = document.getElementById("patientName").value.trim();
    const patientMobile = document.getElementById("patientMobile").value.trim();
    const patientEmail = document.getElementById("patientEmail").value.trim();
    const healthConcern = document.getElementById("healthConcern").value.trim();
    const doctorId = getDoctorId();

    const confirmBtn = document.querySelector(".confirm-btn");
    const originalText = confirmBtn ? confirmBtn.innerHTML : "Confirm";
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Reserving Slot...`;
    }

    try {
        const payload = {
            doctorId,
            appointmentDate: selectedDate,
            appointmentTime: selectedTime,
            patientName,
            patientMobile,
            patientEmail,
            healthConcern,
            consultationType: selectedConsultation
        };

        let data = null;
        try {
            const apiBase = getApiBaseUrl();
            const res = await fetch(`${apiBase}/api/appointments/book`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                data = await res.json();
            }

            // 1. Double booking protection check (Requirement 3)
            if (res.status === 409 || data?.isSlotTaken) {
                showBookingAlert("error", data?.error || "Sorry, this appointment slot has just been booked by another patient.");
                markSlotAsBooked(selectedTime);
                selectedTime = null;
                updateSummary();
                return;
            }

            // 2. Sunday restriction check (Requirement 4)
            if (res.status === 400 && data?.isSunday) {
                showBookingAlert("error", data?.error || "Appointments are not available on Sundays. Please select another day.");
                return;
            }

            if (!res.ok && data?.error) {
                throw new Error(data.error);
            }
        } catch (netErr) {
            console.warn("Backend server not responding, saving booking locally:", netErr);
        }

        const authUser = (() => {
            try { return JSON.parse(localStorage.getItem("healthkart_auth_user")); } catch(e) { return null; }
        })();

        // Generate appointment record (from server response or local generator)
        const appointment = data?.appointment || {
            appointmentId: "HK-" + Math.floor(100000 + Math.random() * 900000),
            doctorId,
            doctorName: selectedDoctor.name,
            doctorImage: selectedDoctor.image,
            specialization: selectedDoctor.specialization,
            clinicHospital: selectedDoctor.clinicHospital,
            consultationFee: selectedDoctor.fee,
            consultationType: selectedConsultation,
            appointmentDate: selectedDate,
            appointmentTime: selectedTime,
            patientName,
            patientMobile,
            patientEmail: patientEmail || (authUser ? authUser.email : ""),
            userId: authUser ? authUser.uid : null,
            healthConcern,
            status: "CONFIRMED",
            callRoomId: "call_HK-" + Date.now(),
            createdAt: new Date().toISOString()
        };

        if (authUser && !appointment.userId) {
            appointment.userId = authUser.uid;
        }

        // Save to Firebase Firestore so appointment is visible in Firebase Console
        try {
            if (db) {
                await setDoc(doc(db, "appointments", appointment.appointmentId), {
                    ...appointment,
                    firestoreCreatedAt: serverTimestamp()
                }, { merge: true });
                console.log("Appointment successfully synchronized with Firebase Firestore:", appointment.appointmentId);
            }
        } catch (fsErr) {
            console.warn("Could not save appointment to Firebase Firestore directly:", fsErr);
        }

        // Track as our own booked slot so socket.io broadcast doesn't clear it or trigger duplicate warning
        const slotKey = `${doctorId}_${selectedDate}_${selectedTime}`;
        myBookedSlots.add(slotKey);
        if (appointment.appointmentId) {
            lastConfirmedAppointmentId = appointment.appointmentId;
        }

        // Clear any previous error/warning alert box
        clearBookingAlert();

        // Also save in localStorage cache for offline continuity
        const existing = JSON.parse(localStorage.getItem("healthkartAppointments")) || [];
        existing.unshift(appointment);
        localStorage.setItem("healthkartAppointments", JSON.stringify(existing));

        // Mark the booked slot as unavailable immediately on this page
        markSlotAsBooked(selectedTime);

        // Show confirmation popup modal (Requirement 5)
        showConfirmationModal(appointment);

        // Show live real-time notification toast (Requirement 6)
        if (window.showLiveToast) {
            window.showLiveToast(
                "Appointment Confirmed!",
                `Your appointment with ${appointment.doctorName} is booked for ${appointment.appointmentTime}.`
            );
        }

    } catch (err) {
        console.error("Booking failed:", err);
        showBookingAlert("error", err.message || "Failed to book appointment. Please try again.");
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
        }
    }
};

function showConfirmationModal(appointment) {
    const modal = document.getElementById("successModal");
    if (!modal) return;

    const idEl = document.getElementById("appointmentId");
    if (idEl) idEl.textContent = appointment.appointmentId;

    const docEl = document.getElementById("successDoctor");
    if (docEl) docEl.textContent = appointment.doctorName;

    const dateEl = document.getElementById("successDate");
    if (dateEl) dateEl.textContent = formatDate(appointment.appointmentDate);

    const timeEl = document.getElementById("successTime");
    if (timeEl) timeEl.textContent = appointment.appointmentTime;

    // Add buttons inside success box
    const successBox = modal.querySelector(".success-box");
    let actionButtons = successBox.querySelector(".modal-action-buttons");
    if (!actionButtons) {
        actionButtons = document.createElement("div");
        actionButtons.className = "modal-action-buttons";
        actionButtons.style.cssText = "display:flex; flex-direction:column; gap:10px; margin-top:20px;";

        const callBtn = document.createElement("a");
        const callRoom = appointment.callRoomId || ("call_" + appointment.appointmentId);
        callBtn.href = `video-consultation.html?room=${callRoom}&role=patient&doctor=${encodeURIComponent(appointment.doctorName)}`;
        callBtn.style.cssText = "display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; background:#0b9f6e; color:#fff; border-radius:9px; font-weight:700; text-decoration:none; font-size:14px; box-shadow:0 4px 12px rgba(11, 159, 110, 0.25);";
        callBtn.innerHTML = `<i class="fa-solid fa-video"></i> Start Video Consultation Now`;

        const myApptBtn = document.createElement("a");
        myApptBtn.href = "my-appointments.html";
        myApptBtn.style.cssText = "display:flex; align-items:center; justify-content:center; gap:8px; padding:11px; background:#e8f7f0; color:#0b9f6e; border:1px solid #bce6d7; border-radius:9px; font-weight:700; text-decoration:none; font-size:13px;";
        myApptBtn.innerHTML = `<i class="fa-solid fa-calendar-check"></i> View in My Appointments`;

        const doneBtn = successBox.querySelector(".success-btn");
        if (doneBtn) {
            doneBtn.style.cssText = "padding:10px; background:#edf5f1; color:#234436; border:none; border-radius:9px; font-weight:700; cursor:pointer;";
            actionButtons.appendChild(callBtn);
            actionButtons.appendChild(myApptBtn);
            actionButtons.appendChild(doneBtn);
            successBox.appendChild(actionButtons);
        } else {
            actionButtons.appendChild(callBtn);
            actionButtons.appendChild(myApptBtn);
            successBox.appendChild(actionButtons);
        }
    }

    modal.classList.add("show");
    modal.classList.add("active");
    modal.style.display = "flex";
}

window.goToDoctors = function () {
    window.location.href = "doctors.html";
};

// =========================================
// AI CLINICAL SYMPTOM TRIAGE & SMART MATCHER
// =========================================

let lastTriageData = null;

window.quickFillSymptom = function(text) {
    const input = document.getElementById("aiSymptomInput");
    if (input) {
        input.value = text;
        runAiSymptomTriage();
    }
};

function localAiClinicalTriage(symptoms) {
    const text = (symptoms || "").toLowerCase();
    let specialty = "General Physician";
    let recommendedDoctorId = "rahul";
    let urgency = "Routine (Ideal for Video Consultation)";
    let urgencyLevel = "routine";
    let clinicalSummary = `Primary care presentation: patient reports "${symptoms}". Systemic evaluation and customized clinical care indicated.`;
    let suggestedQuestions = [
        "What is the recommended dosage and meal timing (before/after food) for any prescribed medicine?",
        "Are there any side effects or food interactions to watch out for?",
        "What supportive yoga and hydration practices will accelerate recovery?"
    ];
    let yogaPrecaution = "Daily Surya Namaskar and Pranayama support immune vitality and respiratory circulation.";

    if (text.includes("skin") || text.includes("rash") || text.includes("acne") || text.includes("itch") || text.includes("hair") || text.includes("dermat")) {
        specialty = "Dermatologist";
        recommendedDoctorId = "priya";
        urgency = "Mild to Moderate (Clear Video Inspection Recommended)";
        urgencyLevel = "mild";
        clinicalSummary = `Dermatological presentation: patient reports "${symptoms}". Visual assessment and topical treatment evaluation advised.`;
        suggestedQuestions = [
            "Could this rash or reaction be caused by diet, cosmetics, or allergens?",
            "Are topical antihistamines or barrier creams safe for daily use?",
            "How soon should improvement appear before an in-person follow-up?"
        ];
        yogaPrecaution = "Avoid high-heat hot yoga or heavy sweating until skin inflammation calms.";
    } else if (text.includes("heart") || text.includes("chest") || text.includes("palpitation") || text.includes("bp") || text.includes("blood pressure") || text.includes("breathless")) {
        specialty = "Cardiologist";
        recommendedDoctorId = "amit";
        urgency = "Priority (Comprehensive Tele-Triage & Vitals Review)";
        urgencyLevel = "priority";
        clinicalSummary = `Cardiovascular / Thoracic symptom report: "${symptoms}". Doctor will evaluate resting heart rate, BP trends, and lifestyle factors.`;
        suggestedQuestions = [
            "Should I monitor my daily resting BP and pulse in morning and evening?",
            "Are there specific ECG or lipid profile markers to test?",
            "What dietary sodium reductions and light walking regimens are safest?"
        ];
        yogaPrecaution = "Practice gentle Anulom Vilom and Shavasana; strictly avoid breath retention (Kumbhaka) and Kapalbhati.";
    } else if (text.includes("bone") || text.includes("joint") || text.includes("back") || text.includes("knee") || text.includes("spine") || text.includes("muscle") || text.includes("ortho")) {
        specialty = "Orthopedic";
        recommendedDoctorId = "arjun";
        urgency = "Moderate (Musculoskeletal Range-of-Motion & Ergonomics Review)";
        urgencyLevel = "moderate";
        clinicalSummary = `Musculoskeletal strain / Joint complaint: "${symptoms}". Focus on spinal biomechanics, posture, and anti-inflammatory care.`;
        suggestedQuestions = [
            "Is this posture-related muscle fatigue or ligament/joint strain?",
            "Should I apply heat or cold therapy, and when?",
            "What corrective ergonomic exercises can I perform while working?"
        ];
        yogaPrecaution = "Gentle Marjaryasana (Cat-Cow) and Balasana (Child Pose) recommended; avoid deep forward bends without bending knees.";
    } else if (text.includes("child") || text.includes("baby") || text.includes("pediatric") || text.includes("toddler") || text.includes("kid")) {
        specialty = "Pediatrician";
        recommendedDoctorId = "neha";
        urgency = "Priority Pediatric Care (Pediatric Video Consultation)";
        urgencyLevel = "priority";
        clinicalSummary = `Pediatric symptom report: "${symptoms}". Child requires age-weight adjusted medication dosage and hydration monitoring.`;
        suggestedQuestions = [
            "What is the precise weight-based dosage for pediatric syrup or drops?",
            "What red-flag signs should prompt in-person emergency care?",
            "What hydration fluids or electrolytes are best tolerated?"
        ];
        yogaPrecaution = "Encourage gentle butterfly pose and fun deep breathing games without strain.";
    }

    const doc = appointmentDoctors[recommendedDoctorId] || appointmentDoctors.rahul;
    return {
        success: true,
        specialty,
        urgency,
        urgencyLevel,
        recommendedDoctor: doc,
        clinicalSummary,
        suggestedQuestions,
        yogaPrecaution
    };
}

async function runAiSymptomTriage() {
    const input = document.getElementById("aiSymptomInput");
    const symptoms = input ? input.value.trim() : "";
    if (!symptoms) {
        showBookingAlert("warning", "Please enter or speak your symptoms first.");
        return;
    }

    const analyzeBtn = document.getElementById("aiAnalyzeSymptomBtn");
    const origHtml = analyzeBtn ? analyzeBtn.innerHTML : "";
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...`;
    }

    try {
        let data = null;
        try {
            const apiBase = getApiBaseUrl();
            const res = await fetch(`${apiBase}/api/ai/triage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symptoms })
            });
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                data = await res.json();
            }
        } catch (netErr) {
            console.warn("Backend API not reachable, using local AI triage engine:", netErr);
        }

        // If backend returned valid data, use it; otherwise compute locally
        if (!data || !data.success) {
            data = localAiClinicalTriage(symptoms);
        }

        lastTriageData = data;
        const resultBox = document.getElementById("aiTriageResultBox");
        const badge = document.getElementById("aiTriageUrgencyBadge");
        const matchedSpec = document.getElementById("aiMatchedSpecialty");
        const summaryText = document.getElementById("aiTriageSummaryText");
        const qList = document.getElementById("aiQuestionsList");
        const switchDocBtn = document.getElementById("btnSwitchToRecommendedDoctor");

        if (badge) {
            badge.textContent = `Urgency: ${data.urgency.split('(')[0].trim()}`;
            if (data.urgencyLevel === "priority") {
                badge.style.background = "#fff1f1";
                badge.style.color = "#d93838";
            } else if (data.urgencyLevel === "moderate") {
                badge.style.background = "#fff8e6";
                badge.style.color = "#b46d00";
            } else {
                badge.style.background = "#e6f8ef";
                badge.style.color = "#0b9f6e";
            }
        }

        if (matchedSpec) matchedSpec.textContent = data.specialty;
        if (summaryText) summaryText.textContent = data.clinicalSummary;

        if (qList && data.suggestedQuestions) {
            qList.innerHTML = data.suggestedQuestions.map(q => `<li>${q}</li>`).join("");
        }

        if (switchDocBtn && data.recommendedDoctor) {
            if (selectedDoctor && selectedDoctor.id !== data.recommendedDoctor.id) {
                switchDocBtn.style.display = "inline-flex";
                switchDocBtn.innerHTML = `<i class="fa-solid fa-user-doctor"></i> Switch to ${data.recommendedDoctor.name} (${data.specialty})`;
                switchDocBtn.onclick = () => {
                    selectedDoctor = appointmentDoctors[data.recommendedDoctor.id] || selectedDoctor;
                    const url = new URL(window.location.href);
                    url.searchParams.set("id", data.recommendedDoctor.id);
                    window.history.replaceState({}, "", url);
                    loadDoctor();
                    showBookingAlert("success", `Switched to recommended specialist: ${selectedDoctor.name}`);
                    switchDocBtn.style.display = "none";
                };
            } else {
                switchDocBtn.style.display = "none";
            }
        }

        if (resultBox) resultBox.style.display = "block";

    } catch (err) {
        console.error("AI Triage error:", err);
        showBookingAlert("error", err.message || "Could not analyze symptoms.");
    } finally {
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = origHtml;
        }
    }
}

function initAiSymptomTriage() {
    const analyzeBtn = document.getElementById("aiAnalyzeSymptomBtn");
    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", runAiSymptomTriage);
    }

    const input = document.getElementById("aiSymptomInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                runAiSymptomTriage();
            }
        });
    }

    // Voice recognition
    const voiceBtn = document.getElementById("aiVoiceSymptomBtn");
    if (voiceBtn) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            voiceBtn.style.display = "none";
        } else {
            let recognition = null;
            let isListening = false;
            voiceBtn.addEventListener("click", () => {
                if (isListening) {
                    if (recognition) recognition.stop();
                    return;
                }
                recognition = new SpeechRec();
                recognition.lang = "en-IN";
                recognition.interimResults = false;
                recognition.onstart = () => {
                    isListening = true;
                    voiceBtn.style.color = "#d93838";
                    voiceBtn.innerHTML = `<i class="fa-solid fa-microphone-lines fa-fade"></i>`;
                };
                recognition.onresult = (evt) => {
                    const transcript = evt.results[0][0].transcript;
                    if (input) {
                        input.value = transcript;
                        runAiSymptomTriage();
                    }
                };
                recognition.onend = () => {
                    isListening = false;
                    voiceBtn.style.color = "#0b9f6e";
                    voiceBtn.innerHTML = `<i class="fa-solid fa-microphone"></i>`;
                };
                recognition.onerror = () => {
                    isListening = false;
                    voiceBtn.style.color = "#0b9f6e";
                    voiceBtn.innerHTML = `<i class="fa-solid fa-microphone"></i>`;
                };
                recognition.start();
            });
        }
    }

    // Fill into consultation reason
    const applyBtn = document.getElementById("btnApplyAiToConcern");
    if (applyBtn) {
        applyBtn.addEventListener("click", () => {
            if (!lastTriageData) return;
            const concernInput = document.getElementById("healthConcern");
            if (concernInput) {
                const formatted = `Patient Symptoms: ${lastTriageData.clinicalSummary}\n\nTriage Level: ${lastTriageData.urgency}\n\nQuestions to Ask Doctor:\n` +
                    lastTriageData.suggestedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n");
                concernInput.value = formatted;
                concernInput.scrollIntoView({ behavior: "smooth", block: "center" });
                concernInput.focus();
                showBookingAlert("success", "Clinical summary and doctor questions applied to Reason for Consultation!");
            }
        });
    }
}

// =========================================
// INITIALIZE
// =========================================

function init() {
    loadDoctor();
    generateDates();
    setupConsultationOptions();
    prefillUserData();
    initAppointmentSocket();
    initAiSymptomTriage();

    const confirmBtn = document.querySelector(".confirm-btn");
    if (confirmBtn) {
        confirmBtn.onclick = () => window.confirmAppointment();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}