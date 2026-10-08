// Automated Verification of Video Call Signaling, Incoming Call Ringing & Call Cut Feature
import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
    console.log('===============================================================');
    console.log('📞 HEALTHKART VIDEO CALL SIGNALING & CUT BUTTON VERIFICATION');
    console.log('===============================================================\n');

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

    // 1. Verify CSS rules for Incoming Call Overlay
    console.log('--- 1. Testing Incoming Call UI Styles in nav-auth.css ---');
    const cssPath = path.resolve('css/nav-auth.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    assert('Overlay container style present', cssContent.includes('.hk-incoming-call-overlay'));
    assert('Card modal style present', cssContent.includes('.hk-incoming-call-card'));
    assert('Pulsating avatar ripples present', cssContent.includes('.hk-incoming-ripple'));
    assert('Accept button style present', cssContent.includes('.hk-incoming-btn-accept'));
    assert('Decline button style present', cssContent.includes('.hk-incoming-btn-decline'));

    // 2. Verify Client Logic in nav-auth.js
    console.log('\n--- 2. Testing Shared Incoming Call & Ringtone in nav-auth.js ---');
    const navJsPath = path.resolve('js/nav-auth.js');
    const navJsContent = fs.readFileSync(navJsPath, 'utf8');
    assert('Web Audio ringtone synthesizer present', navJsContent.includes('function startRingtone()') && navJsContent.includes('AudioContext'));
    assert('Ringtone cleanup function present', navJsContent.includes('function stopRingtone()'));
    assert('showIncomingCallModal function present', navJsContent.includes('showIncomingCallModal'));
    assert('Socket.IO incoming call listener present', navJsContent.includes('socketClient.on("incoming_doctor_call"'));
    assert('Firestore ringing call listener present', navJsContent.includes('data.status === "ringing"') && navJsContent.includes('calls'));

    // 3. Verify Video Consultation Logic in video-consultation.js
    console.log('\n--- 3. Testing Video Call Cut Button & Glare Fix in video-consultation.js ---');
    const vcJsPath = path.resolve('js/video-consultation.js');
    const vcJsContent = fs.readFileSync(vcJsPath, 'utf8');
    assert('Call cut button listener wired', vcJsContent.includes('endCallBtn.onclick = () => {') && vcJsContent.includes('endCall(true)'));
    assert('endCall implementation present', vcJsContent.includes('async function endCall('));
    assert('Doctor call notification trigger present', vcJsContent.includes('function triggerDoctorCallInitiation()'));
    assert('Outbound ringback audio synthesizer present', vcJsContent.includes('function startOutboundRingback()'));
    assert('Signaling glare prevention (Doctor is offerer) present', vcJsContent.includes('currentRole === "doctor"') && vcJsContent.includes('createOffer'));

    // 4. Test Socket.IO Real-time Call Signaling Flow between Doctor and Patient
    console.log('\n--- 4. Testing End-to-End Real-Time Socket.IO Calling Flow ---');
    await new Promise((resolve) => {
        const testRoomId = 'call_HK-AUTO-TEST-' + Date.now();
        const testApptId = 'HK-AUTO-' + Date.now();
        const patientEmail = 'patient.auto@healthkart.com';

        // Connect Patient Socket
        const patientSocket = io(SERVER_URL, { reconnection: false });
        // Connect Doctor Socket
        const doctorSocket = io(SERVER_URL, { reconnection: false });

        let patientReceivedIncomingCall = false;
        let doctorReceivedRoomReady = false;
        let patientReceivedOffer = false;
        let doctorReceivedAnswer = false;
        let patientReceivedCallEnd = false;

        const timeout = setTimeout(() => {
            patientSocket.disconnect();
            doctorSocket.disconnect();
            assert('Real-time calling completed within timeout', false, 'Timeout exceeded');
            resolve();
        }, 8000);

        patientSocket.on('connect', () => {
            patientSocket.emit('register_user', { email: patientEmail });
            // Once patient is connected and listening, doctor emits call
            setTimeout(() => {
                doctorSocket.emit('start_doctor_call', {
                    roomId: testRoomId,
                    appointmentId: testApptId,
                    doctorName: 'Dr. Rahul Sharma',
                    doctorSpecialization: 'General Physician',
                    patientName: 'Auto Test Patient',
                    patientEmail: patientEmail
                });
            }, 100);
        });

        // Step B: Patient receives incoming call event on their phone/screen
        patientSocket.on('incoming_doctor_call', (callData) => {
            if (callData.roomId === testRoomId) {
                patientReceivedIncomingCall = true;
                assert('Patient receives "Doctor is calling" notification on phone/screen', true, `(From ${callData.doctorName})`);

                // Step C: Patient accepts the call and both join the WebRTC room
                patientSocket.emit('accept_doctor_call', { roomId: testRoomId, appointmentId: testApptId });
                patientSocket.emit('join_room', { roomId: testRoomId, role: 'patient', userName: 'Auto Test Patient' });
                doctorSocket.emit('join_room', { roomId: testRoomId, role: 'doctor', userName: 'Dr. Rahul Sharma' });
            }
        });

        // Step D: Both in room -> room_ready fires
        doctorSocket.on('room_ready', () => {
            doctorReceivedRoomReady = true;
            assert('Room is ready when both participants join', true);

            // Step E: Doctor sends WebRTC offer
            doctorSocket.emit('webrtc_offer', {
                roomId: testRoomId,
                sdp: { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
            });
        });

        // Step F: Patient receives offer and sends answer
        patientSocket.on('webrtc_offer', ({ sdp }) => {
            patientReceivedOffer = true;
            assert('Patient receives doctor WebRTC offer', Boolean(sdp));

            patientSocket.emit('webrtc_answer', {
                roomId: testRoomId,
                sdp: { type: 'answer', sdp: 'v=0\r\no=- 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
            });
        });

        // Step G: Doctor receives answer -> call connected
        doctorSocket.on('webrtc_answer', ({ sdp }) => {
            doctorReceivedAnswer = true;
            assert('Doctor receives patient WebRTC answer', Boolean(sdp));

            // Step H: Doctor clicks the Call Cut button -> emits end_call
            doctorSocket.emit('end_call', { roomId: testRoomId });
        });

        // Step I: Patient receives call_ended
        patientSocket.on('call_ended', () => {
            patientReceivedCallEnd = true;
            assert('Patient receives call_ended when call cut button is pressed', true);

            clearTimeout(timeout);
            patientSocket.disconnect();
            doctorSocket.disconnect();
            resolve();
        });
    });

    console.log('\n===============================================================');
    console.log(`TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
    console.log('===============================================================\n');

    if (failed === 0) {
        console.log('🎉 ALL VIDEO CALLING, INCOMING CALL NOTIFICATION, AND CALL CUT TESTS PASSED!');
    } else {
        process.exitCode = 1;
    }
}

runTest();
