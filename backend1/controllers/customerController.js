const { pool } = require('../config/database');
const { sendWhatsApp } = require('../services/messagingService');
const { calculateDistance, calculateDeliveryCharge } = require('../services/googleMapsService');

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

// Get all customers for logged in user
exports.getAllCustomers = async (req, res) => {
    try {
        // Auto-migration: ensure balance and amount_paid columns exist
        const [columns] = await pool.query("SHOW COLUMNS FROM customers");
        const columnNames = columns.map(c => c.Field);
        if (!columnNames.includes('amount_paid')) {
            await pool.query("ALTER TABLE customers ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0");
            console.log("Added amount_paid column to customers table");
        }
        if (!columnNames.includes('balance')) {
            await pool.query("ALTER TABLE customers ADD COLUMN balance DECIMAL(10,2) DEFAULT 0");
            console.log("Added balance column to customers table");
        }
        if (!columnNames.includes('cooking_instructions')) {
            await pool.query("ALTER TABLE customers ADD COLUMN cooking_instructions TEXT");
        }
        if (!columnNames.includes('parcel_label_name')) {
            await pool.query("ALTER TABLE customers ADD COLUMN parcel_label_name VARCHAR(255)");
        }
        if (!columnNames.includes('nutritional_goal')) {
            await pool.query("ALTER TABLE customers ADD COLUMN nutritional_goal VARCHAR(255)");
        }

        try {
            await pool.query("ALTER TABLE customers MODIFY COLUMN renewal_cycle VARCHAR(20) DEFAULT 'monthly'");
            await pool.query("ALTER TABLE customer_packs MODIFY COLUMN renewal_cycle VARCHAR(20) DEFAULT 'monthly'");
        } catch(e) {}

        // --- REAL-TIME FIX: Auto-expire packs that are past their renewal date ---
        await pool.query(
            `UPDATE customer_packs 
             SET status = 'expired' 
             WHERE user_id = ? AND status = 'renewed' AND renewal_date < CURDATE()`,
            [req.ownerId]
        );

        // Also update the main customer status if they have no more renewed packs
        await pool.query(
            `UPDATE customers c
             SET c.status = 'expired'
             WHERE c.user_id = ? AND c.status = 'renewed' 
             AND NOT EXISTS (SELECT 1 FROM customer_packs cp WHERE cp.customer_id = c.id AND cp.status = 'renewed')`,
            [req.ownerId]
        );
        // ----------------------------------------------------------------------

        const [customers] = await pool.query(
            `SELECT c.id, c.name, c.mobile, c.alternative_mobile, c.address, c.address2, c.area, c.landmark, c.location, c.zone, c.subscription_start_date, c.renewal_date, c.status, c.renewal_cycle, c.total_deliveries, c.payment_status, c.last_payment_date, c.amount_paid, c.balance, c.created_at, c.pack_id, c.quantity, c.delivery_user_id,
              c.distance_km, c.delivery_charge, c.extra_fields, c.cooking_instructions, c.parcel_label_name, c.nutritional_goal,
              p.name as pack_name, p.price as pack_base_price, p.pack_type, p.meal_slots,
              du.name as delivery_man_name,
              CASE 
                 WHEN c.renewal_date < CURDATE() AND c.status != 'renewed' THEN 'expired'
                 WHEN c.status = 'renewed' AND c.renewal_date < CURDATE() THEN 'expired'
                 ELSE c.status 
              END as dynamic_status
              FROM customers c
              LEFT JOIN packs p ON c.pack_id = p.id
              LEFT JOIN delivery_user du ON c.delivery_user_id = du.id
              WHERE c.user_id = ?
              ${req.userZone ? "AND c.zone IN (?)" : ""}
              ORDER BY c.renewal_date ASC`,
            req.userZone ? [req.ownerId, req.userZone] : [req.ownerId]
        );

        // Fetch all packs for these customers
        const [customerPacks] = await pool.query(
            `SELECT cp.*, p.name as pack_name, p.price as pack_base_price, p.pack_type, p.meal_slots,
             CASE 
                WHEN cp.renewal_date < CURDATE() AND cp.status != 'renewed' THEN 'expired'
                WHEN cp.status = 'renewed' AND cp.renewal_date < CURDATE() THEN 'expired'
                ELSE cp.status
             END as pack_dynamic_status
             FROM customer_packs cp
             JOIN packs p ON cp.pack_id = p.id
             JOIN customers c ON cp.customer_id = c.id
             WHERE cp.user_id = ?
             ${req.userZone ? "AND c.zone IN (?)" : ""}`,
            req.userZone ? [req.ownerId, req.userZone] : [req.ownerId]
        );

        res.json({
            success: true,
            customers: customers.map(c => {
                const customerPacksData = customerPacks.filter(cp => cp.customer_id == c.id);
                const allPacksPaid = customerPacksData.length > 0
                    ? customerPacksData.every(cp => cp.renewal_date && new Date(cp.renewal_date) >= new Date(new Date().setHours(0, 0, 0, 0)))
                    : (c.renewal_date && new Date(c.renewal_date) >= new Date(new Date().setHours(0, 0, 0, 0)));

                let finalStatus = c.dynamic_status;
                const hasAnyPack = customerPacksData.length > 0 || (c.pack_id && c.pack_id !== 0);

                if (customerPacksData.length > 0) {
                    const hasExpired = customerPacksData.some(cp => cp.pack_dynamic_status === 'expired');
                    const allRenewed = customerPacksData.every(cp => cp.pack_dynamic_status === 'renewed');

                    if (hasExpired) {
                        finalStatus = 'expired';
                    } else if (allRenewed) {
                        finalStatus = 'renewed';
                    } else {
                        finalStatus = 'pending';
                    }
                } else if (!hasAnyPack) {
                    // No packs at all (multi or legacy) -> must be pending
                    finalStatus = 'pending';
                }

                let finalPaymentStatus = c.payment_status || 'unpaid';
                if (finalStatus === 'renewed') {
                    finalPaymentStatus = 'paid';
                } else if (finalStatus === 'pending') {
                    finalPaymentStatus = 'unpaid';
                }



                return {
                    id: c.id,
                    name: c.name,
                    mobile: c.mobile,
                    alternativeMobile: c.alternative_mobile,
                    address: c.address,
                    address2: c.address2,
                    area: c.area,
                    landmark: c.landmark,
                    location: c.location,
                    zone: c.zone,
                    subscriptionStartDate: c.subscription_start_date,
                    renewalDate: c.renewal_date,
                    status: finalStatus, // Use the all-packs calculated status
                    renewalCycle: c.renewal_cycle,
                    totalDeliveries: c.total_deliveries || 0,
                    paymentStatus: finalPaymentStatus,
                    lastPaymentDate: c.last_payment_date,
                    amountPaid: c.amount_paid || 0,
                    balance: c.balance || 0,
                    packId: c.pack_id,
                    packName: c.pack_name,
                    packType: c.pack_type,
                    mealSlots: c.meal_slots,
                    quantity: c.quantity || 1,
                    packPrice: customerPacksData.reduce((sum, cp) => {
                        let multiplier = 1;
                        if (cp.renewal_cycle === 'daily') {
                            multiplier = cp.total_deliveries || 1;
                        }
                        return sum + (cp.pack_base_price * cp.quantity * multiplier);
                    }, 0),
                    packs: customerPacksData.map(cp => ({
                        id: cp.id,
                        packId: cp.pack_id,
                        name: cp.pack_name,
                        price: cp.pack_base_price,
                        quantity: cp.quantity,
                        startDate: cp.start_date,
                        renewalDate: cp.renewal_date,
                        renewalCycle: cp.renewal_cycle,
                        totalDeliveries: cp.total_deliveries,
                        status: cp.pack_dynamic_status,
                        lastPaymentDate: cp.last_payment_date,
                        packType: cp.pack_type || 'fruits',
                        mealSlots: cp.meal_slots || ''
                    })),
                    deliveryUserId: c.delivery_user_id,
                    deliveryManName: c.delivery_man_name,
                    distanceKm: c.distance_km || 0,
                    deliveryCharge: c.delivery_charge || 0,
                    extraFields: c.extra_fields,
                    cookingInstructions: c.cooking_instructions,
                    parcelLabelName: c.parcel_label_name,
                    nutritionalGoal: c.nutritional_goal,
                    createdAt: c.created_at
                };
            })
        });

    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to get customers' });
    }
};

// Get single customer
exports.getCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        // Auto-migration: ensure amount_paid and balance columns exist
        const [columns] = await pool.query("SHOW COLUMNS FROM customers");
        const columnNames = columns.map(c => c.Field);
        if (!columnNames.includes('amount_paid')) {
            await pool.query("ALTER TABLE customers ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0");
        }
        if (!columnNames.includes('balance')) {
            await pool.query("ALTER TABLE customers ADD COLUMN balance DECIMAL(10,2) DEFAULT 0");
        }

        // --- REAL-TIME FIX: Auto-expire packs for this customer ---
        await pool.query(
            `UPDATE customer_packs 
             SET status = 'expired' 
             WHERE customer_id = ? AND status = 'renewed' AND renewal_date < CURDATE()`,
            [id]
        );

        // Also update the main customer status if no renewed packs remain
        await pool.query(
            `UPDATE customers 
             SET status = 'expired'
             WHERE id = ? AND status = 'renewed' 
             AND NOT EXISTS (SELECT 1 FROM customer_packs cp WHERE cp.customer_id = ? AND cp.status = 'renewed')`,
            [id, id]
        );
        // -----------------------------------------------------------

        const [customers] = await pool.query(
            `SELECT c.*, p.name as pack_name, p.price as pack_base_price,
             du.name as delivery_man_name
             FROM customers c
             LEFT JOIN packs p ON c.pack_id = p.id
             LEFT JOIN delivery_user du ON c.delivery_user_id = du.id
             WHERE c.id = ? AND c.user_id = ?`,
            [id, req.ownerId]
        );

        if (customers.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const c = customers[0];

        // Match the same logic as getAllCustomers for dynamic overrides
        const renewalDate = new Date(c.renewal_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        renewalDate.setHours(0, 0, 0, 0);

        // Fetch associated packs
        const [customerPacks] = await pool.query(
            `SELECT cp.*, p.name as pack_name, p.price as pack_base_price
             FROM customer_packs cp
             JOIN packs p ON cp.pack_id = p.id
             WHERE cp.customer_id = ?`,
            [id]
        );

        // Match the same logic as getAllCustomers for dynamic overrides
        const hasAnyPack = customerPacks.length > 0 || (c.pack_id && c.pack_id !== 0);
        if (customerPacks.length > 0) {
            // Apply aggregated status logic for single customer view
            const customerPacksWithStatus = customerPacks.map(cp => {
                const renewalDate = new Date(cp.renewal_date);
                renewalDate.setHours(0, 0, 0, 0);

                let dynStatus = cp.status;
                if (renewalDate < today) {
                    dynStatus = 'expired';
                }
                return { ...cp, pack_dynamic_status: dynStatus };
            });

            const hasExpired = customerPacksWithStatus.some(cp => cp.pack_dynamic_status === 'expired');
            const allRenewed = customerPacksWithStatus.every(cp => cp.pack_dynamic_status === 'renewed');

            if (hasExpired) {
                finalStatus = 'expired';
            } else if (allRenewed) {
                finalStatus = 'renewed';
            } else {
                finalStatus = 'pending';
            }
        } else if (!hasAnyPack) {
            finalStatus = 'pending';
        }

        let finalPaymentStatus = c.payment_status || 'unpaid';
        if (finalStatus === 'renewed') {
            finalPaymentStatus = 'paid';
        } else if (finalStatus === 'pending') {
            finalPaymentStatus = 'unpaid';
        }

        res.json({
            success: true,
            customer: {
                id: c.id,
                name: c.name,
                mobile: c.mobile,
                alternativeMobile: c.alternative_mobile,
                address: c.address,
                address2: c.address2,
                area: c.area,
                landmark: c.landmark,
                location: c.location,
                zone: c.zone,
                subscriptionStartDate: c.subscription_start_date,
                renewalDate: c.renewal_date,
                status: finalStatus,
                renewalCycle: c.renewal_cycle,
                totalDeliveries: c.total_deliveries || 0,
                paymentStatus: finalPaymentStatus,
                lastPaymentDate: c.last_payment_date,
                amountPaid: c.amount_paid || 0,
                balance: c.balance || 0,
                quantity: c.quantity || 1,
                packPrice: customerPacks.reduce((sum, cp) => {
                    let multiplier = 1;
                    if (cp.renewal_cycle === 'daily') {
                        multiplier = cp.total_deliveries || 1;
                    }
                    return sum + (cp.pack_base_price * cp.quantity * multiplier);
                }, 0),
                packs: customerPacks.map(cp => ({
                    id: cp.id,
                    packId: cp.pack_id,
                    name: cp.pack_name,
                    price: cp.pack_base_price,
                    quantity: cp.quantity,
                    startDate: cp.start_date,
                    renewalDate: cp.renewal_date,
                    renewalCycle: cp.renewal_cycle,
                    totalDeliveries: cp.total_deliveries,
                    status: cp.pack_dynamic_status,
                    lastPaymentDate: cp.last_payment_date
                })),
                deliveryUserId: c.delivery_user_id,
                deliveryManName: c.delivery_man_name,
                distanceKm: c.distance_km || 0,
                deliveryCharge: c.delivery_charge || 0,
                extraFields: c.extra_fields,
                cookingInstructions: c.cooking_instructions,
                parcelLabelName: c.parcel_label_name,
                nutritionalGoal: c.nutritional_goal
            }
        });

    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Failed to get customer' });
    }
};

// Check if mobile number exists
exports.checkMobileExists = async (req, res) => {
    try {
        const { mobile, excludeId } = req.query;
        if (!mobile) return res.status(400).json({ error: 'Mobile number is required' });

        const [rows] = await pool.query(
            'SELECT id FROM customers WHERE (mobile = ? OR alternative_mobile = ?) AND user_id = ?' + (excludeId ? ' AND id != ?' : ''),
            excludeId ? [mobile, mobile, req.ownerId, excludeId] : [mobile, mobile, req.ownerId]
        );

        res.json({
            success: true,
            exists: rows.length > 0
        });
    } catch (error) {
        console.error('Check mobile exists error:', error);
        res.status(500).json({ error: 'Failed to check mobile existence' });
    }
};

// Create new customer
exports.createCustomer = async (req, res) => {
    try {
        const {
            name, mobile, alternativeMobile, address, address2, area, landmark, location, zone,
            subscriptionStartDate, renewalDate, renewalCycle, totalDeliveries, packId, quantity,
            deliveryUserId, packs, status, distanceKm, deliveryCharge, extraFields,
            cookingInstructions, parcelLabelName, nutritionalGoal
        } = req.body;

        if (!name || !mobile || !address || !zone) {
            return res.status(400).json({ error: 'Name, mobile, delivery address and zone are required' });
        }

        // Provide defaults for optional subscription fields
        const finalCycle = renewalCycle || 'monthly';
        const finalStartDate = subscriptionStartDate || formatDate(new Date());
        
        // Helper: Add N delivery days (skipping Sundays)
        const addDelDays = (start, days) => {
            let d = new Date(start + 'T00:00:00');
            let remaining = days;
            while (remaining > 0) {
                d.setDate(d.getDate() + 1);
                if (d.getDay() !== 0) remaining--;
            }
            return formatDate(d);
        };

        const deliveries = totalDeliveries || (finalCycle === 'weekly' ? 6 : 24);
        const finalRenewalDate = renewalDate || addDelDays(finalStartDate, deliveries - 1);

        if (name.trim().length < 3) {
            return res.status(400).json({ error: 'Customer name must be at least 3 characters' });
        }

        const phoneRegex = /^\+?[\d\s-]{10,}$/;
        if (!phoneRegex.test(mobile)) {
            return res.status(400).json({ error: 'Please provide a valid mobile number (min 10 digits)' });
        }

        // --- Auto Distance & Delivery Charge Calculation ---
        let finalDistanceKm = distanceKm || 0;
        let finalDeliveryCharge = deliveryCharge || 0;

        try {
            // Get user settings for company address and delivery fees
            const [settingsRows] = await pool.query(
                `SELECT address, delivery_charges, delivery_free_km, delivery_price_per_km, google_maps_api_key 
                 FROM settings WHERE user_id = ?`,
                [req.ownerId]
            );

            if (settingsRows.length > 0) {
                const setting = settingsRows[0];
                // Prioritize .env key if present and not the placeholder
                const apiKey = (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== 'your_google_maps_api_key_here')
                    ? process.env.GOOGLE_MAPS_API_KEY
                    : setting.google_maps_api_key;

                console.log(`[Distance Calc] API Key Present: ${!!apiKey}, User Address: ${address}, Company Address: ${setting.address}`);

                if (apiKey && apiKey !== '********' && setting.address && address) {
                    const dist = await calculateDistance(setting.address, address, apiKey);
                    if (dist !== null) {
                        finalDistanceKm = dist;
                        finalDeliveryCharge = calculateDeliveryCharge(dist, setting);
                        console.log(`[Distance Calc] SUCCESS: distance: ${finalDistanceKm}km, charge: ₹${finalDeliveryCharge}`);
                    } else {
                        console.log(`[Distance Calc] FAILED: calculateDistance returned null`);
                    }
                } else {
                    console.log(`[Distance Calc] SKIPPED: Missing requirement (${!apiKey ? 'apiKey' : !setting.address ? 'companyAddress' : 'userAddress'})`);
                }
            }
        } catch (calcError) {
            console.error('Auto distance/charge calculation failed:', calcError.message);
            // Fallback to provided values (if any) or 0
        }
        // -----------------------------------------------------

        // --- Preventative Schema Check ---
        try {
            // Check columns in customers table
            const [customerCols] = await pool.query(`SHOW COLUMNS FROM customers`);
            const customerColNames = customerCols.map(c => c.Field);

            if (!customerColNames.includes('pack_id')) {
                console.log('Running migration: Adding pack_id to customers');
                await pool.query("ALTER TABLE customers ADD COLUMN pack_id INT");
                await pool.query("ALTER TABLE customers ADD FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE SET NULL");
            }

            if (!customerColNames.includes('renewal_cycle')) {
                console.log('Running migration: Adding renewal_cycle to customers');
                await pool.query("ALTER TABLE customers ADD COLUMN renewal_cycle ENUM('weekly', 'monthly') DEFAULT 'monthly'");
            }

            if (!customerColNames.includes('total_deliveries')) {
                console.log('Running migration: Adding total_deliveries to customers');
                await pool.query("ALTER TABLE customers ADD COLUMN total_deliveries INT DEFAULT 0");
            }
        } catch (schemaError) {
            console.error('Schema check/migration warning:', schemaError.message);
            // Continue anyway, maybe it exists or we can't alter
        }
        // --------------------------------

        // --- Plan-Based Customer Limit Check ---
        const [ownerRows] = await pool.query(
            'SELECT subscription_status, subscription_expiry, plan_type, addon_extra_customers, addon_extra_zones, addon_delivery_boys, addon_customer_app, addon_extra_staff FROM users WHERE id = ?',
            [req.ownerId]
        );
        const owner = ownerRows[0] || {};
        const isActive = owner.subscription_status === 'active' &&
            (owner.plan_type === 'free' || owner.plan_type === 'trial' || (owner.subscription_expiry && new Date(owner.subscription_expiry) > new Date()));
        const isTrialOrFree = owner.plan_type === 'trial' || owner.plan_type === 'free';
        const effectivePlan = isActive ? (owner.plan_type || 'pro') : (isTrialOrFree ? (owner.plan_type || 'free') : 'free');

        const PLAN_LIMITS = { trial: 25, free: 25, starter: 100, growth: 300, pro: Infinity };
        const baseLimit = PLAN_LIMITS[effectivePlan] ?? 25;
        const limit = baseLimit === Infinity ? Infinity : baseLimit + (owner.addon_extra_customers || 0);

        if (limit !== Infinity) {
            const [[countRow]] = await pool.query(
                'SELECT COUNT(*) as cnt FROM customers WHERE user_id = ?', [req.ownerId]
            );
            if (countRow.cnt >= limit) {
                let nextPlan = 'Starter (₹699/mo)';
                if (effectivePlan === 'starter') nextPlan = 'Growth (₹2499/mo)';
                else if (effectivePlan === 'growth') nextPlan = 'Pro (₹4999/mo)';

                const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

                return res.status(403).json({
                    error: `Customer limit reached for ${capitalize(effectivePlan)} Plan (${limit} customers). Upgrade to ${nextPlan} to add more.`,
                    limitReached: true,
                    currentPlan: effectivePlan,
                    limit
                });
            }
        }
        // --- Plan-Based Zone Limit Check ---
        const ZONE_LIMITS = { trial: 1, free: 1, starter: 5, growth: 10, pro: Infinity };
        const baseZoneLimit = ZONE_LIMITS[effectivePlan] ?? 1;
        const zoneLimit = baseZoneLimit === Infinity ? Infinity : baseZoneLimit + (owner.addon_extra_zones || 0);

        if (zoneLimit !== Infinity) {
            const [distinctZones] = await pool.query(
                'SELECT DISTINCT zone FROM customers WHERE user_id = ? AND zone IS NOT NULL AND zone != ""',
                [req.ownerId]
            );
            const usedZones = distinctZones.map(z => z.zone.toLowerCase());

            if (!usedZones.includes(zone.trim().toLowerCase()) && usedZones.length >= zoneLimit) {
                return res.status(403).json({
                    error: `Zone limit reached for ${effectivePlan.toUpperCase()} Plan (${zoneLimit} zones). Upgrade your plan or buy 'Extra Zones' addon in Settings.`,
                    limitReached: true,
                    currentPlan: effectivePlan,
                    limit: zoneLimit
                });
            }
        }
        // ----------------------------------------

        const validStatuses = ['renewed', 'pending', 'expired'];
        let initialStatus = status || ((packId || (Array.isArray(packs) && packs.length > 0)) ? 'renewed' : 'pending');
        if (!validStatuses.includes(initialStatus)) {
            initialStatus = (initialStatus === 'active') ? 'renewed' : 'pending';
        }

        // Update: Insert customer
        const [result] = await pool.query(
            `INSERT INTO customers (name, mobile, alternative_mobile, address, address2, area, landmark, location, zone, subscription_start_date, renewal_date, renewal_cycle, total_deliveries, pack_id, quantity, delivery_user_id, user_id, status, distance_km, delivery_charge, extra_fields, cooking_instructions, parcel_label_name, nutritional_goal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, mobile, alternativeMobile || null, address, address2 || null, area || null, landmark || null, location || null, zone || null, formatDate(finalStartDate), formatDate(finalRenewalDate), finalCycle, totalDeliveries || 0, packId || null, quantity || 1, deliveryUserId || null, req.ownerId, initialStatus, finalDistanceKm, finalDeliveryCharge, extraFields ? JSON.stringify(extraFields) : null, cookingInstructions || null, parcelLabelName || null, nutritionalGoal || null]
        );
        const customerId = result.insertId;

        // Multi-Pack addition
        if (Array.isArray(packs) && packs.length > 0) {
            const values = packs.map(p => [
                customerId,
                p.packId,
                p.quantity || 1,
                req.ownerId,
                p.status || 'active',
                formatDate(p.startDate || finalStartDate),
                formatDate(p.renewalDate || finalRenewalDate),
                p.renewalCycle || finalCycle,
                p.totalDeliveries || totalDeliveries || 24,
                formatDate(p.lastPaymentDate)
            ]);
            await pool.query(
                'INSERT INTO customer_packs (customer_id, pack_id, quantity, user_id, status, start_date, renewal_date, renewal_cycle, total_deliveries, last_payment_date) VALUES ?',
                [values]
            );
        } else if (packId) {
            // Legacy single pack fallback: insert the primary pack into customer_packs too
            await pool.query(
                'INSERT INTO customer_packs (customer_id, pack_id, quantity, user_id, status, start_date, renewal_date, renewal_cycle, total_deliveries, last_payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [customerId, packId, quantity || 1, req.ownerId, initialStatus, formatDate(finalStartDate), formatDate(finalRenewalDate), finalCycle, totalDeliveries || 24, null]
            );
        }

        // Get user settings (Select * to avoid missing column errors)
        const [settingsResult] = await pool.query(
            `SELECT * FROM settings WHERE user_id = ?`,
            [req.ownerId]
        );

        // Send welcome message if settings are configured
        if (settingsResult && settingsResult.length > 0) {
            const setting = settingsResult[0];
            const businessName = setting.business_name || 'Fresh Fruit Packs';
            const formattedRenewalDate = new Date(renewalDate).toLocaleDateString('en-GB', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
            const formattedStartDate = new Date(subscriptionStartDate).toLocaleDateString('en-GB', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });

            // Prepare welcome message
            const prepareWelcomeMessage = async (template) => {
                let packName = 'N/A';
                let packPrice = 'N/A';

                if (packId) {
                    const [packRows] = await pool.query('SELECT name, price FROM packs WHERE id = ?', [packId]);
                    if (packRows.length > 0) {
                        packName = packRows[0].name;
                        packPrice = `₹${packRows[0].price}`;
                    }
                }

                if (!template) {
                    return `Hi ${name}, Welcome to ${businessName}! Your ${packName} (${packPrice}) subscription starts from ${formattedStartDate} and renewal is on ${formattedRenewalDate}. Thank you for choosing us!`;
                }
                return template
                    .replace(/{{customer_name}}/g, name)
                    .replace(/{{renewal_date}}/g, formattedRenewalDate)
                    .replace(/{{pack_name}}/g, packName)
                    .replace(/{{pack_price}}/g, packPrice)
                    .replace(/{{business_name}}/g, businessName);
            };

            // Send WhatsApp if enabled
            if (setting.whatsapp_enabled && setting.whatsapp_api_key) {
                // Auto-sending is disabled for now as per user request
                /*
                const message = prepareWelcomeMessage(setting.whatsapp_reminder_template);
                const whatsappResult = await sendWhatsApp(
                    mobile,
                    message,
                    setting.whatsapp_api_key,
                    setting.whatsapp_phone_number_id
                );

                // Log the welcome message
                await pool.query(
                    `INSERT INTO reminders (customer_id, sent_via, message, status, sent_at, error_message)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        customerId,
                        'whatsapp',
                        message,
                        whatsappResult.success ? 'sent' : 'failed',
                        whatsappResult.success ? new Date() : null,
                        whatsappResult.error || null
                    ]
                );

                if (whatsappResult.success) {
                    console.log(`✅ Welcome WhatsApp sent to ${name}`);
                }
                */
            }

            // Send SMS if enabled
            if (setting.sms_reminders) {
                // Auto-sending is disabled for now as per user request
                /*
                const message = prepareWelcomeMessage(setting.sms_reminder_template);
                const smsResult = await sendSMS(mobile, message, setting.sms_template_id);

                // Log the welcome message
                await pool.query(
                    `INSERT INTO reminders (customer_id, sent_via, message, status, sent_at, error_message)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        customerId,
                        'sms',
                        message,
                        smsResult.success ? 'sent' : 'failed',
                        smsResult.success ? new Date() : null,
                        smsResult.error || null
                    ]
                );

                if (smsResult.success) {
                    console.log(`✅ Welcome SMS sent to ${name}`);
                }
                */
            }
        }

        res.status(201).json({
            success: true,
            message: 'Customer created successfully and welcome message sent',
            customerId: customerId
        });

    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({
            error: 'Failed to create customer',
            details: error.message,
            sqlMessage: error.sqlMessage || undefined
        });
    }
};

// Update customer
exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mobile, alternativeMobile, address, address2, area, landmark, location, zone, subscriptionStartDate, renewalDate, status, renewalCycle, totalDeliveries, packId, quantity, deliveryUserId, packs, distanceKm, deliveryCharge, extraFields, cookingInstructions, parcelLabelName, nutritionalGoal, paymentStatus, lastPaymentDate } = req.body;

        if (!address || !zone) {
            return res.status(400).json({ error: 'Delivery address and Zone are mandatory' });
        }

        // 1. Verify ownership first
        const [existing] = await pool.query(
            'SELECT id FROM customers WHERE id = ? AND user_id = ?',
            [id, req.ownerId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Customer not found or access denied' });
        }

        // --- Auto Distance & Delivery Charge Calculation ---
        let finalDistanceKm = distanceKm;
        let finalDeliveryCharge = deliveryCharge;

        try {
            // Get current customer address to see if it changed (optimization)
            const [custRows] = await pool.query('SELECT address FROM customers WHERE id = ?', [id]);
            const addressChanged = custRows.length > 0 && custRows[0].address !== address;

            // Get user settings
            const [settingsRows] = await pool.query(
                `SELECT address, delivery_charges, delivery_free_km, delivery_price_per_km, google_maps_api_key 
                 FROM settings WHERE user_id = ?`,
                [req.ownerId]
            );

            if (settingsRows.length > 0) {
                const setting = settingsRows[0];
                const apiKey = (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== 'your_google_maps_api_key_here')
                    ? process.env.GOOGLE_MAPS_API_KEY
                    : setting.google_maps_api_key;

                // Re-calculate if address changed OR if distance/charge were not provided (legacy update)
                // Also re-calculate if they are explicitly 0 and an address is present
                const isZero = Number(distanceKm || 0) === 0;

                console.log(`[Distance Update] addressChanged: ${addressChanged}, isZero: ${isZero}, distanceKm: ${distanceKm}`);

                if (addressChanged || isZero || (distanceKm === undefined && deliveryCharge === undefined)) {
                    if (apiKey && apiKey !== '********' && setting.address && address) {
                        const dist = await calculateDistance(setting.address, address, apiKey);
                        if (dist !== null) {
                            finalDistanceKm = dist;
                            finalDeliveryCharge = calculateDeliveryCharge(dist, setting);
                            console.log(`[Distance Update] SUCCESS: distance: ${finalDistanceKm}km, charge: ₹${finalDeliveryCharge}`);
                        } else {
                            console.log(`[Distance Update] FAILED: calculateDistance returned null`);
                        }
                    } else {
                        console.log(`[Distance Update] SKIPPED: Missing requirement (${!apiKey ? 'apiKey' : !setting.address ? 'companyAddress' : 'userAddress'})`);
                    }
                }
            }
        } catch (calcError) {
            console.error('Auto distance/charge calculation failed:', calcError.message);
        }
        // --- Plan-Based Zone Limit Check ---
        const [ownerRows] = await pool.query(
            'SELECT subscription_status, subscription_expiry, plan_type, addon_extra_zones, addon_extra_customers, addon_delivery_boys, addon_customer_app, addon_extra_staff FROM users WHERE id = ?',
            [req.ownerId]
        );
        const owner = ownerRows[0] || {};
        const isActive = owner.subscription_status === 'active' &&
            (owner.plan_type === 'free' || owner.plan_type === 'trial' || (owner.subscription_expiry && new Date(owner.subscription_expiry) > new Date()));
        const isTrialOrFree = owner.plan_type === 'trial' || owner.plan_type === 'free';
        const effectivePlan = isActive ? (owner.plan_type || 'pro') : (isTrialOrFree ? (owner.plan_type || 'free') : 'free');

        const ZONE_LIMITS = { trial: 1, free: 1, starter: 5, growth: 10, pro: Infinity };
        const baseZoneLimit = ZONE_LIMITS[effectivePlan] ?? 1;
        const zoneLimit = baseZoneLimit === Infinity ? Infinity : baseZoneLimit + (owner.addon_extra_zones || 0);

        if (zoneLimit !== Infinity) {
            const [distinctZones] = await pool.query(
                'SELECT DISTINCT zone FROM customers WHERE user_id = ? AND zone IS NOT NULL AND zone != ""',
                [req.ownerId]
            );
            const usedZones = distinctZones.map(z => z.zone.toLowerCase());

            if (!usedZones.includes(zone.trim().toLowerCase()) && usedZones.length >= zoneLimit) {
                return res.status(403).json({
                    error: `Zone limit reached for ${effectivePlan.toUpperCase()} Plan (${zoneLimit} zones). Upgrade your plan or buy 'Extra Zones' addon in Settings.`,
                    limitReached: true,
                    currentPlan: effectivePlan,
                    limit: zoneLimit
                });
            }
        }
        // ----------------------------------------

        const validStatuses = ['renewed', 'pending', 'expired'];
        let finalStatusToSave = status || 'pending';
        if (!validStatuses.includes(finalStatusToSave)) {
            finalStatusToSave = (finalStatusToSave === 'active') ? 'renewed' : 'pending';
        }

        // 2. Perform the update - targeting only by ID now since we verified ownership
        await pool.query(
            `UPDATE customers 
             SET name = ?, mobile = ?, alternative_mobile = ?, address = ?, address2 = ?, area = ?, landmark = ?, location = ?, zone = ?, subscription_start_date = ?, renewal_date = ?, status = ?, renewal_cycle = ?, total_deliveries = ?, pack_id = ?, quantity = ?, delivery_user_id = ?, distance_km = ?, delivery_charge = ?, extra_fields = ?, cooking_instructions = ?, parcel_label_name = ?, nutritional_goal = ?, payment_status = COALESCE(?, payment_status), last_payment_date = COALESCE(?, last_payment_date)
             WHERE id = ?`,
            [
                name,
                mobile,
                alternativeMobile || null,
                address,
                address2 || null,
                area || null,
                landmark || null,
                location || null,
                zone || null,
                formatDate(subscriptionStartDate),
                formatDate(renewalDate),
                finalStatusToSave,
                renewalCycle,
                totalDeliveries || 0,
                packId || null,
                quantity || 1,
                deliveryUserId || null,
                finalDistanceKm || 0,
                finalDeliveryCharge || 0,
                extraFields ? JSON.stringify(extraFields) : null,
                cookingInstructions || null,
                parcelLabelName || null,
                nutritionalGoal || null,
                paymentStatus || null,
                formatDate(lastPaymentDate) || null,
                id
            ]
        );

        // Handle multiple packs update
        if (Array.isArray(packs)) {
            // Remove existing packs
            await pool.query('DELETE FROM customer_packs WHERE customer_id = ?', [id]);

            // Insert new packs with individual dates/cycles
            if (packs.length > 0) {
                const values = packs.map(p => [
                    id,
                    p.packId,
                    p.quantity || 1,
                    req.ownerId,
                    p.status || 'active',
                    formatDate(p.startDate),
                    formatDate(p.renewalDate),
                    p.renewalCycle || 'monthly',
                    p.totalDeliveries || 24,
                    formatDate(p.lastPaymentDate)
                ]);
                await pool.query(
                    'INSERT INTO customer_packs (customer_id, pack_id, quantity, user_id, status, start_date, renewal_date, renewal_cycle, total_deliveries, last_payment_date) VALUES ?',
                    [values]
                );

                // Update legacy main customer columns with primary pack data
                const first = packs[0];
                await pool.query(
                    `UPDATE customers SET 
                        pack_id = ?, 
                        quantity = ?, 
                        subscription_start_date = ?, 
                        renewal_date = ?, 
                        renewal_cycle = ?, 
                        total_deliveries = ?,
                        last_payment_date = ?
                     WHERE id = ?`,
                    [
                        first.packId,
                        first.quantity || 1,
                        formatDate(first.startDate),
                        formatDate(first.renewalDate),
                        first.renewalCycle || 'monthly',
                        first.totalDeliveries || 24,
                        formatDate(first.lastPaymentDate),
                        id
                    ]
                );
            }
        }

        res.json({
            success: true,
            message: 'Customer updated successfully'
        });

    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const [existing] = await pool.query(
            'SELECT id FROM customers WHERE id = ? AND user_id = ?',
            [id, req.ownerId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        await pool.query('DELETE FROM customers WHERE id = ? AND user_id = ?', [id, req.ownerId]);

        res.json({
            success: true,
            message: 'Customer deleted successfully'
        });

    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
    try {
        const ownerId = req.ownerId;

        // --- REAL-TIME FIX: Auto-expire packs and customers before fetching stats ---
        await pool.query(
            `UPDATE customer_packs 
             SET status = 'expired' 
             WHERE user_id = ? AND (status = 'renewed' OR status = 'active') AND renewal_date < CURDATE()`,
            [ownerId]
        );

        await pool.query(
            `UPDATE customers c
             SET c.status = 'expired'
             WHERE c.user_id = ? AND c.status = 'renewed' 
             AND NOT EXISTS (SELECT 1 FROM customer_packs cp WHERE cp.customer_id = c.id AND (cp.status = 'renewed' OR cp.status = 'active'))`,
            [ownerId]
        );
        // -----------------------------------------------------------------------------

        // 1. Basic Stats
        const [totalResult] = await pool.query(
            `SELECT COUNT(*) as total FROM customers WHERE user_id = ?`, [ownerId]
        );
        // Active Subscriptions: Count customers who have ANY active and not expired pack (main table OR multi-pack table)
        const [activeResult] = await pool.query(
            `SELECT COUNT(DISTINCT c.id) as total 
             FROM customers c 
             LEFT JOIN customer_packs cp ON c.id = cp.customer_id
             WHERE c.user_id = ? 
             AND (
                (c.status = 'renewed' AND c.renewal_date >= CURDATE()) OR
                ((cp.status = 'active' OR cp.status = 'renewed') AND cp.renewal_date >= CURDATE())
             )`, [ownerId]
        );
        // Pending Renewals: Count customers who have ANY pack (main or multi) due within 7 days
        const [pendingResult] = await pool.query(
            `SELECT COUNT(DISTINCT c.id) as total 
             FROM customers c
             LEFT JOIN customer_packs cp ON c.id = cp.customer_id
             WHERE c.user_id = ? 
             AND (
                (c.renewal_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)) OR
                (cp.renewal_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY))
             )`, [ownerId]
        );
        const [newThisMonthResult] = await pool.query(
            `SELECT COUNT(*) as total FROM customers WHERE user_id = ? AND created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')`, [ownerId]
        );
        const [newLastMonthResult] = await pool.query(
            `SELECT COUNT(*) as total FROM customers WHERE user_id = ? AND created_at >= DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 1 MONTH) AND created_at < DATE_FORMAT(CURDATE(),'%Y-%m-01')`, [ownerId]
        );

        const totalCustomers = totalResult[0].total || 0;
        const activeSubscriptions = activeResult[0].total || 0;
        const pendingRenewals = pendingResult[0].total || 0;
        const newThisMonth = newThisMonthResult[0].total || 0;
        const newLastMonth = newLastMonthResult[0].total || 0;

        const calcTrend = (current, previous) => {
            if (!previous || previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        // 2. Revenue this month (from customers.amount_paid or payment_history)
        let revenueThisMonth = 0;
        let deliveryRevenueThisMonth = 0;
        let revenueTrendData = [];
        let recentPaymentsList = [];

        try {
            // Use payment_history joined with packs for revenue
            const [revResult] = await pool.query(
                `SELECT 
                    COALESCE(SUM(COALESCE(ph.amount, 0) + COALESCE(ph.delivery_charge, 0)), 0) as total,
                    COALESCE(SUM(COALESCE(ph.delivery_charge, 0)), 0) as deliveryTotal
                 FROM payment_history ph
                 WHERE ph.user_id = ? AND ph.payment_status = 'paid'
                 AND ph.payment_date >= DATE_FORMAT(CURDATE(),'%Y-%m-01')`,
                [ownerId]
            );
            revenueThisMonth = parseFloat(revResult[0].total) || 0;
            deliveryRevenueThisMonth = parseFloat(revResult[0].deliveryTotal) || 0;

            // Revenue trend — GROUP BY and SELECT use same DATE_FORMAT pattern
            const [revTrend] = await pool.query(
                `SELECT DATE_FORMAT(payment_date, '%Y-%m') as month_key,
                        DATE_FORMAT(MIN(payment_date), '%b') as month,
                        SUM(COALESCE(ph.amount, 0) + COALESCE(ph.delivery_charge, 0)) as revenue
                 FROM payment_history ph
                 WHERE ph.user_id = ? AND ph.payment_status = 'paid'
                 AND ph.payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                 GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
                 ORDER BY month_key ASC`,
                [ownerId]
            );
            revenueTrendData = revTrend.map(r => ({ month: r.month, revenue: parseFloat(r.revenue) || 0 }));

            // Recent payments — include all paid records with pack price as fallback
            const [recentPay] = await pool.query(
                `SELECT c.name,
                        ph.payment_status as status,
                        (COALESCE(ph.amount, 0) + COALESCE(ph.delivery_charge, 0)) as amount,
                        ph.payment_date as date
                 FROM payment_history ph
                 JOIN customers c ON ph.customer_id = c.id
                 WHERE ph.user_id = ? AND ph.payment_status = 'paid'
                 ORDER BY ph.payment_date DESC LIMIT 5`,
                [ownerId]
            );
            recentPaymentsList = recentPay.map(p => ({ ...p, amount: parseFloat(p.amount) || 0 }));

        } catch (revErr) {
            console.error('Revenue query error (non-fatal):', revErr.message);
        }

        // 3. Subscription growth — GROUP BY and SELECT use same DATE_FORMAT
        let subscriptionGrowthData = [];
        try {
            const [growth] = await pool.query(
                `SELECT DATE_FORMAT(created_at, '%Y-%m') as month_key,
                        DATE_FORMAT(MIN(created_at), '%b') as month,
                        COUNT(*) as count
                 FROM customers
                 WHERE user_id = ?
                 AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                 GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                 ORDER BY month_key ASC`,
                [ownerId]
            );
            subscriptionGrowthData = growth.map(r => ({ month: r.month, count: parseInt(r.count) || 0 }));
        } catch (e) {
            console.error('Subscription growth query error:', e.message);
        }

        // 4. Upcoming Renewals
        let upcomingRenewalsList = [];
        try {
            // Get upcoming renewals including multi-pack support
            const [upcoming] = await pool.query(
                `SELECT c.name, 
                        COALESCE(p.name, (SELECT p2.name FROM customer_packs cp2 JOIN packs p2 ON cp2.pack_id = p2.id WHERE cp2.customer_id = c.id LIMIT 1), 'Basic Pack') as packName,
                        COALESCE(p.price, (SELECT p2.price FROM customer_packs cp2 JOIN packs p2 ON cp2.pack_id = p2.id WHERE cp2.customer_id = c.id LIMIT 1), 0) as price, 
                        c.renewal_date as renewalDate
                 FROM customers c
                 LEFT JOIN packs p ON c.pack_id = p.id
                 WHERE c.user_id = ? AND c.renewal_date >= CURDATE()
                 ORDER BY c.renewal_date ASC LIMIT 5`,
                [ownerId]
            );
            upcomingRenewalsList = upcoming.map(r => ({ ...r, price: parseFloat(r.price) || 0 }));
        } catch (e) {
            console.error('Upcoming renewals query error:', e.message);
        }

        // 5. Net Profit (Last 3 Months Revenue)
        let netProfit = 0;
        try {
            const [netProfitResult] = await pool.query(
                `SELECT COALESCE(SUM(COALESCE(ph.amount, 0) + COALESCE(ph.delivery_charge, 0)), 0) as total
                 FROM payment_history ph
                 WHERE ph.user_id = ? AND ph.payment_status = 'paid'
                 AND ph.payment_date >= DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 2 MONTH)`,
                [ownerId]
            );
            netProfit = parseFloat(netProfitResult[0].total) || 0;
        } catch (e) {
            console.error('Net profit calculation error:', e.message);
        }

        // Build the 6-month label array for chart padding
        const last6MonthsLabels = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1); 
            d.setMonth(d.getMonth() - i);
            last6MonthsLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
        }

        const padChartData = (data, valueKey) => {
            const map = {};
            data.forEach(d => { map[d.month] = d[valueKey]; });
            return last6MonthsLabels.map(m => ({ month: m, [valueKey]: map[m] || 0 }));
        };

        res.json({
            success: true,
            stats: {
                totalCustomers: {
                    value: totalCustomers,
                    trend: calcTrend(newThisMonth, newLastMonth)
                },
                netProfit: {
                    value: netProfit,
                    label: 'Last 3 Months'
                },
                activeSubscriptions: {
                    value: activeSubscriptions,
                    trend: 0
                },
                pendingRenewals: {
                    value: pendingRenewals,
                    label: 'Due this week'
                },
                monthlyRevenue: {
                    value: revenueThisMonth,
                    trend: 0,
                    currency: 'INR'
                },
                deliveryRevenue: {
                    value: deliveryRevenueThisMonth,
                    trend: 0,
                    currency: 'INR'
                },
                charts: {
                    revenueTrend: padChartData(revenueTrendData, 'revenue'),
                    subscriptionGrowth: padChartData(subscriptionGrowthData, 'count')
                },
                lists: {
                    upcomingRenewals: upcomingRenewalsList,
                    recentPayments: recentPaymentsList
                }
            }
        });

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics', details: error.message });
    }
};

// Bulk Assign Delivery User
exports.bulkAssignDeliveryUser = async (req, res) => {
    try {
        const { customerIds, deliveryUserId } = req.body;
        const ownerId = req.ownerId;

        if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
            return res.status(400).json({ error: 'Customer IDs are required and must be an array' });
        }

        if (!deliveryUserId) {
            return res.status(400).json({ error: 'Delivery User ID is required' });
        }

        // 1. Verify delivery user exists and belongs to this owner
        const [delUser] = await pool.query(
            'SELECT id FROM delivery_user WHERE id = ? AND user_id = ?',
            [deliveryUserId, req.userId] // User management used req.userId
        );

        if (delUser.length === 0) {
            return res.status(404).json({ error: 'Delivery user not found or access denied' });
        }

        // 2. Perform the update for all selected customers belonging to this owner
        const [result] = await pool.query(
            'UPDATE customers SET delivery_user_id = ? WHERE id IN (?) AND user_id = ?',
            [deliveryUserId, customerIds, ownerId]
        );

        res.json({
            success: true,
            message: `Successfully assigned ${result.affectedRows} customers to delivery man`,
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error('Bulk assign error:', error);
        res.status(500).json({ error: 'Failed to assign customers to delivery man' });
    }
};

// Bulk Unassign Delivery User
exports.bulkUnassignDeliveryUser = async (req, res) => {
    try {
        const { customerIds } = req.body;
        const ownerId = req.ownerId;

        if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
            return res.status(400).json({ error: 'Customer IDs are required' });
        }

        const [result] = await pool.query(
            'UPDATE customers SET delivery_user_id = NULL WHERE id IN (?) AND user_id = ?',
            [customerIds, ownerId]
        );

        res.json({
            success: true,
            message: `Successfully unassigned ${result.affectedRows} customers`,
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error('Bulk unassign error:', error);
        res.status(500).json({ error: 'Failed to unassign customers' });
    }
};

exports.bulkAssignByArea = async (req, res) => {
    const { areas, deliveryUserId } = req.body;
    const ownerId = req.ownerId; // Using req.ownerId as per existing project pattern

    if (!areas || !Array.isArray(areas) || !deliveryUserId) {
        return res.status(400).json({ error: 'Missing areas or deliveryUserId' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE customers SET delivery_user_id = ? WHERE area IN (?) AND user_id = ?',
            [deliveryUserId, areas, ownerId]
        );

        res.json({
            success: true,
            message: `Successfully assigned ${result.affectedRows} customers in selected areas`,
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error('Bulk assign area error:', error);
        res.status(500).json({ error: 'Failed to assign customers by area' });
    }
};

// --- NEW: Force Recalculate Distance ---
exports.recalculateDistance = async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.ownerId;

        // 1. Get customer and setting details
        const [custRows] = await pool.query('SELECT address, user_id FROM customers WHERE id = ? AND user_id = ?', [id, ownerId]);
        if (custRows.length === 0) return res.status(404).json({ error: 'Customer not found' });
        const customer = custRows[0];

        const [settingsRows] = await pool.query(
            `SELECT address, delivery_charges, delivery_free_km, delivery_price_per_km, google_maps_api_key 
             FROM settings WHERE user_id = ?`,
            [ownerId]
        );
        if (settingsRows.length === 0) return res.status(404).json({ error: 'Settings not found' });
        const setting = settingsRows[0];

        // 2. Compute using Google
        const apiKey = (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== 'your_google_maps_api_key_here')
            ? process.env.GOOGLE_MAPS_API_KEY
            : setting.google_maps_api_key;

        if (!apiKey || apiKey === '********' || !setting.address || !customer.address) {
            return res.status(400).json({ error: 'Missing configuration (API Key or Addresses)' });
        }

        const dist = await calculateDistance(setting.address, customer.address, apiKey);
        if (dist === null) return res.status(500).json({ error: 'Failed to calculate distance from Google' });

        const charge = calculateDeliveryCharge(dist, setting);

        // 3. Save and return
        await pool.query(
            'UPDATE customers SET distance_km = ?, delivery_charge = ? WHERE id = ?',
            [dist, charge, id]
        );

        res.json({
            success: true,
            distanceKm: dist,
            deliveryCharge: charge
        });

    } catch (error) {
        console.error('Recalculate distance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Export customers as CSV
exports.exportCustomers = async (req, res) => {
    try {
        const ownerId = req.ownerId;
        const { zone, area, customerIds } = req.query;

        // Auto-expire packs
        await pool.query(
            `UPDATE customer_packs SET status = 'expired' WHERE user_id = ? AND status = 'renewed' AND renewal_date < CURDATE()`,
            [ownerId]
        );
        await pool.query(
            `UPDATE customers c SET c.status = 'expired' WHERE c.user_id = ? AND c.status = 'renewed' AND NOT EXISTS (SELECT 1 FROM customer_packs cp WHERE cp.customer_id = c.id AND cp.status = 'renewed')`,
            [ownerId]
        );

        let queryParams = [ownerId];
        let zoneFilter = "";
        if (zone) {
            zoneFilter = " AND c.zone = ?";
            queryParams.push(zone);
        } else if (req.userZone) {
            zoneFilter = " AND c.zone IN (?)";
            queryParams.push(req.userZone);
        }
        
        let areaFilter = "";
        if (area) {
            areaFilter = " AND c.area = ?";
            queryParams.push(area);
        }

        let idFilter = "";
        if (customerIds) {
            const idsArray = customerIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            if (idsArray.length > 0) {
                idFilter = ` AND c.id IN (${idsArray.map(() => '?').join(',')})`;
                queryParams.push(...idsArray);
            }
        }

        const [customers] = await pool.query(
            `SELECT c.id, c.name, c.mobile, c.alternative_mobile, c.address, c.address2, c.area, c.landmark, c.location, c.zone, c.subscription_start_date, c.renewal_date, c.status, c.renewal_cycle, c.total_deliveries, c.payment_status, c.last_payment_date, c.amount_paid, c.balance, c.created_at, c.pack_id, c.quantity, c.delivery_user_id,
              c.distance_km, c.delivery_charge, c.extra_fields, c.cooking_instructions, c.parcel_label_name, c.nutritional_goal,
              p.name as pack_name, p.price as pack_base_price,
              du.name as delivery_man_name,
              CASE 
                 WHEN c.renewal_date < CURDATE() AND c.status != 'renewed' THEN 'expired'
                 WHEN c.status = 'renewed' AND c.renewal_date < CURDATE() THEN 'expired'
                 ELSE c.status 
              END as dynamic_status
              FROM customers c
              LEFT JOIN packs p ON c.pack_id = p.id
              LEFT JOIN delivery_user du ON c.delivery_user_id = du.id
              WHERE c.user_id = ?
              ${zoneFilter}
              ${areaFilter}
              ${idFilter}
              ORDER BY c.name ASC`,
            queryParams
        );

        const [customerPacks] = await pool.query(
            `SELECT cp.*, p.name as pack_name, p.price as pack_base_price,
             CASE 
                WHEN cp.renewal_date < CURDATE() AND cp.status != 'renewed' THEN 'expired'
                WHEN cp.status = 'renewed' AND cp.renewal_date < CURDATE() THEN 'expired'
                ELSE cp.status
             END as pack_dynamic_status
             FROM customer_packs cp
             JOIN packs p ON cp.pack_id = p.id
             JOIN customers c ON cp.customer_id = c.id
             WHERE cp.user_id = ?
             ${zoneFilter}
             ${areaFilter}
             ${idFilter}`,
            queryParams
        );

        if (customers.length === 0) {
            return res.status(404).json({ error: 'No customers found to export' });
        }

        const formattedData = customers.map(c => {
            const customerPacksData = customerPacks.filter(cp => cp.customer_id == c.id);
            let finalStatus = c.dynamic_status;
            const hasAnyPack = customerPacksData.length > 0 || (c.pack_id && c.pack_id !== 0);

            if (customerPacksData.length > 0) {
                const hasExpired = customerPacksData.some(cp => cp.pack_dynamic_status === 'expired');
                const allRenewed = customerPacksData.every(cp => cp.pack_dynamic_status === 'renewed');

                if (hasExpired) {
                    finalStatus = 'expired';
                } else if (allRenewed) {
                    finalStatus = 'renewed';
                } else {
                    finalStatus = 'pending';
                }
            } else if (!hasAnyPack) {
                finalStatus = 'pending';
            }

            let finalPaymentStatus = c.payment_status || 'unpaid';
            if (finalStatus === 'renewed') {
                finalPaymentStatus = 'paid';
            } else if (finalStatus === 'pending') {
                finalPaymentStatus = 'unpaid';
            }

            // Extract packs information
            const packNames = customerPacksData.length > 0 ? customerPacksData.map(p => p.pack_name).join(' + ') : (c.pack_name || 'No Pack');
            const totalPackPrice = customerPacksData.reduce((sum, cp) => {
                let multiplier = 1;
                if (cp.renewal_cycle === 'daily') {
                    multiplier = cp.total_deliveries || 1;
                }
                return sum + (cp.pack_base_price * cp.quantity * multiplier);
            }, 0) || 0;
            const quantities = customerPacksData.length > 0 ? customerPacksData.map(p => p.quantity).join(', ') : (c.quantity || 1);

            return {
                'Name': c.name,
                'Mobile': c.mobile,
                'Alternative Mobile': c.alternative_mobile || '',
                'Address': c.address || '',
                'Area': c.area || '',
                'Zone': c.zone || '',
                'Pack(s)': packNames,
                'Quantity': quantities,
                'Total Price': totalPackPrice > 0 ? totalPackPrice : '',
                'Status': finalStatus.toUpperCase(),
                'Payment Status': finalPaymentStatus.toUpperCase(),
                'Renewal Date': c.renewal_date ? new Date(c.renewal_date).toLocaleDateString() : '',
                'Start Date': c.subscription_start_date ? new Date(c.subscription_start_date).toLocaleDateString() : '',
                'Delivery Charge': c.delivery_charge || 0,
                'Balance': c.balance || 0,
                'Amount Paid': c.amount_paid || 0,
                'Delivery Boy': c.delivery_man_name || ''
            };
        });

        const headers = Object.keys(formattedData[0]);
        const csv = [headers.join(',')];

        formattedData.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });
            csv.push(values.join(','));
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
        res.send(csv.join('\n'));

    } catch (error) {
        console.error('Export customers error:', error);
        res.status(500).json({ error: 'Failed to export customers', details: error.message });
    }
};

// Export customers as PDF
exports.exportCustomersPDF = async (req, res) => {
    try {
        const ownerId = req.ownerId;
        const { zone, area, customerIds } = req.query;
        const PDFDocument = require('pdfkit');
        const path = require('path');

        let queryParams = [ownerId];
        let zoneFilter = "";
        if (zone) {
            zoneFilter = " AND c.zone = ?";
            queryParams.push(zone);
        } else if (req.userZone) {
            zoneFilter = " AND c.zone IN (?)";
            queryParams.push(req.userZone);
        }
        
        let areaFilter = "";
        if (area) {
            areaFilter = " AND c.area = ?";
            queryParams.push(area);
        }

        let idFilter = "";
        if (customerIds) {
            const idsArray = customerIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            if (idsArray.length > 0) {
                idFilter = ` AND c.id IN (${idsArray.map(() => '?').join(',')})`;
                queryParams.push(...idsArray);
            }
        }

        const [customers] = await pool.query(
            `SELECT c.id, c.name, c.mobile, c.area, c.zone, c.renewal_date, c.status, c.pack_id, c.payment_status,
              CASE 
                 WHEN c.renewal_date < CURDATE() AND c.status != 'renewed' THEN 'expired'
                 WHEN c.status = 'renewed' AND c.renewal_date < CURDATE() THEN 'expired'
                 ELSE c.status 
              END as dynamic_status,
              p.name as pack_name
              FROM customers c
              LEFT JOIN packs p ON c.pack_id = p.id
              WHERE c.user_id = ?
              ${zoneFilter}
              ${areaFilter}
              ${idFilter}
              ORDER BY c.name ASC`,
            queryParams
        );

        const [customerPacks] = await pool.query(
            `SELECT cp.*, p.name as pack_name,
             CASE 
                WHEN cp.renewal_date < CURDATE() AND cp.status != 'renewed' THEN 'expired'
                WHEN cp.status = 'renewed' AND cp.renewal_date < CURDATE() THEN 'expired'
                ELSE cp.status
             END as pack_dynamic_status
             FROM customer_packs cp
             JOIN packs p ON cp.pack_id = p.id
             JOIN customers c ON cp.customer_id = c.id
             WHERE cp.user_id = ?
             ${zoneFilter}
             ${areaFilter}
             ${idFilter}`,
            queryParams
        );

        if (customers.length === 0) {
            return res.status(404).json({ error: 'No customers found to export' });
        }

        const formattedData = customers.map(c => {
            const customerPacksData = customerPacks.filter(cp => cp.customer_id == c.id);
            let finalStatus = c.dynamic_status;
            const hasAnyPack = customerPacksData.length > 0 || (c.pack_id && c.pack_id !== 0);

            if (customerPacksData.length > 0) {
                const hasExpired = customerPacksData.some(cp => cp.pack_dynamic_status === 'expired');
                const allRenewed = customerPacksData.every(cp => cp.pack_dynamic_status === 'renewed');

                if (hasExpired) {
                    finalStatus = 'expired';
                } else if (allRenewed) {
                    finalStatus = 'renewed';
                } else {
                    finalStatus = 'pending';
                }
            } else if (!hasAnyPack) {
                finalStatus = 'pending';
            }

            let finalPaymentStatus = c.payment_status || 'unpaid';
            if (finalStatus === 'renewed') {
                finalPaymentStatus = 'paid';
            } else if (finalStatus === 'pending') {
                finalPaymentStatus = 'unpaid';
            }

            const packNames = customerPacksData.length > 0 ? customerPacksData.map(p => p.pack_name).join(' + ') : (c.pack_name || 'No Pack');

            return {
                name: c.name,
                mobile: c.mobile,
                area: c.area || '',
                zone: c.zone || '',
                status: finalStatus.toUpperCase(),
                paymentStatus: finalPaymentStatus.toUpperCase(),
                renewalDate: c.renewal_date ? new Date(c.renewal_date).toLocaleDateString() : '',
                packName: packNames
            };
        });

        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="customers_list.pdf"');
        doc.pipe(res);

        // Title
        doc.fontSize(20).text('Customer List', { align: 'center' }).moveDown();
        if (zone || area) {
            doc.fontSize(10).text(`Filters: ${zone ? `Zone: ${zone}` : ''} ${area ? `Area: ${area}` : ''}`, { align: 'center' }).moveDown();
        }

        // Table Header
        const tableTop = 120;
        const colWidths = [120, 90, 90, 80, 70, 70, 80, 140];
        const headers = ['Name', 'Mobile', 'Area', 'Zone', 'Status', 'Pay Status', 'Renewal', 'Pack'];
        
        let x = 30;
        doc.fontSize(9).fillColor('#000000');
        headers.forEach((h, i) => {
            doc.text(h, x, tableTop, { width: colWidths[i], bold: true });
            x += colWidths[i];
        });

        doc.moveTo(30, tableTop + 15).lineTo(780, tableTop + 15).stroke();

        // Table Rows
        let y = tableTop + 25;
        formattedData.forEach(row => {
            if (y > 500) {
                doc.addPage({ layout: 'landscape' });
                y = 50;
                let x2 = 30;
                headers.forEach((h, i) => {
                    doc.text(h, x2, y, { width: colWidths[i], bold: true });
                    x2 += colWidths[i];
                });
                doc.moveTo(30, y + 15).lineTo(780, y + 15).stroke();
                y += 25;
            }

            let xRow = 30;
            doc.text(row.name || '', xRow, y, { width: colWidths[0] }); xRow += colWidths[0];
            doc.text(row.mobile || '', xRow, y, { width: colWidths[1] }); xRow += colWidths[1];
            doc.text(row.area || '', xRow, y, { width: colWidths[2] }); xRow += colWidths[2];
            doc.text(row.zone || '', xRow, y, { width: colWidths[3] }); xRow += colWidths[3];
            doc.text(row.status || '', xRow, y, { width: colWidths[4] }); xRow += colWidths[4];
            doc.text(row.paymentStatus || '', xRow, y, { width: colWidths[5] }); xRow += colWidths[5];
            doc.text(row.renewalDate || '', xRow, y, { width: colWidths[6] }); xRow += colWidths[6];
            doc.text(row.packName || '', xRow, y, { width: colWidths[7] });
            
            y += 20;
        });

        doc.end();

    } catch (error) {
        console.error('Export customers PDF error:', error);
        res.status(500).json({ error: 'Failed to export customers PDF', details: error.message });
    }
};

// Get Customer Insights (Top, Inactive, High Value)
exports.getCustomerInsights = async (req, res) => {
    try {
        const ownerId = req.ownerId;
        const userZone = req.userZone;

        // --- REAL-TIME FIX: Auto-expire packs and customers before fetching insights ---
        await pool.query(
            `UPDATE customer_packs 
             SET status = 'expired' 
             WHERE user_id = ? AND status = 'renewed' AND renewal_date < CURDATE()`,
            [ownerId]
        );

        await pool.query(
            `UPDATE customers c
             SET c.status = 'expired'
             WHERE c.user_id = ? AND c.status = 'renewed' 
             AND NOT EXISTS (SELECT 1 FROM customer_packs cp WHERE cp.customer_id = c.id AND cp.status = 'renewed')`,
            [ownerId]
        );
        // ------------------------------------------------------------------------------

        let zoneFilter = "";
        let params = [ownerId];
        if (userZone) {
            zoneFilter = " AND c.zone IN (?)";
            params.push(userZone);
        }

        // 1. Top Customers (By payment frequency)
        const [topCustomers] = await pool.query(`
            SELECT c.id, c.name, c.mobile, COUNT(ph.id) as payment_count, SUM(ph.amount) as total_spent
            FROM customers c
            LEFT JOIN payment_history ph ON c.id = ph.customer_id
            WHERE c.user_id = ? ${zoneFilter}
            GROUP BY c.id
            ORDER BY payment_count DESC
            LIMIT 3
        `, params);

        // 2. Inactive Customers (Expired status or passed renewal date in main table OR packs table)
        const [inactiveCustomers] = await pool.query(`
            SELECT DISTINCT c.id, c.name, c.mobile, 
                   COALESCE(c.renewal_date, (SELECT MIN(renewal_date) FROM customer_packs WHERE customer_id = c.id)) as renewal_date, 
                   c.status
            FROM customers c
            LEFT JOIN customer_packs cp ON c.id = cp.customer_id
            WHERE c.user_id = ? 
            AND (
                TRIM(LOWER(c.status)) LIKE '%expir%' 
                OR TRIM(LOWER(c.status)) = 'inactive'
                OR (c.renewal_date IS NOT NULL AND c.renewal_date < CURDATE())
                OR cp.status = 'expired'
                OR (cp.renewal_date IS NOT NULL AND cp.renewal_date < CURDATE())
            )
            ${zoneFilter}
            ORDER BY renewal_date DESC
            LIMIT 5
        `, params);

        // 3. High Value Customers (Highest total revenue)
        const [highValueCustomers] = await pool.query(`
            SELECT c.id, c.name, c.mobile, SUM(ph.amount) as total_revenue
            FROM customers c
            JOIN payment_history ph ON c.id = ph.customer_id
            WHERE c.user_id = ? ${zoneFilter}
            GROUP BY c.id
            ORDER BY total_revenue DESC
            LIMIT 3
        `, params);

        // 4. Counts for cards
        const [[{ totalCustomers }]] = await pool.query(`
            SELECT COUNT(*) as totalCustomers FROM customers c WHERE c.user_id = ? ${zoneFilter}
        `, params);

        const [[{ totalRenewed }]] = await pool.query(`
            SELECT COUNT(*) as totalRenewed FROM customers c WHERE c.user_id = ? AND status = 'renewed' ${zoneFilter}
        `, params);

        const [[{ totalExpired }]] = await pool.query(`
            SELECT COUNT(DISTINCT c.id) as totalExpired 
            FROM customers c 
            LEFT JOIN customer_packs cp ON c.id = cp.customer_id
            WHERE c.user_id = ? 
            AND (
                TRIM(LOWER(c.status)) LIKE '%expir%' 
                OR TRIM(LOWER(c.status)) = 'inactive'
                OR (c.renewal_date IS NOT NULL AND c.renewal_date < CURDATE())
                OR cp.status = 'expired'
                OR (cp.renewal_date IS NOT NULL AND cp.renewal_date < CURDATE())
            )
            ${zoneFilter}
        `, params);

        const [[{ totalRevenue }]] = await pool.query(`
            SELECT COALESCE(SUM(ph.amount), 0) as totalRevenue
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.user_id = ? ${zoneFilter}
        `, params);

        const [[{ revenueThisMonth }]] = await pool.query(`
            SELECT COALESCE(SUM(ph.amount), 0) as revenueThisMonth
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.user_id = ? AND ph.payment_date >= DATE_FORMAT(CURDATE(),'%Y-%m-01') ${zoneFilter}
        `, params);

        const [[{ collectionToday }]] = await pool.query(`
            SELECT COALESCE(SUM(ph.amount), 0) as collectionToday
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.user_id = ? AND DATE(ph.payment_date) = CURDATE() ${zoneFilter}
        `, params);

        res.status(200).json({
            success: true,
            insights: {
                topCustomers: topCustomers || [],
                inactiveCustomers: inactiveCustomers || [],
                highValueCustomers: highValueCustomers || [],
                totalCustomers: totalCustomers || 0,
                totalRenewed: totalRenewed || 0,
                totalExpired: totalExpired || 0,
                totalRevenue: totalRevenue || 0,
                revenueThisMonth: revenueThisMonth || 0,
                collectionToday: collectionToday || 0
            }
        });
    } catch (error) {
        console.error('Get customer insights error:', error);
        res.status(500).json({ error: 'Failed to fetch customer insights' });
    }
};
