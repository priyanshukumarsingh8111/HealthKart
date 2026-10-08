import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--disable-gpu',
        '--no-sandbox'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const versionRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:3000/pages/appointment.html', { method: 'PUT' });
        const target = await versionRes.json();
        const wsUrl = target.webSocketDebuggerUrl;

        const ws = new WebSocket(wsUrl);
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

        ws.on('message', (msg) => {
            const data = JSON.parse(msg);
            if (data.method === 'Runtime.consoleAPICalled') {
                console.log('[BROWSER CONSOLE]', data.params.type, data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
            }
            if (data.method === 'Runtime.exceptionThrown') {
                console.error('[BROWSER EXCEPTION]', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
            }
        });

        await send('Runtime.enable');
        await send('Page.enable');

        await new Promise(r => setTimeout(r, 2000));

        // Count time-btn
        const checkSlots = await send('Runtime.evaluate', {
            expression: 'document.querySelectorAll(".time-btn").length'
        });
        console.log('Time buttons count:', checkSlots?.result?.value);

        // Fill form and click a slot
        const fillResult = await send('Runtime.evaluate', {
            expression: `(() => {
                const name = document.getElementById("patientName");
                const mobile = document.getElementById("patientMobile");
                const email = document.getElementById("patientEmail");
                const concern = document.getElementById("healthConcern");
                if (name) name.value = "John Patient";
                if (mobile) mobile.value = "9876543210";
                if (email) email.value = "john@example.com";
                if (concern) concern.value = "Persistent migraine";

                const slots = Array.from(document.querySelectorAll(".time-btn:not(.booked)"));
                if (slots.length > 0) {
                    slots[0].click();
                    return "Slot clicked: " + slots[0].textContent;
                }
                return "No unbooked slots found";
            })()`
        });
        console.log('Fill result:', fillResult?.result?.value);

        // Click confirm
        console.log('Calling confirmAppointment()...');
        const confirmResult = await send('Runtime.evaluate', {
            awaitPromise: true,
            expression: `(async () => {
                try {
                    await window.confirmAppointment();
                    const alertBox = document.getElementById("bookingAlertBox");
                    const successModal = document.getElementById("successModal");
                    return {
                        alert: alertBox ? alertBox.innerText : null,
                        modalDisplay: successModal ? successModal.style.display : null
                    };
                } catch(err) {
                    return { error: err.message, stack: err.stack };
                }
            })()`
        });
        console.log('Confirm result:', confirmResult?.result?.value);

        await new Promise(r => setTimeout(r, 3000));

        ws.close();
    } catch (e) {
        console.error('Diagnostic error:', e);
    } finally {
        chrome.kill();
    }
}

main();
