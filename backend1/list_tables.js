const { pool } = require('./config/database');
async function listTables() {
    try {
        const [rows] = await pool.query('SHOW TABLES');
        console.log(JSON.stringify(rows.map(r => Object.values(r)[0]), null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
listTables();
