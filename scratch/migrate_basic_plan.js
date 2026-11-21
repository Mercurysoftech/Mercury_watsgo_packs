import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend1 directory relative to the project root
dotenv.config({ path: path.resolve(__dirname, '../backend1/.env') });

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('Starting migration...');
        console.log(`Connecting to: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
        
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
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
