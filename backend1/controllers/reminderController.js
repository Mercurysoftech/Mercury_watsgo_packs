const { pool } = require('../config/database');
const { sendWhatsApp } = require('../services/messagingService');
const { getPaymentLink, prepareMessage } = require('../services/messageHelper');
const { calculateCustomerTotal, formatPacksText } = require('../services/billingHelper');
const { triggerSingleReminder, sendBulkReminders: sendBulkPush } = require('./notificationController');

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

// --- Migration Check for scheduled_reminders ---
(async () => {
    try {
        const [cols] = await pool.query('SHOW COLUMNS FROM scheduled_reminders');
        const colNames = cols.map(c => c.Field);
        if (!colNames.includes('pack_id')) {
            console.log('Running migration: Adding pack_id to scheduled_reminders');
            await pool.query('ALTER TABLE scheduled_reminders ADD COLUMN pack_id INT AFTER customer_id');
            await pool.query('ALTER TABLE scheduled_reminders ADD FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE CASCADE');
        }
    } catch (e) {
        console.error('Scheduled reminders migration check failed:', e.message);
    }
})();
// ----------------------------------------------


exports.sendReminder = async (req, res) => {

    try {
        const {
            customerId,
            message: customMessage,
            amount: forcedAmount,
            packDetails: forcedPacks,
            deliveryCharge: forcedDelivery,
            chargeName: forcedChargeName,
            chargeAmount: forcedChargeAmount
        } = req.body;
        const sendVia = 'whatsapp';

        // --- Subscription Plan Block ---
        const [ownerRows] = await pool.query(
            'SELECT subscription_status, subscription_expiry, plan_type, addon_delivery_boys, addon_customer_app, addon_extra_customers, addon_extra_staff, addon_extra_zones FROM users WHERE id = ?',
            [req.ownerId]
        );
        const owner = ownerRows[0] || {};
        const isActive = owner.subscription_status === 'active' &&
            owner.subscription_expiry && new Date(owner.subscription_expiry) > new Date();
        const isTrialOrFree = owner.plan_type === 'trial' || owner.plan_type === 'free';

        // 1. Block manual messaging for Trial/Free Plan
        if (!isActive || (owner.plan_type === 'trial' || owner.plan_type === 'free')) {
            return res.status(403).json({
                error: 'WhatsApp/SMS messaging is not available on the Trial/Free Plan. Please upgrade to a Starter, Growth, or Pro plan to send manual reminders.',
                planRestricted: true
            });
        }
        // -----------------------
        const [customers] = await pool.query(
            `SELECT c.*, p.name as pack_name, p.price as pack_price 
             FROM customers c 
             LEFT JOIN packs p ON c.pack_id = p.id 
             WHERE c.id = ? AND c.user_id = ?
             ${req.userZone ? "AND c.zone IN (?)" : ""}
            `, [customerId, req.ownerId, ...(req.userZone ? [req.userZone] : [])]
        );
        if (customers.length === 0) return res.status(404).json({ error: 'Customer not found' });

        const customer = customers[0];
        const [settings] = await pool.query('SELECT * FROM settings WHERE user_id = ?', [req.ownerId]);
        const userSettings = settings[0] || {};
        userSettings.user_id = req.ownerId; // Ensure user_id is there for notes

        // Multi-Pack Fetch for Manual Reminder (Include renewal_cycle and total_deliveries)
        const [allPacks] = await pool.query(
            'SELECT p.name, p.price, cp.quantity, cp.status, cp.renewal_date, cp.renewal_cycle, cp.total_deliveries FROM customer_packs cp JOIN packs p ON cp.pack_id = p.id WHERE cp.customer_id = ?',
            [customerId]
        );

        const daysStr = userSettings.reminder_days_before || '3';
        const daysToRemind = daysStr.split(',').map(d => parseInt(d.trim()));
        const nowIST = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));

        let packsForTotal = allPacks.length > 0 ? allPacks : [{
            name: customer.pack_name,
            price: customer.pack_price,
            quantity: customer.quantity || 1,
            status: customer.status,
            renewal_date: customer.renewal_date,
            renewal_cycle: customer.renewal_cycle,
            total_deliveries: customer.total_deliveries
        }];
        
        packsForTotal = packsForTotal.filter(p => {
            if (!p.renewal_date) return true;
            const rDate = new Date(p.renewal_date);
            rDate.setHours(0, 0, 0, 0);
            const compareDate = new Date(nowIST);
            compareDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((rDate.getTime() - compareDate.getTime()) / (1000 * 60 * 60 * 24));
            // Include if it's in the reminder days, OR if it's overdue (expired)
            return daysToRemind.includes(diffDays) || diffDays <= 0;
        });

        // 1. Generate Payment Link with Centralized Billing Engine
        const billing = calculateCustomerTotal(packsForTotal, customer, userSettings, forcedAmount);
        const finalDelivery = Number(forcedDelivery !== undefined ? forcedDelivery : billing.deliveryCharge);
        const finalChargeAmount = Number(forcedChargeAmount !== undefined ? forcedChargeAmount : billing.customChargeAmount);
        const finalTotalAmount = Number(forcedAmount !== undefined && forcedAmount !== null ? forcedAmount : billing.grandTotal);

        const paymentUrl = await getPaymentLink(customer, userSettings, finalTotalAmount, packsForTotal);

        // 2. Prepare message
        let message = customMessage || prepareMessage(customer, userSettings, paymentUrl, packsForTotal, finalTotalAmount);

        // Multi-Pack formatting for manual replacement (WhatsApp Cloud API parameters do not allow \n)
        let consolidatedPacks = forcedPacks || formatPacksText(packsForTotal, customer);

        const renewalDate = new Date(customer.renewal_date || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const finalDeliveryString = finalDelivery.toFixed(2);
        const finalChargeName = forcedChargeName || userSettings.custom_charge_name || 'Charge';
        const finalChargeAmountString = finalChargeAmount.toFixed(2);
        const finalTotalAmountString = finalTotalAmount.toFixed(2);

        // SAFE JSON-AWARE REPLACEMENT (for custom message or template overrides)
        const replaceAllPlaces = (text) => {
            if (typeof text !== 'string') return text;
            return text
                .replace(/\{\{customer_name\}\}|\{\{1\}\}/g, customer.name || '')
                .replace(/\{\{pack_details\}\}|\{\{2\}\}/g, consolidatedPacks)
                .replace(/\{\{delivery_charge\}\}|\{\{3\}\}/g, finalDeliveryString)
                .replace(/\{\{gst_label\}\}|\{\{4\}\}/g, finalChargeName)
                .replace(/\{\{gst_amount\}\}|\{\{5\}\}/g, finalChargeAmountString)
                .replace(/\{\{total_amount\}\}|\{\{6\}\}/g, finalTotalAmountString)
                .replace(/\{\{payment_url\}\}|\{\{7\}\}/g, paymentUrl || ' ')
                .replace(/\{\{renewal_date\}\}/g, renewalDate);
        };

        if (typeof message === 'string' && message.trim().startsWith('{')) {
            try {
                let json = JSON.parse(message);
                if (json.type === 'template' && json.template.components) {
                    json.template.components.forEach(comp => {
                        if (comp.parameters) {
                            comp.parameters.forEach((param) => {
                                if (param.type === 'text' && typeof param.text === 'string') {
                                    param.text = replaceAllPlaces(param.text);
                                }
                            });
                        }
                    });
                    message = JSON.stringify(json);
                }
            } catch (e) {
                console.error('Safe JSON replacement failed:', e.message);
            }
        }

        // Final string replacement apply
        message = replaceAllPlaces(message);

        let result;
        if (sendVia === 'whatsapp') {
            if (!userSettings.whatsapp_enabled) {
                return res.status(400).json({ error: 'WhatsApp reminders are disabled in settings' });
            }
            result = await sendWhatsApp(
                customer.mobile,
                message,
                userSettings.whatsapp_api_key,
                userSettings.whatsapp_phone_number_id
            );
        } else {
            return res.status(400).json({ error: 'Only WhatsApp is supported' });
        }

        await pool.query(
            `INSERT INTO reminders (customer_id, sent_via, message, status, sent_at, error_message) VALUES (?, ?, ?, ?, ?, ?)`,
            [customerId, sendVia, message, result.success ? 'sent' : 'failed', result.success ? new Date() : null, result.error || null]
        );

        // SEND PUSH NOTIFICATION (As requested for the Customer App)
        try {
            await triggerSingleReminder({
                body: {
                    customerId: customerId,
                    title: 'Subscription Reminder 🔔',
                    message: `Hi ${customer.name}, your pack renewal is due. Check the app for details.`
                }
            }, { json: () => { }, status: () => ({ json: () => { } }) });
        } catch (pushErr) { console.error('Push error:', pushErr.message); }

        res.json({ success: result.success, message: result.success ? 'Sent' : result.error, messageId: result.messageId });
    } catch (error) {
        console.error('Send reminder error:', error);
        res.status(500).json({ error: 'Failed to send reminder' });
    }
};

exports.sendBulkReminders = async (req, res) => {
    try {
        const { customerIds } = req.body;
        const sendVia = 'whatsapp';

        // --- Plan Features Block ---
        const [ownerRows] = await pool.query(
            'SELECT subscription_status, subscription_expiry, plan_type, addon_delivery_boys, addon_customer_app, addon_extra_customers, addon_extra_staff, addon_extra_zones FROM users WHERE id = ?',
            [req.ownerId]
        );
        const owner = ownerRows[0] || {};
        const isActivePlan = owner.subscription_status === 'active' &&
            owner.subscription_expiry && new Date(owner.subscription_expiry) > new Date();
        const planType = owner.plan_type || 'trial';

        if (!isActivePlan || (planType !== 'growth' && planType !== 'pro')) {
            return res.status(403).json({
                error: 'Bulk reminders are only available on the Growth and Pro Plans. Please upgrade to send bulk automated reminders.',
                planRestricted: true
            });
        }
        // -----------------------

        const [settings] = await pool.query('SELECT * FROM settings WHERE user_id = ?', [req.ownerId]);
        const userSettings = settings[0] || {};
        const [customers] = await pool.query(
            `SELECT c.*, p.name as pack_name, p.price as pack_price 
             FROM customers c 
             LEFT JOIN packs p ON c.pack_id = p.id 
             WHERE c.id IN (?) AND c.user_id = ?
             ${req.userZone ? "AND c.zone IN (?)" : ""}
            `, [customerIds, req.ownerId, ...(req.userZone ? [req.userZone] : [])]
        );
        const daysStr = userSettings.reminder_days_before || '3';
        const daysToRemind = daysStr.split(',').map(d => parseInt(d.trim()));
        const nowIST = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));

        const results = [];
        for (const customer of customers) {
            // Multi-Pack Fetch for Bulk Item (Include renewal_cycle and total_deliveries)
            const [allPacks] = await pool.query(
                'SELECT p.name, p.price, cp.quantity, cp.status, cp.renewal_date, cp.renewal_cycle, cp.total_deliveries FROM customer_packs cp JOIN packs p ON cp.pack_id = p.id WHERE cp.customer_id = ?',
                [customer.id]
            );

            let packsForTotal = allPacks.length > 0 ? allPacks : [{
                name: customer.pack_name,
                price: customer.pack_price,
                quantity: customer.quantity || 1,
                status: customer.status,
                renewal_date: customer.renewal_date,
                renewal_cycle: customer.renewal_cycle,
                total_deliveries: customer.total_deliveries
            }];
            
            packsForTotal = packsForTotal.filter(p => {
                if (!p.renewal_date) return true;
                const rDate = new Date(p.renewal_date);
                rDate.setHours(0, 0, 0, 0);
                const compareDate = new Date(nowIST);
                compareDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((rDate.getTime() - compareDate.getTime()) / (1000 * 60 * 60 * 24));
                // Include if it's in the reminder days, OR if it's overdue (expired)
                return daysToRemind.includes(diffDays) || diffDays <= 0;
            });

            // If the user has 0 packs to remind right now based on settings, skip them in bulk entirely to avoid accidental spam
            if (packsForTotal.length === 0) {
                results.push({ id: customer.id, name: customer.name, success: false, error: 'No packs due for reminder based on settings.' });
                continue;
            }

            // Calculate consolidated total using Centralized Billing Engine
            const billing = calculateCustomerTotal(packsForTotal, customer, userSettings);
            const calculatedTotal = billing.grandTotal;

            // Generate link for each customer in bulk
            const paymentUrl = await getPaymentLink(customer, userSettings, calculatedTotal, packsForTotal);
            const message = prepareMessage(customer, userSettings, paymentUrl, packsForTotal, calculatedTotal);
            
            // Multi-Pack formatting for replacement
            const consolidatedPacks = formatPacksText(packsForTotal, customer);

            let result;
            if (sendVia === 'whatsapp') {
                if (!userSettings.whatsapp_enabled) {
                    results.push({ customerId: customer.id, success: false, error: 'WhatsApp disabled' });
                    continue;
                }
                result = await sendWhatsApp(
                    customer.mobile,
                    message,
                    userSettings.whatsapp_api_key,
                    userSettings.whatsapp_phone_number_id
                );
            } else {
                results.push({ customerId: customer.id, success: false, error: 'Only WhatsApp is supported' });
                continue;
            }

            await pool.query(
                `INSERT INTO reminders (customer_id, sent_via, message, status, sent_at, error_message) VALUES (?, ?, ?, ?, ?, ?)`,
                [customer.id, sendVia, message, result.success ? 'sent' : 'failed', result.success ? new Date() : null, result.error || null]
            );
            results.push({ customerId: customer.id, success: result.success });
        }

        // SEND BULK PUSH NOTIFICATIONS
        try {
            await sendBulkPush({
                body: {
                    customer_ids: customerIds,
                    title: 'Subscription Reminders 🔔',
                    message: 'Your subscriptions are due for renewal. Please check the app for details.'
                }
            }, { json: () => { }, status: () => ({ json: () => { } }) });
        } catch (pushErr) { console.error('Bulk push error:', pushErr.message); }

        res.json({
            success: true,
            results,
            message: `Reminders sent to ${results.filter(r => r.success).length} customers successfully.`
        });
    } catch (error) {
        console.error('Bulk reminder error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

exports.getReminderHistory = async (req, res) => {
    try {
        const { customerId } = req.params;
        const [reminders] = await pool.query('SELECT * FROM reminders WHERE customer_id = ? ORDER BY created_at DESC', [customerId]);
        res.json({ success: true, reminders });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

exports.getAllReminderHistory = async (req, res) => {
    try {
        const [reminders] = await pool.query(`
            SELECT 
                r.*, 
                c.name as customer_name,
                c.mobile as customer_mobile
            FROM reminders r 
            JOIN customers c ON r.customer_id = c.id 
            WHERE c.user_id = ? 
            ${req.userZone ? "AND c.zone IN (?)" : ""}
            ORDER BY r.created_at DESC
        `, [req.ownerId, ...(req.userZone ? [req.userZone] : [])]);

        const formattedLogs = reminders.map(log => ({
            id: log.id,
            customerId: log.customer_id,
            customerName: log.customer_name,
            mobile: log.customer_mobile,
            sentVia: log.sent_via,
            message: log.message,
            status: log.status === 'sent' ? 'success' : 'failure',
            errorMessage: log.error_message,
            sentAt: log.created_at
        }));

        res.json({ success: true, history: formattedLogs });
    } catch (error) {
        console.error('Get all history error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

exports.scheduleReminder = async (req, res) => {
    try {
        const { customerId, scheduledDate } = req.body;
        await pool.query('INSERT INTO scheduled_reminders (customer_id, scheduled_date) VALUES (?, ?)', [customerId, scheduledDate]);
        res.json({ success: true, message: 'Scheduled' });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

exports.getScheduledReminders = async (req, res) => {
    try {
        const [reminders] = await pool.query(`
            SELECT 
                sr.id, 
                sr.customer_id, 
                sr.scheduled_date, 
                sr.sent_via, 
                sr.sent,
                c.name as customer_name, 
                c.mobile as customer_mobile
            FROM scheduled_reminders sr 
            JOIN customers c ON sr.customer_id = c.id 
            WHERE c.user_id = ? AND sr.sent = FALSE
            ${req.userZone ? "AND c.zone IN (?)" : ""}
            ORDER BY sr.scheduled_date ASC
        `, [req.ownerId, ...(req.userZone ? [req.userZone] : [])]);

        const formattedScheduled = reminders.map(rem => ({
            id: rem.id,
            customerId: rem.customer_id,
            customerName: rem.customer_name,
            mobile: rem.customer_mobile,
            scheduledDate: rem.scheduled_date,
            sendVia: rem.sent_via,
            status: rem.sent ? 'sent' : 'pending'
        }));

        res.json({ success: true, scheduled: formattedScheduled });
    } catch (error) {
        console.error('Get scheduled reminders error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

exports.scheduleBulkReminders = async (req, res) => {
    try {
        const { customerIds, scheduledDate } = req.body;
        const sendVia = 'whatsapp';

        if (!customerIds || customerIds.length === 0) {
            return res.json({ success: true, message: 'No customers selected' });
        }

        // Insert multiple scheduled reminders with sent_via
        const values = customerIds.map(id => [id, scheduledDate, 'whatsapp']);
        await pool.query('INSERT INTO scheduled_reminders (customer_id, scheduled_date, sent_via) VALUES ?', [values]);

        res.json({
            success: true,
            message: `Successfully scheduled reminders for ${customerIds.length} customers for ${scheduledDate}`
        });
    } catch (error) {
        console.error('Schedule bulk error:', error);
        res.status(500).json({ error: 'Failed to schedule bulk reminders' });
    }
};

exports.deleteReminder = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if scheduled reminder exists and belongs to user through customers table
        const [reminders] = await pool.query(`
            SELECT sr.id 
            FROM scheduled_reminders sr
            JOIN customers c ON sr.customer_id = c.id
            WHERE sr.id = ? AND c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `, [id, req.ownerId, ...(req.userZone ? [req.userZone] : [])]);

        if (reminders.length === 0) {
            return res.status(404).json({ error: 'Scheduled reminder not found or unauthorized' });
        }

        await pool.query('DELETE FROM scheduled_reminders WHERE id = ?', [id]);
        res.json({ success: true, message: 'Scheduled reminder canceled successfully' });
    } catch (error) {
        console.error('Delete scheduled reminder error:', error);
        res.status(500).json({ error: 'Failed to cancel scheduled reminder' });
    }
};

exports.autoScheduleReminders = async (req, res) => {
    try {
        const { customerIds } = req.body;

        if (!customerIds || customerIds.length === 0) {
            return res.json({ success: true, message: 'No customers selected' });
        }

        // 1. Get User Settings
        const [settingsResult] = await pool.query('SELECT * FROM settings WHERE user_id = ?', [req.ownerId]);

        if (settingsResult.length === 0) {
            return res.status(400).json({ error: 'Please configure Notification Settings first.' });
        }

        const settings = settingsResult[0];

        // Parse reminder days
        let reminderDays = [];
        try {
            if (settings.reminder_days_before) {
                if (typeof settings.reminder_days_before === 'string' && settings.reminder_days_before.startsWith('[')) {
                    reminderDays = JSON.parse(settings.reminder_days_before);
                } else if (typeof settings.reminder_days_before === 'string') {
                    reminderDays = settings.reminder_days_before.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
                } else if (Array.isArray(settings.reminder_days_before)) {
                    reminderDays = settings.reminder_days_before.map(d => parseInt(d)).filter(d => !isNaN(d));
                }
            }
        } catch (e) {
            console.error('Error parsing reminder days:', e);
            reminderDays = [3];
        }

        if (reminderDays.length === 0) reminderDays = [3];

        const reminderTime = settings.reminder_time || '09:00';
        const [hours, minutes] = reminderTime.split(':').map(Number);

        // 2. Get All Renewal Dates (Main + Multi-Packs)
        const [mainDates] = await pool.query(`
            SELECT c.id as customer_id, c.renewal_date, c.pack_id 
            FROM customers c 
            WHERE c.id IN (?) AND c.user_id = ? 
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `, [customerIds, req.ownerId, ...(req.userZone ? [req.userZone] : [])]);

        const [subDates] = await pool.query(`
            SELECT cp.customer_id, cp.renewal_date, cp.pack_id 
            FROM customer_packs cp 
            JOIN customers c ON cp.customer_id = c.id
            WHERE cp.customer_id IN (?) AND cp.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `, [customerIds, req.ownerId, ...(req.userZone ? [req.userZone] : [])]);

        const allDates = [...mainDates, ...subDates];

        // Deduplicate: same customer, same date, same pack
        const uniqueDates = [];
        const seen = new Set();
        allDates.forEach(row => {
            if (!row.renewal_date) return;
            const dateStr = formatDate(new Date(row.renewal_date));
            const key = `${row.customer_id}_${dateStr}_${row.pack_id || 'null'}`;
            if (!seen.has(key)) {
                uniqueDates.push({ customerId: row.customer_id, renewalDate: dateStr, packId: row.pack_id });
                seen.add(key);
            }
        });

        // Clean up existing pending reminders...
        await pool.query('DELETE FROM scheduled_reminders WHERE customer_id IN (?) AND sent = FALSE', [customerIds]);

        let scheduledCount = 0;
        const remindersToInsert = [];

        // --- Time Context ---
        const now = new Date();
        const nowISTValue = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));

        // 3. Calculate Reminders
        for (const data of uniqueDates) {
            const renewalDate = new Date(data.renewalDate + 'T00:00:00');

            for (const dayBefore of reminderDays) {
                const scheduleDate = new Date(renewalDate.getTime());
                scheduleDate.setDate(scheduleDate.getDate() - dayBefore);
                scheduleDate.setHours(hours, minutes, 0, 0);

                let shouldSchedule = false;
                if (scheduleDate > nowISTValue) {
                    shouldSchedule = true;
                } else if (dayBefore === 0 && formatDate(renewalDate) === formatDate(nowISTValue)) {
                    shouldSchedule = true;
                }

                if (shouldSchedule && settings.whatsapp_enabled) {
                    remindersToInsert.push([data.customerId, data.packId, scheduleDate, 'whatsapp']);
                }
            }
        }

        // 4. Batch Insert
        if (remindersToInsert.length > 0) {
            await pool.query('INSERT INTO scheduled_reminders (customer_id, pack_id, scheduled_date, sent_via) VALUES ?', [remindersToInsert]);
            scheduledCount = remindersToInsert.length;
        }


        res.json({
            success: true,
            message: `Successfully scheduled ${scheduledCount} reminders for ${customerIds.length} customers.`,
            count: scheduledCount
        });

    } catch (error) {
        console.error('Auto schedule error:', error);
        res.status(500).json({ error: 'Failed to auto-schedule reminders' });
    }
};
