const { pool } = require('./backend1/config/database');

async function checkUser() {
    try {
        const [users] = await pool.query('SELECT id, email, plan_type, subscription_status, subscription_expiry, razorpay_subscription_id FROM users WHERE email = ?', ['test@gmail.com']);
        if (users.length === 0) {
            console.log('User not found');
            return;
        }
        console.log('User Data:', JSON.stringify(users[0], null, 2));

        const [history] = await pool.query('SELECT * FROM subscription_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [users[0].id]);
        console.log('Recent Subscription History:', JSON.stringify(history, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkUser();
