// ========================================
// HEALTHKART REAL-TIME AI HEALTH AGENT
// - Audio & Voice Medicine & Yoga Reminders
// - Real-time Doctor Prescription Tracking
// - Interactive Conversational Copilot
// ========================================

class HealthKartAIAgent {
    constructor() {
        this.isOpen = false;
        this.activeTab = "chat";
        this.isVoiceEnabled = true;
        this.isSpeechSupported = "speechSynthesis" in window;
        this.reminders = [];
        this.prescriptions = [];
        this.triggeredToday = new Set();
        this.socket = null;
        this.user = this.getLoggedInUser();
        this.recognition = null;
        this.audioCtx = null;

        this.init();
    }

    getLoggedInUser() {
        try {
            const raw = localStorage.getItem("healthkart_auth_user");
            return raw ? JSON.parse(raw) : { email: "priya@healthkart.com", name: "Patient" };
        } catch (e) {
            return { email: "priya@healthkart.com", name: "Patient" };
        }
    }

    async init() {
        this.ensureCSS();
        this.renderWidget();
        this.initAudio();
        this.initSpeechRecognition();
        this.initSocket();
        await this.loadData();
        this.startReminderTicker();
        this.requestNotificationPermission();

        // Listen for storage changes
        window.addEventListener("storage", (e) => {
            if (e.key === "healthkart_auth_user") {
                this.user = this.getLoggedInUser();
                this.loadData();
            }
        });
    }

    ensureCSS() {
        if (!document.querySelector("link[data-hk-ai-agent]")) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = new URL("../css/ai-agent.css", import.meta.url).href;
            link.setAttribute("data-hk-ai-agent", "");
            document.head.appendChild(link);
        }
    }

    initAudio() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        } catch (e) {
            console.warn("Web Audio API not supported", e);
        }
    }

    // Pleasant 3-chord medical reminder chime using Web Audio
    playChime(type = "normal") {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!this.audioCtx) this.audioCtx = new AudioContext();
            if (this.audioCtx.state === "suspended") this.audioCtx.resume();

            const now = this.audioCtx.currentTime;
            const freqs = type === "yoga" ? [440, 554.37, 659.25, 880] : [523.25, 659.25, 783.99, 1046.50];

            freqs.forEach((freq, idx) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, now + idx * 0.12);

                gain.gain.setValueAtTime(0, now + idx * 0.12);
                gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.12 + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.6);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);

                osc.start(now + idx * 0.12);
                osc.stop(now + idx * 0.12 + 0.7);
            });
        } catch (e) {
            console.warn("Chime playback error:", e);
        }
    }

    // Voice text-to-speech alert
    speak(text) {
        if (!this.isVoiceEnabled || !this.isSpeechSupported) return;
        try {
            window.speechSynthesis.cancel(); // stop previous speech
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.05;
            utterance.lang = "en-US";
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn("Speech synthesis error:", e);
        }
    }

    // Speech-to-text input
    initSpeechRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) return;

        this.recognition = new SpeechRec();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = "en-US";

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById("hkAiInput");
            if (input) {
                input.value = transcript;
                this.sendMessage(transcript);
            }
            this.setMicRecording(false);
        };

        this.recognition.onerror = () => {
            this.setMicRecording(false);
        };

        this.recognition.onend = () => {
            this.setMicRecording(false);
        };
    }

    setMicRecording(isRecording) {
        const btn = document.getElementById("hkAiMicBtn");
        if (btn) {
            btn.classList.toggle("recording", isRecording);
        }
    }

    requestNotificationPermission() {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().catch(() => {});
        }
    }

    // Socket.io Real-time connection
    initSocket() {
        const checkIo = () => {
            if (window.io) {
                this.socket = window.io();
                const email = this.user ? this.user.email : "";
                if (email) {
                    this.socket.emit("register_user", { email });
                }

                // Incoming doctor prescription issued in real time!
                this.socket.on("new_prescription", ({ prescription, reminders }) => {
                    this.handleNewPrescription(prescription);
                });

                // In-call prescription issued
                this.socket.on("in_call_prescription", ({ prescription }) => {
                    this.handleNewPrescription(prescription);
                });

                // Reminders list updated
                this.socket.on("reminders_updated", () => {
                    this.loadData();
                });
            } else {
                setTimeout(checkIo, 500);
            }
        };
        checkIo();
    }

    // Handle new prescription alert
    handleNewPrescription(prescription) {
        this.playChime("yoga");
        const msg = `Dr. ${prescription.doctorName} has issued your new prescription (${prescription.id})! Your medicine eating times and yoga routines have been automatically scheduled.`;
        this.speak(msg);

        this.showProactiveBanner({
            type: "prescription",
            title: `New Prescription from ${prescription.doctorName}`,
            description: `${prescription.diagnosis}. Your medicine eating reminders and yoga routines are now active!`,
            prescriptionId: prescription.id
        });

        this.loadData();
    }

    // Fetch live reminders & prescriptions
    async loadData() {
        const email = this.user ? this.user.email : "";
        try {
            const [remRes, rxRes] = await Promise.all([
                fetch(`/api/reminders?email=${encodeURIComponent(email)}`),
                fetch(`/api/prescriptions?email=${encodeURIComponent(email)}`)
            ]);

            const remData = await remRes.json();
            const rxData = await rxRes.json();

            if (remData.success) this.reminders = remData.reminders || [];
            if (rxData.success) this.prescriptions = rxData.prescriptions || [];

            this.updateBadge();
            this.renderRemindersList();
            this.renderPrescriptionsList();
        } catch (e) {
            console.warn("Could not load reminders/prescriptions:", e);
        }
    }

    // Ticker that monitors the clock every 6 seconds
    startReminderTicker() {
        setInterval(() => {
            this.checkDueReminders();
        }, 6000);
    }

    checkDueReminders() {
        if (!this.reminders || !this.reminders.length) return;

        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, "0");
        const currentMins = String(now.getMinutes()).padStart(2, "0");
        const currentTimeStr = `${currentHours}:${currentMins}`;
        const todayDateStr = now.toISOString().split("T")[0];

        this.reminders.forEach((r) => {
            if (r.status === "TAKEN" || r.status === "COMPLETED") return;

            const remTime = (r.reminderTime || "").trim();
            // Check if matches current minute
            if (remTime === currentTimeStr) {
                const triggerKey = `${r.id}_${todayDateStr}_${currentTimeStr}`;
                if (!this.triggeredToday.has(triggerKey)) {
                    this.triggeredToday.add(triggerKey);
                    this.triggerReminderAlert(r);
                }
            }
        });
    }

    // Fire reminder alert: Chime + Speech + Banner + Notification
    triggerReminderAlert(rem) {
        const isYoga = rem.type === "yoga";
        this.playChime(isYoga ? "yoga" : "medicine");

        let voiceText = "";
        if (isYoga) {
            voiceText = `HealthKart Reminder: It is time for your yoga session, ${rem.yogaName}. Focus on steady breathing.`;
        } else {
            const mealInstruction = rem.mealTiming ? `Please make sure to take it ${rem.mealTiming.toLowerCase()}` : "Remember to take your medicine";
            voiceText = `HealthKart Reminder: Time to take ${rem.medicineName}, ${rem.dosage || "prescribed dose"}. ${mealInstruction}.`;
        }

        this.speak(voiceText);

        // Show floating banner
        this.showProactiveBanner(rem);

        // Desktop Notification
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                new Notification(isYoga ? "🧘 Yoga Reminder - HealthKart" : "💊 Medicine Eating Reminder - HealthKart", {
                    body: isYoga ? `Time for ${rem.yogaName} (${rem.duration || "15 mins"}).` : `Take ${rem.medicineName} (${rem.dosage || ""}) - ${rem.mealTiming || "After food"}`,
                    icon: "/favicon.ico"
                });
            } catch (e) {}
        }
    }

    // Proactive interactive banner popup
    showProactiveBanner(item) {
        const existing = document.getElementById("hkAiProactiveBanner");
        if (existing) existing.remove();

        const isYoga = item.type === "yoga";
        const isRx = item.type === "prescription";

        const banner = document.createElement("div");
        banner.id = "hkAiProactiveBanner";
        banner.className = "hk-ai-reminder-banner";

        let iconHtml = '<i class="fa-solid fa-pills"></i>';
        let title = item.medicineName ? `Time to take: ${item.medicineName}` : (item.title || "Medicine Reminder");
        let desc = item.instructions || `Dosage: ${item.dosage || "1 Dose"} • Timing: ${item.mealTiming || "After Lunch"}`;

        if (isYoga) {
            iconHtml = '<i class="fa-solid fa-spa"></i>';
            title = `Time for Yoga: ${item.yogaName}`;
            desc = `Duration: ${item.duration || "15 Mins"} • ${item.instructions || "Focus on deep breathing and steady posture."}`;
        } else if (isRx) {
            iconHtml = '<i class="fa-solid fa-file-prescription"></i>';
            title = item.title;
            desc = item.description;
        }

        banner.innerHTML = `
            <div class="hk-ai-reminder-icon" style="${isYoga ? 'background:#e0f2fe; color:#0284c7;' : ''}">
                ${iconHtml}
            </div>
            <div class="hk-ai-reminder-content">
                <h4>${title}</h4>
                <p>${desc}</p>
                <div class="hk-ai-reminder-btns">
                    ${!isRx ? `
                        <button type="button" class="hk-ai-banner-btn primary" id="hkAiBannerTakeBtn">
                            <i class="fa-solid fa-check"></i> ${isYoga ? 'Completed' : 'Mark Taken'}
                        </button>
                        <button type="button" class="hk-ai-banner-btn secondary" id="hkAiBannerSnoozeBtn">
                            <i class="fa-solid fa-clock"></i> Snooze 10m
                        </button>
                    ` : `
                        <button type="button" class="hk-ai-banner-btn primary" id="hkAiBannerTakeBtn">
                            <i class="fa-solid fa-eye"></i> View Prescription
                        </button>
                    `}
                    <button type="button" class="hk-ai-banner-btn secondary" id="hkAiBannerCloseBtn">
                        Dismiss
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        // Handlers
        const takeBtn = banner.querySelector("#hkAiBannerTakeBtn");
        const snoozeBtn = banner.querySelector("#hkAiBannerSnoozeBtn");
        const closeBtn = banner.querySelector("#hkAiBannerCloseBtn");

        if (takeBtn) {
            takeBtn.onclick = () => {
                if (isRx) {
                    this.open("prescriptions");
                } else {
                    this.markReminderDone(item.id);
                }
                banner.remove();
            };
        }

        if (snoozeBtn) {
            snoozeBtn.onclick = () => {
                this.snoozeReminder(item.id);
                banner.remove();
            };
        }

        if (closeBtn) {
            closeBtn.onclick = () => banner.remove();
        }

        // Auto dismiss after 30 seconds
        setTimeout(() => {
            if (banner.parentElement) banner.remove();
        }, 30000);
    }

    async markReminderDone(id) {
        try {
            await fetch(`/api/reminders/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "TAKEN", takenAt: new Date().toISOString() })
            });
            this.playChime("normal");
            this.speak("Great job! Marked as taken.");
            this.loadData();
        } catch (e) {}
    }

    snoozeReminder(id) {
        this.speak("Snoozed for 10 minutes.");
        // Add 10 mins to reminder time in memory
        const rem = this.reminders.find(r => r.id === id);
        if (rem && rem.reminderTime) {
            const [h, m] = rem.reminderTime.split(":").map(Number);
            const d = new Date();
            d.setHours(h, m + 10);
            rem.reminderTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        }
    }

    updateBadge() {
        const badge = document.getElementById("hkAiFabBadge");
        if (!badge) return;
        const count = this.reminders.filter(r => r.status !== "TAKEN" && r.status !== "COMPLETED").length;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }
    }

    renderWidget() {
        if (document.getElementById("hkAiFab")) return;

        // Floating Action Button
        const fab = document.createElement("button");
        fab.id = "hkAiFab";
        fab.className = "hk-ai-fab";
        fab.setAttribute("aria-label", "Open HealthKart AI Health Copilot");
        fab.innerHTML = `
            <div class="hk-ai-fab-icon">
                <i class="fa-solid fa-sparkles"></i>
                <div class="hk-ai-fab-pulse"></div>
                <span class="hk-ai-fab-badge" id="hkAiFabBadge" style="display:none;">0</span>
            </div>
            <span>HealthKart AI</span>
        `;
        fab.onclick = () => this.toggle();

        // Main Drawer Modal
        const drawer = document.createElement("div");
        drawer.id = "hkAiDrawer";
        drawer.className = "hk-ai-drawer";
        drawer.innerHTML = `
            <div class="hk-ai-header">
                <div class="hk-ai-header-info">
                    <div class="hk-ai-avatar">
                        <i class="fa-solid fa-heart-pulse"></i>
                    </div>
                    <div class="hk-ai-title">
                        <h3>HealthKart AI Copilot</h3>
                        <div class="hk-ai-status">
                            <span class="hk-ai-status-dot"></span>
                            <span>Live Medicine & Yoga Assistant</span>
                        </div>
                    </div>
                </div>
                <div class="hk-ai-header-actions">
                    <button type="button" class="hk-ai-icon-btn" id="hkAiVoiceToggle" title="Toggle AI Voice">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                    <button type="button" class="hk-ai-icon-btn" id="hkAiSoundTest" title="Test Reminder Chime">
                        <i class="fa-solid fa-bell"></i>
                    </button>
                    <button type="button" class="hk-ai-icon-btn" id="hkAiCloseBtn" title="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>

            <div class="hk-ai-tabs">
                <button type="button" class="hk-ai-tab active" data-tab="chat">
                    <i class="fa-solid fa-comments"></i> AI Health Chat
                </button>
                <button type="button" class="hk-ai-tab" data-tab="reminders">
                    <i class="fa-solid fa-clock"></i> Reminders Schedule
                </button>
                <button type="button" class="hk-ai-tab" data-tab="prescriptions">
                    <i class="fa-solid fa-file-prescription"></i> Prescriptions
                </button>
            </div>

            <div class="hk-ai-body">
                <!-- Chat View -->
                <div class="hk-ai-view active" id="hkAiViewChat">
                    <div class="hk-ai-chat-messages" id="hkAiChatMessages">
                        <div class="hk-ai-msg bot">
                            Hello! I am your <strong>HealthKart AI Health Assistant</strong>. 🌿<br><br>
                            I proactively give you <strong>real-time reminders for taking medicines with proper meal timings</strong> (before/after breakfast, lunch, or dinner) and <strong>guided daily yoga routines</strong> prescribed by your doctor.<br><br>
                            How can I help your health today?
                        </div>
                    </div>

                    <div class="hk-ai-chips">
                        <button type="button" class="hk-ai-chip" data-prompt="What medicines and yoga should I do today?">
                            🔔 Today's Schedule
                        </button>
                        <button type="button" class="hk-ai-chip" data-prompt="Remind me to take Paracetamol 500mg after lunch at 1:30 PM">
                            💊 Set Medicine Reminder
                        </button>
                        <button type="button" class="hk-ai-chip" data-prompt="What yoga is best for back pain and posture?">
                            🧘 Yoga for Back Pain
                        </button>
                        <button type="button" class="hk-ai-chip" data-prompt="Schedule morning Surya Namaskar at 7:00 AM">
                            🧘 Set Yoga Reminder
                        </button>
                        <button type="button" class="hk-ai-chip" data-prompt="Why should medicines be taken after food?">
                            🍽️ Medicine Eating Rules
                        </button>
                    </div>

                    <div class="hk-ai-input-bar">
                        <button type="button" class="hk-ai-mic-btn" id="hkAiMicBtn" title="Speak to AI">
                            <i class="fa-solid fa-microphone"></i>
                        </button>
                        <input
                            type="text"
                            class="hk-ai-input"
                            id="hkAiInput"
                            placeholder="Ask health questions or schedule reminders..."
                        />
                        <button type="button" class="hk-ai-send-btn" id="hkAiSendBtn" title="Send">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>

                <!-- Reminders View -->
                <div class="hk-ai-view" id="hkAiViewReminders">
                    <div class="hk-ai-reminders-view" id="hkAiRemindersList">
                        <div style="text-align:center; padding:30px; color:#687b72;">
                            <i class="fa-solid fa-spinner fa-spin" style="font-size:22px; color:#0b9f6e;"></i>
                            <p style="margin-top:8px; font-size:13px;">Loading schedules...</p>
                        </div>
                    </div>
                </div>

                <!-- Prescriptions View -->
                <div class="hk-ai-view" id="hkAiViewPrescriptions">
                    <div class="hk-ai-rx-view" id="hkAiRxList">
                        <div style="text-align:center; padding:30px; color:#687b72;">
                            <i class="fa-solid fa-spinner fa-spin" style="font-size:22px; color:#0b9f6e;"></i>
                            <p style="margin-top:8px; font-size:13px;">Loading prescriptions...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(fab);
        document.body.appendChild(drawer);

        this.bindEvents();
    }

    bindEvents() {
        const closeBtn = document.getElementById("hkAiCloseBtn");
        if (closeBtn) closeBtn.onclick = () => this.close();

        // Voice toggle
        const voiceBtn = document.getElementById("hkAiVoiceToggle");
        if (voiceBtn) {
            voiceBtn.onclick = () => {
                this.isVoiceEnabled = !this.isVoiceEnabled;
                voiceBtn.classList.toggle("active-off", !this.isVoiceEnabled);
                voiceBtn.innerHTML = this.isVoiceEnabled
                    ? '<i class="fa-solid fa-volume-high"></i>'
                    : '<i class="fa-solid fa-volume-xmark"></i>';
                if (this.isVoiceEnabled) this.speak("AI Voice enabled.");
            };
        }

        // Sound test
        const testBtn = document.getElementById("hkAiSoundTest");
        if (testBtn) {
            testBtn.onclick = () => {
                this.playChime("yoga");
                this.speak("This is your HealthKart real-time audio and voice reminder.");
            };
        }

        // Tab Switching
        document.querySelectorAll(".hk-ai-tab").forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll(".hk-ai-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                const target = tab.dataset.tab;
                document.querySelectorAll(".hk-ai-body .hk-ai-view").forEach(v => v.classList.remove("active"));
                if (target === "chat") document.getElementById("hkAiViewChat")?.classList.add("active");
                else if (target === "reminders") {
                    document.getElementById("hkAiViewReminders")?.classList.add("active");
                    this.renderRemindersList();
                } else if (target === "prescriptions") {
                    document.getElementById("hkAiViewPrescriptions")?.classList.add("active");
                    this.renderPrescriptionsList();
                }
            };
        });

        // Prompt Chips
        document.querySelectorAll(".hk-ai-chip").forEach(chip => {
            chip.onclick = () => {
                const prompt = chip.dataset.prompt;
                this.sendMessage(prompt);
            };
        });

        // Input Send
        const input = document.getElementById("hkAiInput");
        const sendBtn = document.getElementById("hkAiSendBtn");
        if (input) {
            input.onkeydown = (e) => {
                if (e.key === "Enter") {
                    this.sendMessage(input.value);
                }
            };
        }
        if (sendBtn && input) {
            sendBtn.onclick = () => this.sendMessage(input.value);
        }

        // Mic Button
        const micBtn = document.getElementById("hkAiMicBtn");
        if (micBtn && this.recognition) {
            micBtn.onclick = () => {
                try {
                    this.setMicRecording(true);
                    this.recognition.start();
                } catch (e) {
                    this.recognition.stop();
                    this.setMicRecording(false);
                }
            };
        }
    }

    async sendMessage(text) {
        if (!text || !text.trim()) return;
        const msg = text.trim();

        const input = document.getElementById("hkAiInput");
        if (input) input.value = "";

        // Add user message to UI
        this.addChatMessage(msg, "user");

        // Typing indicator
        const typingId = "hkAiTyping_" + Date.now();
        const chatContainer = document.getElementById("hkAiChatMessages");
        if (chatContainer) {
            const typingNode = document.createElement("div");
            typingNode.id = typingId;
            typingNode.className = "hk-ai-msg bot";
            typingNode.innerHTML = `<i class="fa-solid fa-sparkles fa-spin" style="color:#0b9f6e; margin-right:6px;"></i> Thinking...`;
            chatContainer.appendChild(typingNode);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: msg,
                    userEmail: this.user ? this.user.email : ""
                })
            });

            const data = await res.json();
            const typingNode = document.getElementById(typingId);
            if (typingNode) typingNode.remove();

            if (data.success && data.reply) {
                this.addChatMessage(data.reply, "bot");
                if (data.actionTaken === "REMINDER_CREATED") {
                    this.playChime("normal");
                    this.loadData();
                }
            } else {
                this.addChatMessage("I'm having trouble connecting right now. Please try again shortly.", "bot");
            }
        } catch (err) {
            const typingNode = document.getElementById(typingId);
            if (typingNode) typingNode.remove();
            this.addChatMessage("Sorry, I could not complete your request. Please ensure you are connected to the network.", "bot");
        }
    }

    addChatMessage(content, sender) {
        const container = document.getElementById("hkAiChatMessages");
        if (!container) return;

        const node = document.createElement("div");
        node.className = `hk-ai-msg ${sender}`;

        // Format basic markdown (bold, lists, newlines)
        let html = content
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/\n\n/g, "<br><br>")
            .replace(/\n/g, "<br>");

        node.innerHTML = html;
        container.appendChild(node);
        container.scrollTop = container.scrollHeight;
    }

    renderRemindersList() {
        const list = document.getElementById("hkAiRemindersList");
        if (!list) return;

        if (!this.reminders || !this.reminders.length) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px 10px; color:#687b72;">
                    <i class="fa-regular fa-bell-slash" style="font-size:32px; color:#95a89f; margin-bottom:10px; display:block;"></i>
                    <h4 style="margin:0 0 6px; font-size:15px; color:#21342a;">No Active Reminders</h4>
                    <p style="margin:0; font-size:12.5px;">Ask me: <em>"Remind me to take Paracetamol after lunch"</em> or <em>"Schedule morning yoga at 7 AM"</em>!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.reminders.map(r => {
            const isYoga = r.type === "yoga";
            const isTaken = r.status === "TAKEN" || r.status === "COMPLETED";

            return `
                <div class="hk-ai-rem-card ${isYoga ? 'yoga' : 'medicine'}">
                    <div class="hk-ai-rem-header">
                        <div>
                            <h4 class="hk-ai-rem-title">
                                <i class="${isYoga ? 'fa-solid fa-spa' : 'fa-solid fa-capsules'}" style="color:${isYoga ? '#0284c7' : '#0b9f6e'}; margin-right:4px;"></i>
                                ${isYoga ? (r.yogaName || 'Yoga Routine') : (r.medicineName || 'Medicine')}
                            </h4>
                            <div class="hk-ai-rem-meta">
                                <span><i class="fa-regular fa-clock"></i> ${r.reminderTime || 'Daily'}</span>
                                ${!isYoga && r.mealTiming ? `<span class="hk-ai-meal-tag"><i class="fa-solid fa-utensils"></i> ${r.mealTiming}</span>` : ''}
                                ${isYoga && r.duration ? `<span><i class="fa-solid fa-stopwatch"></i> ${r.duration}</span>` : ''}
                            </div>
                        </div>
                        <span class="hk-ai-rem-badge ${isYoga ? 'yoga' : 'medicine'}">
                            ${isYoga ? 'Yoga' : 'Medicine'}
                        </span>
                    </div>

                    ${r.instructions ? `<p style="margin:0; font-size:12px; color:#576b61; line-height:1.4;">${r.instructions}</p>` : ''}

                    <div class="hk-ai-rem-actions">
                        <button
                            type="button"
                            class="hk-ai-take-btn ${isTaken ? 'taken' : ''}"
                            onclick="window.HK_AI.markReminderDone('${r.id}')"
                            ${isTaken ? 'disabled' : ''}
                        >
                            <i class="fa-solid ${isTaken ? 'fa-check-double' : 'fa-check'}"></i>
                            ${isTaken ? (isYoga ? 'Yoga Completed' : 'Medicine Taken') : (isYoga ? 'Mark Completed' : 'Mark Taken')}
                        </button>
                        ${!isTaken ? `
                            <button
                                type="button"
                                class="hk-ai-snooze-btn"
                                onclick="window.HK_AI.snoozeReminder('${r.id}')"
                            >
                                Snooze
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join("");
    }

    renderPrescriptionsList() {
        const list = document.getElementById("hkAiRxList");
        if (!list) return;

        if (!this.prescriptions || !this.prescriptions.length) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px 10px; color:#687b72;">
                    <i class="fa-regular fa-file-prescription" style="font-size:32px; color:#95a89f; margin-bottom:10px; display:block;"></i>
                    <h4 style="margin:0 0 6px; font-size:15px; color:#21342a;">No Prescriptions Yet</h4>
                    <p style="margin:0; font-size:12.5px;">When your doctor issues a digital prescription during video consultation, it will appear here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.prescriptions.map(rx => `
            <div class="hk-ai-rx-card">
                <div class="hk-ai-rx-head">
                    <span class="hk-ai-rx-id">${rx.id}</span>
                    <span class="hk-ai-rx-doc">${rx.doctorName || 'Doctor'}</span>
                </div>
                <div style="font-size:12.5px; color:#35493f; margin-bottom:8px;">
                    <strong>Diagnosis:</strong> ${rx.diagnosis || 'General Checkup'}
                </div>
                ${rx.medicines && rx.medicines.length ? `
                    <div style="margin-bottom:8px;">
                        <span style="font-size:11px; font-weight:800; color:#0b9f6e; text-transform:uppercase;">Prescribed Medicines:</span>
                        ${rx.medicines.map(m => `
                            <div class="hk-ai-rx-item">
                                <i class="fa-solid fa-circle-dot" style="font-size:6px; color:#0b9f6e;"></i>
                                <span><strong>${m.name}</strong> (${m.dosage || ''}) — <em>${m.mealTiming || 'After meal'}</em></span>
                            </div>
                        `).join("")}
                    </div>
                ` : ''}
                ${rx.yogaRoutines && rx.yogaRoutines.length ? `
                    <div>
                        <span style="font-size:11px; font-weight:800; color:#0284c7; text-transform:uppercase;">Recommended Yoga:</span>
                        ${rx.yogaRoutines.map(y => `
                            <div class="hk-ai-rx-item">
                                <i class="fa-solid fa-spa" style="font-size:10px; color:#0284c7;"></i>
                                <span><strong>${y.poseName}</strong> (${y.duration || '15 mins'}) at ${y.timing || 'Morning'}</span>
                            </div>
                        `).join("")}
                    </div>
                ` : ''}
                ${rx.advice ? `
                    <div style="margin-top:10px; font-size:11.5px; color:#5c7066; background:#f5faf7; padding:8px; border-radius:8px;">
                        <i class="fa-solid fa-lightbulb" style="color:#d97706; margin-right:4px;"></i>
                        <strong>Doctor's Advice:</strong> ${rx.advice}
                    </div>
                ` : ''}
            </div>
        `).join("");
    }

    open(tab = "chat") {
        const drawer = document.getElementById("hkAiDrawer");
        if (drawer) {
            drawer.classList.add("open");
            this.isOpen = true;
            if (tab) {
                const tabBtn = document.querySelector(`.hk-ai-tab[data-tab="${tab}"]`);
                if (tabBtn) tabBtn.click();
            }
        }
    }

    close() {
        const drawer = document.getElementById("hkAiDrawer");
        if (drawer) {
            drawer.classList.remove("open");
            this.isOpen = false;
        }
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }
}

// Auto bootstrap AI Agent across entire site
if (!window.HK_AI) {
    document.addEventListener("DOMContentLoaded", () => {
        window.HK_AI = new HealthKartAIAgent();
    });
}
