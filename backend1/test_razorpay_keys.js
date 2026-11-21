const Razorpay = require('razorpay');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const key_id = process.env.RAZORPAY_KEY_ID?.trim();
const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();

console.log('--- Razorpay Key Test ---');
console.log('Key ID:', key_id ? `${key_id.substring(0, 8)}...` : 'MISSING');
console.log('Key Secret:', key_secret ? 'EXISTS' : 'MISSING');

if (!key_id || !key_secret) {
    console.error('❌ Keys are missing from .env');
    process.exit(1);
}

const razorpay = new Razorpay({
    key_id: key_id,
    key_secret: key_secret
});

async function test() {
    try {
        console.log('Testing connection to Razorpay...');
        // Try to fetch plans as a simple test of authentication
        const plans = await razorpay.plans.all({ count: 1 });
        console.log('✅ Success! Authentication verified.');
        console.log('Total plans found:', plans.count);
    } catch (error) {
        console.error('❌ Authentication FAILED');
        console.error('Error Code:', error.error?.code);
        console.error('Description:', error.error?.description);
        console.error('Full Error:', JSON.stringify(error, null, 2));
    }
}

test();
