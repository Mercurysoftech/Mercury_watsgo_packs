const { pool } = require('./backend/config/database');

async function cleanDatabase() {
    try {
        console.log('🧹 Cleaning database for production/fresh start...');

        // 1. Delete all customers (this will also delete their reminders due to CASCADE)
        await pool.query('DELETE FROM customers');
        console.log('✅ All customers deleted.');

        // 2. Delete all users except potentially the system admin (ID 1)
        // If the user wants a truly fresh start, we can delete all.
        // But let's just delete everyone that isn't the primary admin or just everyone.
        // Actually, deleting everyone is safer if they want to register fresh.
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        await pool.query('TRUNCATE TABLE reminders');
        await pool.query('TRUNCATE TABLE customers');
        await pool.query('TRUNCATE TABLE settings');
        await pool.query('TRUNCATE TABLE users');
        await pool.query('TRUNCATE TABLE scheduled_reminders');
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✅ All tables truncated and reset.');
        console.log('✨ Database is now completely clean. Please register a new admin account.');

    } catch (error) {
        console.error('❌ Error cleaning database:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

cleanDatabase();
