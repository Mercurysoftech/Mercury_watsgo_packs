const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function fixSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Connecting to database...');
        
        // 1. Check current schema of users table
        const [columns] = await connection.query("SHOW COLUMNS FROM users LIKE 'plan_type'");
        const column = columns[0];
        console.log(`Current plan_type column: ${column.Type}`);

        // 2. Add 'basic' to the ENUM if it's an ENUM
        if (column.Type.includes('enum')) {
            // Extract current values: enum('free','trial','starter','growth','pro','enterprise')
            let currentEnum = column.Type;
            if (!currentEnum.includes("'basic'")) {
                // Remove enum( and )
                let values = currentEnum.replace('enum(', '').replace(')', '');
                let newEnum = `enum('basic',${values})`;
                console.log(`Altering table to: ${newEnum}`);
                await connection.query(`ALTER TABLE users MODIFY COLUMN plan_type ${newEnum} DEFAULT 'basic'`);
                console.log('✅ Adjusted ENUM to include basic');
            }
        } else if (column.Type.startsWith('varchar')) {
             console.log('Column is varchar, no ENUM adjustment needed.');
        }

        // 3. Perform the migration
        const [res1] = await connection.query("UPDATE users SET plan_type = 'basic' WHERE plan_type = 'free'");
        console.log(`✅ Updated ${res1.affectedRows} users from 'free' to 'basic'`);

        const [res2] = await connection.query(`
            UPDATE users 
            SET subscription_expiry = DATE_ADD(created_at, INTERVAL 10 DAY) 
            WHERE plan_type = 'basic' 
            AND (subscription_expiry IS NULL OR subscription_expiry < '2000-01-01') 
            AND role = 'admin'
        `);
        console.log(`✅ Set 10-day trial expiry for ${res2.affectedRows} admin users`);

        console.log('🚀 Migration successful');

    } catch (err) {
        console.error('❌ Error:', err.message);
        if (err.message.includes('Data truncated')) {
            console.log('Detected truncation error. Attempting to force column to VARCHAR(50)');
            await connection.query("ALTER TABLE users MODIFY COLUMN plan_type VARCHAR(50) DEFAULT 'basic'");
            console.log('✅ Changed column to VARCHAR(50)');
            // Retry update
            await connection.query("UPDATE users SET plan_type = 'basic' WHERE plan_type = 'free'");
            console.log('✅ Updated users after column change');
        }
    } finally {
        await connection.end();
    }
}

fixSchema();
