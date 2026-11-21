const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    console.log('🚀 Starting database setup...\n');

    // First, connect without database to create it
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    try {
        // Create database
        const dbName = process.env.DB_NAME || 'fresh_fruit_packs';
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        console.log(`✅ Database '${dbName}' created/verified`);

        // Use the database
        await connection.query(`USE ${dbName}`);

        // Create users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                role ENUM('admin', 'staff') DEFAULT 'staff',
                business_name VARCHAR(255),
                permissions TEXT,
                subscription_status ENUM('active', 'inactive') DEFAULT 'inactive',
                subscription_expiry DATETIME,
                plan_type ENUM('free', 'trial', 'starter', 'growth', 'pro', 'enterprise') DEFAULT 'free',
                razorpay_subscription_id VARCHAR(255),
                zone VARCHAR(255),
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table "users" created');

        // Create categories table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "categories" created');

        // Create packs table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS packs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                category_id INT NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                billing_cycle VARCHAR(20) DEFAULT 'monthly',
                billing_days INT DEFAULT NULL,
                fruits TEXT DEFAULT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "packs" created');

        // Create customers table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                mobile VARCHAR(20) NOT NULL,
                address TEXT,
                address2 TEXT,
                area VARCHAR(100),
                landmark VARCHAR(255),
                location TEXT,
                zone VARCHAR(255),
                subscription_start_date DATE NOT NULL,
                renewal_date DATE NOT NULL,
                status ENUM('renewed', 'pending', 'expired') DEFAULT 'pending',
                renewal_cycle VARCHAR(20) DEFAULT 'monthly',
                total_deliveries INT DEFAULT 0,
                pack_id INT,
                payment_status ENUM('unpaid', 'paid', 'partially_paid', 'overdue') DEFAULT 'unpaid',
                last_payment_date DATE,
                amount_paid DECIMAL(10, 2) DEFAULT 0,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Table "customers" created');

        // Create payment_history table (Simple payment records)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_history (
                id INT PRIMARY KEY AUTO_INCREMENT,
                customer_id INT NOT NULL,
                user_id INT NOT NULL,
                payment_status ENUM('paid', 'unpaid', 'pending') DEFAULT 'unpaid',
                payment_date DATE NOT NULL,
                renewal_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_customer_user (customer_id, user_id),
                INDEX idx_payment_date (payment_date)
            )
        `);
        console.log('✅ Table "payment_history" created (stores payment status, date, renewal date, user & customer)');

        // Create settings table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL UNIQUE,
                business_name VARCHAR(255),
                contact_email VARCHAR(255),
                contact_phone VARCHAR(20),
                address TEXT,
                sms_reminders BOOLEAN DEFAULT TRUE,
                email_notifications BOOLEAN DEFAULT TRUE,
                reminder_days_before INT DEFAULT 3,
                default_pack_price VARCHAR(50) DEFAULT '500',
                currency VARCHAR(10) DEFAULT 'INR',
                whatsapp_enabled BOOLEAN DEFAULT FALSE,
                whatsapp_api_key TEXT,
                whatsapp_phone_number_id VARCHAR(255),
                whatsapp_business_account_id VARCHAR(255),
                whatsapp_reminder_template TEXT,
                sms_reminder_template TEXT,
                sms_template_id VARCHAR(255),
                reminder_time TIME DEFAULT '09:00',
                upi_id VARCHAR(255),
                preferred_payment_method ENUM('razorpay', 'upi') DEFAULT 'upi',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "settings" created');

        // Create reminders table (for tracking sent reminders)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INT PRIMARY KEY AUTO_INCREMENT,
                customer_id INT NOT NULL,
                sent_via ENUM('sms', 'whatsapp', 'email') NOT NULL,
                message TEXT NOT NULL,
                status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
                sent_at TIMESTAMP NULL,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "reminders" created');

        // Create scheduled_reminders table (for automated reminders)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS scheduled_reminders (
                id INT PRIMARY KEY AUTO_INCREMENT,
                customer_id INT NOT NULL,
                scheduled_date DATETIME NOT NULL,
                sent BOOLEAN DEFAULT FALSE,
                sent_via ENUM('sms', 'whatsapp') DEFAULT 'sms',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "scheduled_reminders" created');

        // Create customer_attendance table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS customer_attendance (
                id INT PRIMARY KEY AUTO_INCREMENT,
                customer_id INT NOT NULL,
                user_id INT NOT NULL,
                attendance_date DATE NOT NULL,
                status ENUM('delivered', 'customer_pause', 'service_pause', 'holiday') NOT NULL DEFAULT 'delivered',
                note VARCHAR(500) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_customer_date (customer_id, attendance_date),
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await connection.query(`UPDATE users SET plan_type = 'free' WHERE plan_type IS NULL`);
        console.log('✅ Table "customer_attendance" created');

        // Create subscription_history table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS subscription_history (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                razorpay_subscription_id VARCHAR(255),
                razorpay_payment_id VARCHAR(255),
                plan_type VARCHAR(50) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'INR',
                status VARCHAR(50) NOT NULL,
                period_start DATETIME,
                period_end DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "subscription_history" created');

        // Create delivery_user table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS delivery_user (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                mobile VARCHAR(20) NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "delivery_user" created');

        // Insert default admin user (password: admin123)
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);

        await connection.query(`
            INSERT IGNORE INTO users (id, full_name, email, password, role, business_name)
            VALUES (1, 'Admin User', 'admin@freshfruitpacks.com', ?, 'admin', 'Fresh Fruit Packs')
        `, [hashedPassword]);
        console.log('✅ Default admin user created (email: admin@freshfruitpacks.com, password: admin123)');

        // Insert default settings for admin user
        await connection.query(`
            INSERT IGNORE INTO settings (
                user_id, business_name, contact_email, contact_phone, address,
                whatsapp_reminder_template
            ) VALUES (
                1, 
                'Fresh Fruit Packs', 
                'contact@freshfruitpacks.com', 
                '+91 98765 00000', 
                '123 Main Street, Bangalore, Karnataka 560001',
                'Hi {{customer_name}}, your monthly fruit pack subscription is due for renewal on {{renewal_date}}. Please renew to continue enjoying fresh fruits! - {{business_name}}'
            )
        `);
        console.log('✅ Default settings created');

        // Insert sample customers
        await connection.query(`
            INSERT IGNORE INTO customers (id, name, mobile, address, subscription_start_date, renewal_date, status, user_id)
            VALUES 
            (1, 'John Doe', '+91 98765 43210', '123 Main St, Delhi', '2026-01-15', '2026-02-15', 'renewed', 1),
            (2, 'Jane Smith', '+91 98765 43211', '456 Park Ave, Mumbai', '2026-01-20', '2026-02-20', 'pending', 1),
            (3, 'Bob Johnson', '+91 98765 43212', '789 Oak Rd, Bangalore', '2025-12-10', '2026-02-05', 'pending', 1)
        `);
        console.log('✅ Sample customers added');

        console.log('\n✨ Database setup completed successfully!');
        console.log('\n📝 Login credentials:');
        console.log('   Email: admin@freshfruitpacks.com');
        console.log('   Password: admin123\n');

    } catch (error) {
        console.error('❌ Error during setup:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

// Run setup
setupDatabase().catch(console.error);
