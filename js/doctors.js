/* =========================================
   HEALTHKART DOCTORS CATALOG
   Data-driven doctor list with real photos,
   specializations, qualifications, hospital,
   available days, slots, and fees.
========================================= */

const DOCTORS_FALLBACK = [
    {
        id: "rahul",
        name: "Dr. Rahul Sharma",
        specialization: "General Physician",
        qualification: "MBBS, MD - General Medicine",
        experience: "12 years experience",
        consultationFee: 499,
        clinicHospital: "Max Super Speciality Hospital, New Delhi",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        availableTimeSlots: ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM"],
        image: "../images/doctors/rahul-sharma.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600",
        rating: 4.8,
        consultations: 245,
        appointmentStatus: "Available"
    },
    {
        id: "priya",
        name: "Dr. Priya Mehta",
        specialization: "Dermatologist",
        qualification: "MBBS, MD - Dermatology",
        experience: "9 years experience",
        consultationFee: 599,
        clinicHospital: "Apollo Spectra Hospitals, Mumbai",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        availableTimeSlots: ["10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM", "03:00 PM"],
        image: "../images/doctors/priya-mehta.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=600",
        rating: 4.9,
        consultations: 310,
        appointmentStatus: "Available"
    },
    {
        id: "amit",
        name: "Dr. Amit Verma",
        specialization: "Cardiologist",
        qualification: "MBBS, MD, DM - Cardiology",
        experience: "15 years experience",
        consultationFee: 799,
        clinicHospital: "Fortis Escorts Heart Institute, Bengaluru",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        availableTimeSlots: ["11:00 AM", "11:30 AM", "12:00 PM", "05:00 PM", "05:30 PM", "06:00 PM"],
        image: "../images/doctors/amit-verma.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600",
        rating: 4.7,
        consultations: 185,
        appointmentStatus: "Available"
    },
    {
        id: "neha",
        name: "Dr. Neha Kapoor",
        specialization: "Pediatrician",
        qualification: "MBBS, MD - Pediatrics",
        experience: "8 years experience",
        consultationFee: 549,
        clinicHospital: "Cloudnine Hospital, Gurugram",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        availableTimeSlots: ["09:30 AM", "10:00 AM", "10:30 AM", "03:30 PM", "04:00 PM", "04:30 PM"],
        image: "../images/doctors/neha-kapoor.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600",
        rating: 4.8,
        consultations: 220,
        appointmentStatus: "Available"
    },
    {
        id: "arjun",
        name: "Dr. Arjun Singh",
        specialization: "Orthopedic",
        qualification: "MBBS, MS - Orthopedics",
        experience: "11 years experience",
        consultationFee: 699,
        clinicHospital: "Manipal Hospital, Hyderabad",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        availableTimeSlots: ["10:00 AM", "10:30 AM", "11:00 AM", "04:00 PM", "04:30 PM", "05:00 PM"],
        image: "../images/doctors/arjun-singh.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600",
        rating: 4.6,
        consultations: 160,
        appointmentStatus: "Available"
    },
    {
        id: "ananya",
        name: "Dr. Ananya Gupta",
        specialization: "General Physician",
        qualification: "MBBS, MD - General Medicine",
        experience: "7 years experience",
        consultationFee: 449,
        clinicHospital: "Artemis Hospital, Noida",
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        availableTimeSlots: ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "02:00 PM", "02:30 PM", "03:00 PM"],
        image: "../images/doctors/ananya-gupta.jpg",
        fallbackImage: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=600",
        rating: 4.9,
        consultations: 275,
        appointmentStatus: "Available"
    }
];

let allDoctors = [];

async function loadDoctors() {
    const grid = document.getElementById("doctorGrid");
    if (!grid) return;

    try {
        const res = await fetch("/api/doctors");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (data.success && data.doctors && data.doctors.length > 0) {
            allDoctors = data.doctors;
        } else {
            allDoctors = DOCTORS_FALLBACK;
        }
    } catch (err) {
        console.warn("Using offline doctors list:", err);
        allDoctors = DOCTORS_FALLBACK;
    }

    applyDoctorFilters();
}

function renderDoctorGrid(doctors) {
    const grid = document.getElementById("doctorGrid");
    const resultText = document.getElementById("doctorResultText");
    const noDoctors = document.getElementById("noDoctors");

    if (resultText) {
        resultText.textContent = doctors.length === 0
            ? "No doctors available"
            : `Showing ${doctors.length} qualified doctor${doctors.length > 1 ? "s" : ""}`;
    }

    if (noDoctors) {
        noDoctors.style.display = doctors.length === 0 ? "block" : "none";
    }

    if (!grid) return;

    grid.innerHTML = doctors.map(doc => {
        const imgSrc = doc.image.startsWith("../") || doc.image.startsWith("/") || doc.image.startsWith("http")
            ? (doc.image.startsWith("/") ? ".." + doc.image : doc.image)
            : "../images/doctors/" + doc.image;

        const fallback = doc.fallbackImage || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600";
        const daysText = Array.isArray(doc.availableDays) ? doc.availableDays.join(", ") : "Mon - Sat";

        return `
            <article
                class="doctor-card"
                data-specialization="${doc.specialization}"
                data-name="${doc.name}"
                data-rating="${doc.rating}"
                data-fee="${doc.consultationFee}"
            >
                <div class="doctor-image">
                    <div class="doctor-avatar">
                        <img
                            src="${imgSrc}"
                            alt="${doc.name} - ${doc.specialization}"
                            loading="lazy"
                            onerror="this.onerror=null; this.src='${fallback}';"
                        >
                    </div>
                    <span class="verified">
                        <i class="fa-solid fa-circle-check"></i>
                        Verified
                    </span>
                </div>

                <div class="doctor-info">
                    <h3>${doc.name}</h3>
                    <p class="specialization">${doc.specialization}</p>
                    <p style="font-size:11px; color:#78867e; margin:-2px 0 6px;">${doc.qualification}</p>

                    <div class="doctor-hospital">
                        <i class="fa-solid fa-hospital"></i>
                        <span>${doc.clinicHospital}</span>
                    </div>

                    <p class="experience">
                        <i class="fa-solid fa-briefcase-medical"></i>
                        ${doc.experience}
                    </p>

                    <div class="doctor-days-badge">
                        <i class="fa-regular fa-calendar-days"></i>
                        <span>${daysText} (Sundays Closed)</span>
                    </div>

                    <div class="doctor-rating" style="margin-top:10px;">
                        <span>
                            <i class="fa-solid fa-star"></i>
                            ${doc.rating}
                        </span>
                        <small>${doc.consultations}+ consultations</small>
                    </div>

                    <div class="doctor-bottom" style="margin-top:14px;">
                        <div>
                            <span class="fee-label">Consultation</span>
                            <strong>₹${doc.consultationFee}</strong>
                        </div>
                        <span class="available">
                            <i class="fa-solid fa-circle" style="font-size:7px;margin-right:4px;"></i>
                            ${doc.appointmentStatus || 'Available'}
                        </span>
                    </div>

                    <div class="doctor-actions">
                        <a href="doctor-profile.html?id=${doc.id}" class="profile-btn">
                            View Profile
                        </a>
                        <button onclick="bookDoctor('${doc.id}', '${doc.name}')" class="book-btn">
                            Book
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

function applyDoctorFilters() {
    const searchInput = document.getElementById("doctorSearch");
    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : "";

    const selectedSpecializations = Array.from(
        document.querySelectorAll(".specialization-filter:checked")
    ).map(f => f.value.toLowerCase());

    const sortType = document.getElementById("sortDoctors")?.value || "recommended";

    let filtered = allDoctors.filter(doc => {
        const matchesSearch = !searchText ||
            doc.name.toLowerCase().includes(searchText) ||
            doc.specialization.toLowerCase().includes(searchText) ||
            (doc.clinicHospital && doc.clinicHospital.toLowerCase().includes(searchText));

        const matchesSpec = selectedSpecializations.length === 0 ||
            selectedSpecializations.includes(doc.specialization.toLowerCase());

        return matchesSearch && matchesSpec;
    });

    if (sortType === "rating") {
        filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortType === "fee-low") {
        filtered.sort((a, b) => a.consultationFee - b.consultationFee);
    } else if (sortType === "fee-high") {
        filtered.sort((a, b) => b.consultationFee - a.consultationFee);
    }

    renderDoctorGrid(filtered);
}

window.applyFilters = applyDoctorFilters;

window.clearFilters = function () {
    document.querySelectorAll(".specialization-filter").forEach(f => { f.checked = false; });
    const searchInput = document.getElementById("doctorSearch");
    if (searchInput) searchInput.value = "";
    const sortSelect = document.getElementById("sortDoctors");
    if (sortSelect) sortSelect.selectedIndex = 0;
    applyDoctorFilters();
};

window.bookDoctor = function (doctorId, doctorName) {
    // If only doctorName is passed, find doctorId
    if (!doctorName && typeof doctorId === 'string' && doctorId.startsWith('Dr.')) {
        doctorName = doctorId;
        const found = allDoctors.find(d => d.name === doctorName);
        doctorId = found ? found.id : "rahul";
    }

    localStorage.setItem("selectedDoctorId", doctorId);
    if (doctorName) localStorage.setItem("selectedDoctor", doctorName);
    window.location.href = `appointment.html?id=${doctorId}`;
};

function updateCartCount() {
    const cartCount = document.getElementById("cartCount");
    if (!cartCount) return;
    const cart = JSON.parse(localStorage.getItem("healthkartCart")) || [];
    cartCount.textContent = cart.reduce((total, item) => total + (item.quantity || 1), 0);
}

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("doctorSearch");
    if (searchInput) {
        searchInput.addEventListener("input", applyDoctorFilters);
    }

    document.querySelectorAll(".specialization-filter").forEach(filter => {
        filter.addEventListener("change", applyDoctorFilters);
    });

    const sortDoctors = document.getElementById("sortDoctors");
    if (sortDoctors) {
        sortDoctors.addEventListener("change", applyDoctorFilters);
    }

    updateCartCount();
    loadDoctors();
});