const express = require('express');
const http = require('http'); // Added for Socket.io support
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { testConnection } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const packRoutes = require('./routes/packRoutes');
const paymentHistoryRoutes = require('./routes/paymentHistoryRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const deliveryUserRoutes = require('./routes/deliveryUserRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { initSocket } = require('./socketManager'); // Added for Socket.io support

const app = express();
const server = http.createServer(app); // Created http server to wrap express app
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
const io = initSocket(server);
app.set("io", io); // Make io accessible via req.app.get('io')

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
const API_PREFIX = process.env.API_PREFIX || '/api';

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Fresh Fruit Packs API Server',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Add a specific health check for the prefix path
app.get(API_PREFIX, (req, res) => {
    res.json({
        success: true,
        message: `Fresh Fruit Packs API at ${API_PREFIX}`,
        status: 'Operational'
    });
});

// API Routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/customers`, customerRoutes);
app.use(`${API_PREFIX}/reminders`, reminderRoutes);
app.use(`${API_PREFIX}/settings`, settingsRoutes);
app.use(`${API_PREFIX}/subscription`, subscriptionRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/packs`, packRoutes);
app.use(`${API_PREFIX}/payment-history`, paymentHistoryRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/reports`, reportRoutes);
app.use(`${API_PREFIX}/delivery-user`, deliveryUserRoutes);
app.use(`${API_PREFIX}/reviews`, reviewRoutes);
app.use(`${API_PREFIX}/withdrawals`, withdrawalRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);

// Base route discovery for testing
app.get(`${API_PREFIX}/auth`, (req, res) => res.json({ status: 'Auth Module Ready' }));
app.get(`${API_PREFIX}/test-socket`, async (req, res) => {
    const { broadcastUpdate, getIo } = require('./socketManager');
    broadcastUpdate('subscription_update', { type: 'PLAN_PAUSED', customer_name: 'TEST CONNECTION' });
    
    let socketCount = 0;
    try {
        const io = getIo();
        const sockets = await io.fetchSockets();
        socketCount = sockets.length;
    } catch (e) {
        console.error(e);
    }
    
    res.json({ success: true, message: 'Test socket event broadcasted to ALL connected clients.', connectedClients: socketCount });
});
app.get(`${API_PREFIX}/customers`, (req, res) => res.json({ status: 'Customer Module Ready' }));
app.get(`${API_PREFIX}/reminders`, (req, res) => res.json({ status: 'Reminders Module Ready' }));
app.get(`${API_PREFIX}/settings`, (req, res) => res.json({ status: 'Settings Module Ready' }));
app.get(`${API_PREFIX}/subscription`, (req, res) => res.json({ status: 'Subscription Module Ready' }));
app.get(`${API_PREFIX}/categories`, (req, res) => res.json({ status: 'Categories Module Ready' }));
app.get(`${API_PREFIX}/packs`, (req, res) => res.json({ status: 'Packs Module Ready' }));
app.get(`${API_PREFIX}/payment-history`, (req, res) => res.json({ status: 'Payment History Module Ready' }));

// Custom UPI deep-link redirector
app.get(`${API_PREFIX}/pay`, (req, res) => {
    const { pa, pn, am } = req.query;
    if (!pa) return res.status(400).send("Invalid Request");
    const upiLink = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn || '')}&am=${am || 0}&cu=INR`;

    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Secure UPI Payment</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 40px 20px; background: #f9fafb; color: #1f2937; margin: 0; }
        .card { background: white; max-width: 400px; margin: 0 auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h2 { margin-top: 0; color: #10b981; }
        p { color: #6b7280; font-size: 16px; margin-bottom: 20px; }
        .btn { display: inline-block; padding: 16px 32px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; width: 100%; box-sizing: border-box; transition: background 0.2s; }
        .btn:hover { background: #059669; }
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid #10b981; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="card">
        <div class="loader"></div>
        <h2>Opening Payment App...</h2>
        <p>Redirecting you to GPay, PhonePe, or Paytm.</p>
        <p style="font-size: 14px; margin-bottom: 30px;">Amount: <strong>₹${am}</strong><br>To: <strong>${pn}</strong></p>
        <a href="${upiLink}" class="btn" id="payBtn">Select App to Pay</a>
    </div>
    <script>
        setTimeout(function() {
            window.location.href = "${upiLink}";
        }, 500);
    </script>
</body>
</html>`);
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
async function startServer() {
    try {
        // Test database connection
        const dbConnected = await testConnection();

        if (!dbConnected) {
            console.error('⚠️  Database connection failed. Please check your configuration.');
            console.log('💡 Run "npm run setup-db" to set up the database.');
        } else {
            // ---- Automatic Migrations ----
            const { pool } = require('./config/database');

            // 0. Email OTPs Table
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS email_otps (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        email VARCHAR(255) NOT NULL,
                        otp VARCHAR(6) NOT NULL,
                        purpose VARCHAR(50) DEFAULT 'register',
                        expires_at DATETIME NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('✅ Added "email_otps" table');
            } catch (err) {
                console.log('ℹ️  email_otps table migration skipped:', err.message);
            }

            // 1. Settings Table Updates
            try {
                const [settingsCols] = await pool.query('SHOW COLUMNS FROM settings');
                const settingsColNames = settingsCols.map(c => c.Field);

                if (!settingsColNames.includes('reminder_days_before')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN reminder_days_before VARCHAR(255) DEFAULT "3"');
                } else {
                    await pool.query('ALTER TABLE settings MODIFY COLUMN reminder_days_before VARCHAR(255) DEFAULT "3"');
                }

                if (!settingsColNames.includes('default_pack_price')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN default_pack_price VARCHAR(50) DEFAULT "999"');
                }
                if (!settingsColNames.includes('sms_reminder_template')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN sms_reminder_template TEXT');
                }
                if (!settingsColNames.includes('sms_template_id')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN sms_template_id VARCHAR(255)');
                }
                if (!settingsColNames.includes('reminder_time')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN reminder_time TIME DEFAULT "09:00"');
                }
                if (!settingsColNames.includes('razorpay_key_id')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN razorpay_key_id VARCHAR(255)');
                }
                if (!settingsColNames.includes('razorpay_key_secret')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN razorpay_key_secret VARCHAR(255)');
                }
                if (!settingsColNames.includes('whatsapp_enabled')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN whatsapp_enabled TINYINT(1) DEFAULT 0');
                }
                if (!settingsColNames.includes('whatsapp_api_key')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN whatsapp_api_key TEXT');
                }
                if (!settingsColNames.includes('whatsapp_phone_number_id')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN whatsapp_phone_number_id VARCHAR(255)');
                }
                if (!settingsColNames.includes('whatsapp_business_account_id')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN whatsapp_business_account_id VARCHAR(255)');
                }
                if (!settingsColNames.includes('whatsapp_reminder_template')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN whatsapp_reminder_template TEXT');
                }

                if (!settingsColNames.includes('upi_id')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN upi_id VARCHAR(255) DEFAULT NULL');
                    console.log('✅ Added "upi_id" column to settings table');
                }
                if (!settingsColNames.includes('preferred_payment_method')) {
                    await pool.query("ALTER TABLE settings ADD COLUMN preferred_payment_method ENUM('razorpay', 'upi') DEFAULT 'upi'");
                    console.log('✅ Added "preferred_payment_method" column to settings table');
                }
                if (!settingsColNames.includes('business_logo')) {
                    await pool.query("ALTER TABLE settings ADD COLUMN business_logo LONGTEXT DEFAULT NULL");
                    console.log('✅ Added "business_logo" column to settings table');
                }
                if (!settingsColNames.includes('delivery_charges')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN delivery_charges VARCHAR(50) DEFAULT "0"');
                    console.log('✅ Added "delivery_charges" column to settings table');
                }
                if (!settingsColNames.includes('delivery_free_km')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN delivery_free_km VARCHAR(50) DEFAULT "3"');
                    console.log('✅ Added "delivery_free_km" column to settings table');
                }
                if (!settingsColNames.includes('delivery_price_per_km')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN delivery_price_per_km VARCHAR(50) DEFAULT "0"');
                    console.log('✅ Added "delivery_price_per_km" column to settings table');
                }
                if (!settingsColNames.includes('google_maps_api_key')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN google_maps_api_key TEXT');
                    console.log('✅ Added "google_maps_api_key" column to settings table');
                }
                if (!settingsColNames.includes('privacy_policy')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN privacy_policy LONGTEXT');
                    console.log('✅ Added "privacy_policy" column to settings table');
                }
                if (!settingsColNames.includes('terms_conditions')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN terms_conditions LONGTEXT');
                    console.log('✅ Added "terms_conditions" column to settings table');
                }

                await pool.query(`UPDATE settings SET sms_reminder_template = 'Your Login Verification code: 1234 Don\\'t share this code with others -MERCURY' WHERE sms_reminder_template IS NULL OR sms_reminder_template = ''`);
                await pool.query(`UPDATE settings SET sms_template_id = '1607100000000339284' WHERE sms_template_id IS NULL OR sms_template_id = ''`);

                // 2. Plan-Specific WhatsApp Template Migrations
                // Free Plan - Plain Text
                const freeTemplate = 'Hi {{customer_name}}, your monthly fruit pack subscription is due for renewal on {{renewal_date}}. Please complete your payment using the link below:\n{{payment_info}}\nRenew now to continue enjoying fresh fruits.\n– {{business_name}}';
                await pool.query(`UPDATE settings s JOIN users u ON s.user_id = u.id SET s.whatsapp_reminder_template = ? WHERE (s.whatsapp_reminder_template LIKE '%renew to continue enjoying fresh fruits! -%' OR s.whatsapp_reminder_template IS NULL OR s.whatsapp_reminder_template = '') AND u.plan_type = 'free'`, [freeTemplate]);

                // Pro / Enterprise - JSON Template Structure
                const premiumTemplate = JSON.stringify({
                    type: "template",
                    template: {
                        name: "remi_new",
                        language: { code: "en_US" },
                        components: [
                            {
                                type: "body",
                                parameters: [
                                    { type: "text", text: "{{customer_name}}" },
                                    { type: "text", text: "{{pack_price}}" },
                                    { type: "text", text: "{{pack_name}}" },
                                    { type: "text", text: "{{payment_url}}" },
                                    { type: "text", text: "{{business_name}}" },
                                    { type: "text", text: "{{renewal_date}}" }
                                ]
                            }
                        ]
                    }
                }, null, 2);

                // Update Pro/Enterprise users who still have the old text template or are empty
                await pool.query(`UPDATE settings s JOIN users u ON s.user_id = u.id SET s.whatsapp_reminder_template = ? WHERE (s.whatsapp_reminder_template LIKE '%monthly fruit pack subscription is due%' OR s.whatsapp_reminder_template IS NULL OR s.whatsapp_reminder_template = '') AND u.plan_type IN ('trial', 'pro', 'enterprise')`, [premiumTemplate]);

            } catch (err) {
                console.log('ℹ️  Settings migrations skipped or already applied:', err.message);
            }

            // 2. Scheduled Reminders Updates
            try {
                await pool.query('ALTER TABLE scheduled_reminders MODIFY COLUMN scheduled_date DATETIME NOT NULL');
                const [srCols] = await pool.query('SHOW COLUMNS FROM scheduled_reminders');
                const srColNames = srCols.map(c => c.Field);
                if (!srColNames.includes('sent_via')) {
                    await pool.query('ALTER TABLE scheduled_reminders ADD COLUMN sent_via ENUM("sms", "whatsapp") DEFAULT "sms"');
                }
            } catch (err) {
                console.log('ℹ️  Scheduled reminders migrations skipped or already applied');
            }

            // 3. User Table Updates
            try {
                const [userCols] = await pool.query('SHOW COLUMNS FROM users');
                const userNames = userCols.map(c => c.Field);
                if (!userNames.includes('subscription_status')) {
                    await pool.query("ALTER TABLE users ADD COLUMN subscription_status ENUM('active', 'inactive') DEFAULT 'inactive'");
                }
                if (!userNames.includes('subscription_expiry')) {
                    await pool.query('ALTER TABLE users ADD COLUMN subscription_expiry DATETIME');
                }
                if (!userNames.includes('plan_type')) {
                    await pool.query("ALTER TABLE users ADD COLUMN plan_type ENUM('free', 'trial', 'starter', 'growth', 'pro', 'enterprise') DEFAULT 'free'");
                    console.log('✅ Added plan_type column to users table');
                } else {
                    // Safety: Force trial and new plans into the enum even if column already exists
                    try {
                        await pool.query("ALTER TABLE users MODIFY COLUMN plan_type ENUM('free', 'trial', 'starter', 'growth', 'pro', 'enterprise') DEFAULT 'free'");
                        console.log('✅ Corrected plan_type ENUM to include trial, starter, and growth');
                    } catch (e) {
                        console.error('⚠️ Could not modify plan_type ENUM:', e.message);
                    }
                }
                if (!userNames.includes('razorpay_subscription_id')) {
                    await pool.query('ALTER TABLE users ADD COLUMN razorpay_subscription_id VARCHAR(255)');
                }
            } catch (err) {
                console.log('ℹ️  User table migrations skipped');
            }

            // 3.5 Settings Table Migrations
            try {
                const [setCols] = await pool.query('SHOW COLUMNS FROM settings');
                const setNames = setCols.map(c => c.Field);
                if (!setNames.includes('delivery_charges')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN delivery_charges DECIMAL(10,2) DEFAULT 0');
                    console.log('✅ Added "delivery_charges" to settings');
                }
                if (!setNames.includes('delivery_free_km')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN delivery_free_km DECIMAL(10,2) DEFAULT 3');
                    console.log('✅ Added "delivery_free_km" to settings');
                }
                if (!setNames.includes('delivery_price_per_km')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN delivery_price_per_km DECIMAL(10,2) DEFAULT 0');
                    console.log('✅ Added "delivery_price_per_km" to settings');
                }
                if (!setNames.includes('google_maps_api_key')) {
                    await pool.query('ALTER TABLE settings ADD COLUMN google_maps_api_key VARCHAR(255) DEFAULT NULL');
                    console.log('✅ Added "google_maps_api_key" to settings');
                }
            } catch (err) {
                console.log('ℹ️  Settings table migrations skipped:', err.message);
            }

            // 4. Categories & Packs (The fix for fruits column)
            try {
                // Ensure categories exists
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS categories (
                        id INT PRIMARY KEY AUTO_INCREMENT,
                        name VARCHAR(255) NOT NULL,
                        user_id INT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);

                // Create or update packs table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS packs (
                        id INT PRIMARY KEY AUTO_INCREMENT,
                        name VARCHAR(255) NOT NULL,
                        category_id INT NOT NULL,
                        price DECIMAL(10, 2) NOT NULL,
                        billing_cycle ENUM('daily', 'weekly', 'monthly') DEFAULT 'monthly',
                        pack_type ENUM('fruits', 'food') DEFAULT 'fruits',
                        fruits TEXT DEFAULT NULL,
                        user_id INT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);

                const [packCols] = await pool.query('SHOW COLUMNS FROM packs');
                const packNames = packCols.map(c => c.Field);

                // Add fruits if table existed without it
                if (!packNames.includes('fruits')) {
                    await pool.query("ALTER TABLE packs ADD COLUMN fruits TEXT DEFAULT NULL AFTER billing_cycle");
                    console.log('✅ Added "fruits" column to packs table');
                }

                // Add/modify pack_type for dairy support
                if (!packNames.includes('pack_type')) {
                    await pool.query("ALTER TABLE packs ADD COLUMN pack_type ENUM('fruits', 'food', 'dairy') DEFAULT 'fruits' AFTER billing_cycle");
                    console.log('✅ Added "pack_type" column to packs table');
                } else {
                    try {
                        await pool.query("ALTER TABLE packs MODIFY COLUMN pack_type ENUM('fruits', 'food', 'dairy') DEFAULT 'fruits'");
                    } catch(e) {}
                }

                if (!packNames.includes('unit_type')) {
                    await pool.query("ALTER TABLE packs ADD COLUMN unit_type ENUM('litres', 'ml', 'grams', 'packets', 'pack') DEFAULT 'litres'");
                }
                if (!packNames.includes('unit_volume')) {
                    await pool.query("ALTER TABLE packs ADD COLUMN unit_volume DECIMAL(8,2) DEFAULT 1.00");
                }
                if (!packNames.includes('delivery_shift')) {
                    await pool.query("ALTER TABLE packs ADD COLUMN delivery_shift ENUM('morning', 'evening', 'both') DEFAULT 'morning'");
                }

                // Update billing_cycle enum to include 'daily'
                await pool.query("ALTER TABLE packs MODIFY COLUMN billing_cycle VARCHAR(20) DEFAULT 'monthly'");
            } catch (err) {
                console.error('❌ Categories/Packs migration failed:', err.message);
            }

            // 5. Customer Table Updates
            try {
                const [custCols] = await pool.query('SHOW COLUMNS FROM customers');
                const custNames = custCols.map(c => c.Field);
                if (!custNames.includes('pack_id')) {
                    await pool.query("ALTER TABLE customers ADD COLUMN pack_id INT");
                    await pool.query("ALTER TABLE customers ADD FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE SET NULL");
                }
                if (!custNames.includes('renewal_cycle')) {
                    await pool.query("ALTER TABLE customers ADD COLUMN renewal_cycle VARCHAR(20) DEFAULT 'monthly'");
                }
                if (!custNames.includes('total_deliveries')) {
                    await pool.query("ALTER TABLE customers ADD COLUMN total_deliveries INT DEFAULT 0");
                }
                if (!custNames.includes('distance_km')) {
                    await pool.query("ALTER TABLE customers ADD COLUMN distance_km DECIMAL(10,2) DEFAULT 0");
                }
                if (!custNames.includes('delivery_charge')) {
                    await pool.query("ALTER TABLE customers ADD COLUMN delivery_charge DECIMAL(10,2) DEFAULT 0");
                }
                if (!custNames.includes('extra_fields')) {
                    await pool.query("ALTER TABLE customers ADD COLUMN extra_fields LONGTEXT DEFAULT NULL");
                    console.log('✅ Added "extra_fields" column to customers table');
                }
            } catch (err) {
                console.log('ℹ️  Customer table migrations skipped');
            }

            // 6. Customer Attendance Table
            try {
                await pool.query(`
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
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);

                // Migration: Per-pack attendance tracking support
                const [allIdx] = await pool.query('SHOW INDEX FROM customer_attendance');
                const hasMultiPackMealIdx = allIdx.some(idx => idx.Key_name === 'unique_customer_pack_date_meal');

                if (!hasMultiPackMealIdx) {
                    console.log('🔄 Cleaning up and updating customer_attendance unique index for multi-meal support...');
                    try {
                        // Cleanup duplicates before creating index
                        await pool.query(`
                            DELETE ca1 FROM customer_attendance ca1
                            INNER JOIN customer_attendance ca2 
                            WHERE ca1.id < ca2.id 
                            AND ca1.customer_id = ca2.customer_id 
                            AND ca1.pack_id = ca2.pack_id 
                            AND ca1.attendance_date = ca2.attendance_date
                            AND ca1.meal_type = ca2.meal_type
                        `);

                        // Drop any index that doesn't have meal_type
                        const idxNames = [...new Set(allIdx
                            .filter(i => i.Non_unique === 0 && i.Key_name !== 'PRIMARY')
                            .map(i => i.Key_name))];

                        for (const name of idxNames) {
                            if (name === 'unique_customer_pack_date_meal') continue;
                            await pool.query(`ALTER TABLE customer_attendance DROP INDEX ${name}`).catch(() => { });
                        }

                        await pool.query("UPDATE customer_attendance SET meal_type = 'none' WHERE meal_type IS NULL OR meal_type = ''");
                        await pool.query("ALTER TABLE customer_attendance MODIFY COLUMN meal_type VARCHAR(100) NOT NULL DEFAULT 'none'");
                        await pool.query('ALTER TABLE customer_attendance ADD UNIQUE KEY unique_customer_pack_date_meal (customer_id, pack_id, attendance_date, meal_type)');
                        console.log('✅ Ported customer_attendance to multi-meal support with solid indexing');
                    } catch (e) {
                        console.error('❌ Failed to update attendance index:', e.message);
                    }
                }
            } catch (err) {
                console.log('ℹ️  Attendance migration error:', err.message);
            }

            // 7. Payment History - Add 'amount' column if missing
            try {
                const [phCols] = await pool.query('SHOW COLUMNS FROM payment_history');
                const phNames = phCols.map(c => c.Field);
                if (!phNames.includes('amount')) {
                    await pool.query('ALTER TABLE payment_history ADD COLUMN amount DECIMAL(10,2) DEFAULT 0 AFTER user_id');
                    console.log('✅ Added "amount" column to payment_history table');
                }
                if (!phNames.includes('user_id')) {
                    await pool.query('ALTER TABLE payment_history ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER customer_id');
                    console.log('✅ Added "user_id" column to payment_history table');
                }
                if (!phNames.includes('delivery_charge')) {
                    await pool.query('ALTER TABLE payment_history ADD COLUMN delivery_charge DECIMAL(10,2) DEFAULT 0 AFTER amount');
                    console.log('✅ Added "delivery_charge" column to payment_history table');
                }
                if (!phNames.includes('distance_km')) {
                    await pool.query('ALTER TABLE payment_history ADD COLUMN distance_km DECIMAL(10,2) DEFAULT 0 AFTER delivery_charge');
                    console.log('✅ Added "distance_km" column to payment_history table');
                }
                if (!phNames.includes('renewal_date')) {
                    await pool.query('ALTER TABLE payment_history ADD COLUMN renewal_date DATE AFTER payment_date');
                    console.log('✅ Added "renewal_date" column to payment_history table');
                }
                if (!phNames.includes('description')) {
                    await pool.query('ALTER TABLE payment_history ADD COLUMN description TEXT AFTER renewal_date');
                    console.log('✅ Added "description" column to payment_history table');
                }
            } catch (err) {
                console.log('ℹ️  Payment history migration skipped:', err.message);
            }

            // 8. Subscription History - Add unique index for duplicate key update
            try {
                await pool.query(`
                    ALTER TABLE subscription_history 
                    ADD UNIQUE IF NOT EXISTS unique_payment (razorpay_subscription_id, razorpay_payment_id)
                `).catch(err => {
                    // Ignore if IF NOT EXISTS doesn't work or index exists
                    console.log('ℹ️  Subscription history index already exists');
                });
            } catch (err) {
                console.log('ℹ️  Subscription index migration skipped:', err.message);
            }

            // 9. Delivery User Table
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS delivery_user (
                        id INT PRIMARY KEY AUTO_INCREMENT,
                        name VARCHAR(255) NOT NULL,
                        mobile VARCHAR(20) NOT NULL,
                        user_id INT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);
                console.log('✅ Delivery User table checked');
            } catch (err) {
                console.log('ℹ️  Delivery user table migration skipped:', err.message);
            }

            // 10. Subscription Plans Table
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS subscription_plans (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        plan_type VARCHAR(50) NOT NULL,
                        name VARCHAR(100) NOT NULL,
                        billing_period VARCHAR(20) NOT NULL,
                        price DECIMAL(10, 2) NOT NULL,
                        customers VARCHAR(100),
                        features JSON,
                        popular TINYINT(1) DEFAULT 0,
                        monthly_equivalent DECIMAL(10, 2),
                        razorpay_plan_id VARCHAR(255) DEFAULT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY (plan_type, billing_period)
                    )
                `);
                console.log('✅ subscription_plans table checked/created');

                const [planExists] = await pool.query('SELECT id FROM subscription_plans LIMIT 1');
                if (planExists.length === 0) {
                    const seedPlans = [
                        // Basic
                        ['basic', 'Basic Plan', 'monthly', 149, '25 Customers', ['Up to 25 customers', 'Basic fruit pack', 'Manual attendance', 'Basic dashboard', '1 staff member', '1 zone', '10 Days Trial Available'], 0, null],
                        ['basic', 'Basic Plan', '3months', 447, '25 Customers', ['Up to 25 customers', 'Basic features'], 0, 149],
                        ['basic', 'Basic Plan', '6months', 894, '25 Customers', ['Up to 25 customers', 'Basic features'], 0, 149],
                        ['basic', 'Basic Plan', 'yearly', 1490, '25 Customers', ['Up to 25 customers', 'Basic fruit pack', 'Manual attendance', 'Basic dashboard', '1 staff member', '1 zone', '10 Days Trial Available'], 0, 124],

                        // Starter
                        ['starter', 'Starter Plan', 'monthly', 699, '100 Customers', ['Up to 100 customers', 'Fruit pack system', 'Inventory basic', 'Manual delivery tracking', 'WhatsApp manual send', 'UPI Payment tracking', '5 Zone Available', '5 staff', 'Reports & analytics'], 0, null],
                        ['starter', 'Starter Plan', '3months', 1899, '100 Customers', ['Up to 100 customers', 'Fruit pack system', 'Save ₹198'], 0, 633],
                        ['starter', 'Starter Plan', '6months', 3499, '100 Customers', ['Up to 100 customers', 'Fruit pack system', 'Save ₹694'], 0, 583],
                        ['starter', 'Starter Plan', 'yearly', 6999, '100 Customers', ['Up to 100 customers', 'Fruit pack system', 'Inventory basic', 'Manual delivery tracking', 'WhatsApp manual send', 'UPI Payment tracking', '5 Zone Available', '5 staff', 'Reports & analytics', 'Save ₹1,389 🔥'], 0, 583],

                        // Growth
                        ['growth', 'Growth Plan', 'monthly', 2499, '300 Customers', ['Up to 300 customers', 'Daily customization 🔥', 'Full fruit pack system', 'WhatsApp automation 🔥', 'Payment link + reminders', 'Delivery boy management', 'Area-wise split', 'Add delivery charges', 'Auto pay request', '10 staff, 10 delivery boys', 'Reports & analytics'], 1, null],
                        ['growth', 'Growth Plan', '3months', 6999, '300 Customers', ['Up to 300 customers', 'Daily customization 🔥', 'Full fruit pack system', 'WhatsApp automation 🔥', 'Payment link + reminders', 'Delivery boy management', 'Area-wise split', 'Add delivery charges', 'Auto pay request', '10 staff, 10 delivery boys', 'Reports & analytics'], 1, 2333],
                        ['growth', 'Growth Plan', '6months', 13999, '300 Customers', ['Up to 300 customers', 'Daily customization 🔥', 'Full fruit pack system', 'WhatsApp automation 🔥', 'Payment link + reminders', 'Delivery boy management', 'Area-wise split', 'Add delivery charges', 'Auto pay request', '10 staff, 10 delivery boys', 'Reports & analytics'], 1, 2333],
                        ['growth', 'Growth Plan', 'yearly', 24999, '300 Customers', ['Up to 300 customers', 'Daily customization 🔥', 'Full fruit pack system', 'WhatsApp automation 🔥', 'Payment link + reminders', 'Delivery boy management', 'Area-wise split', 'Add delivery charges', 'Auto pay request', '10 staff, 10 delivery boys', 'Reports & analytics'], 1, 2083],

                        // Pro
                        ['pro', 'Pro Plan', 'monthly', 4999, 'Unlimited', ['Unlimited customers', 'Full automation system 🔥', 'Advanced WhatsApp bot 🔥', 'Auto reminders + auto follow-ups', 'Route optimization 🔥', 'Delivery app & Customer app', 'Staff management (unlimited)', 'Reports & analytics', 'WhatsApp Catalog integration', 'Priority Support'], 0, null],
                        ['pro', 'Pro Plan', '3months', 13999, 'Unlimited', ['Unlimited customers', 'Full automation system 🔥', 'Advanced WhatsApp bot 🔥', 'Auto reminders + auto follow-ups', 'Route optimization 🔥', 'Delivery app & Customer app', 'Staff management (unlimited)', 'Reports & analytics', 'WhatsApp Catalog integration', 'Priority Support'], 0, 4666],
                        ['pro', 'Pro Plan', '6months', 27999, 'Unlimited', ['Unlimited customers', 'Full automation system 🔥', 'Advanced WhatsApp bot 🔥', 'Auto reminders + auto follow-ups', 'Route optimization 🔥', 'Delivery app & Customer app', 'Staff management (unlimited)', 'Reports & analytics', 'WhatsApp Catalog integration', 'Priority Support'], 0, 4666],
                        ['pro', 'Pro Plan', 'yearly', 49999, 'Unlimited', ['Unlimited customers', 'Full automation system 🔥', 'Advanced WhatsApp bot 🔥', 'Auto reminders + auto follow-ups', 'Route optimization 🔥', 'Delivery app & Customer app', 'Staff management (unlimited)', 'Reports & analytics', 'WhatsApp Catalog integration', 'Priority Support'], 0, 4166]
                    ];

                    for (const p of seedPlans) {
                        await pool.query(
                            'INSERT INTO subscription_plans (plan_type, name, billing_period, price, customers, features, popular, monthly_equivalent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [p[0], p[1], p[2], p[3], p[4], JSON.stringify(p[5]), p[6], p[7]]
                        );
                    }
                    console.log(`✅ Seeded ${seedPlans.length} plans into subscription_plans table`);
                }
            } catch (err) {
                console.log('ℹ️  Subscription plans table setup info:', err.message);
            }

            console.log('✅ Database migrations checked successfully');

        }

        server.listen(PORT, () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 Fresh Fruit Packs Admin API Server');
            console.log('='.repeat(60));
            console.log(`📡 Server running on: http://localhost:${PORT}`);
            console.log(`📡 Socket.io: Enabled ✅`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💬 WhatsApp API: ${process.env.WHATSAPP_API_KEY ? 'Enabled ✅' : 'Disabled ❌'}`);
            console.log('='.repeat(60) + '\n');
        });

        // Start cron scheduler
        require('./services/cronScheduler');

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
