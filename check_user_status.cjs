const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend1', '.env') });
const { pool } = require('./backend1/config/database');

async function checkUser() {
    try {
        console.log('--- DB Config Check ---');
        console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
        console.log('DB_USER:', process.env.DB_USER);
        
        const [users] = await pool.query('SELECT id, email, plan_type, subscription_status, subscription_expiry, razorpay_subscription_id, role FROM users WHERE email = ?', ['test@gmail.com']);
        
        if (users.length === 0) {
            console.log('User test@gmail.com not found in database.');
            return;
        }
        
        console.log('\n--- User Status ---');
        console.log(JSON.stringify(users[0], null, 2));

        const [history] = await pool.query('SELECT * FROM subscription_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [users[0].id]);
        console.log('\n--- Recent Subscription History ---');
        console.log(JSON.stringify(history, null, 2));

        const now = new Date();
        const expiry = users[0].subscription_expiry ? new Date(users[0].subscription_expiry) : null;
        const isActive = users[0].subscription_status === 'active' && 
                        (users[0].plan_type === 'free' || users[0].plan_type === 'trial' || (expiry && expiry > now));
        
        console.log('\n--- Decision Logic ---');
        console.log('Current Time:', now.toISOString());
        console.log('Expiry Date:', expiry ? expiry.toISOString() : 'NULL');
        console.log('Status in DB:', users[0].subscription_status);
        console.log('Is Calculated Active:', isActive);

    } catch (err) {
        console.error('\n❌ Script Error:', err.message);
    } finally {
        process.exit();
    }
}

checkUser();
