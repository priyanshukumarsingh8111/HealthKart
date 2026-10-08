// Automated Verification Test for HealthKart Real-Time Telehealth & AI System
import http from 'http';

const BASE_URL = 'http://localhost:3000';

async function fetchJson(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return { status: res.status, ok: res.ok, data: await res.json() };
    }
    return { status: res.status, ok: res.ok, text: await res.text() };
}

async function runTests() {
    console.log('====================================================');
    console.log('🩺 HEALTHKART TELEHEALTH & AI AGENT VERIFICATION TEST');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(name, condition, extra = '') {
        if (condition) {
            console.log(`✅ [PASS] ${name} ${extra}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${name} ${extra}`);
            failed++;
        }
    }

    try {
        // 1. Static Pages Availability
        console.log('--- 1. Testing Core Pages ---');
        const pages = [
            '/',
            '/index.html',
            '/pages/doctors.html',
            '/pages/doctor-dashboard.html',
            '/pages/reminders.html',
            '/pages/prescriptions.html',
            '/pages/my-appointments.html',
            '/pages/video-consultation.html',
            '/pages/my-health.html',
            '/pages/search.html',
            '/pages/cart.html',
            '/pages/checkout.html'
        ];

        for (const page of pages) {
            const res = await fetch(`${BASE_URL}${page}`);
            assert(`Page: ${page}`, res.status === 200, `(HTTP ${res.status})`);
        }

        // 2. Doctor Endpoints
        console.log('\n--- 2. Testing Doctors API ---');
        const docRes = await fetchJson('/api/doctors');
        assert('GET /api/doctors returns list', docRes.ok && docRes.data.doctors?.length > 0, `(${docRes.data.doctors?.length} doctors)`);
        const rahulRes = await fetchJson('/api/doctors/rahul');
        assert('GET /api/doctors/rahul returns Dr. Rahul Sharma', rahulRes.ok && rahulRes.data.doctor?.name === 'Dr. Rahul Sharma');

        // 3. Prescriptions API
        console.log('\n--- 3. Testing Prescriptions API ---');
        const presRes = await fetchJson('/api/prescriptions');
        assert('GET /api/prescriptions returns list', presRes.ok && presRes.data.prescriptions?.length > 0, `(${presRes.data.prescriptions?.length} prescriptions)`);

        const testRx = presRes.data.prescriptions[0];
        assert('Prescription contains medicines & yoga routines', 
            testRx.medicines?.length > 0 && testRx.yogaRoutines?.length > 0,
            `(${testRx.medicines?.length} medicines, ${testRx.yogaRoutines?.length} yoga poses)`
        );

        // 4. Reminders API (Medicine Eating & Yoga)
        console.log('\n--- 4. Testing Reminders API (Medicine Eating & Yoga) ---');
        const remRes = await fetchJson('/api/reminders');
        assert('GET /api/reminders returns reminders list', remRes.ok && remRes.data.reminders?.length > 0, `(${remRes.data.reminders?.length} reminders)`);

        const medicineReminders = remRes.data.reminders.filter(r => r.type === 'medicine');
        const yogaReminders = remRes.data.reminders.filter(r => r.type === 'yoga');
        assert('Medicine Eating reminders exist with meal timings', 
            medicineReminders.length > 0 && medicineReminders.some(m => m.mealTiming),
            `(${medicineReminders.length} medicines, e.g. "${medicineReminders[0]?.mealTiming}")`
        );
        assert('Yoga & Pranayama reminders exist with routines', 
            yogaReminders.length > 0 && yogaReminders.some(y => y.yogaName),
            `(${yogaReminders.length} yoga routines, e.g. "${yogaReminders[0]?.yogaName}")`
        );

        // 5. AI Chat Real-Time Copilot
        console.log('\n--- 5. Testing AI Real-Time Agent Copilot ---');
        const aiScheduleRes = await fetchJson('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'What are my medicines and yoga routines for today?' })
        });
        assert('AI Chat answers medicine & yoga queries', 
            aiScheduleRes.ok && aiScheduleRes.data.reply?.includes('Medicine Eating') && aiScheduleRes.data.reply?.includes('Yoga'),
            `Reply snippet: "${aiScheduleRes.data.reply?.substring(0, 70)}..."`
        );

        const aiNewReminder = await fetchJson('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Remind me to take Vitamin D after breakfast at 9:00 AM' })
        });
        assert('AI Chat parses natural language to create reminder', 
            aiNewReminder.ok && aiNewReminder.data.actionTaken === 'REMINDER_CREATED' && aiNewReminder.data.scheduledReminder?.type === 'medicine',
            `Created: ${aiNewReminder.data.scheduledReminder?.medicineName} (${aiNewReminder.data.scheduledReminder?.mealTiming})`
        );

        // 6. Doctor Dashboard & Prescription Generation -> Patient Auto-Sync
        console.log('\n--- 6. Testing Doctor Prescription -> Patient Auto-Sync ---');
        const newPrescriptionPayload = {
            appointmentId: 'HK-784219',
            doctorId: 'rahul',
            patientName: 'Priyanshu Kumar',
            patientEmail: 'priya@healthkart.com',
            diagnosis: 'Acute Throat Irritation & Morning Stiffness',
            advice: 'Gargle with warm salt water. Practice gentle neck rolls and pranayama.',
            medicines: [
                {
                    name: 'Azithromycin 500mg',
                    dosage: '1 Tablet (500mg)',
                    frequency: 'Once Daily',
                    duration: '3 Days',
                    mealTiming: 'After Dinner',
                    reminderTime: '21:00',
                    instructions: 'Take 1 tablet after dinner with warm water'
                }
            ],
            yogaRoutines: [
                {
                    name: 'Ujjayi Pranayama (Ocean Breath)',
                    targetBenefit: 'Soothes throat inflammation and relaxes nervous system',
                    duration: '10 Mins',
                    frequency: 'Twice daily',
                    reminderTime: '08:00',
                    instructions: 'Gentle throat constriction breath with slow exhalations'
                }
            ]
        };

        const createPresRes = await fetchJson('/api/prescriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPrescriptionPayload)
        });

        assert('Doctor can issue digital prescription with medicines & yoga', 
            createPresRes.ok && createPresRes.data.prescription?.id,
            `Prescription ID: ${createPresRes.data.prescription?.id}`
        );
        assert('Digital prescription auto-generates patient reminders', 
            createPresRes.data.generatedReminders?.length >= 2,
            `Generated ${createPresRes.data.generatedReminders?.length} reminders`
        );

        // Verify newly generated reminders are in db
        const verifyRemRes = await fetchJson('/api/reminders?email=priya@healthkart.com');
        const hasNewMed = verifyRemRes.data.reminders.some(r => r.medicineName?.includes('Azithromycin'));
        const hasNewYoga = verifyRemRes.data.reminders.some(r => r.yogaName?.includes('Ujjayi'));
        assert('New prescription medicine reminder saved in DB', hasNewMed, 'Azithromycin present');
        assert('New prescription yoga reminder saved in DB', hasNewYoga, 'Ujjayi Pranayama present');

        // 7. Video Consultation Assets & WebRTC signaling
        console.log('\n--- 7. Testing Video Consultation Page & Scripts ---');
        const videoPage = await fetch(`${BASE_URL}/pages/video-consultation.html?appointmentId=HK-784219`);
        const videoHtml = await videoPage.text();
        assert('Video page has local and remote video elements', 
            videoHtml.includes('id="localVideo"') && videoHtml.includes('id="remoteVideo"'));
        assert('Video page has in-call chat drawer', 
            videoHtml.includes('id="inCallChatPanel"') && videoHtml.includes('id="inCallChatMessages"'));
        assert('Video page has doctor prescription modal', 
            videoHtml.includes('id="doctorRxModal"') && videoHtml.includes('id="doctorRxBtn"'));
        assert('Video page has screen share button', 
            videoHtml.includes('id="screenShareBtn"'));
        assert('Video page has patient prescription popup card', 
            videoHtml.includes('id="patientRxReceivedModal"'));

        // 8. Reminders Page UI & Audio Synthesizer Integration
        console.log('\n--- 8. Testing Reminders Page ---');
        const remPage = await fetch(`${BASE_URL}/pages/reminders.html`);
        const remHtml = await remPage.text();
        assert('Reminders page has Medicine and Yoga tabs', 
            remHtml.includes('data-filter="medicine"') && remHtml.includes('data-filter="yoga"'));
        assert('Reminders page has Meal-Timing selector', 
            remHtml.includes('value="After Lunch"') && remHtml.includes('value="Before Breakfast"'));
        assert('Reminders page has Chime Test button', 
            remHtml.includes('id="testAudioReminderBtn"'));

        // 9. AI Agent Components Injection
        console.log('\n--- 9. Testing AI Agent Global Injection ---');
        const navAuthContent = await (await fetch(`${BASE_URL}/js/nav-auth.js`)).text();
        assert('nav-auth.js injects ai-agent.js', 
            navAuthContent.includes('ai-agent.js'));

        const aiAgentJs = await (await fetch(`${BASE_URL}/js/ai-agent.js`)).text();
        assert('ai-agent.js implements Web Audio oscillator synthesizer chime', 
            aiAgentJs.includes('AudioContext') && aiAgentJs.includes('createOscillator'));
        assert('ai-agent.js checks due reminders every minute', 
            aiAgentJs.includes('checkDueReminders'));
        assert('ai-agent.js implements speech synthesis and recognition', 
            aiAgentJs.includes('speechSynthesis') && aiAgentJs.includes('SpeechRecognition'));

        console.log('\n====================================================');
        console.log(`TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
        console.log('====================================================\n');

        if (failed === 0) {
            console.log('🎉 ALL TELEHEALTH, AI AGENT, AND VIDEO CALLING TESTS PASSED!');
        } else {
            console.warn(`⚠️ ${failed} tests failed. Please review the output above.`);
        }

    } catch (err) {
        console.error('Test execution error:', err);
    }
}

runTests();
