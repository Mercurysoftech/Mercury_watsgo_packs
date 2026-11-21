const { pool } = require('../config/database');
const { saveAndSendNotification } = require('./notificationController');

/**
 * Helper: Add N delivery days to a date, skipping Sundays
 * Returns YYYY-MM-DD string (local date, timezone-safe)
 */
function addDeliveryDays(startDateStr, days) {
    let date = new Date(startDateStr + 'T00:00:00');
    let remaining = days;
    while (remaining > 0) {
        date.setDate(date.getDate() + 1);
        if (date.getDay() !== 0) { // 0 = Sunday
            remaining--;
        }
    }
    // Use local date parts to avoid UTC shift in IST timezone
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Helper: Subtract N delivery days from a date, skipping Sundays
 * Returns YYYY-MM-DD string
 */
function subtractDeliveryDays(dateStr, days) {
    let date = new Date(dateStr + 'T00:00:00');
    let remaining = days;
    while (remaining > 0) {
        date.setDate(date.getDate() - 1);
        if (date.getDay() !== 0) { // 0 = Sunday
            remaining--;
        }
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Helper: Convert Date object to YYYY-MM-DD string safely (local time)
 */
function dateToYMD(date) {
    if (!date) return null;
    if (typeof date === 'string') return date.split('T')[0];
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Statuses that mean a missed delivery (renewal should extend)
const PAUSE_STATUSES = ['customer_pause', 'service_pause', 'holiday'];
const VALID_STATUSES = ['delivered', 'customer_pause', 'service_pause', 'holiday'];

/**
 * Recalculate the exact renewal date for a food-type customer pack.
 *
 * Key rule:
 *   - Count unique DATES that have at least one pause record (not individual meal rows).
 *   - extensionDays = number of unique paused dates (1 paused date = 1 extra day, regardless of meal count)
 *   - This means: pause B+L on May 18 → 1 extension. Un-pause → 0 extension → reverts.
 *
 * Fruits/standard packs: handled by old +1/-1 logic (not called here).
 */
async function recalculateCustomerPackRenewal(customerId, customerPackId, ownerId) {
    try {
        const cPackId = Number(customerPackId) || 0;
        let pStart = null;
        let packType = 'fruits';
        let mealSlots = '';
        let deliveries = 24;
        let masterPackId = 0;

        const [sRows] = await pool.query('SELECT business_type FROM settings WHERE user_id = ?', [ownerId]);
        const globalBusinessType = sRows[0]?.business_type || 'fruits';

        if (cPackId > 0) {
            const [rows] = await pool.query(
                `SELECT cp.start_date, cp.total_deliveries, p.pack_type, p.meal_slots, cp.pack_id as master_pack_id
                 FROM customer_packs cp
                 JOIN packs p ON cp.pack_id = p.id
                 WHERE cp.id = ?`,
                [cPackId]
            );
            if (rows.length === 0) return null;
            const r = rows[0];
            pStart = dateToYMD(r.start_date);
            deliveries = r.total_deliveries || 24;
            packType = r.pack_type || 'fruits';
            mealSlots = r.meal_slots || '';
            masterPackId = r.master_pack_id || 0;
        } else {
            const [rows] = await pool.query(
                `SELECT c.subscription_start_date as start_date, c.total_deliveries,
                        p.pack_type, p.meal_slots, c.pack_id as master_pack_id
                 FROM customers c
                 LEFT JOIN packs p ON c.pack_id = p.id
                 WHERE c.id = ?`,
                [customerId]
            );
            if (rows.length === 0) return null;
            const r = rows[0];
            pStart = dateToYMD(r.start_date);
            deliveries = r.total_deliveries || 24;
            packType = r.pack_type || 'fruits';
            mealSlots = r.meal_slots || '';
            masterPackId = r.master_pack_id || 0;
        }

        // Only food packs (or global food business) use this recalculation
        if (packType !== 'food' && globalBusinessType !== 'food') return null;
        if (!pStart) return null;

        // 1. Base renewal = start + (deliveries - 1) delivery days, NO pauses
        const baseRenewal = addDeliveryDays(pStart, Math.max(0, deliveries - 1));

        // 2. Determine meals per day for this pack
        const mealsPerDay = mealSlots ? mealSlots.split(',').map(m => m.trim()).filter(Boolean).length : 3;

        // 3. Count TOTAL paused/holiday meal records
        const lookAhead = addDeliveryDays(baseRenewal, 90);
        const [pauseRows] = await pool.query(
            `SELECT COUNT(DISTINCT CONCAT(attendance_date, '_', meal_type)) as pause_count
             FROM customer_attendance
             WHERE customer_id = ? AND user_id = ?
               AND (pack_id = ? OR pack_id = ? OR pack_id = 0)
               AND attendance_date >= ? AND attendance_date <= ?
               AND status IN ('customer_pause', 'service_pause', 'holiday')`,
            [customerId, ownerId, cPackId, masterPackId, pStart, lookAhead]
        );
        const totalPausedMeals = parseInt(pauseRows[0]?.pause_count || 0);

        // 4. Calculate extension days using Math.ceil(totalPausedMeals / mealsPerDay)
        const pausedDays = Math.ceil(totalPausedMeals / mealsPerDay);

        // 5. Calculate final renewal date
        const finalRenewal = addDeliveryDays(baseRenewal, pausedDays);

        // 4. Always update (force correct value after any toggle)
        if (cPackId > 0) {
            await pool.query(`UPDATE customer_packs SET renewal_date = ? WHERE id = ?`, [finalRenewal, cPackId]);
            await pool.query(`UPDATE customers SET renewal_date = ? WHERE id = ?`, [finalRenewal, customerId]);
        } else {
            await pool.query(`UPDATE customers SET renewal_date = ? WHERE id = ?`, [finalRenewal, customerId]);
            await pool.query(`UPDATE customer_packs SET renewal_date = ? WHERE customer_id = ? AND status = 'renewed'`, [finalRenewal, customerId]);
        }

        return { customerId, packId: cPackId, newRenewal: finalRenewal };
    } catch (err) {
        console.error(`recalculateCustomerPackRenewal error (cust=${customerId} pack=${customerPackId}):`, err);
        return null;
    }
}


/**
 * Save (upsert) attendance for a single customer on a date.
 * Fruits/standard packs: +1 day per pause (unchanged behaviour).
 * Food packs: uses recalculateCustomerPackRenewal (smart formula).
 */
exports.saveAttendance = async (req, res) => {
    try {
        const ownerId = req.ownerId;
        const { customerId, customerPackId, date, status, note, mealType } = req.body;

        if (!customerId || !date || !status) {
            return res.status(400).json({ error: 'customerId, date, and status are required' });
        }
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` });
        }

        const cPackId = customerPackId || 0;

        // Get previous status for this exact meal slot
        const [prevRow] = await pool.query(
            `SELECT status FROM customer_attendance
             WHERE customer_id = ? AND pack_id = ? AND attendance_date = ? AND user_id = ? AND meal_type = ?`,
            [customerId, cPackId, date, ownerId, mealType || 'none']
        );
        const prevStatus = prevRow[0]?.status || null;

        await pool.query(
            `INSERT INTO customer_attendance (customer_id, pack_id, user_id, attendance_date, status, note, meal_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note)`,
            [customerId, cPackId, ownerId, date, status, note || null, mealType || 'none']
        );

        const wasAPause = PAUSE_STATUSES.includes(prevStatus);
        const isNowAPause = PAUSE_STATUSES.includes(status);

        // Determine pack type to choose renewal strategy
        let currentPackType = 'fruits';
        if (cPackId > 0) {
            const [ptRow] = await pool.query(
                `SELECT p.pack_type FROM customer_packs cp JOIN packs p ON cp.pack_id = p.id WHERE cp.id = ?`, [cPackId]
            );
            currentPackType = ptRow[0]?.pack_type || 'fruits';
        } else {
            const [ptRow] = await pool.query(
                `SELECT p.pack_type FROM customers c JOIN packs p ON c.pack_id = p.id WHERE c.id = ?`, [customerId]
            );
            currentPackType = ptRow[0]?.pack_type || 'fruits';
        }

        if (currentPackType === 'food') {
            // Smart recalculation for food packs
            await recalculateCustomerPackRenewal(customerId, cPackId, ownerId);
        } else {
            // Old +1/-1 behaviour for fruits/standard packs
            if (isNowAPause && !wasAPause) {
                if (cPackId) {
                    const [r] = await pool.query(`SELECT renewal_date FROM customer_packs WHERE id = ?`, [cPackId]);
                    if (r[0]?.renewal_date) {
                        const newDate = addDeliveryDays(dateToYMD(r[0].renewal_date), 1);
                        await pool.query(`UPDATE customer_packs SET renewal_date = ? WHERE id = ?`, [newDate, cPackId]);
                        await pool.query(`UPDATE customers SET renewal_date = ? WHERE id = ?`, [newDate, customerId]);
                    }
                } else {
                    const [r] = await pool.query(`SELECT renewal_date FROM customers WHERE id = ?`, [customerId]);
                    if (r[0]?.renewal_date) await pool.query(`UPDATE customers SET renewal_date = ? WHERE id = ?`, [addDeliveryDays(dateToYMD(r[0].renewal_date), 1), customerId]);
                    const [packs] = await pool.query(`SELECT id, renewal_date FROM customer_packs WHERE customer_id = ?`, [customerId]);
                    for (const p of packs) { if (p.renewal_date) await pool.query(`UPDATE customer_packs SET renewal_date = ? WHERE id = ?`, [addDeliveryDays(dateToYMD(p.renewal_date), 1), p.id]); }
                }
            } else if (!isNowAPause && wasAPause) {
                if (cPackId) {
                    const [r] = await pool.query(`SELECT renewal_date FROM customer_packs WHERE id = ?`, [cPackId]);
                    if (r[0]?.renewal_date) await pool.query(`UPDATE customer_packs SET renewal_date = ? WHERE id = ?`, [subtractDeliveryDays(dateToYMD(r[0].renewal_date), 1), cPackId]);
                } else {
                    const [r] = await pool.query(`SELECT renewal_date FROM customers WHERE id = ?`, [customerId]);
                    if (r[0]?.renewal_date) await pool.query(`UPDATE customers SET renewal_date = ? WHERE id = ?`, [subtractDeliveryDays(dateToYMD(r[0].renewal_date), 1), customerId]);
                    const [packs] = await pool.query(`SELECT id, renewal_date FROM customer_packs WHERE customer_id = ?`, [customerId]);
                    for (const p of packs) { if (p.renewal_date) await pool.query(`UPDATE customer_packs SET renewal_date = ? WHERE id = ?`, [subtractDeliveryDays(dateToYMD(p.renewal_date), 1), p.id]); }
                }
            }
        }

        res.json({ success: true, message: 'Attendance saved' });
    } catch (error) {
        console.error('Save attendance error:', error);
        res.status(500).json({ error: 'Failed to save attendance', details: error.message });
    }
};

/**
 * Bulk save attendance for multiple customers on a date.
 * Fruits/standard packs: old +1/-1 logic per record.
 * Food packs: recalculates renewal from scratch after all inserts (accurate).
 */
exports.saveBulkAttendance = async (req, res) => {
    try {
        const ownerId = req.ownerId;
        const { date, records } = req.body;

        if (!date || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ error: 'date and records array are required' });
        }

        const renewalUpdates = [];
        // Track food packs for smart recalculation after all inserts
        const foodPackPairs = new Map(); // key: "customerId-packId"

        const [sRows] = await pool.query('SELECT business_type FROM settings WHERE user_id = ?', [ownerId]);
        const globalBusinessType = sRows[0]?.business_type || 'fruits';

        for (const record of records) {
            if (!record.customerId) continue;
            const cPackId = record.customerPackId || 0;
            const status = (record.status && VALID_STATUSES.includes(record.status)) ? record.status : null;
            const recordDate = record.date || date;
            const mealType = record.mealType || 'none';

            try {
                // Determine pack type
                let currentPackType = 'fruits';
                if (cPackId > 0) {
                    const [ptRow] = await pool.query(
                        `SELECT p.pack_type FROM customer_packs cp JOIN packs p ON cp.pack_id = p.id WHERE cp.id = ?`, [cPackId]
                    );
                    currentPackType = ptRow[0]?.pack_type || 'fruits';
                } else {
                    const [ptRow] = await pool.query(
                        `SELECT p.pack_type FROM customers c JOIN packs p ON c.pack_id = p.id WHERE c.id = ?`, [record.customerId]
                    );
                    currentPackType = ptRow[0]?.pack_type || 'fruits';
                }

                // Get previous status
                const [prevRow] = await pool.query(
                    `SELECT status FROM customer_attendance WHERE customer_id = ? AND pack_id = ? AND attendance_date = ? AND user_id = ? AND meal_type = ?`,
                    [record.customerId, cPackId, recordDate, ownerId, mealType]
                );
                const prevStatus = prevRow[0]?.status || null;

                if (status === null) {
                    await pool.query(
                        `DELETE FROM customer_attendance WHERE customer_id = ? AND pack_id = ? AND attendance_date = ? AND user_id = ? AND meal_type = ?`,
                        [record.customerId, cPackId, recordDate, ownerId, mealType]
                    );
                } else {
                    await pool.query(
                        `INSERT INTO customer_attendance (customer_id, pack_id, user_id, attendance_date, status, note, meal_type)
                         VALUES (?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), pack_id = VALUES(pack_id), user_id = VALUES(user_id), meal_type = VALUES(meal_type)`,
                        [record.customerId, cPackId, ownerId, recordDate, status, record.note || null, mealType]
                    );

                    if (status !== prevStatus) {
                        let title = "Delivery Update";
                        let message = "";
                        if (status === "delivered") {
                             title = "Delivery Successful ✅";
                             message = `Your delivery for ${recordDate} has been completed.`;
                        } else if (["customer_pause", "service_pause", "vendor_pause", "pause"].includes(status)) {
                             title = "Delivery Paused ⏸️";
                             message = `Your delivery for ${recordDate} has been paused.`;
                        } else if (status === "holiday") {
                             title = "Holiday Declared 🌴";
                             message = `Your delivery for ${recordDate} is cancelled due to a holiday.`;
                        }

                        if (message) {
                            const [cRow] = await pool.query(`SELECT delivery_user_id FROM customers WHERE id = ?`, [record.customerId]);
                            const deliveryUserId = cRow[0]?.delivery_user_id;

                            // Notify Customer
                            await saveAndSendNotification(record.customerId, 'customer', title, message, 'info');

                            // Notify Delivery Man
                            if (deliveryUserId) {
                                await saveAndSendNotification(deliveryUserId, 'delivery', title, `Customer #${record.customerId}: ${message}`, 'info');
                            }
                        }
                    }
                }

                if (currentPackType === 'food' || globalBusinessType === 'food') {
                    // Queue for smart recalculation after all inserts
                    foodPackPairs.set(`${record.customerId}-${cPackId}`, { customerId: record.customerId, customerPackId: cPackId });
                } else {
                    // Old +1/-1 for fruits/standard
                    const wasAPause = PAUSE_STATUSES.includes(prevStatus);
                    const isNowAPause = PAUSE_STATUSES.includes(status || '');

                    if (isNowAPause && !wasAPause) {
                        if (cPackId) {
                            const [pRow] = await pool.query(`SELECT renewal_date FROM customer_packs WHERE id = ?`, [cPackId]);
                            if (pRow[0]?.renewal_date) {
                                const newDate = addDeliveryDays(dateToYMD(pRow[0].renewal_date), 1);
                                await pool.query(`UPDATE customer_packs SET renewal_date = ? WHERE id = ?`, [newDate, cPackId]);
                                renewalUpdates.push({ customerId: record.customerId, packId: cPackId, name: 'Pack Extended', newRenewal: newDate });
                            }
                        } else {
                            const [cRow] = await pool.query(`SELECT renewal_date FROM customers WHERE id = ?`, [record.customerId]);
                            if (cRow[0]?.renewal_date) {
                                const newDate = addDeliveryDays(dateToYMD(cRow[0].renewal_date), 1);
                                await pool.query(`UPDATE customers SET renewal_date = ? WHERE id = ?`, [newDate, record.customerId]);
                                renewalUpdates.push({ customerId: record.customerId, name: 'Extended', newRenewal: newDate });
                            }
                        }
                    } else if (!isNowAPause && wasAPause) {
                        if (cPackId) {
                            const [pRow] = await pool.query(`SELECT renewal_date FROM customer_packs WHERE id = ?`, [cPackId]);
                            if (pRow[0]?.renewal_date) {
                                const newDate = subtractDeliveryDays(dateToYMD(pRow[0].renewal_date), 1);
                                await pool.query(`UPDATE customer_packs SET renewal_date = ? WHERE id = ?`, [newDate, cPackId]);
                                renewalUpdates.push({ customerId: record.customerId, packId: cPackId, name: 'Pack Shortened', newRenewal: newDate });
                            }
                        } else {
                            const [cRow] = await pool.query(`SELECT renewal_date FROM customers WHERE id = ?`, [record.customerId]);
                            if (cRow[0]?.renewal_date) {
                                const newDate = subtractDeliveryDays(dateToYMD(cRow[0].renewal_date), 1);
                                await pool.query(`UPDATE customers SET renewal_date = ? WHERE id = ?`, [newDate, record.customerId]);
                                renewalUpdates.push({ customerId: record.customerId, name: 'Shortened', newRenewal: newDate });
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Error saving record for cust ${record.customerId} pack ${cPackId}:`, err);
            }
        }

        // Smart recalculation for food packs (run AFTER all inserts are done)
        for (const pair of foodPackPairs.values()) {
            const update = await recalculateCustomerPackRenewal(pair.customerId, pair.customerPackId, ownerId);
            if (update) renewalUpdates.push(update);
        }

        res.json({ success: true, message: `Attendance processed for ${records.length} items`, renewalUpdates });
    } catch (error) {
        console.error('Bulk save attendance error:', error);
        res.status(500).json({ error: 'Failed to save bulk attendance', details: error.message });
    }
};

/**
 * Get attendance records (optionally filtered by date/customer)
 */
exports.getAttendance = async (req, res) => {
    try {
        const ownerId = req.ownerId;
        const { date, customerId, packId, month } = req.query;

        let query = `
            SELECT 
                ca.*,
                c.name as customer_name,
                c.mobile as customer_mobile,
                c.renewal_cycle
            FROM customer_attendance ca
            JOIN customers c ON ca.customer_id = c.id
            WHERE c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `;
        const params = req.userZone ? [ownerId, req.userZone] : [ownerId];

        if (date) {
            query += ` AND ca.attendance_date = ?`;
            params.push(date);
        }
        if (customerId) {
            query += ` AND ca.customer_id = ?`;
            params.push(customerId);
        }
        if (packId) {
            query += ` AND ca.pack_id = ?`;
            params.push(packId);
        }
        if (month) {
            // Filter by month (YYYY-MM)
            query += ` AND ca.attendance_date LIKE ?`;
            params.push(`${month}%`);
        }

        query += ` ORDER BY ca.attendance_date DESC, c.name ASC`;

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance', details: error.message });
    }
};

/**
 * Get customers list for a specific date (to mark attendance)
 * Also returns: subscription dates and delivered/paused counts for the period
 */
exports.getCustomersForDate = async (req, res) => {
    try {
        const userId = req.userId;
        const ownerId = req.ownerId;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        // --- REAL-TIME FIX: Auto-expire packs before fetching attendance list ---
        await pool.query(
            `UPDATE customer_packs 
             SET status = 'expired' 
             WHERE user_id = ? AND status = 'renewed' AND renewal_date < CURDATE()`,
            [ownerId]
        );

        // Also update the main customer status if no renewed packs remain
        await pool.query(
            `UPDATE customers c
             SET c.status = 'expired'
             WHERE c.user_id = ? AND c.status = 'renewed' 
             AND NOT EXISTS (SELECT 1 FROM customer_packs cp WHERE cp.customer_id = c.id AND cp.status = 'renewed')`,
            [ownerId]
        );
        // ------------------------------------------------------------------------

        // --- Preventative Schema Check for Attendance Table ---
        try {
            const [attendanceCols] = await pool.query(`SHOW COLUMNS FROM customer_attendance`);
            const attendanceColNames = attendanceCols.map(c => c.Field);

            if (!attendanceColNames.includes('pack_id')) {
                console.log('Running migration: Adding pack_id to customer_attendance');
                await pool.query("ALTER TABLE customer_attendance ADD COLUMN pack_id INT DEFAULT 0 AFTER customer_id");
            }
            if (!attendanceColNames.includes('meal_type')) {
                console.log('Running migration: Adding meal_type to customer_attendance');
                await pool.query("ALTER TABLE customer_attendance ADD COLUMN meal_type VARCHAR(100) DEFAULT NULL AFTER note");
            }
            if (!attendanceColNames.includes('updated_at')) {
                console.log('Running migration: Adding updated_at to customer_attendance');
                await pool.query("ALTER TABLE customer_attendance ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
            }

            // Migration for unique index to support multi-meal attendance per pack
            const [indexes] = await pool.query(`SHOW INDEX FROM customer_attendance`);
            const indexNames = indexes.map(i => i.Key_name);
            if (indexNames.includes('unique_customer_date')) {
                console.log('Running migration: Dropping old unique_customer_date index');
                await pool.query("ALTER TABLE customer_attendance DROP INDEX unique_customer_date").catch(() => { });
            }
            if (indexNames.includes('unique_cust_pack_date')) {
                console.log('Running migration: Dropping old unique_cust_pack_date index');
                await pool.query("ALTER TABLE customer_attendance DROP INDEX unique_cust_pack_date").catch(() => { });
            }
            if (!indexNames.includes('unique_customer_pack_date_meal')) {
                console.log('Running migration: Adding unique_customer_pack_date_meal index');
                await pool.query("UPDATE customer_attendance SET meal_type = 'none' WHERE meal_type IS NULL OR meal_type = ''");
                await pool.query("ALTER TABLE customer_attendance MODIFY COLUMN meal_type VARCHAR(100) NOT NULL DEFAULT 'none'");
                await pool.query("ALTER TABLE customer_attendance ADD UNIQUE KEY unique_customer_pack_date_meal (customer_id, pack_id, attendance_date, meal_type)");
            }
        } catch (schemaError) {
            console.error('Attendance schema check warning:', schemaError.message);
        }
        // ------------------------------------------------------

        // Get all customers with subscription dates and delivery info
        const [customers] = await pool.query(
            `SELECT c.id, c.name, c.mobile, c.renewal_cycle, c.total_deliveries,
                    c.subscription_start_date, c.renewal_date, c.pack_id, c.status,
                    c.address, c.address2, c.area, c.landmark, c.location, c.zone,
                    c.delivery_user_id,
                    p.name as pack_name, p.price as pack_base_price, p.pack_type as pack_type, p.meal_slots as meal_slots
             FROM customers c
             LEFT JOIN packs p ON c.pack_id = p.id
             WHERE c.user_id = ? 
             ${req.userZone ? "AND c.zone IN (?)" : ""}
             ORDER BY c.name ASC`,
            req.userZone ? [ownerId, req.userZone] : [ownerId]
        );

        // Fetch only RENEWED and NON-EXPIRED packs for attendance
        const [customerPacks] = await pool.query(
            `SELECT cp.id, cp.customer_id, cp.pack_id, cp.quantity, cp.user_id, cp.status,
                    cp.start_date, cp.renewal_date, cp.renewal_cycle, cp.total_deliveries,
                    cp.last_payment_date, p.name as pack_name, p.price as pack_base_price, p.pack_type, p.meal_slots
             FROM customer_packs cp
             JOIN packs p ON cp.pack_id = p.id
             JOIN customers c ON cp.customer_id = c.id
             WHERE cp.user_id = ? 
             AND cp.status = 'renewed' 
             AND cp.renewal_date >= CURDATE()
             ${req.userZone ? "AND c.zone IN (?)" : " "}`,
            req.userZone ? [ownerId, req.userZone] : [ownerId]
        );

        // Get existing attendance for that date (now including pack_id, user_id, meal_type, and updated_at)
        const [existing] = await pool.query(
            `SELECT customer_id, pack_id, status, note, meal_type, updated_at FROM customer_attendance WHERE attendance_date = ? AND user_id = ?`,
            [date, ownerId]
        );

        const existingMap = {};
        existing.forEach(r => {
            const key = `${r.customer_id}-${r.pack_id}`;
            if (!existingMap[key]) existingMap[key] = [];
            existingMap[key].push(r);
        });

        // Get delivered/paused counts for each customer and their individual packs
        const result = await Promise.all(customers.map(async (c) => {
            const customerId = c.id;
            const packsForCust = customerPacks.filter(cp => cp.customer_id === customerId);

            // Calculate counts for each pack
            const packsWithStats = await Promise.all(packsForCust.map(async (cp) => {
                const pStart = dateToYMD(cp.start_date);
                const pRenew = dateToYMD(cp.renewal_date);

                let stats = { present_count: 0, absent_count: 0, holiday_count: 0 };
                if (pStart && pRenew) {
                    const [pSummary] = await pool.query(
                        `SELECT 
                            COUNT(DISTINCT CASE WHEN status = 'delivered' THEN CONCAT(attendance_date, '_', meal_type) ELSE NULL END) as present_count,
                            COUNT(DISTINCT CASE WHEN status IN ('customer_pause', 'service_pause') THEN CONCAT(attendance_date, '_', meal_type) ELSE NULL END) as absent_count,
                            COUNT(DISTINCT CASE WHEN status = 'holiday' THEN CONCAT(attendance_date, '_', meal_type) ELSE NULL END) as holiday_count
                        FROM customer_attendance
                        WHERE customer_id = ? AND user_id = ? AND (pack_id = ? OR pack_id = ? OR pack_id = 0) AND attendance_date >= ? AND attendance_date <= ?`,
                        [customerId, ownerId, cp.id, cp.pack_id, pStart, pRenew]
                    );
                    stats = {
                        present_count: parseInt(pSummary[0]?.present_count || 0),
                        absent_count: parseInt(pSummary[0]?.absent_count || 0),
                        holiday_count: parseInt(pSummary[0]?.holiday_count || 0)
                    };
                }

                const attList = existingMap[`${customerId}-${cp.id}`] ||
                    existingMap[`${customerId}-${cp.pack_id}`] ||
                    (cp.pack_id === c.pack_id ? existingMap[`${customerId}-0`] : []) || [];
                const firstAtt = attList[attList.length - 1] || null;

                return {
                    customerPackId: cp.id,
                    packId: cp.pack_id,
                    name: cp.pack_name,
                    quantity: cp.quantity,
                    startDate: pStart,
                    renewalDate: pRenew,
                    renewalCycle: cp.renewal_cycle,
                    totalDeliveries: cp.total_deliveries,
                    status: cp.status,
                    packType: cp.pack_type,
                    mealSlots: cp.meal_slots,
                    attendance_status: firstAtt?.status || null,
                    meal_type: firstAtt?.meal_type || null,
                    delivered_at: firstAtt?.updated_at || null,
                    attendance_records: attList,
                    ...stats
                };
            }));

            // Fallback for customer-level for backward compatibility
            const cStart = dateToYMD(c.subscription_start_date);
            const cRenew = dateToYMD(c.renewal_date);

            let overallStats = { present_count: 0, absent_count: 0, holiday_count: 0 };
            if (cStart && cRenew) {
                const [cSummary] = await pool.query(
                    `SELECT 
                        COUNT(DISTINCT CASE WHEN status = 'delivered' THEN CONCAT(attendance_date, '_', meal_type) ELSE NULL END) as p, 
                        COUNT(DISTINCT CASE WHEN status IN ('customer_pause', 'service_pause') THEN CONCAT(attendance_date, '_', meal_type) ELSE NULL END) as a, 
                        COUNT(DISTINCT CASE WHEN status = 'holiday' THEN CONCAT(attendance_date, '_', meal_type) ELSE NULL END) as h 
                     FROM customer_attendance WHERE customer_id = ? AND user_id = ? AND attendance_date >= ? AND attendance_date <= ?`,
                    [customerId, ownerId, cStart, cRenew]
                );
                overallStats = { present_count: parseInt(cSummary[0]?.p || 0), absent_count: parseInt(cSummary[0]?.a || 0), holiday_count: parseInt(cSummary[0]?.h || 0) };
            }

            const rootAttList = existingMap[`${c.id}-0`] || [];
            const rootAtt = rootAttList[rootAttList.length - 1] || null;

            return {
                ...c,
                id: String(c.id),
                packType: c.pack_type,
                mealSlots: c.meal_slots,
                packs: packsWithStats,
                subscription_start_date: cStart,
                renewal_date: cRenew,
                attendance_status: rootAtt?.status || null,
                meal_type: rootAtt?.meal_type || null,
                delivered_at: rootAtt?.updated_at || null,
                attendance_records: rootAttList,
                note: rootAtt?.note || '',
                ...overallStats
            };
        }));

        res.json({ success: true, data: result, date });
    } catch (error) {
        console.error('Get customers for date error:', error);
        res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
    }
};

/**
 * Get attendance summary for a customer
 */
exports.getAttendanceSummary = async (req, res) => {
    try {
        const ownerId = req.ownerId;
        const { customerId, month, year } = req.query;

        if (!customerId) {
            return res.status(400).json({ error: 'customerId is required' });
        }

        let query = `
            SELECT 
                DATE_FORMAT(ca.attendance_date, '%Y-%m') as month,
                ca.pack_id,
                COALESCE(p.name, 'Primary Pack') as pack_name,
                COUNT(*) as total_days,
                SUM(CASE WHEN ca.status = 'delivered' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN ca.status IN ('customer_pause', 'service_pause') THEN 1 ELSE 0 END) as absent_days,
                SUM(CASE WHEN ca.status = 'holiday' THEN 1 ELSE 0 END) as holiday_days
            FROM customer_attendance ca
            JOIN customers c ON ca.customer_id = c.id
            LEFT JOIN customer_packs cp ON ca.pack_id = cp.id
            LEFT JOIN packs p ON (cp.pack_id = p.id OR ca.pack_id = p.id)
            WHERE ca.customer_id = ? AND c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `;
        const params = req.userZone ? [customerId, ownerId, req.userZone] : [customerId, ownerId];

        if (month && year) {
            query += ` AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?`;
            params.push(month, year);
        }

        query += ` GROUP BY DATE_FORMAT(attendance_date, '%Y-%m'), ca.pack_id ORDER BY month DESC, pack_name ASC`;

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get attendance summary error:', error);
        res.status(500).json({ error: 'Failed to fetch summary', details: error.message });
    }
};

/**
 * Mark all renewed customers in a zone as holiday for a specific date
 */
exports.saveZoneHoliday = async (req, res) => {
    let connection;
    try {
        const ownerId = req.ownerId;
        const { zone, date } = req.body;

        if (!zone || !date) {
            return res.status(400).json({ error: 'zone and date are required' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Get all renewed packs in the zone
        const [packs] = await connection.query(
            `SELECT cp.id, cp.customer_id, cp.renewal_date, cp.status, c.name as customer_name
             FROM customer_packs cp 
             JOIN customers c ON cp.customer_id = c.id
             WHERE cp.user_id = ? AND c.zone = ? AND cp.status = 'renewed'`,
            [ownerId, zone]
        );

        // 2. Get all renewed customers in the zone who don't have multi-packs (legacy)
        const [customers] = await connection.query(
            `SELECT id, renewal_date, name FROM customers 
             WHERE user_id = ? AND zone = ? AND status = 'renewed'
             AND id NOT IN (SELECT customer_id FROM customer_packs WHERE user_id = ? AND status = 'renewed')`,
            [ownerId, zone, ownerId]
        );

        const renewalUpdates = [];

        // Process packs
        for (const p of packs) {
            // Check if already marked for this date
            const [existing] = await connection.query(
                `SELECT status FROM customer_attendance WHERE customer_id = ? AND pack_id = ? AND attendance_date = ? AND user_id = ?`,
                [p.customer_id, p.id, date, ownerId]
            );

            const prevStatus = existing[0]?.status || null;
            if (prevStatus === 'holiday') continue; // Already holiday

            // Upsert attendance as holiday
            await connection.query(
                `INSERT INTO customer_attendance (customer_id, pack_id, user_id, attendance_date, status, note)
                 VALUES (?, ?, ?, ?, 'holiday', 'Zone Holiday')
                 ON DUPLICATE KEY UPDATE status = 'holiday', note = 'Zone Holiday'`,
                [p.customer_id, p.id, ownerId, date]
            );

            // Notify Customer & Delivery Man
            const [cRow] = await connection.query(`SELECT delivery_user_id FROM customers WHERE id = ?`, [p.customer_id]);
            const deliveryUserId = cRow[0]?.delivery_user_id;
            
            await saveAndSendNotification(p.customer_id, 'customer', 'Holiday Declared 🌴', `Your delivery for ${date} is cancelled due to a holiday.`, 'info');
            if (deliveryUserId) {
                await saveAndSendNotification(deliveryUserId, 'delivery', 'Holiday Declared 🌴', `Customer #${p.customer_id} delivery for ${date} is cancelled due to a holiday.`, 'info');
            }

            // Extension logic: if it wasn't a pause before, extend renewal date
            if (!PAUSE_STATUSES.includes(prevStatus)) {
                if (p.renewal_date) {
                    const oldRenewal = dateToYMD(p.renewal_date);
                    const newDate = addDeliveryDays(oldRenewal, 1);
                    await connection.query(`UPDATE customer_packs SET renewal_date = ? WHERE id = ?`, [newDate, p.id]);
                    renewalUpdates.push({ customerId: p.customer_id, packId: p.id, name: p.customer_name, oldRenewal, newRenewal: newDate, date });
                }
            }
        }

        // Process legacy customers
        for (const c of customers) {
            const [existing] = await connection.query(
                `SELECT status FROM customer_attendance WHERE customer_id = ? AND pack_id = 0 AND attendance_date = ? AND user_id = ?`,
                [c.id, date, ownerId]
            );

            const prevStatus = existing[0]?.status || null;
            if (prevStatus === 'holiday') continue;

            await connection.query(
                `INSERT INTO customer_attendance (customer_id, pack_id, user_id, attendance_date, status, note)
                 VALUES (?, 0, ?, ?, 'holiday', 'Zone Holiday')
                 ON DUPLICATE KEY UPDATE status = 'holiday', note = 'Zone Holiday'`,
                [c.id, ownerId, date]
            );

            // Notify Customer & Delivery Man
            const [cRow] = await connection.query(`SELECT delivery_user_id FROM customers WHERE id = ?`, [c.id]);
            const deliveryUserId = cRow[0]?.delivery_user_id;
            
            await saveAndSendNotification(c.id, 'customer', 'Holiday Declared 🌴', `Your delivery for ${date} is cancelled due to a holiday.`, 'info');
            if (deliveryUserId) {
                await saveAndSendNotification(deliveryUserId, 'delivery', 'Holiday Declared 🌴', `Customer #${c.id} delivery for ${date} is cancelled due to a holiday.`, 'info');
            }

            if (!PAUSE_STATUSES.includes(prevStatus)) {
                if (c.renewal_date) {
                    const oldRenewal = dateToYMD(c.renewal_date);
                    const newDate = addDeliveryDays(oldRenewal, 1);
                    await connection.query(`UPDATE customers SET renewal_date = ? WHERE id = ?`, [newDate, c.id]);
                    renewalUpdates.push({ customerId: c.id, name: c.name, oldRenewal, newRenewal: newDate, date });
                }
            }
        }

        await connection.commit();
        res.json({
            success: true,
            message: `Marked holiday for ${renewalUpdates.length} customers/packs in ${zone}`,
            renewalUpdates
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Save zone holiday error:', error);
        res.status(500).json({ error: 'Failed to save zone holiday', details: error.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.exportDailyDeliveryList = async (req, res) => {
    try {
        const ownerId = req.ownerId;
        const { date, categoryId } = req.query;
        const PDFDocument = require('pdfkit');

        if (!date || !categoryId) {
            return res.status(400).json({ error: 'Date and Category ID are required' });
        }

        // 1. Get settings for business name
        const [settings] = await pool.query('SELECT business_name FROM settings WHERE user_id = ?', [ownerId]);
        const businessName = settings[0]?.business_name || 'My Delivery App';

        // 2. Get category name
        const [categories] = await pool.query('SELECT name FROM categories WHERE id = ? AND user_id = ?', [categoryId, ownerId]);
        if (categories.length === 0) return res.status(404).json({ error: 'Category not found' });
        const categoryName = categories[0].name;

        // 3. Get customers and their packs for this category
        const [customers] = await pool.query(
            `SELECT DISTINCT c.id, c.name, c.mobile, c.address, c.address2, c.area, c.landmark, c.zone, c.cooking_instructions, c.parcel_label_name, c.nutritional_goal
             FROM customers c
             LEFT JOIN customer_packs cp ON c.id = cp.customer_id
             LEFT JOIN packs p ON (cp.pack_id = p.id OR c.pack_id = p.id)
             WHERE c.user_id = ? AND p.category_id = ?
             AND (c.status = 'renewed' OR cp.status = 'renewed')
             ORDER BY c.name ASC`,
            [ownerId, categoryId]
        );

        // 4. Fetch specific packs for these customers that belong to this category
        const [packs] = await pool.query(
            `SELECT cp.customer_id, p.name as pack_name, cp.quantity, p.id as pack_id, cp.id as customerPackId
             FROM customer_packs cp
             JOIN packs p ON cp.pack_id = p.id
             WHERE cp.user_id = ? AND p.category_id = ? AND cp.status = 'renewed'`,
            [ownerId, categoryId]
        );

        // Fetch attendance to exclude paused ones
        const [attendance] = await pool.query(
            `SELECT customer_id, pack_id, status FROM customer_attendance 
             WHERE user_id = ? AND attendance_date = ?`,
            [ownerId, date]
        );
        const attendanceMap = {};
        attendance.forEach(a => { attendanceMap[`${a.customer_id}-${a.pack_id}`] = a.status; });

        // Filter and group
        const listData = customers.map(c => {
            let custPacks = packs.filter(p => p.customer_id === c.id);

            // Filter out paused
            custPacks = custPacks.filter(p => {
                const status = attendanceMap[`${c.id}-${p.customerPackId}`] || attendanceMap[`${c.id}-${p.pack_id}`] || attendanceMap[`${c.id}-0`];
                return status !== 'customer_pause' && status !== 'service_pause';
            });

            if (custPacks.length === 0) return null;
            return { ...c, packs: custPacks };
        }).filter(Boolean);

        // 5. Generate PDF
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="DeliveryList_${categoryName}_${date}.pdf"`);
        doc.pipe(res);

        // Header
        doc.fontSize(22).font('Helvetica-Bold').text(businessName.toUpperCase(), { align: 'center' });
        doc.fontSize(14).font('Helvetica').text(`Delivery List: ${categoryName}`, { align: 'center' });
        doc.fontSize(12).text(`Date: ${new Date(date).toDateString()}`, { align: 'center' }).moveDown();

        doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke().moveDown();

        if (listData.length === 0) {
            doc.fontSize(12).text('No deliveries scheduled for this category and date.', { align: 'center' });
        } else {
            listData.forEach((c, idx) => {
                if (doc.y > 650) doc.addPage();

                const startY = doc.y;
                doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text(`${idx + 1}. ${c.name.toUpperCase()}`, 35, startY);
                doc.fontSize(11).font('Helvetica-Bold').text(c.mobile, 450, startY, { align: 'right' });
                if (c.parcel_label_name) {
                    doc.fontSize(10).font('Helvetica-Bold').fillColor('#d97706') // Amber
                        .text(`LABEL: ${c.parcel_label_name.toUpperCase()}`, 50, doc.y + 2);
                }
                doc.fontSize(10).font('Helvetica').fillColor('#444444')
                    .text(`${c.area || ''} ${c.landmark ? `· Landmark: ${c.landmark}` : ''}`, 50, doc.y + 2);
                doc.text(`${c.address || ''} ${c.address2 ? `, ${c.address2}` : ''}`, 50, doc.y + 2);

                if (c.nutritional_goal) {
                    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#059669') // Emerald
                        .text(`Goal: ${c.nutritional_goal}`, 50, doc.y + 2);
                }

                if (c.cooking_instructions) {
                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626') // Red
                        .text(`INSTR: ${c.cooking_instructions}`, 50, doc.y + 2);
                }

                doc.moveDown(0.5);
                c.packs.forEach(p => {
                    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
                        .text(`   [ ] ${p.pack_name} x ${p.quantity}`, 60);
                });

                doc.moveDown(1);
                doc.moveTo(35, doc.y).lineTo(560, doc.y).strokeColor('#DDDDDD').stroke().moveDown(0.8);
            });
        }

        doc.end();
    } catch (error) {
        console.error('Export daily list error:', error);
        res.status(500).json({ error: 'Failed to export delivery list', details: error.message });
    }
};
