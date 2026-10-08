/* =========================================
   HEALTHKART DOCTOR PROFILE
   Dynamic doctor profile with real photos,
   qualifications, clinic, schedule & slots.
========================================= */

const doctorsData = {
    rahul: {
        name: "Dr. Rahul Sharma",
        specialization: "General Physician",
        qualification: "MBBS, MD - General Medicine",
        rating: "4.8",
        experience: "12+",
        consultations: "245+",
        fee: "₹499",
        clinicHospital: "Max Super Speciality Hospital, New Delhi",
        availableDays: "Monday to Saturday (Sundays Closed)",
        timeSlots: ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM"],
        image: "../images/doctors/rahul-sharma.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600",
        appointmentStatus: "Available",
        about: "Dr. Rahul Sharma is a senior General Physician with over 12 years of clinical experience specializing in internal medicine, lifestyle disorder prevention, and chronic care management.",
        specializations: [
            "General Medicine",
            "Preventive Care",
            "Lifestyle Disorders",
            "Primary Healthcare"
        ]
    },
    priya: {
        name: "Dr. Priya Mehta",
        specialization: "Dermatologist",
        qualification: "MBBS, MD - Dermatology",
        rating: "4.9",
        experience: "9+",
        consultations: "310+",
        fee: "₹599",
        clinicHospital: "Apollo Spectra Hospitals, Mumbai",
        availableDays: "Monday to Saturday (Sundays Closed)",
        timeSlots: ["10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM", "03:00 PM"],
        image: "../images/doctors/priya-mehta.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=600",
        appointmentStatus: "Available",
        about: "Dr. Priya Mehta specializes in clinical dermatology, aesthetic procedures, acne care, and hair restoration therapies.",
        specializations: [
            "Clinical Dermatology",
            "Skin Care",
            "Hair Care",
            "Cosmetic Dermatology"
        ]
    },
    amit: {
        name: "Dr. Amit Verma",
        specialization: "Cardiologist",
        qualification: "MBBS, MD, DM - Cardiology",
        rating: "4.7",
        experience: "15+",
        consultations: "185+",
        fee: "₹799",
        clinicHospital: "Fortis Escorts Heart Institute, Bengaluru",
        availableDays: "Monday to Friday (Sundays Closed)",
        timeSlots: ["11:00 AM", "11:30 AM", "12:00 PM", "05:00 PM", "05:30 PM", "06:00 PM"],
        image: "../images/doctors/amit-verma.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600",
        appointmentStatus: "Available",
        about: "Dr. Amit Verma provides expert diagnosis and personalized management for cardiovascular health, hypertension, and heart rehabilitation.",
        specializations: [
            "Cardiology",
            "Heart Health",
            "Preventive Cardiology",
            "Cardiac Care"
        ]
    },
    neha: {
        name: "Dr. Neha Kapoor",
        specialization: "Pediatrician",
        qualification: "MBBS, MD - Pediatrics",
        rating: "4.8",
        experience: "8+",
        consultations: "220+",
        fee: "₹549",
        clinicHospital: "Cloudnine Hospital, Gurugram",
        availableDays: "Monday to Saturday (Sundays Closed)",
        timeSlots: ["09:30 AM", "10:00 AM", "10:30 AM", "03:30 PM", "04:00 PM", "04:30 PM"],
        image: "../images/doctors/neha-kapoor.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600",
        appointmentStatus: "Available",
        about: "Dr. Neha Kapoor provides compassionate, evidence-based pediatric care for neonates, children, and young adolescents.",
        specializations: [
            "Child Healthcare",
            "Pediatrics",
            "Child Nutrition",
            "Preventive Care"
        ]
    },
    arjun: {
        name: "Dr. Arjun Singh",
        specialization: "Orthopedic",
        qualification: "MBBS, MS - Orthopedics",
        rating: "4.6",
        experience: "11+",
        consultations: "160+",
        fee: "₹699",
        clinicHospital: "Manipal Hospital, Hyderabad",
        availableDays: "Monday to Saturday (Sundays Closed)",
        timeSlots: ["10:00 AM", "10:30 AM", "11:00 AM", "04:00 PM", "04:30 PM", "05:00 PM"],
        image: "../images/doctors/arjun-singh.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600",
        appointmentStatus: "Available",
        about: "Dr. Arjun Singh specializes in bone health, joint disorders, arthroscopy, and sports trauma rehabilitation.",
        specializations: [
            "Orthopedics",
            "Joint Care",
            "Bone Health",
            "Sports Injuries"
        ]
    },
    ananya: {
        name: "Dr. Ananya Gupta",
        specialization: "General Physician",
        qualification: "MBBS, MD - General Medicine",
        rating: "4.9",
        experience: "7+",
        consultations: "275+",
        fee: "₹449",
        clinicHospital: "Artemis Hospital, Noida",
        availableDays: "Monday to Saturday (Sundays Closed)",
        timeSlots: ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "02:00 PM", "02:30 PM", "03:00 PM"],
        image: "../images/doctors/ananya-gupta.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=600",
        appointmentStatus: "Available",
        about: "Dr. Ananya Gupta provides family health consultation, holistic preventive health assessments, and telemedicine care.",
        specializations: [
            "General Medicine",
            "Preventive Care",
            "Lifestyle Management",
            "Primary Healthcare"
        ]
    }
};

function getDoctorId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

function loadDoctorProfile() {
    let doctorId = getDoctorId();

    if (!doctorId) {
        const selectedDoctor = localStorage.getItem("selectedDoctor");
        if (selectedDoctor) {
            const entry = Object.entries(doctorsData).find(([id, data]) => data.name === selectedDoctor);
            if (entry) doctorId = entry[0];
        }
    }

    if (!doctorId || !doctorsData[doctorId]) {
        doctorId = "rahul";
    }

    const doctor = doctorsData[doctorId];

    // Name & info
    const nameEl = document.getElementById("doctorName");
    if (nameEl) nameEl.textContent = doctor.name;

    const specEl = document.getElementById("doctorSpecialization");
    if (specEl) specEl.textContent = doctor.specialization;

    const qualEl = document.querySelector(".profile-qualification");
    if (qualEl) qualEl.textContent = doctor.qualification;

    const ratingEl = document.getElementById("doctorRating");
    if (ratingEl) ratingEl.textContent = doctor.rating;

    const expEl = document.querySelector(".profile-stats div:nth-child(2) strong");
    if (expEl) expEl.textContent = doctor.experience;

    const consultEl = document.querySelector(".profile-stats div:nth-child(3) strong");
    if (consultEl) consultEl.textContent = doctor.consultations;

    const feeEl = document.getElementById("doctorFee");
    if (feeEl) feeEl.textContent = doctor.fee;

    const aboutEl = document.getElementById("doctorAbout");
    if (aboutEl) aboutEl.textContent = doctor.about;

    // Doctor photo
    const avatarContainer = document.querySelector(".doctor-large-avatar");
    if (avatarContainer) {
        avatarContainer.innerHTML = `
            <img
                src="${doctor.image}"
                alt="${doctor.name}"
                style="width:100%; height:100%; object-fit:cover; border-radius:50%;"
                onerror="this.onerror=null; this.src='${doctor.fallbackImage}';"
            >
        `;
    }

    // Specializations
    const tagContainer = document.getElementById("specializationTags");
    if (tagContainer) {
        tagContainer.innerHTML = "";
        doctor.specializations.forEach(s => {
            const span = document.createElement("span");
            span.textContent = s;
            tagContainer.appendChild(span);
        });
    }

    // Hospital & Schedule Card
    let scheduleCard = document.getElementById("doctorScheduleCard");
    if (!scheduleCard) {
        const detailsContainer = document.querySelector(".profile-details");
        if (detailsContainer) {
            scheduleCard = document.createElement("div");
            scheduleCard.id = "doctorScheduleCard";
            scheduleCard.className = "detail-card";
            detailsContainer.insertBefore(scheduleCard, detailsContainer.children[1]);
        }
    }

    if (scheduleCard) {
        scheduleCard.innerHTML = `
            <h2><i class="fa-solid fa-hospital"></i> Hospital & Consultation Schedule</h2>
            <div style="margin-bottom:14px;">
                <p style="margin:0 0 4px; font-weight:700; color:#1e332b; font-size:14px;">
                    <i class="fa-solid fa-location-dot" style="color:#0b9f6e; margin-right:6px;"></i>
                    ${doctor.clinicHospital}
                </p>
                <p style="margin:0; font-size:12px; color:#6b7c73;">
                    <i class="fa-regular fa-calendar-days" style="color:#0b9f6e; margin-right:6px;"></i>
                    Available Days: <strong>${doctor.availableDays}</strong>
                </p>
            </div>
            <div>
                <strong style="display:block; font-size:12px; color:#405349; margin-bottom:8px;">Available Time Slots:</strong>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    ${doctor.timeSlots.map(t => `
                        <span style="display:inline-block; padding:6px 12px; background:#effaf4; border:1px solid #c2e8d7; border-radius:7px; font-size:11px; font-weight:700; color:#0b9f6e;">
                            <i class="fa-regular fa-clock"></i> ${t}
                        </span>
                    `).join("")}
                </div>
            </div>
        `;
    }

    localStorage.setItem("selectedDoctorId", doctorId);
    localStorage.setItem("selectedDoctor", doctor.name);
}

window.goToAppointment = function() {
    const doctorId = localStorage.getItem("selectedDoctorId") || getDoctorId() || "rahul";
    window.location.href = "appointment.html?id=" + doctorId;
};

function updateCartCount() {
    const cartCount = document.getElementById("cartCount");
    if (!cartCount) return;
    const cart = JSON.parse(localStorage.getItem("healthkartCart")) || [];
    cartCount.textContent = cart.reduce((total, item) => total + (item.quantity || 1), 0);
}

document.addEventListener("DOMContentLoaded", () => {
    loadDoctorProfile();
    updateCartCount();
});