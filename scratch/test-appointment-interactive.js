import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
    console.log('--- Checking appointment.html for runtime issues ---');
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9224',
        '--disable-gpu',
        '--no-sandbox'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const res = await fetch('http://127.0.0.1:9224/json/new?http://localhost:3000/pages/appointment.html?id=rahul', { method: 'PUT' });
        const target = await res.json();
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise(r => ws.on('open', r));

        let id = 1;
        function send(method, params = {}) {
            return new Promise((resolve) => {
                const curId = id++;
                const handler = (msg) => {
                    const data = JSON.parse(msg);
                    if (data.id === curId) {
                        ws.off('message', handler);
                        resolve(data.result);
                    }
                };
                ws.on('message', handler);
                ws.send(JSON.stringify({ id: curId, method, params }));
            });
        }

        const errors = [];
        ws.on('message', (msg) => {
            const data = JSON.parse(msg);
            if (data.method === 'Runtime.consoleAPICalled') {
                console.log('  [CONSOLE]', data.params.type, data.params.args.map(a => a.value || a.description || '').join(' '));
                if (data.params.type === 'error') {
                    errors.push(data.params.args.map(a => a.value || a.description || '').join(' '));
                }
            }
            if (data.method === 'Runtime.exceptionThrown') {
                console.error('  [EXCEPTION]', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
                errors.push(data.params.exceptionDetails.text + ': ' + data.params.exceptionDetails.exception?.description);
            }
        });

        await send('Runtime.enable');
        await send('Page.enable');

        await new Promise(r => setTimeout(r, 2000));

        // Inspect DOM state
        const state = await send('Runtime.evaluate', {
            returnByValue: true,
            expression: `({
                dateBtnCount: document.querySelectorAll(".date-btn").length,
                selectedDateBtn: document.querySelector(".date-btn.selected")?.dataset?.date,
                timeBtnCount: document.querySelectorAll(".time-btn").length,
                selectedTimeBtn: document.querySelector(".time-btn.selected")?.dataset?.time,
                doctorName: document.getElementById("selectedDoctorName")?.textContent,
                summaryFee: document.getElementById("summaryFee")?.textContent,
                hasConfirmBtn: !!document.querySelector(".confirm-btn"),
                hasModal: !!document.getElementById("successModal")
            })`
        });

        console.log('\nPage Loaded State:', state?.result?.value);

        // Click a date (e.g. tomorrow)
        console.log('\nClicking 2nd date button...');
        await send('Runtime.evaluate', {
            expression: `(() => {
                const dates = document.querySelectorAll(".date-btn:not(.sunday-disabled)");
                if (dates[1]) dates[1].click();
            })()`
        });
        await new Promise(r => setTimeout(r, 1000));

        const stateAfterDate = await send('Runtime.evaluate', {
            returnByValue: true,
            expression: `({
                selectedDateBtn: document.querySelector(".date-btn.selected")?.dataset?.date,
                timeBtnCount: document.querySelectorAll(".time-btn").length,
                selectedTimeBtn: document.querySelector(".time-btn.selected")?.dataset?.time,
                availableTimeBtnCount: document.querySelectorAll(".time-btn:not(.booked)").length
            })`
        });
        console.log('State after clicking 2nd date:', stateAfterDate?.result?.value);

        // Click an available slot
        console.log('\nClicking first available slot...');
        await send('Runtime.evaluate', {
            expression: `(() => {
                const slot = document.querySelector(".time-btn:not(.booked)");
                if (slot) slot.click();
            })()`
        });
        await new Promise(r => setTimeout(r, 500));

        // Submit form
        console.log('\nFilling patient details and confirming appointment...');
        const bookRes = await send('Runtime.evaluate', {
            returnByValue: true,
            awaitPromise: true,
            expression: `(async () => {
                document.getElementById("patientName").value = "Rohan Verma";
                document.getElementById("patientMobile").value = "9876501234";
                document.getElementById("patientEmail").value = "rohan@example.com";
                document.getElementById("healthConcern").value = "Routine health checkup";

                await window.confirmAppointment();
                await new Promise(r => setTimeout(r, 1500));

                const modal = document.getElementById("successModal");
                return {
                    modalDisplay: modal ? window.getComputedStyle(modal).display : null,
                    modalClass: modal ? modal.className : null,
                    appointmentId: document.getElementById("appointmentId")?.textContent,
                    successDoctor: document.getElementById("successDoctor")?.textContent,
                    successDate: document.getElementById("successDate")?.textContent,
                    successTime: document.getElementById("successTime")?.textContent,
                    alertText: document.getElementById("bookingAlertBox")?.textContent
                };
            })()`
        });

        console.log('Booking Result:', bookRes?.result?.value);

        ws.close();
        console.log('Total Console/Runtime Errors:', errors.length);
    } catch (e) {
        console.error('Test error:', e);
    } finally {
        chrome.kill();
    }
}

main();
