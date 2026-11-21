const { pool } = require('./config/database');

async function fixSchema() {
    try {
        console.log('Checking database schema...');

        const [columns] = await pool.query('SHOW COLUMNS FROM customers');
        const existingColumns = columns.map(c => c.Field);

        if (!existingColumns.includes('razorpay_plan_id')) {
            console.log('Adding razorpay_plan_id...');
            await pool.query('ALTER TABLE customers ADD COLUMN razorpay_plan_id VARCHAR(255) NULL');
        }
        if (!existingColumns.includes('razorpay_subscription_id')) {
            console.log('Adding razorpay_subscription_id...');
            await pool.query('ALTER TABLE customers ADD COLUMN razorpay_subscription_id VARCHAR(255) NULL');
        }
        if (!existingColumns.includes('autopay_status')) {
            console.log('Adding autopay_status...');
            await pool.query("ALTER TABLE customers ADD COLUMN autopay_status ENUM('inactive', 'active', 'cancelled', 'paused', 'pending') DEFAULT 'inactive'");
        }

        console.log('✅ Customers table updated for autopayment.');

    } catch (error) {
        console.error('❌ Error updating database:', error.message);
    } finally {
        process.exit();
    }
}

fixSchema();
