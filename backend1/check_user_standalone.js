const mysql = require('mysql2/promise');
const fs = require('fs');
const dotenv = require('dotenv');

async function check() {
    const env = dotenv.parse(fs.readFileSync('backend1/.env'));
    const pool = mysql.createPool({
        host: env.DB_HOST || 'localhost',
        user: env.DB_USER || 'root',
        password: env.DB_PASSWORD || '',
        database: env.DB_NAME || 'fresh_fruit_packs'
    });

    try {
        const [users] = await pool.query('SELECT id, full_name, role, plan_type, subscription_expiry FROM users WHERE full_name LIKE "%karthi%"');
        console.log('Karthi users:', JSON.stringify(users));
        if (users.length > 0) {
            for (const u of users) {
                const [[countRow]] = await pool.query('SELECT COUNT(*) as cnt FROM customers WHERE user_id = ?', [u.id]);
                console.log(`Total customers for user ${u.id} (${u.full_name}): ${countRow.cnt}`);
            }
        } else {
            console.log('No karthi found');
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
    process.exit();
}
check();
