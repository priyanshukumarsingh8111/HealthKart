import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
    console.log('--- Launching Headless Chrome for Login & Appointment Test ---');
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9223',
        '--disable-gpu',
        '--no-sandbox'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const createTab = async (url) => {
            const res = await fetch(`http://127.0.0.1:9223/json/new?${url}`, { method: 'PUT' });
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

            ws.on('message', (msg) => {
                const data = JSON.parse(msg);
                if (data.method === 'Runtime.consoleAPICalled') {
                    console.log('  [CONSOLE]', data.params.type, data.params.args.map(a => a.value || a.description || '').join(' '));
                }
            });

            await send('Runtime.enable');
            await send('Page.enable');
            return { ws, send };
        };

        // 1. Test pages/index.html redirect
        console.log('\nTest 1: Testing /pages/index.html redirect...');
        const tab1 = await createTab('http://localhost:3000/pages/index.html');
        await new Promise(r => setTimeout(r, 1000));
        const url1 = await tab1.send('Runtime.evaluate', { expression: 'window.location.href' });
        console.log('Result URL 1:', url1?.result?.value);
        if (url1?.result?.value?.includes('/index.html') && !url1?.result?.value?.includes('/pages/index.html')) {
            console.log('✅ [PASS] /pages/index.html properly redirected to root /index.html');
        } else {
            console.error('❌ [FAIL] Expected redirect away from /pages/index.html, got:', url1?.result?.value);
        }
        tab1.ws.close();

        // 2. Test Login as Patient
        console.log('\nTest 2: Testing Login as Patient from /pages/login.html...');
        const tab2 = await createTab('http://localhost:3000/pages/login.html');
        await new Promise(r => setTimeout(r, 1200));

        // Clear previous session so we can test clean login
        await tab2.send('Runtime.evaluate', {
            expression: 'localStorage.clear(); sessionStorage.clear();'
        });

        // Trigger Quick Login as Patient
        await tab2.send('Runtime.evaluate', {
            expression: 'window.handleQuickLogin("patient");'
        });
        await new Promise(r => setTimeout(r, 1200));

        const url2 = await tab2.send('Runtime.evaluate', { expression: 'window.location.href' });
        console.log('Result URL 2:', url2?.result?.value);
        if (url2?.result?.value?.endsWith('/index.html') && !url2?.result?.value?.includes('/pages/index.html')) {
            console.log('✅ [PASS] Patient login navigated to root /index.html');
        } else {
            console.error('❌ [FAIL] Expected /index.html, got:', url2?.result?.value);
        }
        tab2.ws.close();

        // 3. Test Login as Doctor
        console.log('\nTest 3: Testing Login as Doctor from /pages/login.html...');
        const tab3 = await createTab('http://localhost:3000/pages/login.html?switch=true');
        await new Promise(r => setTimeout(r, 1200));

        await tab3.send('Runtime.evaluate', {
            expression: 'window.handleQuickLogin("doctor");'
        });
        await new Promise(r => setTimeout(r, 1200));

        const url3 = await tab3.send('Runtime.evaluate', { expression: 'window.location.href' });
        console.log('Result URL 3:', url3?.result?.value);
        if (url3?.result?.value?.includes('doctor-dashboard.html')) {
            console.log('✅ [PASS] Doctor login navigated to doctor-dashboard.html');
        } else {
            console.error('❌ [FAIL] Expected doctor-dashboard.html, got:', url3?.result?.value);
        }
        tab3.ws.close();

        // 4. Test Appointment Booking & Modal
        console.log('\nTest 4: Testing Appointment Booking & Modal visibility...');
        const tab4 = await createTab('http://localhost:3000/pages/appointment.html?doctor=rahul');
        await new Promise(r => setTimeout(r, 2000));

        const bookingEval = await tab4.send('Runtime.evaluate', {
            returnByValue: true,
            awaitPromise: true,
            expression: `(async () => {
                const name = document.getElementById("patientName");
                const mobile = document.getElementById("patientMobile");
                const email = document.getElementById("patientEmail");
                const concern = document.getElementById("healthConcern");

                if (name) name.value = "Priyanshu Kumar";
                if (mobile) mobile.value = "9876543210";
                if (email) email.value = "priya@healthkart.com";
                if (concern) concern.value = "Mild headache and seasonal allergies";

                // Ensure a slot is selected
                const slotBtn = document.querySelector(".time-btn:not(.booked)");
                if (slotBtn) slotBtn.click();

                // Click confirm appointment
                await window.confirmAppointment();
                await new Promise(r => setTimeout(r, 1200));

                const modal = document.getElementById("successModal");
                const idEl = document.getElementById("appointmentId");
                return {
                    modalDisplay: modal ? window.getComputedStyle(modal).display : null,
                    modalClass: modal ? modal.className : null,
                    appointmentId: idEl ? idEl.textContent : null
                };
            })()`
        });

        console.log('Booking Result:', bookingEval?.result?.value);
        const bookingData = bookingEval?.result?.value;
        if (bookingData?.modalDisplay === 'flex' && bookingData?.appointmentId?.startsWith('HK-')) {
            console.log(`✅ [PASS] Appointment successfully booked! ID: ${bookingData.appointmentId}, Modal display: flex`);
        } else {
            console.error('❌ [FAIL] Booking modal not visible or invalid ID:', bookingData);
        }
        tab4.ws.close();

        console.log('\n--- ALL BROWSER E2E TESTS COMPLETED ---');
    } catch (e) {
        console.error('Test execution error:', e);
    } finally {
        chrome.kill();
    }
}

main();
