const cron = require('node-cron');
const { pool } = require('../config/database');
const { sendWhatsApp } = require('./messagingService');
const { getPaymentLink, prepareMessage } = require('./messageHelper');
const { calculateCustomerTotal } = require('./billingHelper');
const { triggerSingleReminder } = require('../controllers/notificationController');

// Helper to ensure dates are in YYYY-MM-DD format for MySQL (timezone-safe local date)
const formatDate = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
        return dateVal.split('T')[0];
    }
    if (dateVal instanceof Date) {
        const yyyy = dateVal.getFullYear();
        const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
        const dd = String(dateVal.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return dateVal;
};

// Production-grade Timezone Helper using native IANA Intl API
const getTimeAndDateInTimezone = (timezone = 'Asia/Kolkata') => {
    try {
        const now = new Date();
        const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return {
            currentTime: timeFormatter.format(now), // "HH:mm" e.g. "18:34"
            currentDate: dateFormatter.format(now)  // "YYYY-MM-DD" e.g. "2026-08-29"
        };
    } catch (e) {
        // Fallback to Asia/Kolkata if invalid timezone is passed
        const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return {
            currentTime: timeFormatter.format(new Date()),
            currentDate: dateFormatter.format(new Date())
        };
    }
};

console.log('📅 Cron Scheduler initialized with IANA Timezone Support');

// Process automated reminders (runs every minute to check settings for each business)
cron.schedule('* * * * *', async () => {
    try {
        // 1. Fetch active businesses and their settings
        const [businesses] = await pool.query(`
            SELECT 
                s.*,
                u.id as owner_id
            FROM settings s
            JOIN users u ON s.user_id = u.id
            WHERE u.subscription_status = 'active' 
            AND (u.subscription_expiry IS NULL OR u.subscription_expiry > NOW())
        `);

        if (businesses.length === 0) return;

        for (const setting of businesses) {
            const userTimezone = setting.timezone || 'Asia/Kolkata';
            const { currentTime, currentDate } = getTimeAndDateInTimezone(userTimezone);

            // Format reminder time to "HH:mm" (e.g., "18:34")
            const targetReminderTime = String(setting.reminder_time || '09:00').slice(0, 5);

            // Only proceed if current time in business's timezone matches the scheduled reminder_time
            if (currentTime !== targetReminderTime) {
                continue;
            }

            console.log(`\n⏰ [Cron] Triggering reminders at ${currentTime} (${userTimezone}) for business: ${setting.business_name || setting.user_id}`);

            // Fetch active customers for this business
            const [customers] = await pool.query(`
                SELECT 
                    c.*,
                    p.name as pack_name,
                    p.price as pack_price
                FROM customers c
                LEFT JOIN packs p ON c.pack_id = p.id
                WHERE c.user_id = ?
                AND c.status IN ('renewed', 'pending', 'expired')
            `, [setting.user_id]);

            if (customers.length === 0) continue;

            for (const customer of customers) {
                // 1. Prevent duplicate sends on the same day in their timezone
                const [existing] = await pool.query(`
                    SELECT id FROM reminders 
                    WHERE customer_id = ? 
                    AND DATE(created_at) = ?
                    AND status = 'sent'
                `, [customer.id, currentDate]);

                if (existing.length > 0) {
                    // Already sent today
                    continue;
                }

                // 2. Check if today is a "Reminder Day" (e.g., 0, 1, 3, 7 days before)
                const daysToRemind = (setting.reminder_days_before || "3")
                    .toString()
                    .split(',')
                    .filter(Boolean)
                    .map(d => parseInt(d.trim()));

                // FETCH ALL PACKS (From customer_packs table, with fallback to main customer pack)
                // Separated queries to prevent MySQL 'Illegal mix of collations for operation UNION'
                const [subPacks] = await pool.query(`
                    SELECT cp.pack_id as pack_id_mock, cp.renewal_date, p.name as pack_name, p.price as pack_price, cp.quantity, cp.renewal_cycle, cp.total_deliveries
                    FROM customer_packs cp
                    JOIN packs p ON cp.pack_id = p.id
                    WHERE cp.customer_id = ? AND cp.status IN ('renewed', 'pending', 'expired') AND cp.renewal_date IS NOT NULL
                `, [customer.id]);

                let allPacks = [];
                if (subPacks && subPacks.length > 0) {
                    allPacks = subPacks;
                } else if (customer.pack_id && customer.pack_name && customer.renewal_date) {
                    allPacks = [{
                        pack_id_mock: customer.pack_id,
                        renewal_date: customer.renewal_date,
                        pack_name: customer.pack_name,
                        pack_price: customer.pack_price,
                        quantity: customer.quantity || 1,
                        renewal_cycle: customer.renewal_cycle,
                        total_deliveries: customer.total_deliveries
                    }];
                }

                // Filter packs that actually MATCH the daysToRemind
                const matchedPacks = [];
                const seenPackKeys = new Set();

                for (const pack of allPacks) {
                    const renewalDate = new Date(pack.renewal_date);
                    renewalDate.setHours(0, 0, 0, 0);

                    const compareDate = new Date(currentDate + 'T00:00:00'); 
                    compareDate.setHours(0, 0, 0, 0);

                    const diffTime = renewalDate.getTime() - compareDate.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (!pack.pack_name) continue;

                    if (daysToRemind.includes(diffDays)) {
                        const d = new Date(pack.renewal_date);
                        const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                        const key = String(pack.pack_name) + "_" + dStr;
                        if (!seenPackKeys.has(key)) {
                            seenPackKeys.add(key);
                            matchedPacks.push({
                                name: pack.pack_name,
                                price: pack.pack_price,
                                quantity: pack.quantity,
                                renewal_date: pack.renewal_date,
                                renewal_cycle: pack.renewal_cycle,
                                total_deliveries: pack.total_deliveries
                            });
                        }
                    }
                }

                if (matchedPacks.length === 0) {
                    continue;
                }

                console.log(`🎯 Auto-Match: Found ${matchedPacks.length} packs due for reminder for ${customer.name}.`);

                // Send via preferred channels
                if (setting.whatsapp_enabled) {
                    const billing = calculateCustomerTotal(matchedPacks, customer, setting);
                    const totalWithDelivery = billing.grandTotal;

                    const paymentUrl = await getPaymentLink(customer, setting, totalWithDelivery, matchedPacks); 
                    const msg = prepareMessage(customer, setting, paymentUrl, matchedPacks, totalWithDelivery);

                    const result = await sendWhatsApp(
                        customer.mobile,
                        msg,
                        setting.whatsapp_api_key,
                        setting.whatsapp_phone_number_id
                    );
                    await logReminder(customer.id, 'whatsapp', msg, result.success ? 'sent' : 'failed', result.error);
                    if (result.success) {
                        console.log(`✅ Auto-WhatsApp sent to ${customer.name}`);
                        try {
                            await triggerSingleReminder({
                                body: {
                                    customerId: customer.id,
                                    title: 'Subscription Auto-Renewal 🔔',
                                    message: `Hi ${customer.name}, your packs are due for renewal! Check the app for details.`
                                }
                            }, { json: () => { }, status: () => ({ json: () => { } }) });
                        } catch (e) { console.error('Auto Push Error:', e.message); }
                    }
                }
            }
        }
    } catch (err) {
        console.error('❌ Cron Scheduler Error:', err);
    }
});

// Helper function to log reminders
async function logReminder(customerId, sentVia, message, status, errorMessage) {
    try {
        await pool.query(
            `INSERT INTO reminders (customer_id, sent_via, message, status, sent_at, error_message)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                customerId,
                sentVia,
                message,
                status,
                status === 'sent' ? new Date() : null,
                errorMessage
            ]
        );
    } catch (error) {
        console.error('Error logging reminder:', error);
    }
}

// Extracting logic into a function so we can run it on startup and more frequently
async function checkExpiredSubscriptions() {
    console.log('\n🔍 Checking for expired subscriptions...');
    try {
        const [result] = await pool.query(`
            UPDATE customers 
            SET status = 'expired'
            WHERE renewal_date < CURDATE() 
            AND status = 'pending'
        `);

        const [packResult] = await pool.query(`
            UPDATE customer_packs 
            SET status = 'expired'
            WHERE renewal_date < CURDATE() 
            AND status IN ('active', 'pending')
        `);

        if (result.affectedRows > 0 || packResult.affectedRows > 0) {
            console.log(`⚠️ Marked ${result.affectedRows} customers and ${packResult.affectedRows} packs as expired\n`);
        } else {
            console.log('✅ No expired subscriptions found\n');
        }

    } catch (error) {
        console.error('❌ Error checking expired subscriptions:', error);
    }
}

// Check for overdue subscriptions and mark as expired (runs every hour)
cron.schedule('0 * * * *', checkExpiredSubscriptions);

async function autoRollSubscriptions() {
    console.log('\n🔄 Auto-rolling subscriptions...');

    try {
        const [customersToRoll] = await pool.query(`
            SELECT id, renewal_date, renewal_cycle, total_deliveries, status, payment_status 
            FROM customers 
            WHERE renewal_date < CURDATE()
        `);

        if (customersToRoll.length === 0) {
            console.log('✅ No subscriptions to auto-roll today\n');
            return;
        }

        const addDeliveriesExcludeSundays = (startDate, deliveries) => {
            let date = startDate ? new Date(startDate) : new Date();
            if (isNaN(date.getTime())) date = new Date(); // fallback
            let remaining = deliveries;
            while (remaining > 0) {
                date.setDate(date.getDate() + 1);
                if (date.getDay() !== 0) {
                    remaining--;
                }
            }
            return formatDate(date);
        };

        let successCount = 0;
        const todayStr = formatDate(new Date());

        for (const customer of customersToRoll) {
            const deliveries = customer.total_deliveries || (customer.renewal_cycle === 'weekly' ? 6 : 24);

            // start calculation from old renewal date
            let currentStart = formatDate(new Date(customer.renewal_date));
            let currentRenewal = addDeliveriesExcludeSundays(currentStart, deliveries);

            // Catch up if they are multiple cycles behind
            while (currentRenewal < todayStr) {
                currentStart = currentRenewal;
                currentRenewal = addDeliveriesExcludeSundays(currentStart, deliveries);
            }

            await pool.query(`
                UPDATE customers 
                SET subscription_start_date = ?,
                    renewal_date = ?,
                    status = 'pending',
                    payment_status = 'unpaid'
                WHERE id = ?
            `, [currentStart, currentRenewal, customer.id]);

            successCount++;
        }

        console.log(`✅ Auto-rolled ${successCount} subscriptions to the next cycle\n`);
    } catch (error) {
        console.error('❌ Error auto-rolling subscriptions:', error);
    }
}

// Auto-rollover subscriptions that were renewed (runs every hour at minute 5)
cron.schedule('5 * * * *', autoRollSubscriptions);

// Also run these checks on server startup
setTimeout(() => {
    checkExpiredSubscriptions();
    autoRollSubscriptions();
}, 5000); // 5 seconds after boot

// Process manually scheduled bulk reminders (runs every minute)
cron.schedule('* * * * *', async () => {
    try {
        // Fetch all unsent scheduled reminders
        const [scheduled] = await pool.query(`
            SELECT sr.id as scheduled_id, sr.customer_id as scheduled_customer_id, 
                   sr.pack_id as scheduled_pack_id, sr.sent_via, sr.scheduled_date,
                   c.*, 
                   COALESCE(cp.quantity, c.quantity, 1) as quantity,
                   p.name as pack_name, p.price as pack_price,
                   s.user_id, s.business_name, 
                   s.whatsapp_enabled,
                   s.whatsapp_reminder_template,
                   s.whatsapp_api_key, s.whatsapp_phone_number_id,
                   s.upi_id, s.preferred_payment_method,
                   s.razorpay_key_id, s.razorpay_key_secret,
                   s.custom_charge_name, s.custom_charge_amount
            FROM scheduled_reminders sr
            JOIN customers c ON sr.customer_id = c.id
            JOIN settings s ON c.user_id = s.user_id
            JOIN users u ON c.user_id = u.id
            LEFT JOIN packs p ON (sr.pack_id = p.id OR (sr.pack_id IS NULL AND c.pack_id = p.id))
            LEFT JOIN customer_packs cp ON (sr.customer_id = cp.customer_id AND sr.pack_id = cp.pack_id)
            WHERE sr.sent = FALSE
            AND u.subscription_status = 'active'
            AND (u.subscription_expiry IS NULL OR u.subscription_expiry > NOW())
        `);



        if (scheduled.length === 0) return;

        const now = new Date();
        const nowIST = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));

        // --- Grouping by Customer to combine multi-packs into ONE message ---
        const grouped = scheduled.reduce((acc, item) => {
            const key = `${item.scheduled_customer_id}_${new Date(item.scheduled_date).getTime()}`;
            if (!acc[key]) {
                acc[key] = { 
                    ...item, 
                    ids: [], 
                    packsData: [] 
                };
            }
            acc[key].ids.push(item.scheduled_id);
            acc[key].packsData.push({
                name: item.pack_name,
                price: item.pack_price,
                quantity: item.quantity
            });
            return acc;
        }, {});

        console.log(`⏰ Processing ${Object.keys(grouped).length} unique customer reminders (from ${scheduled.length} pack entries)`);

        for (const item of Object.values(grouped)) {
            const scheduledTime = new Date(item.scheduled_date);
            const isTimeToSend = (scheduledTime <= now) || (scheduledTime <= nowIST);

            if (!isTimeToSend) continue;

            if (item.sent_via === 'whatsapp' && !item.whatsapp_enabled) continue;

            // Fetch ALL packs for this customer to ensure message is complete (Renewed, Pending, Expired)
            const [allCustomerPacks] = await pool.query(
                'SELECT p.name, p.price, cp.quantity, cp.renewal_date FROM customer_packs cp JOIN packs p ON cp.pack_id = p.id WHERE cp.customer_id = ? AND cp.status IN ("renewed", "pending", "expired")',
                [item.scheduled_customer_id]
            );

            // Filter packs based on reminder days (to behave exactly like auto-reminders)
            const daysStr = item.reminder_days_before || '3';
            const daysToRemind = daysStr.toString().split(',').map(d => parseInt(d.trim()));
            let packsData = allCustomerPacks.length > 0 ? allCustomerPacks : item.packsData;

            packsData = packsData.filter(p => {
                if (!p.renewal_date) return true;
                const rDate = new Date(p.renewal_date);
                rDate.setHours(0, 0, 0, 0);
                const compareDate = new Date(nowIST);
                compareDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((rDate.getTime() - compareDate.getTime()) / (1000 * 60 * 60 * 24));
                return daysToRemind.includes(diffDays) || diffDays <= 0;
            });

            if (packsData.length === 0) {
                console.log(`⏭️ Skipping scheduled reminder for ${item.name} because no packs are due.`);
                continue;
            }

            console.log(`🎯 Triggering consolidated scheduled reminder for ${item.name} (${packsData.length} packs)`);

            // 1. Calculate combined total for payment link
            const totalPackPrice = packsData.reduce((sum, p) => sum + (Number(p.price) * Number(p.quantity)), 0);
            const totalWithDelivery = totalPackPrice + Number(item.delivery_charge || 0) + Number(item.custom_charge_amount || 0);

            // 2. Generate payment link with consolidated amount
            const paymentUrl = await getPaymentLink(item, item, totalWithDelivery); 
            
            // 3. Prepare consolidated message
            const message = prepareMessage(item, item, paymentUrl, packsData);

            let result;
            if (item.sent_via === 'whatsapp') {
                result = await sendWhatsApp(
                    item.mobile,
                    message,
                    item.whatsapp_api_key,
                    item.whatsapp_phone_number_id
                );
            } else {
                result = { success: false, error: 'SMS removed' };
            }

            // Log and mark ALL grouped entries as sent
            await logReminder(item.scheduled_customer_id, item.sent_via, message, result.success ? 'sent' : 'failed', result.error || null);
            await pool.query('UPDATE scheduled_reminders SET sent = TRUE WHERE id IN (?)', [item.ids]);

            // --- Push Notification Integration (Scheduled) ---
            if (result.success) {
                try {
                    await triggerSingleReminder({
                        body: {
                            customerId: item.customer_id,
                            title: 'Subscription Reminder 🔔',
                            message: `Hi ${item.name}, your ${item.pack_name || 'pack'} is due for renewal! Check the app.`
                        }
                    }, { json: () => { }, status: () => ({ json: () => { } }) });
                } catch (pushErr) {
                    console.error('Scheduled Push Error:', pushErr.message);
                }
            }
            // ------------------------------------------------

            console.log(`${result.success ? '✅' : '❌'} Manually scheduled ${item.sent_via} sent to ${item.name}`);
        }

    } catch (error) {
        console.error('❌ Error processing scheduled reminders:', error.message);
    }
});

module.exports = {};
