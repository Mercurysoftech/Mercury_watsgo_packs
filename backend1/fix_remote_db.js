const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixSchema() {
    let connection;
    try {
        console.log('Attempting to connect to Remote Database (147.79.67.167)...');
        // Trying the remote IP derived from the user's error log
        connection = await mysql.createConnection({
            host: '147.79.67.167',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectTimeout: 10000
        });

        console.log('Connected to Remote DB. Checking schema...');

        // Check columns in customers table
        const [columns] = await connection.query('SHOW COLUMNS FROM customers');
        const existingColumns = columns.map(c => c.Field);

        // Add renewal_cycle if missing
        if (!existingColumns.includes('renewal_cycle')) {
            console.log('Adding renewal_cycle column...');
            await connection.query("ALTER TABLE customers ADD COLUMN renewal_cycle ENUM('weekly', 'monthly') DEFAULT 'monthly'");
            console.log('✅ renewal_cycle column added.');
        } else {
            console.log('✓ renewal_cycle column already exists.');
        }

        // Add pack_id if missing
        if (!existingColumns.includes('pack_id')) {
            console.log('Adding pack_id column...');
            await connection.query("ALTER TABLE customers ADD COLUMN pack_id INT");
            await connection.query("ALTER TABLE customers ADD FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE SET NULL");
            console.log('✅ pack_id column added.');
        } else {
            console.log('✓ pack_id column already exists.');
        }

        console.log('Database schema verification complete.');

    } catch (error) {
        console.error('❌ Error updating database:', error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.log('\n⚠️ Could not connect to the remote database from here.');
            console.log('This is likely due to firewall restrictions on the server.');
            console.log('You must DEPLOY the backend code to the server and restart it to apply the fixes.');
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('Connection closed.');
        }
    }
}

fixSchema();
