const { pool } = require('./config/database');

async function migrate() {
    try {
        console.log('Starting migration...');
        
        // 1. Rename 'free' plan to 'basic'
        const [res1] = await pool.query("UPDATE users SET plan_type = 'basic' WHERE plan_type = 'free'");
        console.log(`✅ Updated ${res1.affectedRows} users from 'free' to 'basic'`);

        // 2. Set 10-day trial for any 'basic' user with no expiry
        const [res2] = await pool.query(`
            UPDATE users 
            SET subscription_expiry = DATE_ADD(created_at, INTERVAL 10 DAY) 
            WHERE plan_type = 'basic' AND subscription_expiry IS NULL AND role = 'admin'
        `);
        console.log(`✅ Set 10-day trial expiry for ${res2.affectedRows} basic users`);

        console.log('🚀 Migration completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
