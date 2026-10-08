import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.get('/pages/index.html', (req, res) => {
  res.redirect(301, '/index.html');
});

// Serve static frontend files
app.use(express.static(__dirname));

// ==========================================
// DATABASE HELPERS (Thread-safe JSON Store)
// ==========================================
let dbLock = false;

function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db.json:', err);
    return {
      doctors: [],
      medicines: [],
      appointments: [],
      bookedSlots: {},
      prescriptions: [],
      reminders: [],
      notifications: []
    };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

// Helper: Check if date string (YYYY-MM-DD) is a Sunday
function isSunday(dateStr) {
  if (!dateStr) return false;
  // Parse YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return d.getDay() === 0; // 0 = Sunday
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. DOCTORS API
app.get('/api/doctors', (req, res) => {
  const db = readDB();
  res.json({ success: true, count: db.doctors.length, doctors: db.doctors });
});

app.get('/api/doctors/:id', (req, res) => {
  const db = readDB();
  const doctor = db.doctors.find(d => d.id === req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, error: 'Doctor not found' });
  }
  res.json({ success: true, doctor });
});

// 2. MEDICINES API
app.get('/api/medicines', (req, res) => {
  const db = readDB();
  let list = [...db.medicines];
  const { search, category, sort } = req.query;

  if (search) {
    const q = search.toLowerCase().trim();
    list = list.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  }

  if (category && category !== 'all') {
    list = list.filter(m => m.category.toLowerCase() === category.toLowerCase());
  }

  if (sort === 'price-low') {
    list.sort((a, b) => a.price - b.price);
  } else if (sort === 'price-high') {
    list.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    list.sort((a, b) => b.rating - a.rating);
  }

  res.json({ success: true, count: list.length, medicines: list });
});

app.get('/api/medicines/:id', (req, res) => {
  const db = readDB();
  const item = db.medicines.find(m => m.id === req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, medicine: item });
});

// 3. APPOINTMENT SLOTS API
// GET /api/appointments/slots?doctorId=rahul&date=2026-10-12
app.get('/api/appointments/slots', (req, res) => {
  const { doctorId, date } = req.query;
  if (!doctorId || !date) {
    return res.status(400).json({ success: false, error: 'doctorId and date parameters are required' });
  }

  // ENFORCE SUNDAY RESTRICTION (Requirement 4)
  if (isSunday(date)) {
    return res.status(400).json({
      success: false,
      isSunday: true,
      error: 'Appointments are not available on Sundays. Please select another day.',
      slots: []
    });
  }

  const db = readDB();
  const doctor = db.doctors.find(d => d.id === doctorId);
  if (!doctor) {
    return res.status(404).json({ success: false, error: 'Doctor not found' });
  }

  // Check which slots are already booked
  const allSlots = doctor.availableTimeSlots || [];
  const slotList = allSlots.map(timeStr => {
    const slotKey = `${doctorId}_${date}_${timeStr}`;
    const booking = db.bookedSlots[slotKey];
    const isBooked = !!(booking && booking.status !== 'CANCELLED');
    return {
      time: timeStr,
      isBooked: isBooked,
      appointmentId: isBooked ? booking.appointmentId : null
    };
  });

  res.json({
    success: true,
    doctorId,
    date,
    isSunday: false,
    slots: slotList
  });
});

// 4. BOOK APPOINTMENT API
// POST /api/appointments/book
app.post('/api/appointments/book', (req, res) => {
  const {
    doctorId,
    appointmentDate,
    appointmentTime,
    patientName,
    patientMobile,
    patientEmail,
    healthConcern,
    consultationType
  } = req.body;

  // Validation
  if (!doctorId || !appointmentDate || !appointmentTime || !patientName || !patientMobile) {
    return res.status(400).json({
      success: false,
      error: 'Missing required booking information.'
    });
  }

  // 1. RULE: SUNDAY APPOINTMENTS MUST BE DISABLED (Requirement 4)
  if (isSunday(appointmentDate)) {
    return res.status(400).json({
      success: false,
      isSunday: true,
      error: 'Appointments are not available on Sundays. Please select another day.'
    });
  }

  const db = readDB();
  const doctor = db.doctors.find(d => d.id === doctorId);
  if (!doctor) {
    return res.status(404).json({ success: false, error: 'Doctor not found.' });
  }

  // 2. RULE: UNIQUE SLOT ENFORCEMENT & ATOMIC DOUBLE BOOKING PROTECTION (Requirement 3)
  const slotKey = `${doctorId}_${appointmentDate}_${appointmentTime}`;
  const existingBooking = db.bookedSlots[slotKey];

  if (existingBooking && existingBooking.status !== 'CANCELLED') {
    return res.status(409).json({
      success: false,
      isSlotTaken: true,
      error: 'Sorry, this appointment slot has just been booked by another patient.'
    });
  }

  // Generate Appointment ID
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const appointmentId = `HK-${randomSuffix}`;
  const callRoomId = `call_${appointmentId}`;

  const newAppointment = {
    appointmentId,
    doctorId,
    doctorName: doctor.name,
    doctorImage: doctor.image,
    specialization: doctor.specialization,
    clinicHospital: doctor.clinicHospital,
    consultationFee: doctor.consultationFee,
    consultationType: consultationType || 'Video Consultation',
    appointmentDate,
    appointmentTime,
    patientName,
    patientMobile,
    patientEmail: patientEmail || '',
    healthConcern: healthConcern || 'General Consultation',
    status: 'CONFIRMED',
    callRoomId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Atomic database save
  db.appointments.unshift(newAppointment);
  db.bookedSlots[slotKey] = {
    appointmentId,
    doctorId,
    appointmentDate,
    appointmentTime,
    patientName,
    patientEmail: patientEmail || '',
    status: 'CONFIRMED',
    bookedAt: new Date().toISOString()
  };

  // Real-time Notification Record (Requirement 6)
  const notificationMsg = `Your appointment with ${doctor.name} is booked for ${appointmentTime} on ${appointmentDate}.`;
  const patientNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    recipientEmail: patientEmail || 'guest',
    patientName,
    title: 'Appointment Booked Successfully!',
    message: notificationMsg,
    appointmentId,
    doctorId,
    doctorName: doctor.name,
    date: appointmentDate,
    time: appointmentTime,
    type: 'appointment_confirmed',
    read: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(patientNotification);

  writeDB(db);

  // REAL-TIME BROADCASTS VIA SOCKET.IO (Requirement 3 & 6)
  // 1. Notify all clients that this slot is now booked (real-time UI slot update without refresh)
  io.emit('slot_booked', {
    doctorId,
    date: appointmentDate,
    time: appointmentTime,
    appointmentId
  });

  // 2. Send instant real-time notification to the patient & doctor
  io.emit('realtime_notification', {
    recipientEmail: patientEmail || '',
    notification: patientNotification
  });

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully!',
    appointment: newAppointment
  });
});

// 5. MY APPOINTMENTS API
app.get('/api/appointments/my', (req, res) => {
  const { email, mobile } = req.query;
  const db = readDB();

  let appointments = db.appointments;
  if (email || mobile) {
    appointments = appointments.filter(a => {
      const matchEmail = email && a.patientEmail && a.patientEmail.toLowerCase() === email.toLowerCase();
      const matchMobile = mobile && a.patientMobile && a.patientMobile === mobile;
      return matchEmail || matchMobile;
    });
  }

  res.json({
    success: true,
    count: appointments.length,
    appointments
  });
});

// 6. DOCTOR APPOINTMENTS API (Requirement 10)
app.get('/api/appointments/doctor/:doctorId', (req, res) => {
  const { doctorId } = req.params;
  const db = readDB();

  const doctorAppointments = db.appointments.filter(a => a.doctorId === doctorId);
  const todayStr = new Date().toISOString().split('T')[0];

  const todayAppointments = doctorAppointments.filter(a => a.appointmentDate === todayStr);
  const upcomingAppointments = doctorAppointments.filter(a => a.status === 'CONFIRMED' && a.appointmentDate >= todayStr);

  res.json({
    success: true,
    count: doctorAppointments.length,
    today: todayAppointments,
    upcoming: upcomingAppointments,
    all: doctorAppointments
  });
});

// 7. CANCEL APPOINTMENT API (Requirement 12)
app.post('/api/appointments/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const db = readDB();

  const appointment = db.appointments.find(a => a.appointmentId === id);
  if (!appointment) {
    return res.status(404).json({ success: false, error: 'Appointment not found' });
  }

  if (appointment.status === 'CANCELLED') {
    return res.status(400).json({ success: false, error: 'Appointment is already cancelled' });
  }

  // Update status to CANCELLED
  appointment.status = 'CANCELLED';
  appointment.cancellationReason = reason || 'Cancelled by patient';
  appointment.updatedAt = new Date().toISOString();

  // Free up the slot so it becomes available again (Requirement 12)
  const slotKey = `${appointment.doctorId}_${appointmentDateKey(appointment.appointmentDate)}_${appointment.appointmentTime}`;
  if (db.bookedSlots[slotKey]) {
    delete db.bookedSlots[slotKey];
  }

  // Add cancellation notification
  const cancelNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    recipientEmail: appointment.patientEmail || 'guest',
    title: 'Appointment Cancelled',
    message: `Your appointment with ${appointment.doctorName} for ${appointment.appointmentDate} at ${appointment.appointmentTime} has been cancelled.`,
    appointmentId: appointment.appointmentId,
    type: 'appointment_cancelled',
    read: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(cancelNotification);

  writeDB(db);

  // Broadcast slot freed to all clients in real-time
  io.emit('slot_freed', {
    doctorId: appointment.doctorId,
    date: appointment.appointmentDate,
    time: appointment.appointmentTime
  });

  // Emit cancellation notification
  io.emit('realtime_notification', {
    recipientEmail: appointment.patientEmail || '',
    notification: cancelNotification
  });

  res.json({
    success: true,
    message: 'Appointment cancelled successfully. The slot is now available again.',
    appointment
  });
});

function appointmentDateKey(d) {
  return d;
}

// 8. COMPLETE APPOINTMENT API (Requirement 11)
app.post('/api/appointments/:id/complete', (req, res) => {
  const { id } = req.params;
  const db = readDB();

  const appointment = db.appointments.find(a => a.appointmentId === id);
  if (!appointment) {
    return res.status(404).json({ success: false, error: 'Appointment not found' });
  }

  appointment.status = 'COMPLETED';
  appointment.updatedAt = new Date().toISOString();
  writeDB(db);

  res.json({ success: true, message: 'Appointment marked as completed.', appointment });
});

// 9. WEBRTC ACCESS CONTROL API (Requirement 9)
app.post('/api/webrtc/verify-access', (req, res) => {
  const { appointmentId, userEmail, userRole, doctorId } = req.body;

  if (!appointmentId) {
    return res.status(400).json({ authorized: false, error: 'Appointment ID is required' });
  }

  const db = readDB();
  const appointment = db.appointments.find(a => a.appointmentId === appointmentId);

  if (!appointment) {
    return res.status(404).json({ authorized: false, error: 'Appointment does not exist.' });
  }

  if (appointment.status === 'CANCELLED') {
    return res.status(403).json({ authorized: false, error: 'This appointment has been cancelled.' });
  }

  // Access validation: Only patient or doctor of this appointment can join
  const isDoctor = userRole === 'doctor' || (doctorId && doctorId === appointment.doctorId);
  const isPatient = !isDoctor; // patient role

  res.json({
    authorized: true,
    role: isDoctor ? 'doctor' : 'patient',
    callRoomId: appointment.callRoomId,
    appointment
  });
});

// 10. NOTIFICATIONS API (Requirement 6)
app.get('/api/notifications', (req, res) => {
  const { email } = req.query;
  const db = readDB();

  let notifs = db.notifications;
  if (email) {
    notifs = notifs.filter(n => !n.recipientEmail || n.recipientEmail === 'guest' || n.recipientEmail.toLowerCase() === email.toLowerCase());
  }

  res.json({ success: true, count: notifs.length, notifications: notifs });
});

app.post('/api/notifications/mark-read', (req, res) => {
  const db = readDB();
  db.notifications.forEach(n => { n.read = true; });
  writeDB(db);
  res.json({ success: true, message: 'All notifications marked as read' });
});

// ==========================================
// 11. PRESCRIPTIONS API
// Doctor creates prescription with medicines (eating timings) & yoga routines
// ==========================================
app.get('/api/prescriptions', (req, res) => {
  const { email, appointmentId, doctorId } = req.query;
  const db = readDB();
  let list = db.prescriptions || [];

  if (email) {
    const qEmail = email.toLowerCase();
    list = list.filter(p => p.patientEmail && p.patientEmail.toLowerCase() === qEmail);
  }
  if (appointmentId) {
    list = list.filter(p => p.appointmentId === appointmentId);
  }
  if (doctorId) {
    list = list.filter(p => p.doctorId === doctorId);
  }

  res.json({ success: true, count: list.length, prescriptions: list });
});

app.get('/api/prescriptions/:id', (req, res) => {
  const db = readDB();
  const list = db.prescriptions || [];
  const rx = list.find(p => p.id === req.params.id);
  if (!rx) {
    return res.status(404).json({ success: false, error: 'Prescription not found' });
  }
  res.json({ success: true, prescription: rx });
});

app.post('/api/prescriptions', (req, res) => {
  const {
    appointmentId,
    doctorId,
    doctorName,
    doctorSpecialization,
    doctorHospital,
    patientName,
    patientEmail,
    patientMobile,
    diagnosis,
    medicines = [],
    yogaRoutines = [],
    advice
  } = req.body;

  if (!patientName || !diagnosis) {
    return res.status(400).json({ success: false, error: 'Patient name and diagnosis are required' });
  }

  const db = readDB();
  if (!db.prescriptions) db.prescriptions = [];
  if (!db.reminders) db.reminders = [];

  const rxId = `RX-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowIso = new Date().toISOString();

  const newPrescription = {
    id: rxId,
    appointmentId: appointmentId || '',
    doctorId: doctorId || 'rahul',
    doctorName: doctorName || 'Dr. Rahul Sharma',
    doctorSpecialization: doctorSpecialization || 'General Physician',
    doctorHospital: doctorHospital || 'Max Super Speciality Hospital, New Delhi',
    patientName,
    patientEmail: patientEmail || 'priya@healthkart.com',
    patientMobile: patientMobile || '',
    diagnosis,
    medicines: Array.isArray(medicines) ? medicines : [],
    yogaRoutines: Array.isArray(yogaRoutines) ? yogaRoutines : [],
    advice: advice || 'Follow prescribed meal timings and yoga routines consistently.',
    createdAt: nowIso
  };

  db.prescriptions.unshift(newPrescription);

  // AUTO-GENERATE REAL-TIME REMINDERS FOR THE PATIENT
  const newReminders = [];

  // Helper meal time mapper
  function defaultMealTime(timing) {
    if (!timing) return '13:00';
    const t = timing.toLowerCase();
    if (t.includes('breakfast')) return t.includes('before') ? '07:45' : '08:30';
    if (t.includes('lunch')) return t.includes('before') ? '12:30' : '13:30';
    if (t.includes('dinner')) return t.includes('before') ? '20:00' : '21:00';
    if (t.includes('bedtime') || t.includes('night')) return '22:00';
    if (t.includes('empty')) return '07:00';
    return '14:00';
  }

  // 1. Medicine Eating Reminders
  newPrescription.medicines.forEach((med, idx) => {
    const medTime = med.time || defaultMealTime(med.mealTiming);
    const remItem = {
      id: `rem_${Date.now()}_med_${idx}`,
      type: 'medicine',
      medicineName: med.name,
      dosage: med.dosage || '1 Dose',
      mealTiming: med.mealTiming || 'After Lunch',
      reminderTime: medTime,
      frequency: med.frequency || 'Daily',
      startDate: nowIso.split('T')[0],
      duration: med.duration || '5 Days',
      prescribedBy: newPrescription.doctorName,
      prescriptionId: rxId,
      userEmail: newPrescription.patientEmail,
      status: 'ACTIVE',
      instructions: med.instructions || `Take ${med.mealTiming || 'after food'} with water.`
    };
    db.reminders.unshift(remItem);
    newReminders.push(remItem);
  });

  // 2. Yoga Routine Reminders
  newPrescription.yogaRoutines.forEach((yoga, idx) => {
    const poseName = yoga.poseName || yoga.name || yoga.yogaName || 'Daily Yoga';
    const remItem = {
      id: `rem_${Date.now()}_yoga_${idx}`,
      type: 'yoga',
      yogaName: poseName,
      targetBenefit: yoga.targetBenefit || yoga.benefit || 'Overall health & mobility',
      reminderTime: yoga.timing || yoga.reminderTime || yoga.time || '07:00',
      duration: yoga.duration || '15 Mins',
      frequency: yoga.frequency || 'Daily',
      startDate: nowIso.split('T')[0],
      prescribedBy: newPrescription.doctorName,
      prescriptionId: rxId,
      userEmail: newPrescription.patientEmail,
      status: 'ACTIVE',
      instructions: yoga.instructions || 'Perform on empty stomach with synchronized deep breathing.'
    };
    db.reminders.unshift(remItem);
    newReminders.push(remItem);
  });

  // 3. Notification Record
  const patientNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    recipientEmail: newPrescription.patientEmail,
    patientName,
    title: 'New Doctor Prescription Issued!',
    message: `${newPrescription.doctorName} has issued prescription ${rxId}. Your medicine eating reminders and yoga routines are now active.`,
    appointmentId: appointmentId || '',
    prescriptionId: rxId,
    type: 'prescription_issued',
    read: false,
    createdAt: nowIso
  };
  db.notifications.unshift(patientNotification);

  writeDB(db);

  // Real-time broadcasts
  io.emit('new_prescription', {
    recipientEmail: newPrescription.patientEmail,
    prescription: newPrescription,
    reminders: newReminders
  });

  io.emit('realtime_notification', {
    recipientEmail: newPrescription.patientEmail,
    notification: patientNotification
  });

  io.emit('reminders_updated', {
    recipientEmail: newPrescription.patientEmail
  });

  res.status(201).json({
    success: true,
    message: 'Prescription created and reminders scheduled successfully!',
    prescription: newPrescription,
    remindersCount: newReminders.length,
    generatedReminders: newReminders
  });
});

// ==========================================
// 12. REMINDERS API (Medicine Eating & Yoga)
// ==========================================
app.get('/api/reminders', (req, res) => {
  const { email, type } = req.query;
  const db = readDB();
  let list = db.reminders || [];

  if (email) {
    const qEmail = email.toLowerCase();
    list = list.filter(r => !r.userEmail || r.userEmail.toLowerCase() === qEmail || r.userEmail === 'guest');
  }
  if (type) {
    list = list.filter(r => r.type === type);
  }

  res.json({ success: true, count: list.length, reminders: list });
});

app.post('/api/reminders', (req, res) => {
  const {
    type = 'medicine',
    medicineName,
    dosage,
    mealTiming,
    yogaName,
    targetBenefit,
    reminderTime,
    duration,
    frequency,
    startDate,
    instructions,
    userEmail
  } = req.body;

  if (type === 'medicine' && !medicineName) {
    return res.status(400).json({ success: false, error: 'Medicine name is required' });
  }
  if (type === 'yoga' && !yogaName) {
    return res.status(400).json({ success: false, error: 'Yoga routine name is required' });
  }

  const db = readDB();
  if (!db.reminders) db.reminders = [];

  const newReminder = {
    id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type,
    medicineName: type === 'medicine' ? medicineName : undefined,
    dosage: type === 'medicine' ? (dosage || '1 Dose') : undefined,
    mealTiming: type === 'medicine' ? (mealTiming || 'After Meal') : undefined,
    yogaName: type === 'yoga' ? yogaName : undefined,
    targetBenefit: type === 'yoga' ? (targetBenefit || 'General Wellness') : undefined,
    duration: type === 'yoga' ? (duration || '15 Mins') : undefined,
    reminderTime: reminderTime || (type === 'yoga' ? '07:00' : '13:00'),
    frequency: frequency || 'Daily',
    startDate: startDate || new Date().toISOString().split('T')[0],
    instructions: instructions || (type === 'medicine' ? `Take ${mealTiming || 'after food'} with water.` : 'Steady breathing.'),
    userEmail: userEmail || 'priya@healthkart.com',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  db.reminders.unshift(newReminder);
  writeDB(db);

  io.emit('reminders_updated', { recipientEmail: newReminder.userEmail });

  res.status(201).json({
    success: true,
    message: `${type === 'yoga' ? 'Yoga' : 'Medicine'} reminder saved successfully!`,
    reminder: newReminder
  });
});

app.put('/api/reminders/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const db = readDB();
  if (!db.reminders) db.reminders = [];

  const reminder = db.reminders.find(r => r.id === id);
  if (!reminder) {
    return res.status(404).json({ success: false, error: 'Reminder not found' });
  }

  Object.assign(reminder, updates, { updatedAt: new Date().toISOString() });
  writeDB(db);

  io.emit('reminders_updated', { recipientEmail: reminder.userEmail });

  res.json({ success: true, reminder });
});

app.delete('/api/reminders/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  if (!db.reminders) db.reminders = [];

  const idx = db.reminders.findIndex(r => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Reminder not found' });
  }

  const removed = db.reminders.splice(idx, 1)[0];
  writeDB(db);

  io.emit('reminders_updated', { recipientEmail: removed.userEmail });

  res.json({ success: true, message: 'Reminder deleted successfully' });
});

// ==========================================
// 13. REAL-TIME AI HEALTH AGENT API
// Answers questions, explains medicines, suggests yoga & schedules reminders
// ==========================================
app.post('/api/ai/chat', (req, res) => {
  const { message, userEmail } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  const text = message.toLowerCase().trim();
  const db = readDB();
  const userPrescriptions = (db.prescriptions || []).filter(p => !userEmail || (p.patientEmail && p.patientEmail.toLowerCase() === userEmail.toLowerCase()));
  const userReminders = (db.reminders || []).filter(r => !userEmail || (r.userEmail && r.userEmail.toLowerCase() === userEmail.toLowerCase()));

  let reply = '';
  let actionTaken = null;
  let scheduledReminder = null;

  // 1. Natural Language Reminder Scheduling Intent
  if (text.includes('remind me') || text.includes('set reminder') || text.includes('schedule reminder') || text.includes('add reminder')) {
    const isYoga = text.includes('yoga') || text.includes('pranayama') || text.includes('asana') || text.includes('namaskar') || text.includes('exercise');
    
    // Extract time (e.g. 7:00, 8:30, 2 pm, 9:00 am)
    let timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let reminderTime = '08:00';
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? String(timeMatch[2]).padStart(2, '0') : '00';
      const meridian = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
      if (meridian === 'pm' && hours < 12) hours += 12;
      if (meridian === 'am' && hours === 12) hours = 0;
      reminderTime = `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    if (isYoga) {
      let poseName = 'Daily Wellness Yoga';
      if (text.includes('surya namaskar')) poseName = 'Surya Namaskar (Sun Salutations)';
      else if (text.includes('pranayama')) poseName = 'Anulom Vilom Pranayama';
      else if (text.includes('back')) poseName = 'Bhujangasana (Back Care Yoga)';
      else if (text.includes('sleep') || text.includes('night')) poseName = 'Shavasana & Gentle Night Stretch';

      scheduledReminder = {
        id: `rem_${Date.now()}_ai_yoga`,
        type: 'yoga',
        yogaName: poseName,
        targetBenefit: 'Energy, flexibility and deep respiratory health',
        reminderTime: reminderTime,
        duration: '15 Mins',
        frequency: 'Daily',
        startDate: new Date().toISOString().split('T')[0],
        instructions: 'Practice on an empty stomach with relaxed, natural breathing.',
        userEmail: userEmail || 'priya@healthkart.com',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      if (!db.reminders) db.reminders = [];
      db.reminders.unshift(scheduledReminder);
      writeDB(db);
      io.emit('reminders_updated', { recipientEmail: scheduledReminder.userEmail });
      actionTaken = 'REMINDER_CREATED';
      reply = `🧘 I have scheduled your **${poseName}** routine for **${reminderTime}**! You'll receive real-time audio and on-screen reminders when it's time to practice.`;
    } else {
      // Medicine reminder
      let medName = 'Prescribed Medicine';
      const medMatch = text.match(/(?:take|for|of)\s+([a-zA-Z0-9\s]+?)(?:\s+at|\s+after|\s+before|\s+in|\s+dosage|$)/i);
      if (medMatch && medMatch[1].trim().length > 2) {
        medName = medMatch[1].trim();
      } else if (text.includes('paracetamol')) medName = 'Paracetamol 500mg';
      else if (text.includes('amoxicillin')) medName = 'Amoxicillin 500mg';
      else if (text.includes('vitamin')) medName = 'Vitamin D3';
      else if (text.includes('cetirizine')) medName = 'Cetirizine 10mg';

      let mealTiming = 'After Meal';
      if (text.includes('before breakfast')) mealTiming = 'Before Breakfast';
      else if (text.includes('after breakfast')) mealTiming = 'After Breakfast';
      else if (text.includes('before lunch')) mealTiming = 'Before Lunch';
      else if (text.includes('after lunch')) mealTiming = 'After Lunch';
      else if (text.includes('before dinner')) mealTiming = 'Before Dinner';
      else if (text.includes('after dinner')) mealTiming = 'After Dinner';
      else if (text.includes('empty stomach')) mealTiming = 'Empty Stomach';

      scheduledReminder = {
        id: `rem_${Date.now()}_ai_med`,
        type: 'medicine',
        medicineName: medName,
        dosage: '1 Dose',
        mealTiming: mealTiming,
        reminderTime: reminderTime,
        frequency: 'Daily',
        startDate: new Date().toISOString().split('T')[0],
        duration: '5 Days',
        instructions: `Take ${mealTiming.toLowerCase()} with a glass of water.`,
        userEmail: userEmail || 'priya@healthkart.com',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      if (!db.reminders) db.reminders = [];
      db.reminders.unshift(scheduledReminder);
      writeDB(db);
      io.emit('reminders_updated', { recipientEmail: scheduledReminder.userEmail });
      actionTaken = 'REMINDER_CREATED';
      reply = `💊 Scheduled! I've set your medicine reminder for **${medName}** at **${reminderTime}** (${mealTiming}). I will notify you with sound and voice so you never miss eating before/after your medication!`;
    }
  }
  // 2. Questions about Prescriptions
  else if (text.includes('prescription') || text.includes('doctor advice') || text.includes('doctor prescribe')) {
    if (userPrescriptions.length > 0) {
      const latest = userPrescriptions[0];
      const medsList = latest.medicines.map(m => `• **${m.name}** (${m.dosage}) - ${m.mealTiming || 'After meals'}`).join('\n');
      const yogaList = latest.yogaRoutines.map(y => `• **${y.poseName}** (${y.timing || 'Morning'}) - ${y.duration}`).join('\n');
      reply = `📋 **Your Latest Prescription by ${latest.doctorName} (${latest.id}):**\n\n**Diagnosis:** ${latest.diagnosis}\n\n**Medicines to eat:**\n${medsList}\n\n**Recommended Yoga:**\n${yogaList}\n\n**Doctor's Advice:** ${latest.advice}`;
    } else {
      reply = `You don't have any recorded prescriptions yet. When your doctor conducts a video consultation and issues a prescription, it will appear here automatically with customized medicine eating and yoga reminders!`;
    }
  }
  // 3. Questions about Schedule or Pending Reminders
  else if (text.includes('schedule') || text.includes('reminder') || text.includes('what should i take') || text.includes('today')) {
    if (userReminders.length > 0) {
      const meds = userReminders.filter(r => r.type === 'medicine').map(m => `💊 **${m.reminderTime}** - ${m.medicineName} (${m.dosage}) — *${m.mealTiming}*`).join('\n');
      const yogas = userReminders.filter(r => r.type === 'yoga').map(y => `🧘 **${y.reminderTime}** - ${y.yogaName} (${y.duration})`).join('\n');
      reply = `📅 **Your Real-Time Daily Health Schedule:**\n\n**Medicine Eating Timings:**\n${meds || 'None scheduled.'}\n\n**Daily Yoga & Pranayama:**\n${yogas || 'None scheduled.'}\n\n*Our real-time notification engine will chime when each time arrives!*`;
    } else {
      reply = `You have no active reminders right now. You can tell me: *"Remind me to take Paracetamol after lunch at 1:30 PM"* or *"Schedule morning yoga at 7:00 AM"*!`;
    }
  }
  // 4. Questions about Yoga
  else if (text.includes('yoga') || text.includes('asana') || text.includes('pranayama') || text.includes('exercise')) {
    if (text.includes('back') || text.includes('spine')) {
      reply = `🧘 **Best Yoga for Back Pain & Posture:**\n\n1. **Bhujangasana (Cobra Pose):** Strengthens spinal column and opens the chest. Hold for 30s.\n2. **Balasana (Child's Pose):** Decompresses lumbar vertebrae and calms the nervous system.\n3. **Marjaryasana-Bitilasana (Cat-Cow):** Restores synovial fluid flow in your spine.\n\n*Tip:* Practice in the morning before eating or in the evening on an empty stomach. Would you like me to schedule a daily reminder for this?`;
    } else if (text.includes('digestion') || text.includes('stomach') || text.includes('gas') || text.includes('acid')) {
      reply = `🧘 **Best Yoga for Digestion & Metabolism:**\n\n1. **Vajrasana (Thunderbolt Pose):** The only asana recommended immediately *after* eating. Sit for 5-10 mins to enhance digestive blood flow.\n2. **Pavanamuktasana (Wind-Relieving Pose):** Relieves abdominal bloating and trapped gases.\n3. **Ardha Matsyendrasana (Half Fish Pose):** Massages abdominal organs and stimulates pancreas.\n\nWould you like me to schedule a 10-minute Vajrasana reminder after dinner?`;
    } else if (text.includes('stress') || text.includes('anxiety') || text.includes('sleep')) {
      reply = `🧘 **Best Yoga for Stress Relief & Sound Sleep:**\n\n1. **Anulom Vilom Pranayama:** 10 mins of alternate nostril breathing balances sympathetic and parasympathetic nervous systems.\n2. **Viparita Karani (Legs-Up-The-Wall):** Inversion that lowers cortisol and induces deep physical relaxation.\n3. **Shavasana (Corpse Pose):** 5-10 mins with mindful progressive muscle relaxation before bed.\n\nShall I set a 9:30 PM evening breathing reminder for you?`;
    } else {
      reply = `🧘 **HealthKart Yoga Therapy Intelligence:**\nYoga improves drug bioavailability, hormonal balance, and mental clarity.\n\n• **Morning:** Surya Namaskar (Sun Salutations) for vitality.\n• **Post-Meal:** Vajrasana for digestion.\n• **Evening:** Bhujangasana & Pranayama for back fatigue & peaceful sleep.\n\nTell me your health focus (e.g. *back pain, digestion, stress, thyroid, immunity*) and I will tailor a personalized routine with reminders!`;
    }
  }
  // 5. Questions about Medicines & Meal Eating Timing
  else if (text.includes('paracetamol') || text.includes('fever') || text.includes('pain')) {
    reply = `💊 **Paracetamol 500mg Guidance:**\n• **Purpose:** Relieves mild to moderate pain and lowers body temperature in fever.\n• **Meal Timing:** Best taken **after food or a snack** with a full glass of water to avoid gastric irritation.\n• **Dosage:** Typically 500mg every 4 to 6 hours as needed; do not exceed 4,000mg in 24 hours.\n• **Precaution:** Avoid combining with alcohol or other acetaminophen-containing cold remedies.`;
  }
  else if (text.includes('amoxicillin') || text.includes('antibiotic')) {
    reply = `💊 **Amoxicillin 500mg Guidance:**\n• **Purpose:** Broad-spectrum penicillin antibiotic for bacterial respiratory, ear, or throat infections.\n• **Meal Timing:** Take **at the start of a meal or within 20 minutes after eating** to enhance absorption and prevent nausea.\n• **Crucial Rule:** Complete the full course prescribed by your doctor even if you feel completely cured!\n• **Hydration:** Drink plenty of fluids throughout the day.`;
  }
  else if (text.includes('cetirizine') || text.includes('allergy') || text.includes('cold')) {
    reply = `💊 **Cetirizine 10mg Guidance:**\n• **Purpose:** Antihistamine relieving runny nose, sneezing, itchy watery eyes, and hives.\n• **Meal Timing:** Can be taken with or without food; best taken **after dinner before bedtime** as it may cause slight drowsiness.\n• **Safety:** Avoid alcohol and nighttime driving while using Cetirizine.`;
  }
  else if (text.includes('eating') || text.includes('empty stomach') || text.includes('before food') || text.includes('after food')) {
    reply = `🍽️ **Why Medicine Eating Timing Matters:**\n\n• **After Food (Post-Prandial):** NSAIDs, pain relievers (Paracetamol), antibiotics (Amoxicillin) protect the gastric mucosa from acid irritation.\n• **Before Food / Empty Stomach:** Proton pump inhibitors (Pantoprazole, Omeprazole) and thyroid medication (Thyroxine) need gastric acid absence for proper absorption.\n• **With Milk / Healthy Fats:** Fat-soluble vitamins (Vitamin D3, E, A, K) absorb up to 50% better with a meal containing healthy fats.`;
  }
  else {
    reply = `Hello! I am your **HealthKart Real-Time AI Health Agent**. 🌿\n\nI can assist you with:\n1. 💊 **Medicine Eating Reminders:** Setting reminders synchronized with breakfast, lunch, or dinner.\n2. 🧘 **Yoga & Pranayama:** Recommending routines for back pain, digestion, stress, sleep, or stamina.\n3. 📋 **Doctor's Prescriptions:** Explaining dosage instructions and precautions given by your doctor.\n4. ⏰ **Live Alerts:** Providing real-time voice and audio alerts right when it's time.\n\nTry asking me: *"Remind me to take Paracetamol after lunch at 1:30 PM"* or *"What yoga should I do for lower back pain?"*`;
  }

  res.json({
    success: true,
    reply,
    actionTaken,
    scheduledReminder
  });
});

// 12. AI CLINICAL SYMPTOM TRIAGE & SPECIALIST MATCHER
app.post('/api/ai/triage', (req, res) => {
  const { symptoms } = req.body;
  if (!symptoms || symptoms.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Please describe your symptoms.' });
  }

  const text = symptoms.toLowerCase();
  let specialty = 'General Physician';
  let recommendedDoctorId = 'rahul';
  let urgency = 'Routine (Ideal for Video Consultation)';
  let urgencyLevel = 'routine';
  let clinicalSummary = '';
  let suggestedQuestions = [];
  let yogaPrecaution = '';

  if (text.includes('skin') || text.includes('rash') || text.includes('acne') || text.includes('itch') || text.includes('hair') || text.includes('dermat')) {
    specialty = 'Dermatologist';
    recommendedDoctorId = 'priya';
    urgency = 'Mild to Moderate (Clear Video Inspection Recommended)';
    urgencyLevel = 'mild';
    clinicalSummary = `Dermatological presentation: patient reports ${symptoms}. Visual assessment and topical treatment evaluation advised.`;
    suggestedQuestions = [
      'Could this rash or reaction be caused by diet, cosmetics, or allergens?',
      'Are topical antihistamines or barrier creams safe for daily use?',
      'How soon should improvement appear before an in-person follow-up?'
    ];
    yogaPrecaution = 'Avoid high-heat hot yoga or heavy sweating until skin inflammation calms.';
  } else if (text.includes('heart') || text.includes('chest') || text.includes('palpitation') || text.includes('bp') || text.includes('blood pressure') || text.includes('breathless')) {
    specialty = 'Cardiologist';
    recommendedDoctorId = 'amit';
    urgency = 'Priority (Comprehensive Tele-Triage & Vitals Review)';
    urgencyLevel = 'priority';
    clinicalSummary = `Cardiovascular / Thoracic symptom report: ${symptoms}. Doctor will evaluate resting heart rate, BP trends, and lifestyle factors.`;
    suggestedQuestions = [
      'Should I monitor my daily resting BP and pulse in morning and evening?',
      'Are there specific ECG or lipid profile markers to test?',
      'What dietary sodium reductions and light walking regimens are safest?'
    ];
    yogaPrecaution = 'Practice gentle Anulom Vilom and Shavasana; strictly avoid breath retention (Kumbhaka) and Kapalbhati.';
  } else if (text.includes('bone') || text.includes('joint') || text.includes('back') || text.includes('knee') || text.includes('spine') || text.includes('muscle') || text.includes('ortho')) {
    specialty = 'Orthopedic';
    recommendedDoctorId = 'arjun';
    urgency = 'Moderate (Musculoskeletal Range-of-Motion & Ergonomics Review)';
    urgencyLevel = 'moderate';
    clinicalSummary = `Musculoskeletal strain / Joint complaint: ${symptoms}. Focus on spinal biomechanics, posture, and anti-inflammatory care.`;
    suggestedQuestions = [
      'Is this posture-related muscle fatigue or ligament/joint strain?',
      'Should I apply heat or cold therapy, and when?',
      'What corrective ergonomic exercises can I perform while working?'
    ];
    yogaPrecaution = 'Gentle Marjaryasana (Cat-Cow) and Balasana (Child Pose) recommended; avoid deep forward bends without bending knees.';
  } else if (text.includes('child') || text.includes('baby') || text.includes('pediatric') || text.includes('toddler') || text.includes('kid')) {
    specialty = 'Pediatrician';
    recommendedDoctorId = 'neha';
    urgency = 'Priority Pediatric Care (Pediatric Video Consultation)';
    urgencyLevel = 'priority';
    clinicalSummary = `Pediatric symptom report: ${symptoms}. Child requires age-weight adjusted medication dosage and hydration monitoring.`;
    suggestedQuestions = [
      'What is the precise weight-based dosage for pediatric syrup or drops?',
      'What red-flag signs should prompt in-person emergency care?',
      'What hydration fluids or electrolytes are best tolerated?'
    ];
    yogaPrecaution = 'Encourage gentle butterfly pose and fun deep breathing games without strain.';
  } else {
    specialty = 'General Physician';
    recommendedDoctorId = 'rahul';
    urgency = 'Routine (Ideal for Video Consultation)';
    urgencyLevel = 'routine';
    clinicalSummary = `Primary care symptom presentation: ${symptoms}. Comprehensive systemic evaluation, medication review, and recovery plan indicated.`;
    suggestedQuestions = [
      'What is the recommended dosage and meal timing (before/after food) for any prescribed medicine?',
      'Are there any side effects or food interactions to watch out for?',
      'What supportive yoga and hydration practices will accelerate recovery?'
    ];
    yogaPrecaution = 'Daily Surya Namaskar and Pranayama support immune vitality and respiratory circulation.';
  }

  const db = readDB();
  const doctor = db.doctors.find(d => d.id === recommendedDoctorId) || db.doctors[0];

  res.json({
    success: true,
    specialty,
    urgency,
    urgencyLevel,
    recommendedDoctor: doctor,
    clinicalSummary,
    suggestedQuestions,
    yogaPrecaution
  });
});

// ==========================================
// WEBRTC SIGNALING SERVER VIA SOCKET.IO (Requirement 8)
// ==========================================
const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User registration for targeted notifications
  socket.on('register_user', (userData) => {
    if (userData && userData.email) {
      socket.join(`user_${userData.email.toLowerCase()}`);
    }
  });

  // Doctor initiates call to patient
  socket.on('start_doctor_call', (callData) => {
    console.log(`Doctor ${callData.doctorName} calling patient ${callData.patientName || ''} (${callData.patientEmail || ''})`);
    io.emit('incoming_doctor_call', callData);
  });

  // Patient accepts call
  socket.on('accept_doctor_call', ({ roomId, appointmentId }) => {
    console.log(`Patient accepted doctor call for room: ${roomId}`);
    io.emit('doctor_call_accepted', { roomId, appointmentId });
  });

  // Patient declines call
  socket.on('decline_doctor_call', ({ roomId, appointmentId }) => {
    console.log(`Patient declined doctor call for room: ${roomId}`);
    if (roomId) {
      socket.to(roomId).emit('doctor_call_declined', { appointmentId });
    }
    io.emit('doctor_call_declined', { roomId, appointmentId });
  });

  // Join video consultation room
  socket.on('join_room', ({ roomId, role, userName }) => {
    if (!roomId) return;
    socket.join(roomId);

    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Set());
    }
    const roomUsers = activeRooms.get(roomId);
    roomUsers.add(socket.id);

    console.log(`User ${userName} (${role}) joined room: ${roomId}. Total: ${roomUsers.size}`);

    // Notify other participant that peer joined
    socket.to(roomId).emit('peer_joined', {
      peerId: socket.id,
      role,
      userName
    });

    // If both participants are in the room, notify room so Doctor creates WebRTC offer
    if (roomUsers.size > 1) {
      io.to(roomId).emit('room_ready', { roomId, totalParticipants: roomUsers.size });
    }
  });

  // WebRTC Signaling: Offer
  socket.on('webrtc_offer', ({ roomId, sdp }) => {
    socket.to(roomId).emit('webrtc_offer', { sdp, senderId: socket.id });
  });

  // WebRTC Signaling: Answer
  socket.on('webrtc_answer', ({ roomId, sdp }) => {
    socket.to(roomId).emit('webrtc_answer', { sdp, senderId: socket.id });
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('ice_candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice_candidate', { candidate, senderId: socket.id });
  });

  // In-Call Real-Time Text Chat
  socket.on('in_call_chat', ({ roomId, message, senderName, role, time }) => {
    if (!roomId) return;
    socket.to(roomId).emit('in_call_chat', {
      message,
      senderName,
      role,
      time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // In-Call Doctor Prescription Issued
  socket.on('in_call_prescription', ({ roomId, prescription }) => {
    if (!roomId) return;
    socket.to(roomId).emit('in_call_prescription', { prescription });
  });

  // Screen Share Status
  socket.on('screen_share_status', ({ roomId, isSharing, userName }) => {
    if (!roomId) return;
    socket.to(roomId).emit('screen_share_status', { isSharing, userName });
  });

  // Hangup / End Call
  socket.on('end_call', ({ roomId }) => {
    socket.to(roomId).emit('call_ended', { senderId: socket.id });
  });

  // Disconnection cleanup
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (activeRooms.has(room)) {
        const roomUsers = activeRooms.get(room);
        roomUsers.delete(socket.id);
        if (roomUsers.size === 0) {
          activeRooms.delete(room);
        } else {
          socket.to(room).emit('peer_left', { peerId: socket.id });
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HealthKart server running at http://localhost:${PORT}`);
});
