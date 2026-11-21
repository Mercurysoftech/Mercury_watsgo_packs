const mysql = require('mysql2/promise');
require('dotenv').config();

async function runSQL() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log("customers:");
        let [rows] = await connection.query("SHOW COLUMNS FROM customers");
        console.log(rows.map(r => r.Field).join(', '));
        
        console.log("customer_packs:");
        [rows] = await connection.query("SHOW COLUMNS FROM customer_packs");
        console.log(rows.map(r => r.Field).join(', '));
        
        console.log("packs:");
        [rows] = await connection.query("SHOW COLUMNS FROM packs");
        console.log(rows.map(r => r.Field).join(', '));
        
        console.log("customer_attendance:");
        [rows] = await connection.query("SHOW COLUMNS FROM customer_attendance");
        console.log(rows.map(r => r.Field).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

runSQL();
