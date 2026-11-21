const { pool } = require('./config/database');

async function migrate() {
    try {
        console.log('Starting manual migration for payment_history...');
        const [phCols] = await pool.query('SHOW COLUMNS FROM payment_history');
        const phNames = phCols.map(c => c.Field);
        
        if (!phNames.includes('renewal_date')) {
            await pool.query('ALTER TABLE payment_history ADD COLUMN renewal_date DATE AFTER payment_date');
            console.log('✅ Added "renewal_date" column');
        } else {
            console.log('ℹ️ "renewal_date" already exists');
        }
        
        if (!phNames.includes('description')) {
            await pool.query('ALTER TABLE payment_history ADD COLUMN description TEXT AFTER renewal_date');
            console.log('✅ Added "description" column');
        } else {
            console.log('ℹ️ "description" already exists');
        }
        
        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        process.exit();
    }
}

migrate();
