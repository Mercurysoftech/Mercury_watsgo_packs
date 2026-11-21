const fetch = require('node-fetch'); // If available, or use native fetch in node 18+

async function test() {
    try {
        const res = await fetch('https://watsgo.in/packs/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@gmail.com', password: 'abc' }) // using wrong pass intentionally or let's use the one from screenshot... wait, screenshot doesn't show pw, but shows '123456' or similar? Let's just create a test user or see what the real error is.
        });
        console.log('Login status', res.status);
        const json = await res.json();
        console.log('Login response:', json);
    } catch (e) { console.error(e); }
}
test();
