// ========================================
// HEALTHKART - MY HEALTH DASHBOARD
// ========================================

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ========================================
// GET ELEMENTS
// ========================================

const userName = document.getElementById("userName");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileMobile = document.getElementById("profileMobile");

const logoutButton = document.getElementById("logoutButton");


// ========================================
// CHECK LOGIN
// ========================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        // User is not logged in
        window.location.href = "login.html";

        return;
    }


    console.log("Logged-in user:", user.uid);


    // ----------------------------------------
    // Firebase Authentication information
    // ----------------------------------------

    const email = user.email || "-";

    const nameFromAuth =
        user.displayName || "HealthKart User";


    // Display basic information
    userName.textContent = nameFromAuth;

    profileName.textContent = nameFromAuth;

    profileEmail.textContent = email;


    // ----------------------------------------
    // Get additional information from Firestore
    // ----------------------------------------

    try {

        const userRef =
            doc(db, "users", user.uid);

        const userSnapshot =
            await getDoc(userRef);


        if (userSnapshot.exists()) {

            const userData =
                userSnapshot.data();


            // Name
            if (userData.name) {

                userName.textContent =
                    userData.name;

                profileName.textContent =
                    userData.name;
            }


            // Email
            if (userData.email) {

                profileEmail.textContent =
                    userData.email;
            }


            // Mobile
            if (userData.mobile) {

                profileMobile.textContent =
                    userData.mobile;
            }

        } else {

            console.log(
                "User document not found in Firestore."
            );

        }

    } catch (error) {

        console.error("Error loading user profile:", error);
    }

    // Load actual appointment count
    try {
        const apptRes = await fetch(`/api/appointments/my?email=${encodeURIComponent(user.email || '')}`);
        const apptData = await apptRes.json();
        const apptCountEl = document.getElementById("appointmentsCount");
        if (apptCountEl && apptData.success) {
            const count = apptData.count || 0;
            apptCountEl.textContent = `${count} appointment${count === 1 ? '' : 's'}`;
        }
    } catch (e) {
        const cached = JSON.parse(localStorage.getItem("healthkartAppointments")) || [];
        const apptCountEl = document.getElementById("appointmentsCount");
        if (apptCountEl) apptCountEl.textContent = `${cached.length} appointment${cached.length === 1 ? '' : 's'}`;
    }
});


// ========================================
// LOGOUT
// ========================================

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async function () {

            const confirmation =
                confirm(
                    "Are you sure you want to logout?"
                );


            if (!confirmation) {
                return;
            }


            try {

                await signOut(auth);


                // Remove old demo session data
                localStorage.removeItem(
                    "healthkartLoggedIn"
                );

                localStorage.removeItem(
                    "healthkartCurrentUser"
                );


                alert(
                    "You have been logged out successfully."
                );


                window.location.href =
                    "login.html";


            } catch (error) {

                console.error(
                    "Logout Error:",
                    error
                );


                alert(
                    "Logout failed. Please try again."
                );

            }

        }
    );

}