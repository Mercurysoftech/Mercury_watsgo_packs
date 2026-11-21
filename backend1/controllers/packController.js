const { pool } = require('../config/database');

// Get all packs for logged in user
exports.getAllPacks = async (req, res) => {
    try {
        // --- Safety Migration Check ---
        try {
            const [cols] = await pool.query('SHOW COLUMNS FROM packs');
            const colNames = cols.map(c => c.Field);
            if (!colNames.includes('extra_notes')) {
                await pool.query("ALTER TABLE packs ADD COLUMN extra_notes TEXT DEFAULT NULL");
            }
            if (!colNames.includes('pack_type')) {
                await pool.query("ALTER TABLE packs ADD COLUMN pack_type ENUM('fruits', 'food', 'dairy') DEFAULT 'fruits' AFTER billing_cycle");
            } else {
                try {
                    await pool.query("ALTER TABLE packs MODIFY COLUMN pack_type ENUM('fruits', 'food', 'dairy') DEFAULT 'fruits'");
                } catch(e) {}
            }
            if (!colNames.includes('unit_type')) {
                await pool.query("ALTER TABLE packs ADD COLUMN unit_type ENUM('litres', 'ml', 'grams', 'packets', 'pack') DEFAULT 'litres'");
            }
            if (!colNames.includes('unit_volume')) {
                await pool.query("ALTER TABLE packs ADD COLUMN unit_volume DECIMAL(8,2) DEFAULT 1.00");
            }
            if (!colNames.includes('delivery_shift')) {
                await pool.query("ALTER TABLE packs ADD COLUMN delivery_shift ENUM('morning', 'evening', 'both') DEFAULT 'morning'");
            }
            if (!colNames.includes('meal_slots')) {
                await pool.query("ALTER TABLE packs ADD COLUMN meal_slots VARCHAR(255) DEFAULT NULL AFTER pack_type");
            }
            if (!colNames.includes('billing_days')) {
                try {
                    await pool.query("ALTER TABLE packs MODIFY COLUMN billing_cycle VARCHAR(20) DEFAULT 'weekly'");
                } catch(e) {}
                await pool.query("ALTER TABLE packs ADD COLUMN billing_days INT DEFAULT NULL AFTER billing_cycle");
            }
        } catch (e) {
            console.error('Pack migration check failed:', e.message);
        }
        // ------------------------------

        const [packs] = await pool.query(
            `SELECT p.id, p.name, p.price, p.billing_cycle as billingCycle, p.billing_days as billingDays, p.category_id as categoryId, 
                    p.fruits, p.extra_notes as extraNotes, p.pack_type as packType, p.unit_type as unitType, p.unit_volume as unitVolume,
                    p.delivery_shift as deliveryShift, p.meal_slots as mealSlots, c.name as categoryName,
                    (SELECT COUNT(*) FROM customers WHERE pack_id = p.id) as customerCount
             FROM packs p
             JOIN categories c ON p.category_id = c.id
             WHERE p.user_id = ? 
             ORDER BY c.name ASC, p.name ASC`,
            [req.ownerId]
        );

        res.json({
            success: true,
            packs
        });
    } catch (error) {
        console.error('Get packs error:', error);
        res.status(500).json({ error: 'Failed to get packs' });
    }
};

// Create new pack
exports.createPack = async (req, res) => {
    try {
        const { name, categoryId, price, billingCycle, billingDays, fruits, extraNotes, packType, unitType, unitVolume, deliveryShift, mealSlots } = req.body;

        if (!name || !categoryId || price === undefined || !billingCycle) {
            return res.status(400).json({ error: 'Name, category, price and billing cycle are required' });
        }

        // Check pack limit for trial/free plan
        const [ownerRows] = await pool.query(
            'SELECT subscription_status, subscription_expiry, plan_type FROM users WHERE id = ?',
            [req.ownerId]
        );
        const owner = ownerRows[0] || {};
        const isActive = owner.subscription_status === 'active' &&
            (owner.plan_type === 'free' || owner.plan_type === 'trial' || (owner.subscription_expiry && new Date(owner.subscription_expiry) > new Date()));
        const isTrialOrFree = owner.plan_type === 'trial' || owner.plan_type === 'free';
        const effectivePlan = isActive ? (owner.plan_type || 'pro') : (isTrialOrFree ? (owner.plan_type || 'free') : 'free');

        if (effectivePlan === 'trial' || effectivePlan === 'free') {
            const [[countRow]] = await pool.query(
                'SELECT COUNT(*) as cnt FROM packs WHERE user_id = ?', [req.ownerId]
            );
            if (countRow.cnt >= 1) {
                return res.status(403).json({
                    error: 'Pack limit reached for FREE PLAN (1 pack only). Upgrade to Starter/Growth/Pro to add more fruit packs.',
                    limitReached: true,
                    currentPlan: effectivePlan,
                    limit: 1
                });
            }
        }

        // Verify category ownership
        const [category] = await pool.query(
            'SELECT id FROM categories WHERE id = ? AND user_id = ?',
            [categoryId, req.ownerId]
        );

        if (category.length === 0) {
            return res.status(400).json({ error: 'Invalid category' });
        }

        const [result] = await pool.query(
            'INSERT INTO packs (name, category_id, price, billing_cycle, billing_days, fruits, extra_notes, pack_type, unit_type, unit_volume, delivery_shift, meal_slots, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                name.trim(), categoryId, price, billingCycle, billingDays || null,
                fruits || null, extraNotes || null, packType || 'fruits',
                unitType || 'litres', unitVolume || 1.00, deliveryShift || 'morning',
                mealSlots || null, req.ownerId
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Pack created successfully',
            packId: result.insertId
        });
    } catch (error) {
        console.error('Create pack error:', error);
        res.status(500).json({ error: 'Failed to create pack' });
    }
};

// Update pack
exports.updatePack = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, categoryId, price, billingCycle, billingDays, fruits, extraNotes, packType, unitType, unitVolume, deliveryShift, mealSlots } = req.body;

        if (!name || !categoryId || price === undefined || !billingCycle) {
            return res.status(400).json({ error: 'Name, category, price and billing cycle are required' });
        }

        // Verify ownership
        const [existing] = await pool.query(
            'SELECT id FROM packs WHERE id = ? AND user_id = ?',
            [id, req.ownerId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        // Verify category ownership
        const [category] = await pool.query(
            'SELECT id FROM categories WHERE id = ? AND user_id = ?',
            [categoryId, req.ownerId]
        );

        if (category.length === 0) {
            return res.status(400).json({ error: 'Invalid category' });
        }

        await pool.query(
            'UPDATE packs SET name = ?, category_id = ?, price = ?, billing_cycle = ?, billing_days = ?, fruits = ?, extra_notes = ?, pack_type = ?, unit_type = ?, unit_volume = ?, delivery_shift = ?, meal_slots = ? WHERE id = ? AND user_id = ?',
            [
                name.trim(), categoryId, price, billingCycle, billingDays || null,
                fruits || null, extraNotes || null, packType || 'fruits',
                unitType || 'litres', unitVolume || 1.00, deliveryShift || 'morning',
                mealSlots || null, id, req.ownerId
            ]
        );

        res.json({
            success: true,
            message: 'Pack updated successfully'
        });
    } catch (error) {
        console.error('Update pack error:', error);
        res.status(500).json({ error: 'Failed to update pack' });
    }
};

// Delete pack
exports.deletePack = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const [existing] = await pool.query(
            'SELECT id FROM packs WHERE id = ? AND user_id = ?',
            [id, req.ownerId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        await pool.query('DELETE FROM packs WHERE id = ? AND user_id = ?', [id, req.ownerId]);

        res.json({
            success: true,
            message: 'Pack deleted successfully'
        });
    } catch (error) {
        console.error('Delete pack error:', error);
        res.status(500).json({ error: 'Failed to delete pack' });
    }
};
