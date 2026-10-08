import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
    console.log('--- Verifying my-appointments.html and doctor-dashboard.html ---');
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9225',
        '--disable-gpu',
        '--no-sandbox'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const createTab = async (url) => {
            const res = await fetch(`http://127.0.0.1:9225/json/new?${url}`, { method: 'PUT' });
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

            await send('Runtime.enable');
            await send('Page.enable');
            return { ws, send };
        };

        // 1. Check Doctor Dashboard
        console.log('1. Checking Doctor Dashboard...');
        const docTab = await createTab('http://localhost:3000/pages/doctor-dashboard.html');
        await new Promise(r => setTimeout(r, 2000));

        const docState = await docTab.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `({
                doctorName: document.getElementById("dashDoctorName")?.textContent,
                upcomingCount: document.getElementById("metricUpcoming")?.textContent,
                cardsCount: document.querySelectorAll(".doctor-appt-card").length,
                firstCardPatient: document.querySelector(".doctor-appt-card strong")?.textContent
            })`
        });
        console.log('Doctor Dashboard State:', docState?.result?.value);
        docTab.ws.close();

        // 2. Check My Appointments
        console.log('2. Checking My Appointments...');
        const myTab = await createTab('http://localhost:3000/pages/my-appointments.html');
        await new Promise(r => setTimeout(r, 2000));

        const myState = await myTab.send('Runtime.evaluate', {
            returnByValue: true,
            expression: `({
                upcomingCount: document.getElementById("countUpcoming")?.textContent,
                listItemsCount: document.querySelectorAll(".appointment-card-item").length,
                firstDoctor: document.querySelector(".appointment-card-item h3")?.textContent
            })`
        });
        console.log('My Appointments State:', myState?.result?.value);
        myTab.ws.close();

        console.log('--- Verification complete ---');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        chrome.kill();
    }
}

main();
