const { pool } = require('./config/database');
async function checkMoorthi() {
    try {
        const [rows] = await pool.query("SELECT name, address, distance_km, delivery_charge FROM customers WHERE name LIKE '%MOORTHI%'");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkMoorthi();
