const { pool } = require('./config/database');

async function check() {
    try {
        const [phCols] = await pool.query('SHOW COLUMNS FROM payment_history');
        console.log('Columns in payment_history:', phCols.map(c => c.Field));
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        process.exit();
    }
}

check();
