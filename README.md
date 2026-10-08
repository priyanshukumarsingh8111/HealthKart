# HealthKart
#Preview Link
https://relaxed-patient-9c2818.netlify.app/


<div align="center">
💚 HealthKart
A smart healthcare platform for medicines, price comparison, doctor consultations, appointments, prescriptions, health records, reminders and orders — all in one place.
![Live Demo](https://img.shields.io/badge/Live%20Demo-Netlify-0b9f6e?style=for-the-badge&logo=netlify&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
Built by Team PharmaCoders
Live Demo · Features · Getting Started · API Reference · Roadmap
</div>
---
📖 Overview
Healthcare tasks are usually scattered across different apps: one to find medicines, another to book a doctor, another to store prescriptions. HealthKart brings these into a single, connected journey:
> **Search → Compare → Consult → Connect → Manage**
Patients can discover medicines and compare prices, book doctors, join real-time video consultations, receive digital prescriptions, and get medicine and wellness reminders. Doctors get their own dashboard to manage appointments and issue prescriptions during a call.
✨ Features
Area	What you get
🔍 Medicine search	Browse and search medicines and health devices, with detail pages
⚖️ Price comparison	Compare products side by side before choosing
🛒 Cart, wishlist & checkout	Add to cart, save to wishlist, place orders, view order history
🩺 Doctor directory	Doctor listing with individual profile pages
📅 Appointment booking	Slot-based booking, cancellation, and "my appointments" view (Sundays are blocked)
📹 Video consultation	WebRTC peer-to-peer video calls with in-call chat, screen sharing and in-call prescriptions
💊 Prescriptions	Doctors issue prescriptions; patients view them in their account
⏰ Reminders	Medicine and yoga reminders; prescriptions can generate reminders automatically
🔔 Notifications	Appointment and prescription notifications with mark-as-read
🗂️ Health records	Personal health records page ("My Health")
🤖 AI health agent	Chat assistant that answers questions, explains medicines and schedules reminders from natural language (e.g. "remind me to take my medicine at 8 pm")
🧭 Symptom triage	Describe symptoms and get a suggested specialty, urgency level and recommended doctor
🔐 Authentication	Sign up / log in with Firebase Auth, with separate patient and doctor flows
> **Note:** The AI agent and triage endpoints are rule-based (keyword and intent matching) and run on your own server. They are not connected to an external LLM, and they do not replace professional medical advice.
🧰 Tech Stack
Layer	Technology
Frontend	HTML5, CSS3, vanilla JavaScript (ES modules), Font Awesome 6
Backend	Node.js, Express 5, CORS
Real-time	Socket.IO 4 (signalling, chat, call events) and WebRTC (media)
Auth & cloud	Firebase Authentication, Cloud Firestore
Data store	JSON file (`data/db.json`) read and written by the server
Client storage	`localStorage` for cart, wishlist, orders and health records
Hosting	Netlify (static preview), any Node host for the full backend
🏗️ Architecture
```
┌──────────────────────────── Browser ────────────────────────────┐
│  HTML pages + CSS + vanilla JS                                  │
│  ├─ Firebase Auth / Firestore  (login, user profiles)           │
│  ├─ localStorage               (cart, wishlist, orders, records)│
│  ├─ fetch  → REST API          (doctors, medicines, bookings…)  │
│  └─ Socket.IO + WebRTC         (video calls, chat, notifications)│
└───────────────┬──────────────────────────────┬──────────────────┘
                │ HTTP                         │ WebSocket
┌───────────────▼──────────────────────────────▼──────────────────┐
│                 Node.js + Express + Socket.IO (server.js)       │
│  Static file server · REST API · Signalling · Rule-based AI     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ read / write
                        data/db.json (JSON store)
```
📁 Project Structure
```
HealthKart/
├── index.html              # Landing page
├── style.css               # Global styles
├── server.js               # Express + Socket.IO server and REST API
├── package.json
├── firestore.rules         # Firestore security rules
├── firestore-test.html     # Firestore connectivity test page
├── pages/                  # App pages (search, compare, doctors, cart, login, ...)
├── css/                    # Per-page stylesheets
├── js/                     # Per-page scripts (auth, cart, appointment, ai-agent, ...)
├── images/
│   ├── doctors/            # Doctor photos
│   └── medicines/          # Product images
├── scripts/                # Helper and test scripts
│   ├── download-images.js
│   ├── test-all-features.js
│   └── test-video-calling-flow.js
└── scratch/                # Ad-hoc test scripts used during development
```
🚀 Getting Started
Prerequisites
Node.js 18 or later
npm
A modern browser (Chrome, Edge or Firefox) with camera/microphone access for video calls
1. Clone and install
```bash
git clone https://github.com/priyanshukumarsingh8111/HealthKart.git
cd HealthKart
npm install
```
2. Create the data store
The server reads and writes `data/db.json`. This file is not included in the repository, so create it before starting the server:
```bash
mkdir data
```
Then create `data/db.json` with this structure:
```json
{
  "doctors": [],
  "medicines": [],
  "appointments": [],
  "bookedSlots": {},
  "prescriptions": [],
  "reminders": [],
  "notifications": []
}
```
Add your own `doctors` and `medicines` records to see them in the app. The `/api/doctors` and `/api/medicines` endpoints return whatever is stored here, and the Doctors and Medicines pages are built from them.
3. Run the app
```bash
npm start
```
Open http://localhost:3000 in your browser. To use a different port:
```bash
PORT=5000 npm start        # macOS / Linux
set PORT=5000 && npm start # Windows (cmd)
```
4. (Optional) Use your own Firebase project
The app ships with a Firebase web config in `js/firebase-config.js`. To use your own project:
Create a project in the Firebase Console.
Enable Authentication (Email/Password) and Cloud Firestore.
Replace the values in `js/firebase-config.js` with your project's web app config.
Deploy `firestore.rules` to your project (`firebase deploy --only firestore:rules`), after reviewing and tightening them for your use case.
5. Run the test scripts
With the server running in one terminal, run in another:
```bash
node scripts/test-all-features.js
node scripts/test-video-calling-flow.js
```
🔌 API Reference
Base URL: `http://localhost:3000`
Doctors & medicines
Method	Endpoint	Description
`GET`	`/api/doctors`	List all doctors
`GET`	`/api/doctors/:id`	Get one doctor
`GET`	`/api/medicines`	List medicines (supports filtering)
`GET`	`/api/medicines/:id`	Get one medicine
Appointments
Method	Endpoint	Description
`GET`	`/api/appointments/slots`	Available slots for a doctor on a date (`doctorId`, `date`)
`POST`	`/api/appointments/book`	Book an appointment
`GET`	`/api/appointments/my`	Appointments for the current patient
`GET`	`/api/appointments/doctor/:doctorId`	Appointments for a doctor
`POST`	`/api/appointments/:id/cancel`	Cancel an appointment
`POST`	`/api/appointments/:id/complete`	Mark an appointment as completed
`POST`	`/api/webrtc/verify-access`	Verify a user may join a call room
Prescriptions, reminders & notifications
Method	Endpoint	Description
`GET`	`/api/prescriptions`	List prescriptions (filter by `email`)
`GET`	`/api/prescriptions/:id`	Get one prescription
`POST`	`/api/prescriptions`	Issue a prescription (can generate reminders)
`GET`	`/api/reminders`	List reminders (filter by `email`)
`POST`	`/api/reminders`	Create a reminder
`PUT`	`/api/reminders/:id`	Update a reminder
`DELETE`	`/api/reminders/:id`	Delete a reminder
`GET`	`/api/notifications`	List notifications
`POST`	`/api/notifications/mark-read`	Mark notifications as read
AI
Method	Endpoint	Description
`POST`	`/api/ai/chat`	Health assistant chat — body: `{ message, userEmail }`
`POST`	`/api/ai/triage`	Symptom triage — body: `{ symptoms }`
Socket.IO events
Event	Purpose
`register_user`	Register a connected user
`start_doctor_call` · `accept_doctor_call` · `decline_doctor_call`	Call lifecycle
`join_room` · `end_call`	Join and leave a consultation room
`webrtc_offer` · `webrtc_answer` · `ice_candidate`	WebRTC signalling
`in_call_chat`	Chat messages during a call
`in_call_prescription`	Send a prescription during a call
`screen_share_status`	Screen-share state updates
🌐 Deployment
Static preview (Netlify): The live demo serves the frontend. Features that need the Node server (REST API, video calls, AI agent) require the backend to be running.
Full app: Deploy `server.js` to any Node.js host (Render, Railway, a VPS, etc.). The server serves the frontend and the API from the same origin. Set the `PORT` environment variable if your host requires it.
⚠️ Known Limitations
This is a project prototype. Before using it in production, be aware that:
JSON file storage is not suitable for concurrent users or large data. Use a real database (PostgreSQL, MongoDB or Firestore) for production.
`data/db.json` is not committed, so a fresh clone starts with empty doctor and medicine lists until you add data.
Roles are inferred on the client from the login email in the current auth flow. Production needs server-verified roles (for example Firebase custom claims).
Firestore rules are permissive for some collections (for example appointments and calls are open to read and write). Tighten them before going live.
Payments are not integrated. Checkout stores orders locally in the browser.
The AI agent is rule-based and gives general information only, not medical advice.
🗺️ Roadmap
[ ] Production database (replace the JSON store)
[ ] Secure, server-verified authentication and role-based access
[ ] Payment gateway integration
[ ] Live pharmacy and inventory integrations
[ ] TURN server for more reliable video calls across networks
[ ] LLM-powered health assistant with safety guardrails
[ ] Automated test suite and CI
🤝 Contributing
Contributions are welcome.
Fork the repository
Create a feature branch: `git checkout -b feature/your-feature`
Commit your changes: `git commit -m "Add your feature"`
Push the branch: `git push origin feature/your-feature`
Open a Pull Request
📄 License
Distributed under the MIT License. See `LICENSE` for details.
👥 Team
Team PharmaCoders
Repository maintained by @priyanshukumarsingh8111.
---
<div align="center">
If you find this project useful, please consider giving it a ⭐
</div>
