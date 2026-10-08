// ========================================
// HEALTHKART - SHARED AUTH & REALTIME NAVBAR
// Used by every page.
// - Immediate persistent auth rendering (no flash of Login)
// - Dropdown with: My Profile, My Appointments, Notifications, Doctor Dashboard, Logout
// - Real-time notification bell icon + counter + drawer
// - Real-time Socket.IO alerts for appointment confirmation
// ========================================

import { auth, db } from "./firebase-config.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { toast, confirmDialog } from "./ui.js";

// Paths helper
const IN_PAGES = location.pathname.includes("/pages/");
const P = IN_PAGES ? "" : "pages/";
const HOME = IN_PAGES ? "../index.html" : "index.html";
const REQUIRES_AUTH = document.body.hasAttribute("data-require-auth");

// Ensure nav-auth stylesheet is loaded
if (!document.querySelector("link[data-hk-nav]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../css/nav-auth.css", import.meta.url).href;
    link.setAttribute("data-hk-nav", "");
    document.head.appendChild(link);
}

// Auto-inject HealthKart Real-Time AI Agent across all pages
if (!document.querySelector("script[data-hk-ai]")) {
    const aiScript = document.createElement("script");
    aiScript.type = "module";
    aiScript.src = new URL("./ai-agent.js", import.meta.url).href;
    aiScript.setAttribute("data-hk-ai", "");
    document.body.appendChild(aiScript);
}

// Ensure Socket.io client script is loaded for real-time notifications
function loadSocketIO() {
    if (window.io) return Promise.resolve(window.io);
    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "/socket.io/socket.io.js";
        script.onload = () => resolve(window.io);
        script.onerror = () => {
            const fallback = document.createElement("script");
            fallback.src = "http://localhost:3000/socket.io/socket.io.js";
            fallback.onload = () => resolve(window.io);
            fallback.onerror = () => {
                const cdn = document.createElement("script");
                cdn.src = "https://cdn.socket.io/4.8.1/socket.io.min.js";
                cdn.onload = () => resolve(window.io);
                cdn.onerror = () => resolve(null);
                document.head.appendChild(cdn);
            };
            document.head.appendChild(fallback);
        };
        document.head.appendChild(script);
    });
}

// Helpers
function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (key === "class") node.className = value;
        else node.setAttribute(key, value);
    });
    children.forEach((child) => {
        if (typeof child === "string" || typeof child === "number") {
            node.appendChild(document.createTextNode(child));
        } else if (child) {
            node.appendChild(child);
        }
    });
    return node;
}

function icon(classes) {
    return el("i", { class: classes, "aria-hidden": "true" });
}

function initialsOf(user) {
    const source = (user.displayName || user.name || user.email || "U").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
}

function currentPageWithQuery() {
    const file = location.pathname.split("/").pop() || "index.html";
    if (!IN_PAGES && (file === "index.html" || file === "")) {
        return "../index.html" + location.search;
    }
    return file + location.search;
}

// Real-time notifications state
let currentNotifications = [];
let unreadCount = 0;
let socketClient = null;

// Auth wrapper element
const wrapper = el("div", { class: "hk-auth" });

function mountWrapper() {
    const header = document.querySelector("header");
    if (!header) return false;

    // Look for static login links
    const loginLinks = header.querySelectorAll(
        'a.login-button, a.login-btn, a[href$="login.html"]'
    );

    if (loginLinks.length) {
        loginLinks[0].replaceWith(wrapper);
        loginLinks.forEach((link, idx) => { if (idx > 0) link.remove(); });
        return true;
    }

    const mount =
        header.querySelector(".nav-actions") ||
        header.querySelector(".header-nav") ||
        header.querySelector(".header-container") ||
        header.querySelector(".health-header-inner") ||
        header.querySelector(".header-inner") ||
        header;

    mount.appendChild(wrapper);
    return true;
}

// RENDER: Logged Out State
function renderLoggedOut() {
    const cur = currentPageWithQuery();
    const hasSpecificNext = cur && cur !== "../index.html" && cur !== "index.html" && !cur.includes("login.html") && !cur.includes("signup.html");
    const nextParam = hasSpecificNext ? "?next=" + encodeURIComponent(cur) : "";
    const link = el(
        "a",
        { class: "hk-login-btn", href: P + "login.html" + nextParam },
        "Login"
    );
    wrapper.replaceChildren(link);
}


// RENDER: Logged In State
function renderLoggedIn(user) {
    const displayName = user.displayName || user.name || (user.email ? user.email.split('@')[0] : "HealthKart User");
    const email = user.email || "";

    // 1. Notification Bell
    const notifBtn = el(
        "button",
        {
            class: "hk-notif-trigger",
            type: "button",
            "aria-label": "Notifications",
            "aria-haspopup": "true",
            "aria-expanded": "false",
            id: "hkNotifBtn"
        },
        icon("fa-regular fa-bell")
    );

    const badge = el(
        "span",
        { class: "hk-notif-badge", id: "hkNotifBadge", style: unreadCount > 0 ? "" : "display:none" },
        unreadCount
    );
    notifBtn.appendChild(badge);

    // Notification Panel
    const notifPanel = el("div", { class: "hk-notif-panel", id: "hkNotifPanel", hidden: "" });
    const notifHeader = el(
        "div",
        { class: "hk-notif-header" },
        el("h4", {}, icon("fa-solid fa-bell"), " Notifications"),
        el("button", { type: "button", id: "hkMarkAllRead" }, "Mark all read")
    );
    const notifList = el("div", { class: "hk-notif-list", id: "hkNotifList" });
    notifPanel.append(notifHeader, notifList);

    // 2. Avatar Trigger
    const avatarBtn = el(
        "button",
        {
            class: "hk-avatar",
            type: "button",
            "aria-haspopup": "true",
            "aria-expanded": "false",
            "aria-label": "Open profile menu"
        },
        initialsOf(user)
    );

    // 3. Dropdown Menu (Requirement 7)
    const menu = el("div", { class: "hk-menu", role: "menu", hidden: "" });
    menu.append(
        el(
            "div",
            { class: "hk-menu-head" },
            el("strong", {}, displayName),
            el("span", {}, email)
        ),
        el("a", { class: "hk-menu-item", href: P + "my-health.html" }, icon("fa-regular fa-user"), "My Profile"),
        el("a", { class: "hk-menu-item", href: P + "my-appointments.html" }, icon("fa-solid fa-calendar-check"), "My Appointments"),
        el("button", { class: "hk-menu-item", type: "button", id: "hkMenuAiLink" }, icon("fa-solid fa-sparkles"), "AI Health Assistant"),
        el("a", { class: "hk-menu-item", href: P + "reminders.html" }, icon("fa-solid fa-pills"), "Medicine & Yoga Reminders"),
        el("a", { class: "hk-menu-item", href: P + "prescriptions.html" }, icon("fa-solid fa-file-prescription"), "My Prescriptions"),
        el("button", { class: "hk-menu-item", type: "button", id: "hkMenuNotifLink" }, icon("fa-regular fa-bell"), "Notifications"),
        el("a", { class: "hk-menu-item", href: P + "doctor-dashboard.html" }, icon("fa-solid fa-user-doctor"), "Doctor Dashboard"),
        el("a", { class: "hk-menu-item", href: P + "orders.html" }, icon("fa-solid fa-box"), "My Orders"),
        el("a", { class: "hk-menu-item", href: P + "wishlist.html" }, icon("fa-regular fa-heart"), "My Wishlist")
    );

    const logoutBtn = el(
        "button",
        { class: "hk-menu-item hk-menu-logout", type: "button" },
        icon("fa-solid fa-arrow-right-from-bracket"),
        "Logout"
    );
    menu.append(logoutBtn);

    wrapper.replaceChildren(notifBtn, notifPanel, avatarBtn, menu);

    // Toggle menu
    function closeAll() {
        menu.hidden = true;
        notifPanel.hidden = true;
        avatarBtn.setAttribute("aria-expanded", "false");
        notifBtn.setAttribute("aria-expanded", "false");
    }

    avatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = menu.hidden;
        closeAll();
        menu.hidden = !open;
        avatarBtn.setAttribute("aria-expanded", String(open));
    });

    notifBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = notifPanel.hidden;
        closeAll();
        notifPanel.hidden = !open;
        notifBtn.setAttribute("aria-expanded", String(open));
        if (open) renderNotifItems();
    });

    const menuNotifLink = menu.querySelector("#hkMenuNotifLink");
    if (menuNotifLink) {
        menuNotifLink.addEventListener("click", (e) => {
            e.stopPropagation();
            closeAll();
            notifPanel.hidden = false;
            notifBtn.setAttribute("aria-expanded", "true");
            renderNotifItems();
        });
    }

    const menuAiLink = menu.querySelector("#hkMenuAiLink");
    if (menuAiLink) {
        menuAiLink.addEventListener("click", (e) => {
            e.stopPropagation();
            closeAll();
            if (window.HK_AI) window.HK_AI.open("chat");
        });
    }

    logoutBtn.addEventListener("click", handleLogout);
    wrapper._closeMenu = closeAll;

    // Load initial notifications
    fetchNotifications(email);
}

// Render notification items in panel
function renderNotifItems() {
    const list = document.getElementById("hkNotifList");
    if (!list) return;

    if (!currentNotifications.length) {
        list.innerHTML = `<div class="hk-notif-empty"><i class="fa-regular fa-bell-slash" style="font-size:24px;margin-bottom:8px;display:block;"></i>No notifications yet</div>`;
        return;
    }

    list.innerHTML = currentNotifications.map(n => `
        <a href="${P}my-appointments.html" class="hk-notif-item ${n.read ? '' : 'unread'}">
            <div class="hk-notif-icon">
                <i class="fa-solid fa-calendar-check"></i>
            </div>
            <div class="hk-notif-body">
                <div class="hk-notif-title">${n.title || 'Notification'}</div>
                <div class="hk-notif-msg">${n.message || ''}</div>
                <div class="hk-notif-time">${formatTimeAgo(n.createdAt)}</div>
            </div>
        </a>
    `).join("");

    const markBtn = document.getElementById("hkMarkAllRead");
    if (markBtn) {
        markBtn.onclick = async () => {
            currentNotifications.forEach(n => { n.read = true; });
            unreadCount = 0;
            const badge = document.getElementById("hkNotifBadge");
            if (badge) badge.style.display = "none";
            renderNotifItems();
            try {
                await fetch("/api/notifications/mark-read", { method: "POST" });
            } catch (e) {}
        };
    }
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return "Just now";
    const sec = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (sec < 60) return "Just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
}

// Fetch notifications from backend
async function fetchNotifications(email) {
    try {
        const res = await fetch(`/api/notifications?email=${encodeURIComponent(email || '')}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.notifications) {
            currentNotifications = data.notifications;
            unreadCount = currentNotifications.filter(n => !n.read).length;
            const badge = document.getElementById("hkNotifBadge");
            if (badge) {
                badge.textContent = unreadCount;
                badge.style.display = unreadCount > 0 ? "flex" : "none";
            }
        }
    } catch (err) {
        console.warn("Could not fetch notifications:", err);
    }
}

// Show Real-time Floating Notification Toast (Requirement 6)
export function showLiveToast(title, message, link = P + "my-appointments.html") {
    const existing = document.querySelector(".hk-live-toast");
    if (existing) existing.remove();

    const toastNode = el(
        "div",
        { class: "hk-live-toast" },
        el("div", { class: "hk-live-toast-icon" }, icon("fa-solid fa-bell")),
        el(
            "div",
            { class: "hk-live-toast-content" },
            el("strong", {}, title),
            el("p", {}, message)
        ),
        el(
            "button",
            {
                class: "hk-live-toast-close",
                type: "button",
                onclick: () => toastNode.remove()
            },
            "×"
        )
    );

    toastNode.addEventListener("click", (e) => {
        if (!e.target.classList.contains("hk-live-toast-close")) {
            window.location.href = link;
        }
    });

    document.body.appendChild(toastNode);
    setTimeout(() => {
        if (toastNode.parentElement) toastNode.remove();
    }, 6000);
}

// Expose globally
window.showLiveToast = showLiveToast;
window.openAIAgent = (tab = "chat") => {
    if (window.HK_AI) window.HK_AI.open(tab);
};

// ==========================================
// INCOMING DOCTOR VIDEO CALL RINGING SYSTEM
// ==========================================
let ringtoneAudioCtx = null;
let ringtoneInterval = null;
let activeIncomingCallModal = null;
let activeIncomingCallData = null;
let fsCallsUnsubscriber = null;

function startRingtone() {
    stopRingtone();
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        ringtoneAudioCtx = new AudioCtx();

        const playRingBurst = () => {
            if (!ringtoneAudioCtx || ringtoneAudioCtx.state === "closed") return;
            if (ringtoneAudioCtx.state === "suspended") {
                ringtoneAudioCtx.resume().catch(() => {});
            }

            const now = ringtoneAudioCtx.currentTime;
            // Realistic dual-tone UK/US phone ring cadence (440Hz + 480Hz)
            createTonePair(440, 480, now, 0.45);
            createTonePair(440, 480, now + 0.55, 0.55);
        };

        function createTonePair(f1, f2, startTime, duration) {
            const osc1 = ringtoneAudioCtx.createOscillator();
            const osc2 = ringtoneAudioCtx.createOscillator();
            const gain = ringtoneAudioCtx.createGain();

            osc1.type = "sine";
            osc2.type = "sine";
            osc1.frequency.setValueAtTime(f1, startTime);
            osc2.frequency.setValueAtTime(f2, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.04);
            gain.gain.setValueAtTime(0.2, startTime + duration - 0.04);
            gain.gain.linearRampToValueAtTime(0, startTime + duration);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ringtoneAudioCtx.destination);

            osc1.start(startTime);
            osc2.start(startTime);
            osc1.stop(startTime + duration);
            osc2.stop(startTime + duration);
        }

        playRingBurst();
        ringtoneInterval = setInterval(playRingBurst, 3000);

        if (navigator.vibrate) {
            try { navigator.vibrate([400, 200, 400, 200, 800]); } catch (e) {}
        }
    } catch (e) {
        console.warn("Could not start phone ringtone audio:", e);
    }
}

function stopRingtone() {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
    if (ringtoneAudioCtx) {
        try { ringtoneAudioCtx.close(); } catch (e) {}
        ringtoneAudioCtx = null;
    }
    if (navigator.vibrate) {
        try { navigator.vibrate(0); } catch (e) {}
    }
}

function dismissIncomingCall() {
    stopRingtone();
    if (activeIncomingCallModal) {
        activeIncomingCallModal.remove();
        activeIncomingCallModal = null;
    }
    activeIncomingCallData = null;
}

export function showIncomingCallModal(callData) {
    if (!callData || !callData.roomId) return;

    // Do not show on video consultation screen itself
    if (location.pathname.includes("video-consultation.html")) return;

    // Do not display if logged in as a doctor
    const currentUser = getCachedUser();
    if (currentUser && currentUser.role === "doctor") return;

    // Prevent duplicate modals for same call room
    if (activeIncomingCallData && activeIncomingCallData.roomId === callData.roomId) {
        return;
    }

    dismissIncomingCall();
    activeIncomingCallData = callData;

    const docName = callData.doctorName || "Doctor";
    const spec = callData.doctorSpecialization || "Specialist Physician";
    const hospital = callData.clinicHospital || "HealthKart Telehealth Clinic";
    const docImg = callData.doctorImage || (IN_PAGES ? "../images/doctors/rahul-sharma.jpg" : "images/doctors/rahul-sharma.jpg");
    const apptId = callData.appointmentId || "";
    const patName = callData.patientName || (currentUser ? (currentUser.displayName || currentUser.name) : "Patient");

    const overlay = el("div", { class: "hk-incoming-call-overlay", id: "hkIncomingCallOverlay" });
    const card = el("div", { class: "hk-incoming-call-card" });

    // Badge
    const badge = el("div", { class: "hk-incoming-badge" },
        el("span", { class: "hk-incoming-badge-dot" }),
        "INCOMING VIDEO CONSULTATION"
    );

    // Avatar with pulsating ripples
    const avatarWrap = el("div", { class: "hk-incoming-avatar-wrap" },
        el("div", { class: "hk-incoming-ripple" }),
        el("div", { class: "hk-incoming-ripple" }),
        el("div", { class: "hk-incoming-ripple" }),
        el("img", {
            class: "hk-incoming-avatar",
            src: docImg,
            alt: docName,
            onerror: "this.onerror=null; this.src='https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600';"
        })
    );

    // Doctor info
    const nameEl = el("h3", { class: "hk-incoming-doc-name" }, docName);
    const specEl = el("div", { class: "hk-incoming-doc-spec" }, spec);
    const hospEl = el("div", { class: "hk-incoming-hospital" }, hospital);
    const callText = el("div", { class: "hk-incoming-calling-text" },
        icon("fa-solid fa-phone-volume fa-shake"),
        ` Calling for ${patName} ${apptId ? `• ID: ${apptId}` : ''}`
    );

    // Actions
    const actions = el("div", { class: "hk-incoming-actions" });

    // Decline button
    const declineWrap = el("div", { class: "hk-incoming-action-item" });
    const declineBtn = el("button", {
        type: "button",
        class: "hk-incoming-btn hk-incoming-btn-decline",
        "aria-label": "Decline call",
        title: "Decline Call"
    }, icon("fa-solid fa-phone-slash"));
    const declineLabel = el("span", { class: "hk-incoming-btn-label" }, "Decline");
    declineWrap.append(declineBtn, declineLabel);

    // Accept button
    const acceptWrap = el("div", { class: "hk-incoming-action-item" });
    const acceptBtn = el("button", {
        type: "button",
        class: "hk-incoming-btn hk-incoming-btn-accept",
        "aria-label": "Accept call",
        title: "Accept Video Call"
    }, icon("fa-solid fa-video"));
    const acceptLabel = el("span", { class: "hk-incoming-btn-label" }, "Accept");
    acceptWrap.append(acceptBtn, acceptLabel);

    actions.append(declineWrap, acceptWrap);
    card.append(badge, avatarWrap, nameEl, specEl, hospEl, callText, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    activeIncomingCallModal = overlay;

    // Start ringtone chime
    startRingtone();

    // Accept action
    acceptBtn.onclick = async () => {
        dismissIncomingCall();

        // 1. Notify socket server
        if (socketClient) {
            socketClient.emit("accept_doctor_call", {
                roomId: callData.roomId,
                appointmentId: callData.appointmentId
            });
        }

        // 2. Update Firestore call doc status to accepted
        if (db && callData.roomId) {
            try {
                await updateDoc(doc(db, "calls", callData.roomId), {
                    status: "accepted",
                    acceptedAt: serverTimestamp()
                });
            } catch (e) {}
        }

        // 3. Navigate to video consultation
        window.location.href = `${P}video-consultation.html?appointmentId=${encodeURIComponent(callData.appointmentId || apptId)}&role=patient`;
    };

    // Decline action
    declineBtn.onclick = async () => {
        dismissIncomingCall();

        // 1. Notify socket server
        if (socketClient) {
            socketClient.emit("decline_doctor_call", {
                roomId: callData.roomId,
                appointmentId: callData.appointmentId
            });
        }

        // 2. Update Firestore call doc status to declined
        if (db && callData.roomId) {
            try {
                await updateDoc(doc(db, "calls", callData.roomId), {
                    status: "declined",
                    declinedAt: serverTimestamp()
                });
            } catch (e) {}
        }

        toast("Consultation call declined.", "info", 2000);
    };
}

window.showIncomingCallModal = showIncomingCallModal;
window.dismissIncomingCall = dismissIncomingCall;

// Initialize Real-time Socket.IO Connection & Dual Signaling (Requirement 6 & 8)
async function initRealtime(user) {
    const ioFn = await loadSocketIO();

    if (ioFn && !socketClient) {
        const isDifferentPort = window.location.port && window.location.port !== "3000";
        const socketHost = isDifferentPort && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
            ? "http://localhost:3000"
            : undefined;

        socketClient = socketHost ? ioFn(socketHost) : ioFn();

        socketClient.on("connect", () => {
            console.log("HealthKart Real-time connected.");
            if (user && user.email) {
                socketClient.emit("register_user", { email: user.email });
            }
        });

        // Listen for real-time notifications
        socketClient.on("realtime_notification", ({ recipientEmail, notification }) => {
            if (!recipientEmail || (user && user.email && recipientEmail.toLowerCase() === user.email.toLowerCase())) {
                unreadCount++;
                currentNotifications.unshift(notification);

                const badge = document.getElementById("hkNotifBadge");
                if (badge) {
                    badge.textContent = unreadCount;
                    badge.style.display = "flex";
                }

                // Show instant live notification banner
                showLiveToast(
                    notification.title || "Appointment Booked!",
                    notification.message,
                    P + "my-appointments.html"
                );
            }
        });

        // Listen for incoming doctor calls via Socket.IO
        socketClient.on("incoming_doctor_call", (callData) => {
            console.log("Received incoming doctor call event:", callData);
            if (user && user.role === "doctor") return;
            const targetEmail = (callData.patientEmail || "").toLowerCase();
            const currentEmail = (user?.email || "").toLowerCase();
            if (!targetEmail || !currentEmail || targetEmail === currentEmail) {
                showIncomingCallModal(callData);
            }
        });

        socketClient.on("doctor_call_declined", (data) => {
            if (activeIncomingCallData && data.roomId === activeIncomingCallData.roomId) {
                dismissIncomingCall();
            }
        });

        socketClient.on("call_ended", () => {
            dismissIncomingCall();
        });
    }

    // Firestore Real-Time Calls Snapshot Listener (Distributed Fallback)
    if (db && !fsCallsUnsubscriber) {
        try {
            fsCallsUnsubscriber = onSnapshot(collection(db, "calls"), (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (!data) return;

                    if (data.status === "ringing" && data.callerRole === "doctor") {
                        if (user && user.role === "doctor") return;
                        const targetEmail = (data.patientEmail || "").toLowerCase();
                        const currentEmail = (user?.email || "").toLowerCase();

                        // Only consider calls created recently (within last 90 seconds)
                        const createdAtMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
                        const isRecent = (Date.now() - createdAtMs) < 90000;

                        if (isRecent && (!targetEmail || !currentEmail || targetEmail === currentEmail)) {
                            showIncomingCallModal(data);
                        }
                    } else if (data.status === "declined" || data.status === "ended" || data.status === "accepted") {
                        if (activeIncomingCallData && activeIncomingCallData.roomId === data.callRoomId) {
                            dismissIncomingCall();
                        }
                    }
                });
            });
        } catch (e) {
            console.warn("Firestore calls listener error:", e);
        }
    }
}

// Close menus when clicking outside or pressing Escape
document.addEventListener("click", (e) => {
    if (wrapper._closeMenu && !wrapper.contains(e.target)) {
        wrapper._closeMenu();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && wrapper._closeMenu) {
        wrapper._closeMenu();
    }
});

// Logout Handler
async function handleLogout() {
    const confirmed = await confirmDialog({
        title: "Logout",
        message: "Are you sure you want to logout of your HealthKart account?",
        confirmText: "Logout",
        danger: true
    });

    if (!confirmed) return;

    try {
        localStorage.removeItem("healthkart_auth_user");
        await signOut(auth);
        toast("You have been logged out successfully.", "success", 2500);

        if (REQUIRES_AUTH) {
            setTimeout(() => { location.href = HOME; }, 700);
        } else {
            renderLoggedOut();
        }
    } catch (error) {
        console.error("Logout error:", error);
        localStorage.removeItem("healthkart_auth_user");
        renderLoggedOut();
        toast("Logged out.", "info");
    }
}

// Cart badge updater
function updateCartBadge() {
    const badge = document.getElementById("cartCount");
    if (!badge) return;

    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem("healthkartCart")) || [];
    } catch (e) {
        cart = [];
    }

    badge.textContent = cart.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
}

window.addEventListener("storage", (e) => {
    if (e.key === "healthkartCart") updateCartBadge();
    if (e.key === "healthkart_auth_user") {
        const u = getCachedUser();
        if (u) renderLoggedIn(u); else renderLoggedOut();
    }
});

function getCachedUser() {
    try {
        const str = localStorage.getItem("healthkart_auth_user");
        return str ? JSON.parse(str) : null;
    } catch (e) {
        return null;
    }
}

// ----------------------------------------
// BOOTSTRAP AUTHENTICATION STATE
// ----------------------------------------
mountWrapper();
updateCartBadge();

// 1. Check cached session immediately (PREVENTS FLASH OF LOGIN ON PAGE REFRESH!)
const cached = getCachedUser();
if (cached) {
    document.body.classList.remove("hk-auth-checking");
    renderLoggedIn(cached);
    initRealtime(cached);
} else {
    renderLoggedOut();
}

// 2. Synchronize with Firebase Auth session
onAuthStateChanged(auth, (user) => {
    document.body.classList.remove("hk-auth-checking");

    if (user) {
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            name: user.displayName || user.email.split('@')[0]
        };
        localStorage.setItem("healthkart_auth_user", JSON.stringify(userData));
        renderLoggedIn(userData);
        initRealtime(userData);
    } else {
        // If Firebase says no user and cached was also not set, render logged out
        if (!localStorage.getItem("healthkart_auth_user")) {
            wrapper._closeMenu = null;
            renderLoggedOut();
            if (REQUIRES_AUTH) {
                const cur = currentPageWithQuery();
                const hasSpecificNext = cur && cur !== "../index.html" && cur !== "index.html" && !cur.includes("login.html") && !cur.includes("signup.html");
                const nextParam = hasSpecificNext ? "?next=" + encodeURIComponent(cur) : "";
                location.replace(P + "login.html" + nextParam);
            }
        }
    }
});

if (REQUIRES_AUTH && !cached) {
    document.body.classList.add("hk-auth-checking");
}
