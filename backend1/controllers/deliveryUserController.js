const { pool } = require('../config/database');

/**
 * Get all delivery users for the current user
 */
exports.getAll = async (req, res) => {
    try {
        const userId = req.userId;

        // --- Safety Migration Check ---
        try {
            const [cols] = await pool.query('SHOW COLUMNS FROM delivery_user');
            const colNames = cols.map(c => c.Field);
            if (!colNames.includes('address')) {
                await pool.query("ALTER TABLE delivery_user ADD COLUMN address TEXT AFTER mobile");
            }
        } catch (e) {
            console.error('Delivery user migration check failed:', e.message);
        }
        // ------------------------------

        const [rows] = await pool.query(
            'SELECT * FROM delivery_user WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.json({ success: true, delivery_users: rows });
    } catch (error) {
        console.error('Get delivery users error:', error);
        res.status(500).json({ error: 'Failed to fetch delivery users' });
    }
};

/**
 * Create a new delivery user
 */
exports.create = async (req, res) => {
    try {
        const userId = req.userId;
        const { name, mobile, address } = req.body;

        if (!name || !mobile) {
            return res.status(400).json({ error: 'Name and mobile are required' });
        }

        const cleanMobile = mobile.replace(/\s/g, "").replace(/^\+?91/, "");
        const [existing] = await pool.query(
            'SELECT id FROM delivery_user WHERE mobile LIKE ?',
            [`%${cleanMobile}`]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'This mobile number is already registered for a delivery man.' });
        }

        // --- Plan-Based Delivery Boy Limit Check ---
        let owner = {};
        try {
            const [ownerRows] = await pool.query(
                'SELECT subscription_status, subscription_expiry, plan_type, addon_delivery_boys FROM users WHERE id = ?',
                [userId]
            );
            owner = ownerRows[0] || {};
        } catch (e) {
            // Fallback: query without addon_delivery_boys if column missing
            try {
                const [ownerRows] = await pool.query(
                    'SELECT subscription_status, subscription_expiry, plan_type FROM users WHERE id = ?',
                    [userId]
                );
                owner = ownerRows[0] || {};
            } catch (e2) { /* ignore */ }
        }

        const isActive = owner.subscription_status === 'active' &&
            (['free', 'trial', 'basic'].includes(owner.plan_type) || (owner.subscription_expiry && new Date(owner.subscription_expiry) > new Date()));
        const isLowPlan = ['trial', 'free', 'basic'].includes(owner.plan_type);
        const effectivePlan = isActive ? (owner.plan_type || 'pro') : (isLowPlan ? (owner.plan_type || 'free') : 'free');

        // Limits: trial/free/basic get 5 delivery boys; starter gets 5; growth gets 10; pro/enterprise: unlimited
        const BASE_LIMITS = { trial: 5, free: 5, basic: 5, starter: 5, growth: 10, pro: Infinity, enterprise: Infinity };
        const baseLimit = BASE_LIMITS[effectivePlan] ?? 5;
        const addonDeliveryBoys = Number(owner.addon_delivery_boys) || 0;
        const totalLimit = baseLimit === Infinity ? Infinity : baseLimit + addonDeliveryBoys;

        if (totalLimit !== Infinity) {
            const [[countRow]] = await pool.query(
                'SELECT COUNT(*) as cnt FROM delivery_user WHERE user_id = ?', [userId]
            );
            if (countRow.cnt >= totalLimit) {
                return res.status(403).json({
                    error: `Delivery boy limit reached for ${effectivePlan.toUpperCase()} Plan (${totalLimit}). Upgrade to Growth/Pro to add more delivery boys.`,
                    limitReached: true,
                    currentPlan: effectivePlan,
                    limit: totalLimit
                });
            }
        }
        // ------------------------------------------

        const [result] = await pool.query(
            'INSERT INTO delivery_user (name, mobile, address, user_id) VALUES (?, ?, ?, ?)',
            [name, mobile, address || null, userId]
        );

        res.json({
            success: true,
            message: 'Delivery user added successfully',
            delivery_user: {
                id: result.insertId,
                name,
                mobile,
                address,
                user_id: userId
            }
        });
    } catch (error) {
        console.error('Create delivery user error:', error);
        res.status(500).json({ error: 'Failed to create delivery user' });
    }
};

/**
 * Delete a delivery user
 */
exports.delete = async (req, res) => {
    try {
        const userId = req.userId;
        const ownerId = req.ownerId; // Get the owner ID who owns the customers
        const { id } = req.params;

        // 1. Unassign from customers first to avoid FK constraint issues if any
        await pool.query(
            'UPDATE customers SET delivery_user_id = NULL WHERE delivery_user_id = ? AND user_id = ?',
            [id, ownerId]
        );

        // 2. Unassign from reviews (optional but safe)
        try {
            await pool.query('UPDATE reviews SET delivery_user_id = NULL WHERE delivery_user_id = ?', [id]);
        } catch (e) { /* ignore ifReviewsTableNotExisting */ }

        // 3. Delete the delivery man
        const [result] = await pool.query(
            'DELETE FROM delivery_user WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Delivery user not found' });
        }

        res.json({ success: true, message: 'Delivery user deleted successfully' });
    } catch (error) {
        console.error('Delete delivery user error:', error);
        res.status(500).json({ error: 'Failed to delete delivery user' });
    }
};

// Update delivery user
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mobile, address } = req.body;
        const userId = req.userId;

        if (!name || !mobile) {
            return res.status(400).json({ error: 'Name and mobile are required' });
        }

        const cleanMobile = mobile.replace(/\s/g, "").replace(/^\+?91/, "");
        const [existing] = await pool.query(
            'SELECT id FROM delivery_user WHERE mobile LIKE ? AND id != ?',
            [`%${cleanMobile}`, id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'This mobile number is already registered for another delivery man.' });
        }

        const [result] = await pool.query(
            'UPDATE delivery_user SET name = ?, mobile = ?, address = ? WHERE id = ? AND user_id = ?',
            [name, mobile, address || null, id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Delivery user not found or access denied' });
        }

        res.json({
            success: true,
            message: 'Delivery user updated successfully',
            delivery_user: { id, name, mobile, address, user_id: userId }
        });
    } catch (error) {
        console.error('Update delivery user error:', error);
        res.status(500).json({ error: 'Failed to update delivery user' });
    }
};

// Get customers assigned to this delivery man
exports.getAssignedCustomers = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        // Verify the delivery man belongs to this user
        const [delUser] = await pool.query(
            'SELECT id FROM delivery_user WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (delUser.length === 0) {
            return res.status(404).json({ error: 'Delivery man not found or access denied' });
        }

        const [rows] = await pool.query(
            `SELECT c.id, c.name, c.mobile, c.address, c.status, c.renewal_date, c.payment_status,
             p.name as pack_name, c.pack_id, c.zone, c.area, p.category_id, cat.name as category_name, p.pack_type, p.meal_slots
             FROM customers c
             LEFT JOIN packs p ON c.pack_id = p.id
             LEFT JOIN categories cat ON p.category_id = cat.id
             WHERE c.delivery_user_id = ? AND c.user_id = ?`,
            [id, req.ownerId] // Using ownerId as per customer logic
        );

        // Fetch additional packs for each customer
        const customers = await Promise.all(rows.map(async (c) => {
            const [packs] = await pool.query(
                `SELECT cp.id as customerPackId, p.name, cp.quantity, cp.status, cp.renewal_date, p.category_id, cat.name as category_name, p.pack_type, p.meal_slots
                 FROM customer_packs cp
                 JOIN packs p ON cp.pack_id = p.id
                 LEFT JOIN categories cat ON p.category_id = cat.id
                 WHERE cp.customer_id = ?`,
                [c.id]
            );
            return {
                ...c,
                packs: packs.length > 0 ? packs.map(pack => ({
                    ...pack,
                    categoryName: pack.category_name,
                    packType: pack.pack_type,
                    mealSlots: pack.meal_slots
                })) : [{
                    customerPackId: 0,
                    name: c.pack_name || 'Primary Pack',
                    status: c.status,
                    renewal_date: c.renewal_date,
                    categoryName: c.category_name,
                    packType: c.pack_type,
                    mealSlots: c.meal_slots
                }]
            };
        }));

        res.json({ success: true, customers });
    } catch (error) {
        console.error('Get assigned customers error:', error);
        res.status(500).json({ error: 'Failed to get assigned customers' });
    }
};

/**
 * Export delivery boy's sheet as PDF with optional meal filter
 */
exports.exportDeliveryPDF = async (req, res) => {
    try {
        const userId = req.userId;
        const ownerId = req.ownerId;
        const { id } = req.params; // delivery user ID
        const { date, meal, selectedKeys } = req.query;
        const PDFDocument = require('pdfkit');

        let allowedKeysSet = null;
        if (selectedKeys) {
            allowedKeysSet = new Set(selectedKeys.split(','));
        }

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        // 1. Get delivery user
        const [delUser] = await pool.query(
            'SELECT name, mobile FROM delivery_user WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        if (delUser.length === 0) {
            return res.status(404).json({ error: 'Delivery user not found' });
        }
        const deliveryUserName = delUser[0].name;

        // 2. Get settings for business name
        const [settings] = await pool.query('SELECT business_name FROM settings WHERE user_id = ?', [ownerId]);
        const businessName = settings[0]?.business_name || 'My Delivery App';

        // 3. Get assigned customers
        const [rows] = await pool.query(
            `SELECT c.id, c.name, c.mobile, c.address, c.address2, c.area, c.landmark, c.zone,
             c.cooking_instructions, c.parcel_label_name, c.nutritional_goal,
             c.status, c.renewal_date, p.name as pack_name, c.pack_id, p.pack_type, p.meal_slots
             FROM customers c
             LEFT JOIN packs p ON c.pack_id = p.id
             WHERE c.delivery_user_id = ? AND c.user_id = ?`,
            [id, ownerId]
        );

        // 4. Fetch additional packs for each customer
        const customersWithPacks = await Promise.all(rows.map(async (c) => {
            const [packs] = await pool.query(
                `SELECT cp.id as customerPackId, p.name, cp.quantity, cp.status, cp.renewal_date, p.pack_type, p.meal_slots
                 FROM customer_packs cp
                 JOIN packs p ON cp.pack_id = p.id
                 WHERE cp.customer_id = ? AND cp.status = 'renewed'`,
                [c.id]
            );
            
            const packsList = packs.length > 0 ? packs.map(pack => ({
                customerPackId: pack.customerPackId,
                name: pack.name,
                status: pack.status,
                renewalDate: pack.renewal_date,
                packType: pack.pack_type,
                mealSlots: pack.meal_slots
            })) : (c.pack_id ? [{
                customerPackId: 0,
                name: c.pack_name || 'Primary Pack',
                status: c.status,
                renewalDate: c.renewal_date,
                packType: c.pack_type,
                mealSlots: c.meal_slots
            }] : []);

            return {
                ...c,
                packs: packsList
            };
        }));

        // 5. Fetch attendance for this date
        const [attendance] = await pool.query(
            `SELECT customer_id, pack_id, status, meal_type, updated_at FROM customer_attendance 
             WHERE user_id = ? AND attendance_date = ?`,
             [ownerId, date]
        );

        // Helper to query attendance status
        const getAttRecord = (customerId, packId, mealType) => {
            return attendance.find(r => 
                String(r.customer_id) === String(customerId) &&
                (Number(r.pack_id) === Number(packId)) &&
                (!mealType || String(r.meal_type).toLowerCase() === String(mealType).toLowerCase())
            );
        };

        // Filter and build the listData
        const listData = [];
        const filterMeal = meal ? meal.trim().toLowerCase() : '';

        customersWithPacks.forEach(c => {
            const matchedPacks = [];

            c.packs.forEach(p => {
                const rowKey = `${c.id}_${p.customerPackId || 0}`;
                if (allowedKeysSet && !allowedKeysSet.has(rowKey)) {
                    return;
                }

                const isFood = p.packType === 'food';
                
                if (isFood) {
                    const allowedMeals = p.mealSlots 
                        ? p.mealSlots.split(',').map(m => m.trim().toLowerCase()).filter(Boolean)
                        : ['breakfast', 'lunch', 'dinner'];

                    if (filterMeal && filterMeal !== 'all') {
                        // Specific meal filter
                        if (allowedMeals.includes(filterMeal)) {
                            const att = getAttRecord(c.id, p.customerPackId, filterMeal);
                            const status = att?.status || 'pending';
                            
                            // Exclude paused deliveries
                            if (status !== 'customer_pause' && status !== 'service_pause') {
                                matchedPacks.push({
                                    name: p.name,
                                    packType: p.packType,
                                    meal: filterMeal,
                                    status,
                                    deliveryTime: att?.updated_at ? new Date(att.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : null
                                });
                            }
                        }
                    } else {
                        // All meals or no filter
                        allowedMeals.forEach(m => {
                            const att = getAttRecord(c.id, p.customerPackId, m);
                            const status = att?.status || 'pending';

                            if (status !== 'customer_pause' && status !== 'service_pause') {
                                matchedPacks.push({
                                    name: p.name,
                                    packType: p.packType,
                                    meal: m,
                                    status,
                                    deliveryTime: att?.updated_at ? new Date(att.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : null
                                });
                            }
                        });
                    }
                } else {
                    // Fruit / standard pack
                    if (!filterMeal || filterMeal === 'all') {
                        const att = getAttRecord(c.id, p.customerPackId, 'none');
                        const status = att?.status || 'pending';

                        if (status !== 'customer_pause' && status !== 'service_pause') {
                            matchedPacks.push({
                                name: p.name,
                                packType: p.packType,
                                meal: 'none',
                                status,
                                deliveryTime: att?.updated_at ? new Date(att.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : null
                            });
                        }
                    }
                }
            });

            if (matchedPacks.length > 0) {
                listData.push({
                    ...c,
                    packs: matchedPacks
                });
            }
        });

        // 6. Generate PDF
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="DeliveryBoy_${deliveryUserName}_${date}.pdf"`);
        doc.pipe(res);

        // Header
        doc.fontSize(22).font('Helvetica-Bold').text(businessName.toUpperCase(), { align: 'center' });
        doc.fontSize(14).font('Helvetica').text(`Delivery List: ${deliveryUserName}`, { align: 'center' });
        doc.fontSize(12).text(`Date: ${new Date(date).toDateString()} ${filterMeal && filterMeal !== 'all' ? `· Meal: ${filterMeal.toUpperCase()}` : ''}`, { align: 'center' }).moveDown();

        doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke().moveDown();

        if (listData.length === 0) {
            doc.fontSize(12).text('No deliveries scheduled for this delivery boy, date, and meal choice.', { align: 'center' });
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
                    let statusTxt = '[ ]';
                    if (p.status === 'delivered') {
                        statusTxt = `[x] DELIVERED ${p.deliveryTime ? `at ${p.deliveryTime}` : ''}`;
                    } else if (p.status === 'holiday') {
                        statusTxt = '[H] HOLIDAY';
                    }

                    const mealText = p.meal && p.meal !== 'none' ? ` (${p.meal.toUpperCase()})` : '';
                    doc.fontSize(11).font('Helvetica-Bold').fillColor(p.status === 'delivered' ? '#16a34a' : '#000000')
                        .text(`   ${statusTxt} - ${p.name}${mealText}`, 60);
                });

                doc.moveDown(1);
                doc.moveTo(35, doc.y).lineTo(560, doc.y).strokeColor('#DDDDDD').stroke().moveDown(0.8);
            });
        }

        doc.end();

    } catch (error) {
        console.error('Export delivery PDF error:', error);
        res.status(500).json({ error: 'Failed to export delivery list', details: error.message });
    }
};
